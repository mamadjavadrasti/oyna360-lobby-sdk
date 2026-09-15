import { Color3, Color4, DefaultRenderingPipeline, DirectionalLight, Engine, GlowLayer, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3, } from '@babylonjs/core';
import { LOBBY_QUALITY, isTouchDevice, resolveLobbyQuality, shouldDisableLobbyBloom, } from './quality';
import { ThirdPersonCamera } from './third-person-camera';
import { isLobbyPerfDiagEnabled, lobbyPerfBeginFrame, lobbyPerfEndFrame, lobbyPerfMark, } from './lobby-perf-diag';
export class SceneManager {
    engine;
    scene;
    thirdPerson;
    groundMaterial;
    canvas;
    glow;
    fx;
    qualityLevel;
    baseGlowIntensity = 0.28;
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.qualityLevel = resolveLobbyQuality(config.quality);
        const quality = LOBBY_QUALITY[this.qualityLevel];
        this.engine = new Engine(canvas, quality.antialias, {
            stencil: true,
            adaptToDeviceRatio: true,
            limitDeviceRatio: quality.pixelRatioCap,
            // preserveDrawingBuffer doubles GPU memory and is only needed for screenshots.
            preserveDrawingBuffer: false,
            powerPreference: isTouchDevice() ? 'low-power' : 'high-performance',
        });
        // Plaza PointLights + skinned PBR + HDR/prepass exceeds WebGL2's 12 vertex
        // UBO slots on many GPUs; the second unique avatar shader fails to compile
        // and the body vanishes (nametag only). Regular uniforms stay under budget.
        this.engine.disableUniformBuffers = true;
        this.scene = new Scene(this.engine);
        this.scene.metadata = {
            ...(this.scene.metadata ?? {}),
            lobbyQuality: this.qualityLevel,
            lobbyAvatarCount: 0,
            applyLobbyCrowdLoad: (count) => this.applyCrowdLoad(count),
        };
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new Vector3(0, -0.8, 0);
        const sky = Color3.FromHexString(config.skyColor ?? '#1a1450');
        this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
        const groundSize = config.groundSize ?? 80;
        const ground = MeshBuilder.CreateGround('ground', { width: groundSize, height: groundSize }, this.scene);
        this.groundMaterial = new StandardMaterial('ground-mat', this.scene);
        this.groundMaterial.diffuseColor = Color3.FromHexString(config.groundColor ?? '#166534');
        this.groundMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
        ground.material = this.groundMaterial;
        ground.checkCollisions = true;
        ground.isPickable = true;
        ground.receiveShadows = true;
        const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.15), this.scene);
        hemi.intensity = config.ambientIntensity ?? 0.55;
        hemi.groundColor = Color3.FromHexString('#1e1b4b');
        const moon = new DirectionalLight('moon', new Vector3(-0.35, -1, -0.2), this.scene);
        moon.intensity = 0.35;
        moon.diffuse = Color3.FromHexString('#c4b5fd');
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = config.fogDensity ?? 0.012;
        this.scene.fogColor = sky;
        const distance = config.cameraDistance && config.cameraDistance >= 3.5 ? config.cameraDistance : 9.5;
        const height = config.cameraHeight && config.cameraHeight >= 1.8 ? config.cameraHeight : 5;
        this.thirdPerson = new ThirdPersonCamera(this.scene, canvas, { distance, height });
        canvas.tabIndex = 0;
        canvas.style.outline = 'none';
        canvas.addEventListener('pointerdown', () => canvas.focus());
        queueMicrotask(() => canvas.focus());
        this.glow = new GlowLayer('plaza-glow', this.scene);
        this.glow.intensity = this.baseGlowIntensity;
        this.scene.metadata = { ...(this.scene.metadata ?? {}), plazaGlow: this.glow };
        this.fx = new DefaultRenderingPipeline('plaza-fx', true, this.scene, [this.thirdPerson.camera]);
        this.fx.bloomEnabled = quality.bloom;
        this.fx.bloomThreshold = 0.72;
        this.fx.bloomWeight = quality.bloomWeight;
        this.fx.bloomKernel = quality.bloomKernel;
        this.fx.fxaaEnabled = quality.fxaa;
        this.fx.imageProcessingEnabled = true;
        // Scene-level only — never enable per-mesh SSAO/DoF (skinned avatars break + cost GPU).
        const fxAny = this.fx;
        if ('ssaoEnabled' in fxAny)
            fxAny.ssaoEnabled = false;
        if ('depthOfFieldEnabled' in fxAny)
            fxAny.depthOfFieldEnabled = false;
        if ('chromaticAberrationEnabled' in fxAny)
            fxAny.chromaticAberrationEnabled = false;
        if ('sharpenEnabled' in fxAny)
            fxAny.sharpenEnabled = false;
        if ('grainEnabled' in fxAny)
            fxAny.grainEnabled = false;
        if (this.fx.imageProcessing) {
            this.fx.imageProcessing.contrast = 1.12;
            this.fx.imageProcessing.exposure = 1.05;
        }
        this.engine.onContextLostObservable.add(() => {
            console.warn('[lobby-sdk] WebGL context lost — dropping post-FX');
        });
        this.engine.onContextRestoredObservable.add(() => {
            this.applyCrowdLoad(Math.max(this.readAvatarCount(), 12));
            this.engine.resize(true);
        });
    }
    readAvatarCount() {
        const count = this.scene.metadata?.lobbyAvatarCount;
        return typeof count === 'number' ? count : 0;
    }
    applyCrowdLoad(avatarCount) {
        this.scene.metadata = { ...(this.scene.metadata ?? {}), lobbyAvatarCount: avatarCount };
        const touch = isTouchDevice();
        const bloomOff = shouldDisableLobbyBloom({
            quality: this.qualityLevel,
            touch,
            avatarCount,
        });
        this.fx.bloomEnabled = !bloomOff && LOBBY_QUALITY[this.qualityLevel].bloom;
        this.glow.intensity = bloomOff ? 0.1 : this.baseGlowIntensity;
        if (touch && avatarCount >= 20) {
            this.engine.setHardwareScalingLevel(Math.max(this.engine.getHardwareScalingLevel(), 1.25));
        }
    }
    get camera() {
        return this.thirdPerson.camera;
    }
    followPlayer(position, dt, ignoreMeshes = []) {
        this.thirdPerson.update(position, dt, ignoreMeshes);
    }
    setCameraTarget(target) {
        this.camera.setTarget(new Vector3(target.x, target.y + 1.4, target.z));
    }
    applyTheme(config) {
        if (config.groundColor) {
            this.groundMaterial.diffuseColor = Color3.FromHexString(config.groundColor);
        }
        if (config.skyColor) {
            const sky = Color3.FromHexString(config.skyColor);
            this.scene.fogColor = sky;
            this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
        }
    }
    startRenderLoop(onFrame) {
        this.engine.runRenderLoop(() => {
            lobbyPerfBeginFrame();
            const tLogic = isLobbyPerfDiagEnabled() ? performance.now() : 0;
            onFrame();
            if (isLobbyPerfDiagEnabled()) {
                lobbyPerfMark('frame_logic', performance.now() - tLogic);
            }
            const tRender = isLobbyPerfDiagEnabled() ? performance.now() : 0;
            this.scene.render();
            if (isLobbyPerfDiagEnabled()) {
                lobbyPerfMark('scene_render', performance.now() - tRender);
            }
            lobbyPerfEndFrame(this.engine, this.scene);
        });
    }
    resize() {
        this.engine.resize(true);
    }
    dispose() {
        this.thirdPerson.dispose(this.canvas);
        this.engine.stopRenderLoop();
        this.scene.dispose();
        this.engine.dispose();
    }
}
//# sourceMappingURL=scene-manager.js.map