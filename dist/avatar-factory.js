import { Color3, Matrix, Mesh, MeshBuilder, SceneLoader, StandardMaterial, TransformNode, Vector3 as BVector3, VertexBuffer, VertexData, } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { attachNameTag } from './name-tag';
const PRESET_LOOKS = {
    'default-1': { bodyColor: '#6366f1', accentColor: '#fbbf24', pantsColor: '#1e3a5f', hairColor: '#312e81' },
    'default-2': { bodyColor: '#22c55e', accentColor: '#fde68a', pantsColor: '#14532d', hairColor: '#166534' },
    'default-3': { bodyColor: '#f97316', accentColor: '#fecaca', pantsColor: '#7c2d12', hairColor: '#9a3412' },
    'default-4': { bodyColor: '#64748b', accentColor: '#e2e8f0', pantsColor: '#0f172a', hairColor: '#334155' },
};
function colorFromConfig(value, fallback) {
    return Color3.FromHexString(typeof value === 'string' ? value : fallback);
}
function solid(scene, id, hex) {
    const m = new StandardMaterial(id, scene);
    m.diffuseColor = hex;
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    return m;
}
function box(scene, name, size, material, parent, local) {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.material = material;
    mesh.parent = parent;
    mesh.position.set(local.x, local.y, local.z);
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    return mesh;
}
function resolveGlbUrl(avatar) {
    if (avatar.presetKind !== 'glb')
        return null;
    const config = (avatar.customConfig ?? {});
    const url = config.glbUrl;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
}
function fitGlbToHumanHeight(model, meshes, targetHeight = 1.85) {
    if (!meshes.length)
        return;
    model.computeWorldMatrix(true);
    for (const m of meshes)
        m.computeWorldMatrix(true);
    const { min, max } = model.getHierarchyBoundingVectors(true);
    const height = max.y - min.y;
    if (!(height > 0.01))
        return;
    const scale = targetHeight / height;
    model.scaling.setAll(scale);
    model.computeWorldMatrix(true);
    for (const m of meshes)
        m.computeWorldMatrix(true);
    // Keep feet on y=0 of the parent visual (animator may reset visual.y).
    const fitted = model.getHierarchyBoundingVectors(true);
    model.position.y -= fitted.min.y;
}
function simplifyGlbMaterials(meshes, scene) {
    for (const mesh of meshes) {
        const mat = mesh.material;
        if (!mat)
            continue;
        const className = mat.getClassName?.() ?? '';
        if (className.includes('PBR')) {
            const anyMat = mat;
            const std = new StandardMaterial(`${anyMat.name || mesh.name}-std`, scene);
            std.diffuseColor = anyMat.albedoColor?.clone() ?? new Color3(0.75, 0.75, 0.78);
            std.emissiveColor = anyMat.emissiveColor?.clone() ?? new Color3(0, 0, 0);
            if (anyMat.albedoTexture)
                std.diffuseTexture = anyMat.albedoTexture;
            std.specularColor = new Color3(0.08, 0.08, 0.08);
            std.maxSimultaneousLights = 4;
            mesh.material = std;
            try {
                anyMat.dispose(false, false);
            }
            catch {
                // ignore
            }
            continue;
        }
        const lit = mat;
        if (typeof lit.maxSimultaneousLights === 'number') {
            lit.maxSimultaneousLights = 4;
        }
    }
}
function emptyPivot(scene, name, parent, y) {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.position.y = y;
    return n;
}
function classifyBodyPart(nx, ny) {
    // Normalized AABB: ny=0 feet, ny=1 head. Tuned for blocky Roblox-style meshes.
    if (ny > 0.74)
        return 'head';
    if (ny < 0.42)
        return nx < 0.5 ? 'legL' : 'legR';
    if (nx < 0.24)
        return 'armL';
    if (nx > 0.76)
        return 'armR';
    return 'torso';
}
/**
 * Split a rigid (unskinned) GLB into limb meshes parented to the same pivots
 * HumanoidAnimator already drives for procedural avatars.
 */
function segmentUnskinnedGlbToRig(scene, sourceMeshes, visual, name) {
    visual.computeWorldMatrix(true);
    const invVisual = Matrix.Invert(visual.getWorldMatrix());
    const parts = {
        torso: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
        head: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
        armL: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
        armR: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
        legL: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
        legR: { positions: [], indices: [], uvs: [], map: new Map(), material: null },
    };
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    const worldVerts = [];
    for (const mesh of sourceMeshes) {
        if (!(mesh instanceof Mesh))
            continue;
        const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (!pos || pos.length < 9)
            continue;
        mesh.computeWorldMatrix(true);
        const wm = mesh.getWorldMatrix();
        const locals = [];
        for (let i = 0; i < pos.length; i += 3) {
            const world = BVector3.TransformCoordinates(new BVector3(pos[i], pos[i + 1], pos[i + 2]), wm);
            const local = BVector3.TransformCoordinates(world, invVisual);
            locals.push({ x: local.x, y: local.y, z: local.z });
            if (local.x < minX)
                minX = local.x;
            if (local.y < minY)
                minY = local.y;
            if (local.z < minZ)
                minZ = local.z;
            if (local.x > maxX)
                maxX = local.x;
            if (local.y > maxY)
                maxY = local.y;
            if (local.z > maxZ)
                maxZ = local.z;
        }
        worldVerts.push(locals);
    }
    const height = maxY - minY;
    const width = maxX - minX;
    if (!(height > 0.05) || !(width > 0.05) || worldVerts.length === 0)
        return null;
    let meshIdx = 0;
    for (const mesh of sourceMeshes) {
        if (!(mesh instanceof Mesh))
            continue;
        const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (!pos || pos.length < 9)
            continue;
        const locals = worldVerts[meshIdx++];
        const indices = mesh.getIndices();
        if (!indices || indices.length < 3)
            continue;
        const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
        // Fresh index remap per source mesh (indices are local to each mesh).
        for (const part of Object.values(parts))
            part.map.clear();
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i];
            const b = indices[i + 1];
            const c = indices[i + 2];
            const pa = locals[a];
            const pb = locals[b];
            const pc = locals[c];
            if (!pa || !pb || !pc)
                continue;
            const cx = (pa.x + pb.x + pc.x) / 3;
            const cy = (pa.y + pb.y + pc.y) / 3;
            const nx = (cx - minX) / width;
            const ny = (cy - minY) / height;
            const part = parts[classifyBodyPart(nx, ny)];
            if (!part.material)
                part.material = mesh.material;
            const pushVert = (vi) => {
                const existing = part.map.get(vi);
                if (existing !== undefined)
                    return existing;
                const p = locals[vi];
                const idx = part.positions.length / 3;
                part.positions.push(p.x, p.y, p.z);
                if (uvs && uvs.length >= (vi + 1) * 2) {
                    part.uvs.push(uvs[vi * 2], uvs[vi * 2 + 1]);
                }
                part.map.set(vi, idx);
                return idx;
            };
            part.indices.push(pushVert(a), pushVert(b), pushVert(c));
        }
    }
    const pivotDefs = {
        torso: { x: 0, y: 1.18 },
        head: { x: 0, y: 1.78 },
        armL: { x: -0.5, y: 1.48 },
        armR: { x: 0.5, y: 1.48 },
        legL: { x: -0.18, y: 0.9 },
        legR: { x: 0.18, y: 0.9 },
    };
    const rigNodes = {};
    let built = 0;
    Object.keys(parts).forEach((id) => {
        const pivot = emptyPivot(scene, `${name}-${id}`, visual, pivotDefs[id].y);
        pivot.position.x = pivotDefs[id].x;
        rigNodes[id] = pivot;
        const acc = parts[id];
        if (acc.positions.length < 9 || acc.indices.length < 3)
            return;
        // Vertex positions are in visual space — convert to pivot-local.
        for (let i = 0; i < acc.positions.length; i += 3) {
            acc.positions[i] -= pivotDefs[id].x;
            acc.positions[i + 1] -= pivotDefs[id].y;
        }
        const mesh = new Mesh(`${name}-${id}-mesh`, scene);
        const vd = new VertexData();
        vd.positions = acc.positions;
        vd.indices = acc.indices;
        if (acc.uvs.length === (acc.positions.length / 3) * 2)
            vd.uvs = acc.uvs;
        const nrm = [];
        VertexData.ComputeNormals(acc.positions, acc.indices, nrm);
        vd.normals = nrm;
        vd.applyToMesh(mesh);
        mesh.material = acc.material;
        mesh.parent = pivot;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        built += 1;
    });
    if (built < 3) {
        for (const id of Object.keys(rigNodes)) {
            rigNodes[id].dispose();
        }
        return null;
    }
    for (const mesh of sourceMeshes) {
        mesh.setEnabled(false);
        mesh.isVisible = false;
    }
    return rigNodes;
}
export class AvatarFactory {
    static create(scene, avatar, name = 'avatar', displayName, username, options = {}) {
        const fromPreset = PRESET_LOOKS[avatar.presetKey] ?? PRESET_LOOKS['default-1'];
        const config = {
            ...fromPreset,
            ...avatar.customConfig,
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
        let collider = null;
        let root = visual;
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
        }
        else if (options.collider === 'body') {
            collider = MeshBuilder.CreateBox(`${name}-bodycol`, { width: 0.12, height: 0.12, depth: 0.12 }, scene);
            collider.isVisible = false;
            collider.isPickable = false;
            collider.checkCollisions = false;
            visual.parent = collider;
            visual.position.set(0, 0, 0);
            root = collider;
        }
        root.name = name;
        const rig = { root, visual, collider, torso, head, armL, armR, legL, legR };
        root.metadata = { ...(root.metadata ?? {}), rig };
        return root;
    }
    /** Procedural sync create, or GLB load when presetKind is glb + glbUrl. */
    static async createAsync(scene, avatar, name = 'avatar', displayName, username, options = {}) {
        const glbUrl = resolveGlbUrl(avatar);
        console.info('[lobby-sdk] avatar createAsync', {
            presetKey: avatar.presetKey,
            presetKind: avatar.presetKind,
            glbUrl,
        });
        if (!glbUrl) {
            return AvatarFactory.create(scene, avatar, name, displayName, username, options);
        }
        const candidates = [glbUrl];
        try {
            const absolute = new URL(glbUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
            if (absolute.pathname && absolute.pathname !== glbUrl) {
                candidates.push(absolute.pathname);
            }
        }
        catch {
            // ignore
        }
        let lastError;
        for (const url of candidates) {
            try {
                return await AvatarFactory.createFromGlb(scene, url, name, displayName, username, options);
            }
            catch (err) {
                lastError = err;
                console.warn('[lobby-sdk] GLB avatar load failed, trying next URL', url, err);
            }
        }
        console.warn('[lobby-sdk] GLB avatar failed, falling back to procedural', glbUrl, lastError);
        return AvatarFactory.create(scene, avatar, name, displayName, username, options);
    }
    static async createFromGlb(scene, glbUrl, name, displayName, username, options) {
        const visual = new TransformNode(`${name}-visual`, scene);
        // Separate model node so HumanoidAnimator can freely set visual.position.y
        // without undoing the "feet on ground" offset.
        const model = new TransformNode(`${name}-model`, scene);
        model.parent = visual;
        const slash = glbUrl.lastIndexOf('/');
        const rootUrl = slash >= 0 ? glbUrl.slice(0, slash + 1) : '';
        const fileName = slash >= 0 ? glbUrl.slice(slash + 1) : glbUrl;
        const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
        const importedRoot = result.meshes[0];
        if (importedRoot) {
            importedRoot.parent = model;
            importedRoot.position.set(0, 0, 0);
        }
        for (const mesh of result.meshes) {
            mesh.isPickable = false;
            mesh.checkCollisions = false;
        }
        fitGlbToHumanHeight(model, result.meshes);
        simplifyGlbMaterials(result.meshes, scene);
        // Unskinned demo GLBs have no bones — split mesh into limb parts so the
        // same HumanoidAnimator poses (walk / jump / slide) drive the look.
        const segmented = segmentUnskinnedGlbToRig(scene, result.meshes, visual, name);
        let torso;
        let head;
        let armL;
        let armR;
        let legL;
        let legR;
        let forceProceduralAnim = false;
        if (segmented) {
            ({ torso, head, armL, armR, legL, legR } = segmented);
            forceProceduralAnim = true;
            model.setEnabled(false);
        }
        else {
            torso = emptyPivot(scene, `${name}-torso`, visual, 1.18);
            head = emptyPivot(scene, `${name}-head-pivot`, visual, 1.78);
            armL = emptyPivot(scene, `${name}-arm-l`, visual, 1.48);
            armL.position.x = -0.5;
            armR = emptyPivot(scene, `${name}-arm-r`, visual, 1.48);
            armR.position.x = 0.5;
            legL = emptyPivot(scene, `${name}-leg-l`, visual, 0.9);
            legL.position.x = -0.18;
            legR = emptyPivot(scene, `${name}-leg-r`, visual, 0.9);
            legR.position.x = 0.18;
        }
        attachNameTag(scene, visual, displayName ?? '', username ?? '', name);
        let collider = null;
        let root = visual;
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
        }
        else if (options.collider === 'body') {
            collider = MeshBuilder.CreateBox(`${name}-bodycol`, { width: 0.12, height: 0.12, depth: 0.12 }, scene);
            collider.isVisible = false;
            collider.isPickable = false;
            collider.checkCollisions = false;
            visual.parent = collider;
            visual.position.set(0, 0, 0);
            root = collider;
        }
        root.name = name;
        const groups = forceProceduralAnim ? [] : (result.animationGroups ?? []);
        const rig = { root, visual, collider, torso, head, armL, armR, legL, legR };
        root.metadata = {
            ...(root.metadata ?? {}),
            rig,
            animationGroups: groups,
            glbModel: model,
            forceProceduralAnim,
        };
        return root;
    }
    static getRig(root) {
        return root.metadata?.rig ?? null;
    }
    static getAnimationGroups(root) {
        const groups = root.metadata?.animationGroups;
        return groups?.length ? groups : undefined;
    }
    static setPosition(root, position) {
        root.position = new BVector3(position.x, position.y, position.z);
    }
    static setRotationY(root, rotationY) {
        const rig = AvatarFactory.getRig(root);
        const target = rig?.visual ?? root;
        target.rotation.y = rotationY;
    }
}
//# sourceMappingURL=avatar-factory.js.map