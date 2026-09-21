/**
 * Stage 10 — Plaza subsystem performance diagnostic (measurement only).
 * Uses temporary visibility / light / post-FX toggles, then restores state.
 * Does not change production Plaza, avatar, or render defaults.
 */
import type { AbstractMesh, Engine, Scene } from '@babylonjs/core';
import { type RealDeviceInfo } from './lobby-real-device-diag';
import { type AvatarRenderSample, type LobbyPerfDiagHandle } from './lobby-perf-diag';
export type PlazaSubsystemId = 'base_ground' | 'plaza_ground' | 'fountain' | 'shops' | 'nature' | 'rooms' | 'playground' | 'npcs' | 'colliders' | 'avatars' | 'other';
/** Subsystems measured via mesh visibility leave-one-out. */
export declare const PLAZA_MESH_SUBSYSTEMS: readonly PlazaSubsystemId[];
export interface PlazaSubsystemInventory {
    id: PlazaSubsystemId;
    meshCount: number;
    activeMeshCount: number;
    triangleApprox: number;
    vertexApprox: number;
    materialIds: number;
    sampleNames: string[];
}
/** Classify a mesh into a Plaza diagnostic bucket (name/metadata + ancestry). */
export declare function classifyPlazaMesh(mesh: AbstractMesh): PlazaSubsystemId;
export declare function inventoryPlazaSubsystems(scene: Scene): PlazaSubsystemInventory[];
declare function compactSample(s: AvatarRenderSample | null): {
    label: string;
    fpsAvg: number;
    frameAvg: number;
    frameP95: number;
    frameP99: number;
    frameMax: number;
    sceneRenderAvg: number | null;
    sceneRenderP95: number | null;
    sceneRenderMax: number | null;
    activeMeshes: number;
    triangles: number;
    vertices: number;
    materials: number;
    textures: number;
    skeletons: number;
    bones: number;
    drawCallsApprox: number;
} | null;
export interface PlazaDiagSample {
    id: string;
    note?: string;
    inventory?: PlazaSubsystemInventory | null;
    metrics: ReturnType<typeof compactSample>;
    deltaFromFull?: {
        activeMeshes: number | null;
        triangles: number | null;
        sceneRenderAvg: number | null;
        frameAvg: number | null;
    } | null;
}
export interface PlazaDiagReport {
    meta: Record<string, unknown>;
    device: RealDeviceInfo;
    inventory: PlazaSubsystemInventory[];
    inventoryTotals: {
        activeMeshes: number;
        triangles: number;
        meshCount: number;
    };
    baseline: ReturnType<typeof compactSample>;
    leaveOneOut: PlazaDiagSample[];
    postProcessOff: PlazaDiagSample | null;
    plazaLightsOff: PlazaDiagSample | null;
    emptyish: PlazaDiagSample | null;
    avatarBasesAvailable: Array<{
        id: string;
        glbUrl: string;
        note?: string;
    }>;
    avatarVariation: {
        limitation: string;
        testedBases: string[];
        samples: PlazaDiagSample[];
    };
    assessment: {
        primarySuspectedBottleneck: string;
        secondarySuspectedBottleneck: string;
        evidence: string[];
        confidence: 'low' | 'medium' | 'high';
    };
    notes: string[];
}
export interface PlazaDiagSuiteOptions {
    sampleMs?: number;
    purpose?: string;
    /** Skip leave-one-out samples (inventory only). */
    inventoryOnly?: boolean;
}
/**
 * Full Plaza diagnostic suite. Restores all toggles before return.
 */
export declare function runPlazaDiagSuite(scene: Scene, engine: Engine, options?: PlazaDiagSuiteOptions): Promise<PlazaDiagReport>;
/** Attach plaza suite onto `__OYNA360_LOBBY_PERF__` (additive). */
export declare function attachPlazaDiag(getScene: () => Scene, getEngine: () => Engine, handle: LobbyPerfDiagHandle, win?: Window): LobbyPerfDiagHandle & {
    plazaInventory: () => PlazaSubsystemInventory[];
    runPlazaSuite: (options?: PlazaDiagSuiteOptions) => Promise<PlazaDiagReport>;
};
export {};
//# sourceMappingURL=lobby-plaza-diag.d.ts.map