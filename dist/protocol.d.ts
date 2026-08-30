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
export declare const LOBBY_CHAT_MAX_LEN = 140;
export declare function sanitizeLobbyChat(text: unknown): string | null;
export type LobbyClientMessage = LobbyJoinMessage | LobbyMoveMessage | LobbyEmoteMessage | LobbyLeaveMessage | LobbyPingMessage | LobbyChatMessage;
export interface LobbyWelcomeMessage {
    type: 'lobby:welcome';
    roomId: string;
    self: LobbyPlayerState;
    players: LobbyPlayerState[];
    maxPlayers: number;
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
    displayName: string;
    text: string;
    at: number;
}
export type LobbyServerMessage = LobbyWelcomeMessage | LobbyStateMessage | LobbyPlayerJoinedMessage | LobbyPlayerLeftMessage | LobbyPlayerMovedMessage | LobbyPlayerEmoteMessage | LobbyChatBroadcastMessage | LobbyErrorMessage | LobbyPongMessage;
export declare function parseLobbyClientMessage(data: unknown): LobbyClientMessage | null;
export declare function gameRoomId(gameSlug: string, instance?: number): string;
export declare const GLOBAL_AVATAR_ROOM_ID = "global:avatars";
export declare function isGlobalAvatarRoom(roomId: string): boolean;
export declare function parseGameSlugFromRoom(roomId: string): string | null;
//# sourceMappingURL=protocol.d.ts.map