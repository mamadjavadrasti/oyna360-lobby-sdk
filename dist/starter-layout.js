import { Color3, MeshBuilder, PointLight, StandardMaterial, TransformNode, Vector3, } from '@babylonjs/core';
export function applyStarterLayout(lobby, config = {}) {
    const scene = lobby.getScene();
    const { showZones = true, showGameplayPortal = true, showGrid = true, gamePortals = [], } = config;
    if (showGrid) {
        const grid = MeshBuilder.CreateGround('grid-floor', { width: 48, height: 48, subdivisions: 24 }, scene);
        grid.position.y = 0.015;
        const gridMat = new StandardMaterial('grid-floor-mat', scene);
        gridMat.wireframe = true;
        gridMat.emissiveColor = Color3.FromHexString('#818cf8').scale(0.12);
        grid.material = gridMat;
    }
    const plaza = MeshBuilder.CreateDisc('spawn-plaza', { radius: 4, tessellation: 48 }, scene);
    plaza.position.y = 0.03;
    const plazaMat = new StandardMaterial('spawn-plaza-mat', scene);
    plazaMat.diffuseColor = Color3.FromHexString('#7c3aed');
    plazaMat.emissiveColor = Color3.FromHexString('#a78bfa').scale(0.55);
    plaza.material = plazaMat;
    const pillarPositions = [
        { x: -12, y: 0, z: -12 },
        { x: 12, y: 0, z: -12 },
        { x: -12, y: 0, z: 12 },
        { x: 12, y: 0, z: 12 },
    ];
    for (let i = 0; i < pillarPositions.length; i++) {
        const p = pillarPositions[i];
        const pillar = MeshBuilder.CreateBox(`pillar-${i}`, { width: 1.2, height: 4, depth: 1.2 }, scene);
        pillar.position = new Vector3(p.x, 2, p.z);
        const mat = new StandardMaterial(`pillar-mat-${i}`, scene);
        mat.diffuseColor = Color3.FromHexString('#4338ca');
        mat.emissiveColor = Color3.FromHexString('#818cf8').scale(0.35);
        pillar.material = mat;
    }
    if (showGameplayPortal) {
        createPortalVisual(scene, 'portal-main', { x: 0, y: 0, z: 10 }, '#22d3ee');
        lobby.addPortal({
            id: 'gameplay-portal',
            position: { x: 0, y: 0, z: 10 },
            radius: 2.2,
            toScene: 'gameplay',
        });
    }
    if (showZones) {
        createZonePlatform(scene, 'zone-shop', { x: -8, y: 0, z: 0 }, '#f59e0b');
        lobby.addZone({
            id: 'shop',
            bounds: { min: { x: -10, y: 0, z: -3 }, max: { x: -6, y: 4, z: 3 } },
            onEnter: () => lobby.emitOverlay('shop', { open: true }),
            onExit: () => lobby.emitOverlay('shop', { open: false }),
        });
        createZonePlatform(scene, 'zone-leaderboard', { x: 8, y: 0, z: 0 }, '#10b981');
        lobby.addZone({
            id: 'leaderboard',
            bounds: { min: { x: 6, y: 0, z: -3 }, max: { x: 10, y: 4, z: 3 } },
            onEnter: () => lobby.emitOverlay('leaderboard', { open: true }),
            onExit: () => lobby.emitOverlay('leaderboard', { open: false }),
        });
    }
    for (const gp of gamePortals) {
        createPortalVisual(scene, `portal-${gp.slug}`, gp.position, '#a855f7');
        lobby.addPortal({
            id: `portal-${gp.slug}`,
            position: gp.position,
            radius: 2,
            toGameSlug: gp.slug,
            label: gp.name,
        });
    }
}
export function createPortalVisual(scene, id, position, color) {
    const root = new TransformNode(`portal-root-${id}`, scene);
    root.position = new Vector3(position.x, 0, position.z);
    const ring = MeshBuilder.CreateTorus(`portal-ring-${id}`, { diameter: 3.2, thickness: 0.28, tessellation: 48 }, scene);
    ring.parent = root;
    ring.position.y = 2.2;
    ring.rotation.x = Math.PI / 2;
    const ringMat = new StandardMaterial(`portal-ring-mat-${id}`, scene);
    ringMat.diffuseColor = Color3.FromHexString(color);
    ringMat.emissiveColor = Color3.FromHexString(color).scale(0.85);
    ring.material = ringMat;
    const pad = MeshBuilder.CreateDisc(`portal-pad-${id}`, { radius: 1.6, tessellation: 32 }, scene);
    pad.parent = root;
    pad.position.y = 0.04;
    const padMat = new StandardMaterial(`portal-pad-mat-${id}`, scene);
    padMat.diffuseColor = Color3.FromHexString(color);
    padMat.emissiveColor = Color3.FromHexString(color).scale(0.35);
    pad.material = padMat;
    const light = new PointLight(`portal-light-${id}`, new Vector3(0, 2.5, 0), scene);
    light.diffuse = Color3.FromHexString(color);
    light.intensity = 1.2;
    light.parent = root;
    return root;
}
function createZonePlatform(scene, id, position, color) {
    const disc = MeshBuilder.CreateDisc(id, { radius: 2.2, tessellation: 32 }, scene);
    disc.position = new Vector3(position.x, 0.04, position.z);
    const mat = new StandardMaterial(`${id}-mat`, scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.emissiveColor = Color3.FromHexString(color).scale(0.45);
    disc.material = mat;
}
//# sourceMappingURL=starter-layout.js.map