/** Bundled from lobby-protocol/lobby-spawn.ts — run sync-lobby-protocol.mjs */
import type { Vector3 } from './types';
export interface LobbySpawnLayout {
    center?: Vector3;
    radius?: number;
    slots?: number;
}
export declare const DEFAULT_LOBBY_SPAWN: Required<LobbySpawnLayout>;
export interface LobbySpawnPose {
    position: Vector3;
    rotationY: number;
}
/** Spread players around a ring so simultaneous joins do not stack. */
export declare function lobbySpawnPose(slotIndex: number, layout?: LobbySpawnLayout): LobbySpawnPose;
//# sourceMappingURL=lobby-spawn.d.ts.map