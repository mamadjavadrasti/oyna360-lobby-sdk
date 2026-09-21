/**
 * Phase-1 Avatar isolation: thin wrapper around the existing TransformNode + metadata
 * identity. Does not replace AvatarFactory construction pipelines.
 */
import type { AbstractMesh, AnimationGroup, TransformNode, Vector3 } from '@babylonjs/core';
import { Vector3 as BVector3 } from '@babylonjs/core';
import type { AvatarRig } from './avatar-factory';

/** Explicit remote avatar lifecycle (replaces implicit placeholder/loading flags). */
export type RemoteAvatarLifecycle =
  | 'NONE'
  | 'PLACEHOLDER'
  | 'LOADING'
  | 'READY'
  | 'DISPOSED';

export class AvatarInstance {
  private disposed = false;

  private constructor(readonly root: TransformNode) {}

  /** Wrap an existing factory-built root (TransformNode + metadata.rig). */
  static fromRoot(root: TransformNode): AvatarInstance {
    return new AvatarInstance(root);
  }

  get name(): string {
    return this.root.name;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get rig(): AvatarRig | null {
    return (this.root.metadata?.rig as AvatarRig | undefined) ?? null;
  }

  get animationGroups(): AnimationGroup[] {
    const groups = this.root.metadata?.animationGroups as AnimationGroup[] | undefined;
    return groups?.length ? groups : [];
  }

  /** True when GLB was baked to rigid (no limb animation). */
  get rigidGlb(): boolean {
    return !!this.root.metadata?.rigidGlb;
  }

  get isDisposed(): boolean {
    return this.disposed || this.root.isDisposed();
  }

  setPosition(position: { x: number; y: number; z: number }) {
    this.root.position = new BVector3(position.x, position.y, position.z);
  }

  setRotationY(rotationY: number) {
    const target = this.rig?.visual ?? this.root;
    target.rotation.y = rotationY;
  }

  getChildMeshes(directDescendantsOnly = false): AbstractMesh[] {
    try {
      return this.root.getChildMeshes?.(directDescendantsOnly) ?? [];
    } catch {
      return [];
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.root.isDisposed()) {
      this.root.dispose();
    }
  }
}
