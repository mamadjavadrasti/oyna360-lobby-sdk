import type { LobbySpawnConfig, Vector3 } from './types';

export interface LobbySpawnLayout {
  center?: Vector3;
  radius?: number;
  slots?: number;
}

export const DEFAULT_LOBBY_SPAWN: Required<LobbySpawnLayout> = {
  center: { x: 0, y: 0, z: 4 },
  radius: 3.25,
  slots: 16,
};

export interface LobbySpawnPose {
  position: Vector3;
  rotationY: number;
}

export function lobbySpawnPose(slotIndex: number, layout: LobbySpawnLayout = {}): LobbySpawnPose {
  const { center, radius, slots } = { ...DEFAULT_LOBBY_SPAWN, ...layout };
  const slot = ((slotIndex % slots) + slots) % slots;
  const angle = (slot / slots) * Math.PI * 2;
  const x = center.x + Math.sin(angle) * radius;
  const z = center.z + Math.cos(angle) * radius;
  return {
    position: { x, y: center.y, z },
    rotationY: Math.atan2(center.x - x, center.z - z),
  };
}

export function spawnLayoutFromConfig(config: LobbySpawnConfig = {}): LobbySpawnLayout {
  const center = config.spawnPoint ?? config.spawnPoints?.[0] ?? DEFAULT_LOBBY_SPAWN.center;
  return {
    center,
    radius: config.spawnSlotRadius ?? DEFAULT_LOBBY_SPAWN.radius,
    slots: config.spawnSlotCount ?? DEFAULT_LOBBY_SPAWN.slots,
  };
}

export function resolveSpawnPose(config: LobbySpawnConfig, slotIndex: number): LobbySpawnPose {
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

export function provisionalSpawnSlot(userId: string, slots: number): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(hash) % Math.max(1, slots);
}
