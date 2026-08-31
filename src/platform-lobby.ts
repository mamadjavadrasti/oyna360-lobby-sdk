import { MeshBuilder, SceneLoader, Vector3 as BVector3 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { SdkInitPayload } from './platform-types';
import { sanitizeLobbyChat, type LobbyEmoteKind } from './protocol';
import { AvatarFactory } from './avatar-factory';
import { LocalPlayerController } from './local-player-controller';
import { NetworkClient } from './network-client';
import { PlatformBridge } from './platform-bridge';
import { RemotePlayerManager } from './remote-player-manager';
import { SceneManager } from './scene-manager';
import type { LobbyPlugin } from './types';
import { PortalManager, ZoneManager } from './zones';
import { applyStarterLayout as applyStarterLayoutFn, type StarterLayoutConfig } from './starter-layout';
import { applyPlazaLayout as applyPlazaLayoutFn, type PlazaLayoutConfig } from './plaza-layout';
import { applyLobbyCollisions } from './lobby-colliders';
import { attachLobbyDebug, buildLobbyDebugReport } from './lobby-debug';
import { attachPlayground, type PlaygroundSystem } from './playground/playground-system';
import { LobbyMusic } from './lobby-music';
import { attachLobbyChatUi } from './lobby-chat-ui';
import { ensureLobbyPersianFont } from './lobby-font';
import type {
  LobbyEventMap,
  LobbyEventName,
  LobbyPortalOptions,
  LobbyZoneOptions,
  PlatformLobbyConfig,
  PlatformLobbyCreateOptions,
  PlatformLobbyDevOptions,
  Vector3,
} from './types';

export class PlatformLobby {
  private readonly init: SdkInitPayload;
  private readonly config: PlatformLobbyConfig;
  private readonly roomId: string;
  private readonly wsUrl: string;
  private sceneManager!: SceneManager;
  private localAvatar!: ReturnType<typeof AvatarFactory.create>;
  private localController!: LocalPlayerController;
  private remotePlayers!: RemotePlayerManager;
  private network: NetworkClient | null = null;
  private zoneManager = new ZoneManager();
  private portalManager = new PortalManager();
  private plugins: LobbyPlugin[] = [];
  private overlayHandlers = new Map<string, (payload: unknown) => void>();
  private listeners = new Map<LobbyEventName, Set<(payload: unknown) => void>>();
  private lastNetworkSend = 0;
  private destroyed = false;
  private ready = false;
  private playground: PlaygroundSystem | null = null;
  private music = new LobbyMusic();
  private chatDispose: (() => void) | null = null;
  private resizeHandler = () => this.sceneManager?.resize();

  private constructor(
    init: SdkInitPayload,
    private readonly canvas: HTMLCanvasElement,
    roomId: string,
    wsUrl: string,
    config: PlatformLobbyConfig = {},
  ) {
    this.init = init;
    this.roomId = roomId;
    this.wsUrl = wsUrl;
    this.config = {
      enableMultiplayer: true,
      ...config,
    };
  }

  static async create(options: PlatformLobbyCreateOptions): Promise<PlatformLobby> {
    const init = PlatformBridge.fromInit(options.platformInit);
    const roomId = options.roomId ?? init.lobby?.roomId ?? `game:${init.game.slug}`;
    const wsUrl = options.wsUrl ?? init.lobby?.wsUrl ?? 'http://localhost:3001/lobby';
    const lobby = new PlatformLobby(init, options.canvas, roomId, wsUrl, options.config ?? {});
    await lobby.bootstrap();
    return lobby;
  }

  static async createFromPlatform(canvas: HTMLCanvasElement, config?: PlatformLobbyConfig) {
    const init = await PlatformBridge.waitForInit();
    return PlatformLobby.create({
      canvas,
      roomId: init.lobby?.roomId ?? `game:${init.game.slug}`,
      platformInit: init,
      config,
      wsUrl: init.lobby?.wsUrl,
    });
  }

  static async createDev(options: PlatformLobbyDevOptions): Promise<PlatformLobby> {
    const init = PlatformBridge.createDevInit({
      mockUser: options.mockUser,
      mockAvatar: options.mockAvatar,
      gameSlug: options.roomId?.replace(/^game:/, '') ?? 'dev-game',
    });
    return PlatformLobby.create({
      canvas: options.canvas,
      roomId: options.roomId ?? init.lobby!.roomId,
      platformInit: init,
      config: { enableMultiplayer: false, ...options.config },
      wsUrl: options.wsUrl ?? init.lobby?.wsUrl,
    });
  }

  private async bootstrap() {
    await ensureLobbyPersianFont();
    this.sceneManager = new SceneManager(this.canvas, this.config);

    const spawn = this.config.spawnPoint ??
      this.config.spawnPoints?.[0] ?? { x: 0, y: 0, z: 0 };

    this.localAvatar = AvatarFactory.create(
      this.sceneManager.scene,
      this.init.avatar,
      'local-player',
      this.init.user.displayName,
      { collider: true },
    );
    this.localController = new LocalPlayerController(
      this.localAvatar,
      spawn,
      this.sceneManager.scene,
      () => this.sceneManager.camera,
      this.config,
    );
    this.localController.setSounds(this.music);
    this.canvas.addEventListener('pointerdown', () => {
      void this.music.unlock(true);
    });
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
      this.playground?.update(dt, this.localController, state.position);
      this.sceneManager.followPlayer(
        this.localAvatar.position,
        dt,
        this.localController.getIgnoreMeshes(),
      );
      this.zoneManager.updatePlayer(this.init.user.id, state.position);

      const portalHits = this.portalManager.updatePlayer(this.init.user.id, state.position);
      for (const hit of portalHits) {
        hit.onTrigger?.();
        this.emit('portalTrigger', {
          portalId: hit.portalId,
          toGameSlug: hit.toGameSlug,
          toScene: hit.toScene,
        });
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
    if (this.config.enableChat !== false) this.attachChat();

    for (const plugin of this.plugins) {
      void plugin.setup(this);
    }
  }

  private connectNetwork() {
    this.network = new NetworkClient(
      this.wsUrl,
      this.roomId,
      this.init.session.token,
      {
        onWelcome: (_self, players) => {
          for (const p of players) this.remotePlayers.upsert(p);
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
        onChat: (payload) => {
          if (payload.userId === this.init.user.id) return;
          this.emit('chat', payload);
        },
        onError: (code, message) => {
          this.emit('error', { code, message });
        },
        onDisconnected: () => {
          this.emit('disconnected', undefined);
        },
      },
    );
    this.network.connect();
  }

  on<E extends LobbyEventName>(event: E, handler: (payload: LobbyEventMap[E]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as (payload: unknown) => void);
    if (event === 'ready' && this.ready) {
      handler(undefined as LobbyEventMap[E]);
    }
    return () => this.off(event, handler);
  }

  off<E extends LobbyEventName>(event: E, handler: (payload: LobbyEventMap[E]) => void) {
    this.listeners.get(event)?.delete(handler as (payload: unknown) => void);
  }

  private emit<E extends LobbyEventName>(event: E, payload: LobbyEventMap[E]) {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  use(plugin: LobbyPlugin) {
    this.plugins.push(plugin);
    if (this.ready) void plugin.setup(this);
    return this;
  }

  /** Optional starter-plaza template. Appearance and start routing stay in the game. */
  applyPlazaLayout(config?: PlazaLayoutConfig) {
    applyPlazaLayoutFn(this, config);
    applyLobbyCollisions(this.sceneManager.scene);
    if (!this.playground) this.playground = attachPlayground(this);
    return this;
  }

  applyStarterLayout(config?: StarterLayoutConfig) {
    applyStarterLayoutFn(this, config);
    applyLobbyCollisions(this.sceneManager.scene);
    return this;
  }

  attachDebug(win?: Window) {
    return attachLobbyDebug(this, win ?? window);
  }

  getDebugReport() {
    return buildLobbyDebugReport(this);
  }

  addZone(options: LobbyZoneOptions) {
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

  /**
   * Game-owned portal. The SDK only detects the player and fires `onTrigger` / `portalTrigger`.
   * It never navigates the browser — the game starts its own gameplay.
   */
  addPortal(options: LobbyPortalOptions) {
    this.portalManager.addPortal(options);
  }

  /** Platform identity: user, avatar, session, room. */
  getSession() {
    return this.init.session;
  }

  getUser() {
    return this.init.user;
  }

  getAvatar() {
    return this.init.avatar;
  }

  /** Other players currently synced in this lobby room. */
  getPlayers() {
    return this.remotePlayers.list();
  }

  async loadGLB(url: string, name?: string) {
    const result = await SceneLoader.ImportMeshAsync('', url, undefined, this.sceneManager.scene);
    const root = result.meshes[0];
    if (name) root.name = name;
    return root;
  }

  onOverlay(id: string, handler: (payload: unknown) => void) {
    this.overlayHandlers.set(id, handler);
  }

  emitOverlay(id: string, payload: unknown) {
    this.overlayHandlers.get(id)?.(payload);
  }

  playEmote(emote: LobbyEmoteKind) {
    this.network?.sendEmote(emote);
  }

  /** Live lobby chat. Not saved. Always echoes locally so the sender sees the line. */
  sendChat(text: string) {
    const clean = sanitizeLobbyChat(text);
    if (!clean) return false;
    this.emit('chat', {
      userId: this.init.user.id,
      displayName: this.init.user.displayName,
      text: clean,
      at: Date.now(),
    });
    this.network?.sendChat(clean);
    return true;
  }

  attachChat() {
    if (this.chatDispose) return this;
    this.chatDispose = attachLobbyChatUi(this, this.canvas);
    return this;
  }

  /** Virtual joystick / on-screen pad. x = strafe, z = forward (-1..1). */
  setMoveStick(x: number, z: number) {
    this.localController.setStick(x, z);
  }

  setLookStick(x: number, y: number) {
    this.sceneManager.thirdPerson.setLookStick(x, y);
  }

  addLookDelta(dx: number, dy: number) {
    this.sceneManager.thirdPerson.addLookDelta(dx, dy);
  }

  tryPlaygroundInteract() {
    return this.playground?.trySlide() ?? false;
  }

  getLocalController() {
    return this.localController;
  }

  noteMusicToggle() {
    this.music.noteUserToggled();
  }

  toggleMusic() {
    return this.music.toggleMuted();
  }

  setMusicMuted(muted: boolean) {
    this.music.setMuted(muted);
  }

  isMusicMuted() {
    return this.music.isMuted();
  }

  jump() {
    this.localController.jump();
  }

  setJumpHeld(on: boolean) {
    this.localController.setJumpHeld(on);
  }

  setSprint(on: boolean) {
    this.localController.setSprint(on);
  }

  /** Ask the hub to close this lobby iframe and return home. Never navigates itself. */
  requestExit() {
    if (typeof window === 'undefined' || window.parent === window) return;
    const token = this.init.session?.token;
    if (token) {
      window.parent.postMessage({ type: 'platform:session:end', sessionToken: token }, '*');
    }
    window.parent.postMessage({ type: 'platform:lobby:exit' }, '*');
  }

  getInitPayload() {
    return this.init;
  }

  getLocalPose() {
    return this.localController.getState();
  }

  getScene() {
    return this.sceneManager.scene;
  }

  getEngine() {
    return this.sceneManager.engine;
  }

  addMeshAt(position: Vector3, size = 1) {
    const box = MeshBuilder.CreateBox('custom-mesh', { size }, this.sceneManager.scene);
    box.position = new BVector3(position.x, position.y + size / 2, position.z);
    return box;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('resize', this.resizeHandler);
    this.chatDispose?.();
    this.chatDispose = null;
    this.network?.disconnect();
    this.localController.dispose();
    this.music.dispose();
    this.playground?.dispose();
    this.remotePlayers.dispose();
    this.sceneManager.dispose();
    this.zoneManager.clear();
    this.portalManager.clear();
    this.emit('destroyed', undefined);
  }
}
