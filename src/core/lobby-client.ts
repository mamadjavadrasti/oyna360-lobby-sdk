import { NetworkClient, type NetworkClientHandlers } from './network-client.js';
import { LobbyEmitter } from './events.js';
import { createRoomState, removePlayer, upsertPlayer, type RoomState } from './room-state.js';
import type { PlayerState } from './player-state.js';
import type { SdkInitPayload } from './platform-types.js';
import { LobbyAvatarController } from './avatar-state.js';
import type {
  LobbyAnimationState,
  LobbyEmoteKind,
  LobbyFeatureFlags,
  LobbyPlayerState,
  LobbyVoiceMode,
  LobbyVoicePeerState,
  RtcIceCandidate,
  RtcSessionDescription,
  Vector3,
} from './protocol.js';

export type LobbyWelcomeMeta = {
  roomId?: string;
  friendUserIds?: string[];
  voicePeers?: LobbyVoicePeerState[];
  lobbyFeatures?: LobbyFeatureFlags;
};

export type LobbyClientEvents = {
  /** Socket connected (before or around welcome). */
  connected: void;
  disconnected: void;
  reconnecting: { attempt: number };
  reconnectFailed: void;
  /** Room snapshot after server welcome — LobbyClient room state is ready. */
  welcome: { roomId: string; self: PlayerState; players: PlayerState[]; meta?: LobbyWelcomeMeta };
  'player:join': PlayerState;
  'player:update': PlayerState;
  'player:leave': { userId: string; displayName?: string; username?: string };
  'player:emote': { userId: string; emote: LobbyEmoteKind };
  /** Remote player avatar appearance after server-validated lobby:avatar:update. */
  'player:avatar': {
    userId: string;
    avatar: LobbyPlayerState['avatar'];
    player: PlayerState;
    emote?: LobbyEmoteKind | null;
  };
  chat: { userId: string; username?: string; displayName: string; text: string; at: number };
  data: {
    userId: string;
    username?: string;
    displayName?: string;
    channel: string;
    payload: string;
    at: number;
  };
  'voice:state': { peers: LobbyVoicePeerState[]; friendUserIds: string[] };
  'voice:joined': LobbyVoicePeerState;
  'voice:left': { userId: string };
  'voice:mute': { userId: string; muted: boolean };
  'voice:offer': { fromUserId: string; sdp: RtcSessionDescription };
  'voice:answer': { fromUserId: string; sdp: RtcSessionDescription };
  'voice:ice': { fromUserId: string; candidate: RtcIceCandidate };
  error: { message: string; code?: string };
};

export type LobbyNetworkLike = {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  sendMove(payload: {
    position: Vector3;
    rotationY: number;
    animation: LobbyAnimationState;
  }): void;
  sendEmote(emote: LobbyEmoteKind): void;
  sendAvatarUpdate(payload: {
    avatar: LobbyPlayerState['avatar'];
    emote?: LobbyEmoteKind | null;
  }): void;
  sendChat(text: string): void;
  sendData(channel: string, payload: string): void;
  sendVoiceJoin(mode: LobbyVoiceMode): void;
  sendVoiceLeave(): void;
  sendVoiceMute(muted: boolean): void;
  sendVoiceOffer(toUserId: string, sdp: RtcSessionDescription): void;
  sendVoiceAnswer(toUserId: string, sdp: RtcSessionDescription): void;
  sendVoiceIce(toUserId: string, candidate: RtcIceCandidate): void;
};

export interface LobbyClientConnectOptions {
  platformInit: SdkInitPayload;
  /** Override payload lobby.wsUrl */
  wsUrl?: string;
  /** Override payload lobby.roomId */
  roomId?: string;
  strictRoom?: boolean;
  /**
   * Test / advanced seam. Default constructs NetworkClient.
   * Must call handlers the same way NetworkClient does.
   */
  createNetwork?: (
    wsUrl: string,
    roomId: string,
    sessionToken: string,
    handlers: NetworkClientHandlers,
    connectOptions: { strictRoom?: boolean },
  ) => LobbyNetworkLike;
  /**
   * Optional shared avatar controller (e.g. from PlatformLobby).
   * Default: created from platformInit.avatar.
   */
  avatar?: LobbyAvatarController;
}

/**
 * Core lobby session: WebSocket + room/player state. No Babylon.
 */
export class LobbyClient {
  readonly events = new LobbyEmitter<LobbyClientEvents>();
  /** Local avatar customization — changes sync via lobby:avatar:update when connected. */
  readonly avatar: LobbyAvatarController;
  private network: LobbyNetworkLike | null = null;
  private room: RoomState | null = null;
  private destroyed = false;
  private init: SdkInitPayload | null = null;
  private selfUserId: string | null = null;
  private unsubAvatarChange: (() => void) | null = null;
  private avatarSyncTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(avatar: LobbyAvatarController) {
    this.avatar = avatar;
    this.unsubAvatarChange = this.avatar.on('change', () => {
      this.scheduleAvatarSync();
    });
  }

  static create(options: LobbyClientConnectOptions): LobbyClient {
    const avatar = options.avatar ?? LobbyAvatarController.fromSdk(options.platformInit.avatar);
    const client = new LobbyClient(avatar);
    client.prepare(options);
    return client;
  }

  /**
   * Create + open socket immediately.
   * Prefer `create()` → `on(...)` → `connect()` if you must not miss `welcome`.
   */
  static async connect(options: LobbyClientConnectOptions): Promise<LobbyClient> {
    const client = LobbyClient.create(options);
    client.connect();
    return client;
  }

  get roomId(): string | null {
    return this.room?.roomId ?? null;
  }

  get self(): PlayerState | null {
    return this.room?.self ?? null;
  }

  /** All players in the room map (includes self after welcome). */
  getPlayers(): PlayerState[] {
    if (!this.room) return [];
    return [...this.room.players.values()];
  }

  /** Remotes only (excludes self) — matches PlatformLobby.getPlayers semantics. */
  getRemotePlayers(): PlayerState[] {
    if (!this.room || !this.selfUserId) return this.getPlayers();
    return this.getPlayers().filter((p) => p.userId !== this.selfUserId);
  }

  getPlayer(userId: string): PlayerState | null {
    return this.room?.players.get(userId) ?? null;
  }

  getInitPayload(): SdkInitPayload | null {
    return this.init;
  }

  isConnected(): boolean {
    return Boolean(this.network?.isConnected());
  }

  on<K extends keyof LobbyClientEvents>(event: K, handler: (payload: LobbyClientEvents[K]) => void) {
    return this.events.on(event, handler);
  }

  /** Open the WebSocket. Call after registering event handlers. */
  connect() {
    if (this.destroyed) throw new Error('LobbyClient is destroyed');
    if (!this.network) throw new Error('LobbyClient.create() must be called first');
    this.network.connect();
  }

  sendMove(input: {
    position: Vector3;
    rotationY: number;
    animation: LobbyAnimationState;
  }) {
    this.network?.sendMove(input);
    if (!this.room?.self || !this.selfUserId) return;
    const next: PlayerState = {
      ...this.room.self,
      position: { ...input.position },
      rotationY: input.rotationY,
      animation: input.animation,
      updatedAt: Date.now(),
    };
    this.room.self = next;
    upsertPlayer(this.room, next);
  }

  sendEmote(emote: LobbyEmoteKind) {
    this.network?.sendEmote(emote);
  }

  sendAvatarUpdate(payload?: {
    avatar?: LobbyPlayerState['avatar'];
    emote?: LobbyEmoteKind | null;
  }) {
    if (!this.network?.isConnected()) return;
    const state = this.avatar.getState();
    const emote =
      payload?.emote !== undefined
        ? payload.emote
        : typeof state.emote === 'string'
          ? (state.emote as LobbyEmoteKind)
          : state.emote ?? undefined;
    this.network.sendAvatarUpdate({
      avatar: payload?.avatar ?? this.avatar.toSdk(),
      ...(emote !== undefined ? { emote } : {}),
    });
  }

  sendChat(text: string) {
    this.network?.sendChat(text);
  }

  sendData(channel: string, payload: string) {
    this.network?.sendData(channel, payload);
  }

  sendVoiceJoin(mode: LobbyVoiceMode) {
    this.network?.sendVoiceJoin(mode);
  }

  sendVoiceLeave() {
    this.network?.sendVoiceLeave();
  }

  sendVoiceMute(muted: boolean) {
    this.network?.sendVoiceMute(muted);
  }

  sendVoiceOffer(toUserId: string, sdp: RtcSessionDescription) {
    this.network?.sendVoiceOffer(toUserId, sdp);
  }

  sendVoiceAnswer(toUserId: string, sdp: RtcSessionDescription) {
    this.network?.sendVoiceAnswer(toUserId, sdp);
  }

  sendVoiceIce(toUserId: string, candidate: RtcIceCandidate) {
    this.network?.sendVoiceIce(toUserId, candidate);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.avatarSyncTimer) {
      clearTimeout(this.avatarSyncTimer);
      this.avatarSyncTimer = null;
    }
    this.unsubAvatarChange?.();
    this.unsubAvatarChange = null;
    this.network?.disconnect();
    this.network = null;
    this.room = null;
    this.events.clear();
  }

  private scheduleAvatarSync() {
    if (this.destroyed || !this.network?.isConnected()) return;
    if (this.avatarSyncTimer) clearTimeout(this.avatarSyncTimer);
    this.avatarSyncTimer = setTimeout(() => {
      this.avatarSyncTimer = null;
      this.sendAvatarUpdate();
    }, 75);
  }

  private prepare(options: LobbyClientConnectOptions) {
    const init = options.platformInit;
    this.init = init;
    this.selfUserId = init.user.id;
    const wsUrl = options.wsUrl ?? init.lobby?.wsUrl;
    const roomId = options.roomId ?? init.lobby?.roomId;
    if (!wsUrl || !roomId) {
      throw new Error('LobbyClient requires lobby.wsUrl and lobby.roomId (or overrides)');
    }
    if (!init.session?.token) {
      throw new Error('LobbyClient requires platformInit.session.token');
    }

    this.room = createRoomState(roomId);
    const strictRoom = options.strictRoom ?? init.lobby?.strictRoom ?? false;
    const createNetwork =
      options.createNetwork ??
      ((url, rid, token, handlers, connectOptions) =>
        new NetworkClient(url, rid, token, handlers, connectOptions));

    const handlers: NetworkClientHandlers = {
      onConnected: () => this.events.emit('connected', undefined as void),
      onDisconnected: () => this.events.emit('disconnected', undefined as void),
      onReconnecting: (attempt) => this.events.emit('reconnecting', { attempt }),
      onReconnectFailed: () => this.events.emit('reconnectFailed', undefined as void),
      onWelcome: (self, players, meta) => {
        if (!this.room) return;
        if (meta?.roomId) this.room.roomId = meta.roomId;
        this.room.self = self;
        this.room.players.clear();
        upsertPlayer(this.room, self);
        for (const p of players) upsertPlayer(this.room, p);
        this.events.emit('welcome', {
          roomId: this.room.roomId,
          self,
          players: this.getRemotePlayers(),
          meta,
        });
      },
      onPlayerJoined: (player) => {
        if (!this.room) return;
        upsertPlayer(this.room, player);
        this.events.emit('player:join', player);
      },
      onPlayerLeft: (payload) => {
        if (!this.room) return;
        removePlayer(this.room, payload.userId);
        this.events.emit('player:leave', payload);
      },
      onPlayerMoved: (payload) => {
        this.applyMove(payload);
      },
      onPlayersMoved: (moves) => {
        for (const m of moves) {
          if (this.selfUserId && m.userId === this.selfUserId) continue;
          this.applyMove(m);
        }
      },
      onPlayerEmote: (userId, emote) => {
        this.events.emit('player:emote', { userId, emote });
      },
      onPlayerAvatar: (payload) => {
        if (!this.room) return;
        const existing = this.room.players.get(payload.userId);
        if (!existing) return;
        const next: PlayerState = {
          ...existing,
          avatar: payload.avatar,
          emote: payload.emote !== undefined ? payload.emote : existing.emote,
          updatedAt: Date.now(),
        };
        if (this.room.self?.userId === next.userId) this.room.self = next;
        upsertPlayer(this.room, next);
        this.events.emit('player:avatar', {
          userId: payload.userId,
          avatar: payload.avatar,
          player: next,
          emote: payload.emote,
        });
      },
      onChat: (msg) => this.events.emit('chat', msg),
      onData: (msg) => this.events.emit('data', msg),
      onVoiceState: (peers, friendUserIds) =>
        this.events.emit('voice:state', { peers, friendUserIds }),
      onVoiceJoined: (peer) => this.events.emit('voice:joined', peer),
      onVoiceLeft: (userId) => this.events.emit('voice:left', { userId }),
      onVoiceMute: (userId, muted) => this.events.emit('voice:mute', { userId, muted }),
      onVoiceOffer: (fromUserId, sdp) => this.events.emit('voice:offer', { fromUserId, sdp }),
      onVoiceAnswer: (fromUserId, sdp) => this.events.emit('voice:answer', { fromUserId, sdp }),
      onVoiceIce: (fromUserId, candidate) =>
        this.events.emit('voice:ice', { fromUserId, candidate }),
      onError: (code, message) => this.events.emit('error', { message, code }),
    };

    this.network = createNetwork(wsUrl, roomId, init.session.token, handlers, { strictRoom });
  }

  private applyMove(payload: {
    userId: string;
    position?: LobbyPlayerState['position'];
    rotationY?: number;
    animation?: LobbyPlayerState['animation'];
  }) {
    if (!this.room) return;
    if (!this.room.players.has(payload.userId)) return;
    const existing = this.room.players.get(payload.userId);
    if (!existing) return;
    const next: PlayerState = {
      ...existing,
      position: payload.position ? { ...payload.position } : existing.position,
      rotationY: payload.rotationY ?? existing.rotationY,
      animation: payload.animation ?? existing.animation,
      updatedAt: Date.now(),
    };
    upsertPlayer(this.room, next);
    if (this.room.self?.userId === next.userId) this.room.self = next;
    this.events.emit('player:update', next);
  }
}
