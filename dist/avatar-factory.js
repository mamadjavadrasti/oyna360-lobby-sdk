import { Color3, Mesh, MeshBuilder, SceneLoader, StandardMaterial, TransformNode, Vector3 as BVector3, VertexBuffer, VertexData, } from '@babylonjs/core';
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
    for (const m of meshes) {
        m.computeWorldMatrix(true);
        try {
            m.refreshBoundingInfo?.(true, true);
        }
        catch {
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
            if (!(m instanceof Mesh))
                continue;
            const pos = m.getVerticesData(VertexBuffer.PositionKind);
            if (!pos)
                continue;
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
        if (!(height > 0.01))
            return;
        const scale = targetHeight / height;
        model.scaling.setAll(scale);
        model.position.y = -minY * scale;
        return;
    }
    const scale = targetHeight / height;
    model.scaling.setAll(scale);
    model.computeWorldMatrix(true);
    for (const m of meshes)
        m.computeWorldMatrix(true);
    const fitted = model.getHierarchyBoundingVectors(true);
    model.position.y -= fitted.min.y;
}
/**
 * Copy bind-pose geometry into a new non-skinned mesh.
 * Needed when Tripo/etc skeletons collapse in Babylon and GPU skinning explodes or hides the mesh.
 */
function bakeRigidFromImport(scene, sourceMeshes, parent, name) {
    const baked = [];
    for (const src of sourceMeshes) {
        if (!(src instanceof Mesh))
            continue;
        const positions = src.getVerticesData(VertexBuffer.PositionKind);
        if (!positions || positions.length < 9)
            continue;
        const indices = src.getIndices();
        if (!indices || indices.length < 3)
            continue;
        const mesh = new Mesh(`${name}-${src.name || 'geo'}-rigid`, scene);
        const vd = new VertexData();
        vd.positions = Array.from(positions);
        vd.indices = Array.from(indices);
        const normals = src.getVerticesData(VertexBuffer.NormalKind);
        if (normals && normals.length === positions.length) {
            vd.normals = Array.from(normals);
        }
        else {
            const nrm = [];
            VertexData.ComputeNormals(vd.positions, vd.indices, nrm);
            vd.normals = nrm;
        }
        const uvs = src.getVerticesData(VertexBuffer.UVKind);
        if (uvs)
            vd.uvs = Array.from(uvs);
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
function collectNamedTransforms(skeletons, transformNodes) {
    const out = [];
    for (const sk of skeletons) {
        for (const bone of sk.bones) {
            const tn = bone.getTransformNode?.() ?? null;
            if (tn)
                out.push({ name: bone.name, node: tn });
        }
    }
    for (const tn of transformNodes) {
        out.push({ name: tn.name, node: tn });
    }
    return out;
}
function resolveNamedTransform(named, candidates) {
    for (const candidate of candidates) {
        const exact = named.find((n) => n.name.toLowerCase() === candidate.toLowerCase());
        if (exact)
            return exact.node;
    }
    for (const candidate of candidates) {
        const soft = named.find((n) => n.name.toLowerCase().includes(candidate.toLowerCase()));
        if (soft)
            return soft.node;
    }
    return null;
}
function captureRestEuler(node) {
    if (node.rotationQuaternion) {
        return node.rotationQuaternion.toEulerAngles();
    }
    return node.rotation.clone();
}
/** Bind Tripo / Mixamo-style skeleton bones to AvatarRig limb pivots. */
function bindSkeletonRig(skeletons, transformNodes) {
    if (!skeletons.length)
        return null;
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
        const transformNodes = (result.transformNodes ?? []);
        const skeletons = (result.skeletons ?? []);
        const importRoot = result.meshes.find((m) => m.name === '__root__' || m.name === 'world') ??
            transformNodes.find((t) => t.name === '__root__' || t.name === 'world') ??
            result.meshes[0];
        // Preserve glTF right-handed flip if present on import root.
        const rootScaleZ = importRoot?.scaling?.z ?? 1;
        const hasSkeleton = skeletons.length > 0 || result.meshes.some((m) => !!m.skeleton);
        let displayMeshes = result.meshes;
        if (hasSkeleton) {
            // Broken Tripo skin → bake bind-pose into rigid meshes under `model`.
            const baked = bakeRigidFromImport(scene, result.meshes, model, name);
            if (baked.length) {
                displayMeshes = baked;
                if (rootScaleZ < 0) {
                    model.scaling.z = -Math.abs(model.scaling.z || 1);
                }
                if (importRoot) {
                    importRoot.setEnabled(false);
                    if ('isVisible' in importRoot) {
                        importRoot.isVisible = false;
                    }
                }
                for (const sk of skeletons) {
                    try {
                        sk.dispose?.();
                    }
                    catch {
                        // ignore
                    }
                }
                console.warn('[lobby-sdk] GLB skin baked to rigid mesh (skeleton unusable in Babylon)', {
                    glbUrl,
                    skeletons: skeletons.length,
                    baked: baked.length,
                });
            }
            else if (importRoot) {
                importRoot.parent = model;
            }
        }
        else if (importRoot) {
            importRoot.parent = model;
        }
        for (const mesh of displayMeshes) {
            mesh.isPickable = false;
            mesh.checkCollisions = false;
        }
        fitGlbToHumanHeight(model, displayMeshes);
        simplifyGlbMaterials(displayMeshes, scene);
        console.info('[lobby-sdk] GLB loaded', {
            glbUrl,
            hasSkeleton,
            display: displayMeshes.map((m) => m.name),
        });
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
        root.metadata = {
            ...(root.metadata ?? {}),
            rig,
            animationGroups: [],
            glbModel: model,
            rigidGlb: true,
            boneDriven: false,
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