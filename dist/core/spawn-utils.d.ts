import { DEFAULT_LOBBY_SPAWN, lobbySpawnPose, type LobbySpawnLayout, type LobbySpawnPose } from './lobby-spawn.js';
import type { LobbySpawnConfig } from './types.js';
export { DEFAULT_LOBBY_SPAWN, lobbySpawnPose };
export type { LobbySpawnLayout, LobbySpawnPose };
export declare function spawnLayoutFromConfig(config?: LobbySpawnConfig): LobbySpawnLayout;
export declare function resolveSpawnPose(config: LobbySpawnConfig, slotIndex: number): LobbySpawnPose;
export declare function provisionalSpawnSlot(userId: string, slots: number): number;
//# sourceMappingURL=spawn-utils.d.ts.map