import { DEFAULT_LOBBY_SPAWN, lobbySpawnPose, } from './lobby-spawn';
export { DEFAULT_LOBBY_SPAWN, lobbySpawnPose };
export function spawnLayoutFromConfig(config = {}) {
    const center = config.spawnPoint ?? config.spawnPoints?.[0] ?? DEFAULT_LOBBY_SPAWN.center;
    return {
        center,
        radius: config.spawnSlotRadius ?? DEFAULT_LOBBY_SPAWN.radius,
        slots: config.spawnSlotCount ?? DEFAULT_LOBBY_SPAWN.slots,
    };
}
export function resolveSpawnPose(config, slotIndex) {
    const points = config.spawnPoints;
    if (points && points.length > 0) {
        const position = points[((slotIndex % points.length) + points.length) % points.length];
        const center = config.spawnPoint ?? DEFAULT_LOBBY_SPAWN.center;
        return {
            position: { ...position },
            rotationY: Math.atan2(center.x - position.x, center.z - position.z),
        };
    }
    return lobbySpawnPose(slotIndex, spawnLayoutFromConfig(config));
}
export function provisionalSpawnSlot(userId, slots) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++)
        hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    return Math.abs(hash) % Math.max(1, slots);
}
//# sourceMappingURL=spawn-utils.js.map