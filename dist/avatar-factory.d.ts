import { Mesh, Scene, TransformNode } from '@babylonjs/core';
import type { SdkLobbyAvatar } from './platform-types';
export interface AvatarRig {
    /** Movable node (collider if present, otherwise visual root). */
    root: TransformNode;
    visual: TransformNode;
    collider: Mesh | null;
    torso: TransformNode;
    head: TransformNode;
    armL: TransformNode;
    armR: TransformNode;
    legL: TransformNode;
    legR: TransformNode;
}
export declare class AvatarFactory {
    static create(scene: Scene, avatar: SdkLobbyAvatar, name?: string, displayName?: string, username?: string, options?: {
        collider?: boolean | 'player' | 'body';
    }): TransformNode;
    static getRig(root: TransformNode): AvatarRig | null;
    static setPosition(root: TransformNode, position: {
        x: number;
        y: number;
        z: number;
    }): void;
    static setRotationY(root: TransformNode, rotationY: number): void;
}
//# sourceMappingURL=avatar-factory.d.ts.map