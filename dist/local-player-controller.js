import { Vector3 } from '@babylonjs/core';
export class LocalPlayerController {
    root;
    keys = new Set();
    position;
    rotationY = 0;
    animation = 'idle';
    speed;
    runMultiplier;
    disposed = false;
    constructor(root, spawn, config = {}) {
        this.root = root;
        this.position = { ...spawn };
        this.speed = config.playerSpeed ?? 4;
        this.runMultiplier = config.runMultiplier ?? 1.6;
        this.syncTransform();
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }
    onKeyDown = (e) => {
        this.keys.add(e.key.toLowerCase());
    };
    onKeyUp = (e) => {
        this.keys.delete(e.key.toLowerCase());
    };
    update(dt) {
        if (this.disposed)
            return { position: this.position, rotationY: this.rotationY, animation: this.animation };
        let dx = 0;
        let dz = 0;
        if (this.keys.has('w') || this.keys.has('arrowup'))
            dz += 1;
        if (this.keys.has('s') || this.keys.has('arrowdown'))
            dz -= 1;
        if (this.keys.has('a') || this.keys.has('arrowleft'))
            dx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright'))
            dx += 1;
        const running = this.keys.has('shift');
        const moveSpeed = this.speed * (running ? this.runMultiplier : 1);
        if (dx !== 0 || dz !== 0) {
            const len = Math.hypot(dx, dz);
            dx /= len;
            dz /= len;
            this.position.x += dx * moveSpeed * dt;
            this.position.z += dz * moveSpeed * dt;
            this.rotationY = Math.atan2(dx, dz);
            this.animation = running ? 'run' : 'walk';
        }
        else {
            this.animation = 'idle';
        }
        this.position.y = 0;
        this.syncTransform();
        return {
            position: { ...this.position },
            rotationY: this.rotationY,
            animation: this.animation,
        };
    }
    getState() {
        return {
            position: { ...this.position },
            rotationY: this.rotationY,
            animation: this.animation,
        };
    }
    setPosition(pos) {
        this.position = { ...pos };
        this.syncTransform();
    }
    syncTransform() {
        this.root.position = new Vector3(this.position.x, this.position.y, this.position.z);
        this.root.rotation.y = this.rotationY;
    }
    dispose() {
        this.disposed = true;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }
}
//# sourceMappingURL=local-player-controller.js.map