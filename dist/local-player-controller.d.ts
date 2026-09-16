import type { AbstractMesh, ArcRotateCamera, Scene, TransformNode } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
import { AvatarInstance } from './avatar-instance';
import type { PlatformLobbyConfig, Vector3 as Vec3 } from './types';
import type { LobbyMusic } from './lobby-music';
export declare class LocalPlayerController {
    private scene;
    private getCamera;
    private codes;
    private stickX;
    private stickZ;
    private sprintHeld;
    private jumpQueued;
    private jumpHeldPointer;
    private jumpHeldKey;
    private jumpLock;
    private yaw;
    private hVel;
    private vy;
    private grounded;
    private standY;
    private animation;
    private slideActive;
    private slideT;
    private slideDuration;
    private slidePath;
    private onSlideComplete;
    private readonly walkSpeed;
    private readonly runMultiplier;
    private readonly animator;
    private readonly avatar;
    private audio;
    private disposed;
    private spawn;
    private ignoreMeshesCache;
    constructor(avatar: AvatarInstance | TransformNode, spawn: Vec3, scene: Scene, getCamera: () => ArcRotateCamera, config?: PlatformLobbyConfig);
    /** Back-compat: controllers historically exposed the Babylon root node. */
    get root(): TransformNode;
    setStick(x: number, z: number): void;
    setSounds(audio: LobbyMusic): void;
    setSprint(on: boolean): void;
    setJumpHeld(on: boolean): void;
    jump(): void;
    teleportTo(pos: Vec3, rotationY?: number): void;
    isSlideActive(): boolean;
    isGrounded(): boolean;
    getVerticalVelocity(): number;
    launchBoost(velocity: number): void;
    startSlide(path: Vec3[], duration: number, onComplete?: () => void): void;
    private finishSlide;
    private updateSlide;
    private onKeyDown;
    private onKeyUp;
    private onBlur;
    update(dt: number): {
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: LobbyAnimationState;
    };
    private isWalkableFloor;
    private refreshGrounded;
    private syncVisualYaw;
    getState(): {
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: LobbyAnimationState;
    };
    getIgnoreMeshes(): AbstractMesh[];
    setPosition(pos: Vec3): void;
    dispose(): void;
}
//# sourceMappingURL=local-player-controller.d.ts.map