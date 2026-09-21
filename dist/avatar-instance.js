import { Vector3 as BVector3 } from '@babylonjs/core';
export class AvatarInstance {
    root;
    disposed = false;
    constructor(root) {
        this.root = root;
    }
    /** Wrap an existing factory-built root (TransformNode + metadata.rig). */
    static fromRoot(root) {
        return new AvatarInstance(root);
    }
    get name() {
        return this.root.name;
    }
    get position() {
        return this.root.position;
    }
    get rig() {
        return this.root.metadata?.rig ?? null;
    }
    get animationGroups() {
        const groups = this.root.metadata?.animationGroups;
        return groups?.length ? groups : [];
    }
    /** True when GLB was baked to rigid (no limb animation). */
    get rigidGlb() {
        return !!this.root.metadata?.rigidGlb;
    }
    get isDisposed() {
        return this.disposed || this.root.isDisposed();
    }
    setPosition(position) {
        this.root.position = new BVector3(position.x, position.y, position.z);
    }
    setRotationY(rotationY) {
        const target = this.rig?.visual ?? this.root;
        target.rotation.y = rotationY;
    }
    getChildMeshes(directDescendantsOnly = false) {
        try {
            return this.root.getChildMeshes?.(directDescendantsOnly) ?? [];
        }
        catch {
            return [];
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (!this.root.isDisposed()) {
            this.root.dispose();
        }
    }
}
//# sourceMappingURL=avatar-instance.js.map