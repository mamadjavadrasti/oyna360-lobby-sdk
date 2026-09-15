import {
  Color3,
  Material,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3 as BVector3,
} from '@babylonjs/core';
import type { AbstractMesh, BaseTexture } from '@babylonjs/core';
import type { AvatarRig } from './avatar-factory';

export type AccessoryPrimitive = 'cap' | 'pack' | 'glasses' | 'watch';

export interface EquippedAccessory {
  slot: 'hat' | 'back' | 'face' | 'hand';
  itemId: string;
  glbUrl?: string;
  primitive?: AccessoryPrimitive;
  attachBone?: string;
}

function solid(scene: Scene, name: string, color: string) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = Color3.Black();
  return mat;
}

function getRig(root: TransformNode): AvatarRig | null {
  return (root.metadata?.rig as AvatarRig | undefined) ?? null;
}

function resolveAttachParent(rig: AvatarRig, slot: EquippedAccessory['slot'], attachBone?: string): TransformNode {
  if (attachBone && rig.humanoid?.joints) {
    const joint = rig.humanoid.joints[attachBone as keyof typeof rig.humanoid.joints];
    if (joint?.node) return joint.node;
  }

  const humanoid = rig.humanoid;
  switch (slot) {
    case 'hat':
    case 'face':
      return humanoid?.joints.head?.node ?? rig.head;
    case 'back':
      return humanoid?.joints.chest?.node ?? rig.torso;
    case 'hand':
      return humanoid?.joints.handR?.node ?? rig.armR;
    default:
      return rig.head;
  }
}

function localOffset(slot: EquippedAccessory['slot']): BVector3 {
  switch (slot) {
    case 'hat':
      return new BVector3(0, 0.18, 0);
    case 'face':
      return new BVector3(0, 0.02, 0.12);
    case 'back':
      return new BVector3(0, 0.05, -0.18);
    case 'hand':
      return new BVector3(0, -0.35, 0);
  }
}

function buildPrimitive(
  scene: Scene,
  name: string,
  primitive: AccessoryPrimitive,
  parent: TransformNode,
  slot: EquippedAccessory['slot'],
) {
  const root = new TransformNode(`${name}-acc`, scene);
  root.parent = parent;
  root.position = localOffset(slot);

  if (primitive === 'cap') {
    const mat = solid(scene, `${name}-cap-mat`, '#2563eb');
    const brim = MeshBuilder.CreateCylinder(`${name}-brim`, { diameter: 0.42, height: 0.04, tessellation: 20 }, scene);
    brim.parent = root;
    brim.position.y = 0.02;
    brim.material = mat;
    const dome = MeshBuilder.CreateSphere(`${name}-dome`, { diameter: 0.34, segments: 12 }, scene);
    dome.parent = root;
    dome.position.y = 0.14;
    dome.scaling.y = 0.7;
    dome.material = mat;
  } else if (primitive === 'pack') {
    const mat = solid(scene, `${name}-pack-mat`, '#78350f');
    const pack = MeshBuilder.CreateBox(`${name}-pack`, { width: 0.36, height: 0.42, depth: 0.18 }, scene);
    pack.parent = root;
    pack.material = mat;
  } else if (primitive === 'glasses') {
    const mat = solid(scene, `${name}-glasses-mat`, '#111827');
    const left = MeshBuilder.CreateTorus(`${name}-gl`, { diameter: 0.12, thickness: 0.015, tessellation: 12 }, scene);
    left.parent = root;
    left.position.set(-0.07, 0, 0.02);
    left.rotation.x = Math.PI / 2;
    left.material = mat;
    const right = left.clone(`${name}-gr`, root)!;
    right.position.x = 0.07;
  } else if (primitive === 'watch') {
    const mat = solid(scene, `${name}-watch-mat`, '#f59e0b');
    const band = MeshBuilder.CreateTorus(`${name}-band`, { diameter: 0.1, thickness: 0.02, tessellation: 12 }, scene);
    band.parent = root;
    band.rotation.z = Math.PI / 2;
    band.material = mat;
  }

  return root;
}

async function loadAccessoryGlb(
  scene: Scene,
  name: string,
  glbUrl: string,
  parent: TransformNode,
  slot: EquippedAccessory['slot'],
) {
  const slash = glbUrl.lastIndexOf('/');
  const rootUrl = slash >= 0 ? glbUrl.slice(0, slash + 1) : '';
  const fileName = slash >= 0 ? glbUrl.slice(slash + 1) : glbUrl;
  const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, scene);
  const holder = new TransformNode(`${name}-acc`, scene);
  holder.parent = parent;
  holder.position = localOffset(slot);

  const meshes = result.meshes as AbstractMesh[];
  for (const mesh of meshes) {
    if (mesh.name === '__root__' || !mesh.parent || mesh.parent === (scene as unknown as TransformNode)) {
      mesh.parent = holder;
    }
    mesh.receiveShadows = false;
    if (mesh.material) {
      const mat = mesh.material as Material;
      mat.backFaceCulling = false;
      mat.alpha = 1;
      mat.transparencyMode = Material.MATERIAL_OPAQUE;
      mat.alphaMode = 0;
      mat.disableDepthWrite = false;
      mat.forceDepthWrite = false;
    }
  }
  return holder;
}

function readAccessories(avatarConfig: Record<string, unknown> | undefined): EquippedAccessory[] {
  const raw = avatarConfig?.accessories;
  if (!Array.isArray(raw)) return [];
  const out: EquippedAccessory[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const slot = (entry as { slot?: unknown }).slot;
    const itemId = (entry as { itemId?: unknown }).itemId;
    if (slot !== 'hat' && slot !== 'back' && slot !== 'face' && slot !== 'hand') continue;
    if (typeof itemId !== 'string' || !itemId) continue;
    const acc: EquippedAccessory = { slot, itemId };
    const glbUrl = (entry as { glbUrl?: unknown }).glbUrl;
    const primitive = (entry as { primitive?: unknown }).primitive;
    const attachBone = (entry as { attachBone?: unknown }).attachBone;
    if (typeof glbUrl === 'string' && glbUrl) acc.glbUrl = glbUrl;
    if (
      primitive === 'cap' ||
      primitive === 'pack' ||
      primitive === 'glasses' ||
      primitive === 'watch'
    ) {
      acc.primitive = primitive;
    }
    if (typeof attachBone === 'string' && attachBone) acc.attachBone = attachBone;
    out.push(acc);
  }
  return out;
}

/**
 * Colour-variant albedo is one GPU texture shared by every avatar wearing it,
 * so a node being disposed must let go of it instead of freeing it.
 */
function detachSharedTextures(node: TransformNode) {
  for (const mesh of [node, ...node.getChildMeshes(false)] as Array<{
    material?: (Material & { albedoTexture?: BaseTexture | null; diffuseTexture?: BaseTexture | null; subMaterials?: Array<Material | null> }) | null;
  }>) {
    const materials = [mesh.material, ...(mesh.material?.subMaterials ?? [])];
    for (const material of materials) {
      if (!material) continue;
      const mat = material as Material & {
        albedoTexture?: BaseTexture | null;
        diffuseTexture?: BaseTexture | null;
      };
      for (const slot of ['albedoTexture', 'diffuseTexture'] as const) {
        const texture = mat[slot] as (BaseTexture & { metadata?: { sharedAvatarAlbedo?: boolean } }) | null | undefined;
        if (texture?.metadata?.sharedAvatarAlbedo) mat[slot] = null;
      }
    }
  }
}

/**
 * Attach equipped accessories onto an avatar root produced by AvatarFactory.
 * Safe to call repeatedly — clears previous `metadata.accessoryNodes` first.
 */
export async function attachAvatarAccessories(
  scene: Scene,
  root: TransformNode,
  accessories: EquippedAccessory[] | undefined | null,
) {
  const previous = (root.metadata?.accessoryNodes as TransformNode[] | undefined) ?? [];
  for (const node of previous) {
    try {
      detachSharedTextures(node);
      node.dispose(false, true);
    } catch {
      // ignore
    }
  }

  const rig = getRig(root);
  if (!rig || !accessories?.length) {
    root.metadata = { ...(root.metadata ?? {}), accessoryNodes: [] };
    return;
  }

  const nodes: TransformNode[] = [];
  for (const acc of accessories) {
    const parent = resolveAttachParent(rig, acc.slot, acc.attachBone);
    const name = `${root.name}-${acc.slot}-${acc.itemId}`;
    try {
      if (acc.glbUrl) {
        const absolute =
          typeof window !== 'undefined' && acc.glbUrl.startsWith('/')
            ? (() => {
                try {
                  const ref = document.referrer ? new URL(document.referrer).origin : '';
                  if (ref && ref !== window.location.origin) return `${ref}${acc.glbUrl}`;
                } catch {
                  // ignore
                }
                return `${window.location.origin}${acc.glbUrl}`;
              })()
            : acc.glbUrl;
        nodes.push(await loadAccessoryGlb(scene, name, absolute, parent, acc.slot));
      } else if (acc.primitive) {
        nodes.push(buildPrimitive(scene, name, acc.primitive, parent, acc.slot));
      }
    } catch (err) {
      console.warn('[lobby-sdk] accessory attach failed', acc, err);
    }
  }

  root.metadata = { ...(root.metadata ?? {}), accessoryNodes: nodes };
}

export async function attachAccessoriesFromAvatarConfig(
  scene: Scene,
  root: TransformNode,
  customConfig: Record<string, unknown> | undefined,
) {
  await attachAvatarAccessories(scene, root, readAccessories(customConfig));
}
