/**
 * Lobby performance diagnostic — measurement only.
 * Does not change default render/avatar behavior unless a toggle is explicitly invoked.
 */
import type {
  AbstractMesh,
  Engine,
  Material,
  Scene,
  Skeleton,
  Texture,
  TransformNode,
} from '@babylonjs/core';

export type LobbyPerfPhase =
  | 'draco_ensure'
  | 'glb_container_load'
  | 'glb_instantiate'
  | 'harden_materials'
  | 'humanoid_bind'
  | 'accessories'
  | 'albedo_tint'
  | 'createAsync_total'
  | 'remote_spawn_total'
  | 'remote_update'
  | 'local_update'
  | 'frame_logic'
  | 'scene_render';

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
  recentMarks: Array<{ phase: string; ms: number; detail?: string; at: number }>;
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

type MarkRec = { phase: string; ms: number; detail?: string; at: number };

const phaseStats = new Map<string, LobbyPerfPhaseStat>();
const recentMarks: MarkRec[] = [];
const MAX_MARKS = 80;

let enabled = false;
let drawCallsApprox = 0;
let lastFrameStart = 0;
const frameTimes: number[] = [];
const MAX_FRAME_TIMES = 240;

let remoteUpdateMsAccum = 0;
let remoteUpdateCount = 0;
let localUpdateMsAccum = 0;
let localUpdateCount = 0;

export function isLobbyPerfDiagEnabled() {
  return enabled;
}

export function setLobbyPerfDiagEnabled(on: boolean) {
  enabled = on;
  if (!on) return;
  // Keep accumulated phase stats across enable so spawn marks survive.
}

export function resetLobbyPerfDiag(opts?: { keepPhases?: boolean }) {
  if (!opts?.keepPhases) {
    phaseStats.clear();
    recentMarks.length = 0;
  }
  frameTimes.length = 0;
  drawCallsApprox = 0;
  remoteUpdateMsAccum = 0;
  remoteUpdateCount = 0;
  localUpdateMsAccum = 0;
  localUpdateCount = 0;
}

function bumpPhase(phase: string, ms: number) {
  const cur = phaseStats.get(phase) ?? { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
  cur.count += 1;
  cur.totalMs += ms;
  cur.lastMs = ms;
  if (ms > cur.maxMs) cur.maxMs = ms;
  phaseStats.set(phase, cur);
  recentMarks.push({ phase, ms, at: performance.now() });
  if (recentMarks.length > MAX_MARKS) recentMarks.shift();
}

/** Time a sync/async section when diag is enabled. Zero overhead when disabled. */
export async function lobbyPerfTimeAsync<T>(
  phase: LobbyPerfPhase | string,
  fn: () => Promise<T>,
  detail?: string,
): Promise<T> {
  if (!enabled) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - t0;
    bumpPhase(phase, ms);
    if (detail) {
      const last = recentMarks[recentMarks.length - 1];
      if (last) last.detail = detail;
    }
  }
}

export function lobbyPerfTimeSync<T>(phase: LobbyPerfPhase | string, fn: () => T, detail?: string): T {
  if (!enabled) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const ms = performance.now() - t0;
    bumpPhase(phase, ms);
    if (detail) {
      const last = recentMarks[recentMarks.length - 1];
      if (last) last.detail = detail;
    }
  }
}

export function lobbyPerfMark(phase: LobbyPerfPhase | string, ms: number, detail?: string) {
  if (!enabled) return;
  bumpPhase(phase, ms);
  if (detail) {
    const last = recentMarks[recentMarks.length - 1];
    if (last) last.detail = detail;
  }
}

export function lobbyPerfNoteRemoteUpdate(ms: number) {
  if (!enabled) return;
  remoteUpdateMsAccum += ms;
  remoteUpdateCount += 1;
  bumpPhase('remote_update', ms);
}

export function lobbyPerfNoteLocalUpdate(ms: number) {
  if (!enabled) return;
  localUpdateMsAccum += ms;
  localUpdateCount += 1;
  bumpPhase('local_update', ms);
}

export function lobbyPerfBeginFrame() {
  if (!enabled) return;
  lastFrameStart = performance.now();
}

export function lobbyPerfEndFrame(engine: Engine, scene: Scene) {
  if (!enabled) return;
  const ms = performance.now() - lastFrameStart;
  frameTimes.push(ms);
  if (frameTimes.length > MAX_FRAME_TIMES) frameTimes.shift();

  // Approximate draw calls: count enabled visible meshes that will draw
  // (Babylon SceneInstrumentation is not always present in the peer build).
  let draws = 0;
  for (const mesh of scene.meshes) {
    if (mesh.isDisposed()) continue;
    if (!mesh.isEnabled()) continue;
    if (mesh.isVisible === false) continue;
    if ((mesh.visibility ?? 1) <= 0) continue;
    if (typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() <= 0) continue;
    draws += 1;
  }
  drawCallsApprox = draws;

  const gpu = (engine as Engine & { getGPUFrameTimeCounter?: () => { current: number } })
    .getGPUFrameTimeCounter?.();
  if (gpu && typeof gpu.current === 'number' && gpu.current > 0) {
    bumpPhase('gpu_frame_time', gpu.current);
  }
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function isImportRootName(name: string | undefined) {
  const base = (name ?? '').replace(/__a\d+$/, '').toLowerCase();
  return base === '__root__' || base === 'world';
}

function collectSceneStats(scene: Scene, engine: Engine, label: string): LobbyPerfSnapshot {
  const meshes = scene.meshes.filter((m) => !m.isDisposed());
  let active = 0;
  let alwaysSelect = 0;
  let doubleSided = 0;
  let skinned = 0;
  let tris = 0;
  let verts = 0;
  const skeletons = new Set<Skeleton>();
  const materials = new Set<Material>();
  const textures = new Set<unknown>();

  for (const mesh of meshes) {
    const enabled = mesh.isEnabled() !== false && mesh.isVisible !== false && (mesh.visibility ?? 1) > 0;
    const v =
      typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
    if (enabled && v > 0) active += 1;
    if (mesh.alwaysSelectAsActiveMesh) alwaysSelect += 1;

    const side = (mesh as AbstractMesh & { sideOrientation?: number; overrideMaterialSideOrientation?: number })
      .overrideMaterialSideOrientation ??
      (mesh as AbstractMesh & { sideOrientation?: number }).sideOrientation;
    // Babylon Mesh.DOUBLESIDE === 2
    if (side === 2) doubleSided += 1;
    if (mesh.material && (mesh.material as Material).backFaceCulling === false) {
      // counted via materials below
    }

    if (mesh.skeleton && v >= 24 && !isImportRootName(mesh.name)) {
      skinned += 1;
      skeletons.add(mesh.skeleton);
    }
    if (v > 0) {
      verts += v;
      const idx = mesh.getIndices?.();
      if (idx && idx.length) tris += Math.floor(idx.length / 3);
      else tris += Math.floor(v / 3);
    }

    const mat = mesh.material;
    if (mat) {
      materials.add(mat);
      const subs = (mat as Material & { subMaterials?: Array<Material | null> }).subMaterials;
      if (Array.isArray(subs)) {
        for (const sub of subs) if (sub) materials.add(sub);
      }
    }
  }

  let boneCount = 0;
  for (const sk of skeletons) boneCount += sk.bones?.length ?? 0;

  for (const mat of materials) {
    const anyMat = mat as Material & Record<string, Texture | null | undefined>;
    for (const key of [
      'albedoTexture',
      'diffuseTexture',
      'bumpTexture',
      'opacityTexture',
      'emissiveTexture',
      'metallicTexture',
      'ambientTexture',
      'reflectionTexture',
    ]) {
      const tex = anyMat[key];
      if (tex) textures.add(tex);
    }
  }

  let avatarRoots = 0;
  for (const node of scene.transformNodes) {
    if (!node.isDisposed() && node.metadata?.isLobbyAvatarRoot) avatarRoots += 1;
  }
  for (const mesh of meshes) {
    if (mesh.metadata?.isLobbyAvatarRoot) avatarRoots += 1;
  }

  let remotes = 0;
  for (const node of scene.transformNodes) {
    if (!node.isDisposed() && typeof node.name === 'string' && node.name.startsWith('remote-')) {
      if (node.metadata?.isLobbyAvatarRoot) remotes += 1;
    }
  }

  const sortedFrames = [...frameTimes].sort((a, b) => a - b);
  const avgFrame = sortedFrames.length
    ? sortedFrames.reduce((a, b) => a + b, 0) / sortedFrames.length
    : 0;
  const lastFrame = sortedFrames.length ? frameTimes[frameTimes.length - 1] : 0;

  const glow = (scene.metadata as { plazaGlow?: { intensity?: number } } | undefined)?.plazaGlow;

  const phases: Record<string, LobbyPerfPhaseStat> = {};
  for (const [k, v] of phaseStats) phases[k] = { ...v };

  return {
    at: new Date().toISOString(),
    label,
    fps: engine.getFps(),
    frameTimeMs: lastFrame,
    avgFrameTimeMs: avgFrame,
    p95FrameTimeMs: percentile(sortedFrames, 95),
    drawCallsApprox,
    meshCount: meshes.length,
    activeMeshCount: active,
    alwaysSelectCount: alwaysSelect,
    doubleSidedCount: doubleSided,
    skinnedMeshCount: skinned,
    skeletonCount: skeletons.size,
    boneCount,
    materialCount: scene.materials.length,
    uniqueMaterialIds: materials.size,
    textureCount: textures.size,
    triangleApprox: tris,
    vertexApprox: verts,
    lobbyAvatarRoots: avatarRoots,
    remotePlayers: remotes,
    disableUniformBuffers: !!(engine as Engine & { disableUniformBuffers?: boolean }).disableUniformBuffers,
    bloomEnabled: null,
    glowIntensity: glow?.intensity ?? null,
    phases,
    recentMarks: recentMarks.slice(-40),
  };
}

export function captureLobbyPerfSnapshot(
  scene: Scene,
  engine: Engine,
  label = 'snapshot',
): LobbyPerfSnapshot {
  return collectSceneStats(scene, engine, label);
}

/** Sample FPS/frame metrics for durationMs while the render loop runs. */
export async function sampleLobbyPerf(
  scene: Scene,
  engine: Engine,
  label: string,
  durationMs = 3000,
  intervalMs = 100,
): Promise<LobbyPerfSampleSeries> {
  const was = enabled;
  enabled = true;
  const fpsSamples: number[] = [];
  const ftSamples: number[] = [];
  const drawSamples: number[] = [];
  const activeSamples: number[] = [];
  const skinnedSamples: number[] = [];
  const tEnd = performance.now() + durationMs;

  while (performance.now() < tEnd) {
    await new Promise<void>((r) => setTimeout(r, intervalMs));
    const snap = collectSceneStats(scene, engine, label);
    fpsSamples.push(snap.fps);
    ftSamples.push(snap.avgFrameTimeMs || snap.frameTimeMs);
    drawSamples.push(snap.drawCallsApprox);
    activeSamples.push(snap.activeMeshCount);
    skinnedSamples.push(snap.skinnedMeshCount);
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const sortedFt = [...ftSamples].sort((a, b) => a - b);
  const snapshot = collectSceneStats(scene, engine, label);
  enabled = was;

  return {
    label,
    durationMs,
    samples: fpsSamples.length,
    avgFps: avg(fpsSamples),
    minFps: fpsSamples.length ? Math.min(...fpsSamples) : 0,
    maxFps: fpsSamples.length ? Math.max(...fpsSamples) : 0,
    avgFrameTimeMs: avg(ftSamples),
    p95FrameTimeMs: percentile(sortedFt, 95),
    maxFrameTimeMs: ftSamples.length ? Math.max(...ftSamples) : 0,
    avgDrawCalls: avg(drawSamples),
    avgActiveMeshes: avg(activeSamples),
    avgSkinnedMeshes: avg(skinnedSamples),
    snapshot,
  };
}

/** Temporary toggle for measurement — does not change spawn defaults. */
export function diagSetAlwaysSelectAsActiveMesh(scene: Scene, on: boolean) {
  let n = 0;
  for (const mesh of scene.meshes) {
    if (!mesh.metadata?.isLobbyAvatar) continue;
    mesh.alwaysSelectAsActiveMesh = on;
    n += 1;
  }
  return n;
}

/** Temporary toggle for measurement — does not change SceneManager defaults. */
export function diagSetDisableUniformBuffers(engine: Engine, on: boolean) {
  (engine as Engine & { disableUniformBuffers: boolean }).disableUniformBuffers = on;
  return on;
}

export function getLobbyPerfPhaseSummary() {
  const out: Record<string, LobbyPerfPhaseStat & { avgMs: number }> = {};
  for (const [k, v] of phaseStats) {
    out[k] = { ...v, avgMs: v.count ? v.totalMs / v.count : 0 };
  }
  return {
    phases: out,
    remoteUpdateAvgMs: remoteUpdateCount ? remoteUpdateMsAccum / remoteUpdateCount : 0,
    localUpdateAvgMs: localUpdateCount ? localUpdateMsAccum / localUpdateCount : 0,
    remoteUpdateCount,
    localUpdateCount,
  };
}

export interface LobbyPerfDiagHandle {
  enable: (on?: boolean) => void;
  reset: (opts?: { keepPhases?: boolean }) => void;
  snapshot: (label?: string) => LobbyPerfSnapshot;
  sample: (label: string, durationMs?: number) => Promise<LobbyPerfSampleSeries>;
  phases: () => ReturnType<typeof getLobbyPerfPhaseSummary>;
  /** Temporary A/B — restore after measuring. */
  setAlwaysSelectAsActiveMesh: (on: boolean) => number;
  setDisableUniformBuffers: (on: boolean) => boolean;
  getToggles: () => { alwaysSelectCount: number; disableUniformBuffers: boolean };
}

export function attachLobbyPerfDiag(
  getScene: () => Scene,
  getEngine: () => Engine,
  win: Window = window,
): LobbyPerfDiagHandle {
  const handle: LobbyPerfDiagHandle = {
    enable: (on = true) => setLobbyPerfDiagEnabled(on),
    reset: (opts) => resetLobbyPerfDiag(opts),
    snapshot: (label) => captureLobbyPerfSnapshot(getScene(), getEngine(), label ?? 'snapshot'),
    sample: (label, durationMs) => sampleLobbyPerf(getScene(), getEngine(), label, durationMs),
    phases: () => getLobbyPerfPhaseSummary(),
    setAlwaysSelectAsActiveMesh: (on) => diagSetAlwaysSelectAsActiveMesh(getScene(), on),
    setDisableUniformBuffers: (on) => diagSetDisableUniformBuffers(getEngine(), on),
    getToggles: () => {
      const scene = getScene();
      const engine = getEngine();
      let alwaysSelectCount = 0;
      for (const mesh of scene.meshes) {
        if (mesh.metadata?.isLobbyAvatar && mesh.alwaysSelectAsActiveMesh) alwaysSelectCount += 1;
      }
      return {
        alwaysSelectCount,
        disableUniformBuffers: !!(engine as Engine & { disableUniformBuffers?: boolean })
          .disableUniformBuffers,
      };
    },
  };

  (win as Window & { __OYNA360_LOBBY_PERF__?: LobbyPerfDiagHandle }).__OYNA360_LOBBY_PERF__ = handle;
  return handle;
}

declare global {
  interface Window {
    __OYNA360_LOBBY_PERF__?: LobbyPerfDiagHandle;
  }
}
