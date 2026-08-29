import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';
import type { PlatformLobbyConfig } from './types';
export declare class SceneManager {
    readonly engine: Engine;
    readonly scene: Scene;
    readonly camera: ArcRotateCamera;
    private groundMaterial;
    private readonly cameraDistance;
    private readonly cameraHeight;
    constructor(canvas: HTMLCanvasElement, config?: PlatformLobbyConfig);
    followPlayer(position: Vector3, rotationY: number): void;
    setCameraTarget(target: Vector3): void;
    applyTheme(config: PlatformLobbyConfig): void;
    startRenderLoop(onFrame: () => void): void;
    resize(): void;
    dispose(): void;
}
//# sourceMappingURL=scene-manager.d.ts.map