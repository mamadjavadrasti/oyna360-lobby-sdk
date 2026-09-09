import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3 as BVector3,
} from '@babylonjs/core';
import type { AnimationGroup, AbstractMesh } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
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

function resolveGlbUrl(avatar: SdkLobbyAvatar): string | null {
  if (avatar.presetKind !== 'glb') return null;
  const config = (avatar.customConfig ?? {}) as Record<string, unknown>;
  const url = config.glbUrl;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

function fitGlbToHumanHeight(visual: TransformNode, meshes: AbstractMesh[], targetHeight = 1.85) {
  const roots = meshes.filter((m) => !m.parent || meshes.includes(m.parent as AbstractMesh));
  const sample = roots[0] ?? meshes[0];
  if (!sample) return;

  // Force world matrix update after parenting
  visual.computeWorldMatrix(true);
  for (const m of meshes) m.computeWorldMatrix(true);

  const { min, max } = visual.getHierarchyBoundingVectors(true);
  const height = max.y - min.y;
  if (!(height > 0.01)) return;

  const scale = targetHeight / height;
  visual.scaling.setAll(scale);
  visual.computeWorldMatrix(true);
  for (const m of meshes) m.computeWorldMatrix(true);

  const fitted = visual.getHierarchyBoundingVectors(true);
  visual.position.y -= fitted.min.y;
}

function emptyPivot(scene: Scene, name: string, parent: TransformNode, y: number): TransformNode {
  const n = new TransformNode(name, scene);
  n.parent = parent;
  n.position.y = y;
  return n;
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

  /** Procedural sync create, or GLB load when presetKind is glb + glbUrl. */
  static async createAsync(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name = 'avatar',
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body' } = {},
  ): Promise<TransformNode> {
    const glbUrl = resolveGlbUrl(avatar);
    if (!glbUrl) {
      return AvatarFactory.create(scene, avatar, name, displayName, username, options);
    }

    try {
      return await AvatarFactory.createFromGlb(scene, glbUrl, name, displayName, username, options);
    } catch (err) {
      console.warn('[lobby-sdk] GLB avatar failed, falling back to procedural', glbUrl, err);
      return AvatarFactory.create(scene, avatar, name, displayName, username, options);
    }
  }

  private static async createFromGlb(
    scene: Scene,
    glbUrl: string,
    name: string,
    displayName: string | undefined,
    username: string | undefined,
    options: { collider?: boolean | 'player' | 'body' },
  ): Promise<TransformNode> {
    const visual = new TransformNode(`${name}-visual`, scene);

    const result = await SceneLoader.ImportMeshAsync('', glbUrl, undefined, scene);
    const importedRoot = result.meshes[0];
    if (importedRoot) {
      importedRoot.parent = visual;
      importedRoot.position.set(0, 0, 0);
    }
    for (const mesh of result.meshes) {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
    }

    fitGlbToHumanHeight(visual, result.meshes as AbstractMesh[]);

    const torso = emptyPivot(scene, `${name}-torso`, visual, 1.18);
    const head = emptyPivot(scene, `${name}-head-pivot`, visual, 1.78);
    const armL = emptyPivot(scene, `${name}-arm-l`, visual, 1.48);
    armL.position.x = -0.5;
    const armR = emptyPivot(scene, `${name}-arm-r`, visual, 1.48);
    armR.position.x = 0.5;
    const legL = emptyPivot(scene, `${name}-leg-l`, visual, 0.9);
    legL.position.x = -0.18;
    const legR = emptyPivot(scene, `${name}-leg-r`, visual, 0.9);
    legR.position.x = 0.18;

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
      visual.position.x = 0;
      visual.position.z = 0;
      root = collider;
    } else if (options.collider === 'body') {
      collider = MeshBuilder.CreateBox(`${name}-bodycol`, { width: 0.12, height: 0.12, depth: 0.12 }, scene);
      collider.isVisible = false;
      collider.isPickable = false;
      collider.checkCollisions = false;
      visual.parent = collider;
      visual.position.x = 0;
      visual.position.z = 0;
      root = collider;
    }

    root.name = name;
    const groups = (result.animationGroups ?? []) as AnimationGroup[];
    const rig: AvatarRig = { root, visual, collider, torso, head, armL, armR, legL, legR };
    root.metadata = { ...(root.metadata ?? {}), rig, animationGroups: groups };
    return root;
  }

  static getRig(root: TransformNode): AvatarRig | null {
    return (root.metadata?.rig as AvatarRig | undefined) ?? null;
  }

  static getAnimationGroups(root: TransformNode): AnimationGroup[] | undefined {
    const groups = root.metadata?.animationGroups as AnimationGroup[] | undefined;
    return groups?.length ? groups : undefined;
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
