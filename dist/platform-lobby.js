import { MeshBuilder, SceneLoader, Vector3 as BVector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { AvatarFactory } from './avatar-factory';
import { LocalPlayerController } from './local-player-controller';
import { NetworkClient } from './network-client';
import { PlatformBridge } from './platform-bridge';
import { RemotePlayerManager } from './remote-player-manager';
import { SceneManager } from './scene-manager';
import { PortalManager, ZoneManager } from './zones';
import { applyStarterLayout as applyStarterLayoutFn } from './starter-layout';
import { applyPlazaLayout as applyPlazaLayoutFn } from './plaza-layout';
import { attachLobbyDebug, buildLobbyDebugReport } from './lobby-debug';
export class PlatformLobby {
    canvas;
    init;
    config;
    roomId;
    wsUrl;
    sceneManager;
    localAvatar;
    localController;
    remotePlayers;
    network = null;
    zoneManager = new ZoneManager();
    portalManager = new PortalManager();
    plugins = [];
    overlayHandlers = new Map();
    listeners = new Map();
    lastNetworkSend = 0;
    destroyed = false;
    ready = false;
    resizeHandler = () => this.sceneManager?.resize();
    constructor(init, canvas, roomId, wsUrl, config = {}) {
        this.canvas = canvas;
        this.init = init;
        this.roomId = roomId;
        this.wsUrl = wsUrl;
        this.config = {
            enableMultiplayer: true,
            ...config,
        };
    }
    static async create(options) {
        const init = PlatformBridge.fromInit(options.platformInit);
        const roomId = options.roomId ?? init.lobby?.roomId ?? `game:${init.game.slug}`;
        const wsUrl = options.wsUrl ?? init.lobby?.wsUrl ?? 'http://localhost:3001/lobby';
        const lobby = new PlatformLobby(init, options.canvas, roomId, wsUrl, options.config ?? {});
        await lobby.bootstrap();
        return lobby;
    }
    static async createFromPlatform(canvas, config) {
        const init = await PlatformBridge.waitForInit();
        return PlatformLobby.create({
            canvas,
            roomId: init.lobby?.roomId ?? `game:${init.game.slug}`,
            platformInit: init,
            config,
            wsUrl: init.lobby?.wsUrl,
        });
    }
    static async createDev(options) {
        const init = PlatformBridge.createDevInit({
            mockUser: options.mockUser,
            mockAvatar: options.mockAvatar,
            gameSlug: options.roomId?.replace(/^game:/, '') ?? 'dev-game',
        });
        return PlatformLobby.create({
            canvas: options.canvas,
            roomId: options.roomId ?? init.lobby.roomId,
            platformInit: init,
            config: { enableMultiplayer: false, ...options.config },
            wsUrl: options.wsUrl ?? init.lobby?.wsUrl,
        });
    }
    async bootstrap() {
        this.sceneManager = new SceneManager(this.canvas, this.config);
        const spawn = this.config.spawnPoint ??
            this.config.spawnPoints?.[0] ?? { x: 0, y: 0, z: 0 };
        this.localAvatar = AvatarFactory.create(this.sceneManager.scene, this.init.avatar, 'local-player', this.init.user.displayName);
        this.localController = new LocalPlayerController(this.localAvatar, spawn, this.config);
        this.remotePlayers = new RemotePlayerManager(this.sceneManager.scene, this.init.user.id);
        window.addEventListener('resize', this.resizeHandler);
        if (this.config.enableMultiplayer !== false && this.init.session.token !== 'dev-token') {
            this.connectNetwork();
        }
        let lastTime = performance.now();
        this.sceneManager.startRenderLoop(() => {
            const now = performance.now();
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;
            const state = this.localController.update(dt);
            this.sceneManager.followPlayer(this.localAvatar.position, state.rotationY);
            this.zoneManager.updatePlayer(this.init.user.id, state.position);
            const portalHits = this.portalManager.updatePlayer(this.init.user.id, state.position);
            for (const hit of portalHits) {
                hit.onTrigger?.();
                this.emit('portalTrigger', {
                    portalId: hit.portalId,
                    toGameSlug: hit.toGameSlug,
                    toScene: hit.toScene,
                });
                if (hit.toGameSlug && typeof window !== 'undefined') {
                    const origin = window.location.origin;
                    window.top?.location.assign(`${origin}/play/${hit.toGameSlug}`);
                }
            }
            if (this.network?.isConnected() && now - this.lastNetworkSend > 50) {
                this.lastNetworkSend = now;
                this.network.sendMove({
                    position: state.position,
                    rotationY: state.rotationY,
                    animation: state.animation,
                });
            }
            this.remotePlayers.update(dt);
        });
        this.emit('ready', undefined);
        this.ready = true;
        for (const plugin of this.plugins) {
            void plugin.setup(this);
        }
    }
    connectNetwork() {
        this.network = new NetworkClient(this.wsUrl, this.roomId, this.init.session.token, {
            onWelcome: (_self, players) => {
                for (const p of players)
                    this.remotePlayers.upsert(p);
                this.emit('connected', undefined);
            },
            onPlayerJoined: (player) => {
                this.remotePlayers.upsert(player);
                this.emit('playerJoined', { userId: player.userId, displayName: player.displayName });
            },
            onPlayerLeft: (userId) => {
                this.remotePlayers.remove(userId);
                this.emit('playerLeft', { userId });
            },
            onPlayerMoved: (payload) => {
                this.remotePlayers.applyMove(payload);
            },
            onPlayerEmote: (userId, emote) => {
                this.remotePlayers.applyEmote(userId, emote);
            },
            onError: (code, message) => {
                this.emit('error', { code, message });
            },
            onDisconnected: () => {
                this.emit('disconnected', undefined);
            },
        });
        this.network.connect();
    }
    on(event, handler) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(handler);
        if (event === 'ready' && this.ready) {
            handler(undefined);
        }
        return () => this.off(event, handler);
    }
    off(event, handler) {
        this.listeners.get(event)?.delete(handler);
    }
    emit(event, payload) {
        for (const handler of this.listeners.get(event) ?? []) {
            handler(payload);
        }
    }
    use(plugin) {
        this.plugins.push(plugin);
        if (this.ready)
            void plugin.setup(this);
        return this;
    }
    applyStarterLayout(config) {
        applyStarterLayoutFn(this, config);
        return this;
    }
    applyPlazaLayout(config) {
        applyPlazaLayoutFn(this, config);
        return this;
    }
    attachDebug(win) {
        return attachLobbyDebug(this, win ?? window);
    }
    getDebugReport() {
        return buildLobbyDebugReport(this);
    }
    addZone(options) {
        this.zoneManager.addZone({
            id: options.id,
            bounds: options.bounds,
            onEnter: (playerId) => {
                options.onEnter?.(playerId);
                this.emit('zoneEnter', { zoneId: options.id, playerId });
            },
            onExit: (playerId) => {
                options.onExit?.(playerId);
                this.emit('zoneExit', { zoneId: options.id, playerId });
            },
        });
    }
    addPortal(options) {
        this.portalManager.addPortal(options);
    }
    async loadGLB(url, name) {
        const result = await SceneLoader.ImportMeshAsync('', url, undefined, this.sceneManager.scene);
        const root = result.meshes[0];
        if (name)
            root.name = name;
        return root;
    }
    onOverlay(id, handler) {
        this.overlayHandlers.set(id, handler);
    }
    emitOverlay(id, payload) {
        this.overlayHandlers.get(id)?.(payload);
    }
    playEmote(emote) {
        this.network?.sendEmote(emote);
    }
    getInitPayload() {
        return this.init;
    }
    getScene() {
        return this.sceneManager.scene;
    }
    getEngine() {
        return this.sceneManager.engine;
    }
    addMeshAt(position, size = 1) {
        const box = MeshBuilder.CreateBox('custom-mesh', { size }, this.sceneManager.scene);
        box.position = new BVector3(position.x, position.y + size / 2, position.z);
        return box;
    }
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        window.removeEventListener('resize', this.resizeHandler);
        this.network?.disconnect();
        this.localController.dispose();
        this.remotePlayers.dispose();
        this.sceneManager.dispose();
        this.zoneManager.clear();
        this.portalManager.clear();
        this.emit('destroyed', undefined);
    }
}
//# sourceMappingURL=platform-lobby.js.map