/**
 * Phase-1 Avatar isolation: thin wrapper around the existing TransformNode + metadata
 * identity. Does not replace AvatarFactory construction pipelines.
 */
import type { AbstractMesh, AnimationGroup, TransformNode, Vector3 } from '@babylonjs/core';
import type { AvatarRig } from './avatar-factory';
/** Explicit remote avatar lifecycle (replaces implicit placeholder/loading flags). */
export type RemoteAvatarLifecycle = 'NONE' | 'PLACEHOLDER' | 'LOADING' | 'READY' | 'DISPOSED';
export declare class AvatarInstance {
    readonly root: TransformNode;
    private disposed;
    private constructor();
    /** Wrap an existing factory-built root (TransformNode + metadata.rig). */
    static fromRoot(root: TransformNode): AvatarInstance;
    get name(): string;
    get position(): Vector3;
    get rig(): AvatarRig | null;
    get animationGroups(): AnimationGroup[];
    /** True when GLB was baked to rigid (no limb animation). */
    get rigidGlb(): boolean;
    get isDisposed(): boolean;
    setPosition(position: {
        x: number;
        y: number;
        z: number;
    }): void;
    setRotationY(rotationY: number): void;
    getChildMeshes(directDescendantsOnly?: boolean): AbstractMesh[];
    dispose(): void;
}
//# sourceMappingURL=avatar-instance.d.ts.map