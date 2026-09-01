import type { LobbySpawnConfig, Vector3 } from './types';
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
export declare function lobbySpawnPose(slotIndex: number, layout?: LobbySpawnLayout): LobbySpawnPose;
export declare function spawnLayoutFromConfig(config?: LobbySpawnConfig): LobbySpawnLayout;
export declare function resolveSpawnPose(config: LobbySpawnConfig, slotIndex: number): LobbySpawnPose;
export declare function provisionalSpawnSlot(userId: string, slots: number): number;
//# sourceMappingURL=spawn-utils.d.ts.map