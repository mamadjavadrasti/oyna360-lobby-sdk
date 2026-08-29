import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { PlatformLobby } from '../platform-lobby';
import type { Vector3 as Vec3 } from '../types';

/** Southwest grass — visible from the plaza, not on a portal spoke. */
export const SLIDE_ANCHOR: Vec3 = { x: -22, y: 0, z: -12 };
export const SLIDE_YAW = Math.atan2(SLIDE_ANCHOR.x, SLIDE_ANCHOR.z);

export function slideLocalToWorld(local: Vec3): Vec3 {
  const c = Math.cos(SLIDE_YAW);
  const s = Math.sin(SLIDE_YAW);
  return {
    x: SLIDE_ANCHOR.x + local.x * c + local.z * s,
    y: local.y,
    z: SLIDE_ANCHOR.z - local.x * s + local.z * c,
  };
}

function mat(scene: Scene, id: string, hex: string, emissive = 0, alpha = 1) {
  const m = new StandardMaterial(id, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.06, 0.06, 0.06);
  if (emissive > 0) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  if (alpha < 1) {
    m.alpha = alpha;
    m.transparencyMode = 2;
  }
  return m;
}

function bezier3(t: number, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3) {
  const u = 1 - t;
  return p0
    .scale(u * u * u)
    .add(p1.scale(3 * u * u * t))
    .add(p2.scale(3 * u * t * t))
    .add(p3.scale(t * t * t));
}

/** Local-space centerline of the chute (sit height). */
export function slideLocalPath(): Vec3[] {
  const p0 = new Vector3(0, 4.18, 0.95);
  const p1 = new Vector3(0, 3.55, 2.65);
  const p2 = new Vector3(0, 1.15, 6.15);
  const p3 = new Vector3(0, 0.1, 9.4);
  const pts: Vec3[] = [];
  for (let i = 0; i <= 24; i++) {
    const p = bezier3(i / 24, p0, p1, p2, p3);
    pts.push({ x: p.x, y: p.y, z: p.z });
  }
  return pts;
}

export function buildSlidePath(): Vec3[] {
  return slideLocalPath().map(slideLocalToWorld);
}

/** Next to the slide landing, out on the grass — clear of every room pad. */
export const TRAMPOLINE_ANCHOR: Vec3 = { x: -31, y: 0, z: -11 };

export function buildPlayground(scene: Scene, lobby: PlatformLobby) {
  buildSlide(scene, lobby);
  buildTrampoline(scene, lobby);
}

function solidMesh(mesh: { checkCollisions: boolean; isPickable: boolean }, walkable = false) {
  mesh.checkCollisions = true;
  mesh.isPickable = walkable;
}

function buildSlide(scene: Scene, lobby: PlatformLobby) {
  const root = new TransformNode('playground-slide-root', scene);
  root.position = new Vector3(SLIDE_ANCHOR.x, 0, SLIDE_ANCHOR.z);
  root.rotation.y = SLIDE_YAW;

  const orange = mat(scene, 'pg-slide-orange-mat', '#f97316', 0.04);
  const yellow = mat(scene, 'pg-slide-yellow-mat', '#fbbf24', 0.03);
  const white = mat(scene, 'pg-slide-white-mat', '#f8fafc', 0.02);
  const steel = mat(scene, 'pg-slide-steel-mat', '#334155', 0.01);

  const deck = MeshBuilder.CreateBox('playground-slide-deck', { width: 2.45, height: 0.2, depth: 2.2 }, scene);
  deck.parent = root;
  deck.position.set(0, 4.1, 0);
  deck.material = yellow;
  solidMesh(deck, true);

  const skirt = MeshBuilder.CreateBox('playground-slide-skirt', { width: 2.5, height: 0.55, depth: 2.25 }, scene);
  skirt.parent = root;
  skirt.position.set(0, 3.78, 0);
  skirt.material = orange;

  const stepCount = 10;
  const run = 0.42;
  const topZ = -1.05;
  const bottomZ = topZ - (stepCount - 1) * run;
  const topY = 4.12;
  const bottomY = 0.06;
  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);
    const step = MeshBuilder.CreateBox(`playground-slide-step-${i}`, { width: 1.55, height: 0.12, depth: 0.4 }, scene);
    step.parent = root;
    step.position.set(0, bottomY + (topY - bottomY) * t, bottomZ + i * run);
    step.material = i % 2 ? yellow : orange;
    step.checkCollisions = false;
    step.isPickable = false;
  }

  const ramp = createStairWalkRamp(scene, bottomY, topY, bottomZ, topZ);
  ramp.parent = root;
  solidMesh(ramp, true);
  ramp.checkCollisions = false;

  const stairRise = topY - bottomY;
  const stairRun = topZ - bottomZ;
  const stairHyp = Math.hypot(stairRun, stairRise);
  const stairPitch = Math.atan2(stairRise, stairRun);

  const railH = 0.72;
  for (const side of [-1, 1] as const) {
    const deckRail = MeshBuilder.CreateBox(`playground-slide-deck-rail-${side}`, { width: 0.1, height: railH, depth: 2.05 }, scene);
    deckRail.parent = root;
    deckRail.position.set(side * 1.18, 4.46, -0.05);
    deckRail.material = white;
    solidMesh(deckRail);

    const chuteRail = MeshBuilder.CreateBox(`playground-slide-front-rail-${side}`, { width: 0.42, height: railH, depth: 0.1 }, scene);
    chuteRail.parent = root;
    chuteRail.position.set(side * 0.98, 4.46, 1.05);
    chuteRail.material = white;
    solidMesh(chuteRail);

    const stairRail = MeshBuilder.CreateCylinder(
      `playground-slide-stair-rail-${side}`,
      { diameter: 0.09, height: stairHyp, tessellation: 8 },
      scene,
    );
    stairRail.parent = root;
    stairRail.position.set(side * 0.82, (bottomY + topY) / 2 + 0.42, (bottomZ + topZ) / 2);
    stairRail.rotation.x = stairPitch;
    stairRail.material = white;
    solidMesh(stairRail);
  }

  const chute = createSlideChute(scene);
  chute.parent = root;
  chute.material = orange;
  solidMesh(chute);

  for (const side of [-1, 1] as const) {
    const lip = MeshBuilder.CreateBox(`playground-slide-lip-${side}`, { width: 0.14, height: 0.28, depth: 0.55 }, scene);
    lip.parent = root;
    lip.position.set(side * 0.92, 4.28, 0.95);
    lip.material = orange;
    solidMesh(lip);
  }

  const legs: Array<[number, number, number, number]> = [
    [-1.05, 2.05, -0.85, 4.1],
    [1.05, 2.05, -0.85, 4.1],
    [-1.05, 2.05, 0.85, 4.1],
    [1.05, 2.05, 0.85, 4.1],
    [0, 1.15, 4.35, 2.3],
    [0, 0.55, 7.15, 1.1],
  ];
  legs.forEach(([x, y, z, h], i) => {
    const leg = MeshBuilder.CreateCylinder(`playground-slide-leg-${i}`, { diameter: 0.16, height: h, tessellation: 8 }, scene);
    leg.parent = root;
    leg.position.set(x, y, z);
    leg.material = steel;
    solidMesh(leg);
  });

  const brace = MeshBuilder.CreateBox('playground-slide-brace', { width: 2.15, height: 0.08, depth: 0.1 }, scene);
  brace.parent = root;
  brace.position.set(0, 1.35, 0);
  brace.material = steel;

  const landing = MeshBuilder.CreateBox('playground-slide-landing', { width: 2.4, height: 0.1, depth: 1.7 }, scene);
  landing.parent = root;
  landing.position.set(0, 0.05, 9.55);
  landing.material = yellow;
  solidMesh(landing, true);

  for (const [x, y, z] of [
    [-1.15, 4.52, -1.0],
    [1.15, 4.52, -1.0],
    [-1.15, 4.52, 0.9],
    [1.15, 4.52, 0.9],
  ] as const) {
    const bolt = MeshBuilder.CreateSphere(`playground-slide-bolt-${x}-${z}`, { diameter: 0.09, segments: 4 }, scene);
    bolt.parent = root;
    bolt.position.set(x, y, z);
    bolt.material = steel;
  }

  const sign = playgroundLabel(scene, 'playground-slide-sign', 'سرسره!', '#ea580c');
  sign.parent = root;
  sign.position.set(0, 5.05, 0);
  sign.billboardMode = Mesh.BILLBOARDMODE_Y;

  const lip = slideLocalToWorld({ x: 0, y: 4.2, z: 0.35 });
  lobby.addZone({
    id: 'playground-slide-prompt',
    bounds: {
      min: { x: lip.x - 1.25, y: 3.4, z: lip.z - 1.25 },
      max: { x: lip.x + 1.25, y: 5.6, z: lip.z + 1.25 },
    },
  });
}

function createStairWalkRamp(scene: Scene, bottomY: number, topY: number, bottomZ: number, topZ: number) {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  const samples = 20;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = bottomY + (topY - bottomY) * t;
    const z = bottomZ + (topZ - bottomZ) * t;
    left.push(new Vector3(-0.78, y, z));
    right.push(new Vector3(0.78, y, z));
  }
  const ramp = MeshBuilder.CreateRibbon(
    'playground-slide-stair-ramp',
    { pathArray: [left, right], closeArray: false, closePath: false, updatable: false, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  ramp.isVisible = false;
  ramp.isPickable = true;
  return ramp;
}

function createSlideChute(scene: Scene) {
  const p0 = new Vector3(0, 4.12, 0.85);
  const p1 = new Vector3(0, 3.5, 2.6);
  const p2 = new Vector3(0, 1.1, 6.1);
  const p3 = new Vector3(0, 0.06, 9.35);
  const samples = 22;
  const halfW = 0.88;
  const wallH = 0.36;
  const dip = 0.08;
  const offsets: Array<[number, number]> = [
    [-halfW, wallH],
    [-halfW, 0.03],
    [-halfW * 0.4, -dip],
    [0, -dip],
    [halfW * 0.4, -dip],
    [halfW, 0.03],
    [halfW, wallH],
  ];
  const pathArray = offsets.map(() => [] as Vector3[]);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = bezier3(t, p0, p1, p2, p3);
    const q = bezier3(Math.min(1, t + 0.03), p0, p1, p2, p3);
    const tangent = q.subtract(p);
    if (tangent.lengthSquared() < 1e-8) tangent.set(0, -0.2, 1);
    tangent.normalize();
    let right = Vector3.Cross(tangent, Vector3.Up());
    if (right.lengthSquared() < 1e-6) right = Vector3.Cross(tangent, new Vector3(1, 0, 0));
    right.normalize();
    const up = Vector3.Cross(right, tangent).normalize();
    offsets.forEach(([u, v], k) => {
      pathArray[k].push(p.add(right.scale(u)).add(up.scale(v)));
    });
  }

  const chute = MeshBuilder.CreateRibbon(
    'playground-slide-bed',
    { pathArray, closeArray: false, closePath: false, updatable: false, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  return chute;
}

function playgroundLabel(scene: Scene, id: string, text: string, color: string) {
  const plane = MeshBuilder.CreatePlane(id, { width: 2.2, height: 0.62 }, scene);
  const tex = new DynamicTexture(`${id}-tex`, { width: 512, height: 128 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.beginPath();
  const rx = 24;
  const ry = 20;
  const rw = 464;
  const rh = 88;
  const rr = 22;
  ctx.moveTo(rx + rr, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
  ctx.arcTo(rx, ry + rh, rx, ry, rr);
  ctx.arcTo(rx, ry, rx + rw, ry, rr);
  ctx.closePath();
  ctx.fill();
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px Tahoma, Arial';
  ctx.fillText(text, 256, 64);
  tex.update();
  const m = new StandardMaterial(`${id}-mat`, scene);
  m.diffuseTexture = tex;
  m.opacityTexture = tex;
  m.emissiveColor = Color3.White();
  m.disableLighting = true;
  m.useAlphaFromDiffuseTexture = true;
  m.transparencyMode = 2;
  m.backFaceCulling = false;
  plane.material = m;
  plane.isPickable = false;
  plane.checkCollisions = false;
  return plane;
}

function buildTrampoline(scene: Scene, lobby: PlatformLobby) {
  const { x, z } = TRAMPOLINE_ANCHOR;
  const root = new TransformNode('playground-trampoline-root', scene);
  root.position = new Vector3(x, 0, z);

  const base = MeshBuilder.CreateCylinder('playground-trampoline-base', { diameter: 4.6, height: 0.35, tessellation: 24 }, scene);
  base.parent = root;
  base.position.y = 0.18;
  base.material = mat(scene, 'pg-tramp-base-mat', '#1e293b', 0.15);

  const pad = MeshBuilder.CreateCylinder('playground-trampoline-pad', { diameter: 3.5, height: 0.22, tessellation: 32 }, scene);
  pad.parent = root;
  pad.position.y = 0.38;
  pad.material = mat(scene, 'pg-tramp-pad-mat', '#22d3ee', 0.55);

  const ring = MeshBuilder.CreateTorus('playground-trampoline-ring', { diameter: 3.9, thickness: 0.18, tessellation: 32 }, scene);
  ring.parent = root;
  ring.position.y = 0.42;
  ring.rotation.x = Math.PI / 2;
  ring.material = mat(scene, 'pg-tramp-ring-mat', '#a855f7', 0.85);

  const innerRing = MeshBuilder.CreateTorus('playground-trampoline-ring-inner', { diameter: 2.4, thickness: 0.08, tessellation: 24 }, scene);
  innerRing.parent = root;
  innerRing.position.y = 0.44;
  innerRing.rotation.x = Math.PI / 2;
  innerRing.material = mat(scene, 'pg-tramp-ring-inner-mat', '#34d399', 0.75);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const orb = MeshBuilder.CreateSphere(`playground-trampoline-orb-${i}`, { diameter: 0.28, segments: 6 }, scene);
    orb.parent = root;
    orb.position.set(Math.sin(a) * 1.95, 0.55, Math.cos(a) * 1.95);
    orb.material = mat(scene, `pg-tramp-orb-mat-${i}`, i % 2 ? '#f472b6' : '#60a5fa', 0.9);
  }

  const light = new PointLight('playground-trampoline-light', new Vector3(0, 2.2, 0), scene);
  light.parent = root;
  light.diffuse = Color3.FromHexString('#22d3ee');
  light.intensity = 0.9;
  light.range = 11;

  const sign = playgroundLabel(scene, 'playground-trampoline-sign', 'ترامپولین!', '#06b6d4');
  sign.parent = root;
  sign.position.set(0, 2.35, 0);
  sign.billboardMode = Mesh.BILLBOARDMODE_Y;

  lobby.addZone({
    id: 'playground-trampoline',
    bounds: {
      min: { x: x - 2.0, y: 0, z: z - 2.0 },
      max: { x: x + 2.0, y: 4, z: z + 2.0 },
    },
  });
}
