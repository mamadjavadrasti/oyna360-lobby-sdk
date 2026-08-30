import { Engine, Scene, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, ArcRotateCamera } from '@babylonjs/core';
import type { PlatformLobbyConfig } from './types';
import { ThirdPersonCamera } from './third-person-camera';
export declare class SceneManager {
    readonly engine: Engine;
    readonly scene: Scene;
    readonly thirdPerson: ThirdPersonCamera;
    private groundMaterial;
    private readonly canvas;
    constructor(canvas: HTMLCanvasElement, config?: PlatformLobbyConfig);
    get camera(): ArcRotateCamera;
    followPlayer(position: Vector3, dt: number, ignoreMeshes?: AbstractMesh[]): void;
    setCameraTarget(target: Vector3): void;
    applyTheme(config: PlatformLobbyConfig): void;
    startRenderLoop(onFrame: () => void): void;
    resize(): void;
    dispose(): void;
}
//# sourceMappingURL=scene-manager.d.ts.map