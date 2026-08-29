/** Bundled lobby protocol — games do not install @platform/lobby-protocol. Keep in sync with packages/lobby-protocol. */

export const LOBBY_PROTOCOL_VERSION = '0.1.0';

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

export type LobbyClientMessage =
  | LobbyJoinMessage
  | LobbyMoveMessage
  | LobbyEmoteMessage
  | LobbyLeaveMessage
  | LobbyPingMessage;

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

export type LobbyServerMessage =
  | LobbyWelcomeMessage
  | LobbyStateMessage
  | LobbyPlayerJoinedMessage
  | LobbyPlayerLeftMessage
  | LobbyPlayerMovedMessage
  | LobbyPlayerEmoteMessage
  | LobbyErrorMessage
  | LobbyPongMessage;

export function parseLobbyClientMessage(data: unknown): LobbyClientMessage | null {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  switch (type) {
    case 'lobby:join':
    case 'lobby:move':
    case 'lobby:emote':
    case 'lobby:leave':
    case 'lobby:ping':
      return data as LobbyClientMessage;
    default:
      return null;
  }
}

export function gameRoomId(gameSlug: string, instance = 1): string {
  return instance <= 1 ? `game:${gameSlug}` : `game:${gameSlug}-${instance}`;
}

export const GLOBAL_AVATAR_ROOM_ID = 'global:avatars';

export function isGlobalAvatarRoom(roomId: string): boolean {
  return roomId === GLOBAL_AVATAR_ROOM_ID;
}

export function parseGameSlugFromRoom(roomId: string): string | null {
  if (roomId === GLOBAL_AVATAR_ROOM_ID) return 'avatar-hub';
  const match = /^game:([^-]+)(?:-\d+)?$/.exec(roomId);
  return match ? match[1] : null;
}
