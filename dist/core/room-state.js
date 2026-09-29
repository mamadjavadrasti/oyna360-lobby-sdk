export function createRoomState(roomId) {
    return { roomId, self: null, players: new Map() };
}
export function upsertPlayer(room, player) {
    room.players.set(player.userId, player);
}
export function removePlayer(room, userId) {
    room.players.delete(userId);
}
//# sourceMappingURL=room-state.js.map