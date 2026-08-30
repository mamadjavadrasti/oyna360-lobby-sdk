import { ArcRotateCamera, Ray, Vector3 } from '@babylonjs/core';
export class ThirdPersonCamera {
    scene;
    camera;
    wantedRadius;
    target = new Vector3(0, 1.6, 0);
    lookX = 0;
    lookY = 0;
    dragging = false;
    pointerId = -1;
    lastX = 0;
    lastY = 0;
    constructor(scene, canvas, options = {}) {
        this.scene = scene;
        const distance = options.distance ?? 9.5;
        const worldHeight = options.height && options.height >= 2 ? options.height : 5;
        this.wantedRadius = distance;
        const yOff = Math.max(1.4, worldHeight - 1.65);
        const beta = Math.acos(Math.min(0.82, Math.max(0.18, yOff / distance)));
        this.camera = new ArcRotateCamera('camera', Math.PI, beta, distance, this.target.clone(), scene);
        this.camera.lowerRadiusLimit = 1.6;
        this.camera.upperRadiusLimit = 16;
        this.camera.lowerBetaLimit = 0.35;
        this.camera.upperBetaLimit = 1.42;
        this.camera.panningSensibility = 0;
        this.camera.inertia = 0;
        this.camera.inputs.clear();
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('pointercancel', this.onPointerUp);
        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        canvas.addEventListener('contextmenu', this.onContextMenu);
    }
    /** Mobile look pad: x/y in -1..1 held, or instantaneous deltas via addLookDelta. */
    setLookStick(x, y) {
        this.lookX = Math.abs(x) < 0.06 ? 0 : x;
        this.lookY = Math.abs(y) < 0.06 ? 0 : y;
    }
    addLookDelta(dx, dy) {
        this.camera.alpha -= dx * 0.0055;
        this.camera.beta += dy * 0.0042;
        this.clampBeta();
    }
    onPointerDown = (e) => {
        if (e.button !== 0 && e.button !== 2)
            return;
        this.dragging = true;
        this.pointerId = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        e.target?.setPointerCapture?.(e.pointerId);
    };
    onPointerMove = (e) => {
        if (!this.dragging || e.pointerId !== this.pointerId)
            return;
        this.addLookDelta(e.clientX - this.lastX, e.clientY - this.lastY);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    };
    onPointerUp = (e) => {
        if (e.pointerId !== this.pointerId)
            return;
        this.dragging = false;
        this.pointerId = -1;
    };
    onWheel = (e) => {
        e.preventDefault();
        this.wantedRadius = Math.min(16, Math.max(4, this.wantedRadius + Math.sign(e.deltaY) * 0.7));
    };
    clampBeta() {
        this.camera.beta = Math.min(this.camera.upperBetaLimit ?? 1.42, Math.max(this.camera.lowerBetaLimit ?? 0.35, this.camera.beta));
    }
    update(playerPosition, dt, ignoreMeshes) {
        if (this.lookX || this.lookY) {
            this.camera.alpha -= this.lookX * 2.4 * dt;
            this.camera.beta += this.lookY * 1.8 * dt;
            this.clampBeta();
        }
        const desired = new Vector3(playerPosition.x, playerPosition.y + 1.65, playerPosition.z);
        const follow = 1 - Math.exp(-8 * dt);
        this.target.x += (desired.x - this.target.x) * follow;
        this.target.y += (desired.y - this.target.y) * follow;
        this.target.z += (desired.z - this.target.z) * follow;
        this.camera.setTarget(this.target);
        const skip = new Set(ignoreMeshes);
        const dir = this.camera.position.subtract(this.target);
        if (dir.lengthSquared() < 0.01)
            return;
        const desiredLen = this.wantedRadius;
        dir.normalize();
        const ray = new Ray(this.target, dir, desiredLen);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            if (!mesh || skip.has(mesh) || !mesh.checkCollisions)
                return false;
            if (mesh.name.startsWith('local-player') || mesh.name.includes('nametag') || mesh.name.includes('-sign')) {
                return false;
            }
            if (mesh.name.includes('-rail-'))
                return false;
            return mesh.isPickable;
        });
        const blocked = hit?.hit && hit.distance < desiredLen;
        const goal = blocked ? Math.max(1.6, hit.distance - 0.4) : desiredLen;
        const zoom = 1 - Math.exp(-(blocked ? 18 : 6) * dt);
        this.camera.radius += (goal - this.camera.radius) * zoom;
    }
    onContextMenu = (e) => {
        e.preventDefault();
    };
    dispose(canvas) {
        canvas.removeEventListener('pointerdown', this.onPointerDown);
        canvas.removeEventListener('pointermove', this.onPointerMove);
        canvas.removeEventListener('pointerup', this.onPointerUp);
        canvas.removeEventListener('pointercancel', this.onPointerUp);
        canvas.removeEventListener('wheel', this.onWheel);
        canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
}
//# sourceMappingURL=third-person-camera.js.map