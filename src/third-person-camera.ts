import { ArcRotateCamera, Ray, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';

/** Keep the lens above the floor so near-plane clipping never paints the whole frame black. */
const MIN_CAMERA_Y = 0.55;
/** Floor for occlusion pull-in; game tuning may raise lowerRadiusLimit further. */
const DEFAULT_MIN_RADIUS = 2.2;
/** Pull back from the hit surface so the near plane stays outside the mesh. */
const OCCLUSION_CLEARANCE = 0.55;

export class ThirdPersonCamera {
  readonly camera: ArcRotateCamera;
  wantedRadius: number;
  private target = new Vector3(0, 1.6, 0);
  private lookX = 0;
  private lookY = 0;
  private dragging = false;
  private pointerId = -1;
  private lastX = 0;
  private lastY = 0;
  private readonly desiredTarget = new Vector3();
  private readonly camDir = new Vector3();
  private readonly occlusionRay = new Ray(Vector3.Zero(), Vector3.Forward(), 1);
  private ignoreSet = new Set<AbstractMesh>();

  constructor(
    private scene: Scene,
    canvas: HTMLCanvasElement,
    options: { distance?: number; height?: number } = {},
  ) {
    const distance = options.distance ?? 9.5;
    const worldHeight = options.height && options.height >= 2 ? options.height : 5;
    this.wantedRadius = distance;
    const yOff = Math.max(1.4, worldHeight - 1.65);
    const beta = Math.acos(Math.min(0.82, Math.max(0.18, yOff / distance)));

    this.camera = new ArcRotateCamera('camera', Math.PI, beta, distance, this.target.clone(), scene);
    this.camera.lowerRadiusLimit = DEFAULT_MIN_RADIUS;
    this.camera.upperRadiusLimit = 16;
    // beta≈0 top-down, β=π/2 horizon, β>π/2 looks up at the sky.
    this.camera.lowerBetaLimit = 0.28;
    this.camera.upperBetaLimit = 1.72;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 800;
    this.camera.panningSensibility = 0;
    this.camera.inertia = 0;
    this.camera.inputs.clear();

    // pointerdown on canvas; move/up on window so look still works inside cross-origin iframes
    // where setPointerCapture is flaky and move events miss the canvas.
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private minRadius(): number {
    return Math.max(DEFAULT_MIN_RADIUS, this.camera.lowerRadiusLimit ?? DEFAULT_MIN_RADIUS);
  }

  /** Mobile look pad: x/y in -1..1 held, or instantaneous deltas via addLookDelta. */
  setLookStick(x: number, y: number) {
    this.lookX = Math.abs(x) < 0.06 ? 0 : x;
    this.lookY = Math.abs(y) < 0.06 ? 0 : y;
  }

  addLookDelta(dx: number, dy: number) {
    this.camera.alpha -= dx * 0.0055;
    this.camera.beta += dy * 0.0042;
    this.clampBeta();
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    try {
      (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore — window-level move/up still drives look
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.addLookDelta(e.clientX - this.lastX, e.clientY - this.lastY);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = -1;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const min = Math.max(this.minRadius(), 3.2);
    this.wantedRadius = Math.min(16, Math.max(min, this.wantedRadius + Math.sign(e.deltaY) * 0.7));
  };

  private clampBeta() {
    const lo = this.camera.lowerBetaLimit ?? 0.28;
    const hi = this.camera.upperBetaLimit ?? 1.72;
    let beta = Math.min(hi, Math.max(lo, this.camera.beta));

    // Soft floor: don't tip so far under the horizon that the lens clips underground.
    const radius = Math.max(this.camera.radius, this.minRadius());
    const minCos = (MIN_CAMERA_Y - this.target.y) / radius;
    if (minCos > -1 && minCos < 1) {
      const maxBeta = Math.acos(minCos);
      if (beta > maxBeta) beta = maxBeta;
    }

    this.camera.beta = beta;
  }

  update(playerPosition: Vector3, dt: number, ignoreMeshes: AbstractMesh[]) {
    if (this.lookX || this.lookY) {
      this.camera.alpha -= this.lookX * 2.4 * dt;
      this.camera.beta += this.lookY * 1.8 * dt;
      this.clampBeta();
    }

    this.desiredTarget.set(playerPosition.x, playerPosition.y + 1.65, playerPosition.z);
    const follow = 1 - Math.exp(-8 * dt);
    this.target.x += (this.desiredTarget.x - this.target.x) * follow;
    this.target.y += (this.desiredTarget.y - this.target.y) * follow;
    this.target.z += (this.desiredTarget.z - this.target.z) * follow;
    this.camera.setTarget(this.target);

    this.ignoreSet.clear();
    for (let i = 0; i < ignoreMeshes.length; i++) this.ignoreSet.add(ignoreMeshes[i]);

    this.camera.position.subtractToRef(this.target, this.camDir);
    if (this.camDir.lengthSquared() < 0.01) return;
    const desiredLen = this.wantedRadius;
    this.camDir.normalize();
    this.occlusionRay.origin.copyFrom(this.target);
    this.occlusionRay.direction.copyFrom(this.camDir);
    this.occlusionRay.length = desiredLen;
    const skip = this.ignoreSet;
    const hit = this.scene.pickWithRay(this.occlusionRay, (mesh) => {
      if (!mesh || skip.has(mesh) || !mesh.checkCollisions) return false;
      if (mesh.name.startsWith('local-player') || mesh.name.includes('nametag') || mesh.name.includes('-sign')) {
        return false;
      }
      if (mesh.name.includes('-rail-')) return false;
      if (
        mesh.name === 'ground' ||
        mesh.name === 'grass-ground' ||
        mesh.name === 'spawn-plaza' ||
        mesh.name.startsWith('path-') ||
        mesh.name.includes('plaza')
      ) {
        return false;
      }
      return mesh.isPickable;
    });

    const minR = this.minRadius();
    const blocked = hit?.hit && typeof hit.distance === 'number' && hit.distance < desiredLen;
    let goal = desiredLen;
    if (blocked && hit?.distance != null) {
      goal = Math.max(minR, hit.distance - OCCLUSION_CLEARANCE);
    }

    if (blocked) {
      const zoom = 1 - Math.exp(-18 * dt);
      this.camera.radius += (goal - this.camera.radius) * zoom;
    } else {
      // Snap to the wanted orbit when the view is clear — avoids stuck far cameras
      // after limits/tuning changes (lerp alone could fight other writers).
      this.camera.radius = desiredLen;
    }
    if (this.camera.radius < minR) this.camera.radius = minR;

    this.clampBeta();
  }

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  dispose(canvas: HTMLCanvasElement) {
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
