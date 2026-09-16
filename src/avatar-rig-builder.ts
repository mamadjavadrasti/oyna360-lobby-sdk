/**
 * Phase-4: Skeleton / bone / humanoid-rig construction for lobby avatars.
 * Does not own animation, materials, GLB loading, or remote lifecycle.
 */
import {
  BoundingInfo,
  Mesh,
  Scene,
  Skeleton,
  TransformNode,
  Vector3 as BVector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import type { AbstractMesh, AnimationGroup } from '@babylonjs/core';
import { buildHumanoidBoneRig, type HumanoidBoneRig } from './humanoid-rig';
import { isLobbyPerfDiagEnabled, lobbyPerfMark } from './lobby-perf-diag';

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

export type LimbRigPivots = Omit<AvatarRig, 'root' | 'visual' | 'collider'>;

export interface PrepareGlbSkeletonInput {
  scene: Scene;
  name: string;
  glbUrl: string;
  model: TransformNode;
  importRoot: AbstractMesh | TransformNode | undefined;
  rootScaleZ: number;
  meshes: AbstractMesh[];
  transformNodes: TransformNode[];
  skeletons: Skeleton[];
  animationGroups: AnimationGroup[];
}

export interface PrepareGlbSkeletonResult {
  clips: AnimationGroup[];
  displayMeshes: AbstractMesh[];
  rigidGlb: boolean;
  boneDriven: boolean;
  limbRig: LimbRigPivots | null;
  /** Unmodified groups from instantiate (for sourceClips metadata). */
  originalAnimationGroups: AnimationGroup[];
  skeletons: Skeleton[];
  transformNodes: TransformNode[];
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
): LimbRigPivots | null {
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

/**
 * Stop baked clips, bind limb pivots, prefer bone texture, or bake rigid when skin is unusable.
 * Logic is identical to the former AvatarFactory.createFromGlb skeleton block.
 */
function prepareGlbSkeleton(input: PrepareGlbSkeletonInput): PrepareGlbSkeletonResult {
  const {
    scene,
    name,
    glbUrl,
    model,
    importRoot,
    rootScaleZ,
    meshes,
    transformNodes,
    skeletons,
    animationGroups,
  } = input;

  const hasSkeleton = skeletons.length > 0 || meshes.some((m) => !!m.skeleton);
  let clips = animationGroups;
  let displayMeshes: AbstractMesh[] = meshes;
  let rigidGlb = false;
  let boneDriven = false;
  let limbRig: LimbRigPivots | null = null;

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
    const baked = bakeRigidFromImport(scene, meshes, model, name);
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

  return {
    clips,
    displayMeshes,
    rigidGlb,
    boneDriven,
    limbRig,
    originalAnimationGroups: animationGroups,
    skeletons,
    transformNodes,
  };
}

function resolveLimbPivots(
  scene: Scene,
  name: string,
  visual: TransformNode,
  limbRig: LimbRigPivots | null,
): Pick<AvatarRig, 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'> {
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
  return { torso, head, armL, armR, legL, legR };
}

function buildHumanoidAfterFit(
  visual: TransformNode,
  skeletons: Skeleton[],
  transformNodes: TransformNode[],
  boneDriven: boolean,
): HumanoidBoneRig | undefined {
  // Built after fitting so the sampled bone axes match the final transforms.
  const tRig = performance.now();
  const humanoid = boneDriven
    ? buildHumanoidBoneRig(visual, skeletons, transformNodes) ?? undefined
    : undefined;
  if (isLobbyPerfDiagEnabled() && boneDriven) {
    lobbyPerfMark('humanoid_bind', performance.now() - tRig);
  }
  return humanoid;
}

/** Facade over skeleton / humanoid-rig helpers. */
export class AvatarRigBuilder {
  static prepareGlbSkeleton(input: PrepareGlbSkeletonInput): PrepareGlbSkeletonResult {
    return prepareGlbSkeleton(input);
  }

  static padSkinnedBounds(meshes: AbstractMesh[]) {
    padSkinnedBounds(meshes);
  }

  static preferBoneTexture(skeletons: Skeleton[]) {
    preferBoneTexture(skeletons);
  }

  static bindSkeletonRig(
    skeletons: Skeleton[],
    transformNodes: TransformNode[],
  ): LimbRigPivots | null {
    return bindSkeletonRig(skeletons, transformNodes);
  }

  static buildHumanoidAfterFit(
    visual: TransformNode,
    skeletons: Skeleton[],
    transformNodes: TransformNode[],
    boneDriven: boolean,
  ): HumanoidBoneRig | undefined {
    return buildHumanoidAfterFit(visual, skeletons, transformNodes, boneDriven);
  }

  static resolveLimbPivots(
    scene: Scene,
    name: string,
    visual: TransformNode,
    limbRig: LimbRigPivots | null,
  ): Pick<AvatarRig, 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'> {
    return resolveLimbPivots(scene, name, visual, limbRig);
  }

  /**
   * Read the already-built rig from an AvatarInstance / root (creation-time only;
   * never call from the animation/render loop).
   * Accepts AvatarInstance-shaped objects without importing AvatarInstance (avoids cycles).
   */
  static build(instance: { readonly root: TransformNode; readonly rig?: AvatarRig | null }): AvatarRig | null {
    if (instance.rig !== undefined) return instance.rig;
    return (instance.root.metadata?.rig as AvatarRig | undefined) ?? null;
  }
}
