import { TransformNode } from '@babylonjs/core';
import type { PlatformLobby } from './platform-lobby';
import type { Vector3 as Vec3 } from './types';
export interface StarterLayoutConfig {
    showZones?: boolean;
    showGameplayPortal?: boolean;
    showGrid?: boolean;
    /** Game-owned portal hints. `slug` is only passed through `portalTrigger` — the SDK never navigates. */
    gamePortals?: Array<{
        slug: string;
        name: string;
        position: Vec3;
    }>;
}
export declare function applyStarterLayout(lobby: PlatformLobby, config?: StarterLayoutConfig): void;
export declare function createPortalVisual(scene: import('@babylonjs/core').Scene, id: string, position: Vec3, color: string): TransformNode;
//# sourceMappingURL=starter-layout.d.ts.map