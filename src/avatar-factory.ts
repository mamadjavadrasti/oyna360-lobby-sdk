import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3 as BVector3,
} from '@babylonjs/core';
import type { SdkLobbyAvatar } from './platform-types';
import { attachNameTag } from './name-tag';

export interface AvatarRig {
  /** Movable node (collider if present, otherwise visual root). */
  root: TransformNode;
  visual: TransformNode;
  collider: Mesh | null;
  torso: TransformNode;
  head: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
}

const PRESET_LOOKS: Record<string, { bodyColor: string; accentColor: string; pantsColor: string; hairColor: string }> = {
  'default-1': { bodyColor: '#6366f1', accentColor: '#fbbf24', pantsColor: '#1e3a5f', hairColor: '#312e81' },
  'default-2': { bodyColor: '#22c55e', accentColor: '#fde68a', pantsColor: '#14532d', hairColor: '#166534' },
  'default-3': { bodyColor: '#f97316', accentColor: '#fecaca', pantsColor: '#7c2d12', hairColor: '#9a3412' },
  'default-4': { bodyColor: '#64748b', accentColor: '#e2e8f0', pantsColor: '#0f172a', hairColor: '#334155' },
};

function colorFromConfig(value: unknown, fallback: string) {
  return Color3.FromHexString(typeof value === 'string' ? value : fallback);
}

function solid(scene: Scene, id: string, hex: Color3) {
  const m = new StandardMaterial(id, scene);
  m.diffuseColor = hex;
  m.specularColor = new Color3(0.08, 0.08, 0.08);
  return m;
}

function box(
  scene: Scene,
  name: string,
  size: { width: number; height: number; depth: number },
  material: StandardMaterial,
  parent: TransformNode,
  local: { x: number; y: number; z: number },
) {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.material = material;
  mesh.parent = parent;
  mesh.position.set(local.x, local.y, local.z);
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  return mesh;
}

export class AvatarFactory {
  static create(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name = 'avatar',
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body' } = {},
  ): TransformNode {
    const fromPreset = PRESET_LOOKS[avatar.presetKey] ?? PRESET_LOOKS['default-1'];
    const config: Record<string, unknown> = {
      ...fromPreset,
      ...(avatar.customConfig as Record<string, unknown>),
    };

    const shirt = colorFromConfig(config.bodyColor, '#4f46e5');
    const skin = colorFromConfig(config.accentColor, '#fbbf24');
    const pants = colorFromConfig(config.pantsColor, '#1e3a5f');

    const shirtMat = solid(scene, `${name}-shirt-mat`, shirt);
    const skinMat = solid(scene, `${name}-skin-mat`, skin);
    const pantsMat = solid(scene, `${name}-pants-mat`, pants);

    const visual = new TransformNode(`${name}-visual`, scene);

    const torso = new TransformNode(`${name}-torso`, scene);
    torso.parent = visual;
    torso.position.y = 1.18;
    box(scene, `${name}-body`, { width: 0.78, height: 0.82, depth: 0.42 }, shirtMat, torso, { x: 0, y: 0, z: 0 });
    box(scene, `${name}-hip`, { width: 0.62, height: 0.22, depth: 0.36 }, pantsMat, torso, { x: 0, y: -0.48, z: 0 });

    const head = new TransformNode(`${name}-head-pivot`, scene);
    head.parent = visual;
    head.position.y = 1.78;
    box(scene, `${name}-head`, { width: 0.5, height: 0.5, depth: 0.5 }, skinMat, head, { x: 0, y: 0, z: 0 });
    box(scene, `${name}-hair`, { width: 0.54, height: 0.16, depth: 0.54 }, solid(scene, `${name}-hair-mat`, colorFromConfig(config.hairColor, '#1f2937')), head, {
      x: 0,
      y: 0.28,
      z: 0,
    });

    const armL = new TransformNode(`${name}-arm-l`, scene);
    armL.parent = visual;
    armL.position.set(-0.52, 1.48, 0);
    box(scene, `${name}-arm--1`, { width: 0.22, height: 0.78, depth: 0.22 }, shirtMat, armL, { x: 0, y: -0.4, z: 0 });
    box(scene, `${name}-hand--1`, { width: 0.2, height: 0.2, depth: 0.2 }, skinMat, armL, { x: 0, y: -0.82, z: 0 });

    const armR = new TransformNode(`${name}-arm-r`, scene);
    armR.parent = visual;
    armR.position.set(0.52, 1.48, 0);
    box(scene, `${name}-arm-1`, { width: 0.22, height: 0.78, depth: 0.22 }, shirtMat, armR, { x: 0, y: -0.4, z: 0 });
    box(scene, `${name}-hand-1`, { width: 0.2, height: 0.2, depth: 0.2 }, skinMat, armR, { x: 0, y: -0.82, z: 0 });

    const legL = new TransformNode(`${name}-leg-l`, scene);
    legL.parent = visual;
    legL.position.set(-0.18, 0.9, 0);
    box(scene, `${name}-leg--1`, { width: 0.26, height: 0.88, depth: 0.28 }, pantsMat, legL, { x: 0, y: -0.44, z: 0 });

    const legR = new TransformNode(`${name}-leg-r`, scene);
    legR.parent = visual;
    legR.position.set(0.18, 0.9, 0);
    box(scene, `${name}-leg-1`, { width: 0.26, height: 0.88, depth: 0.28 }, pantsMat, legR, { x: 0, y: -0.44, z: 0 });

    attachNameTag(scene, visual, displayName ?? '', username ?? '', name);

    let collider: Mesh | null = null;
    let root: TransformNode = visual;

    if (options.collider === true || options.collider === 'player') {
      collider = MeshBuilder.CreateBox(`${name}-collider`, { width: 0.12, height: 0.12, depth: 0.12 }, scene);
      collider.isVisible = false;
      collider.isPickable = false;
      collider.checkCollisions = true;
      collider.ellipsoid = new BVector3(0.42, 1.05, 0.42);
      collider.ellipsoidOffset = new BVector3(0, 1.05, 0);
      visual.parent = collider;
      visual.position.set(0, 0, 0);
      root = collider;
    } else if (options.collider === 'body') {
      collider = MeshBuilder.CreateBox(`${name}-bodycol`, { width: 0.12, height: 0.12, depth: 0.12 }, scene);
      collider.isVisible = false;
      collider.isPickable = false;
      collider.checkCollisions = false;
      visual.parent = collider;
      visual.position.set(0, 0, 0);
      root = collider;
    }

    root.name = name;
    const rig: AvatarRig = { root, visual, collider, torso, head, armL, armR, legL, legR };
    root.metadata = { ...(root.metadata ?? {}), rig };
    return root;
  }

  static getRig(root: TransformNode): AvatarRig | null {
    return (root.metadata?.rig as AvatarRig | undefined) ?? null;
  }

  static setPosition(root: TransformNode, position: { x: number; y: number; z: number }) {
    root.position = new BVector3(position.x, position.y, position.z);
  }

  static setRotationY(root: TransformNode, rotationY: number) {
    const rig = AvatarFactory.getRig(root);
    const target = rig?.visual ?? root;
    target.rotation.y = rotationY;
  }
}
