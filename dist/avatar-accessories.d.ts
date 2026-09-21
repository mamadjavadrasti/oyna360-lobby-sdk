import { Scene, TransformNode } from '@babylonjs/core';
export type AccessoryPrimitive = 'cap' | 'pack' | 'glasses' | 'watch';
export interface EquippedAccessory {
    slot: 'hat' | 'back' | 'face' | 'hand';
    itemId: string;
    glbUrl?: string;
    primitive?: AccessoryPrimitive;
    attachBone?: string;
}
/**
 * Attach equipped accessories onto an avatar root produced by AvatarFactory.
 * Safe to call repeatedly — clears previous `metadata.accessoryNodes` first.
 */
export declare function attachAvatarAccessories(scene: Scene, root: TransformNode, accessories: EquippedAccessory[] | undefined | null): Promise<void>;
export declare function attachAccessoriesFromAvatarConfig(scene: Scene, root: TransformNode, customConfig: Record<string, unknown> | undefined): Promise<void>;
//# sourceMappingURL=avatar-accessories.d.ts.map