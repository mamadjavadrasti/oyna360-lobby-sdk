
import { PlatformLobby } from '../dist/index.js';

const canvas = document.getElementById('c');
const sharedConfig = {
  groundColor: '#14532d',
  skyColor: '#1a1450',
  spawnPoint: { x: 0, y: 0, z: 3 },
  groundSize: 90,
  fogDensity: 0.011,
  ambientIntensity: 0.52,
  cameraDistance: 9.5,
  cameraHeight: 5,
  enableMultiplayer: false,
  enableChat: false,
  enableVoice: false,
  enablePresenceUi: false,
  enableConnectionUi: false,
  enableOrientationUi: false,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function avatar(glbUrl, presetKey) {
  return {
    presetId: presetKey,
    presetKey,
    presetKind: 'glb',
    customConfig: { glbUrl, version: 1 },
  };
}

window.__runLobbyPerfDiag = async () => {
  const report = {
    build: null,
    scenarios: {},
    toggles: {},
    phaseTimeline: {},
    notes: [],
  };

  const lobby = await PlatformLobby.createDev({
    canvas,
    roomId: 'game:perf-diag',
    mockUser: { id: 'local-perf', displayName: 'Local', username: 'local' },
    mockAvatar: avatar('/avatars/demo/a.glb', 'demo-a'),
    config: sharedConfig,
  });
  lobby.applyPlazaLayout({ npcCount: 0 });
  report.build = window.__OYNA360_SDK_BUILD__ ?? null;

  const perf = window.__OYNA360_LOBBY_PERF__;
  if (!perf) throw new Error('perf diag handle missing');
  perf.enable(true);
  perf.reset();

  // Warm a few frames after local avatar ready.
  await sleep(1500);

  // --- Scenario 1: solo ---
  perf.reset({ keepPhases: true });
  const solo = await perf.sample('solo', 3500);
  report.scenarios.solo = solo;
  report.phaseTimeline.afterSolo = perf.phases();

  // --- Scenario 2: same avatar URL (cache hit instantiate) ---
  perf.reset({ keepPhases: false });
  perf.enable(true);
  const samePlayer = {
    userId: 'remote-same',
    username: 'same',
    displayName: 'SameAvatar',
    avatar: avatar('/avatars/demo/a.glb', 'demo-a'),
    position: { x: 2, y: 0, z: 4 },
    rotationY: 0,
    animation: 'idle',
    emote: null,
  };
  const tSame0 = performance.now();
  lobby.diagUpsertRemote(samePlayer);
  const sameAppear = await lobby.diagWaitRemote('remote-same', 90000);
  const sameAppearMs = performance.now() - tSame0;
  const sameReady = await lobby.diagWaitRemoteReady('remote-same', 90000);
  const sameReadyMs = performance.now() - tSame0;
  if (!sameAppear || !sameReady) throw new Error('same remote spawn timeout');
  await sleep(800);
  const same = await perf.sample('two_same_avatar', 3500);
  report.scenarios.twoSame = {
    ...same,
    spawnWallMs: sameAppearMs,
    appearMs: sameAppearMs,
    readyMs: sameReadyMs,
    phases: perf.phases(),
  };

  // Toggle A/B while two-same is active (restore after).
  const beforeAlways = await perf.sample('toggle_baseline_same', 2000);
  const nOff = perf.setAlwaysSelectAsActiveMesh(false);
  await sleep(400);
  const alwaysOff = await perf.sample('alwaysSelect_OFF', 2000);
  perf.setAlwaysSelectAsActiveMesh(true);
  await sleep(400);
  const alwaysOn = await perf.sample('alwaysSelect_ON', 2000);

  const uboWas = perf.getToggles().disableUniformBuffers;
  perf.setDisableUniformBuffers(false);
  await sleep(400);
  const uboOn = await perf.sample('uniformBuffers_ENABLED', 2000);
  perf.setDisableUniformBuffers(true);
  await sleep(400);
  const uboOff = await perf.sample('uniformBuffers_DISABLED', 2000);
  perf.setDisableUniformBuffers(uboWas);

  report.toggles = {
    alwaysSelectMeshesTouched: nOff,
    baseline: beforeAlways,
    alwaysSelectOff: alwaysOff,
    alwaysSelectOn: alwaysOn,
    uniformBuffersEnabled: uboOn,
    uniformBuffersDisabled: uboOff,
  };

  lobby.diagRemoveRemote('remote-same');
  await sleep(500);

  // --- Scenario 3: different avatar URL (forces second container load) ---
  perf.reset({ keepPhases: false });
  perf.enable(true);
  const diffPlayer = {
    userId: 'remote-diff',
    username: 'diff',
    displayName: 'DiffAvatar',
    avatar: avatar('/avatars/demo/b.glb', 'demo-b'),
    position: { x: -2, y: 0, z: 4 },
    rotationY: 1,
    animation: 'idle',
    emote: null,
  };
  const tDiff0 = performance.now();
  lobby.diagUpsertRemote(diffPlayer);
  const diffAppear = await lobby.diagWaitRemote('remote-diff', 90000);
  const diffAppearMs = performance.now() - tDiff0;
  const diffReady = await lobby.diagWaitRemoteReady('remote-diff', 90000);
  const diffReadyMs = performance.now() - tDiff0;
  if (!diffAppear || !diffReady) throw new Error('diff remote spawn timeout');
  await sleep(800);
  const diff = await perf.sample('two_diff_avatar', 3500);
  report.scenarios.twoDiff = {
    ...diff,
    spawnWallMs: diffAppearMs,
    appearMs: diffAppearMs,
    readyMs: diffReadyMs,
    phases: perf.phases(),
  };

  lobby.destroy();
  return report;
};
