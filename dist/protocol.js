/**
 * Bundled lobby wire protocol — generated from @platform/lobby-protocol.
 * Do not edit by hand. Run: node scripts/sync-lobby-protocol.mjs
 * (scale roadmap 9.1)
 */
/** Lobby SDK protocol version — keep in sync with @oyna360/lobby-sdk */
export const LOBBY_PROTOCOL_VERSION = '0.1.0';
export const LOBBY_CHAT_MAX_LEN = 140;
/** Max payload bytes for lobby:data (game control / sync). Independent of chat. */
export const LOBBY_DATA_MAX_LEN = 512;
export const LOBBY_DATA_CHANNEL_MAX_LEN = 64;
const LOBBY_DATA_CHANNEL_RE = /^[a-zA-Z0-9._-]+$/;
export function sanitizeLobbyChat(text) {
    if (typeof text !== 'string')
        return null;
    const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned)
        return null;
    return cleaned.slice(0, LOBBY_CHAT_MAX_LEN);
}
/** Validate data channel id. Does not apply chat sanitization. */
export function sanitizeLobbyDataChannel(channel) {
    if (typeof channel !== 'string')
        return null;
    const cleaned = channel.trim();
    if (!cleaned || cleaned.length > LOBBY_DATA_CHANNEL_MAX_LEN)
        return null;
    if (!LOBBY_DATA_CHANNEL_RE.test(cleaned))
        return null;
    return cleaned;
}
/**
 * Validate data payload. Strips only dangerous control chars; preserves framing spaces.
 * Does not trim or slice like chat.
 */
export function sanitizeLobbyDataPayload(payload) {
    if (typeof payload !== 'string')
        return null;
    if (!payload || payload.length > LOBBY_DATA_MAX_LEN)
        return null;
    const cleaned = payload.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (!cleaned || cleaned.length > LOBBY_DATA_MAX_LEN)
        return null;
    return cleaned;
}
export function parseLobbyClientMessage(data) {
    if (!data || typeof data !== 'object')
        return null;
    const type = data.type;
    switch (type) {
        case 'lobby:join':
        case 'lobby:move':
        case 'lobby:emote':
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
            return data;
        default:
            return null;
    }
}
/** Build per-game room id */
export function gameRoomId(gameSlug, instance = 1) {
    return instance <= 1 ? `game:${gameSlug}` : `game:${gameSlug}-${instance}`;
}
/** Global avatar hub room (phase 7) */
export const GLOBAL_AVATAR_ROOM_ID = 'global:avatars';
export function isGlobalAvatarRoom(roomId) {
    return roomId === GLOBAL_AVATAR_ROOM_ID;
}
const GAME_ROOM_PREFIX = 'game:';
/**
 * Best-effort slug from a room id. Slugs may contain hyphens (`game:fall-cars-2`),
 * so a trailing `-<digits>` is read as an instance suffix. Ambiguous for slugs that
 * genuinely end in `-<digits>` — prefer `isRoomForGame` when the slug is known.
 */
export function parseGameSlugFromRoom(roomId) {
    if (roomId === GLOBAL_AVATAR_ROOM_ID)
        return 'avatar-hub';
    if (!roomId.startsWith(GAME_ROOM_PREFIX))
        return null;
    const rest = roomId.slice(GAME_ROOM_PREFIX.length);
    if (!rest)
        return null;
    const instanced = /^(.+)-(\d+)$/.exec(rest);
    return instanced ? instanced[1] : rest;
}
/** True when roomId is the base room or a numbered instance of gameSlug. */
export function isRoomForGame(roomId, gameSlug) {
    if (!gameSlug)
        return false;
    if (roomId === gameRoomId(gameSlug))
        return true;
    const prefix = `${GAME_ROOM_PREFIX}${gameSlug}-`;
    if (!roomId.startsWith(prefix))
        return false;
    const instance = roomId.slice(prefix.length);
    return /^\d+$/.test(instance) && Number(instance) > 1;
}
//# sourceMappingURL=protocol.js.map