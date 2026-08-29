import type { PlatformLobby } from './platform-lobby';
import type { Vector3 as Vec3 } from './types';
export interface PlazaRoomDef {
    id: string;
    name: string;
    mode: string;
    maxPlayers: number;
    players?: number;
    color: string;
    accent?: string;
    position: Vec3;
    gameSlug?: string;
    theme?: 'arena' | 'arch' | 'rings' | 'spire' | 'dual' | 'track' | 'toxic' | 'ice';
}
export interface PlazaLayoutConfig {
    rooms?: PlazaRoomDef[];
    npcCount?: number;
}
export declare const DEFAULT_PLAZA_ROOMS: PlazaRoomDef[];
export declare function applyPlazaLayout(lobby: PlatformLobby, config?: PlazaLayoutConfig): void;
//# sourceMappingURL=plaza-layout.d.ts.map