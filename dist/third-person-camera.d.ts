import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
export declare class ThirdPersonCamera {
    private scene;
    readonly camera: ArcRotateCamera;
    wantedRadius: number;
    private target;
    private lookX;
    private lookY;
    private dragging;
    private pointerId;
    private lastX;
    private lastY;
    constructor(scene: Scene, canvas: HTMLCanvasElement, options?: {
        distance?: number;
        height?: number;
    });
    /** Mobile look pad: x/y in -1..1 held, or instantaneous deltas via addLookDelta. */
    setLookStick(x: number, y: number): void;
    addLookDelta(dx: number, dy: number): void;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onWheel;
    private clampBeta;
    update(playerPosition: Vector3, dt: number, ignoreMeshes: AbstractMesh[]): void;
    private onContextMenu;
    dispose(canvas: HTMLCanvasElement): void;
}
//# sourceMappingURL=third-person-camera.d.ts.map