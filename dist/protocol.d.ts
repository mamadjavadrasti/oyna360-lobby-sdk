/** Bundled lobby protocol — games do not install @platform/lobby-protocol. Keep in sync with packages/lobby-protocol. */
export declare const LOBBY_PROTOCOL_VERSION = "0.1.0";
export type AvatarPresetKind = 'procedural' | 'glb';
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export interface LobbyAvatarConfig {
    presetId: string;
    presetKey: string;
    presetKind: AvatarPresetKind;
    presetConfig: Record<string, unknown>;
    customConfig: Record<string, unknown>;
}
export interface SdkLobbyAvatar {
    presetId: string;
    presetKey: string;
    presetKind: AvatarPresetKind;
    customConfig: Record<string, unknown>;
}
export type LobbyAnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'fall';
export type LobbyEmoteKind = 'wave' | 'sit' | 'dance' | 'point';
export interface LobbyPlayerState {
    userId: string;
    username: string;
    displayName: string;
    avatar: SdkLobbyAvatar;
    position: Vector3;
    rotationY: number;
    animation: LobbyAnimationState;
    emote: LobbyEmoteKind | null;
    updatedAt: number;
}
export interface LobbyJoinMessage {
    type: 'lobby:join';
    roomId: string;
    sessionToken: string;
    position?: Vector3;
    rotationY?: number;
}
export interface LobbyMoveMessage {
    type: 'lobby:move';
    position: Vector3;
    rotationY: number;
    animation: LobbyAnimationState;
    seq: number;
}
export interface LobbyEmoteMessage {
    type: 'lobby:emote';
    emote: LobbyEmoteKind;
}
export interface LobbyLeaveMessage {
    type: 'lobby:leave';
}
export interface LobbyPingMessage {
    type: 'lobby:ping';
}
/** Ephemeral — never persisted. Only players currently in the room see it. */
export interface LobbyChatMessage {
    type: 'lobby:chat';
    text: string;
}
/**
 * Game/app data bus for the lobby room (matchmaking, pad rooms, sync, …).
 * Not chat — never shown in chat UI. Prefer namespaced channels: `{game}.{feature}`.
 */
export interface LobbyDataMessage {
    type: 'lobby:data';
    channel: string;
    payload: string;
}
export type LobbyVoiceMode = 'friends' | 'all';
export interface RtcSessionDescription {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
}
export interface RtcIceCandidate {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}
export interface LobbyVoiceJoinMessage {
    type: 'lobby:voice:join';
    mode: LobbyVoiceMode;
}
export interface LobbyVoiceLeaveMessage {
    type: 'lobby:voice:leave';
}
export interface LobbyVoiceMuteMessage {
    type: 'lobby:voice:mute';
    muted: boolean;
}
export interface LobbyVoiceOfferMessage {
    type: 'lobby:voice:offer';
    toUserId: string;
    sdp: RtcSessionDescription;
}
export interface LobbyVoiceAnswerMessage {
    type: 'lobby:voice:answer';
    toUserId: string;
    sdp: RtcSessionDescription;
}
export interface LobbyVoiceIceMessage {
    type: 'lobby:voice:ice';
    toUserId: string;
    candidate: RtcIceCandidate;
}
export declare const LOBBY_CHAT_MAX_LEN = 140;
/** Max payload bytes for lobby:data (game control / sync). Independent of chat. */
export declare const LOBBY_DATA_MAX_LEN = 512;
export declare const LOBBY_DATA_CHANNEL_MAX_LEN = 64;
export declare function sanitizeLobbyChat(text: unknown): string | null;
/** Validate data channel id. Does not apply chat sanitization. */
export declare function sanitizeLobbyDataChannel(channel: unknown): string | null;
/**
 * Validate data payload. Strips only dangerous control chars; preserves framing spaces.
 * Does not trim or slice like chat.
 */
export declare function sanitizeLobbyDataPayload(payload: unknown): string | null;
export type LobbyClientMessage = LobbyJoinMessage | LobbyMoveMessage | LobbyEmoteMessage | LobbyLeaveMessage | LobbyPingMessage | LobbyChatMessage | LobbyDataMessage | LobbyVoiceJoinMessage | LobbyVoiceLeaveMessage | LobbyVoiceMuteMessage | LobbyVoiceOfferMessage | LobbyVoiceAnswerMessage | LobbyVoiceIceMessage;
export interface LobbyVoicePeerState {
    userId: string;
    username?: string;
    mode: LobbyVoiceMode;
    muted: boolean;
}
export interface LobbyFeatureFlags {
    chatEnabled: boolean;
    voiceEnabled: boolean;
    chatAllowed: boolean;
    voiceAllowed: boolean;
    /**
     * Game data channel (`lobby:data`). Omitted / undefined ⇒ enabled.
     * Independent of chat — matchmaking must work when chat is banned/disabled.
     */
    dataEnabled?: boolean;
    dataAllowed?: boolean;
}
export interface LobbyWelcomeMessage {
    type: 'lobby:welcome';
    roomId: string;
    self: LobbyPlayerState;
    players: LobbyPlayerState[];
    maxPlayers: number;
    friendUserIds?: string[];
    voicePeers?: LobbyVoicePeerState[];
    lobbyFeatures?: LobbyFeatureFlags;
}
export interface LobbyStateMessage {
    type: 'lobby:state';
    players: LobbyPlayerState[];
}
export interface LobbyPlayerJoinedMessage {
    type: 'lobby:player:joined';
    player: LobbyPlayerState;
}
export interface LobbyPlayerLeftMessage {
    type: 'lobby:player:left';
    userId: string;
    username?: string;
    displayName?: string;
}
export interface LobbyPlayerMovedMessage {
    type: 'lobby:player:moved';
    userId: string;
    position: Vector3;
    rotationY: number;
    animation: LobbyAnimationState;
    seq: number;
    serverTime: number;
}
export interface LobbyPlayerEmoteMessage {
    type: 'lobby:player:emote';
    userId: string;
    emote: LobbyEmoteKind;
}
export interface LobbyErrorMessage {
    type: 'lobby:error';
    code: string;
    message: string;
}
export interface LobbyPongMessage {
    type: 'lobby:pong';
}
export interface LobbyChatBroadcastMessage {
    type: 'lobby:chat';
    userId: string;
    username?: string;
    displayName: string;
    text: string;
    at: number;
}
export interface LobbyDataBroadcastMessage {
    type: 'lobby:data';
    userId: string;
    username?: string;
    displayName?: string;
    channel: string;
    payload: string;
    at: number;
}
export interface LobbyVoiceStateMessage {
    type: 'lobby:voice:state';
    peers: LobbyVoicePeerState[];
    friendUserIds: string[];
}
export interface LobbyVoiceJoinedMessage {
    type: 'lobby:voice:joined';
    peer: LobbyVoicePeerState;
}
export interface LobbyVoiceLeftMessage {
    type: 'lobby:voice:left';
    userId: string;
}
export interface LobbyVoiceMuteBroadcastMessage {
    type: 'lobby:voice:mute';
    userId: string;
    muted: boolean;
}
export interface LobbyVoiceOfferBroadcastMessage {
    type: 'lobby:voice:offer';
    fromUserId: string;
    sdp: RtcSessionDescription;
}
export interface LobbyVoiceAnswerBroadcastMessage {
    type: 'lobby:voice:answer';
    fromUserId: string;
    sdp: RtcSessionDescription;
}
export interface LobbyVoiceIceBroadcastMessage {
    type: 'lobby:voice:ice';
    fromUserId: string;
    candidate: RtcIceCandidate;
}
export type LobbyServerMessage = LobbyWelcomeMessage | LobbyStateMessage | LobbyPlayerJoinedMessage | LobbyPlayerLeftMessage | LobbyPlayerMovedMessage | LobbyPlayerEmoteMessage | LobbyChatBroadcastMessage | LobbyDataBroadcastMessage | LobbyVoiceStateMessage | LobbyVoiceJoinedMessage | LobbyVoiceLeftMessage | LobbyVoiceMuteBroadcastMessage | LobbyVoiceOfferBroadcastMessage | LobbyVoiceAnswerBroadcastMessage | LobbyVoiceIceBroadcastMessage | LobbyErrorMessage | LobbyPongMessage;
export declare function parseLobbyClientMessage(data: unknown): LobbyClientMessage | null;
export declare function gameRoomId(gameSlug: string, instance?: number): string;
export declare const GLOBAL_AVATAR_ROOM_ID = "global:avatars";
export declare function isGlobalAvatarRoom(roomId: string): boolean;
export declare function parseGameSlugFromRoom(roomId: string): string | null;
//# sourceMappingURL=protocol.d.ts.map