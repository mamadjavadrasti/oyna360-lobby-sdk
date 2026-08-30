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
    /** Hint for the game when the room countdown ends. SDK does not navigate. */
    gameSlug?: string;
    theme?: 'arena' | 'arch' | 'rings' | 'spire' | 'dual' | 'track' | 'toxic' | 'ice';
}
export interface PlazaLayoutConfig {
    rooms?: PlazaRoomDef[];
    npcCount?: number;
    /** Game-owned. Called when a starter room finishes countdown. SDK does not navigate. */
    onRoomStart?: (room: {
        id: string;
        name: string;
        gameSlug?: string;
    }) => void;
}
/** Default rooms for the starter plaza only. Games should pass their own `rooms`. */
export declare const DEFAULT_PLAZA_ROOMS: PlazaRoomDef[];
/** Optional plaza template for the starter lobby. Games copy or replace this; it is not the official oyna360 lobby. */
export declare function applyPlazaLayout(lobby: PlatformLobby, config?: PlazaLayoutConfig): void;
//# sourceMappingURL=plaza-layout.d.ts.map