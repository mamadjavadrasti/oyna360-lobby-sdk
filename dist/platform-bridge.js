const INIT_TIMEOUT_MS = 15000;
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object')
            return;
        if (data.type === 'platform:init') {
            window.__OYNA360_PLATFORM_INIT__ = data;
        }
    });
}
export class PlatformBridge {
    static waitForInit(timeoutMs = INIT_TIMEOUT_MS) {
        return new Promise((resolve, reject) => {
            // Direct Development: game-sdk may have already published platform:init on this window.
            if (window.__OYNA360_PLATFORM_INIT__) {
                resolve(window.__OYNA360_PLATFORM_INIT__);
                return;
            }
            const inIframe = (() => {
                try {
                    return window.parent !== window;
                }
                catch {
                    return true;
                }
            })();
            const timer = setTimeout(() => {
                window.removeEventListener('message', onMessage);
                reject(new Error(inIframe
                    ? 'Timed out waiting for platform:init'
                    : 'Timed out waiting for platform:init — call PlatformSDK.init() first (Direct Development Mode)'));
            }, timeoutMs);
            const onMessage = (event) => {
                const data = event.data;
                if (!data || typeof data !== 'object')
                    return;
                if (data.type !== 'platform:init')
                    return;
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                resolve(data);
            };
            window.addEventListener('message', onMessage);
            if (inIframe) {
                window.parent.postMessage({ type: 'platform:lobby:ready' }, '*');
            }
        });
    }
    static fromInit(init) {
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
    static createDevInit(options) {
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
//# sourceMappingURL=platform-bridge.js.map