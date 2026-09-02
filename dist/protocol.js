/** Bundled lobby protocol — games do not install @platform/lobby-protocol. Keep in sync with packages/lobby-protocol. */
export const LOBBY_PROTOCOL_VERSION = '0.1.0';
export const LOBBY_CHAT_MAX_LEN = 140;
export function sanitizeLobbyChat(text) {
    if (typeof text !== 'string')
        return null;
    const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned)
        return null;
    return cleaned.slice(0, LOBBY_CHAT_MAX_LEN);
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