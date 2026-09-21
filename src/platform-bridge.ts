import type { PlatformInitMessage, SdkInitPayload } from './platform-types';

const INIT_TIMEOUT_MS = 15000;

declare global {
  interface Window {
    __OYNA360_PLATFORM_INIT__?: PlatformInitMessage;
    /** Set only when init was stored from a trusted source (parent or same-window publish). */
    __OYNA360_PLATFORM_INIT_OK__?: boolean;
    __OYNA360_DEV__?: {
      platformUrl?: string;
      platformWebUrl?: string;
      gameSlug?: string;
    };
  }
}

function isEmbedded(): boolean {
  try {
    return typeof window !== 'undefined' && window.parent !== window;
  } catch {
    return true;
  }
}

function pinnedPlatformOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.__OYNA360_DEV__?.platformWebUrl;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Accept platform:init only from:
 * - iframe parent (Production), or
 * - same-window synthetic publish (Direct Dev / game-sdk), origin === location.origin
 */
function isTrustedInitEvent(event: MessageEvent): boolean {
  if (typeof window === 'undefined') return false;
  const data = event.data;
  if (!data || typeof data !== 'object') return false;
  if ((data as { type?: string }).type !== 'platform:init') return false;

  const pinned = pinnedPlatformOrigin();

  if (isEmbedded()) {
    if (event.source !== window.parent) return false;
    if (pinned && event.origin !== pinned) return false;
    return true;
  }

  // Top-level / Direct Dev: only same-origin synthetic (or same-window) messages.
  if (event.origin !== window.location.origin) return false;
  if (event.source != null && event.source !== window) return false;
  return true;
}

function storeTrustedInit(message: PlatformInitMessage) {
  window.__OYNA360_PLATFORM_INIT__ = message;
  window.__OYNA360_PLATFORM_INIT_OK__ = true;
}

function parentTarget(): string {
  const pinned = pinnedPlatformOrigin();
  if (pinned) return pinned;
  try {
    if (typeof document !== 'undefined' && document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    /* ignore */
  }
  return '*';
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    if (!isTrustedInitEvent(event)) return;
    storeTrustedInit(event.data as PlatformInitMessage);
  });
}

export class PlatformBridge {
  static waitForInit(timeoutMs = INIT_TIMEOUT_MS): Promise<PlatformInitMessage> {
    return new Promise((resolve, reject) => {
      // Direct Development: game-sdk may have already published a trusted platform:init.
      if (window.__OYNA360_PLATFORM_INIT_OK__ && window.__OYNA360_PLATFORM_INIT__) {
        resolve(window.__OYNA360_PLATFORM_INIT__);
        return;
      }

      const inIframe = isEmbedded();

      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(
          new Error(
            inIframe
              ? 'Timed out waiting for platform:init'
              : 'Timed out waiting for platform:init — call PlatformSDK.init() first (Direct Development Mode)',
          ),
        );
      }, timeoutMs);

      const onMessage = (event: MessageEvent) => {
        if (!isTrustedInitEvent(event)) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        const message = event.data as PlatformInitMessage;
        storeTrustedInit(message);
        resolve(message);
      };

      window.addEventListener('message', onMessage);
      if (inIframe) {
        window.parent.postMessage({ type: 'platform:lobby:ready' }, parentTarget());
      }
    });
  }

  static fromInit(init: SdkInitPayload | PlatformInitMessage): SdkInitPayload {
    if ('type' in init && init.type === 'platform:init') {
      return {
        session: init.session,
        user: init.user,
        game: init.game,
        avatar: init.avatar,
        avatarBases: init.avatarBases,
        lobby: init.lobby,
      };
    }
    return init;
  }

  static createDevInit(options: {
    mockUser?: Partial<SdkInitPayload['user']>;
    mockAvatar?: Partial<SdkInitPayload['avatar']>;
    gameSlug?: string;
    gameName?: string;
  }): SdkInitPayload {
    return {
      session: { id: 'dev-session', token: 'dev-token' },
      user: {
        id: 'dev-user',
        username: 'dev_player',
        displayName: 'Dev Player',
        avatarUrl: null,
        ...options.mockUser,
      },
      game: {
        slug: options.gameSlug ?? 'dev-game',
        name: options.gameName ?? 'Dev Game',
      },
      avatar: {
        presetId: 'dev-preset',
        presetKey: options.mockAvatar?.presetKey ?? 'default-1',
        presetKind: options.mockAvatar?.presetKind ?? 'procedural',
        customConfig: options.mockAvatar?.customConfig ?? { bodyColor: '#6366f1' },
      },
      lobby: {
        wsUrl: 'http://localhost:3001/lobby',
        roomId: `game:${options.gameSlug ?? 'dev-game'}`,
      },
    };
  }
}
