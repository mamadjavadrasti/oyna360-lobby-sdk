import { captureRealDeviceInfo, } from './lobby-real-device-diag';
import { sampleAvatarRender, } from './lobby-perf-diag';
/** Subsystems measured via mesh visibility leave-one-out. */
export const PLAZA_MESH_SUBSYSTEMS = [
    'plaza_ground',
    'fountain',
    'shops',
    'nature',
    'rooms',
    'playground',
    'npcs',
    'colliders',
    'avatars',
    'base_ground',
    'other',
];
function rootOf(node) {
    let n = node;
    while (n.parent && typeof n.parent === 'object') {
        n = n.parent;
    }
    return n;
}
function ancestorNames(node) {
    const names = [];
    let n = node;
    while (n) {
        if (n.name)
            names.push(n.name);
        n =
            n.parent && typeof n.parent === 'object'
                ? n.parent
                : null;
    }
    return names;
}
/** Classify a mesh into a Plaza diagnostic bucket (name/metadata + ancestry). */
export function classifyPlazaMesh(mesh) {
    const name = mesh.name || '';
    const lower = name.toLowerCase();
    const ancestors = ancestorNames(mesh);
    const rootName = rootOf(mesh).name || name;
    if (lower.includes('-phys') ||
        lower.includes('-rail-') ||
        lower.endsWith('-charcol') ||
        lower.endsWith('-bodycol') ||
        name === 'fountain-blocker' ||
        ancestors.some((a) => a.includes('-phys') ||
            a.includes('-rail-') ||
            a.endsWith('-charcol') ||
            a.endsWith('-bodycol') ||
            a === 'fountain-blocker')) {
        return 'colliders';
    }
    const underNpc = ancestors.some((a) => a.startsWith('plaza-npc-') || a.startsWith('npc-'));
    const underAvatar = ancestors.some((a) => a === 'local-player' || a.startsWith('remote-')) ||
        !!mesh.metadata?.isLobbyAvatar ||
        !!mesh.metadata?.isLobbyAvatarRoot;
    if (underNpc)
        return 'npcs';
    if (underAvatar)
        return 'avatars';
    if (ancestors.some((a) => a.startsWith('shop-') || a.startsWith('shop-root-')))
        return 'shops';
    if (ancestors.some((a) => a.startsWith('room-') || a.startsWith('room-root-')))
        return 'rooms';
    if (ancestors.some((a) => a.startsWith('playground-')))
        return 'playground';
    if (ancestors.some((a) => a.startsWith('tree-') ||
        a.startsWith('bush-') ||
        a.startsWith('rock-') ||
        a.startsWith('lamp-') ||
        a.startsWith('bench-'))) {
        return 'nature';
    }
    if (ancestors.some((a) => a.startsWith('fountain-') || a === 'plaza-center'))
        return 'fountain';
    if (name === 'ground')
        return 'base_ground';
    if (name === 'grass-ground' ||
        name === 'plaza-pavement' ||
        name === 'plaza-ring' ||
        name.startsWith('path-') ||
        name.startsWith('edge-tile-')) {
        return 'plaza_ground';
    }
    if (name.startsWith('fountain-') || name === 'plaza-center')
        return 'fountain';
    if (name.startsWith('shop-') || name.startsWith('shop-root-'))
        return 'shops';
    if (name.startsWith('tree-') ||
        name.startsWith('bush-') ||
        name.startsWith('rock-') ||
        name.startsWith('lamp-') ||
        name.startsWith('bench-')) {
        return 'nature';
    }
    if (name.startsWith('room-') || name.startsWith('room-root-'))
        return 'rooms';
    if (name.startsWith('playground-'))
        return 'playground';
    // Catch-all for unlabeled avatar/npc debris by root name
    if (rootName.startsWith('plaza-npc-') || rootName.startsWith('npc-'))
        return 'npcs';
    if (rootName === 'local-player' || rootName.startsWith('remote-'))
        return 'avatars';
    return 'other';
}
function meshActive(mesh) {
    if (mesh.isDisposed())
        return false;
    if (!mesh.isEnabled() || mesh.isVisible === false || (mesh.visibility ?? 1) <= 0)
        return false;
    const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
    return v > 0;
}
function meshTris(mesh) {
    const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
    const idx = typeof mesh.getIndices === 'function' ? mesh.getIndices() : null;
    if (idx?.length)
        return Math.floor(idx.length / 3);
    return Math.floor(v / 3);
}
export function inventoryPlazaSubsystems(scene) {
    const buckets = new Map();
    const ensure = (id) => {
        let b = buckets.get(id);
        if (!b) {
            b = {
                id,
                meshCount: 0,
                activeMeshCount: 0,
                triangleApprox: 0,
                vertexApprox: 0,
                materialIds: 0,
                sampleNames: [],
            };
            buckets.set(id, b);
        }
        return b;
    };
    for (const id of PLAZA_MESH_SUBSYSTEMS)
        ensure(id);
    const matsBySys = new Map();
    for (const mesh of scene.meshes) {
        if (mesh.isDisposed())
            continue;
        const id = classifyPlazaMesh(mesh);
        const b = ensure(id);
        b.meshCount += 1;
        if (b.sampleNames.length < 8)
            b.sampleNames.push(mesh.name);
        const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
        if (v <= 0)
            continue;
        if (meshActive(mesh)) {
            b.activeMeshCount += 1;
            b.triangleApprox += meshTris(mesh);
            b.vertexApprox += v;
            const mid = mesh.material?.uniqueId != null ? String(mesh.material.uniqueId) : mesh.material?.name;
            if (mid) {
                let set = matsBySys.get(id);
                if (!set) {
                    set = new Set();
                    matsBySys.set(id, set);
                }
                set.add(mid);
            }
        }
    }
    for (const [id, set] of matsBySys) {
        ensure(id).materialIds = set.size;
    }
    return PLAZA_MESH_SUBSYSTEMS.map((id) => ensure(id));
}
function isPlazaPointLight(name) {
    return (name.startsWith('lamp-light-') ||
        name.startsWith('room-light-') ||
        name === 'fountain-light' ||
        name.startsWith('playground-trampoline-light'));
}
function setSubsystemMeshesVisible(scene, id, visible) {
    const saved = [];
    for (const mesh of scene.meshes) {
        if (mesh.isDisposed())
            continue;
        if (classifyPlazaMesh(mesh) !== id)
            continue;
        saved.push({
            mesh,
            enabled: mesh.isEnabled(),
            visible: mesh.isVisible !== false,
            visibility: mesh.visibility ?? 1,
        });
        mesh.setEnabled(visible);
        mesh.isVisible = visible;
        if (!visible)
            mesh.visibility = 0;
    }
    return () => {
        for (const s of saved) {
            if (s.mesh.isDisposed())
                continue;
            s.mesh.setEnabled(s.enabled);
            s.mesh.isVisible = s.visible;
            s.mesh.visibility = s.visibility;
        }
    };
}
function setPlazaPointLightsEnabled(scene, enabled) {
    const saved = [];
    for (const light of scene.lights) {
        if (!isPlazaPointLight(light.name || ''))
            continue;
        saved.push({ light, enabled: light.isEnabled() });
        light.setEnabled(enabled);
    }
    return () => {
        for (const s of saved) {
            try {
                s.light.setEnabled(s.enabled);
            }
            catch {
                /* ignore */
            }
        }
    };
}
function setPlazaPostProcessEnabled(scene, enabled) {
    const meta = (scene.metadata ?? {});
    const glow = meta.plazaGlow;
    const fx = meta.plazaFx ?? null;
    const save = {
        glowIntensity: glow ? glow.intensity : null,
        bloomEnabled: fx && typeof fx.bloomEnabled === 'boolean' ? fx.bloomEnabled : null,
        fxaaEnabled: fx && typeof fx.fxaaEnabled === 'boolean' ? fx.fxaaEnabled : null,
    };
    if (glow)
        glow.intensity = enabled ? (save.glowIntensity ?? 0.28) : 0;
    if (fx && save.bloomEnabled != null)
        fx.bloomEnabled = enabled ? save.bloomEnabled : false;
    if (fx && save.fxaaEnabled != null && !enabled)
        fx.fxaaEnabled = false;
    return () => {
        if (glow && save.glowIntensity != null)
            glow.intensity = save.glowIntensity;
        if (fx && save.bloomEnabled != null)
            fx.bloomEnabled = save.bloomEnabled;
        if (fx && save.fxaaEnabled != null)
            fx.fxaaEnabled = save.fxaaEnabled;
    };
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function compactSample(s) {
    if (!s)
        return null;
    return {
        label: s.label,
        fpsAvg: s.series.avgFps,
        frameAvg: s.series.avgFrameTimeMs,
        frameP95: s.series.p95FrameTimeMs,
        frameP99: s.series.p99FrameTimeMs,
        frameMax: s.series.maxFrameTimeMs,
        sceneRenderAvg: s.phases.scene_render?.avgMs ?? null,
        sceneRenderP95: s.phases.scene_render?.p95Ms ?? null,
        sceneRenderMax: s.phases.scene_render?.maxMs ?? null,
        activeMeshes: s.avatarCosts.sceneActiveMeshCount,
        triangles: s.avatarCosts.sceneTriangleApprox,
        vertices: s.avatarCosts.sceneVertexApprox,
        materials: s.avatarCosts.sceneMaterialCount,
        textures: s.avatarCosts.sceneTextureCount,
        skeletons: s.avatarCosts.sceneSkeletonCount,
        bones: s.avatarCosts.sceneBoneCount,
        drawCallsApprox: s.avatarCosts.sceneDrawCallsApprox,
    };
}
function delta(full, other) {
    if (!full || !other)
        return null;
    const sub = (a, b) => a == null || b == null ? null : a - b;
    return {
        activeMeshes: sub(full.activeMeshes, other.activeMeshes),
        triangles: sub(full.triangles, other.triangles),
        sceneRenderAvg: sub(full.sceneRenderAvg, other.sceneRenderAvg),
        frameAvg: sub(full.frameAvg, other.frameAvg),
    };
}
function buildAssessment(inventory, leaveOneOut, post, lights) {
    const evidence = [];
    const byActive = [...inventory]
        .filter((i) => i.activeMeshCount > 0)
        .sort((a, b) => b.activeMeshCount - a.activeMeshCount);
    const totalActive = byActive.reduce((s, i) => s + i.activeMeshCount, 0) || 1;
    const topMesh = byActive[0];
    if (topMesh) {
        evidence.push(`Inventory: ${topMesh.id} owns ${topMesh.activeMeshCount}/${totalActive} active meshes (${((100 * topMesh.activeMeshCount) / totalActive).toFixed(1)}%), ~${topMesh.triangleApprox} tris.`);
    }
    const top2 = byActive[1];
    if (top2) {
        evidence.push(`Inventory #2: ${top2.id} owns ${top2.activeMeshCount} active meshes (~${((100 * top2.activeMeshCount) / totalActive).toFixed(1)}%).`);
    }
    const byRender = [...leaveOneOut]
        .filter((s) => s.deltaFromFull?.sceneRenderAvg != null)
        .sort((a, b) => (b.deltaFromFull.sceneRenderAvg ?? 0) - (a.deltaFromFull.sceneRenderAvg ?? 0));
    const topCost = byRender[0];
    if (topCost?.deltaFromFull?.sceneRenderAvg != null) {
        evidence.push(`Leave-one-out scene_render Δ: hiding ${topCost.id} reduced scene_render by ${topCost.deltaFromFull.sceneRenderAvg.toFixed(2)}ms (frame Δ ${topCost.deltaFromFull.frameAvg?.toFixed(2) ?? 'n/a'}ms).`);
    }
    const topCost2 = byRender[1];
    if (topCost2?.deltaFromFull?.sceneRenderAvg != null) {
        evidence.push(`Leave-one-out #2: ${topCost2.id} scene_render Δ ${topCost2.deltaFromFull.sceneRenderAvg.toFixed(2)}ms.`);
    }
    if (post?.deltaFromFull?.sceneRenderAvg != null) {
        evidence.push(`Post-process off scene_render Δ ${post.deltaFromFull.sceneRenderAvg.toFixed(2)}ms.`);
    }
    if (lights?.deltaFromFull?.sceneRenderAvg != null) {
        evidence.push(`Plaza point-lights off scene_render Δ ${lights.deltaFromFull.sceneRenderAvg.toFixed(2)}ms.`);
    }
    const primary = topCost && (topCost.deltaFromFull?.sceneRenderAvg ?? 0) > 0.15
        ? topCost.id
        : topMesh?.id ?? 'unknown';
    let secondary = topCost2?.id ?? top2?.id ?? 'unknown';
    if (post?.deltaFromFull?.sceneRenderAvg != null &&
        (post.deltaFromFull.sceneRenderAvg ?? 0) >
            (topCost2?.deltaFromFull?.sceneRenderAvg ?? -Infinity)) {
        secondary = 'post_process_glow_bloom';
    }
    if (lights?.deltaFromFull?.sceneRenderAvg != null &&
        (lights.deltaFromFull.sceneRenderAvg ?? 0) >
            (topCost2?.deltaFromFull?.sceneRenderAvg ?? -Infinity) &&
        secondary !== 'post_process_glow_bloom') {
        // Prefer larger of post vs lights for secondary if bigger than mesh #2
        if (!post ||
            (lights.deltaFromFull.sceneRenderAvg ?? 0) >= (post.deltaFromFull?.sceneRenderAvg ?? 0)) {
            secondary = 'plaza_point_lights';
        }
    }
    const meshDominant = topMesh && topMesh.activeMeshCount / totalActive >= 0.25;
    const renderAligned = topCost && topMesh && (topCost.id === topMesh.id || topCost.id === top2?.id);
    const confidence = meshDominant && renderAligned ? 'high' : meshDominant || topCost ? 'medium' : 'low';
    return {
        primarySuspectedBottleneck: primary,
        secondarySuspectedBottleneck: secondary,
        evidence,
        confidence,
    };
}
/**
 * Full Plaza diagnostic suite. Restores all toggles before return.
 */
export async function runPlazaDiagSuite(scene, engine, options = {}) {
    const sampleMs = options.sampleMs ?? 2200;
    const notes = [
        'Isolation uses temporary mesh visibility / light / post-FX toggles; production defaults restored.',
        'No ShadowGenerator is present in SceneManager; plaza meshes mostly receiveShadows=false.',
        'Stages 8–9 often used npcCount:0; this suite expects a full applyPlazaLayout (default NPCs) + playground.',
    ];
    const inventory = inventoryPlazaSubsystems(scene);
    const inventoryTotals = {
        activeMeshes: inventory.reduce((s, i) => s + i.activeMeshCount, 0),
        triangles: inventory.reduce((s, i) => s + i.triangleApprox, 0),
        meshCount: inventory.reduce((s, i) => s + i.meshCount, 0),
    };
    const otherInv = inventory.find((i) => i.id === 'other');
    if (otherInv && otherInv.activeMeshCount > 20) {
        notes.push(`Unclassified "other" still has ${otherInv.activeMeshCount} active meshes (samples: ${otherInv.sampleNames.join(', ')}).`);
    }
    const avatarBasesAvailable = [
        {
            id: 'demo-hoodie',
            glbUrl: '/avatars/demo/demo-hoodie.glb',
            note: 'Only public GLB base shipped under apps/web/public/avatars',
        },
    ];
    await sleep(400);
    const fullSample = await sampleAvatarRender(scene, engine, 'plaza_full', sampleMs);
    const baseline = compactSample(fullSample);
    const leaveOneOut = [];
    let postProcessOff = null;
    let plazaLightsOff = null;
    let emptyish = null;
    if (!options.inventoryOnly) {
        const hideOrder = [
            'nature',
            'shops',
            'rooms',
            'playground',
            'fountain',
            'plaza_ground',
            'npcs',
            'colliders',
            'avatars',
        ];
        for (const id of hideOrder) {
            const inv = inventory.find((i) => i.id === id) ?? null;
            if (inv && inv.activeMeshCount === 0 && inv.meshCount === 0) {
                leaveOneOut.push({
                    id,
                    note: 'no meshes classified — skipped sample',
                    inventory: inv,
                    metrics: null,
                    deltaFromFull: null,
                });
                continue;
            }
            const restore = setSubsystemMeshesVisible(scene, id, false);
            try {
                await sleep(250);
                const sample = compactSample(await sampleAvatarRender(scene, engine, `plaza_hide_${id}`, sampleMs));
                leaveOneOut.push({
                    id,
                    note: `leave-one-out: hide ${id} only`,
                    inventory: inv,
                    metrics: sample,
                    deltaFromFull: delta(baseline, sample),
                });
            }
            finally {
                restore();
                await sleep(150);
            }
        }
        {
            const restore = setPlazaPostProcessEnabled(scene, false);
            try {
                await sleep(250);
                const sample = compactSample(await sampleAvatarRender(scene, engine, 'plaza_post_off', sampleMs));
                postProcessOff = {
                    id: 'post_process_glow_bloom',
                    note: 'Glow intensity 0 + bloom/FXAA off (restored after)',
                    metrics: sample,
                    deltaFromFull: delta(baseline, sample),
                };
            }
            finally {
                restore();
                await sleep(150);
            }
        }
        {
            const restore = setPlazaPointLightsEnabled(scene, false);
            try {
                await sleep(250);
                const sample = compactSample(await sampleAvatarRender(scene, engine, 'plaza_lights_off', sampleMs));
                plazaLightsOff = {
                    id: 'plaza_point_lights',
                    note: 'Disable plaza PointLights (lamp/room/fountain/playground); keep hemi+moon',
                    metrics: sample,
                    deltaFromFull: delta(baseline, sample),
                };
            }
            finally {
                restore();
                await sleep(150);
            }
        }
        {
            const restores = [
                'nature',
                'shops',
                'rooms',
                'playground',
                'fountain',
                'plaza_ground',
                'npcs',
                'colliders',
                'avatars',
            ].map((id) => setSubsystemMeshesVisible(scene, id, false));
            const restoreLights = setPlazaPointLightsEnabled(scene, false);
            const restorePost = setPlazaPostProcessEnabled(scene, false);
            try {
                await sleep(250);
                const sample = compactSample(await sampleAvatarRender(scene, engine, 'plaza_emptyish', sampleMs));
                emptyish = {
                    id: 'emptyish_base_only',
                    note: 'Hide plaza content + NPCs + avatars + plaza lights + post; leave base ground/hemi/moon',
                    metrics: sample,
                    deltaFromFull: delta(baseline, sample),
                };
            }
            finally {
                restorePost();
                restoreLights();
                for (const r of restores)
                    r();
                await sleep(150);
            }
        }
    }
    const assessment = buildAssessment(inventory, leaveOneOut, postProcessOff, plazaLightsOff);
    return {
        meta: {
            at: new Date().toISOString(),
            purpose: options.purpose ?? 'phase-10-plaza-performance-diagnostic',
            stage: 10,
            sampleMs,
            method: 'inventory + leave-one-out visibility + post/lights isolation',
        },
        device: captureRealDeviceInfo(engine),
        inventory,
        inventoryTotals,
        baseline,
        leaveOneOut,
        postProcessOff,
        plazaLightsOff,
        emptyish,
        avatarBasesAvailable,
        avatarVariation: {
            limitation: 'Only one public GLB base exists (demo-hoodie). Harness aliases a.glb/b.glb are the same file. No additional registered bases to spawn for Plaza consistency checks without inventing assets.',
            testedBases: ['demo-hoodie'],
            samples: [
                {
                    id: 'avatar_base_demo_hoodie_only',
                    note: 'Local player uses demo-hoodie; multi-base variation skipped due to single shipped GLB.',
                    metrics: baseline,
                    deltaFromFull: null,
                },
            ],
        },
        assessment,
        notes,
    };
}
/** Attach plaza suite onto `__OYNA360_LOBBY_PERF__` (additive). */
export function attachPlazaDiag(getScene, getEngine, handle, win = window) {
    const extended = handle;
    extended.plazaInventory = () => inventoryPlazaSubsystems(getScene());
    extended.runPlazaSuite = (options) => runPlazaDiagSuite(getScene(), getEngine(), options);
    win.__OYNA360_LOBBY_PERF__ = extended;
    return extended;
}
//# sourceMappingURL=lobby-plaza-diag.js.map