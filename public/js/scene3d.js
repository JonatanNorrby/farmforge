import {
    ArcRotateCamera,
    Color3,
    Color4,
    DirectionalLight,
    Engine,
    HemisphericLight,
    MeshBuilder,
    PointerEventTypes,
    Scene,
    StandardMaterial,
    TransformNode,
    Vector3
} from "@babylonjs/core";

import { FARM_SIZE, FARM_TILE_COUNT } from "./game.js";

const TILE_SPACING = 1.08;
const FIELD_WIDTH = FARM_SIZE * TILE_SPACING;
const PLANT_OFFSETS = [
    [0, 0],
    [-0.22, -0.17],
    [0.23, 0.14],
    [-0.15, 0.23],
    [0.2, -0.2]
];

function material(scene, name, color) {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = new Color3(0.06, 0.06, 0.06);
    return result;
}

function tilePosition(index) {
    const column = index % FARM_SIZE;
    const row = Math.floor(index / FARM_SIZE);
    return {
        x: (column - (FARM_SIZE - 1) / 2) * TILE_SPACING,
        z: (row - (FARM_SIZE - 1) / 2) * TILE_SPACING
    };
}

function boxPart(scene, parent, name, size, position, mat) {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.parent = parent;
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
}

/**
 * This class owns visual meshes only. The Game remains authoritative for
 * planting, growth, harvesting, money and persistent save data.
 */
export class FarmScene {
    constructor(canvas, onTileClick, onTileHover) {
        this.canvas = canvas;
        this.onTileClick = onTileClick;
        this.onTileHover = onTileHover;
        this.engine = new Engine(canvas, true, { stencil: true }, true);
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color4(0.76, 0.85, 0.88, 1);

        this.materials = {
            grass: material(this.scene, "grass", "#7d9d64"),
            fieldBase: material(this.scene, "field-base", "#80633e"),
            soil: material(this.scene, "soil", "#9b7550"),
            soilAlternate: material(this.scene, "soil-alternate", "#a27e56"),
            soilReady: material(this.scene, "soil-ready", "#b18b54"),
            hover: material(this.scene, "soil-hover", "#d5b67d"),
            fence: material(this.scene, "fence", "#bd9467"),
            stem: material(this.scene, "stem", "#4e8742"),
            leaf: material(this.scene, "leaf", "#83b257"),
            goldenStem: material(this.scene, "golden-stem", "#bca34b"),
            grain: material(this.scene, "grain", "#f0cb69"),
            machine: material(this.scene, "machine", "#4a7356"),
            machineTop: material(this.scene, "machine-top", "#c8dc9b"),
            machineMetal: material(this.scene, "machine-metal", "#53616a"),
            rubber: material(this.scene, "rubber", "#343c40"),
            path: material(this.scene, "path", "#c3ae85")
        };
        this.materials.hover.emissiveColor = new Color3(0.16, 0.12, 0.04);

        const sunlight = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.65), this.scene);
        sunlight.intensity = 0.65;
        const fill = new HemisphericLight("ambient", new Vector3(0, 1, 0), this.scene);
        fill.intensity = 0.9;

        this.camera = new ArcRotateCamera(
            "farm-camera",
            -Math.PI / 3.6,
            Math.PI / 3.1,
            16.5,
            new Vector3(0.35, 0, 0),
            this.scene
        );
        this.camera.attachControl(canvas, true);
        this.camera.lowerRadiusLimit = 10;
        this.camera.upperRadiusLimit = 25;
        this.camera.lowerBetaLimit = 0.35;
        this.camera.upperBetaLimit = Math.PI / 2.15;
        this.camera.wheelPrecision = 55;
        this.camera.panningSensibility = 0;
        this.camera.inertia = 0.65;

        this.tiles = [];
        this.cropRoots = Array(FARM_TILE_COUNT).fill(null);
        this.stages = Array(FARM_TILE_COUNT).fill(-1);
        this.hoveredIndex = null;
        this.keyboardIndex = 27;
        this.pointerDown = null;
        this.harvesterShown = false;

        this.buildWorld();
        this.harvester = this.buildHarvester();
        this.harvester.setEnabled(false);
        this.bindInteraction();

        this.onResize = () => this.resize();
        window.addEventListener("resize", this.onResize);
        this.resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(this.onResize)
            : null;
        this.resizeObserver?.observe(canvas.parentElement);

        this.engine.runRenderLoop(() => {
            if (this.harvesterShown) {
                this.harvesterReel.rotation.x += this.engine.getDeltaTime() * 0.002;
            }
            this.scene.render();
        });
    }

    buildWorld() {
        const grass = MeshBuilder.CreateGround(
            "meadow",
            { width: 17, height: 14 },
            this.scene
        );
        grass.position.y = -0.28;
        grass.material = this.materials.grass;
        grass.isPickable = false;

        const field = MeshBuilder.CreateBox(
            "field-platform",
            { width: FIELD_WIDTH + 0.55, height: 0.29, depth: FIELD_WIDTH + 0.55 },
            this.scene
        );
        field.position.y = -0.18;
        field.material = this.materials.fieldBase;
        field.isPickable = false;

        for (let index = 0; index < FARM_TILE_COUNT; index += 1) {
            const point = tilePosition(index);
            const tile = MeshBuilder.CreateBox(
                "plot-" + index,
                { width: 1, height: 0.13, depth: 1 },
                this.scene
            );
            tile.position.set(point.x, 0.025, point.z);
            tile.material = index % 2
                ? this.materials.soilAlternate
                : this.materials.soil;
            tile.metadata = { tileIndex: index };
            this.tiles.push(tile);
        }

        const edge = FIELD_WIDTH / 2 + 0.38;
        for (let side = -1; side <= 1; side += 2) {
            boxPart(this.scene, null, "fence-horizontal", {
                width: FIELD_WIDTH + 0.95, height: 0.14, depth: 0.12
            }, { x: 0, y: 0.3, z: side * edge }, this.materials.fence);
            boxPart(this.scene, null, "fence-vertical", {
                width: 0.12, height: 0.14, depth: FIELD_WIDTH + 0.95
            }, { x: side * edge, y: 0.3, z: 0 }, this.materials.fence);
        }

        for (let x of [-edge, edge]) {
            for (let z of [-edge, edge]) {
                boxPart(this.scene, null, "fence-post", {
                    width: 0.19, height: 0.55, depth: 0.19
                }, { x, y: 0.17, z }, this.materials.fence);
            }
        }

        boxPart(this.scene, null, "equipment-path", {
            width: 1.45, height: 0.025, depth: 3.3
        }, { x: 5.45, y: -0.25, z: 0 }, this.materials.path);
    }

    buildHarvester() {
        const root = new TransformNode("harvester", this.scene);
        root.position.set(5.45, -0.02, 0);
        boxPart(this.scene, root, "harvester-body", {
            width: 0.96, height: 0.38, depth: 1.1
        }, { x: 0, y: 0.35, z: 0 }, this.materials.machine);
        boxPart(this.scene, root, "harvester-cab", {
            width: 0.66, height: 0.32, depth: 0.56
        }, { x: 0, y: 0.68, z: 0.18 }, this.materials.machineTop);
        boxPart(this.scene, root, "harvester-header", {
            width: 1.25, height: 0.12, depth: 0.2
        }, { x: 0, y: 0.25, z: -0.65 }, this.materials.machineMetal);

        for (const x of [-0.54, 0.54]) {
            for (const z of [-0.36, 0.36]) {
                const wheel = MeshBuilder.CreateCylinder(
                    "harvester-wheel",
                    { height: 0.16, diameter: 0.38, tessellation: 10 },
                    this.scene
                );
                wheel.parent = root;
                wheel.position.set(x, 0.18, z);
                wheel.rotation.z = Math.PI / 2;
                wheel.material = this.materials.rubber;
                wheel.isPickable = false;
            }
        }

        this.harvesterReel = boxPart(this.scene, root, "harvester-reel", {
            width: 1.08, height: 0.065, depth: 0.065
        }, { x: 0, y: 0.34, z: -0.69 }, this.materials.grain);

        return root;
    }

    pickTile(info) {
        const fromInfo = info.pickInfo?.pickedMesh?.metadata?.tileIndex;
        if (Number.isInteger(fromInfo)) {
            return fromInfo;
        }
        const result = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh) => Number.isInteger(mesh.metadata?.tileIndex)
        );
        return result?.hit ? result.pickedMesh.metadata.tileIndex : null;
    }

    setHover(index) {
        if (this.hoveredIndex === index) return;

        const previous = this.hoveredIndex;
        this.hoveredIndex = index;
        if (previous !== null) this.updateTileMaterial(previous);
        if (index !== null) this.updateTileMaterial(index);
        this.onTileHover(index);
    }

    bindInteraction() {
        this.pointerObserver = this.scene.onPointerObservable.add((info) => {
            const index = this.pickTile(info);
            const event = info.event;

            if (info.type === PointerEventTypes.POINTERMOVE) {
                this.setHover(index);
            } else if (info.type === PointerEventTypes.POINTERDOWN) {
                this.pointerDown = {
                    index,
                    x: event.clientX,
                    y: event.clientY
                };
            } else if (info.type === PointerEventTypes.POINTERUP) {
                const down = this.pointerDown;
                this.pointerDown = null;
                if (!down || index === null || down.index !== index) return;
                const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
                if (moved <= 7) {
                    this.canvas.focus({ preventScroll: true });
                    this.onTileClick(index);
                }
            }
        });

        this.onKeyDown = (event) => {
            const move = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -FARM_SIZE,
                ArrowDown: FARM_SIZE
            }[event.key];

            if (move !== undefined) {
                const col = this.keyboardIndex % FARM_SIZE;
                if ((move === -1 && col === 0) || (move === 1 && col === FARM_SIZE - 1)) {
                    event.preventDefault();
                    return;
                }
                const next = this.keyboardIndex + move;
                if (next >= 0 && next < FARM_TILE_COUNT) {
                    this.keyboardIndex = next;
                    this.setHover(next);
                }
                event.preventDefault();
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.onTileClick(this.keyboardIndex);
            }
        };
        this.canvas.addEventListener("keydown", this.onKeyDown);
    }

    updateTileMaterial(index) {
        if (this.hoveredIndex === index) {
            this.tiles[index].material = this.materials.hover;
        } else if (this.stages[index] === 4) {
            this.tiles[index].material = this.materials.soilReady;
        } else {
            this.tiles[index].material = index % 2
                ? this.materials.soilAlternate
                : this.materials.soil;
        }
    }

    buildCrop(index, stage) {
        if (stage === 0) return;

        const point = tilePosition(index);
        const root = new TransformNode("crop-" + index, this.scene);
        root.position.set(point.x, 0.095, point.z);

        const numberOfStalks = Math.min(stage + 1, PLANT_OFFSETS.length);
        const height = [0, 0.14, 0.34, 0.47, 0.62][stage];
        const ripe = stage === 4;
        const stemMaterial = ripe ? this.materials.goldenStem : this.materials.stem;
        const leafMaterial = ripe ? this.materials.grain : this.materials.leaf;

        for (let i = 0; i < numberOfStalks; i += 1) {
            const [x, z] = PLANT_OFFSETS[i];
            const stalk = MeshBuilder.CreateCylinder(
                "crop-stalk",
                { height, diameterTop: 0.025, diameterBottom: 0.075, tessellation: 5 },
                this.scene
            );
            stalk.parent = root;
            stalk.position.set(x, height / 2, z);
            stalk.material = stemMaterial;
            stalk.isPickable = false;

            const leaf = boxPart(this.scene, root, "crop-leaf", {
                width: 0.15, height: 0.028, depth: 0.065
            }, { x: x + 0.07, y: height * 0.56, z }, leafMaterial);
            leaf.rotation.z = i % 2 ? -0.3 : 0.3;

            if (stage >= 3) {
                const grain = MeshBuilder.CreateSphere(
                    "crop-head",
                    { diameter: stage === 4 ? 0.16 : 0.09, segments: 5 },
                    this.scene
                );
                grain.parent = root;
                grain.position.set(x, height + 0.04, z);
                grain.scaling.y = 1.5;
                grain.material = stage === 4 ? this.materials.grain : this.materials.leaf;
                grain.isPickable = false;
            }
        }

        this.cropRoots[index] = root;
    }

    render(game, now = Date.now()) {
        for (let index = 0; index < FARM_TILE_COUNT; index += 1) {
            const status = game.getTileStatus(index, now);
            const stage = status.state === "empty" ? 0
                : status.state === "ready" ? 4
                : status.progress < 0.28 ? 1
                : status.progress < 0.62 ? 2
                : 3;

            if (this.stages[index] !== stage) {
                this.cropRoots[index]?.dispose(false, false);
                this.cropRoots[index] = null;
                this.stages[index] = stage;
                this.buildCrop(index, stage);
                this.updateTileMaterial(index);
            }
        }

        const showHarvester = game.hasUnlock("harvester");
        if (showHarvester !== this.harvesterShown) {
            this.harvesterShown = showHarvester;
            this.harvester.setEnabled(showHarvester);
        }
    }

    resetCamera() {
        this.camera.alpha = -Math.PI / 3.6;
        this.camera.beta = Math.PI / 3.1;
        this.camera.radius = 16.5;
        this.camera.setTarget(new Vector3(0.35, 0, 0));
    }

    resize() {
        this.engine.resize();
    }

    dispose() {
        this.canvas.removeEventListener("keydown", this.onKeyDown);
        this.resizeObserver?.disconnect();
        window.removeEventListener("resize", this.onResize);
        this.scene.onPointerObservable.remove(this.pointerObserver);
        this.engine.stopRenderLoop();
        this.scene.dispose();
        this.engine.dispose();
    }
}
