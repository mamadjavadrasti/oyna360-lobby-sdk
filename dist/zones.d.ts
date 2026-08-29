import type { Vector3 } from './types';
export declare class ZoneManager {
    private readonly zones;
    addZone(options: {
        id: string;
        bounds: {
            min: Vector3;
            max: Vector3;
        };
        onEnter?: (playerId: string) => void;
        onExit?: (playerId: string) => void;
    }): void;
    updatePlayer(playerId: string, position: Vector3): void;
    private isInside;
    clear(): void;
}
export declare class PortalManager {
    private readonly portals;
    addPortal(options: {
        id: string;
        position: Vector3;
        radius?: number;
        toGameSlug?: string;
        toScene?: string;
        onTrigger?: () => void;
    }): void;
    updatePlayer(playerId: string, position: Vector3): Array<{
        portalId: string;
        toGameSlug?: string;
        toScene?: string;
        onTrigger?: () => void;
    }>;
    clear(): void;
}
//# sourceMappingURL=zones.d.ts.map