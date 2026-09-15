import {
  BoundingInfo,
  Color3,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  Skeleton,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3 as BVector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import type { AnimationGroup, AbstractMesh, AssetContainer, BaseTexture } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
/** Register Draco decoder so compressed avatar GLBs (KHR_draco_mesh_compression) load. */
import '@babylonjs/core/Meshes/Compression/dracoCompression';
import { dedupeClipsByName } from './avatar-clips';
import { resolveGlbUrl } from './avatar-config';
import { buildHumanoidBoneRig, type HumanoidBoneRig } from './humanoid-rig';
import { ensureDracoDecoder } from './draco';
import type { SdkLobbyAvatar } from './platform-types';
import { attachNameTag } from './name-tag';
import {
  isTouchDevice,
  shouldTrimAvatarDetailMaps,
  type LobbyQualityLevel,
} from './quality';
import { isLobbyPerfDiagEnabled, lobbyPerfMark, lobbyPerfTimeAsync } from './lobby-perf-diag';

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
  /** Skinned GLB: pivots are skeleton bones — only rotate, never rewrite bind positions. */
  boneDriven?: boolean;
  /** Full humanoid bone map (spine, knees, elbows…) when the GLB skeleton allows it. */
  humanoid?: HumanoidBoneRig;
  restRotation?: {
    torso: BVector3;
    head: BVector3;
    armL: BVector3;
    armR: BVector3;
    legL: BVector3;
    legR: BVector3;
  };
}

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

function readTintFromConfig(config: Record<string, unknown> | undefined): string | undefined {
  if (!config) return undefined;
  for (const key of ['tintColor', 'bodyColor', 'skinColor'] as const) {
    const v = config[key];
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  }
  return undefined;
}

/** Recolor avatar body meshes only — never the nametag billboard. */
export function applyAvatarTint(root: TransformNode, hex: string | undefined | null) {
  if (!root) return;

  let tint: Color3 | null = null;
  if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    try {
      tint = Color3.FromHexString(hex);
    } catch {
      tint = null;
    }
  }

  const preferred = (root.metadata?.tintMeshes as AbstractMesh[] | undefined)?.filter(Boolean);
  let meshes: AbstractMesh[] = preferred?.length
    ? preferred
    : (() => {
        try {
          return root.getChildMeshes?.(true) ?? [];
        } catch {
          return [];
        }
      })();

  meshes = meshes.filter((mesh) => {
    if (!mesh || mesh.name?.includes('nametag')) return false;
    const meta = mesh.metadata as { isNameTag?: boolean } | undefined;
    if (meta?.isNameTag) return false;
    const matMeta = mesh.material?.metadata as { isNameTag?: boolean } | undefined;
    if (matMeta?.isNameTag) return false;
    // Nametag uses unlit dynamic texture — skip any unlit billboard text planes.
    const mat = mesh.material as { disableLighting?: boolean; diffuseTexture?: { name?: string } } | null;
    if (mat?.disableLighting && mat?.diffuseTexture?.name?.includes('nametag')) return false;
    return true;
  });

  const visitMaterial = (mat: Material | null) => {
    if (!mat) return;
    try {
      const anyMat = mat as Material & {
        albedoColor?: Color3;
        diffuseColor?: Color3;
        emissiveColor?: Color3;
        emissiveIntensity?: number;
        albedoTexture?: BaseTexture | null;
        diffuseTexture?: BaseTexture | null;
        disableLighting?: boolean;
        metadata?: {
          isNameTag?: boolean;
          baseAlbedo?: Color3;
          baseDiffuse?: Color3;
          baseEmissive?: Color3;
          baseEmissiveIntensity?: number;
        };
        markAsDirty?: (flag?: number) => void;
        subMaterials?: Array<Material | null>;
      };

      if (anyMat.metadata?.isNameTag) return;
      if (anyMat.disableLighting && anyMat.diffuseTexture?.name?.includes('nametag')) return;

      if (Array.isArray(anyMat.subMaterials)) {
        for (const sub of anyMat.subMaterials) visitMaterial(sub);
        return;
      }

      const meta = (anyMat.metadata ?? {}) as NonNullable<typeof anyMat.metadata>;
      if (anyMat.albedoColor && !meta.baseAlbedo) meta.baseAlbedo = anyMat.albedoColor.clone();
      if (anyMat.diffuseColor && !meta.baseDiffuse) meta.baseDiffuse = anyMat.diffuseColor.clone();
      if (anyMat.emissiveColor && !meta.baseEmissive) meta.baseEmissive = anyMat.emissiveColor.clone();
      if (typeof anyMat.emissiveIntensity === 'number' && meta.baseEmissiveIntensity === undefined) {
        meta.baseEmissiveIntensity = anyMat.emissiveIntensity;
      }
      anyMat.metadata = meta;

      if (tint) {
        // albedoColor multiplies albedoTexture on PBR — this is the real body recolor.
        if (anyMat.albedoColor) anyMat.albedoColor.copyFrom(tint);
        else if (anyMat.diffuseColor) anyMat.diffuseColor.copyFrom(tint);
        if (anyMat.emissiveColor && !anyMat.disableLighting) {
          anyMat.emissiveColor.copyFrom(tint.scale(0.2));
          if (typeof anyMat.emissiveIntensity === 'number') anyMat.emissiveIntensity = 0.25;
        }
      } else {
        if (anyMat.albedoColor && meta.baseAlbedo) anyMat.albedoColor.copyFrom(meta.baseAlbedo);
        if (anyMat.diffuseColor && meta.baseDiffuse) anyMat.diffuseColor.copyFrom(meta.baseDiffuse);
        if (anyMat.emissiveColor && meta.baseEmissive) anyMat.emissiveColor.copyFrom(meta.baseEmissive);
        if (typeof anyMat.emissiveIntensity === 'number' && meta.baseEmissiveIntensity !== undefined) {
          anyMat.emissiveIntensity = meta.baseEmissiveIntensity;
        }
      }
      anyMat.markAsDirty?.();
    } catch {
      // skip broken materials
    }
  };

  for (const mesh of meshes) {
    visitMaterial(mesh.material);
  }

  root.metadata = { ...(root.metadata ?? {}), tintColor: hex ?? null };
}

/** Same file on :3000/uploads vs :3001/uploads must share one GPU copy. */
function assetCacheKey(url: string): string {
  if (!url || url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url, 'http://lobby.local');
    return parsed.pathname || url;
  } catch {
    return url;
  }
}

function absoluteAssetUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (!url.startsWith('/')) return url;
  // Prefer platform origin when lobby runs inside a game iframe on another host.
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : '';
    if (ref && ref !== window.location.origin) {
      return `${ref}${url}`;
    }
  } catch {
    // ignore
  }
  return `${window.location.origin}${url}`;
}

function readColorVariantTexture(
  customConfig: Record<string, unknown> | undefined | null,
): string | null {
  if (!customConfig) return null;
  const variants = customConfig.colorVariants;
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const selectedKey =
    typeof customConfig.colorVariantKey === 'string' && customConfig.colorVariantKey.trim()
      ? customConfig.colorVariantKey.trim()
      : typeof customConfig.defaultColorVariantKey === 'string' &&
          customConfig.defaultColorVariantKey.trim()
        ? customConfig.defaultColorVariantKey.trim()
        : null;

  let hit: Record<string, unknown> | null = null;
  if (selectedKey) {
    for (const entry of variants) {
      if (!entry || typeof entry !== 'object') continue;
      const src = entry as Record<string, unknown>;
      if (src.key === selectedKey) {
        hit = src;
        break;
      }
    }
  }
  if (!hit) {
    const first = variants[0];
    if (first && typeof first === 'object') hit = first as Record<string, unknown>;
  }
  if (!hit) return null;
  if (hit.appliesToBase === false) return null;
  if (typeof hit.textureUrl === 'string' && hit.textureUrl.trim()) {
    return hit.textureUrl.trim();
  }
  return null;
}

/** Read base-body albedo: preset colorVariants first, then accessory appliesToBase. */
export function readBaseAlbedoUrlFromConfig(
  customConfig: Record<string, unknown> | undefined | null,
): string | null {
  const fromPalette = readColorVariantTexture(customConfig);
  if (fromPalette) return fromPalette;

  const raw = customConfig?.accessories;
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const src = entry as {
      textureUrl?: unknown;
      appliesToBase?: unknown;
    };
    if (src.appliesToBase !== true) continue;
    if (typeof src.textureUrl === 'string' && src.textureUrl.trim()) {
      return src.textureUrl.trim();
    }
  }
  return null;
}

/**
 * Swap base avatar albedo texture (for baked-in clothing color variants).
 * Does not touch nametag materials. Pass null/undefined to restore the original map.
 */
type AlbedoSwapMaterial = Material & {
  albedoColor?: Color3;
  diffuseColor?: Color3;
  emissiveColor?: Color3;
  emissiveIntensity?: number;
  albedoTexture?: BaseTexture | null;
  diffuseTexture?: BaseTexture | null;
  subMaterials?: Array<Material | null>;
  metadata?: {
    isNameTag?: boolean;
    baseAlbedoTexture?: BaseTexture | null;
    baseDiffuseTexture?: BaseTexture | null;
  };
  markAsDirty?: () => void;
};

/**
 * One GPU texture per URL per scene. A 1K albedo costs ~5MB of VRAM, so a lobby
 * of players wearing the same colour used to pay that cost once per avatar.
 */
const albedoTextureCache = new WeakMap<Scene, Map<string, Texture>>();

/** One download + parse per avatar GLB per scene; every player clones from it. */
const glbContainerCache = new WeakMap<Scene, Map<string, Promise<AssetContainer>>>();

interface GlbInstance {
  meshes: AbstractMesh[];
  transformNodes: TransformNode[];
  skeletons: Skeleton[];
  animationGroups: AnimationGroup[];
}

function loadGlbContainer(scene: Scene, glbUrl: string): Promise<AssetContainer> {
  let byUrl = glbContainerCache.get(scene);
  if (!byUrl) {
    byUrl = new Map();
    glbContainerCache.set(scene, byUrl);
    scene.onDisposeObservable.addOnce(() => glbContainerCache.delete(scene));
  }

  const cacheKey = assetCacheKey(glbUrl);
  const cached = byUrl.get(cacheKey);
  if (cached) {
    if (isLobbyPerfDiagEnabled()) {
      return lobbyPerfTimeAsync('glb_container_load', () => cached, 'cache_hit');
    }
    return cached;
  }

  // Draco WASM must be ready before the first compressed avatar parse.
  const pending = (async () => {
    const tDraco = performance.now();
    await ensureDracoDecoder();
    if (isLobbyPerfDiagEnabled()) {
      lobbyPerfMark('draco_ensure', performance.now() - tDraco, glbUrl.slice(-48));
    }
    const tLoad = performance.now();
    const container = await SceneLoader.LoadAssetContainerAsync(
      '',
      glbUrl,
      scene,
      null,
      // A data URI carries no filename for the loader to sniff an extension from.
      glbUrl.startsWith('data:') ? '.glb' : undefined,
    );
    if (isLobbyPerfDiagEnabled()) {
      lobbyPerfMark('glb_container_load', performance.now() - tLoad, `cache_miss:${glbUrl.slice(-64)}`);
    }
    // Template stays in the scene for cloning. Keep it off so it cannot render
    // or steal a skeleton from a named lookup of "Mesh0" / "Armature".
    for (const mesh of container.meshes) {
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }
    return container;
  })();
  // A failed load must not poison later attempts (fallback URLs are retried).
  pending.catch(() => byUrl?.delete(cacheKey));
  byUrl.set(cacheKey, pending);
  return pending;
}

let glbCloneSerial = 0;

/**
 * Clone an avatar from the cached container instead of re-importing the file.
 * Geometry and textures are shared; materials and skeletons are per avatar, so
 * each player keeps their own colour variant and pose.
 *
 * Names MUST be unique. Babylon's instantiate looks up nodes by name; two
 * avatars named "Mesh0"/"Armature" make the second clone steal the first
 * skeleton — local body vanishes when someone else joins.
 */
async function instantiateGlb(scene: Scene, glbUrl: string): Promise<GlbInstance> {
  const container = await loadGlbContainer(scene, glbUrl);
  const t0 = performance.now();
  const serial = ++glbCloneSerial;
  const entries = container.instantiateModelsToScene((name) => `${name}__a${serial}`, true, {
    doNotInstantiate: true,
  });

  // Cloning a disabled template copies isEnabled=false. Turn the clone on,
  // and keep the shared template off so it never renders under the plaza.
  for (const mesh of container.meshes) {
    mesh.setEnabled(false);
    mesh.isVisible = false;
  }

  const meshes: AbstractMesh[] = [];
  const transformNodes: TransformNode[] = [];
  for (const rootNode of entries.rootNodes) {
    rootNode.setEnabled(true);
    for (const node of [rootNode, ...rootNode.getDescendants(false)]) {
      node.setEnabled(true);
      const mesh = node as AbstractMesh;
      if (typeof mesh.getTotalVertices === 'function') {
        mesh.isVisible = true;
        mesh.visibility = 1;
        meshes.push(mesh);
      } else {
        transformNodes.push(node as TransformNode);
      }
    }
  }

  if (isLobbyPerfDiagEnabled()) {
    lobbyPerfMark('glb_instantiate', performance.now() - t0, `serial=${serial}`);
  }
  console.info('[lobby-sdk] GLB cloned', { serial, names: meshes.map((m) => m.name) });
  return {
    meshes,
    transformNodes,
    skeletons: entries.skeletons as Skeleton[],
    animationGroups: entries.animationGroups as AnimationGroup[],
  };
}

function sharedAlbedoTexture(
  scene: Scene,
  url: string,
  invertY: boolean,
  like: Texture | null | undefined,
): Texture {
  let byUrl = albedoTextureCache.get(scene);
  if (!byUrl) {
    byUrl = new Map();
    albedoTextureCache.set(scene, byUrl);
    scene.onDisposeObservable.addOnce(() => albedoTextureCache.delete(scene));
  }

  // UV transform is part of the identity: two materials that sample the same
  // file differently must not share one instance.
  const uv = like
    ? [like.wrapU, like.wrapV, like.uScale, like.vScale, like.uOffset, like.vOffset].join(',')
    : 'default';
  const key = `${assetCacheKey(url)}|${invertY ? 1 : 0}|${uv}`;
  // Disposal removes its own entry below, so anything still cached is alive.
  const cached = byUrl.get(key);
  if (cached) return cached;

  const texture = new Texture(url, scene, false, invertY, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = `avatar-albedo-${url.slice(-48)}`;
  // Match glTF albedo sampling (linear UV, gamma color).
  texture.gammaSpace = true;
  texture.metadata = { ...(texture.metadata ?? {}), sharedAvatarAlbedo: true };
  forceOpaqueTexture(texture);
  if (like) {
    texture.wrapU = like.wrapU;
    texture.wrapV = like.wrapV;
    texture.uScale = like.uScale;
    texture.vScale = like.vScale;
    texture.uOffset = like.uOffset;
    texture.vOffset = like.vOffset;
  }
  // Shared across avatars: disposing one avatar must not blank the others.
  texture.onDisposeObservable.add(() => byUrl?.delete(key));
  byUrl.set(key, texture);
  return texture;
}

function collectAlbedoMaterials(rootMat: Material | null): AlbedoSwapMaterial[] {
  if (!rootMat) return [];
  const out: AlbedoSwapMaterial[] = [];
  const visit = (mat: Material | null) => {
    if (!mat) return;
    const anyMat = mat as AlbedoSwapMaterial;
    if (anyMat.metadata?.isNameTag) return;
    if (Array.isArray(anyMat.subMaterials) && anyMat.subMaterials.length) {
      for (const sub of anyMat.subMaterials) visit(sub);
      return;
    }
    out.push(anyMat);
  };
  visit(rootMat);
  return out;
}

export function applyAvatarBaseAlbedo(root: TransformNode, textureUrl: string | null | undefined) {
  if (!root) return;

  const preferred = (root.metadata?.tintMeshes as AbstractMesh[] | undefined)?.filter(Boolean);
  let meshes: AbstractMesh[] = preferred?.length
    ? preferred
    : (() => {
        try {
          return root.getChildMeshes?.(true) ?? [];
        } catch {
          return [];
        }
      })();

  meshes = meshes.filter((mesh) => {
    if (!mesh || mesh.name?.includes('nametag')) return false;
    const meta = mesh.metadata as { isNameTag?: boolean } | undefined;
    if (meta?.isNameTag) return false;
    return true;
  });

  const absolute = textureUrl ? absoluteAssetUrl(textureUrl) : null;
  const scene = root.getScene?.();
  let swapped = 0;

  for (const mesh of meshes) {
    for (const mat of collectAlbedoMaterials(mesh.material)) {
      const hasMap = !!(mat.albedoTexture || mat.diffuseTexture);
      // Only swap materials that already carry an albedo map (clothing), not flat skin mats.
      if (!hasMap && absolute) continue;

      const meta = (mat.metadata ?? {}) as NonNullable<typeof mat.metadata>;
      if (mat.albedoTexture && meta.baseAlbedoTexture === undefined) {
        meta.baseAlbedoTexture = mat.albedoTexture;
      }
      if (mat.diffuseTexture && meta.baseDiffuseTexture === undefined) {
        meta.baseDiffuseTexture = mat.diffuseTexture;
      }
      mat.metadata = meta;

      if (absolute && scene) {
        const prev = (mat.albedoTexture ?? mat.diffuseTexture) as Texture | null | undefined;
        const invertY =
          prev && typeof (prev as Texture).invertY === 'boolean' ? (prev as Texture).invertY : false;
        const next = sharedAlbedoTexture(scene, absolute, invertY, prev);
        if ('albedoTexture' in mat) mat.albedoTexture = next;
        else if ('diffuseTexture' in mat) mat.diffuseTexture = next;
        forceOpaqueTexture(next, mat as Material);
        (mat as Material).alpha = 1;
        (mat as Material).transparencyMode = Material.MATERIAL_OPAQUE;
        (mat as Material).alphaMode = 0;
        if ('useAlphaFromAlbedoTexture' in mat) {
          (mat as AlbedoSwapMaterial & { useAlphaFromAlbedoTexture?: boolean }).useAlphaFromAlbedoTexture =
            false;
        }
        if ('useAlphaFromDiffuseTexture' in mat) {
          (mat as AlbedoSwapMaterial & { useAlphaFromDiffuseTexture?: boolean }).useAlphaFromDiffuseTexture =
            false;
        }

        // Texture variants must not be multiplied by leftover whole-avatar tint.
        if (mat.albedoColor) mat.albedoColor.set(1, 1, 1);
        if (mat.diffuseColor) mat.diffuseColor.set(1, 1, 1);
        if (mat.emissiveColor) mat.emissiveColor.set(0, 0, 0);
        if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = 0;
        swapped += 1;
      } else {
        if ('albedoTexture' in mat && meta.baseAlbedoTexture !== undefined) {
          mat.albedoTexture = meta.baseAlbedoTexture;
        }
        if ('diffuseTexture' in mat && meta.baseDiffuseTexture !== undefined) {
          mat.diffuseTexture = meta.baseDiffuseTexture;
        }
      }
      mat.markAsDirty?.();
    }
  }

  if (absolute && swapped === 0) {
    console.warn('[lobby-sdk] base albedo: no textured materials found to swap', absolute);
  } else if (absolute) {
    console.info('[lobby-sdk] base albedo applied', { url: absolute, materials: swapped });
  }

  root.metadata = { ...(root.metadata ?? {}), baseAlbedoUrl: absolute, tintColor: null };
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

/**
 * Copy bind-pose geometry into a new non-skinned mesh.
 * Needed when Tripo/etc skeletons collapse in Babylon and GPU skinning explodes or hides the mesh.
 */
function bakeRigidFromImport(
  scene: Scene,
  sourceMeshes: AbstractMesh[],
  parent: TransformNode,
  name: string,
): Mesh[] {
  const baked: Mesh[] = [];
  for (const src of sourceMeshes) {
    if (!(src instanceof Mesh)) continue;
    const positions = src.getVerticesData(VertexBuffer.PositionKind);
    if (!positions || positions.length < 9) continue;
    const indices = src.getIndices();
    if (!indices || indices.length < 3) continue;

    const mesh = new Mesh(`${name}-${src.name || 'geo'}-rigid`, scene);
    const vd = new VertexData();
    vd.positions = Array.from(positions);
    vd.indices = Array.from(indices);
    const normals = src.getVerticesData(VertexBuffer.NormalKind);
    if (normals && normals.length === positions.length) {
      vd.normals = Array.from(normals);
    } else {
      const nrm: number[] = [];
      VertexData.ComputeNormals(vd.positions, vd.indices, nrm);
      vd.normals = nrm;
    }
    const uvs = src.getVerticesData(VertexBuffer.UVKind);
    if (uvs) vd.uvs = Array.from(uvs);
    vd.applyToMesh(mesh);

    mesh.material = src.material;
    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = false;
    baked.push(mesh);

    src.setEnabled(false);
    src.isVisible = false;
    src.skeleton = null;
    src.numBoneInfluencers = 0;
  }
  return baked;
}

/**
 * Keep albedo on the opaque path. glTF/PNG often sets hasAlpha=true after the
 * async decode finishes — that re-enters alpha blending and the body looks
 * see-through in front of plaza buildings.
 */
function forceOpaqueTexture(tex: BaseTexture | null | undefined, mat?: Material) {
  if (!tex) return;
  const lock = () => {
    tex.hasAlpha = false;
    tex.getAlphaFromRGB = false;
    if (mat) {
      mat.alpha = 1;
      mat.transparencyMode = Material.MATERIAL_OPAQUE;
      mat.alphaMode = 0;
      mat.disableDepthWrite = false;
      (mat as Material & { useAlphaFromAlbedoTexture?: boolean }).useAlphaFromAlbedoTexture = false;
      (mat as Material & { useAlphaFromDiffuseTexture?: boolean }).useAlphaFromDiffuseTexture = false;
      mat.markAsDirty(Material.AllDirtyFlag);
    }
  };
  lock();
  const meta = (tex.metadata ?? {}) as { lobbyForceOpaque?: boolean };
  if (meta.lobbyForceOpaque) return;
  tex.metadata = { ...meta, lobbyForceOpaque: true };
  const obs = (tex as BaseTexture & { onLoadObservable?: { add: (cb: () => void) => void } })
    .onLoadObservable;
  obs?.add(lock);
}

function lobbyQualityOf(scene: Scene): LobbyQualityLevel {
  const value = (scene.metadata as { lobbyQuality?: LobbyQualityLevel } | undefined)?.lobbyQuality;
  return value === 'low' || value === 'high' ? value : 'medium';
}

function countLobbyAvatars(scene: Scene) {
  const tagged = (scene.metadata as { lobbyAvatarCount?: number } | undefined)?.lobbyAvatarCount;
  if (typeof tagged === 'number' && tagged > 0) return tagged;
  let count = 0;
  for (const node of scene.transformNodes) {
    if (node.metadata?.isLobbyAvatarRoot) count++;
  }
  return count;
}

function trimDetailMapsOnMaterials(meshes: AbstractMesh[]) {
  for (const mesh of meshes) {
    if (isImportRootName(mesh.name)) continue;
    const rootMat = mesh?.material;
    if (!rootMat) continue;
    const subs = (rootMat as { subMaterials?: Array<Material | null> }).subMaterials;
    const materials = Array.isArray(subs) && subs.length ? subs : [rootMat];
    for (const mat of materials) {
      if (!mat) continue;
      const anyMat = mat as Material & {
        bumpTexture?: BaseTexture | null;
        metallicTexture?: BaseTexture | null;
        ambientTexture?: BaseTexture | null;
        reflectivityTexture?: BaseTexture | null;
        markAsDirty?: () => void;
      };
      for (const slot of ['bumpTexture', 'metallicTexture', 'ambientTexture', 'reflectivityTexture'] as const) {
        if (anyMat[slot]) anyMat[slot] = null;
      }
      anyMat.markAsDirty?.();
    }
  }
}

/**
 * Normal and metallic-roughness maps double an avatar's texture memory for
 * detail nobody can see on a phone-sized character. Low-tier devices ran out of
 * GPU memory and lost the WebGL context (a white screen) because of them.
 */
function trimAvatarMapsForLowEndDevices(scene: Scene, meshes: AbstractMesh[]) {
  if (
    !shouldTrimAvatarDetailMaps({
      quality: lobbyQualityOf(scene),
      touch: isTouchDevice(),
      avatarCount: countLobbyAvatars(scene) + 1,
    })
  ) {
    return;
  }
  trimDetailMapsOnMaterials(meshes);
}

function excludeAvatarFromGlow(scene: Scene, meshes: AbstractMesh[]) {
  const glow = (scene.metadata as { plazaGlow?: { addExcludedMesh: (mesh: Mesh) => void } } | undefined)
    ?.plazaGlow;
  if (!glow) return;
  for (const mesh of meshes) {
    if (mesh instanceof Mesh) glow.addExcludedMesh(mesh);
  }
}

function padSkinnedBounds(meshes: AbstractMesh[]) {
  for (const mesh of meshes) {
    if (!(mesh instanceof Mesh) || !mesh.skeleton) continue;
    try {
      mesh.refreshBoundingInfo(true, true);
      const bi = mesh.getBoundingInfo();
      const min = bi.minimum.clone();
      const max = bi.maximum.clone();
      const pad = 0.45;
      min.x -= pad;
      min.y -= pad;
      min.z -= pad;
      max.x += pad;
      max.y += pad;
      max.z += pad;
      mesh.setBoundingInfo(new BoundingInfo(min, max));
    } catch {
      // ignore
    }
  }
}

/**
 * Strip Meshy/glTF PBR extras that inflate the vertex shader UBO count.
 * WebGL2 guarantees only 12 vertex uniform blocks; plaza PointLights + skinning
 * + clearcoat pushes past that and the mesh silently disappears (nametag only).
 * Same-GLB remotes share one compiled Effect so they "work"; a second unique
 * material recompiles and dies — that was the different-avatar invisibility bug.
 */
function stripHeavyPbrFeatures(mat: Material) {
  const anyMat = mat as Material & {
    maxSimultaneousLights?: number;
    _maxSimultaneousLights?: number;
    clearCoat?: { isEnabled: boolean };
    sheen?: { isEnabled: boolean };
    anisotropy?: { isEnabled: boolean };
    iridescence?: { isEnabled: boolean };
    subSurface?: {
      isScatteringEnabled: boolean;
      isRefractionEnabled: boolean;
      isTranslucencyEnabled: boolean;
    };
    markAsDirty?: () => void;
    _markAllSubMeshesAsLightsDirty?: () => void;
    _markAllSubMeshesAsTexturesDirty?: () => void;
  };

  // Hemi + directional are enough for lobby bodies; plaza lamps stay on scenery.
  anyMat.maxSimultaneousLights = 2;
  anyMat._maxSimultaneousLights = 2;

  if (anyMat.clearCoat) anyMat.clearCoat.isEnabled = false;
  if (anyMat.sheen) anyMat.sheen.isEnabled = false;
  if (anyMat.anisotropy) anyMat.anisotropy.isEnabled = false;
  if (anyMat.iridescence) anyMat.iridescence.isEnabled = false;
  if (anyMat.subSurface) {
    anyMat.subSurface.isScatteringEnabled = false;
    anyMat.subSurface.isRefractionEnabled = false;
    anyMat.subSurface.isTranslucencyEnabled = false;
  }
  // No per-avatar reflections — scene pipeline owns bloom; mirrors look translucent.
  const pbr = anyMat as typeof anyMat & {
    reflectionTexture?: BaseTexture | null;
    environmentIntensity?: number;
  };
  if (pbr.reflectionTexture) pbr.reflectionTexture = null;
  if (typeof pbr.environmentIntensity === 'number') pbr.environmentIntensity = 0;
  anyMat._markAllSubMeshesAsLightsDirty?.();
  anyMat._markAllSubMeshesAsTexturesDirty?.();
}

/** Keep bone matrices in a texture so skinning does not burn vertex uniform slots. */
function preferBoneTexture(skeletons: Skeleton[]) {
  for (const sk of skeletons) {
    try {
      sk.useTextureToStoreBoneMatrices = true;
    } catch {
      // ignore
    }
  }
}

function excludeAvatarFromPrePass(scene: Scene, meshes: AbstractMesh[]) {
  try {
    const prepass = (scene as Scene & { prePassRenderer?: { excludedSkinnedMesh: Mesh[] } }).prePassRenderer;
    if (!prepass?.excludedSkinnedMesh) return;
    for (const mesh of meshes) {
      if (!(mesh instanceof Mesh) || !mesh.skeleton) continue;
      if (prepass.excludedSkinnedMesh.indexOf(mesh) === -1) {
        prepass.excludedSkinnedMesh.push(mesh);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Meshy/glTF looks hollow because albedo PNG alpha + __root__ Z-flip + culling.
 * Force opaque + double-sided. Do not flipFaces, do not replace PBR.
 * Do not forceDepthWrite — that punches holes in the plaza when two avatars overlap.
 */
export function hardenAvatarMaterials(meshes: AbstractMesh[]) {
  const scene = meshes[0]?.getScene?.();
  if (scene) {
    excludeAvatarFromGlow(scene, meshes);
    excludeAvatarFromPrePass(scene, meshes);
  }

  for (const mesh of meshes) {
    if (!mesh || isImportRootName(mesh.name)) continue;
    mesh.visibility = 1;
    mesh.metadata = { ...(mesh.metadata ?? {}), isLobbyAvatar: true };
    // Skinned AABBs are unreliable; remotes without this get frustum-culled.
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 0;
    mesh.receiveShadows = false;
    if (mesh instanceof Mesh) {
      mesh.sideOrientation = Mesh.DOUBLESIDE;
      mesh.overrideMaterialSideOrientation = Mesh.DOUBLESIDE;
    }

    const rootMat = mesh.material;
    if (!rootMat) continue;
    const materials: Material[] = [rootMat];
    const subs = (rootMat as { subMaterials?: Array<Material | null> }).subMaterials;
    if (Array.isArray(subs)) {
      for (const sub of subs) if (sub) materials.push(sub);
    }

    for (const mat of materials) {
      mat.backFaceCulling = false;
      mat.alpha = 1;
      mat.transparencyMode = Material.MATERIAL_OPAQUE;
      mat.alphaMode = 0;
      mat.separateCullingPass = false;
      // Opaque path already depth-writes; forceDepthWrite punches plaza holes on overlap.
      mat.forceDepthWrite = false;
      mat.disableDepthWrite = false;
      mat.needDepthPrePass = false;

      stripHeavyPbrFeatures(mat);

      const anyMat = mat as Material & {
        useAlphaFromAlbedoTexture?: boolean;
        useAlphaFromDiffuseTexture?: boolean;
        twoSidedLighting?: boolean;
        metallicF0Factor?: number;
        albedoTexture?: BaseTexture | null;
        diffuseTexture?: BaseTexture | null;
        opacityTexture?: BaseTexture | null;
        reflectionTexture?: BaseTexture | null;
        environmentIntensity?: number;
        markAsDirty?: () => void;
      };
      if ('useAlphaFromAlbedoTexture' in anyMat) anyMat.useAlphaFromAlbedoTexture = false;
      if ('useAlphaFromDiffuseTexture' in anyMat) anyMat.useAlphaFromDiffuseTexture = false;
      if ('twoSidedLighting' in anyMat) anyMat.twoSidedLighting = true;
      // KHR_materials_specular specularFactor:0 lands here and makes the body a hole.
      if (typeof anyMat.metallicF0Factor === 'number' && anyMat.metallicF0Factor < 0.5) {
        anyMat.metallicF0Factor = 1;
      }
      forceOpaqueTexture(anyMat.albedoTexture, mat);
      forceOpaqueTexture(anyMat.diffuseTexture, mat);
      if (anyMat.opacityTexture) anyMat.opacityTexture = null;
      if (anyMat.reflectionTexture) anyMat.reflectionTexture = null;
      if (typeof anyMat.environmentIntensity === 'number') anyMat.environmentIntensity = 0;
      anyMat.markAsDirty?.();
    }
  }
}

function emptyPivot(scene: Scene, name: string, parent: TransformNode, y: number): TransformNode {
  const n = new TransformNode(name, scene);
  n.parent = parent;
  n.position.y = y;
  return n;
}

function collectNamedTransforms(skeletons: Skeleton[], transformNodes: TransformNode[]) {
  const allowed = new Set<number>();
  for (const tn of transformNodes) {
    let p: { uniqueId: number; parent: unknown } | null = tn;
    while (p) {
      allowed.add(p.uniqueId);
      p = p.parent as typeof p;
    }
    const stack: TransformNode[] = [tn];
    while (stack.length) {
      const n = stack.pop()!;
      allowed.add(n.uniqueId);
      for (const child of n.getChildren()) {
        if (child instanceof TransformNode) stack.push(child);
      }
    }
  }

  const out: { name: string; node: TransformNode }[] = [];
  for (const sk of skeletons) {
    for (const bone of sk.bones) {
      const tn = bone.getTransformNode?.() ?? null;
      if (tn && allowed.has(tn.uniqueId)) out.push({ name: bone.name, node: tn });
    }
  }
  for (const tn of transformNodes) {
    out.push({ name: tn.name, node: tn });
  }
  return out;
}

function stripCloneSuffix(name: string | undefined) {
  return (name ?? '').replace(/__a\d+$/, '');
}

function isImportRootName(name: string | undefined) {
  const base = stripCloneSuffix(name).toLowerCase();
  return base === '__root__' || base === 'world';
}

function resolveNamedTransform(
  named: { name: string; node: TransformNode }[],
  candidates: string[],
): TransformNode | null {
  for (const candidate of candidates) {
    const want = candidate.toLowerCase();
    const exact = named.find((n) => stripCloneSuffix(n.name).toLowerCase() === want);
    if (exact) return exact.node;
  }
  for (const candidate of candidates) {
    const want = candidate.toLowerCase();
    const soft = named.find((n) => stripCloneSuffix(n.name).toLowerCase().includes(want));
    if (soft) return soft.node;
  }
  return null;
}

function captureRestEuler(node: TransformNode): BVector3 {
  if (node.rotationQuaternion) {
    return node.rotationQuaternion.toEulerAngles();
  }
  return node.rotation.clone();
}

/** Bind Tripo / Mixamo-style skeleton bones to AvatarRig limb pivots. */
function bindSkeletonRig(
  skeletons: Skeleton[],
  transformNodes: TransformNode[],
): Omit<AvatarRig, 'root' | 'visual' | 'collider'> | null {
  if (!skeletons.length) return null;
  const named = collectNamedTransforms(skeletons, transformNodes);

  const torso = resolveNamedTransform(named, ['Spine01', 'Spine02', 'Waist', 'spine', 'Spine']);
  const head = resolveNamedTransform(named, ['Head', 'head']);
  const armL = resolveNamedTransform(named, ['L_UpperarmTwist01', 'L_Upperarm', 'LeftArm', 'Left_UpperArm', 'mixamorig:LeftArm']);
  const armR = resolveNamedTransform(named, ['R_UpperarmTwist01', 'R_Upperarm', 'RightArm', 'Right_UpperArm', 'mixamorig:RightArm']);
  const legL = resolveNamedTransform(named, ['L_ThighTwist01', 'L_Thigh', 'LeftUpLeg', 'Left_Thigh', 'mixamorig:LeftUpLeg']);
  const legR = resolveNamedTransform(named, ['R_ThighTwist01', 'R_Thigh', 'RightUpLeg', 'Right_Thigh', 'mixamorig:RightUpLeg']);

  if (!torso || !head || !armL || !armR || !legL || !legR) {
    console.warn('[lobby-sdk] skinned GLB missing expected bones', {
      torso: !!torso,
      head: !!head,
      armL: !!armL,
      armR: !!armR,
      legL: !!legL,
      legR: !!legR,
      available: [...new Set(named.map((n) => n.name))],
    });
    return null;
  }

  const restRotation = {
    torso: captureRestEuler(torso),
    head: captureRestEuler(head),
    armL: captureRestEuler(armL),
    armR: captureRestEuler(armR),
    legL: captureRestEuler(legL),
    legR: captureRestEuler(legR),
  };

  return { torso, head, armL, armR, legL, legR, boneDriven: true, restRotation };
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
    applyAvatarTint(root, hex);
  }

  /** Swap base albedo without reloading the GLB (clothing texture variants). */
  static setBaseAlbedo(root: TransformNode, textureUrl: string | undefined | null) {
    applyAvatarBaseAlbedo(root, textureUrl);
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

    const result = await instantiateGlb(scene, glbUrl);
    const transformNodes = result.transformNodes;
    const skeletons = result.skeletons;
    const animationGroups = dedupeClipsByName(result.animationGroups);

    const importRoot =
      result.meshes.find((m) => isImportRootName(m.name)) ??
      transformNodes.find((t) => isImportRootName(t.name)) ??
      result.meshes[0];

    // Preserve glTF right-handed flip if present on import root.
    const rootScaleZ = importRoot?.scaling?.z ?? 1;

    const hasSkeleton = skeletons.length > 0 || result.meshes.some((m) => !!m.skeleton);
    let clips = animationGroups;
    let displayMeshes: AbstractMesh[] = result.meshes as AbstractMesh[];
    let rigidGlb = false;
    let boneDriven = false;
    let limbRig: Omit<AvatarRig, 'root' | 'visual' | 'collider'> | null = null;

    // Prefer procedural bone control for lobby locomotion.
    // Baked Meshy clips often have no Idle — frame 0 of Walking is mid-stride,
    // so "stopped" clip still looks like walking. Bone pivots match procedural humanoid.
    if (hasSkeleton) {
      for (const g of clips) {
        try {
          g.stop();
          g.reset();
          g.setWeightForAllAnimatables?.(0);
        } catch {
          // ignore
        }
      }
      for (const sk of skeletons) {
        try {
          sk.returnToRest();
        } catch {
          // ignore
        }
      }

      limbRig = bindSkeletonRig(skeletons, transformNodes);
      if (limbRig) {
        if (importRoot) importRoot.parent = model;
        preferBoneTexture(skeletons);
        for (const mesh of displayMeshes) {
          if (mesh.skeleton) mesh.numBoneInfluencers = Math.min(mesh.numBoneInfluencers || 4, 4);
        }
        boneDriven = true;
        // Keep source clips for later emotes; do not feed them to HumanoidAnimator.
        clips = [];
      } else {
        preferBoneTexture(skeletons);
      }
    }

    if (hasSkeleton && !boneDriven) {
      // Last resort for broken Tripo-style skins with no usable bones.
      const baked = bakeRigidFromImport(scene, result.meshes as AbstractMesh[], model, name);
      if (baked.length) {
        displayMeshes = baked;
        rigidGlb = true;
        if (rootScaleZ < 0) {
          model.scaling.z = -Math.abs(model.scaling.z || 1);
        }
        if (importRoot) {
          importRoot.setEnabled(false);
          if ('isVisible' in importRoot) {
            (importRoot as AbstractMesh).isVisible = false;
          }
        }
        for (const sk of skeletons) {
          try {
            sk.dispose?.();
          } catch {
            // ignore
          }
        }
        for (const g of animationGroups) {
          try {
            g.dispose?.();
          } catch {
            // ignore
          }
        }
        console.warn('[lobby-sdk] GLB skin baked to rigid mesh (skeleton unusable)', {
          glbUrl,
          skeletons: skeletons.length,
          baked: baked.length,
        });
      } else if (importRoot) {
        importRoot.parent = model;
      }
    } else if (!hasSkeleton && importRoot) {
      importRoot.parent = model;
      rigidGlb = true;
    }

    for (const mesh of displayMeshes) {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.receiveShadows = false;
    }

    fitGlbToHumanHeight(model, displayMeshes);
    {
      const tHarden = performance.now();
      hardenAvatarMaterials(displayMeshes);
      if (isLobbyPerfDiagEnabled()) {
        lobbyPerfMark('harden_materials', performance.now() - tHarden);
      }
    }
    padSkinnedBounds(displayMeshes);
    trimAvatarMapsForLowEndDevices(scene, displayMeshes);

    // Built after fitting so the sampled bone axes match the final transforms.
    const tRig = performance.now();
    const humanoid = boneDriven
      ? buildHumanoidBoneRig(visual, skeletons, transformNodes) ?? undefined
      : undefined;
    if (isLobbyPerfDiagEnabled() && boneDriven) {
      lobbyPerfMark('humanoid_bind', performance.now() - tRig);
    }

    console.info('[lobby-sdk] GLB loaded', {
      glbUrl,
      hasSkeleton,
      boneDriven,
      humanoid: !!humanoid,
      rigidGlb,
      display: displayMeshes.map((m) => m.name),
    });

    const torso = limbRig?.torso ?? emptyPivot(scene, `${name}-torso`, visual, 1.18);
    const head = limbRig?.head ?? emptyPivot(scene, `${name}-head-pivot`, visual, 1.78);
    const armL = limbRig?.armL ?? emptyPivot(scene, `${name}-arm-l`, visual, 1.48);
    if (!limbRig) armL.position.x = -0.5;
    const armR = limbRig?.armR ?? emptyPivot(scene, `${name}-arm-r`, visual, 1.48);
    if (!limbRig) armR.position.x = 0.5;
    const legL = limbRig?.legL ?? emptyPivot(scene, `${name}-leg-l`, visual, 0.9);
    if (!limbRig) legL.position.x = -0.18;
    const legR = limbRig?.legR ?? emptyPivot(scene, `${name}-leg-r`, visual, 0.9);
    if (!limbRig) legR.position.x = 0.18;

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
      sourceClips: boneDriven ? animationGroups : clips,
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
}
