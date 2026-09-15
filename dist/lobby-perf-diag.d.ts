/**
 * Lobby performance diagnostic — measurement only.
 * Does not change default render/avatar behavior unless a toggle is explicitly invoked.
 */
import type { Engine, Scene } from '@babylonjs/core';
export type LobbyPerfPhase = 'draco_ensure' | 'glb_container_load' | 'glb_instantiate' | 'harden_materials' | 'humanoid_bind' | 'accessories' | 'albedo_tint' | 'createAsync_total' | 'remote_spawn_total' | 'remote_update' | 'local_update' | 'frame_logic' | 'scene_render';
export interface LobbyPerfPhaseStat {
    count: number;
    totalMs: number;
    maxMs: number;
    lastMs: number;
}
export interface LobbyPerfSnapshot {
    at: string;
    label: string;
    fps: number;
    frameTimeMs: number;
    avgFrameTimeMs: number;
    p95FrameTimeMs: number;
    drawCallsApprox: number;
    meshCount: number;
    activeMeshCount: number;
    alwaysSelectCount: number;
    doubleSidedCount: number;
    skinnedMeshCount: number;
    skeletonCount: number;
    boneCount: number;
    materialCount: number;
    uniqueMaterialIds: number;
    textureCount: number;
    triangleApprox: number;
    vertexApprox: number;
    lobbyAvatarRoots: number;
    remotePlayers: number;
    disableUniformBuffers: boolean;
    bloomEnabled: boolean | null;
    glowIntensity: number | null;
    phases: Record<string, LobbyPerfPhaseStat>;
    recentMarks: Array<{
        phase: string;
        ms: number;
        detail?: string;
        at: number;
    }>;
}
export interface LobbyPerfSampleSeries {
    label: string;
    durationMs: number;
    samples: number;
    avgFps: number;
    minFps: number;
    maxFps: number;
    avgFrameTimeMs: number;
    p95FrameTimeMs: number;
    maxFrameTimeMs: number;
    avgDrawCalls: number;
    avgActiveMeshes: number;
    avgSkinnedMeshes: number;
    snapshot: LobbyPerfSnapshot;
}
export declare function isLobbyPerfDiagEnabled(): boolean;
export declare function setLobbyPerfDiagEnabled(on: boolean): void;
export declare function resetLobbyPerfDiag(opts?: {
    keepPhases?: boolean;
}): void;
/** Time a sync/async section when diag is enabled. Zero overhead when disabled. */
export declare function lobbyPerfTimeAsync<T>(phase: LobbyPerfPhase | string, fn: () => Promise<T>, detail?: string): Promise<T>;
export declare function lobbyPerfTimeSync<T>(phase: LobbyPerfPhase | string, fn: () => T, detail?: string): T;
export declare function lobbyPerfMark(phase: LobbyPerfPhase | string, ms: number, detail?: string): void;
export declare function lobbyPerfNoteRemoteUpdate(ms: number): void;
export declare function lobbyPerfNoteLocalUpdate(ms: number): void;
export declare function lobbyPerfBeginFrame(): void;
export declare function lobbyPerfEndFrame(engine: Engine, scene: Scene): void;
export declare function captureLobbyPerfSnapshot(scene: Scene, engine: Engine, label?: string): LobbyPerfSnapshot;
/** Sample FPS/frame metrics for durationMs while the render loop runs. */
export declare function sampleLobbyPerf(scene: Scene, engine: Engine, label: string, durationMs?: number, intervalMs?: number): Promise<LobbyPerfSampleSeries>;
/** Temporary toggle for measurement — does not change spawn defaults. */
export declare function diagSetAlwaysSelectAsActiveMesh(scene: Scene, on: boolean): number;
/** Temporary toggle for measurement — does not change SceneManager defaults. */
export declare function diagSetDisableUniformBuffers(engine: Engine, on: boolean): boolean;
export declare function getLobbyPerfPhaseSummary(): {
    phases: Record<string, LobbyPerfPhaseStat & {
        avgMs: number;
    }>;
    remoteUpdateAvgMs: number;
    localUpdateAvgMs: number;
    remoteUpdateCount: number;
    localUpdateCount: number;
};
export interface LobbyPerfDiagHandle {
    enable: (on?: boolean) => void;
    reset: (opts?: {
        keepPhases?: boolean;
    }) => void;
    snapshot: (label?: string) => LobbyPerfSnapshot;
    sample: (label: string, durationMs?: number) => Promise<LobbyPerfSampleSeries>;
    phases: () => ReturnType<typeof getLobbyPerfPhaseSummary>;
    /** Temporary A/B — restore after measuring. */
    setAlwaysSelectAsActiveMesh: (on: boolean) => number;
    setDisableUniformBuffers: (on: boolean) => boolean;
    getToggles: () => {
        alwaysSelectCount: number;
        disableUniformBuffers: boolean;
    };
}
export declare function attachLobbyPerfDiag(getScene: () => Scene, getEngine: () => Engine, win?: Window): LobbyPerfDiagHandle;
declare global {
    interface Window {
        __OYNA360_LOBBY_PERF__?: LobbyPerfDiagHandle;
    }
}
//# sourceMappingURL=lobby-perf-diag.d.ts.map