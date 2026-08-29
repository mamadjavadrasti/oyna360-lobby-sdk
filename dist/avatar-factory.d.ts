import { Scene, TransformNode } from '@babylonjs/core';
import type { SdkLobbyAvatar } from '@platform/types';
/** Stylized blocky humanoid (Roblox-like). GLB can replace later. */
export declare class AvatarFactory {
    static create(scene: Scene, avatar: SdkLobbyAvatar, name?: string, displayName?: string): TransformNode;
    static setPosition(root: TransformNode, position: {
        x: number;
        y: number;
        z: number;
    }): void;
    static setRotationY(root: TransformNode, rotationY: number): void;
}
//# sourceMappingURL=avatar-factory.d.ts.map