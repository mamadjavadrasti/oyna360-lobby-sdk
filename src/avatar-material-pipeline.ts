import {
  Color3,
  Material,
  Mesh,
  Scene,
  Texture,
  TransformNode,
} from '@babylonjs/core';
import type { AbstractMesh, BaseTexture } from '@babylonjs/core';
import {
  isTouchDevice,
  shouldTrimAvatarDetailMaps,
  type LobbyQualityLevel,
} from './quality';
import { assetCacheKey } from './avatar-asset-manager';

export function readTintFromConfig(config: Record<string, unknown> | undefined): string | undefined {
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
// assetCacheKey lives in AvatarAssetManager (shared with GLB container cache).

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

export function lobbyQualityOf(scene: Scene): LobbyQualityLevel {
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

function stripCloneSuffix(name: string | undefined) {
  return (name ?? '').replace(/__a\d+$/, '');
}

function isImportRootName(name: string | undefined) {
  const base = stripCloneSuffix(name).toLowerCase();
  return base === '__root__' || base === 'world';
}

export function trimDetailMapsOnMaterials(meshes: AbstractMesh[]) {
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
export function trimAvatarMapsForLowEndDevices(scene: Scene, meshes: AbstractMesh[]) {
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

/** Facade over avatar material / texture helpers. */
export class AvatarMaterialPipeline {
  static harden(meshes: AbstractMesh[]) {
    hardenAvatarMaterials(meshes);
  }

  static applyTint(root: TransformNode, hex: string | undefined | null) {
    applyAvatarTint(root, hex);
  }

  static applyBaseAlbedo(root: TransformNode, textureUrl: string | null | undefined) {
    applyAvatarBaseAlbedo(root, textureUrl);
  }

  static trimForLowEnd(scene: Scene, meshes: AbstractMesh[]) {
    trimAvatarMapsForLowEndDevices(scene, meshes);
  }

  static trimDetailMapsOnMaterials(meshes: AbstractMesh[]) {
    trimDetailMapsOnMaterials(meshes);
  }

  static readTintFromConfig(config: Record<string, unknown> | undefined): string | undefined {
    return readTintFromConfig(config);
  }

  static readBaseAlbedoUrlFromConfig(
    customConfig: Record<string, unknown> | undefined | null,
  ): string | null {
    return readBaseAlbedoUrlFromConfig(customConfig);
  }
}
