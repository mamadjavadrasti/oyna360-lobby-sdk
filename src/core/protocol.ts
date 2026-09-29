/**
 * Bundled lobby wire protocol — generated from @platform/lobby-protocol.
 * Do not edit by hand. Run: node scripts/sync-lobby-protocol.mjs
 * (scale roadmap 9.1)
 */

/** Lobby SDK protocol version — keep in sync with @oyna360/lobby-sdk */
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

/** Client → Server */
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

/**
 * Client → Server: propose local AvatarState (as SdkLobbyAvatar wire shape).
 * Server validates/sanitizes before broadcasting.
 */
export interface LobbyAvatarUpdateMessage {
  type: 'lobby:avatar:update';
  avatar: SdkLobbyAvatar;
  /** Optional AvatarState.emote (cosmetic); locomotion stays on lobby:move. */
  emote?: LobbyEmoteKind | null;
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

/** Serializable WebRTC session description (browser RTCSessionDescriptionInit). */
export interface RtcSessionDescription {
  type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

/** Serializable ICE candidate (browser RTCIceCandidateInit). */
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

export const LOBBY_CHAT_MAX_LEN = 140;

/** Max payload bytes for lobby:data (game control / sync). Independent of chat. */
export const LOBBY_DATA_MAX_LEN = 512;
export const LOBBY_DATA_CHANNEL_MAX_LEN = 64;
const LOBBY_DATA_CHANNEL_RE = /^[a-zA-Z0-9._-]+$/;

export function sanitizeLobbyChat(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, LOBBY_CHAT_MAX_LEN);
}

/** Validate data channel id. Does not apply chat sanitization. */
export function sanitizeLobbyDataChannel(channel: unknown): string | null {
  if (typeof channel !== 'string') return null;
  const cleaned = channel.trim();
  if (!cleaned || cleaned.length > LOBBY_DATA_CHANNEL_MAX_LEN) return null;
  if (!LOBBY_DATA_CHANNEL_RE.test(cleaned)) return null;
  return cleaned;
}

/**
 * Validate data payload. Strips only dangerous control chars; preserves framing spaces.
 * Does not trim or slice like chat.
 */
export function sanitizeLobbyDataPayload(payload: unknown): string | null {
  if (typeof payload !== 'string') return null;
  if (!payload || payload.length > LOBBY_DATA_MAX_LEN) return null;
  const cleaned = payload.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (!cleaned || cleaned.length > LOBBY_DATA_MAX_LEN) return null;
  return cleaned;
}

/** Limits for lobby:avatar:update (extensible allowlists via options). */
export const LOBBY_AVATAR_MAX_ACCESSORIES = 8;
export const LOBBY_AVATAR_MAX_ATTACHMENTS = 8;
export const LOBBY_AVATAR_ID_MAX = 64;
export const LOBBY_AVATAR_CONFIG_JSON_MAX = 2048;
export const LOBBY_AVATAR_URL_MAX = 512;

const LOBBY_AVATAR_HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOBBY_AVATAR_ID_RE = /^[a-zA-Z0-9._:-]+$/;
/** Same-origin relative asset paths only — arbitrary absolute URLs are stripped. */
const LOBBY_AVATAR_SAFE_PATH_RE = /^\/[a-zA-Z0-9._/~%-]+$/;
const LOBBY_AVATAR_ACCESSORY_SLOTS = new Set([
  'hat',
  'back',
  'face',
  'hand',
  'skin',
  'top',
  'bottom',
  'outfit',
]);
const LOBBY_AVATAR_CONFIG_KEYS = new Set([
  'bodyColor',
  'accentColor',
  'pantsColor',
  'hairColor',
  'skinColor',
  'tint',
  'tintColor',
  'colorVariantKey',
  'accessories',
  'attachments',
  'glbUrl',
  'baseAlbedoUrl',
  'version',
]);

export type SanitizeLobbyAvatarOptions = {
  /** When non-empty, presetKey / baseId must be in this set. */
  allowedBaseIds?: ReadonlySet<string> | readonly string[];
  /** When non-empty, accessory/attachment itemId must be in this set. */
  allowedItemIds?: ReadonlySet<string> | readonly string[];
};

function asIdSet(value: SanitizeLobbyAvatarOptions['allowedBaseIds']): Set<string> | null {
  if (!value) return null;
  const set = value instanceof Set ? value : new Set(value);
  return set.size > 0 ? set : null;
}

function sanitizeLobbyAvatarId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().slice(0, LOBBY_AVATAR_ID_MAX);
  if (!id || !LOBBY_AVATAR_ID_RE.test(id)) return null;
  return id;
}

function sanitizeLobbyAvatarHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim();
  return LOBBY_AVATAR_HEX_RE.test(hex) ? hex : undefined;
}

/** Allow only relative `/…` paths — never broadcast arbitrary http(s) asset URLs. */
function sanitizeLobbyAvatarAssetPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = value.trim().slice(0, LOBBY_AVATAR_URL_MAX);
  if (!url || !LOBBY_AVATAR_SAFE_PATH_RE.test(url)) return undefined;
  return url;
}

function sanitizeLobbyAvatarAccessories(
  raw: unknown,
  allowedItemIds: Set<string> | null,
): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const entry of raw) {
    if (out.length >= LOBBY_AVATAR_MAX_ACCESSORIES) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const src = entry as Record<string, unknown>;
    const slot = typeof src.slot === 'string' ? src.slot.trim() : '';
    const itemId = sanitizeLobbyAvatarId(src.itemId);
    if (!LOBBY_AVATAR_ACCESSORY_SLOTS.has(slot) || !itemId) continue;
    if (allowedItemIds && !allowedItemIds.has(itemId)) continue;
    const row: Record<string, unknown> = { slot, itemId };
    const id = sanitizeLobbyAvatarId(src.id);
    if (id) row.id = id;
    if (typeof src.primitive === 'string') {
      const p = src.primitive.trim().slice(0, 32);
      if (p === 'cap' || p === 'pack' || p === 'glasses' || p === 'watch') row.primitive = p;
    }
    const bone = sanitizeLobbyAvatarId(src.attachBone);
    if (bone) row.attachBone = bone;
    // Never forward client-supplied accessory glbUrl / assetUrl.
    out.push(row);
  }
  return out;
}

function sanitizeLobbyAvatarAttachments(
  raw: unknown,
  allowedItemIds: Set<string> | null,
): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const entry of raw) {
    if (out.length >= LOBBY_AVATAR_MAX_ATTACHMENTS) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const src = entry as Record<string, unknown>;
    const id = sanitizeLobbyAvatarId(src.id);
    if (!id) continue;
    const itemId = sanitizeLobbyAvatarId(src.itemId);
    if (itemId && allowedItemIds && !allowedItemIds.has(itemId)) continue;
    const row: Record<string, unknown> = { id };
    if (itemId) row.itemId = itemId;
    if (typeof src.kind === 'string') {
      const kind = src.kind.trim().slice(0, 32);
      if (kind && LOBBY_AVATAR_ID_RE.test(kind)) row.kind = kind;
    }
    const bone = sanitizeLobbyAvatarId(src.bone) ?? sanitizeLobbyAvatarId(src.attachBone);
    if (bone) row.bone = bone;
    const slot = typeof src.slot === 'string' ? src.slot.trim().slice(0, 32) : '';
    if (slot && LOBBY_AVATAR_ACCESSORY_SLOTS.has(slot)) row.slot = slot;
    // Strip assetUrl — remotes must not load arbitrary client URLs.
    out.push(row);
  }
  return out;
}

/**
 * Validate + sanitize a client avatar update for room broadcast.
 * Drops unknown keys, unsafe absolute asset URLs, and oversize metadata.
 * Optional allowlists refine baseId / itemId checks without requiring them.
 */
export function sanitizeLobbyAvatarUpdate(
  input: unknown,
  options: SanitizeLobbyAvatarOptions = {},
): SdkLobbyAvatar | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;

  const presetKey = sanitizeLobbyAvatarId(src.presetKey) ?? sanitizeLobbyAvatarId(src.baseId);
  if (!presetKey) return null;
  const allowedBases = asIdSet(options.allowedBaseIds);
  if (allowedBases && !allowedBases.has(presetKey)) return null;

  const presetId = sanitizeLobbyAvatarId(src.presetId) ?? presetKey;
  const kindRaw = src.presetKind;
  const presetKind: AvatarPresetKind =
    kindRaw === 'glb' || kindRaw === 'procedural' ? kindRaw : 'procedural';

  const rawConfig =
    src.customConfig && typeof src.customConfig === 'object' && !Array.isArray(src.customConfig)
      ? (src.customConfig as Record<string, unknown>)
      : {};

  try {
    if (JSON.stringify(rawConfig).length > LOBBY_AVATAR_CONFIG_JSON_MAX) return null;
  } catch {
    return null;
  }

  const allowedItems = asIdSet(options.allowedItemIds);
  const customConfig: Record<string, unknown> = {};

  for (const key of Object.keys(rawConfig)) {
    if (!LOBBY_AVATAR_CONFIG_KEYS.has(key)) continue;
    const value = rawConfig[key];
    switch (key) {
      case 'bodyColor':
      case 'accentColor':
      case 'pantsColor':
      case 'hairColor':
      case 'skinColor':
      case 'tint':
      case 'tintColor': {
        const hex = sanitizeLobbyAvatarHex(value);
        if (hex) customConfig[key] = hex;
        break;
      }
      case 'colorVariantKey': {
        const id = sanitizeLobbyAvatarId(value);
        if (id) customConfig.colorVariantKey = id;
        break;
      }
      case 'version': {
        if (typeof value === 'number' && Number.isFinite(value)) {
          customConfig.version = Math.max(1, Math.min(100, Math.floor(value)));
        }
        break;
      }
      case 'glbUrl':
      case 'baseAlbedoUrl': {
        const path = sanitizeLobbyAvatarAssetPath(value);
        if (path) customConfig[key] = path;
        break;
      }
      case 'accessories': {
        const accessories = sanitizeLobbyAvatarAccessories(value, allowedItems);
        if (accessories.length) customConfig.accessories = accessories;
        break;
      }
      case 'attachments': {
        const attachments = sanitizeLobbyAvatarAttachments(value, allowedItems);
        if (attachments.length) customConfig.attachments = attachments;
        break;
      }
      default:
        break;
    }
  }

  if (presetKind === 'glb' && typeof customConfig.glbUrl !== 'string') {
    // GLB without a safe relative path — still allow; server may merge prior URL.
  }

  return {
    presetId,
    presetKey,
    presetKind,
    customConfig,
  };
}

export function sanitizeLobbyAvatarEmote(value: unknown): LobbyEmoteKind | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value === 'wave' || value === 'sit' || value === 'dance' || value === 'point') return value;
  return undefined;
}

export type LobbyClientMessage =
  | LobbyJoinMessage
  | LobbyMoveMessage
  | LobbyEmoteMessage
  | LobbyAvatarUpdateMessage
  | LobbyLeaveMessage
  | LobbyPingMessage
  | LobbyChatMessage
  | LobbyDataMessage
  | LobbyVoiceJoinMessage
  | LobbyVoiceLeaveMessage
  | LobbyVoiceMuteMessage
  | LobbyVoiceOfferMessage
  | LobbyVoiceAnswerMessage
  | LobbyVoiceIceMessage;

/** Server → Client */
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
  /** Server protocol version (scale roadmap 9.4). */
  protocolVersion: string;
  /** Accepted friend user ids for voice filtering (friends mode). */
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

/** Batched moves for a room tick (scale roadmap 4.1). Fields may be omitted when unchanged (4.3 delta). */
export interface LobbyPlayersMovedMessage {
  type: 'lobby:players:moved';
  moves: Array<{
    userId: string;
    position?: Vector3;
    rotationY?: number;
    animation?: LobbyAnimationState;
    seq: number;
  }>;
  serverTime: number;
}

export interface LobbyPlayerEmoteMessage {
  type: 'lobby:player:emote';
  userId: string;
  emote: LobbyEmoteKind;
}

/** Server → remotes after validated lobby:avatar:update. */
export interface LobbyPlayerAvatarMessage {
  type: 'lobby:player:avatar';
  userId: string;
  avatar: SdkLobbyAvatar;
  emote?: LobbyEmoteKind | null;
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

export type LobbyServerMessage =
  | LobbyWelcomeMessage
  | LobbyStateMessage
  | LobbyPlayerJoinedMessage
  | LobbyPlayerLeftMessage
  | LobbyPlayerMovedMessage
  | LobbyPlayersMovedMessage
  | LobbyPlayerEmoteMessage
  | LobbyPlayerAvatarMessage
  | LobbyChatBroadcastMessage
  | LobbyDataBroadcastMessage
  | LobbyVoiceStateMessage
  | LobbyVoiceJoinedMessage
  | LobbyVoiceLeftMessage
  | LobbyVoiceMuteBroadcastMessage
  | LobbyVoiceOfferBroadcastMessage
  | LobbyVoiceAnswerBroadcastMessage
  | LobbyVoiceIceBroadcastMessage
  | LobbyErrorMessage
  | LobbyPongMessage;

export function parseLobbyClientMessage(data: unknown): LobbyClientMessage | null {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  switch (type) {
    case 'lobby:join':
    case 'lobby:move':
    case 'lobby:emote':
    case 'lobby:avatar:update':
    case 'lobby:leave':
    case 'lobby:ping':
    case 'lobby:chat':
    case 'lobby:data':
    case 'lobby:voice:join':
    case 'lobby:voice:leave':
    case 'lobby:voice:mute':
    case 'lobby:voice:offer':
    case 'lobby:voice:answer':
    case 'lobby:voice:ice':
      return data as LobbyClientMessage;
    default:
      return null;
  }
}

/** Build per-game room id */
export function gameRoomId(gameSlug: string, instance = 1): string {
  return instance <= 1 ? `game:${gameSlug}` : `game:${gameSlug}-${instance}`;
}

/** Global avatar hub room (phase 7) */
export const GLOBAL_AVATAR_ROOM_ID = 'global:avatars';

export function isGlobalAvatarRoom(roomId: string): boolean {
  return roomId === GLOBAL_AVATAR_ROOM_ID;
}

const GAME_ROOM_PREFIX = 'game:';

/**
 * Best-effort slug from a room id. Slugs may contain hyphens (`game:fall-cars-2`),
 * so a trailing `-<digits>` is read as an instance suffix. Ambiguous for slugs that
 * genuinely end in `-<digits>` — prefer `isRoomForGame` when the slug is known.
 */
export function parseGameSlugFromRoom(roomId: string): string | null {
  if (roomId === GLOBAL_AVATAR_ROOM_ID) return 'avatar-hub';
  if (!roomId.startsWith(GAME_ROOM_PREFIX)) return null;
  const rest = roomId.slice(GAME_ROOM_PREFIX.length);
  if (!rest) return null;
  const instanced = /^(.+)-(\d+)$/.exec(rest);
  return instanced ? instanced[1] : rest;
}

/** True when roomId is the base room or a numbered instance of gameSlug. */
export function isRoomForGame(roomId: string, gameSlug: string): boolean {
  if (!gameSlug) return false;
  if (roomId === gameRoomId(gameSlug)) return true;
  const prefix = `${GAME_ROOM_PREFIX}${gameSlug}-`;
  if (!roomId.startsWith(prefix)) return false;
  const instance = roomId.slice(prefix.length);
  return /^\d+$/.test(instance) && Number(instance) > 1;
}
