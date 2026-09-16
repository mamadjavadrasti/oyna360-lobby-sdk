/**
 * Lobby performance diagnostic — measurement only.
 * Does not change default render/avatar behavior unless a toggle is explicitly invoked.
 */
import type { Engine, Scene } from '@babylonjs/core';
export type LobbyPerfPhase = 'draco_ensure' | 'glb_container_load' | 'glb_instantiate' | 'harden_materials' | 'humanoid_bind' | 'accessories' | 'albedo_tint' | 'createAsync_total' | 'remote_spawn_total' | 'remote_placeholder' | 'remote_yield' | 'remote_update' | 'local_update' | 'frame_logic' | 'scene_render' | 'gpu_frame_time';
export interface LobbyPerfPhaseStat {
    count: number;
    totalMs: number;
    maxMs: number;
    lastMs: number;
}
export interface LobbyPerfPhaseDist extends LobbyPerfPhaseStat {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
}
export interface LobbyPerfSnapshot {
    at: string;
    label: string;
    fps: number;
    frameTimeMs: number;
    avgFrameTimeMs: number;
    p50FrameTimeMs: number;
    p95FrameTimeMs: number;
    p99FrameTimeMs: number;
    maxFrameTimeMs: number;
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
    memory: LobbyPerfMemoryInfo;
    phases: Record<string, LobbyPerfPhaseStat>;
    phaseDist: Record<string, LobbyPerfPhaseDist>;
    recentMarks: Array<{
        phase: string;
        ms: number;
        detail?: string;
        at: number;
    }>;
    /** Per-root avatar cost (local + remotes). */
    avatarCosts: LobbyPerfAvatarCost[];
    /** Metrics Babylon/WebGL cannot expose in this build. */
    unavailable: string[];
}
export interface LobbyPerfSampleSeries {
    label: string;
    durationMs: number;
    samples: number;
    avgFps: number;
    minFps: number;
    maxFps: number;
    avgFrameTimeMs: number;
    p50FrameTimeMs: number;
    p95FrameTimeMs: number;
    p99FrameTimeMs: number;
    maxFrameTimeMs: number;
    avgDrawCalls: number;
    avgActiveMeshes: number;
    avgSkinnedMeshes: number;
    phaseDist: Record<string, LobbyPerfPhaseDist>;
    memory: LobbyPerfMemoryInfo;
    snapshot: LobbyPerfSnapshot;
}
export interface LobbyPerfMemoryInfo {
    available: boolean;
    note?: string;
    usedJSHeapBytes?: number;
    totalJSHeapBytes?: number;
    jsHeapLimitBytes?: number;
}
export interface LobbyPerfAvatarCost {
    name: string;
    kind: 'local' | 'remote' | 'other';
    meshCount: number;
    skinnedMeshCount: number;
    skeletonCount: number;
    boneCount: number;
    materialCount: number;
    textureCount: number;
    animationGroupCount: number;
    vertexCount: number;
    triangleCount: number;
    alwaysSelectCount: number;
    doubleSidedCount: number;
    rigidGlb: boolean;
    boneDriven: boolean;
}
type MarkRec = {
    phase: string;
    ms: number;
    detail?: string;
    at: number;
};
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
export declare function captureLobbyPerfMemory(): LobbyPerfMemoryInfo;
export declare function collectLobbyAvatarCosts(scene: Scene): LobbyPerfAvatarCost[];
export declare function captureLobbyPerfSnapshot(scene: Scene, engine: Engine, label?: string): LobbyPerfSnapshot;
/** Sample FPS/frame metrics for durationMs while the render loop runs. */
export declare function sampleLobbyPerf(scene: Scene, engine: Engine, label: string, durationMs?: number, intervalMs?: number): Promise<LobbyPerfSampleSeries>;
/** Temporary toggle for measurement — does not change spawn defaults. */
export declare function diagSetAlwaysSelectAsActiveMesh(scene: Scene, on: boolean): number;
/**
 * Temporary DoubleSide / backFaceCulling toggle for lobby avatar meshes only.
 * Baseline project default is DoubleSide ON + backFaceCulling false — restore after A/B.
 * Does not change MaterialPipeline spawn behavior.
 */
export declare function diagSetAvatarDoubleSide(scene: Scene, on: boolean): number;
/** Temporary toggle for measurement — does not change SceneManager defaults. */
export declare function diagSetDisableUniformBuffers(engine: Engine, on: boolean): boolean;
/** Non-sensitive WebGL/caps snapshot for render reports. */
export declare function captureWebGlInfo(engine: Engine): {
    webglVersion: string | null;
    renderer: string | null;
    vendor: string | null;
    maxTextureSize: number | null;
    maxVertexTextureImageUnits: number | null;
    parallelShaderCompile: boolean | null;
    gpuFrameTimerAvailable: boolean;
    note: string;
};
export interface AvatarRenderCostSummary {
    label: string;
    skinnedAvatarCount: number;
    skinnedMeshCount: number;
    skeletonCount: number;
    boneCount: number;
    triangleCount: number;
    vertexCount: number;
    materialCount: number;
    textureCount: number;
    alwaysSelectCount: number;
    doubleSidedCount: number;
    animationGroupCount: number;
    /** Scene-wide (includes plaza); useful context, not avatar-only. */
    sceneActiveMeshCount: number;
    sceneDrawCallsApprox: number;
    sceneTriangleApprox: number;
    sceneVertexApprox: number;
    sceneMaterialCount: number;
    sceneTextureCount: number;
    sceneSkeletonCount: number;
    sceneBoneCount: number;
    avatars: LobbyPerfAvatarCost[];
}
/** Avatar-only costs (excludes plaza NPCs / props). */
export declare function summarizeAvatarRenderCosts(scene: Scene, label?: string): AvatarRenderCostSummary;
export interface AvatarRenderSample {
    label: string;
    durationMs: number;
    avatarCosts: AvatarRenderCostSummary;
    series: LobbyPerfSampleSeries;
    phases: {
        scene_render: LobbyPerfPhaseDist | null;
        remote_update: LobbyPerfPhaseDist | null;
        local_update: LobbyPerfPhaseDist | null;
        frame_logic: LobbyPerfPhaseDist | null;
    };
    webgl: ReturnType<typeof captureWebGlInfo>;
    toggles: {
        alwaysSelectAsActiveMesh: boolean;
        doubleSide: boolean;
        disableUniformBuffers: boolean;
    };
    unavailable: string[];
}
/** Sample while render loop runs; focuses report on avatar render cost. */
export declare function sampleAvatarRender(scene: Scene, engine: Engine, label: string, durationMs?: number): Promise<AvatarRenderSample>;
export declare function getLobbyPerfPhaseSummary(): {
    phases: Record<string, LobbyPerfPhaseDist>;
    remoteUpdateAvgMs: number;
    localUpdateAvgMs: number;
    remoteUpdateCount: number;
    localUpdateCount: number;
    recentMarks: MarkRec[];
};
/** Build a structured spawn-timeline view from recent marks (measurement only). */
export declare function extractSpawnTimelineFromMarks(marks?: MarkRec[]): Record<string, {
    ms: number;
    detail?: string;
    at: number;
}[]>;
export interface LobbyPerfDiagHandle {
    enable: (on?: boolean) => void;
    disable: () => void;
    reset: (opts?: {
        keepPhases?: boolean;
    }) => void;
    snapshot: (label?: string) => LobbyPerfSnapshot;
    sample: (label: string, durationMs?: number) => Promise<LobbyPerfSampleSeries>;
    phases: () => ReturnType<typeof getLobbyPerfPhaseSummary>;
    report: (label?: string) => {
        snapshot: LobbyPerfSnapshot;
        phases: ReturnType<typeof getLobbyPerfPhaseSummary>;
        spawnTimeline: ReturnType<typeof extractSpawnTimelineFromMarks>;
        memory: LobbyPerfMemoryInfo;
    };
    memory: () => LobbyPerfMemoryInfo;
    avatarCosts: () => LobbyPerfAvatarCost[];
    /** Additive Phase-7 APIs */
    avatarRenderCosts: (label?: string) => AvatarRenderCostSummary;
    sampleAvatarRender: (label: string, durationMs?: number) => Promise<AvatarRenderSample>;
    webglInfo: () => ReturnType<typeof captureWebGlInfo>;
    /** Temporary A/B — restore after measuring. */
    setAlwaysSelectAsActiveMesh: (on: boolean) => number;
    setAvatarDoubleSide: (on: boolean) => number;
    setDisableUniformBuffers: (on: boolean) => boolean;
    getToggles: () => {
        alwaysSelectCount: number;
        doubleSideCount: number;
        disableUniformBuffers: boolean;
    };
    /** Phase-8 additive real-device helpers (attached by PlatformLobby). */
    deviceInfo?: () => import('./lobby-real-device-diag').RealDeviceInfo;
    runRealDeviceSuite?: (options?: import('./lobby-real-device-diag').RealDeviceSuiteOptions) => Promise<import('./lobby-real-device-diag').RealDeviceAvatarReport>;
    /** Phase-10 plaza isolation helpers (attached by PlatformLobby). */
    plazaInventory?: () => import('./lobby-plaza-diag').PlazaSubsystemInventory[];
    runPlazaSuite?: (options?: import('./lobby-plaza-diag').PlazaDiagSuiteOptions) => Promise<import('./lobby-plaza-diag').PlazaDiagReport>;
}
export declare function attachLobbyPerfDiag(getScene: () => Scene, getEngine: () => Engine, win?: Window): LobbyPerfDiagHandle;
declare global {
    interface Window {
        __OYNA360_LOBBY_PERF__?: LobbyPerfDiagHandle;
    }
}
export {};
//# sourceMappingURL=lobby-perf-diag.d.ts.map