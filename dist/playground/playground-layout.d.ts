import { Scene } from '@babylonjs/core';
import type { PlatformLobby } from '../platform-lobby';
import type { Vector3 as Vec3 } from '../types';
/** Southwest grass — visible from the plaza, not on a portal spoke. */
export declare const SLIDE_ANCHOR: Vec3;
export declare const SLIDE_YAW: number;
export declare function slideLocalToWorld(local: Vec3): Vec3;
/** Local-space centerline of the chute (sit height). */
export declare function slideLocalPath(): Vec3[];
export declare function buildSlidePath(): Vec3[];
/** Next to the slide landing, out on the grass — clear of every room pad. */
export declare const TRAMPOLINE_ANCHOR: Vec3;
export declare function buildPlayground(scene: Scene, lobby: PlatformLobby): void;
//# sourceMappingURL=playground-layout.d.ts.map