import { ArcRotateCamera, Color3, Color4, DefaultRenderingPipeline, DirectionalLight, Engine, GlowLayer, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3, } from '@babylonjs/core';
export class SceneManager {
    engine;
    scene;
    camera;
    groundMaterial;
    cameraDistance;
    cameraHeight;
    constructor(canvas, config = {}) {
        this.engine = new Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
        });
        this.scene = new Scene(this.engine);
        this.cameraDistance = config.cameraDistance ?? 12;
        this.cameraHeight = config.cameraHeight ?? 1.05;
        const sky = Color3.FromHexString(config.skyColor ?? '#1a1450');
        this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
        const groundSize = config.groundSize ?? 80;
        const ground = MeshBuilder.CreateGround('ground', { width: groundSize, height: groundSize }, this.scene);
        this.groundMaterial = new StandardMaterial('ground-mat', this.scene);
        this.groundMaterial.diffuseColor = Color3.FromHexString(config.groundColor ?? '#166534');
        this.groundMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
        ground.material = this.groundMaterial;
        ground.checkCollisions = true;
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
        this.camera = new ArcRotateCamera('camera', Math.PI, this.cameraHeight, this.cameraDistance, new Vector3(0, 1.4, 0), this.scene);
        this.camera.lowerRadiusLimit = 8;
        this.camera.upperRadiusLimit = 18;
        this.camera.lowerBetaLimit = 0.7;
        this.camera.upperBetaLimit = 1.25;
        this.camera.wheelPrecision = 40;
        this.camera.panningSensibility = 0;
        const glow = new GlowLayer('plaza-glow', this.scene);
        glow.intensity = 0.28;
        const fx = new DefaultRenderingPipeline('plaza-fx', true, this.scene, [this.camera]);
        fx.bloomEnabled = true;
        fx.bloomThreshold = 0.72;
        fx.bloomWeight = 0.18;
        fx.bloomKernel = 32;
        fx.fxaaEnabled = true;
        fx.imageProcessingEnabled = true;
        if (fx.imageProcessing) {
            fx.imageProcessing.contrast = 1.12;
            fx.imageProcessing.exposure = 1.05;
        }
    }
    followPlayer(position, rotationY) {
        this.camera.target = new Vector3(position.x, position.y + 1.45, position.z);
        this.camera.alpha = -rotationY + Math.PI;
        this.camera.beta = this.cameraHeight;
        this.camera.radius = this.cameraDistance;
    }
    setCameraTarget(target) {
        this.camera.target = new Vector3(target.x, target.y + 1.4, target.z);
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
        this.engine.resize();
    }
    dispose() {
        this.engine.stopRenderLoop();
        this.scene.dispose();
        this.engine.dispose();
    }
}
//# sourceMappingURL=scene-manager.js.map