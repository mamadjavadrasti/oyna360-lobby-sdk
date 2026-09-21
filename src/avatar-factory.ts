import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3 as BVector3,
  VertexBuffer,
} from '@babylonjs/core';
import type { AnimationGroup, AbstractMesh } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
/** Register Draco decoder so compressed avatar GLBs (KHR_draco_mesh_compression) load. */
import '@babylonjs/core/Meshes/Compression/dracoCompression';
import { dedupeClipsByName } from './avatar-clips';
import { resolveGlbUrl } from './avatar-config';
import type { SdkLobbyAvatar } from './platform-types';
import { attachNameTag } from './name-tag';
import { isTouchDevice, shouldTrimAvatarDetailMaps } from './quality';
import { isLobbyPerfDiagEnabled, lobbyPerfMark, lobbyPerfTimeAsync } from './lobby-perf-diag';
import { AvatarInstance } from './avatar-instance';
import { AvatarAssetManager } from './avatar-asset-manager';
import {
  AvatarMaterialPipeline,
  applyAvatarBaseAlbedo,
  applyAvatarTint,
  hardenAvatarMaterials,
  lobbyQualityOf,
  readBaseAlbedoUrlFromConfig,
  readTintFromConfig,
  trimDetailMapsOnMaterials,
} from './avatar-material-pipeline';
import { AvatarRigBuilder, type AvatarRig } from './avatar-rig-builder';
import { yieldToRenderLoop } from './yield-to-render';

export type { AvatarRig } from './avatar-rig-builder';
export { AvatarRigBuilder } from './avatar-rig-builder';

export {
  applyAvatarTint,
  applyAvatarBaseAlbedo,
  readBaseAlbedoUrlFromConfig,
  hardenAvatarMaterials,
};

const PRESET_LOOKS: Record<string, { bodyColor: string; accentColor: string; pantsColor: string; hairColor: string }> = {
  'default-1': { bodyColor: '#6366f1', accentColor: '#fbbf24', pantsColor: '#1e3a5f', hairColor: '#312e81' },
  'default-2': { bodyColor: '#22c55e', accentColor: '#fde68a', pantsColor: '#14532d', hairColor: '#166534' },
  'default-3': { bodyColor: '#f97316', accentColor: '#fecaca', pantsColor: '#7c2d12', hairColor: '#9a3412' },
  'default-4': { bodyColor: '#64748b', accentColor: '#e2e8f0', pantsColor: '#0f172a', hairColor: '#334155' },
};

function colorFromConfig(value: unknown, fallback: string) {
  try {
    return Color3.FromHexString(typeof value === 'string' ? value : fallback);
  } catch {
    return Color3.FromHexString(fallback);
  }
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

/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export { resolveGlbUrl } from './avatar-config';

function fitGlbToHumanHeight(model: TransformNode, meshes: AbstractMesh[], targetHeight = 1.85) {
  if (!meshes.length) return;

  model.computeWorldMatrix(true);
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    try {
      (m as Mesh).refreshBoundingInfo?.(true, true);
    } catch {
      // ignore
    }
  }

  let { min, max } = model.getHierarchyBoundingVectors(true);
  let height = max.y - min.y;

  // Skinned / broken bounds can be astronomical — fall back to local vertex AABB.
  if (!(height > 0.01) || height > 20) {
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const m of meshes) {
      if (!(m instanceof Mesh)) continue;
      const pos = m.getVerticesData(VertexBuffer.PositionKind);
      if (!pos) continue;
      for (let i = 0; i < pos.length; i += 3) {
        minX = Math.min(minX, pos[i]);
        maxX = Math.max(maxX, pos[i]);
        minY = Math.min(minY, pos[i + 1]);
        maxY = Math.max(maxY, pos[i + 1]);
        minZ = Math.min(minZ, pos[i + 2]);
        maxZ = Math.max(maxZ, pos[i + 2]);
      }
    }
    height = maxY - minY;
    if (!(height > 0.01)) return;
    const scale = targetHeight / height;
    model.scaling.setAll(scale);
    model.position.y = -minY * scale;
    return;
  }

  const scale = targetHeight / height;
  model.scaling.setAll(scale);
  model.computeWorldMatrix(true);
  for (const m of meshes) m.computeWorldMatrix(true);

  const fitted = model.getHierarchyBoundingVectors(true);
  model.position.y -= fitted.min.y;
}

function stripCloneSuffix(name: string | undefined) {
  return (name ?? '').replace(/__a\d+$/, '');
}

function isImportRootName(name: string | undefined) {
  const base = stripCloneSuffix(name).toLowerCase();
  return base === '__root__' || base === 'world';
}

export class AvatarFactory {
  static create(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name = 'avatar',
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body'; skipNameTag?: boolean } = {},
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
    const tintMeshes: AbstractMesh[] = [];

    const torso = new TransformNode(`${name}-torso`, scene);
    torso.parent = visual;
    torso.position.y = 1.18;
    tintMeshes.push(box(scene, `${name}-body`, { width: 0.78, height: 0.82, depth: 0.42 }, shirtMat, torso, { x: 0, y: 0, z: 0 }));
    tintMeshes.push(box(scene, `${name}-hip`, { width: 0.62, height: 0.22, depth: 0.36 }, pantsMat, torso, { x: 0, y: -0.48, z: 0 }));

    const head = new TransformNode(`${name}-head-pivot`, scene);
    head.parent = visual;
    head.position.y = 1.78;
    tintMeshes.push(box(scene, `${name}-head`, { width: 0.5, height: 0.5, depth: 0.5 }, skinMat, head, { x: 0, y: 0, z: 0 }));
    tintMeshes.push(box(scene, `${name}-hair`, { width: 0.54, height: 0.16, depth: 0.54 }, solid(scene, `${name}-hair-mat`, colorFromConfig(config.hairColor, '#1f2937')), head, {
      x: 0,
      y: 0.28,
      z: 0,
    }));

    const armL = new TransformNode(`${name}-arm-l`, scene);
    armL.parent = visual;
    armL.position.set(-0.52, 1.48, 0);
    tintMeshes.push(box(scene, `${name}-arm--1`, { width: 0.22, height: 0.78, depth: 0.22 }, shirtMat, armL, { x: 0, y: -0.4, z: 0 }));
    tintMeshes.push(box(scene, `${name}-hand--1`, { width: 0.2, height: 0.2, depth: 0.2 }, skinMat, armL, { x: 0, y: -0.82, z: 0 }));

    const armR = new TransformNode(`${name}-arm-r`, scene);
    armR.parent = visual;
    armR.position.set(0.52, 1.48, 0);
    tintMeshes.push(box(scene, `${name}-arm-1`, { width: 0.22, height: 0.78, depth: 0.22 }, shirtMat, armR, { x: 0, y: -0.4, z: 0 }));
    tintMeshes.push(box(scene, `${name}-hand-1`, { width: 0.2, height: 0.2, depth: 0.2 }, skinMat, armR, { x: 0, y: -0.82, z: 0 }));

    const legL = new TransformNode(`${name}-leg-l`, scene);
    legL.parent = visual;
    legL.position.set(-0.18, 0.9, 0);
    tintMeshes.push(box(scene, `${name}-leg--1`, { width: 0.26, height: 0.88, depth: 0.28 }, pantsMat, legL, { x: 0, y: -0.44, z: 0 }));

    const legR = new TransformNode(`${name}-leg-r`, scene);
    legR.parent = visual;
    legR.position.set(0.18, 0.9, 0);
    tintMeshes.push(box(scene, `${name}-leg-1`, { width: 0.26, height: 0.88, depth: 0.28 }, pantsMat, legR, { x: 0, y: -0.44, z: 0 }));

    if (!options.skipNameTag) {
      attachNameTag(scene, visual, displayName ?? '', username ?? '', name);
    }

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
    root.metadata = { ...(root.metadata ?? {}), rig, tintMeshes, isLobbyAvatarRoot: true };
    return root;
  }

  /** Procedural sync create, or GLB load when presetKind is glb + glbUrl. */
  static async createAsync(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name = 'avatar',
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body'; skipAccessories?: boolean; skipNameTag?: boolean } = {},
  ): Promise<TransformNode> {
    const run = async () => {
    const glbUrl = resolveGlbUrl(avatar);
    const cfg = avatar.customConfig as Record<string, unknown> | undefined;
    console.info('[lobby-sdk] avatar createAsync', {
      presetKey: avatar.presetKey,
      presetKind: avatar.presetKind,
      glbUrl,
      colorVariantKey: cfg?.colorVariantKey ?? null,
      baseAlbedo: readBaseAlbedoUrlFromConfig(cfg),
    });
    let root: TransformNode;
    if (!glbUrl) {
      root = AvatarFactory.create(scene, avatar, name, displayName, username, options);
    } else {
      const candidates = [glbUrl];
      try {
        const absolute = new URL(glbUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        if (absolute.pathname && absolute.pathname !== glbUrl) {
          candidates.push(absolute.pathname);
        }
      } catch {
        // ignore
      }

      let lastError: unknown;
      let loaded: TransformNode | null = null;
      for (const url of candidates) {
        try {
          loaded = await AvatarFactory.createFromGlb(scene, url, name, displayName, username, options);
          break;
        } catch (err) {
          lastError = err;
          console.warn('[lobby-sdk] GLB avatar load failed, trying next URL', url, err);
        }
      }

      if (!loaded) {
        console.warn('[lobby-sdk] GLB avatar failed, falling back to procedural', glbUrl, lastError);
        root = AvatarFactory.create(scene, avatar, name, displayName, username, options);
      } else {
        root = loaded;
      }
    }

    if (!options.skipAccessories) {
      try {
        const tAcc = performance.now();
        const { attachAccessoriesFromAvatarConfig } = await import('./avatar-accessories');
        await attachAccessoriesFromAvatarConfig(
          scene,
          root,
          avatar.customConfig as Record<string, unknown> | undefined,
        );
        if (isLobbyPerfDiagEnabled()) {
          lobbyPerfMark('accessories', performance.now() - tAcc);
        }
      } catch (err) {
        console.warn('[lobby-sdk] accessories skipped', err);
      }
    }

    // Appearance (baked clothing albedo) always applies — independent of mesh accessories.
    const baseAlbedo = readBaseAlbedoUrlFromConfig(
      avatar.customConfig as Record<string, unknown> | undefined,
    );
    const tAppear = performance.now();
    try {
      applyAvatarBaseAlbedo(root, baseAlbedo);
    } catch (err) {
      console.warn('[lobby-sdk] base albedo skipped', err);
    }

    // Whole-avatar tint is legacy (procedural). Never multiply over clothing texture variants.
    if (!baseAlbedo) {
      applyAvatarTint(root, readTintFromConfig(avatar.customConfig as Record<string, unknown> | undefined));
    } else {
      applyAvatarTint(root, null);
    }
    if (isLobbyPerfDiagEnabled()) {
      lobbyPerfMark('albedo_tint', performance.now() - tAppear);
    }
    AvatarFactory.markLobbyAvatar(root, scene);
    return root;
    };

    if (!isLobbyPerfDiagEnabled()) return run();
    return lobbyPerfTimeAsync('createAsync_total', run, name);
  }

  static markLobbyAvatar(root: TransformNode, scene: Scene) {
    root.metadata = { ...(root.metadata ?? {}), isLobbyAvatarRoot: true };
    root.onDisposeObservable.addOnce(() => {
      queueMicrotask(() => {
        if (scene.isDisposed) return;
        AvatarFactory.syncCrowdBudget(scene);
      });
    });
    AvatarFactory.syncCrowdBudget(scene);
  }

  /**
   * Recount avatars and drop extra PBR maps / bloom once the room fills up.
   * Safe to call after spawn or dispose.
   */
  static syncCrowdBudget(scene: Scene) {
    let count = 0;
    for (const node of scene.transformNodes) {
      if (!node.isDisposed() && node.metadata?.isLobbyAvatarRoot) count++;
    }
    for (const mesh of scene.meshes) {
      if (!mesh.isDisposed() && mesh.metadata?.isLobbyAvatarRoot) count++;
    }
    (scene.metadata as { applyLobbyCrowdLoad?: (n: number) => void } | undefined)?.applyLobbyCrowdLoad?.(
      count,
    );
    if (
      !shouldTrimAvatarDetailMaps({
        quality: lobbyQualityOf(scene),
        touch: isTouchDevice(),
        avatarCount: count,
      })
    ) {
      return;
    }
    trimDetailMapsOnMaterials(scene.meshes.filter((mesh) => mesh.metadata?.isLobbyAvatar));
  }

  /** Re-tint materials without reloading the GLB (legacy / procedural). */
  static setTint(root: TransformNode, hex: string | undefined | null) {
    AvatarMaterialPipeline.applyTint(root, hex);
  }

  /** Swap base albedo without reloading the GLB (clothing texture variants). */
  static setBaseAlbedo(root: TransformNode, textureUrl: string | undefined | null) {
    AvatarMaterialPipeline.applyBaseAlbedo(root, textureUrl);
  }

  private static async createFromGlb(
    scene: Scene,
    glbUrl: string,
    name: string,
    displayName: string | undefined,
    username: string | undefined,
    options: { collider?: boolean | 'player' | 'body'; skipNameTag?: boolean },
  ): Promise<TransformNode> {
    const visual = new TransformNode(`${name}-visual`, scene);
    // Separate model node so HumanoidAnimator can freely set visual.position.y
    // without undoing the "feet on ground" offset.
    const model = new TransformNode(`${name}-model`, scene);
    model.parent = visual;

    const result = await AvatarAssetManager.instantiateAvatarGlb(scene, glbUrl);
    // Spread post-clone preparation across frames so remote different-base joins
    // do not freeze the lobby on one long sync resume.
    await yieldToRenderLoop();
    const transformNodes = result.transformNodes;
    const skeletons = result.skeletons;
    const animationGroups = dedupeClipsByName(result.animationGroups);

    const importRoot =
      result.meshes.find((m) => isImportRootName(m.name)) ??
      transformNodes.find((t) => isImportRootName(t.name)) ??
      result.meshes[0];

    // Preserve glTF right-handed flip if present on import root.
    const rootScaleZ = importRoot?.scaling?.z ?? 1;

    const prepared = AvatarRigBuilder.prepareGlbSkeleton({
      scene,
      name,
      glbUrl,
      model,
      importRoot,
      rootScaleZ,
      meshes: result.meshes as AbstractMesh[],
      transformNodes,
      skeletons,
      animationGroups,
    });
    const {
      clips,
      displayMeshes,
      rigidGlb,
      boneDriven,
      limbRig,
      originalAnimationGroups,
      skeletons: preparedSkeletons,
      transformNodes: preparedTransformNodes,
    } = prepared;
    const hasSkeleton =
      skeletons.length > 0 || (result.meshes as AbstractMesh[]).some((m) => !!m.skeleton);

    for (const mesh of displayMeshes) {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.receiveShadows = false;
    }

    await yieldToRenderLoop();
    fitGlbToHumanHeight(model, displayMeshes);
    {
      const tHarden = performance.now();
      AvatarMaterialPipeline.harden(displayMeshes);
      if (isLobbyPerfDiagEnabled()) {
        lobbyPerfMark('harden_materials', performance.now() - tHarden);
      }
    }
    AvatarRigBuilder.padSkinnedBounds(displayMeshes);
    AvatarMaterialPipeline.trimForLowEnd(scene, displayMeshes);

    await yieldToRenderLoop();
    const humanoid = AvatarRigBuilder.buildHumanoidAfterFit(
      visual,
      preparedSkeletons,
      preparedTransformNodes,
      boneDriven,
    );

    console.info('[lobby-sdk] GLB loaded', {
      glbUrl,
      hasSkeleton,
      boneDriven,
      humanoid: !!humanoid,
      rigidGlb,
      display: displayMeshes.map((m) => m.name),
    });

    const { torso, head, armL, armR, legL, legR } = AvatarRigBuilder.resolveLimbPivots(
      scene,
      name,
      visual,
      limbRig,
    );

    if (!options.skipNameTag) {
      attachNameTag(scene, visual, displayName ?? '', username ?? '', name);
    }

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
    const rig: AvatarRig = {
      root,
      visual,
      collider,
      torso,
      head,
      armL,
      armR,
      legL,
      legR,
      boneDriven,
      humanoid,
      restRotation: limbRig?.restRotation,
    };
    root.metadata = {
      ...(root.metadata ?? {}),
      rig,
      animationGroups: clips,
      /** Original GLB clips (emotes later); locomotion uses boneDriven procedural. */
      sourceClips: boneDriven ? originalAnimationGroups : clips,
      glbModel: model,
      rigidGlb,
      boneDriven,
      tintMeshes: displayMeshes.filter((m) => !!m?.material && m.isEnabled?.() !== false && !isImportRootName(m.name)),
      isLobbyAvatarRoot: true,
    };
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

  /** Phase-1: wrap a factory-built root as AvatarInstance (no rebuild). */
  static wrap(root: TransformNode): AvatarInstance {
    return AvatarInstance.fromRoot(root);
  }

  /**
   * Phase-1 high-level spawn API for remotes/controllers.
   * Builds a procedural stand-in without exposing GLB/material details to callers.
   */
  static createPlaceholderInstance(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name: string,
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body'; skipNameTag?: boolean } = {},
  ): AvatarInstance {
    const root = AvatarFactory.create(scene, avatar, name, displayName, username, options);
    AvatarFactory.markLobbyAvatar(root, scene);
    return AvatarInstance.fromRoot(root);
  }

  /**
   * Phase-1 high-level spawn API — same pipeline as createAsync, returns AvatarInstance.
   */
  static async createInstanceAsync(
    scene: Scene,
    avatar: SdkLobbyAvatar,
    name = 'avatar',
    displayName?: string,
    username?: string,
    options: { collider?: boolean | 'player' | 'body'; skipAccessories?: boolean; skipNameTag?: boolean } = {},
  ): Promise<AvatarInstance> {
    const root = await AvatarFactory.createAsync(scene, avatar, name, displayName, username, options);
    return AvatarInstance.fromRoot(root);
  }
}
