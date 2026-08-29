import type { TransformNode } from '@babylonjs/core';
import type { LobbyAnimationState } from '@platform/lobby-protocol';
import type { PlatformLobbyConfig, Vector3 as Vec3 } from './types';
export declare class LocalPlayerController {
    private root;
    private keys;
    private position;
    private rotationY;
    private animation;
    private readonly speed;
    private readonly runMultiplier;
    private disposed;
    constructor(root: TransformNode, spawn: Vec3, config?: PlatformLobbyConfig);
    private onKeyDown;
    private onKeyUp;
    update(dt: number): {
        position: Vec3;
        rotationY: number;
        animation: LobbyAnimationState;
    };
    getState(): {
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: LobbyAnimationState;
    };
    setPosition(pos: Vec3): void;
    private syncTransform;
    dispose(): void;
}
//# sourceMappingURL=local-player-controller.d.ts.map