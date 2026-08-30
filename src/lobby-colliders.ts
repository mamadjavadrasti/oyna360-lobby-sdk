import { MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';

/** Visuals the player should walk over / through (floors, signs, portal rings). */
function isWalkThroughVisual(name: string) {
  if (!name || name.includes('nametag') || name.includes('-sign')) return true;
  if (name === 'local-player') return false;
  if (name.startsWith('local-player')) return true;
  if (/^path-\d+$/.test(name)) return true;
  return [
    'room-portal-',
    'room-veil-',
    'room-sign-',
    'room-orbit-',
    'room-track-',
    'room-pad-',
    'room-inner-',
    'room-spire-',
    'plaza-pavement',
    'plaza-ring',
    'plaza-center',
    'grass-ground',
    'fountain-water',
    'fountain-bowl',
    'fountain-base',
    'fountain-column',
    'shop-window-',
    'shop-sign-',
    'shop-roof-',
    'path-curb-',
    'edge-tile-',
    'grid-floor',
    'spawn-plaza',
    'zone-',
    'portal-',
    'lamp-bulb-',
    'playground-slide-sign',
    'playground-trampoline-sign',
    'playground-slide-bolt-',
    'playground-slide-skirt',
    'playground-slide-brace',
    'playground-trampoline-ring',
    'playground-trampoline-ring-inner',
    'playground-trampoline-orb-',
    'playground-trampoline-base',
  ].some((p) => name === p || name.startsWith(p));
}

function ghostMaterial(scene: Scene) {
  let mat = scene.getMaterialByName('lobby-phys-ghost') as StandardMaterial | null;
  if (!mat) {
    mat = new StandardMaterial('lobby-phys-ghost', scene);
    mat.alpha = 0;
    mat.disableDepthWrite = true;
    mat.backFaceCulling = false;
  }
  return mat;
}

function stampCollider(mesh: AbstractMesh, scene: Scene) {
  mesh.material = ghostMaterial(scene);
  mesh.visibility = 0;
  mesh.isVisible = true;
  mesh.isPickable = true;
  mesh.checkCollisions = true;
}

function ensureCylinder(
  scene: Scene,
  name: string,
  x: number,
  z: number,
  diameter: number,
  height: number,
  y: number,
) {
  let block = scene.getMeshByName(name);
  if (!block) {
    block = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 12 }, scene);
  }
  block.position.set(x, y, z);
  stampCollider(block, scene);
  return block;
}

function ensureBox(
  scene: Scene,
  name: string,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotationY: number,
) {
  let block = scene.getMeshByName(name);
  if (!block) {
    block = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  }
  block.position.set(x, y, z);
  block.rotation.y = rotationY;
  stampCollider(block, scene);
  return block;
}

function abs(mesh: AbstractMesh) {
  mesh.computeWorldMatrix(true);
  return mesh.getAbsolutePosition();
}

function yawOf(mesh: AbstractMesh) {
  mesh.computeWorldMatrix(true);
  const q = mesh.absoluteRotationQuaternion;
  if (q) return q.toEulerAngles().y;
  return mesh.rotation.y;
}

function localDepth(mesh: AbstractMesh) {
  mesh.computeWorldMatrix(true);
  return Math.max(mesh.getBoundingInfo().boundingBox.extendSize.z * 2, 1.6);
}

export function syncCharacterObstacle(scene: Scene, rootName: string, x: number, z: number) {
  ensureCylinder(scene, `${rootName}-charcol`, x, z, 0.95, 1.95, 0.97);
}

export function removeCharacterObstacle(scene: Scene, rootName: string) {
  scene.getMeshByName(`${rootName}-charcol`)?.dispose();
}

/**
 * Invisible world-space colliders for every lobby prop.
 * Thin floors stay walk-through so the capsule does not hop; tall proxies block walking through objects.
 */
export function applyLobbyCollisions(scene: Scene) {
  scene.collisionsEnabled = true;

  ensureCylinder(scene, 'fountain-blocker', 0, 0, 5.1, 2.8, 1.4);

  const snapshot = [...scene.meshes];
  for (const mesh of snapshot) {
    mesh.computeWorldMatrix(true);
  }

  for (const mesh of snapshot) {
    const n = mesh.name;
    const p = abs(mesh);

    if (/^path-\d+$/.test(n)) {
      const yaw = yawOf(mesh);
      const depth = localDepth(mesh);
      const sx = Math.cos(yaw);
      const sz = -Math.sin(yaw);
      for (const [side, s] of [
        ['L', -1],
        ['R', 1],
      ] as const) {
        ensureBox(
          scene,
          `${n}-rail-${side}`,
          p.x + sx * s * 1.32,
          0.95,
          p.z + sz * s * 1.32,
          0.62,
          1.9,
          depth,
          yaw,
        );
      }
    }
    if (/^tree-\d+$/.test(n)) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 2.4, 3.4, 1.7);
    }
    if (/^bush-\d+$/.test(n)) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 1.25, 1.2, 0.6);
    }
    if (n.startsWith('shop-building-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 6.0, 3.8, 1.9);
    }
    if (n.startsWith('lamp-pole-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 0.62, 3.5, 1.75);
    }
    if (n.startsWith('rock-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 1.2, 1.05, 0.52);
    }
    if (/^bench-\d+$/.test(n)) {
      ensureBox(scene, `${n}-phys`, p.x, 0.55, p.z, 1.8, 1.1, 0.7, yawOf(mesh));
    }
    if (n.startsWith('room-col-') || n.startsWith('room-dual-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 0.8, 2.9, 1.45);
    }
    if (n.startsWith('room-goo-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 1.35, 1.3, 0.65);
    }
    if (n.startsWith('room-ice-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 1.45, 1.65, 0.82);
    }
    if (/^pillar-\d+$/.test(n)) {
      ensureBox(scene, `${n}-phys`, p.x, 2, p.z, 1.5, 4.2, 1.5, 0);
    }
    if (n.startsWith('playground-slide-leg-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 0.42, 2.8, p.y);
    }
    if (n.startsWith('playground-slide-deck-rail-') || n.startsWith('playground-slide-stair-rail-')) {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 0.28, 1.4, p.y);
    }
    if (n === 'playground-trampoline-base') {
      ensureCylinder(scene, `${n}-phys`, p.x, p.z, 4.8, 0.8, 0.4);
    }
    if (n.endsWith('-bodycol')) {
      const rootName = n.slice(0, -'-bodycol'.length);
      if (!rootName.startsWith('remote-') && !rootName.startsWith('local-player')) {
        syncCharacterObstacle(scene, rootName, p.x, p.z);
      }
    }
  }

  for (const mesh of scene.meshes) {
    const n = mesh.name;
    if (n === 'ground' || n === 'local-player') {
      mesh.checkCollisions = true;
      continue;
    }
    if (n.endsWith('-phys') || n.endsWith('-charcol') || n.includes('-rail-') || n === 'fountain-blocker') {
      stampCollider(mesh, scene);
      continue;
    }
    if (isWalkThroughVisual(n) || n.endsWith('-bodycol')) {
      mesh.checkCollisions = false;
    }
    if (
      n === 'ground' ||
      n === 'grass-ground' ||
      n === 'plaza-pavement' ||
      /^path-\d+$/.test(n) ||
      n === 'playground-slide-deck' ||
      n === 'playground-slide-landing' ||
      n === 'playground-slide-stair-ramp' ||
      n === 'playground-slide-bed' ||
      n === 'playground-trampoline-pad' ||
      n.startsWith('playground-slide-step-') ||
      n.startsWith('room-pad-') ||
      n.startsWith('room-inner-')
    ) {
      mesh.isPickable = true;
    }
  }

  const ground = scene.getMeshByName('ground');
  if (ground) {
    ground.checkCollisions = true;
    ground.isPickable = true;
    ground.isVisible = true;
    ground.visibility = 1;
  }
}

export function isSolidLobbyMesh(mesh: AbstractMesh) {
  const n = mesh.name;
  if (!n || isWalkThroughVisual(n)) return false;
  return (
    n === 'ground' ||
    n === 'fountain-blocker' ||
    n.endsWith('-phys') ||
    n.endsWith('-charcol') ||
    n.includes('-rail-')
  );
}
