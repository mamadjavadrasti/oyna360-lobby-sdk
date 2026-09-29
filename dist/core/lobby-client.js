import { NetworkClient } from './network-client.js';
import { LobbyEmitter } from './events.js';
import { createRoomState, removePlayer, upsertPlayer } from './room-state.js';
import { LobbyAvatarController } from './avatar-state.js';
/**
 * Core lobby session: WebSocket + room/player state. No Babylon.
 */
export class LobbyClient {
    events = new LobbyEmitter();
    /** Local avatar customization — changes sync via lobby:avatar:update when connected. */
    avatar;
    network = null;
    room = null;
    destroyed = false;
    init = null;
    selfUserId = null;
    unsubAvatarChange = null;
    avatarSyncTimer = null;
    constructor(avatar) {
        this.avatar = avatar;
        this.unsubAvatarChange = this.avatar.on('change', () => {
            this.scheduleAvatarSync();
        });
    }
    static create(options) {
        const avatar = options.avatar ?? LobbyAvatarController.fromSdk(options.platformInit.avatar);
        const client = new LobbyClient(avatar);
        client.prepare(options);
        return client;
    }
    /**
     * Create + open socket immediately.
     * Prefer `create()` → `on(...)` → `connect()` if you must not miss `welcome`.
     */
    static async connect(options) {
        const client = LobbyClient.create(options);
        client.connect();
        return client;
    }
    get roomId() {
        return this.room?.roomId ?? null;
    }
    get self() {
        return this.room?.self ?? null;
    }
    /** All players in the room map (includes self after welcome). */
    getPlayers() {
        if (!this.room)
            return [];
        return [...this.room.players.values()];
    }
    /** Remotes only (excludes self) — matches PlatformLobby.getPlayers semantics. */
    getRemotePlayers() {
        if (!this.room || !this.selfUserId)
            return this.getPlayers();
        return this.getPlayers().filter((p) => p.userId !== this.selfUserId);
    }
    getPlayer(userId) {
        return this.room?.players.get(userId) ?? null;
    }
    getInitPayload() {
        return this.init;
    }
    isConnected() {
        return Boolean(this.network?.isConnected());
    }
    on(event, handler) {
        return this.events.on(event, handler);
    }
    /** Open the WebSocket. Call after registering event handlers. */
    connect() {
        if (this.destroyed)
            throw new Error('LobbyClient is destroyed');
        if (!this.network)
            throw new Error('LobbyClient.create() must be called first');
        this.network.connect();
    }
    sendMove(input) {
        this.network?.sendMove(input);
        if (!this.room?.self || !this.selfUserId)
            return;
        const next = {
            ...this.room.self,
            position: { ...input.position },
            rotationY: input.rotationY,
            animation: input.animation,
            updatedAt: Date.now(),
        };
        this.room.self = next;
        upsertPlayer(this.room, next);
    }
    sendEmote(emote) {
        this.network?.sendEmote(emote);
    }
    sendAvatarUpdate(payload) {
        if (!this.network?.isConnected())
            return;
        const state = this.avatar.getState();
        const emote = payload?.emote !== undefined
            ? payload.emote
            : typeof state.emote === 'string'
                ? state.emote
                : state.emote ?? undefined;
        this.network.sendAvatarUpdate({
            avatar: payload?.avatar ?? this.avatar.toSdk(),
            ...(emote !== undefined ? { emote } : {}),
        });
    }
    sendChat(text) {
        this.network?.sendChat(text);
    }
    sendData(channel, payload) {
        this.network?.sendData(channel, payload);
    }
    sendVoiceJoin(mode) {
        this.network?.sendVoiceJoin(mode);
    }
    sendVoiceLeave() {
        this.network?.sendVoiceLeave();
    }
    sendVoiceMute(muted) {
        this.network?.sendVoiceMute(muted);
    }
    sendVoiceOffer(toUserId, sdp) {
        this.network?.sendVoiceOffer(toUserId, sdp);
    }
    sendVoiceAnswer(toUserId, sdp) {
        this.network?.sendVoiceAnswer(toUserId, sdp);
    }
    sendVoiceIce(toUserId, candidate) {
        this.network?.sendVoiceIce(toUserId, candidate);
    }
    destroy() {
        if (this.destroyed)
            return;
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
    scheduleAvatarSync() {
        if (this.destroyed || !this.network?.isConnected())
            return;
        if (this.avatarSyncTimer)
            clearTimeout(this.avatarSyncTimer);
        this.avatarSyncTimer = setTimeout(() => {
            this.avatarSyncTimer = null;
            this.sendAvatarUpdate();
        }, 75);
    }
    prepare(options) {
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
        const createNetwork = options.createNetwork ??
            ((url, rid, token, handlers, connectOptions) => new NetworkClient(url, rid, token, handlers, connectOptions));
        const handlers = {
            onConnected: () => this.events.emit('connected', undefined),
            onDisconnected: () => this.events.emit('disconnected', undefined),
            onReconnecting: (attempt) => this.events.emit('reconnecting', { attempt }),
            onReconnectFailed: () => this.events.emit('reconnectFailed', undefined),
            onWelcome: (self, players, meta) => {
                if (!this.room)
                    return;
                this.room.self = self;
                this.room.players.clear();
                upsertPlayer(this.room, self);
                for (const p of players)
                    upsertPlayer(this.room, p);
                this.events.emit('welcome', {
                    roomId: this.room.roomId,
                    self,
                    players: this.getRemotePlayers(),
                    meta,
                });
            },
            onPlayerJoined: (player) => {
                if (!this.room)
                    return;
                upsertPlayer(this.room, player);
                this.events.emit('player:join', player);
            },
            onPlayerLeft: (payload) => {
                if (!this.room)
                    return;
                removePlayer(this.room, payload.userId);
                this.events.emit('player:leave', payload);
            },
            onPlayerMoved: (payload) => {
                this.applyMove(payload);
            },
            onPlayersMoved: (moves) => {
                for (const m of moves) {
                    if (this.selfUserId && m.userId === this.selfUserId)
                        continue;
                    this.applyMove(m);
                }
            },
            onPlayerEmote: (userId, emote) => {
                this.events.emit('player:emote', { userId, emote });
            },
            onPlayerAvatar: (payload) => {
                if (!this.room)
                    return;
                const existing = this.room.players.get(payload.userId);
                if (!existing)
                    return;
                const next = {
                    ...existing,
                    avatar: payload.avatar,
                    emote: payload.emote !== undefined ? payload.emote : existing.emote,
                    updatedAt: Date.now(),
                };
                if (this.room.self?.userId === next.userId)
                    this.room.self = next;
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
            onVoiceState: (peers, friendUserIds) => this.events.emit('voice:state', { peers, friendUserIds }),
            onVoiceJoined: (peer) => this.events.emit('voice:joined', peer),
            onVoiceLeft: (userId) => this.events.emit('voice:left', { userId }),
            onVoiceMute: (userId, muted) => this.events.emit('voice:mute', { userId, muted }),
            onVoiceOffer: (fromUserId, sdp) => this.events.emit('voice:offer', { fromUserId, sdp }),
            onVoiceAnswer: (fromUserId, sdp) => this.events.emit('voice:answer', { fromUserId, sdp }),
            onVoiceIce: (fromUserId, candidate) => this.events.emit('voice:ice', { fromUserId, candidate }),
            onError: (code, message) => this.events.emit('error', { message, code }),
        };
        this.network = createNetwork(wsUrl, roomId, init.session.token, handlers, { strictRoom });
    }
    applyMove(payload) {
        if (!this.room)
            return;
        if (!this.room.players.has(payload.userId))
            return;
        const existing = this.room.players.get(payload.userId);
        if (!existing)
            return;
        const next = {
            ...existing,
            position: payload.position ? { ...payload.position } : existing.position,
            rotationY: payload.rotationY ?? existing.rotationY,
            animation: payload.animation ?? existing.animation,
            updatedAt: Date.now(),
        };
        upsertPlayer(this.room, next);
        if (this.room.self?.userId === next.userId)
            this.room.self = next;
        this.events.emit('player:update', next);
    }
}
//# sourceMappingURL=lobby-client.js.map