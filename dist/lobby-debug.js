import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
const STARTER_MESH_KEYS = [
    'grass-ground',
    'plaza-pavement',
    'fountain-base',
    'plaza-center',
    'room-pad-arena',
    'room-portal-arena',
    'tree-0',
];
export function setLobbyCameraPreset(lobby, preset) {
    const cam = lobby.getScene().activeCamera;
    if (!(cam instanceof ArcRotateCamera))
        return;
    switch (preset) {
        case 'overview':
            cam.radius = 28;
            cam.beta = 1.05;
            cam.alpha = Math.PI;
            cam.setTarget(new Vector3(0, 1.4, 4));
            break;
        case 'portal':
            cam.radius = 16;
            cam.beta = 1.0;
            cam.alpha = Math.PI;
            cam.setTarget(new Vector3(0, 1.6, 18));
            break;
        default:
            cam.radius = 9.5;
            cam.beta = 1.22;
            cam.alpha = Math.PI;
            cam.setTarget(new Vector3(0, 1.65, 0));
            break;
    }
}
export function buildLobbyDebugReport(lobby) {
    const scene = lobby.getScene();
    const init = lobby.getInitPayload();
    const meshes = scene.meshes.map((m) => m.name);
    const meshSet = new Set(meshes);
    const checks = [
        {
            name: 'scene_has_meshes',
            pass: scene.meshes.length >= 20,
            detail: `meshCount=${scene.meshes.length}`,
        },
        { name: 'grass_ground', pass: meshSet.has('grass-ground') },
        { name: 'plaza_pavement', pass: meshSet.has('plaza-pavement') },
        { name: 'fountain', pass: meshSet.has('fountain-base') && meshSet.has('plaza-center') },
        { name: 'room_pad_arena', pass: meshSet.has('room-pad-arena') },
        { name: 'room_portal_arena', pass: meshSet.has('room-portal-arena') },
        {
            name: 'room_pads',
            pass: ['dual', 'reborn', 'space', 'tower', 'racing', 'zombie', 'survival'].every((id) => meshSet.has(`room-pad-${id}`)),
        },
        { name: 'trees', pass: meshSet.has('tree-0') },
        {
            name: 'path_rails',
            pass: meshSet.has('path-0-rail-L') && meshSet.has('path-0-rail-R'),
        },
        { name: 'fountain_blocker', pass: meshSet.has('fountain-blocker') },
        { name: 'shop_phys', pass: meshSet.has('shop-building-shop-phys') },
        { name: 'playground_slide', pass: meshSet.has('playground-slide-deck') },
        { name: 'playground_trampoline', pass: meshSet.has('playground-trampoline-pad') },
        {
            name: 'local_player',
            pass: meshSet.has('local-player-body') || meshSet.has('local-player-head'),
        },
        { name: 'local_player_nametag', pass: meshSet.has('local-player-nametag') },
    ];
    const root = scene.getTransformNodeByName('local-player');
    const abs = root?.getAbsolutePosition();
    const pos = abs ?? scene.getMeshByName('local-player-body')?.getAbsolutePosition();
    return {
        ready: true,
        timestamp: new Date().toISOString(),
        roomId: init.lobby?.roomId ?? 'unknown',
        gameSlug: init.game.slug,
        meshCount: scene.meshes.length,
        meshNames: meshes,
        lightCount: scene.lights.length,
        playerPosition: pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: 0, y: 0, z: 0 },
        hasStarterLayout: STARTER_MESH_KEYS.every((k) => meshSet.has(k)),
        checks,
        pass: checks.every((c) => c.pass),
    };
}
export function attachLobbyDebug(lobby, win = window) {
    const handle = {
        ready: true,
        getReport: () => buildLobbyDebugReport(lobby),
        setCamera: (preset) => setLobbyCameraPreset(lobby, preset),
        setMoveStick: (x, z) => lobby.setMoveStick(x, z),
        getLocalPose: () => lobby.getLocalPose(),
        captureScreenshot: () => {
            const canvas = lobby.getEngine().getRenderingCanvas();
            if (!canvas)
                return null;
            try {
                return canvas.toDataURL('image/png');
            }
            catch {
                return null;
            }
        },
    };
    win.__OYNA360_LOBBY_DEBUG__ = handle;
    return handle;
}
//# sourceMappingURL=lobby-debug.js.map