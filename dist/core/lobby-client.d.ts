import { type NetworkClientHandlers } from './network-client.js';
import { LobbyEmitter } from './events.js';
import type { PlayerState } from './player-state.js';
import type { SdkInitPayload } from './platform-types.js';
import { LobbyAvatarController } from './avatar-state.js';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyFeatureFlags, LobbyPlayerState, LobbyVoiceMode, LobbyVoicePeerState, RtcIceCandidate, RtcSessionDescription, Vector3 } from './protocol.js';
export type LobbyWelcomeMeta = {
    friendUserIds?: string[];
    voicePeers?: LobbyVoicePeerState[];
    lobbyFeatures?: LobbyFeatureFlags;
};
export type LobbyClientEvents = {
    /** Socket connected (before or around welcome). */
    connected: void;
    disconnected: void;
    reconnecting: {
        attempt: number;
    };
    reconnectFailed: void;
    /** Room snapshot after server welcome — LobbyClient room state is ready. */
    welcome: {
        roomId: string;
        self: PlayerState;
        players: PlayerState[];
        meta?: LobbyWelcomeMeta;
    };
    'player:join': PlayerState;
    'player:update': PlayerState;
    'player:leave': {
        userId: string;
        displayName?: string;
        username?: string;
    };
    'player:emote': {
        userId: string;
        emote: LobbyEmoteKind;
    };
    /** Remote player avatar appearance after server-validated lobby:avatar:update. */
    'player:avatar': {
        userId: string;
        avatar: LobbyPlayerState['avatar'];
        player: PlayerState;
        emote?: LobbyEmoteKind | null;
    };
    chat: {
        userId: string;
        username?: string;
        displayName: string;
        text: string;
        at: number;
    };
    data: {
        userId: string;
        username?: string;
        displayName?: string;
        channel: string;
        payload: string;
        at: number;
    };
    'voice:state': {
        peers: LobbyVoicePeerState[];
        friendUserIds: string[];
    };
    'voice:joined': LobbyVoicePeerState;
    'voice:left': {
        userId: string;
    };
    'voice:mute': {
        userId: string;
        muted: boolean;
    };
    'voice:offer': {
        fromUserId: string;
        sdp: RtcSessionDescription;
    };
    'voice:answer': {
        fromUserId: string;
        sdp: RtcSessionDescription;
    };
    'voice:ice': {
        fromUserId: string;
        candidate: RtcIceCandidate;
    };
    error: {
        message: string;
        code?: string;
    };
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
    createNetwork?: (wsUrl: string, roomId: string, sessionToken: string, handlers: NetworkClientHandlers, connectOptions: {
        strictRoom?: boolean;
    }) => LobbyNetworkLike;
    /**
     * Optional shared avatar controller (e.g. from PlatformLobby).
     * Default: created from platformInit.avatar.
     */
    avatar?: LobbyAvatarController;
}
/**
 * Core lobby session: WebSocket + room/player state. No Babylon.
 */
export declare class LobbyClient {
    readonly events: LobbyEmitter<LobbyClientEvents>;
    /** Local avatar customization — changes sync via lobby:avatar:update when connected. */
    readonly avatar: LobbyAvatarController;
    private network;
    private room;
    private destroyed;
    private init;
    private selfUserId;
    private unsubAvatarChange;
    private avatarSyncTimer;
    private constructor();
    static create(options: LobbyClientConnectOptions): LobbyClient;
    /**
     * Create + open socket immediately.
     * Prefer `create()` → `on(...)` → `connect()` if you must not miss `welcome`.
     */
    static connect(options: LobbyClientConnectOptions): Promise<LobbyClient>;
    get roomId(): string | null;
    get self(): PlayerState | null;
    /** All players in the room map (includes self after welcome). */
    getPlayers(): PlayerState[];
    /** Remotes only (excludes self) — matches PlatformLobby.getPlayers semantics. */
    getRemotePlayers(): PlayerState[];
    getPlayer(userId: string): PlayerState | null;
    getInitPayload(): SdkInitPayload | null;
    isConnected(): boolean;
    on<K extends keyof LobbyClientEvents>(event: K, handler: (payload: LobbyClientEvents[K]) => void): () => void;
    /** Open the WebSocket. Call after registering event handlers. */
    connect(): void;
    sendMove(input: {
        position: Vector3;
        rotationY: number;
        animation: LobbyAnimationState;
    }): void;
    sendEmote(emote: LobbyEmoteKind): void;
    sendAvatarUpdate(payload?: {
        avatar?: LobbyPlayerState['avatar'];
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
    destroy(): void;
    private scheduleAvatarSync;
    private prepare;
    private applyMove;
}
//# sourceMappingURL=lobby-client.d.ts.map