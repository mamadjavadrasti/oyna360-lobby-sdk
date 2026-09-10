/** Bundled lobby protocol — games do not install @platform/lobby-protocol. Keep in sync with packages/lobby-protocol. */
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
export function gameRoomId(gameSlug, instance = 1) {
    return instance <= 1 ? `game:${gameSlug}` : `game:${gameSlug}-${instance}`;
}
export const GLOBAL_AVATAR_ROOM_ID = 'global:avatars';
export function isGlobalAvatarRoom(roomId) {
    return roomId === GLOBAL_AVATAR_ROOM_ID;
}
export function parseGameSlugFromRoom(roomId) {
    if (roomId === GLOBAL_AVATAR_ROOM_ID)
        return 'avatar-hub';
    const match = /^game:([^-]+)(?:-\d+)?$/.exec(roomId);
    return match ? match[1] : null;
}
//# sourceMappingURL=protocol.js.map