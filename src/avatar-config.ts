import type { SdkLobbyAvatar } from './platform-types';

/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export function resolveGlbUrl(avatar: SdkLobbyAvatar): string | null {
  if (avatar.presetKind !== 'glb') return null;
  const config = (avatar.customConfig ?? {}) as Record<string, unknown>;
  const url = config.glbUrl;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
