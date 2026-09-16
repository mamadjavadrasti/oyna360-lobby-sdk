/**
 * Phase-8: real-device / headed avatar performance suite (measurement only).
 * Additive — does not change Lobby defaults or avatar pipelines.
 */
import { Engine, type Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyPlayerState } from './protocol';
import type { AvatarBaseDef } from './avatar-asset-manager';
import {
  captureWebGlInfo,
  diagSetAlwaysSelectAsActiveMesh,
  diagSetAvatarDoubleSide,
  diagSetDisableUniformBuffers,
  getLobbyPerfPhaseSummary,
  resetLobbyPerfDiag,
  sampleAvatarRender,
  setLobbyPerfDiagEnabled,
  type AvatarRenderSample,
  type LobbyPerfDiagHandle,
} from './lobby-perf-diag';

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
  preloadAvatarBases: (ids?: readonly string[]) => Promise<Array<{ id: string; ok: boolean }>>;
  registerAvatarBases: (defs: readonly AvatarBaseDef[]) => void;
  getScene: () => Scene;
  getEngine: () => Engine;
}

export interface RealDeviceSuiteOptions {
  /** Preloaded same-base URL used for scale / same-join tests. */
  baseA?: { id: string; glbUrl: string };
  /** Different base for cold join C (not preloaded before join). */
  baseB?: { id: string; glbUrl: string };
  sampleMs?: number;
  joinSampleMs?: number;
  /** Report purpose tag (e.g. phase-9-mobile). */
  purpose?: string;
  /** Skip frustum layouts (faster on weak devices). */
  skipFrustum?: boolean;
  /** Skip A/B toggles (faster on weak devices; defaults still untouched). */
  skipAb?: boolean;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/CriOS\//.test(ua)) return 'Chrome iOS';
  if (/FxiOS\//.test(ua)) return 'Firefox iOS';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/CriOS\//.test(ua)) return 'Safari';
  return 'Unknown';
}

function detectBrowserVersion(ua: string): string {
  const patterns = [
    /Edg\/([\d.]+)/,
    /CriOS\/([\d.]+)/,
    /FxiOS\/([\d.]+)/,
    /Chrome\/([\d.]+)/,
    /Firefox\/([\d.]+)/,
    /Version\/([\d.]+).*Safari/,
  ];
  for (const re of patterns) {
    const m = ua.match(re);
    if (m?.[1]) return m[1];
  }
  return 'unknown';
}

function detectOs(ua: string): string {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectDeviceModel(ua: string): string {
  const android = ua.match(/Android[^;]*;\s*([^)]+)\)/);
  if (android?.[1]) {
    const raw = android[1].replace(/\s+Build\/.*$/i, '').trim();
    if (raw && !/^Linux$/i.test(raw)) return raw;
  }
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  return 'unknown';
}

/** Non-sensitive device/browser snapshot for real-device reports. */
export function captureRealDeviceInfo(engine: Engine) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const canvas = engine.getRenderingCanvas?.() ?? null;
  const webgl = captureWebGlInfo(engine);
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { mobile?: boolean; platform?: string };
  }) : null;
  const babylonVersion =
    (Engine as unknown as { VERSION?: string }).VERSION ??
    ((engine as Engine & { constructor?: { EngineVersion?: string } }).constructor as
      | { EngineVersion?: string }
      | undefined)?.EngineVersion ??
    'unknown';

  let hardwareScalingLevel: number | null = null;
  try {
    hardwareScalingLevel =
      typeof engine.getHardwareScalingLevel === 'function' ? engine.getHardwareScalingLevel() : null;
  } catch {
    hardwareScalingLevel = null;
  }

  return {
    at: new Date().toISOString(),
    browser: detectBrowser(ua),
    browserVersion: detectBrowserVersion(ua),
    os: detectOs(ua),
    deviceModel: detectDeviceModel(ua),
    cpu: typeof nav?.hardwareConcurrency === 'number' ? `${nav.hardwareConcurrency} cores` : 'unknown',
    gpu: webgl.renderer ?? 'unknown',
    ramGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : 'unknown',
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : null,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : null,
    hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null,
    isMobileUa: !!nav?.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua),
    screen: typeof screen !== 'undefined' ? { width: screen.width, height: screen.height } : null,
    viewport:
      typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight }
        : null,
    canvas: canvas
      ? {
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
        }
      : null,
    renderResolution: canvas ? { width: canvas.width, height: canvas.height } : null,
    hardwareScalingLevel,
    adaptToDeviceRatio: 'unknown' as const,
    babylonVersion: typeof babylonVersion === 'string' ? babylonVersion : 'unknown',
    webdriver: typeof navigator !== 'undefined' ? !!navigator.webdriver : null,
    webgl,
    webApi: webgl.webglVersion ? 'WebGL' : 'unknown',
    gpuTiming: webgl.gpuFrameTimerAvailable ? webgl.note : 'GPU timing unavailable',
    fpsCapNote:
      'If display is 60Hz, browser may cap FPS near 60; prefer frame time / scene_render / p95 / p99 / max over absolute FPS.',
  };
}

export type RealDeviceInfo = ReturnType<typeof captureRealDeviceInfo>;

function avatarPlayer(
  userId: string,
  glbUrl: string,
  presetKey: string,
  position: { x: number; y: number; z: number },
  animation: LobbyAnimationState = 'walk',
): LobbyPlayerState {
  return {
    userId,
    username: userId.slice(0, 12),
    displayName: userId,
    avatar: {
      presetId: presetKey,
      presetKey,
      presetKind: 'glb',
      customConfig: { glbUrl, version: 1 },
    },
    position,
    rotationY: 0,
    animation,
    emote: null,
    updatedAt: Date.now(),
  };
}

function layoutPos(
  layout: 'near_front' | 'far_front' | 'behind' | 'mixed',
  i: number,
  count: number,
) {
  if (layout === 'far_front') {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return { x: (col - 2) * 2.2, y: 0, z: 18 + row * 2 };
  }
  if (layout === 'behind') {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return { x: (col - 2) * 1.6, y: 0, z: -8 - row * 1.8 };
  }
  if (layout === 'mixed') {
    if (i % 3 === 0) return layoutPos('near_front', i, count);
    if (i % 3 === 1) return layoutPos('far_front', Math.floor(i / 2), count);
    return layoutPos('behind', Math.floor(i / 2), count);
  }
  const col = i % 5;
  const row = Math.floor(i / 5);
  return { x: (col - 2) * 1.4, y: 0, z: 4 + row * 1.6 };
}

function startWalkDriver(
  bridge: RealDeviceLobbyBridge,
  ids: string[],
  layout: 'near_front' | 'far_front' | 'behind' | 'mixed',
) {
  let t0 = performance.now();
  const timer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    for (let i = 0; i < ids.length; i++) {
      const base = layoutPos(layout, i, ids.length);
      bridge.applyRemoteMove({
        userId: ids[i],
        position: {
          x: base.x + Math.sin(t * 1.2 + i) * 0.35,
          y: 0,
          z: base.z + Math.cos(t * 1.1 + i) * 0.35,
        },
        rotationY: t * 0.4 + i * 0.2,
        animation: 'walk',
      });
    }
  }, 80);
  return () => clearInterval(timer);
}

function compact(s: AvatarRenderSample | null) {
  if (!s) return null;
  return {
    label: s.label,
    fpsAvg: s.series.avgFps,
    fpsMin: s.series.minFps,
    frameAvg: s.series.avgFrameTimeMs,
    frameP50: s.series.p50FrameTimeMs,
    frameP95: s.series.p95FrameTimeMs,
    frameP99: s.series.p99FrameTimeMs,
    frameMax: s.series.maxFrameTimeMs,
    sceneRender: s.phases.scene_render,
    sceneRenderAvg: s.phases.scene_render?.avgMs ?? null,
    sceneRenderP95: s.phases.scene_render?.p95Ms ?? null,
    remoteUpdate: s.phases.remote_update,
    localUpdate: s.phases.local_update,
    avatarCosts: s.avatarCosts,
    scene: {
      activeMeshes: s.avatarCosts.sceneActiveMeshCount,
      triangles: s.avatarCosts.sceneTriangleApprox,
      vertices: s.avatarCosts.sceneVertexApprox,
      materials: s.avatarCosts.sceneMaterialCount,
      textures: s.avatarCosts.sceneTextureCount,
      skeletons: s.avatarCosts.sceneSkeletonCount,
      bones: s.avatarCosts.sceneBoneCount,
    },
    toggles: s.toggles,
    gpuTiming: s.webgl.gpuFrameTimerAvailable ? s.webgl.note : 'GPU timing unavailable',
  };
}

async function ensureRemoteCount(
  bridge: RealDeviceLobbyBridge,
  liveIds: string[],
  needRemotes: number,
  glbUrl: string,
  presetKey: string,
  idPrefix: string,
) {
  while (liveIds.length > needRemotes) {
    const id = liveIds.pop()!;
    bridge.removeRemote(id);
  }
  while (liveIds.length < needRemotes) {
    const n = liveIds.length;
    const userId = `${idPrefix}${n}`;
    bridge.upsertRemote(
      avatarPlayer(userId, glbUrl, presetKey, layoutPos('near_front', n, needRemotes), 'walk'),
    );
    const ok = await bridge.waitRemoteReady(userId, 90_000);
    if (!ok) throw new Error(`remote ready timeout: ${userId}`);
    liveIds.push(userId);
  }
}

async function measureJoin(
  bridge: RealDeviceLobbyBridge,
  scene: Scene,
  engine: Engine,
  player: LobbyPlayerState,
  label: string,
  sampleMs: number,
) {
  const before = compact(await sampleAvatarRender(scene, engine, `${label}_before`, sampleMs));

  resetLobbyPerfDiag({ keepPhases: false });
  setLobbyPerfDiagEnabled(true);

  const joinStartAt = new Date().toISOString();
  const t0 = performance.now();
  bridge.upsertRemote(player);
  const appearOk = await bridge.waitRemote(player.userId, 90_000);
  const appearMs = performance.now() - t0;
  const readyOk = await bridge.waitRemoteReady(player.userId, 90_000);
  const readyMs = performance.now() - t0;
  const phases = getLobbyPerfPhaseSummary();
  const loadMarks = (phases.recentMarks || []).filter((m) => m.phase === 'glb_container_load');
  const joinMaxSceneRender = phases.phases.scene_render?.maxMs ?? null;
  const joinMaxFrameLogic = phases.phases.frame_logic?.maxMs ?? null;
  const createAsyncMax = phases.phases.createAsync_total?.maxMs ?? null;
  const glbLoad = phases.phases.glb_container_load?.maxMs ?? null;
  const instantiateMax = phases.phases.glb_instantiate?.maxMs ?? null;
  const cache = {
    hits: loadMarks.filter((m) => String(m.detail || '').includes('cache_hit')).length,
    misses: loadMarks.filter((m) => String(m.detail || '').includes('cache_miss')).length,
    loadMarks: loadMarks.map((m) => ({ ms: m.ms, detail: m.detail })),
  };

  await sleep(400);
  const after = compact(await sampleAvatarRender(scene, engine, `${label}_after`, sampleMs));

  return {
    label,
    joinStartAt,
    appearOk,
    readyOk,
    appearMs,
    readyMs,
    totalJoinMs: readyMs,
    joinMaxSceneRender,
    joinMaxFrameLogic,
    createAsyncMax,
    glbLoadMax: glbLoad,
    instantiateMax,
    cache,
    before,
    after,
  };
}

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
export async function runRealDeviceAvatarSuite(
  bridge: RealDeviceLobbyBridge,
  options: RealDeviceSuiteOptions = {},
): Promise<RealDeviceAvatarReport> {
  const scene = bridge.getScene();
  const engine = bridge.getEngine();
  const sampleMs = options.sampleMs ?? 2800;
  const joinSampleMs = options.joinSampleMs ?? 2000;
  const baseA = options.baseA ?? { id: 'demo-a', glbUrl: '/avatars/demo/a.glb' };
  const baseB = options.baseB ?? { id: 'demo-b', glbUrl: '/avatars/demo/b.glb' };

  const notes: string[] = [];
  const report: RealDeviceAvatarReport = {
    meta: {
      at: new Date().toISOString(),
      purpose: options.purpose ?? 'phase-8 real-device / headed avatar performance diagnostic',
      baselineDefaults: {
        alwaysSelectAsActiveMesh: true,
        doubleSide: true,
        disableUniformBuffers: true,
      },
      abortedAtAvatarCount: null as number | null,
      abortReason: null as string | null,
    },
    device: captureRealDeviceInfo(engine),
    scale: {},
    player2Join: {},
    frustum: {},
    ab: {},
    notes,
  };

  bridge.registerAvatarBases([baseA]);
  await bridge.preloadAvatarBases([baseA.id]);
  const cachedA = bridge.isAvatarBaseCached(baseA.id);
  if (!cachedA) notes.push(`${baseA.id} not cached before scale — results may include load cost`);

  // Restore defaults up front
  diagSetAlwaysSelectAsActiveMesh(scene, true);
  diagSetAvatarDoubleSide(scene, true);
  diagSetDisableUniformBuffers(engine, true);

  const liveIds: string[] = [];

  // ---- Empty lobby (plaza + local only; no remotes) ----
  try {
    const stopEmpty = startWalkDriver(bridge, liveIds, 'near_front');
    await sleep(350);
    const emptySample = await sampleAvatarRender(scene, engine, 'scale_0_empty', sampleMs);
    stopEmpty();
    report.scale.n0 = {
      ...compact(emptySample),
      remoteCount: 0,
      note: 'Empty lobby baseline: plaza + local avatar only (no remotes). Local avatar is part of createDev bootstrap and was not removed (diagnostic-only).',
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    notes.push(`Empty lobby sample failed: ${reason}`);
  }

  // ---- Scale 1/2/4/8/10 ----
  for (const total of [1, 2, 4, 8, 10]) {
    try {
      await ensureRemoteCount(bridge, liveIds, total - 1, baseA.glbUrl, baseA.id, 'rd-scale-');
      const stop = startWalkDriver(bridge, liveIds, 'near_front');
      await sleep(350);
      const sample = await sampleAvatarRender(scene, engine, `scale_${total}`, sampleMs);
      stop();
      const phases = getLobbyPerfPhaseSummary();
      const misses = (phases.recentMarks || []).filter(
        (m) => m.phase === 'glb_container_load' && String(m.detail || '').includes('cache_miss'),
      );
      report.scale[`n${total}`] = {
        ...compact(sample),
        remoteCount: liveIds.length,
        cacheMissesDuringSample: misses.length,
        perAvatar: (sample.avatarCosts.avatars || []).map((a) => ({
          name: a.name,
          meshCount: a.meshCount,
          triangleCount: a.triangleCount,
          skeletonCount: a.skeletonCount,
          boneCount: a.boneCount,
          skinnedMeshCount: a.skinnedMeshCount,
        })),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      report.meta.abortedAtAvatarCount = total;
      report.meta.abortReason = reason;
      notes.push(`Scale aborted at ${total} avatars: ${reason}`);
      diagSetAlwaysSelectAsActiveMesh(scene, true);
      diagSetAvatarDoubleSide(scene, true);
      diagSetDisableUniformBuffers(engine, true);
      while (liveIds.length) bridge.removeRemote(liveIds.pop()!);
      return report;
    }
  }

  // ---- Player 2 join (remove remotes first → solo) ----
  while (liveIds.length) {
    bridge.removeRemote(liveIds.pop()!);
  }
  await sleep(300);

  report.player2Join.A_solo = compact(
    await sampleAvatarRender(scene, engine, 'join_A_solo', joinSampleMs),
  );

  report.player2Join.B_sameBase = await measureJoin(
    bridge,
    scene,
    engine,
    avatarPlayer('rd-join-same', baseA.glbUrl, baseA.id, { x: 2, y: 0, z: 4 }, 'walk'),
    'join_B_same',
    joinSampleMs,
  );
  bridge.removeRemote('rd-join-same');
  await sleep(300);

  // C: different base — deliberately NOT preloaded so join hitch is measurable
  report.player2Join.C_differentBaseCold = await measureJoin(
    bridge,
    scene,
    engine,
    avatarPlayer('rd-join-diff', baseB.glbUrl, baseB.id, { x: -2, y: 0, z: 4 }, 'walk'),
    'join_C_diff_cold',
    joinSampleMs,
  );
  bridge.removeRemote('rd-join-diff');
  await sleep(300);

  // Optional: same different URL after it is now cached (post-C)
  bridge.registerAvatarBases([baseB]);
  report.player2Join.C2_differentBaseWarm = await measureJoin(
    bridge,
    scene,
    engine,
    avatarPlayer('rd-join-diff2', baseB.glbUrl, baseB.id, { x: -2.5, y: 0, z: 4 }, 'walk'),
    'join_C2_diff_warm',
    joinSampleMs,
  );
  bridge.removeRemote('rd-join-diff2');
  await sleep(200);

  // ---- Frustum at 8 avatars ----
  if (!options.skipFrustum) {
    await ensureRemoteCount(bridge, liveIds, 7, baseA.glbUrl, baseA.id, 'rd-frustum-');
    for (const layout of ['near_front', 'far_front', 'behind', 'mixed'] as const) {
      for (let i = 0; i < liveIds.length; i++) {
        bridge.applyRemoteMove({
          userId: liveIds[i],
          position: layoutPos(layout, i, liveIds.length),
          rotationY: 0,
          animation: 'walk',
        });
      }
      const stop = startWalkDriver(bridge, liveIds, layout);
      await sleep(400);
      report.frustum[layout] = compact(
        await sampleAvatarRender(scene, engine, `frustum_${layout}_n8`, sampleMs),
      );
      stop();
    }
  } else {
    notes.push('Frustum tests skipped (options.skipFrustum)');
  }

  // ---- A/B one variable at a time (8 avatars, near_front) ----
  if (!options.skipAb) {
    if (liveIds.length < 7) {
      await ensureRemoteCount(bridge, liveIds, 7, baseA.glbUrl, baseA.id, 'rd-ab-');
    }
    for (let i = 0; i < liveIds.length; i++) {
      bridge.applyRemoteMove({
        userId: liveIds[i],
        position: layoutPos('near_front', i, liveIds.length),
        rotationY: 0,
        animation: 'walk',
      });
    }
    diagSetAlwaysSelectAsActiveMesh(scene, true);
    diagSetAvatarDoubleSide(scene, true);
    diagSetDisableUniformBuffers(engine, true);

    {
      const stop = startWalkDriver(bridge, liveIds, 'near_front');
      await sleep(350);
      report.ab.baseline = compact(await sampleAvatarRender(scene, engine, 'ab_baseline', sampleMs));
      stop();
    }
    {
      diagSetAlwaysSelectAsActiveMesh(scene, false);
      const stop = startWalkDriver(bridge, liveIds, 'near_front');
      await sleep(350);
      report.ab.alwaysSelectOff = compact(
        await sampleAvatarRender(scene, engine, 'ab_alwaysSelect_OFF', sampleMs),
      );
      stop();
      diagSetAlwaysSelectAsActiveMesh(scene, true);
    }
    {
      diagSetAvatarDoubleSide(scene, false);
      const stop = startWalkDriver(bridge, liveIds, 'near_front');
      await sleep(350);
      report.ab.doubleSideOff = compact(
        await sampleAvatarRender(scene, engine, 'ab_doubleSide_OFF', sampleMs),
      );
      stop();
      diagSetAvatarDoubleSide(scene, true);
    }
    {
      diagSetDisableUniformBuffers(engine, false);
      const stop = startWalkDriver(bridge, liveIds, 'near_front');
      await sleep(350);
      report.ab.uboEnabled = compact(
        await sampleAvatarRender(scene, engine, 'ab_ubo_ENABLED', sampleMs),
      );
      stop();
      diagSetDisableUniformBuffers(engine, true);
    }
  } else {
    notes.push('A/B tests skipped (options.skipAb) — defaults left unchanged');
  }

  // Final restore + cleanup
  diagSetAlwaysSelectAsActiveMesh(scene, true);
  diagSetAvatarDoubleSide(scene, true);
  diagSetDisableUniformBuffers(engine, true);
  while (liveIds.length) bridge.removeRemote(liveIds.pop()!);

  return report;
}

/** Attach suite runner onto existing `__OYNA360_LOBBY_PERF__` handle (additive). */
export function attachRealDeviceAvatarDiag(
  bridge: RealDeviceLobbyBridge,
  handle: LobbyPerfDiagHandle,
  win: Window = window,
) {
  const extended = handle as LobbyPerfDiagHandle & {
    deviceInfo: () => ReturnType<typeof captureRealDeviceInfo>;
    runRealDeviceSuite: (options?: RealDeviceSuiteOptions) => Promise<RealDeviceAvatarReport>;
  };
  extended.deviceInfo = () => captureRealDeviceInfo(bridge.getEngine());
  extended.runRealDeviceSuite = (options) => runRealDeviceAvatarSuite(bridge, options);
  (win as Window & { __OYNA360_LOBBY_PERF__?: typeof extended }).__OYNA360_LOBBY_PERF__ = extended;
  return extended;
}
