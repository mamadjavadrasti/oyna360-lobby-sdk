import { Color3, DynamicTexture, Mesh, MeshBuilder, PointLight, StandardMaterial, TransformNode, Vector3, } from '@babylonjs/core';
import { AvatarFactory } from './avatar-factory';
/** Default rooms for the starter plaza only. Games should pass their own `rooms`. */
export const DEFAULT_PLAZA_ROOMS = [
    { id: 'arena', name: 'آرنا نبرد', mode: 'تیمی', maxPlayers: 5, players: 2, color: '#f97316', accent: '#ef4444', theme: 'arena', position: { x: 0, y: 0, z: 20 } },
    { id: 'reborn', name: 'تولد دوباره', mode: 'تیمی', maxPlayers: 5, players: 1, color: '#fb7185', accent: '#e11d48', theme: 'arch', position: { x: 14.1, y: 0, z: 14.1 } },
    { id: 'dual', name: 'دوئل', mode: '۱ در ۱', maxPlayers: 2, players: 1, color: '#3b82f6', accent: '#60a5fa', theme: 'dual', position: { x: 20, y: 0, z: 0 } },
    { id: 'space', name: 'فضا', mode: 'انفرادی', maxPlayers: 4, players: 0, color: '#22d3ee', accent: '#10b981', theme: 'rings', position: { x: 14.1, y: 0, z: -14.1 } },
    { id: 'tower', name: 'برج', mode: 'همکاری', maxPlayers: 4, players: 2, color: '#a855f7', accent: '#c084fc', theme: 'spire', position: { x: 0, y: 0, z: -20 } },
    { id: 'racing', name: 'مسابقه', mode: 'سرعت', maxPlayers: 4, players: 1, color: '#facc15', accent: '#f97316', theme: 'track', position: { x: -14.1, y: 0, z: -14.1 } },
    { id: 'zombie', name: 'زامبی', mode: 'هجوم', maxPlayers: 5, players: 3, color: '#84cc16', accent: '#166534', theme: 'toxic', position: { x: -20, y: 0, z: 0 } },
    { id: 'survival', name: 'بقا', mode: 'همکاری', maxPlayers: 4, players: 0, color: '#38bdf8', accent: '#0ea5e9', theme: 'ice', position: { x: -14.1, y: 0, z: 14.1 } },
];
const NPC_PRESETS = [
    { name: 'Nova', bodyColor: '#ef4444', accentColor: '#fecaca', pantsColor: '#3f3f46' },
    { name: 'Kian', bodyColor: '#22c55e', accentColor: '#fde68a', pantsColor: '#14532d' },
    { name: 'Mila', bodyColor: '#a855f7', accentColor: '#f5d0fe', pantsColor: '#4c1d95' },
    { name: 'Rex', bodyColor: '#0ea5e9', accentColor: '#fef3c7', pantsColor: '#1e3a8a' },
    { name: 'Yara', bodyColor: '#f59e0b', accentColor: '#ffedd5', pantsColor: '#7c2d12' },
    { name: 'Omid', bodyColor: '#14b8a6', accentColor: '#ccfbf1', pantsColor: '#134e4a' },
    { name: 'Lina', bodyColor: '#ec4899', accentColor: '#fce7f3', pantsColor: '#9d174d' },
    { name: 'Ash', bodyColor: '#64748b', accentColor: '#e2e8f0', pantsColor: '#0f172a' },
];
/** Optional plaza template for the starter lobby. Games copy or replace this; it is not the official oyna360 lobby. */
export function applyPlazaLayout(lobby, config = {}) {
    const scene = lobby.getScene();
    const rooms = config.rooms ?? DEFAULT_PLAZA_ROOMS;
    const runtimes = [];
    buildWorld(scene);
    buildFountain(scene);
    buildShops(scene, lobby);
    plantNature(scene);
    for (const room of rooms) {
        const runtime = buildRoom(scene, room);
        runtimes.push(runtime);
        for (let i = 0; i < (room.players ?? 0); i++) {
            spawnNpc(scene, {
                x: room.position.x + (i - 0.5) * 0.7,
                y: 0,
                z: room.position.z + 0.4,
            }, NPC_PRESETS[(i + room.id.length) % NPC_PRESETS.length], `npc-${room.id}-${i}`);
        }
        lobby.addZone({
            id: `room-${room.id}`,
            bounds: {
                min: { x: room.position.x - 3.4, y: 0, z: room.position.z - 3.4 },
                max: { x: room.position.x + 3.4, y: 4, z: room.position.z + 3.4 },
            },
            onEnter: () => joinRoom(lobby, runtime, runtimes),
            onExit: () => leaveRoom(lobby, runtime, runtimes),
        });
    }
    spawnPlazaCrowd(scene, config.npcCount ?? 8);
    animateScene(scene, runtimes, lobby, config.onRoomStart);
    lobby.emitOverlay('room-state', serializeRooms(runtimes));
}
function mat(scene, id, hex, emissive = 0) {
    const m = new StandardMaterial(id, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.04, 0.04, 0.04);
    if (emissive > 0)
        m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    return m;
}
function buildWorld(scene) {
    const grass = MeshBuilder.CreateDisc('grass-ground', { radius: 42, tessellation: 48 }, scene);
    grass.rotation.x = Math.PI / 2;
    grass.position.y = 0.01;
    const grassMat = mat(scene, 'grass-mat', '#15803d');
    grassMat.zOffset = 2;
    grass.material = grassMat;
    grass.receiveShadows = false;
    const plaza = MeshBuilder.CreateCylinder('plaza-pavement', { diameter: 28, height: 0.14, tessellation: 48 }, scene);
    plaza.position.y = 0.08;
    plaza.material = mat(scene, 'plaza-mat', '#78716c');
    plaza.receiveShadows = false;
    const ring = MeshBuilder.CreateTorus('plaza-ring', { diameter: 28.4, thickness: 0.28, tessellation: 48 }, scene);
    ring.position.y = 0.2;
    ring.rotation.x = Math.PI / 2;
    ring.material = mat(scene, 'plaza-ring-mat', '#a78bfa', 0.25);
    for (let i = 0; i < 8; i++) {
        makeEntranceWalkway(scene, i);
    }
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.2;
        const tile = MeshBuilder.CreateBox(`edge-tile-${i}`, { width: 0.9, height: 0.16, depth: 0.36 }, scene);
        tile.position = new Vector3(Math.sin(a) * 14.05, 0.22, Math.cos(a) * 14.05);
        tile.rotation.y = a;
        tile.material = mat(scene, `edge-tile-mat-${i}`, i % 2 ? '#c4b5fd' : '#fde68a', 0.15);
    }
}
/** Short bridge from plaza rim to room pad — must not overlap either floor (z-fighting). */
function makeEntranceWalkway(scene, i) {
    const a = (i / 8) * Math.PI * 2;
    const plazaR = 14.08;
    const padInnerR = 16.82;
    const mid = (plazaR + padInnerR) / 2;
    const length = padInnerR - plazaR;
    const dir = new Vector3(Math.sin(a), 0, Math.cos(a));
    const side = new Vector3(Math.cos(a), 0, -Math.sin(a));
    const walk = MeshBuilder.CreateBox(`path-${i}`, { width: 2.5, height: 0.18, depth: length }, scene);
    walk.position = dir.scale(mid);
    walk.position.y = 0.13;
    walk.rotation.y = a;
    walk.material = mat(scene, `path-mat-${i}`, '#57534e');
    walk.receiveShadows = false;
    for (const s of [-1, 1]) {
        const curb = MeshBuilder.CreateBox(`path-curb-${i}-${s}`, { width: 0.14, height: 0.28, depth: length }, scene);
        curb.position = dir.scale(mid).add(side.scale(s * 1.32));
        curb.position.y = 0.2;
        curb.rotation.y = a;
        curb.material = mat(scene, `path-curb-mat-${i}-${s}`, '#94a3b8', 0.12);
    }
}
function buildFountain(scene) {
    const base = MeshBuilder.CreateCylinder('fountain-base', { diameter: 5.2, height: 0.4, tessellation: 24 }, scene);
    base.position.y = 0.25;
    base.material = mat(scene, 'fountain-base-mat', '#94a3b8');
    const bowl = MeshBuilder.CreateTorus('fountain-bowl', { diameter: 3.6, thickness: 0.35, tessellation: 24 }, scene);
    bowl.position.y = 0.7;
    bowl.rotation.x = Math.PI / 2;
    bowl.material = mat(scene, 'fountain-bowl-mat', '#cbd5e1');
    const water = MeshBuilder.CreateDisc('fountain-water', { radius: 1.45, tessellation: 24 }, scene);
    water.position.y = 0.72;
    water.rotation.x = Math.PI / 2;
    water.material = mat(scene, 'fountain-water-mat', '#22d3ee', 0.65);
    const column = MeshBuilder.CreateCylinder('fountain-column', { diameter: 0.45, height: 1.8, tessellation: 12 }, scene);
    column.position.y = 1.5;
    column.material = mat(scene, 'fountain-col-mat', '#e2e8f0');
    const jewel = MeshBuilder.CreatePolyhedron('plaza-center', { type: 2, size: 0.55 }, scene);
    jewel.position.y = 2.55;
    jewel.material = mat(scene, 'fountain-jewel-mat', '#a855f7', 0.85);
    const light = new PointLight('fountain-light', new Vector3(0, 2.8, 0), scene);
    light.diffuse = Color3.FromHexString('#c4b5fd');
    light.intensity = 0.9;
    light.range = 16;
}
function buildShops(scene, lobby) {
    const shops = [
        { id: 'shop', label: 'فروشگاه', color: '#fb7185', roof: '#be123c', a: 0.4, r: 30 },
        { id: 'cafe', label: 'کافه', color: '#fdba74', roof: '#c2410c', a: 2.0, r: 30 },
        { id: 'dojo', label: 'دوجو', color: '#5eead4', roof: '#0f766e', a: 3.6, r: 30 },
        { id: 'lab', label: 'آزمایشگاه', color: '#c4b5fd', roof: '#6d28d9', a: 5.2, r: 30 },
    ];
    shops.forEach((s) => {
        const x = Math.sin(s.a) * s.r;
        const z = Math.cos(s.a) * s.r;
        const root = new TransformNode(`shop-root-${s.id}`, scene);
        root.position = new Vector3(x, 0, z);
        root.lookAt(new Vector3(0, 0, 0));
        const body = MeshBuilder.CreateCylinder(`shop-building-${s.id}`, { diameter: 5.5, height: 3.4, tessellation: 10 }, scene);
        body.parent = root;
        body.position.y = 1.7;
        body.material = mat(scene, `shop-body-${s.id}`, s.color);
        const roof = MeshBuilder.CreateCylinder(`shop-roof-${s.id}`, { diameterTop: 0.2, diameterBottom: 6.4, height: 2.1, tessellation: 10 }, scene);
        roof.parent = root;
        roof.position.y = 4.4;
        roof.material = mat(scene, `shop-roof-${s.id}`, s.roof, 0.2);
        const window = MeshBuilder.CreateBox(`shop-window-${s.id}`, { width: 1.4, height: 1.1, depth: 0.12 }, scene);
        window.parent = root;
        window.position.set(0, 1.8, -2.7);
        window.material = mat(scene, `shop-win-${s.id}`, '#fde68a', 0.8);
        const sign = makeSign(scene, `shop-sign-${s.id}`, s.label, s.color);
        sign.parent = root;
        sign.position.set(0, 3.5, -2.85);
        if (s.id === 'shop') {
            lobby.addZone({
                id: 'shop',
                bounds: { min: { x: x - 4, y: 0, z: z - 4 }, max: { x: x + 4, y: 5, z: z + 4 } },
                onEnter: () => lobby.emitOverlay('shop', { open: true }),
                onExit: () => lobby.emitOverlay('shop', { open: false }),
            });
        }
    });
}
function plantNature(scene) {
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + 0.15;
        const r = 24 + (i % 3) * 2.4;
        makeTree(scene, `tree-${i}`, Math.sin(a) * r, Math.cos(a) * r, 1.6 + (i % 3) * 0.35);
    }
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.4;
        makeBush(scene, `bush-${i}`, Math.sin(a) * 16.8, Math.cos(a) * 16.8);
    }
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.7;
        const rock = MeshBuilder.CreatePolyhedron(`rock-${i}`, { type: i % 3, size: 0.45 + (i % 2) * 0.2 }, scene);
        rock.position = new Vector3(Math.sin(a) * 17.6, 0.28, Math.cos(a) * 17.6);
        rock.material = mat(scene, `rock-mat-${i}`, i % 2 ? '#78716c' : '#a8a29e');
    }
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        makeLamp(scene, i, Math.sin(a) * 15.2, Math.cos(a) * 15.2);
        makeBench(scene, i, Math.sin(a + 0.18) * 12.4, Math.cos(a + 0.18) * 12.4, a);
    }
}
function makeTree(scene, id, x, z, scale) {
    const trunk = MeshBuilder.CreateCylinder(`${id}-trunk`, { diameter: 0.38 * scale, height: 1.6 * scale, tessellation: 6 }, scene);
    trunk.position = new Vector3(x, 0.8 * scale, z);
    trunk.material = mat(scene, `${id}-trunk-mat`, '#7c4a1e');
    const canopy = MeshBuilder.CreateSphere(`${id}`, { diameter: 2.4 * scale, segments: 7 }, scene);
    canopy.position = new Vector3(x, 2.1 * scale, z);
    canopy.scaling.y = 0.85;
    canopy.material = mat(scene, `${id}-canopy-mat`, scale > 1.8 ? '#166534' : '#22c55e');
}
function makeBush(scene, id, x, z) {
    const bush = MeshBuilder.CreateSphere(id, { diameter: 1.15, segments: 6 }, scene);
    bush.position = new Vector3(x, 0.45, z);
    bush.scaling.y = 0.7;
    bush.material = mat(scene, `${id}-mat`, '#16a34a');
}
function makeLamp(scene, i, x, z) {
    const pole = MeshBuilder.CreateCylinder(`lamp-pole-${i}`, { height: 3.4, diameter: 0.14, tessellation: 8 }, scene);
    pole.position = new Vector3(x, 1.7, z);
    pole.material = mat(scene, `lamp-pole-mat-${i}`, '#334155');
    const bulb = MeshBuilder.CreateSphere(`lamp-bulb-${i}`, { diameter: 0.5, segments: 8 }, scene);
    bulb.position = new Vector3(x, 3.5, z);
    bulb.material = mat(scene, `lamp-bulb-mat-${i}`, '#fde68a', 0.95);
    const light = new PointLight(`lamp-light-${i}`, new Vector3(x, 3.5, z), scene);
    light.diffuse = Color3.FromHexString('#fde68a');
    light.intensity = 0.55;
    light.range = 11;
}
function makeBench(scene, i, x, z, rot) {
    const seat = MeshBuilder.CreateBox(`bench-${i}`, { width: 1.6, height: 0.12, depth: 0.45 }, scene);
    seat.position = new Vector3(x, 0.42, z);
    seat.rotation.y = rot;
    seat.material = mat(scene, `bench-mat-${i}`, '#b45309');
}
function buildRoom(scene, room) {
    const root = new TransformNode(`room-root-${room.id}`, scene);
    root.position = new Vector3(room.position.x, 0, room.position.z);
    root.lookAt(new Vector3(0, 0, 0));
    const pad = MeshBuilder.CreateCylinder(`room-pad-${room.id}`, { diameter: 6.4, height: 0.22, tessellation: 16 }, scene);
    pad.parent = root;
    pad.position.y = 0.16;
    pad.material = mat(scene, `room-pad-mat-${room.id}`, room.color, 0.55);
    pad.receiveShadows = false;
    const inner = MeshBuilder.CreateCylinder(`room-inner-${room.id}`, { diameter: 4.4, height: 0.08, tessellation: 16 }, scene);
    inner.parent = root;
    inner.position.y = 0.28;
    inner.material = mat(scene, `room-inner-mat-${room.id}`, room.accent ?? room.color, 0.35);
    const portal = MeshBuilder.CreateTorus(`room-portal-${room.id}`, { diameter: 3.8, thickness: 0.22, tessellation: 28 }, scene);
    portal.parent = root;
    portal.position.set(0, 2.08, -1.6);
    portal.material = mat(scene, `room-portal-mat-${room.id}`, room.color, 0.95);
    const veil = MeshBuilder.CreateDisc(`room-veil-${room.id}`, { radius: 1.55, tessellation: 24 }, scene);
    veil.parent = root;
    veil.position.set(0, 2.08, -1.6);
    const veilMat = mat(scene, `room-veil-mat-${room.id}`, room.color, 0.8);
    veilMat.alpha = 0.55;
    veil.material = veilMat;
    decorateTheme(scene, root, room);
    const { mesh, texture } = makeRoomSign(scene, room);
    mesh.parent = root;
    mesh.position.set(0, 4.55, 0);
    const light = new PointLight(`room-light-${room.id}`, new Vector3(0, 2.4, 0), scene);
    light.parent = root;
    light.diffuse = Color3.FromHexString(room.color);
    light.intensity = 1.05;
    light.range = 12;
    return {
        def: room,
        occupants: room.players ?? 0,
        status: 'در انتظار...',
        label: mesh,
        texture,
        countdown: null,
    };
}
function decorateTheme(scene, root, room) {
    const theme = room.theme ?? 'arena';
    if (theme === 'spire') {
        for (let i = 0; i < 4; i++) {
            const disc = MeshBuilder.CreateTorus(`room-spire-${room.id}-${i}`, { diameter: 1.8 - i * 0.25, thickness: 0.1, tessellation: 16 }, scene);
            disc.parent = root;
            disc.position.y = 1.2 + i * 0.55;
            disc.material = mat(scene, `room-spire-mat-${room.id}-${i}`, room.color, 0.6);
        }
    }
    else if (theme === 'rings') {
        const ring = MeshBuilder.CreateTorus(`room-orbit-${room.id}`, { diameter: 5.2, thickness: 0.08, tessellation: 24 }, scene);
        ring.parent = root;
        ring.position.y = 1.6;
        ring.rotation.x = 0.4;
        ring.material = mat(scene, `room-orbit-mat-${room.id}`, room.accent ?? room.color, 0.7);
    }
    else if (theme === 'dual') {
        for (const side of [-1.3, 1.3]) {
            const p = MeshBuilder.CreateCylinder(`room-dual-${room.id}-${side}`, { diameter: 0.35, height: 2.8, tessellation: 8 }, scene);
            p.parent = root;
            p.position.set(side, 1.5, -1.1);
            p.material = mat(scene, `room-dual-mat-${room.id}`, room.color, 0.5);
        }
    }
    else if (theme === 'toxic') {
        const goo = MeshBuilder.CreateSphere(`room-goo-${room.id}`, { diameter: 1.1, segments: 6 }, scene);
        goo.parent = root;
        goo.position.set(1.6, 0.55, 1.1);
        goo.material = mat(scene, `room-goo-mat-${room.id}`, room.color, 0.7);
    }
    else if (theme === 'ice') {
        const crystal = MeshBuilder.CreatePolyhedron(`room-ice-${room.id}`, { type: 1, size: 0.7 }, scene);
        crystal.parent = root;
        crystal.position.set(-1.5, 1.1, 1);
        crystal.material = mat(scene, `room-ice-mat-${room.id}`, room.color, 0.6);
    }
    else if (theme === 'track') {
        const curb = MeshBuilder.CreateTorus(`room-track-${room.id}`, { diameter: 5.6, thickness: 0.16, tessellation: 20 }, scene);
        curb.parent = root;
        curb.position.y = 0.22;
        curb.rotation.x = Math.PI / 2;
        curb.material = mat(scene, `room-track-mat-${room.id}`, '#111827', 0.1);
    }
    else {
        for (const side of [-2.1, 2.1]) {
            const col = MeshBuilder.CreateCylinder(`room-col-${room.id}-${side}`, { diameter: 0.42, height: 2.6, tessellation: 8 }, scene);
            col.parent = root;
            col.position.set(side, 1.35, -0.8);
            col.material = mat(scene, `room-col-mat-${room.id}`, room.accent ?? '#fecaca', 0.35);
        }
    }
}
function hexRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
    };
}
function roundedRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}
function labelMaterial(scene, id, texture) {
    const m = new StandardMaterial(id, scene);
    m.diffuseTexture = texture;
    m.opacityTexture = texture;
    m.emissiveColor = Color3.White();
    m.diffuseColor = Color3.White();
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    m.disableLighting = true;
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = 2;
    return m;
}
function makeRoomSign(scene, room) {
    const mesh = MeshBuilder.CreatePlane(`room-sign-${room.id}`, { width: 4.2, height: 1.05 }, scene);
    const texture = new DynamicTexture(`room-sign-tex-${room.id}`, { width: 1024, height: 256 }, scene, false);
    texture.hasAlpha = true;
    paintSign(texture, room, room.players ?? 0, 'در انتظار...');
    mesh.material = labelMaterial(scene, `room-sign-mat-${room.id}`, texture);
    mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    return { mesh, texture };
}
function paintSign(texture, room, occupants, status) {
    const ctx = texture.getContext();
    const { r, g, b } = hexRgb(room.color);
    ctx.clearRect(0, 0, 1024, 256);
    roundedRect(ctx, 36, 28, 952, 200, 40);
    ctx.fillStyle = `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.stroke();
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Tahoma, Arial';
    ctx.fillText(room.name, 948, 108);
    ctx.font = 'bold 34px Tahoma, Arial';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${occupants} از ${room.maxPlayers}   ${status}`, 948, 178);
    ctx.shadowBlur = 0;
    texture.update();
}
function makeSign(scene, id, text, color) {
    const plane = MeshBuilder.CreatePlane(id, { width: 3.4, height: 0.7 }, scene);
    const tex = new DynamicTexture(`${id}-tex`, { width: 512, height: 128 }, scene, false);
    tex.hasAlpha = true;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 512, 128);
    const { r, g, b } = hexRgb(color);
    roundedRect(ctx, 16, 24, 480, 80, 24);
    ctx.fillStyle = `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.stroke();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Tahoma, Arial';
    ctx.fillText(text, 256, 64);
    ctx.shadowBlur = 0;
    tex.update();
    plane.material = labelMaterial(scene, `${id}-mat`, tex);
    plane.isPickable = false;
    plane.checkCollisions = false;
    return plane;
}
function spawnNpc(scene, pos, preset, id) {
    const npc = AvatarFactory.create(scene, {
        presetId: id,
        presetKey: 'npc',
        presetKind: 'procedural',
        customConfig: preset,
    }, id, preset.name, { collider: 'body' });
    npc.position = new Vector3(pos.x, pos.y, pos.z);
    npc.rotation.y = Math.random() * Math.PI * 2;
    return npc;
}
function spawnPlazaCrowd(scene, count) {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + 0.3;
        const r = 5 + (i % 3) * 2.2;
        spawnNpc(scene, { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r }, NPC_PRESETS[i % NPC_PRESETS.length], `plaza-npc-${i}`);
    }
}
function joinRoom(lobby, runtime, all) {
    if (runtime.occupants < runtime.def.maxPlayers)
        runtime.occupants += 1;
    runtime.status = runtime.occupants >= runtime.def.maxPlayers ? 'شروع بازی' : 'در انتظار...';
    paintSign(runtime.texture, runtime.def, runtime.occupants, runtime.status);
    lobby.emitOverlay('room-state', {
        ...serializeRooms(all),
        joined: runtime.def.id,
        countdown: runtime.occupants >= runtime.def.maxPlayers ? 5 : null,
    });
    if (runtime.occupants >= runtime.def.maxPlayers && runtime.countdown == null) {
        runtime.countdown = 5;
    }
}
function leaveRoom(lobby, runtime, all) {
    runtime.occupants = Math.max(runtime.def.players ?? 0, runtime.occupants - 1);
    if (runtime.occupants < runtime.def.maxPlayers) {
        runtime.status = 'در انتظار...';
        runtime.countdown = null;
    }
    paintSign(runtime.texture, runtime.def, runtime.occupants, runtime.status);
    lobby.emitOverlay('room-state', serializeRooms(all));
}
function serializeRooms(all) {
    return {
        rooms: all.map((r) => ({
            id: r.def.id,
            name: r.def.name,
            occupants: r.occupants,
            maxPlayers: r.def.maxPlayers,
            status: r.status,
            countdown: r.countdown,
        })),
    };
}
function animateScene(scene, runtimes, lobby, onRoomStart) {
    let t = 0;
    const lastCeil = {};
    scene.registerBeforeRender(() => {
        const dt = scene.getEngine().getDeltaTime() * 0.001;
        t += dt;
        const jewel = scene.getMeshByName('plaza-center');
        if (jewel) {
            jewel.rotation.y = t * 0.6;
            jewel.position.y = 2.55 + Math.sin(t * 2) * 0.08;
        }
        for (const r of runtimes) {
            const veil = scene.getMeshByName(`room-veil-${r.def.id}`);
            if (veil)
                veil.rotation.y = t * 0.8;
            const portal = scene.getMeshByName(`room-portal-${r.def.id}`);
            if (portal)
                portal.rotation.z = Math.sin(t) * 0.08;
            if (r.countdown != null) {
                r.countdown -= dt;
                const ceil = Math.max(0, Math.ceil(r.countdown));
                if (lastCeil[r.def.id] !== ceil) {
                    lastCeil[r.def.id] = ceil;
                    r.status = 'شروع بازی';
                    paintSign(runtimeSign(r), r.def, r.occupants, `شروع ${ceil}`);
                    lobby.emitOverlay('room-state', { ...serializeRooms(runtimes), joined: r.def.id, countdown: ceil });
                }
                if (r.countdown <= 0) {
                    r.countdown = null;
                    lobby.emitOverlay('room-start', {
                        roomId: r.def.id,
                        name: r.def.name,
                        gameSlug: r.def.gameSlug,
                    });
                    onRoomStart?.({
                        id: r.def.id,
                        name: r.def.name,
                        gameSlug: r.def.gameSlug,
                    });
                }
            }
        }
    });
}
function runtimeSign(r) {
    return r.texture;
}
//# sourceMappingURL=plaza-layout.js.map