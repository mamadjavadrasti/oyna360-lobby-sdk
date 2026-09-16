/**
 * Phase-8: real-device / headed avatar performance suite (measurement only).
 * Additive — does not change Lobby defaults or avatar pipelines.
 */
import { Engine, type Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyPlayerState } from './protocol';
import type { AvatarBaseDef } from './avatar-asset-manager';
import { type LobbyPerfDiagHandle } from './lobby-perf-diag';
export interface RealDeviceLobbyBridge {
    upsertRemote: (player: LobbyPlayerState) => void;
    removeRemote: (userId: string) => void;
    waitRemote: (userId: string, timeoutMs?: number) => Promise<boolean>;
    waitRemoteReady: (userId: string, timeoutMs?: number) => Promise<boolean>;
    applyRemoteMove: (payload: {
        userId: string;
        position?: LobbyPlayerState['position'];
        rotationY?: number;
        animation?: LobbyAnimationState;
    }) => void;
    isAvatarBaseCached: (id: string) => boolean;
    preloadAvatarBases: (ids?: readonly string[]) => Promise<Array<{
        id: string;
        ok: boolean;
    }>>;
    registerAvatarBases: (defs: readonly AvatarBaseDef[]) => void;
    getScene: () => Scene;
    getEngine: () => Engine;
}
export interface RealDeviceSuiteOptions {
    /** Preloaded same-base URL used for scale / same-join tests. */
    baseA?: {
        id: string;
        glbUrl: string;
    };
    /** Different base for cold join C (not preloaded before join). */
    baseB?: {
        id: string;
        glbUrl: string;
    };
    sampleMs?: number;
    joinSampleMs?: number;
    /** Report purpose tag (e.g. phase-9-mobile). */
    purpose?: string;
    /** Skip frustum layouts (faster on weak devices). */
    skipFrustum?: boolean;
    /** Skip A/B toggles (faster on weak devices; defaults still untouched). */
    skipAb?: boolean;
}
/** Non-sensitive device/browser snapshot for real-device reports. */
export declare function captureRealDeviceInfo(engine: Engine): {
    at: string;
    browser: string;
    browserVersion: string;
    os: string;
    deviceModel: string;
    cpu: string;
    gpu: string;
    ramGb: string | number;
    devicePixelRatio: number | null;
    maxTouchPoints: number | null;
    hardwareConcurrency: number | null;
    isMobileUa: boolean;
    screen: {
        width: number;
        height: number;
    } | null;
    viewport: {
        width: number;
        height: number;
    } | null;
    canvas: {
        width: number;
        height: number;
        clientWidth: number;
        clientHeight: number;
    } | null;
    renderResolution: {
        width: number;
        height: number;
    } | null;
    hardwareScalingLevel: number | null;
    adaptToDeviceRatio: "unknown";
    babylonVersion: string;
    webdriver: boolean | null;
    webgl: {
        webglVersion: string | null;
        renderer: string | null;
        vendor: string | null;
        maxTextureSize: number | null;
        maxVertexTextureImageUnits: number | null;
        parallelShaderCompile: boolean | null;
        gpuFrameTimerAvailable: boolean;
        note: string;
    };
    webApi: string;
    gpuTiming: string;
    fpsCapNote: string;
};
export type RealDeviceInfo = ReturnType<typeof captureRealDeviceInfo>;
export interface RealDeviceAvatarReport {
    meta: Record<string, unknown>;
    device: ReturnType<typeof captureRealDeviceInfo>;
    scale: Record<string, unknown>;
    player2Join: Record<string, unknown>;
    frustum: Record<string, unknown>;
    ab: Record<string, unknown>;
    notes: string[];
}
/**
 * Full real-device avatar diagnostic suite.
 * Restores alwaysSelect / DoubleSide / UBO defaults before returning.
 */
export declare function runRealDeviceAvatarSuite(bridge: RealDeviceLobbyBridge, options?: RealDeviceSuiteOptions): Promise<RealDeviceAvatarReport>;
/** Attach suite runner onto existing `__OYNA360_LOBBY_PERF__` handle (additive). */
export declare function attachRealDeviceAvatarDiag(bridge: RealDeviceLobbyBridge, handle: LobbyPerfDiagHandle, win?: Window): LobbyPerfDiagHandle & {
    deviceInfo: () => ReturnType<typeof captureRealDeviceInfo>;
    runRealDeviceSuite: (options?: RealDeviceSuiteOptions) => Promise<RealDeviceAvatarReport>;
};
//# sourceMappingURL=lobby-real-device-diag.d.ts.map