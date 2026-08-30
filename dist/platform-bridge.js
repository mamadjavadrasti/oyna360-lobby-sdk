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
            if (window.parent === window) {
                reject(new Error('Not running inside platform iframe'));
                return;
            }
            if (window.__OYNA360_PLATFORM_INIT__) {
                resolve(window.__OYNA360_PLATFORM_INIT__);
                return;
            }
            const timer = setTimeout(() => {
                window.removeEventListener('message', onMessage);
                reject(new Error('Timed out waiting for platform:init'));
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
            window.parent.postMessage({ type: 'platform:lobby:ready' }, '*');
        });
    }
    static fromInit(init) {
        if ('type' in init && init.type === 'platform:init') {
            return {
                session: init.session,
                user: init.user,
                game: init.game,
                avatar: init.avatar,
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