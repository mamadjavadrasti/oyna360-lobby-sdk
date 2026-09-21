import type { AbstractMesh, Scene } from '@babylonjs/core';
export declare function syncCharacterObstacle(scene: Scene, rootName: string, x: number, z: number): void;
export declare function removeCharacterObstacle(scene: Scene, rootName: string): void;
/**
 * Invisible world-space colliders for every lobby prop.
 * Thin floors stay walk-through so the capsule does not hop; tall proxies block walking through objects.
 */
export declare function applyLobbyCollisions(scene: Scene): void;
export declare function isSolidLobbyMesh(mesh: AbstractMesh): boolean;
//# sourceMappingURL=lobby-colliders.d.ts.map