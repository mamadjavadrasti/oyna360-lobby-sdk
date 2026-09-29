export function formatPlayerHandle(_displayName, username) {
    return (username?.trim() || 'بازیکن').slice(0, 24);
}
/** 3D name tags: username only. */
export function formatAvatarTagLabel(_displayName, username) {
    return formatPlayerHandle(undefined, username);
}
export function formatPlayerLabel(displayName, username) {
    return formatPlayerHandle(displayName, username);
}
export function formatPlayerLabelParts(displayName, username) {
    return { title: formatAvatarTagLabel(displayName, username), subtitle: null };
}
//# sourceMappingURL=player-label.js.map