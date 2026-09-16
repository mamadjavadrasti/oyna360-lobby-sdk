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
  | 'remote_placeholder'
  | 'remote_yield'
  | 'remote_update'
  | 'local_update'
  | 'frame_logic'
  | 'scene_render'
  | 'gpu_frame_time';

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
  recentMarks: Array<{ phase: string; ms: number; detail?: string; at: number }>;
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

type MarkRec = { phase: string; ms: number; detail?: string; at: number };

const phaseStats = new Map<string, LobbyPerfPhaseStat>();
const phaseSamples = new Map<string, number[]>();
const recentMarks: MarkRec[] = [];
const MAX_MARKS = 200;
const MAX_PHASE_SAMPLES = 800;

let enabled = false;
let drawCallsApprox = 0;
let lastFrameStart = 0;
const frameTimes: number[] = [];
const MAX_FRAME_TIMES = 480;

let remoteUpdateMsAccum = 0;
let remoteUpdateCount = 0;
let localUpdateMsAccum = 0;
let localUpdateCount = 0;

export function isLobbyPerfDiagEnabled() {
  return enabled;
}

export function setLobbyPerfDiagEnabled(on: boolean) {
  enabled = on;
}

export function resetLobbyPerfDiag(opts?: { keepPhases?: boolean }) {
  if (!opts?.keepPhases) {
    phaseStats.clear();
    phaseSamples.clear();
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

  let samples = phaseSamples.get(phase);
  if (!samples) {
    samples = [];
    phaseSamples.set(phase, samples);
  }
  samples.push(ms);
  if (samples.length > MAX_PHASE_SAMPLES) samples.shift();

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

function distFromSamples(samples: number[] | undefined, fallback?: LobbyPerfPhaseStat): LobbyPerfPhaseDist {
  const sorted = samples?.length ? [...samples].sort((a, b) => a - b) : [];
  const count = fallback?.count ?? sorted.length;
  const totalMs = fallback?.totalMs ?? sorted.reduce((a, b) => a + b, 0);
  const maxMs = fallback?.maxMs ?? (sorted.length ? sorted[sorted.length - 1] : 0);
  const lastMs = fallback?.lastMs ?? (sorted.length ? sorted[sorted.length - 1] : 0);
  return {
    count,
    totalMs,
    maxMs,
    lastMs,
    avgMs: count ? totalMs / count : 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

function isImportRootName(name: string | undefined) {
  const base = (name ?? '').replace(/__a\d+$/, '').toLowerCase();
  return base === '__root__' || base === 'world';
}

export function captureLobbyPerfMemory(): LobbyPerfMemoryInfo {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (!perf.memory) {
    return { available: false, note: 'not available in current runtime (performance.memory)' };
  }
  return {
    available: true,
    usedJSHeapBytes: perf.memory.usedJSHeapSize,
    totalJSHeapBytes: perf.memory.totalJSHeapSize,
    jsHeapLimitBytes: perf.memory.jsHeapSizeLimit,
  };
}

function collectTexturesFromMaterial(mat: Material, textures: Set<unknown>) {
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

export function collectLobbyAvatarCosts(scene: Scene): LobbyPerfAvatarCost[] {
  const roots: TransformNode[] = [];
  for (const node of scene.transformNodes) {
    if (!node.isDisposed() && node.metadata?.isLobbyAvatarRoot) roots.push(node);
  }
  for (const mesh of scene.meshes) {
    if (!mesh.isDisposed() && mesh.metadata?.isLobbyAvatarRoot) {
      roots.push(mesh as unknown as TransformNode);
    }
  }

  const out: LobbyPerfAvatarCost[] = [];
  for (const root of roots) {
    const name = root.name ?? 'unnamed';
    let kind: LobbyPerfAvatarCost['kind'] = 'other';
    if (name.startsWith('remote-')) kind = 'remote';
    else if (name.includes('local') || name === 'avatar' || name.startsWith('player')) kind = 'local';
    // Dev lobby local is often named after user; treat non-remote lobby roots as local when only one.
    if (kind === 'other' && !name.startsWith('remote-')) kind = 'local';

    let meshCount = 0;
    let skinnedMeshCount = 0;
    let boneCount = 0;
    let vertexCount = 0;
    let triangleCount = 0;
    let alwaysSelectCount = 0;
    let doubleSidedCount = 0;
    const skeletons = new Set<Skeleton>();
    const materials = new Set<Material>();
    const textures = new Set<unknown>();

    let meshes: AbstractMesh[] = [];
    try {
      meshes = root.getChildMeshes?.(false) ?? [];
    } catch {
      meshes = [];
    }

    for (const mesh of meshes) {
      if (!mesh || mesh.isDisposed()) continue;
      const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
      if (v <= 0 && isImportRootName(mesh.name)) continue;
      meshCount += 1;
      if (mesh.alwaysSelectAsActiveMesh) alwaysSelectCount += 1;
      const side =
        (mesh as AbstractMesh & { overrideMaterialSideOrientation?: number }).overrideMaterialSideOrientation ??
        (mesh as AbstractMesh & { sideOrientation?: number }).sideOrientation;
      if (side === 2) doubleSidedCount += 1;
      if (mesh.skeleton && v >= 24 && !isImportRootName(mesh.name)) {
        skinnedMeshCount += 1;
        skeletons.add(mesh.skeleton);
      }
      if (v > 0) {
        vertexCount += v;
        const idx = mesh.getIndices?.();
        if (idx?.length) triangleCount += Math.floor(idx.length / 3);
        else triangleCount += Math.floor(v / 3);
      }
      if (mesh.material) {
        materials.add(mesh.material);
        collectTexturesFromMaterial(mesh.material, textures);
        const subs = (mesh.material as Material & { subMaterials?: Array<Material | null> }).subMaterials;
        if (Array.isArray(subs)) {
          for (const sub of subs) {
            if (sub) {
              materials.add(sub);
              collectTexturesFromMaterial(sub, textures);
            }
          }
        }
      }
    }

    for (const sk of skeletons) boneCount += sk.bones?.length ?? 0;
    const groups = (root.metadata?.animationGroups as unknown[] | undefined) ?? [];
    const sourceClips = (root.metadata?.sourceClips as unknown[] | undefined) ?? [];

    out.push({
      name,
      kind,
      meshCount,
      skinnedMeshCount,
      skeletonCount: skeletons.size,
      boneCount,
      materialCount: materials.size,
      textureCount: textures.size,
      animationGroupCount: Math.max(groups.length, sourceClips.length),
      vertexCount,
      triangleCount,
      alwaysSelectCount,
      doubleSidedCount,
      rigidGlb: !!root.metadata?.rigidGlb,
      boneDriven: !!root.metadata?.boneDriven,
    });
  }
  return out;
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
    const enabledMesh =
      mesh.isEnabled() !== false && mesh.isVisible !== false && (mesh.visibility ?? 1) > 0;
    const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
    if (enabledMesh && v > 0) active += 1;
    if (mesh.alwaysSelectAsActiveMesh) alwaysSelect += 1;

    const side =
      (mesh as AbstractMesh & { overrideMaterialSideOrientation?: number }).overrideMaterialSideOrientation ??
      (mesh as AbstractMesh & { sideOrientation?: number }).sideOrientation;
    if (side === 2) doubleSided += 1;

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
      collectTexturesFromMaterial(mat, textures);
      const subs = (mat as Material & { subMaterials?: Array<Material | null> }).subMaterials;
      if (Array.isArray(subs)) {
        for (const sub of subs) {
          if (sub) {
            materials.add(sub);
            collectTexturesFromMaterial(sub, textures);
          }
        }
      }
    }
  }

  let boneCount = 0;
  for (const sk of skeletons) boneCount += sk.bones?.length ?? 0;

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
  const lastFrame = frameTimes.length ? frameTimes[frameTimes.length - 1] : 0;

  const glow = (scene.metadata as { plazaGlow?: { intensity?: number } } | undefined)?.plazaGlow;

  const phases: Record<string, LobbyPerfPhaseStat> = {};
  const phaseDist: Record<string, LobbyPerfPhaseDist> = {};
  for (const [k, v] of phaseStats) {
    phases[k] = { ...v };
    phaseDist[k] = distFromSamples(phaseSamples.get(k), v);
  }

  const unavailable = [
    'shader_switches: not available in current runtime',
    'material_switches: not available in current runtime',
    'texture_binds: not available in current runtime',
    'render_target_changes: not available in current runtime',
    'precise_GPU_frame_time: not available unless engine GPU timer extension is active',
    'GPU_memory: not available in current runtime',
    'texture_memory_bytes: not available in current runtime',
    'SceneInstrumentation drawCalls: not wired in this peer build (using mesh-count approx)',
  ];

  return {
    at: new Date().toISOString(),
    label,
    fps: engine.getFps(),
    frameTimeMs: lastFrame,
    avgFrameTimeMs: avgFrame,
    p50FrameTimeMs: percentile(sortedFrames, 50),
    p95FrameTimeMs: percentile(sortedFrames, 95),
    p99FrameTimeMs: percentile(sortedFrames, 99),
    maxFrameTimeMs: sortedFrames.length ? sortedFrames[sortedFrames.length - 1] : 0,
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
    memory: captureLobbyPerfMemory(),
    phases,
    phaseDist,
    recentMarks: recentMarks.slice(-80),
    avatarCosts: collectLobbyAvatarCosts(scene),
    unavailable,
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
    ftSamples.push(snap.frameTimeMs || snap.avgFrameTimeMs);
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
    p50FrameTimeMs: percentile(sortedFt, 50),
    p95FrameTimeMs: percentile(sortedFt, 95),
    p99FrameTimeMs: percentile(sortedFt, 99),
    maxFrameTimeMs: ftSamples.length ? Math.max(...ftSamples) : 0,
    avgDrawCalls: avg(drawSamples),
    avgActiveMeshes: avg(activeSamples),
    avgSkinnedMeshes: avg(skinnedSamples),
    phaseDist: snapshot.phaseDist,
    memory: snapshot.memory,
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

/**
 * Temporary DoubleSide / backFaceCulling toggle for lobby avatar meshes only.
 * Baseline project default is DoubleSide ON + backFaceCulling false — restore after A/B.
 * Does not change MaterialPipeline spawn behavior.
 */
export function diagSetAvatarDoubleSide(scene: Scene, on: boolean) {
  const DOUBLESIDE = 2;
  const FRONTSIDE = 0;
  let n = 0;
  for (const mesh of scene.meshes) {
    if (!mesh.metadata?.isLobbyAvatar) continue;
    const m = mesh as AbstractMesh & {
      sideOrientation?: number;
      overrideMaterialSideOrientation?: number;
    };
    if (on) {
      m.sideOrientation = DOUBLESIDE;
      m.overrideMaterialSideOrientation = DOUBLESIDE;
      if (mesh.material) mesh.material.backFaceCulling = false;
    } else {
      m.sideOrientation = FRONTSIDE;
      m.overrideMaterialSideOrientation = FRONTSIDE;
      if (mesh.material) mesh.material.backFaceCulling = true;
    }
    n += 1;
  }
  return n;
}

/** Temporary toggle for measurement — does not change SceneManager defaults. */
export function diagSetDisableUniformBuffers(engine: Engine, on: boolean) {
  (engine as Engine & { disableUniformBuffers: boolean }).disableUniformBuffers = on;
  return on;
}

/** Non-sensitive WebGL/caps snapshot for render reports. */
export function captureWebGlInfo(engine: Engine): {
  webglVersion: string | null;
  renderer: string | null;
  vendor: string | null;
  maxTextureSize: number | null;
  maxVertexTextureImageUnits: number | null;
  parallelShaderCompile: boolean | null;
  gpuFrameTimerAvailable: boolean;
  note: string;
} {
  let glInfo: { vendor?: string; renderer?: string; version?: string } | null = null;
  try {
    glInfo = (engine as Engine & { getGlInfo?: () => { vendor: string; renderer: string; version: string } })
      .getGlInfo?.() ?? null;
  } catch {
    glInfo = null;
  }
  const caps = (engine as Engine & { getCaps?: () => Record<string, unknown> }).getCaps?.() ?? null;
  const maxTextureSize =
    typeof caps?.maxTextureSize === 'number' ? (caps.maxTextureSize as number) : null;
  const maxVertexTextureImageUnits =
    typeof caps?.maxVertexTextureImageUnits === 'number'
      ? (caps.maxVertexTextureImageUnits as number)
      : null;
  const parallelShaderCompile =
    typeof caps?.parallelShaderCompile === 'boolean' ? (caps.parallelShaderCompile as boolean) : null;

  const gpuCounter = (engine as Engine & { getGPUFrameTimeCounter?: () => { current: number } })
    .getGPUFrameTimeCounter?.();
  const gpuFrameTimerAvailable = !!(gpuCounter && typeof gpuCounter.current === 'number');

  return {
    webglVersion: glInfo?.version ?? null,
    renderer: glInfo?.renderer ?? null,
    vendor: glInfo?.vendor ?? null,
    maxTextureSize,
    maxVertexTextureImageUnits,
    parallelShaderCompile,
    gpuFrameTimerAvailable,
    note: gpuFrameTimerAvailable
      ? 'GPU frame counter object present; treat values as advisory unless consistently non-zero'
      : 'precise GPU timing unavailable in current runtime — report CPU/scene_render only',
  };
}

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
export function summarizeAvatarRenderCosts(
  scene: Scene,
  label = 'avatar-render',
): AvatarRenderCostSummary {
  const all = collectLobbyAvatarCosts(scene);
  const avatars = all.filter(
    (a) =>
      a.skinnedMeshCount > 0 ||
      a.name === 'local-player' ||
      a.name.startsWith('remote-'),
  );
  let skinnedMeshCount = 0;
  let skeletonCount = 0;
  let boneCount = 0;
  let triangleCount = 0;
  let vertexCount = 0;
  let materialCount = 0;
  let textureCount = 0;
  let alwaysSelectCount = 0;
  let doubleSidedCount = 0;
  let animationGroupCount = 0;
  for (const a of avatars) {
    skinnedMeshCount += a.skinnedMeshCount;
    skeletonCount += a.skeletonCount;
    boneCount += a.boneCount;
    triangleCount += a.triangleCount;
    vertexCount += a.vertexCount;
    materialCount += a.materialCount;
    textureCount += a.textureCount;
    alwaysSelectCount += a.alwaysSelectCount;
    doubleSidedCount += a.doubleSidedCount;
    animationGroupCount += a.animationGroupCount;
  }

  let sceneActive = 0;
  let sceneDraws = 0;
  let sceneTriangleApprox = 0;
  let sceneVertexApprox = 0;
  const sceneSkeletons = new Set<object>();
  let sceneBoneCount = 0;
  for (const mesh of scene.meshes) {
    if (mesh.isDisposed()) continue;
    if (!mesh.isEnabled() || mesh.isVisible === false || (mesh.visibility ?? 1) <= 0) continue;
    const v = typeof mesh.getTotalVertices === 'function' ? mesh.getTotalVertices() : 0;
    if (v <= 0) continue;
    sceneActive += 1;
    sceneDraws += 1;
    sceneVertexApprox += v;
    const idx = typeof mesh.getIndices === 'function' ? mesh.getIndices() : null;
    if (idx?.length) sceneTriangleApprox += Math.floor(idx.length / 3);
    else sceneTriangleApprox += Math.floor(v / 3);
    const sk = (mesh as { skeleton?: { bones?: unknown[] } | null }).skeleton;
    if (sk && !sceneSkeletons.has(sk as object)) {
      sceneSkeletons.add(sk as object);
      sceneBoneCount += sk.bones?.length ?? 0;
    }
  }

  return {
    label,
    skinnedAvatarCount: avatars.filter((a) => a.skinnedMeshCount > 0).length,
    skinnedMeshCount,
    skeletonCount,
    boneCount,
    triangleCount,
    vertexCount,
    materialCount,
    textureCount,
    alwaysSelectCount,
    doubleSidedCount,
    animationGroupCount,
    sceneActiveMeshCount: sceneActive,
    sceneDrawCallsApprox: sceneDraws,
    sceneTriangleApprox,
    sceneVertexApprox,
    sceneMaterialCount: scene.materials.length,
    sceneTextureCount: scene.textures.length,
    sceneSkeletonCount: sceneSkeletons.size,
    sceneBoneCount,
    avatars,
  };
}

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

function phaseOrNull(name: string): LobbyPerfPhaseDist | null {
  const v = phaseStats.get(name);
  if (!v) return null;
  return distFromSamples(phaseSamples.get(name), v);
}

/** Sample while render loop runs; focuses report on avatar render cost. */
export async function sampleAvatarRender(
  scene: Scene,
  engine: Engine,
  label: string,
  durationMs = 3000,
): Promise<AvatarRenderSample> {
  return runSampleAvatarRender(scene, engine, label, durationMs);
}

async function runSampleAvatarRender(
  scene: Scene,
  engine: Engine,
  label: string,
  durationMs = 3000,
): Promise<AvatarRenderSample> {
  // Clear frame/phase samples so percentiles reflect this window only.
  resetLobbyPerfDiag({ keepPhases: false });
  setLobbyPerfDiagEnabled(true);
  const series = await sampleLobbyPerf(scene, engine, label, durationMs);
  const avatarCosts = summarizeAvatarRenderCosts(scene, label);
  const snap = series.snapshot;
  let alwaysOn = 0;
  let doubleOn = 0;
  let avatarMeshes = 0;
  for (const mesh of scene.meshes) {
    if (!mesh.metadata?.isLobbyAvatar) continue;
    avatarMeshes += 1;
    if (mesh.alwaysSelectAsActiveMesh) alwaysOn += 1;
    const side =
      (mesh as AbstractMesh & { overrideMaterialSideOrientation?: number }).overrideMaterialSideOrientation ??
      (mesh as AbstractMesh & { sideOrientation?: number }).sideOrientation;
    if (side === 2) doubleOn += 1;
  }
  return {
    label,
    durationMs,
    avatarCosts,
    series,
    phases: {
      scene_render: phaseOrNull('scene_render'),
      remote_update: phaseOrNull('remote_update'),
      local_update: phaseOrNull('local_update'),
      frame_logic: phaseOrNull('frame_logic'),
    },
    webgl: captureWebGlInfo(engine),
    toggles: {
      alwaysSelectAsActiveMesh: avatarMeshes > 0 ? alwaysOn === avatarMeshes : true,
      doubleSide: avatarMeshes > 0 ? doubleOn === avatarMeshes : true,
      disableUniformBuffers: !!(engine as Engine & { disableUniformBuffers?: boolean }).disableUniformBuffers,
    },
    unavailable: snap.unavailable ?? [],
  };
}

export function getLobbyPerfPhaseSummary() {
  const out: Record<string, LobbyPerfPhaseDist> = {};
  for (const [k, v] of phaseStats) {
    out[k] = distFromSamples(phaseSamples.get(k), v);
  }
  return {
    phases: out,
    remoteUpdateAvgMs: remoteUpdateCount ? remoteUpdateMsAccum / remoteUpdateCount : 0,
    localUpdateAvgMs: localUpdateCount ? localUpdateMsAccum / localUpdateCount : 0,
    remoteUpdateCount,
    localUpdateCount,
    recentMarks: recentMarks.slice(-80),
  };
}

/** Build a structured spawn-timeline view from recent marks (measurement only). */
export function extractSpawnTimelineFromMarks(marks: MarkRec[] = recentMarks) {
  const phasesOfInterest = [
    'remote_placeholder',
    'remote_yield',
    'draco_ensure',
    'glb_container_load',
    'glb_instantiate',
    'harden_materials',
    'humanoid_bind',
    'accessories',
    'albedo_tint',
    'createAsync_total',
    'remote_spawn_total',
  ];
  const byPhase: Record<string, Array<{ ms: number; detail?: string; at: number }>> = {};
  for (const m of marks) {
    if (!phasesOfInterest.includes(m.phase)) continue;
    (byPhase[m.phase] ??= []).push({ ms: m.ms, detail: m.detail, at: m.at });
  }
  return byPhase;
}

export interface LobbyPerfDiagHandle {
  enable: (on?: boolean) => void;
  disable: () => void;
  reset: (opts?: { keepPhases?: boolean }) => void;
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
  runRealDeviceSuite?: (
    options?: import('./lobby-real-device-diag').RealDeviceSuiteOptions,
  ) => Promise<import('./lobby-real-device-diag').RealDeviceAvatarReport>;
  /** Phase-10 plaza isolation helpers (attached by PlatformLobby). */
  plazaInventory?: () => import('./lobby-plaza-diag').PlazaSubsystemInventory[];
  runPlazaSuite?: (
    options?: import('./lobby-plaza-diag').PlazaDiagSuiteOptions,
  ) => Promise<import('./lobby-plaza-diag').PlazaDiagReport>;
}

export function attachLobbyPerfDiag(
  getScene: () => Scene,
  getEngine: () => Engine,
  win: Window = window,
): LobbyPerfDiagHandle {
  const handle: LobbyPerfDiagHandle = {
    enable: (on = true) => setLobbyPerfDiagEnabled(on),
    disable: () => setLobbyPerfDiagEnabled(false),
    reset: (opts) => resetLobbyPerfDiag(opts),
    snapshot: (label) => captureLobbyPerfSnapshot(getScene(), getEngine(), label ?? 'snapshot'),
    sample: (label, durationMs) => sampleLobbyPerf(getScene(), getEngine(), label, durationMs),
    phases: () => getLobbyPerfPhaseSummary(),
    report: (label) => {
      const snapshot = captureLobbyPerfSnapshot(getScene(), getEngine(), label ?? 'report');
      return {
        snapshot,
        phases: getLobbyPerfPhaseSummary(),
        spawnTimeline: extractSpawnTimelineFromMarks(),
        memory: snapshot.memory,
      };
    },
    memory: () => captureLobbyPerfMemory(),
    avatarCosts: () => collectLobbyAvatarCosts(getScene()),
    avatarRenderCosts: (label) => summarizeAvatarRenderCosts(getScene(), label ?? 'avatar-render'),
    sampleAvatarRender: (label, durationMs) =>
      runSampleAvatarRender(getScene(), getEngine(), label, durationMs),
    webglInfo: () => captureWebGlInfo(getEngine()),
    setAlwaysSelectAsActiveMesh: (on) => diagSetAlwaysSelectAsActiveMesh(getScene(), on),
    setAvatarDoubleSide: (on) => diagSetAvatarDoubleSide(getScene(), on),
    setDisableUniformBuffers: (on) => diagSetDisableUniformBuffers(getEngine(), on),
    getToggles: () => {
      const scene = getScene();
      const engine = getEngine();
      let alwaysSelectCount = 0;
      let doubleSideCount = 0;
      for (const mesh of scene.meshes) {
        if (!mesh.metadata?.isLobbyAvatar) continue;
        if (mesh.alwaysSelectAsActiveMesh) alwaysSelectCount += 1;
        const side =
          (mesh as AbstractMesh & { overrideMaterialSideOrientation?: number })
            .overrideMaterialSideOrientation ??
          (mesh as AbstractMesh & { sideOrientation?: number }).sideOrientation;
        if (side === 2) doubleSideCount += 1;
      }
      return {
        alwaysSelectCount,
        doubleSideCount,
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
