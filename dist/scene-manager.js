import { Color3, Color4, DefaultRenderingPipeline, DirectionalLight, Engine, GlowLayer, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3, } from '@babylonjs/core';
import { lobbyQualitySettings } from './quality';
import { ThirdPersonCamera } from './third-person-camera';
export class SceneManager {
    engine;
    scene;
    thirdPerson;
    groundMaterial;
    canvas;
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        const quality = lobbyQualitySettings(config.quality);
        this.engine = new Engine(canvas, quality.antialias, {
            preserveDrawingBuffer: true,
            stencil: true,
            adaptToDeviceRatio: true,
            limitDeviceRatio: quality.pixelRatioCap,
        });
        this.scene = new Scene(this.engine);
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
        const distance = config.cameraDistance && config.cameraDistance >= 6 ? config.cameraDistance : 9.5;
        const height = config.cameraHeight && config.cameraHeight >= 2 ? config.cameraHeight : 5;
        this.thirdPerson = new ThirdPersonCamera(this.scene, canvas, { distance, height });
        canvas.tabIndex = 0;
        canvas.style.outline = 'none';
        canvas.addEventListener('pointerdown', () => canvas.focus());
        queueMicrotask(() => canvas.focus());
        const glow = new GlowLayer('plaza-glow', this.scene);
        glow.intensity = 0.28;
        const fx = new DefaultRenderingPipeline('plaza-fx', true, this.scene, [this.thirdPerson.camera]);
        fx.bloomEnabled = quality.bloom;
        fx.bloomThreshold = 0.72;
        fx.bloomWeight = quality.bloomWeight;
        fx.bloomKernel = quality.bloomKernel;
        fx.fxaaEnabled = quality.fxaa;
        fx.imageProcessingEnabled = true;
        if (fx.imageProcessing) {
            fx.imageProcessing.contrast = 1.12;
            fx.imageProcessing.exposure = 1.05;
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
            onFrame();
            this.scene.render();
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