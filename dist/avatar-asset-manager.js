/**
 * Avatar GLB asset loading + per-scene container cache + clone/instantiate.
 * Moved verbatim from AvatarFactory (phase-2 isolation). No behavior changes.
 */
import { SceneLoader, } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Meshes/Compression/dracoCompression';
import { ensureDracoDecoder } from './draco';
import { isLobbyPerfDiagEnabled, lobbyPerfMark, lobbyPerfTimeAsync } from './lobby-perf-diag';
import { yieldToRenderLoop } from './yield-to-render';
/** Same file on :3000/uploads vs :3001/uploads must share one GPU/container copy. */
export function assetCacheKey(url) {
    if (!url || url.startsWith('data:'))
        return url;
    try {
        const parsed = new URL(url, 'http://lobby.local');
        return parsed.pathname || url;
    }
    catch {
        return url;
    }
}
/** App-level base registry (not per-scene). Container cache remains per-scene. */
const avatarBaseRegistry = new Map();
/** One download + parse per avatar GLB per scene; every player clones from it. */
const glbContainerCache = new WeakMap();
let glbCloneSerial = 0;
function getSceneContainerMap(scene) {
    let byUrl = glbContainerCache.get(scene);
    if (!byUrl) {
        byUrl = new Map();
        glbContainerCache.set(scene, byUrl);
        scene.onDisposeObservable.addOnce(() => glbContainerCache.delete(scene));
    }
    return byUrl;
}
function loadGlbContainer(scene, glbUrl) {
    const byUrl = getSceneContainerMap(scene);
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
        const container = await SceneLoader.LoadAssetContainerAsync('', glbUrl, scene, null, 
        // A data URI carries no filename for the loader to sniff an extension from.
        glbUrl.startsWith('data:') ? '.glb' : undefined);
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
/**
 * Clone an avatar from the cached container instead of re-importing the file.
 * Geometry and textures are shared; materials and skeletons are per avatar, so
 * each player keeps their own colour variant and pose.
 *
 * Names MUST be unique. Babylon's instantiate looks up nodes by name; two
 * avatars named "Mesh0"/"Armature" make the second clone steal the first
 * skeleton — local body vanishes when someone else joins.
 */
async function instantiateGlb(scene, glbUrl) {
    const container = await loadGlbContainer(scene, glbUrl);
    // Container parse/Draco may resume on the main thread; yield so the lobby can paint
    // (remote placeholder) before the deep clone/instantiate spike.
    await yieldToRenderLoop();
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
    const meshes = [];
    const transformNodes = [];
    for (const rootNode of entries.rootNodes) {
        rootNode.setEnabled(true);
        for (const node of [rootNode, ...rootNode.getDescendants(false)]) {
            node.setEnabled(true);
            const mesh = node;
            if (typeof mesh.getTotalVertices === 'function') {
                mesh.isVisible = true;
                mesh.visibility = 1;
                meshes.push(mesh);
            }
            else {
                transformNodes.push(node);
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
        skeletons: entries.skeletons,
        animationGroups: entries.animationGroups,
    };
}
export class AvatarAssetManager {
    /** Load (or cache-hit) + clone one avatar GLB instance into the scene. */
    static instantiateAvatarGlb(scene, glbUrl) {
        return instantiateGlb(scene, glbUrl);
    }
    /** Expose container load for diagnostics/tests — same cache as instantiate. */
    static loadContainer(scene, glbUrl) {
        return loadGlbContainer(scene, glbUrl);
    }
    /**
     * Warm the per-scene container cache for an arbitrary GLB URL (no registry required).
     * Non-throwing — used when a remote joins with a base that was not pre-registered.
     */
    static async warmGlbUrl(scene, glbUrl) {
        const url = typeof glbUrl === 'string' ? glbUrl.trim() : '';
        if (!url)
            return null;
        try {
            return await loadGlbContainer(scene, url);
        }
        catch (err) {
            console.warn('[lobby-sdk] warmGlbUrl failed', url.slice(-64), err);
            return null;
        }
    }
    /** Register / replace a base avatar catalog entry (id → glbUrl). */
    static registerAvatarBase(def) {
        if (!def?.id || typeof def.glbUrl !== 'string' || !def.glbUrl.trim())
            return;
        avatarBaseRegistry.set(def.id, { id: def.id, glbUrl: def.glbUrl.trim() });
    }
    static registerAvatarBases(defs) {
        for (const def of defs)
            this.registerAvatarBase(def);
    }
    static getAvatarBase(id) {
        return avatarBaseRegistry.get(id);
    }
    static listAvatarBases() {
        return [...avatarBaseRegistry.values()];
    }
    /** True when this scene already has a (pending or resolved) container promise for the URL. */
    static isContainerCached(scene, glbUrl) {
        const byUrl = glbContainerCache.get(scene);
        if (!byUrl)
            return false;
        return byUrl.has(assetCacheKey(glbUrl));
    }
    static isAvatarBaseCached(scene, id) {
        const base = avatarBaseRegistry.get(id);
        if (!base)
            return false;
        return this.isContainerCached(scene, base.glbUrl);
    }
    /**
     * Warm the shared glbContainerCache for a registered base.
     * Reuses loadGlbContainer — no duplicate parse path. Failures resolve to null (non-throwing).
     */
    static async preloadAvatarBase(scene, id) {
        const base = avatarBaseRegistry.get(id);
        if (!base) {
            console.warn('[lobby-sdk] preloadAvatarBase: unknown base id', id);
            return null;
        }
        try {
            if (isLobbyPerfDiagEnabled()) {
                return await lobbyPerfTimeAsync('glb_preload', () => loadGlbContainer(scene, base.glbUrl), id);
            }
            return await loadGlbContainer(scene, base.glbUrl);
        }
        catch (err) {
            console.warn('[lobby-sdk] preloadAvatarBase failed', id, err);
            return null;
        }
    }
    /**
     * Preload one or more bases. Omitting ids preloads the full registry.
     * Uses Promise.allSettled semantics per id (one failure does not abort others).
     */
    static async preloadAvatarBases(scene, ids) {
        const list = ids?.length ? [...ids] : [...avatarBaseRegistry.keys()];
        const settled = await Promise.all(list.map(async (id) => {
            const container = await this.preloadAvatarBase(scene, id);
            return { id, ok: !!container };
        }));
        return settled;
    }
}
//# sourceMappingURL=avatar-asset-manager.js.map