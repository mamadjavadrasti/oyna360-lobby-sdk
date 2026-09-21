/** Bundled from lobby-protocol/lobby-spawn.ts — run sync-lobby-protocol.mjs */
import type { Vector3 } from './types';

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

/** Spread players around a ring so simultaneous joins do not stack. */
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
