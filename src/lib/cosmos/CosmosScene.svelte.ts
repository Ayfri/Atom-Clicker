import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass, texture, vec3 } from 'three/tsl';
import {
	Line,
	type Material,
	MathUtils,
	Mesh,
	NeutralToneMapping,
	type Node,
	NodeUpdateType,
	PerspectiveCamera,
	RenderPipeline,
	Scene,
	Sprite,
	type Texture,
	type TextureNode,
	Vector3,
	WebGPURenderer,
} from 'three/webgpu';
import { COSMOS_OBJECTS, CosmosEras } from '#data/cosmos.js';
import { Body, BODY_LOOKS, simClock } from './bodies.js';
import type { BenchOptions } from './CosmosBench.js';
import { Earth } from './earth.js';
import { bakeSurfaces, liveSurface, loadSurface, loadSurfaces, SHARP } from './maps.js';
import { DAY_MS, J2000, OrbitLine, orbitFade } from './orbits.js';
import { detail, exposure, glare, realism } from './shading.js';
import { Nebula, Sky } from './sky.js';
import { DEEP_SKY_DISTANCE, EARTH_ORBIT, EARTH_RADIUS, EARTH_YEAR, GALAXY_CORE, ORIGIN, SKY_DISTANCE, SUN_RADIUS, UP } from './space.js';
import { PlanetMarkers, signalSprite } from './sprites.js';
import { Sun } from './sun.js';

type CosmosMode = 'discovery' | 'intro' | 'observe' | 'overview';
type CosmosQuality = 'high' | 'low';
/** Anything the signal can sit on. */
type Target = Body | Nebula;

interface CosmosHud {
	/** Chevron at the screen edge pointing at the signal while it is outside the reticle. */
	arrow: HTMLElement;
	/** Ring centered on the signal, filled through its `--progress` variable. Written directly because it changes every frame. */
	progress: HTMLElement;
}

interface CosmosOptions {
	/** Ids of the objects already in the sky, the others stay hidden until discovered. */
	discovered: readonly string[];
	/** Object to start on, skipping the intro, so a reload lands back where the player was. */
	focus?: string;
	hud: CosmosHud;
	/** Starting limiting magnitude, see `setLimit`. */
	limit: number;
	/** Surfaces drawn from their shaders instead of their baked maps, to see edits without baking. */
	live?: readonly string[];
	/** Called once the signal is fully resolved, as the object starts condensing. */
	onDiscover: (id: string) => void;
	/** Starts with the orbit lines drawn, see `setOrbits`. */
	orbits: boolean;
	/** Starts in the realistic lighting, see `setRealistic`. */
	realistic: boolean;
	/** Records the GPU time of every render pass, which the benchmark reads. */
	timestamps?: boolean;
}

interface Flight {
	duration: number;
	elapsed: number;
	fromFov: number;
	fromLook: Vector3;
	fromPosition: Vector3;
	onEnd: () => void;
	toFov: number;
	/** Targets are read every frame, the planets keep orbiting during the flight. */
	toLook: () => Vector3;
	toPosition: () => Vector3;
}

/** Rendering switches the benchmark compares, `DEFAULT_TUNING` is what players get. */
export interface CosmosTuning {
	/** Size of the bloom buffers against the canvas, 0 turns bloom off. */
	bloom: number;
	/** Bloom is redrawn every that many frames and reused in between, its passes cost far more CPU time than the scene's objects. */
	bloomEvery: number;
	/** The overview renders at 30 fps while the player isn't touching it. */
	idleCap: boolean;
	pixelRatio: number;
}

export type BenchScenario = 'home' | 'jupiter' | 'saturn' | 'sky' | 'sun' | 'system';

const DEFAULT_TUNING: CosmosTuning = { bloom: 0.5, bloomEvery: 2, idleCap: true, pixelRatio: 1.5 };
const BLOOM_STRENGTH = 0.65;
/** At the eyepiece the bloom only leaves a soft halo, at full strength the Sun would dazzle the player hunting a faint signal. */
const OBSERVE_BLOOM_STRENGTH = 0.25;
/** The realistic lighting also runs the clock twenty times slower: a day takes 13 minutes, a year 4 hours. */
const REALISTIC_PACE = 0.05;
/** Objects past the naked eye era are too faint to resolve with a wider field of view, the player has to zoom in on them. */
const REFRACTOR_FOV = 25;
/** Smallest angle between a target and the Sun, closer ones are waited out so the player never observes into the glare. */
const MIN_ELONGATION = MathUtils.degToRad(35);
/** Observation zoom range, wider than the default view stretched the sky like a fisheye. */
const FOV_RANGE = [12, 55] as const;
/** Looking at a nebula zooms further, the Crab is a third of a degree wide. */
const GAZE_FOV_RANGE = [2, 55] as const;
/** Screen radius under which an object still counts as clicked, so far planets stay easy to pick. */
const PICK_RADIUS = 18;
/** Without a clock drive the sky slides out of the eyepiece as the Earth turns, real telescopes had the same problem. */
const SKY_DRIFT = 0.016;
const RETICLE_RADIUS = 56;
const SIGNAL_SIZE = 44;
/** Rate of the exponential ease toward a wheel zoom goal, ~90% of the way in 0.25 s. */
const ZOOM_EASE = 9;
/** OrbitControls' damping keeps the view moving for about this long after the last input. */
const INPUT_SETTLE = 1500;
/** Seconds the orbit lines take to fade in or out. */
const ORBIT_FADE = 0.2;
const IDLE_FRAME = 1000 / 30;

const easeInOut = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const direction = (yaw: number, pitch: number) => new Vector3().setFromSphericalCoords(1, Math.PI / 2 - pitch, yaw);

/**
 * The sky of the Cosmos realm around the Earth: an observation mode where the player keeps a signal inside the telescope reticle,
 * then the discovered object condenses out of it and stays in the system.
 * @example const scene = await CosmosScene.create(canvas, { discovered: ['moon'], hud: { arrow, progress }, onDiscover });
 */
export class CosmosScene {
	backend = $state('');
	/** The signal is in the reticle but needs a narrower field of view to resolve. */
	faint = $state(false);
	/** Object the camera orbits and follows. */
	focused = $state('earth');
	fps = $state(0);
	/** Object under the mouse in the overview, for its tooltip. */
	hovered = $state<string | null>(null);
	mode = $state<CosmosMode>('intro');
	orbits = $state(true);
	quality = $state<CosmosQuality>('high');
	/** Real sunlight instead of the cartoon lighting, see `setRealistic`. */
	realistic = $state(false);
	/** Id of the object of the last discovery, shown by the discovery card. */
	revealed = $state<string | null>(null);
	/** Object whose info panel is open, the view clears it to close the panel. */
	selected = $state<string | null>(null);

	/** Baked map reads by surface id, `#sharpen` swaps their texture. */
	readonly #albedoMaps = new Map<string, TextureNode>();
	readonly #bloom: ReturnType<typeof bloom>;
	readonly #bodies = new Map<string, Body>();
	readonly #camera = new PerspectiveCamera(50, 1, 0.05, 8000);
	readonly #canvas: HTMLCanvasElement;
	readonly #controls: OrbitControls;
	readonly #earth: Earth;
	readonly #hud: CosmosHud;
	readonly #markers: PlanetMarkers;
	readonly #onDiscover: (id: string) => void;
	readonly #pipeline: RenderPipeline;
	readonly #pointers = new Map<number, { x: number; y: number }>();
	readonly #renderer: WebGPURenderer;
	readonly #resize: ResizeObserver;
	readonly #scene = new Scene();
	readonly #signal = signalSprite();
	readonly #sky: Sky;
	readonly #sun: Sun;
	readonly #withBloom: Node;
	readonly #withoutBloom: Node;

	/** Wheel zoom eases toward these goals every frame instead of jumping a whole step per notch. */
	#distanceGoal: number | null = null;
	#flight: Flight | null = null;
	#fovGoal = 55;
	#fpsFrames = 0;
	#fpsTime = 0;
	/** Nebula looked at from beside the Earth, the camera can't orbit something that far. */
	#gaze: Nebula | null = null;
	/** The benchmark or a freeze owns the loop, a tab coming back to the foreground must not restart it. */
	#held = false;
	#lastFocus = new Vector3();
	#lastInput = 0;
	#lastRender = 0;
	#lastTime = 0;
	#paused = false;
	#pitch = 0;
	/** Where a pointer went down outside observation, a release close to it is a click. */
	#press: { x: number; y: number } | null = null;
	#progress = 0;
	#qualityProbe = { frames: 0, time: 0 };
	#realismGoal = 0;
	#renders = 0;
	/** The discovered object condensing, plus the companions growing in with it. */
	#revealing: Target[] = [];
	/** The body drawn with its sharp map, `map` stays null while it loads. */
	#sharp: { base: Texture; id: string; map: Texture | null } | null = null;
	#simTime = 0;
	#target: Target | null = null;
	#tuning: CosmosTuning = { ...DEFAULT_TUNING, pixelRatio: Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio) };
	/** Sky clock fast-forward played during a flight, it carries a target out of the Sun's glare. */
	#warp: { from: number; to: number } | null = null;
	#yaw = 0;

	private constructor(
		canvas: HTMLCanvasElement,
		renderer: WebGPURenderer,
		{ discovered, focus, hud, limit, onDiscover, orbits, realistic }: CosmosOptions,
		maps: Map<string, Texture>,
	) {
		this.#canvas = canvas;
		this.#hud = hud;
		this.#onDiscover = onDiscover;
		this.#renderer = renderer;
		this.backend = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL 2';
		const sinceJ2000 = (Date.now() - J2000) / DAY_MS;
		const albedo = (id: string) => {
			const map = maps.get(id);
			if (!map) return liveSurface(id);
			const node = texture(map);
			this.#albedoMaps.set(id, node);
			return node.rgb;
		};
		this.#earth = new Earth(albedo('earth'), albedo('earth_masks'), maps.get('clouds'), sinceJ2000);
		this.#sky = new Sky(albedo, limit, discovered);
		this.#sun = new Sun(maps.get('sun') ?? null);
		this.#scene.add(this.#sun.group, this.#earth.orbit, this.#earth.group);
		/** In discovery order, so every parent is placed before the moons orbiting it. */
		for (const object of COSMOS_OBJECTS) {
			const look = BODY_LOOKS[object.id];
			if (!look) continue;
			const known = discovered.includes(object.id);
			const shown = known || (look.shownWith !== undefined && discovered.includes(look.shownWith));
			const body = new Body(object, look, known, shown, look.surface ? albedo(object.id) : vec3(0), sinceJ2000);
			this.#bodies.set(object.id, body);
			this.#scene.add(body.group);
			if (body.orbit) this.#scene.add(body.orbit);
		}
		this.orbits = orbits;
		orbitFade.value = orbits ? 1 : 0;
		this.#showOrbitLines(orbits);
		this.realistic = realistic;
		realism.value = this.#realismGoal = realistic ? 1 : 0;
		this.#markers = new PlanetMarkers([...this.#bodies.values()].filter(body => body.around === 'sun' && body.orbit instanceof OrbitLine));
		this.#scene.add(this.#sky.group, this.#markers.sprite, this.#signal);

		const sceneColor = pass(this.#scene, this.#camera).getTextureNode('output');
		this.#bloom = bloom(sceneColor, BLOOM_STRENGTH, 0.3, 1);
		this.#withoutBloom = sceneColor;
		this.#withBloom = sceneColor.add(this.#bloom);
		this.#pipeline = new RenderPipeline(renderer, this.#withBloom);

		this.#controls = new OrbitControls(this.#camera, canvas);
		this.#controls.enableDamping = true;
		this.#controls.enablePan = false;
		this.#controls.minDistance = 3;
		this.#controls.enabled = false;
		this.#fitZoomRange();

		this.#placeBodies();
		this.#resize = new ResizeObserver(() => this.#fit());
		this.#resize.observe(canvas);
		this.#fit();

		canvas.addEventListener('pointerdown', this.#onPointerDown);
		canvas.addEventListener('wheel', this.#onWheel, { capture: true, passive: false });
		window.addEventListener('pointermove', this.#onPointerMove);
		window.addEventListener('pointerup', this.#onPointerUp);
		window.addEventListener('pointercancel', this.#onPointerUp);
		document.addEventListener('visibilitychange', this.#onVisibility);

		const nebula = focus ? this.#sky.nebulae.get(focus) : undefined;
		if (nebula?.discovered) {
			this.#lookAt(nebula);
			this.#camera.fov = nebula.fov;
			this.mode = 'overview';
		} else if (focus && this.#pickable().includes(focus)) {
			this.#camera.position.copy(this.#viewpoint(focus));
			this.#camera.lookAt(this.#positionOf(focus)!);
			this.#orbit(focus);
			this.mode = 'overview';
		} else this.#playIntro();
		this.#adaptExposure(1);
		this.#adaptToGlare(1);
	}

	/** Startup phases land in the performance timeline as `cosmos:*` measures, the startup benchmark reads them. */
	static async create(canvas: HTMLCanvasElement, options: CosmosOptions) {
		const start = performance.now();
		/**
		 * Reversed float depth keeps its precision out to the far plane, ~50 000 units with Pluto's orbit. The default one resolved
		 * hundreds of units that far out, and the Sun's glow sprites flickered through its disc.
		 */
		const renderer = new WebGPURenderer({ antialias: true, canvas, reversedDepthBuffer: true, trackTimestamp: options.timestamps });
		/** Neutral keeps the flat cartoon colors as picked, ACES shifted them toward brown and desaturated the highlights. */
		renderer.toneMapping = NeutralToneMapping;
		/** Opaque black space, cleared transparent the page's blue-black showed through wherever the Milky Way dome is off. */
		renderer.setClearColor(0x000000, 1);
		renderer.setPixelRatio(Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio));
		const [maps] = await Promise.all([
			loadSurfaces(options.live ?? []).finally(() => performance.measure('cosmos:textures', { start })),
			renderer.init().finally(() => performance.measure('cosmos:device', { start })),
		]);
		const building = performance.now();
		const scene = new CosmosScene(canvas, renderer, options, maps);
		const compiling = performance.now();
		scene.#compileHidden();
		performance.measure('cosmos:build', { end: compiling, start: building });
		performance.measure('cosmos:compile', { start: compiling });
		performance.measure('cosmos:ready', { start });
		scene.#start();
		return scene;
	}

	/** Dev only: renders every surface map for `static/cosmos/`. */
	bakeSurfaces() {
		return bakeSurfaces(this.#renderer);
	}

	/** Dev only: times every tuning variant on fixed views with the GPU's timestamps, see `CosmosBench.ts`. Needs `timestamps`. */
	async bench(options?: Partial<BenchOptions>) {
		if (this.mode !== 'overview') throw new Error('The benchmark starts from the overview.');
		const { runBench } = await import('./CosmosBench.js');
		const restore = this.#snapshot();
		this.setQuality('high');
		this.#renderer.setAnimationLoop(null);
		this.#held = true;
		try {
			return await runBench(
				{
					defaults: DEFAULT_TUNING,
					loop: on => (on ? this.#start() : this.#renderer.setAnimationLoop(null)),
					render: () => this.#render(),
					renderer: this.#renderer,
					restore,
					stage: scenario => this.#stage(scenario),
					tune: tuning => this.tune(tuning),
				},
				options,
			);
		} finally {
			this.#held = false;
			restore();
			this.#start();
		}
	}

	/** Closes the discovery card, the camera keeps orbiting the new object and its info panel opens. */
	continue() {
		if (this.mode !== 'discovery') return;
		this.mode = 'overview';
		this.selected = this.revealed;
	}

	dispose() {
		this.#renderer.setAnimationLoop(null);
		this.#resize.disconnect();
		this.#controls.dispose();
		this.#canvas.removeEventListener('pointerdown', this.#onPointerDown);
		this.#canvas.removeEventListener('wheel', this.#onWheel, { capture: true });
		window.removeEventListener('pointermove', this.#onPointerMove);
		window.removeEventListener('pointerup', this.#onPointerUp);
		window.removeEventListener('pointercancel', this.#onPointerUp);
		document.removeEventListener('visibilitychange', this.#onVisibility);
		this.#scene.traverse(object => {
			if (!(object instanceof Mesh || object instanceof Sprite || object instanceof Line)) return;
			object.geometry.dispose();
			(object.material as Material).dispose();
		});
		this.#sharp?.map?.dispose();
		this.#pipeline.dispose();
		this.#renderer.dispose();
	}

	/** Flies to an object and orbits it from then on, or looks at a nebula from beside the Earth, `earth` goes back to the home view. */
	focus(id: string) {
		if (this.mode !== 'overview') return;
		const nebula = this.#sky.nebulae.get(id);
		if (nebula) {
			if (!nebula.discovered) return;
			this.selected = id;
			this.#gazeAt(nebula);
			return;
		}
		if (!this.#positionOf(id)) return;
		this.#gaze = null;
		this.selected = id;
		this.#flyTo(() => this.#viewpoint(id), () => this.#positionOf(id)!, 50, 2.2, () => this.#orbit(id));
	}

	/** Dev only: stops on a benchmark view, so screenshots of two variants show the exact same frame. A reload resumes. */
	freeze(scenario: BenchScenario) {
		this.#held = true;
		this.#renderer.setAnimationLoop(null);
		this.#stage(scenario);
		this.#render();
	}

	/**
	 * Moves the camera next to the Earth and hands the view to the player, the signal sits on the object to discover. `pay` runs once the
	 * scene accepts and can still refuse. The flight runs in intro mode, so the overview HUD can't start or redirect it.
	 */
	observe(id: string, pay: () => boolean): boolean {
		const target = this.#bodies.get(id) ?? this.#sky.nebulae.get(id);
		if (!target || target.discovered || this.mode !== 'overview' || !pay()) return false;
		this.mode = 'intro';
		this.selected = null;
		this.#gaze = null;
		this.#target = target;
		this.#warp = { from: this.#simTime, to: this.#clearOfSun(target) };
		/** The starting view is aimed where the target will be once the warp ends, the flight lands looking past it. */
		const aim = () => {
			const toTarget = this.#toward(target, this.#observerPosition());
			return { pitch: Math.asin(toTarget.y) + 0.35, yaw: Math.atan2(toTarget.x, toTarget.z) + 1.1 };
		};
		const look = () => {
			const { pitch, yaw } = aim();
			return this.#observerPosition().add(direction(yaw, pitch));
		};
		this.#flyTo(() => this.#observerPosition(), look, 50, 2.4, () => {
			({ pitch: this.#pitch, yaw: this.#yaw } = aim());
			this.#progress = 0;
			this.#fovGoal = 50;
			this.#signal.visible = true;
			this.mode = 'observe';
			this.#applyGlare();
		});
		return true;
	}

	/** Canvas pixel position of every object in the sky that is in front of the camera and inside the view. */
	onScreen(): { id: string; x: number; y: number }[] {
		if (this.mode === 'observe' || this.mode === 'intro') return [];
		const { clientHeight, clientWidth } = this.#canvas;
		return this.#pickable().flatMap(id => {
			const projected = this.#positionOf(id)!.clone().project(this.#camera);
			if (projected.z > 1 || Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95) return [];
			return [{ id, x: ((projected.x + 1) / 2) * clientWidth, y: ((1 - projected.y) / 2) * clientHeight }];
		});
	}

	setBuilding(building: boolean) {
		this.#earth.beacon.visible = building;
	}

	/** Eases the sky toward a limiting magnitude: the bright field and the Milky Way, then the deep-sky objects and the faint stars past them. */
	setLimit(limit: number) {
		this.#sky.limit = limit;
	}

	/** Fades the orbit lines in or out over `ORBIT_FADE`, the asteroid belt and the planet dots stay. */
	setOrbits(orbits: boolean) {
		this.orbits = orbits;
		if (orbits) this.#showOrbitLines(true);
	}

	/** Stops the render loop while something covers the view, like a modal. */
	setPaused(paused: boolean) {
		if (paused === this.#paused) return;
		this.#paused = paused;
		this.#onVisibility();
	}

	/**
	 * Low drops bloom, the Milky Way dome, the clouds, the atmosphere shell, the thin hazes and the corona, the limb darkening, the earthshine
	 * and the sharp maps, and keeps a quarter of the stars.
	 */
	setQuality(quality: CosmosQuality) {
		const high = quality === 'high';
		this.quality = quality;
		detail.value = high ? 1 : 0;
		this.#earth.setQuality(high);
		this.#sky.setQuality(high);
		this.#scene.traverse(object => {
			if (object.userData.highOnly) object.visible = high;
		});
		this.#sharpen();
		this.tune({ pixelRatio: high ? Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio) : 1 });
	}

	/**
	 * Cross-fades to sunlight as it is: plain diffuse light dimming with the square of the distance from the Sun under an exposure
	 * that adapts to the viewed body, black night sides, no drawn limbs, no corona outside an eclipse and steady stars. The clock slows
	 * down to `REALISTIC_PACE`.
	 */
	setRealistic(realistic: boolean) {
		this.realistic = realistic;
		this.#realismGoal = realistic ? 1 : 0;
	}

	/** Gives up on the signal and flies back to the home view, the progress is lost. */
	stopObserving() {
		if (this.mode !== 'observe') return;
		this.#target = null;
		this.#hideSignal();
		this.mode = 'intro';
		this.#applyGlare();
		this.#flyTo(() => this.#overviewPosition(), () => this.#earth.position, 50, 2.4, () => this.#enterOverview());
	}

	tune(tuning: Partial<CosmosTuning>) {
		this.#tuning = { ...this.#tuning, ...tuning };
		if (this.#tuning.bloom) this.#bloom.setResolutionScale(this.#tuning.bloom);
		this.#renderer.setPixelRatio(this.#tuning.pixelRatio);
		this.#applyGlare();
		this.#fit();
	}

	/**
	 * Eases the exposure toward the viewed body's distance from the Sun, like eyes adapting, `ease` 1 jumps there. The followed body
	 * outside flights, else the camera, never closer than a few solar radii.
	 */
	#adaptExposure(ease: number) {
		const viewed = this.#flight || this.#gaze || this.mode === 'intro' || this.mode === 'observe' ? this.#camera.position : this.#controls.target;
		const goal = Math.log(Math.max(viewed.length(), SUN_RADIUS * 3) ** 2);
		exposure.value = Math.exp(MathUtils.lerp(Math.log(exposure.value), goal, ease));
	}

	/**
	 * Eases `glare` toward how much the view is dazzled, like eyes adapting, `ease` 1 jumps there: the Sun from just outside the frame
	 * unless the followed body hides it, and the followed body once it fills a good part of the frame. Its night side only dims the
	 * sky partly, from the shadow of a planet the stars come back, like astronauts see them.
	 */
	#adaptToGlare(ease: number) {
		const camera = this.#camera;
		const forward = camera.getWorldDirection(new Vector3());
		const toSun = camera.position.clone().negate();
		const halfView = Math.tan(MathUtils.degToRad(camera.fov) / 2);
		const halfDiagonal = Math.atan(halfView * Math.hypot(1, camera.aspect));
		let sun = 1 - MathUtils.smoothstep(forward.angleTo(toSun), halfDiagonal, halfDiagonal + 0.35);
		let body = 0;
		if ((this.mode === 'overview' || this.mode === 'discovery') && !this.#flight && !this.#gaze && this.focused !== 'sun') {
			const position = this.#positionOf(this.focused)!;
			const toBody = position.clone().sub(camera.position);
			const radius = this.#radiusOf(this.focused);
			if (toBody.length() < toSun.length()) {
				const size = Math.asin(Math.min(1, radius / toBody.length()));
				sun *= MathUtils.smoothstep(toBody.angleTo(toSun), size * 0.9, size * 1.1);
			}
			const coverage = radius / (toBody.length() * halfView);
			const litSide = (1 + Math.cos(toBody.negate().angleTo(position.clone().negate()))) / 2;
			body = MathUtils.smoothstep(coverage, 0.03, 0.3) * MathUtils.lerp(0.55, 1, MathUtils.smoothstep(litSide, 0.1, 0.5));
		}
		glare.value = MathUtils.lerp(glare.value, Math.max(sun, body), ease);
	}

	/** Bloom and the corona, off in low quality, the eyepiece drops the corona and dims the bloom. */
	#applyGlare() {
		const high = this.quality === 'high';
		const observing = this.mode === 'observe';
		this.#sun.corona = high && !observing && realism.value < 1;
		this.#bloom.strength.value = observing ? OBSERVE_BLOOM_STRENGTH : BLOOM_STRENGTH;
		const output = high && this.#tuning.bloom > 0 ? this.#withBloom : this.#withoutBloom;
		if (this.#pipeline.outputNode === output) return;
		this.#pipeline.outputNode = output;
		this.#pipeline.needsUpdate = true;
		/**
		 * The rebuild only registers the bloom for frame updates if its next render has it on: built on a skipped frame, it stayed
		 * frozen on its last image, a stale glare from before the switch.
		 */
		this.#renders = -1;
	}

	/**
	 * Earliest sky clock within a year where the target sits far enough from the Sun as seen from the Earth: MIN_ELONGATION, or 90% of
	 * the widest angle an inner planet ever reaches, Mercury never strays past ~23°.
	 */
	#clearOfSun(target: Target) {
		const inner = target instanceof Body && target.around === 'sun' && target.look.distance < EARTH_ORBIT;
		const widest = inner ? Math.asin(target.look.distance / EARTH_ORBIT) * 0.9 : Infinity;
		const needed = Math.min(MIN_ELONGATION, widest);
		const now = this.#simTime;
		let clear = now;
		for (let time = now; time < now + EARTH_YEAR; time += 2) {
			this.#simTime = time;
			this.#placeBodies();
			const earth = this.#earth.position;
			if (this.#toward(target, earth).angleTo(earth.clone().negate()) >= needed) {
				clear = time;
				break;
			}
		}
		this.#simTime = now;
		this.#placeBodies();
		return clear;
	}

	/**
	 * Renders one frame with every hidden body drawn at a near-zero scale, plus the sky depth the limit doesn't reach yet, so a
	 * discovery or a wider aperture never stalls on compiling a shader.
	 */
	#compileHidden() {
		const hidden = [...this.#bodies.values()].filter(body => !body.group.visible);
		const orbits = [...this.#bodies.values()].flatMap(body => (body.orbit && !body.orbit.visible ? [body.orbit] : []));
		const beacon = this.#earth.beacon.visible;
		for (const object of [...hidden.map(body => body.group), ...orbits]) object.visible = true;
		this.#earth.beacon.visible = true;
		this.#sky.showDepth(true);
		this.#pipeline.render();
		for (const body of hidden) body.group.visible = false;
		for (const orbit of orbits) orbit.visible = false;
		this.#earth.beacon.visible = beacon;
		this.#sky.showDepth();
	}

	#enterOverview() {
		this.#gaze = null;
		this.#orbit('earth');
		this.mode = 'overview';
	}

	#fit() {
		const { clientHeight, clientWidth } = this.#canvas;
		if (!clientWidth || !clientHeight) return;
		this.#renderer.setSize(clientWidth, clientHeight, false);
		this.#camera.aspect = clientWidth / clientHeight;
		this.#camera.updateProjectionMatrix();
	}

	/** The farther the discoveries reach from the Sun, the farther the view pulls back, the sky grows with the player's knowledge. */
	#fitZoomRange() {
		const reach = Math.max(
			EARTH_ORBIT,
			...[...this.#bodies.values()].filter(body => body.discovered && body.around === 'sun').map(body => body.look.distance * (1 + (body.look.eccentricity ?? 0))),
		);
		this.#controls.maxDistance = reach * 1.8;
		this.#camera.far = reach * 3.6 + SKY_DISTANCE;
		this.#camera.updateProjectionMatrix();
	}

	#flyTo(to: () => Vector3, look: () => Vector3, fov: number, duration: number, onEnd = () => {}) {
		this.#controls.enabled = false;
		this.#distanceGoal = null;
		this.#flight = {
			duration,
			elapsed: 0,
			fromFov: this.#camera.fov,
			fromLook: this.#camera.getWorldDirection(new Vector3()).multiplyScalar(10).add(this.#camera.position),
			fromPosition: this.#camera.position.clone(),
			onEnd,
			toFov: fov,
			toLook: look,
			toPosition: to,
		};
	}

	#frame = (now: number) => {
		const dt = this.#lastTime ? Math.min((now - this.#lastTime) / 1000, 0.1) : 0;
		this.#lastTime = now;
		this.#simTime += dt * REALISTIC_PACE ** realism.value;
		this.#placeBodies();
		this.#sky.update(dt);

		const fadeGoal = this.orbits ? 1 : 0;
		if (orbitFade.value !== fadeGoal) {
			orbitFade.value = MathUtils.clamp(orbitFade.value + Math.sign(fadeGoal - orbitFade.value) * (dt / ORBIT_FADE), 0, 1);
			if (orbitFade.value === 0) this.#showOrbitLines(false);
		}
		if (realism.value !== this.#realismGoal) {
			realism.value = MathUtils.clamp(realism.value + Math.sign(this.#realismGoal - realism.value) * dt * 2, 0, 1);
			this.#applyGlare();
		}

		if (this.#flight) this.#updateFlight(dt);
		else if (this.#gaze) this.#updateEyepiece(dt);
		else if (this.mode === 'overview' || this.mode === 'discovery') this.#updateOverview(dt);
		else if (this.mode === 'observe') this.#updateObserve(dt);
		this.#adaptExposure(1 - Math.exp(-dt * 3));
		this.#adaptToGlare(1 - Math.exp(-dt * 3));
		if (this.#revealing.length) {
			for (const body of this.#revealing) body.updateReveal(dt);
			this.#revealing = this.#revealing.filter(body => body.revealTime >= 0);
		}

		/** A few ms of slack so a 60 Hz display renders every other frame instead of drifting between one and two. */
		const idle = this.#tuning.idleCap && this.mode === 'overview' && !this.#flight && now - this.#lastInput > INPUT_SETTLE;
		if (!idle || now - this.#lastRender >= IDLE_FRAME - 4) {
			this.#lastRender = now;
			this.#render();
			this.#fpsFrames++;
		}
		this.#measure(dt);
	};

	/** Flies to the view of a nebula from beside the Earth, see `#lookAt`. */
	#gazeAt(nebula: Nebula) {
		/** Set before the flight, so `#observerPosition` already stands on the side of the Earth facing it. */
		this.#gaze = nebula;
		const look = () => this.#observerPosition().addScaledVector(nebula.direction, 10);
		this.#flyTo(() => this.#observerPosition(), look, nebula.fov, 2.4, () => this.#lookAt(nebula));
	}

	#hideSignal() {
		this.#signal.visible = false;
		this.#hud.arrow.style.opacity = '0';
		this.#hud.progress.style.opacity = '0';
		this.faint = false;
	}

	/** Holds the camera beside the Earth on a nebula, dragging looks around and zooming narrows the field like at the eyepiece. */
	#lookAt(nebula: Nebula) {
		this.#gaze = nebula;
		this.focused = nebula.object.id;
		this.#yaw = Math.atan2(nebula.direction.x, nebula.direction.z);
		this.#pitch = Math.asin(nebula.direction.y);
		this.#fovGoal = nebula.fov;
		this.#sharpen();
	}

	/** Counts rendered frames for the FPS readout, and drops to low quality once if the first seconds after the intro run slow. */
	#measure(dt: number) {
		this.#fpsTime += dt;
		if (this.#fpsTime >= 1) {
			this.fps = Math.round(this.#fpsFrames / this.#fpsTime);
			this.#fpsFrames = 0;
			this.#fpsTime = 0;
		}
		const probe = this.#qualityProbe;
		if (this.mode === 'intro' || probe.frames < 0) return;
		probe.frames++;
		probe.time += dt;
		if (probe.frames < 90) return;
		if (probe.time / probe.frames > 1 / 40 && this.quality === 'high') this.setQuality('low');
		probe.frames = -1;
	}

	/** Visible object under the pointer, the smallest one wins where they overlap so a planet stays clickable over its rings. */
	#objectAt(clientX: number, clientY: number): string | null {
		const rect = this.#canvas.getBoundingClientRect();
		const x = clientX - rect.left - rect.width / 2;
		const y = clientY - rect.top - rect.height / 2;
		const halfView = Math.tan(MathUtils.degToRad(this.#camera.fov) / 2);
		let best: { id: string; size: number } | null = null;
		for (const id of this.#pickable()) {
			const position = this.#positionOf(id)!;
			const projected = position.clone().project(this.#camera);
			if (projected.z > 1) continue;
			const size = Math.max(PICK_RADIUS, (this.#radiusOf(id) / (position.distanceTo(this.#camera.position) * halfView)) * (rect.height / 2));
			const hit = Math.hypot(x - (projected.x * rect.width) / 2, y + (projected.y * rect.height) / 2) <= size;
			if (hit && (!best || size < best.size)) best = { id, size };
		}
		return best?.id ?? null;
	}

	/**
	 * Just above the side of the Earth facing the target, the day side for Mercury and Venus, so the Earth stays behind the
	 * observer instead of hiding the target when the search swings around.
	 */
	#observerPosition() {
		const earth = this.#earth.position;
		const aimed = this.#target ?? this.#gaze;
		const toward = aimed ? this.#toward(aimed, earth) : new Vector3().crossVectors(UP, earth).normalize();
		return toward.multiplyScalar(EARTH_RADIUS * 1.7).addScaledVector(UP, 0.4).add(earth);
	}

	#onPointerDown = (event: PointerEvent) => {
		/** A touch pinch goes through OrbitControls, a pending wheel goal would fight it. */
		this.#distanceGoal = null;
		this.#lastInput = event.timeStamp;
		if (this.mode !== 'observe') this.#press = { x: event.clientX, y: event.clientY };
		if (this.mode === 'observe' || this.#gaze) this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerMove = (event: PointerEvent) => {
		if (event.buttons) this.#lastInput = event.timeStamp;
		if (event.pointerType === 'mouse' && !event.buttons) {
			const hovered = this.mode === 'overview' && !this.#flight && event.target === this.#canvas ? this.#objectAt(event.clientX, event.clientY) : null;
			if (hovered !== this.hovered) this.hovered = hovered;
		}
		const previous = this.#pointers.get(event.pointerId);
		if (!previous || (this.mode !== 'observe' && !this.#gaze)) return;
		if (this.#pointers.size === 1) {
			/** One screen pixel of drag moves the sky by one pixel, whatever the zoom. */
			const perPixel = MathUtils.degToRad(this.#camera.fov / this.#canvas.clientHeight);
			this.#yaw += (event.clientX - previous.x) * perPixel;
			this.#pitch = MathUtils.clamp(this.#pitch + (event.clientY - previous.y) * perPixel, -1.45, 1.45);
		} else {
			const other = [...this.#pointers].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const before = Math.hypot(previous.x - other.x, previous.y - other.y);
				const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
				if (before > 0) this.#zoom(before / after);
			}
		}
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerUp = (event: PointerEvent) => {
		this.#pointers.delete(event.pointerId);
		const press = this.#press;
		this.#press = null;
		if (press && !this.#flight && this.mode === 'overview' && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) {
			const id = this.#objectAt(event.clientX, event.clientY);
			if (id) this.focus(id);
		}
	};

	#onVisibility = () => {
		if (this.#held) return;
		if (document.hidden || this.#paused) this.#renderer.setAnimationLoop(null);
		else this.#start();
	};

	/** Registered on the capture phase so it stops OrbitControls' own wheel handler, which jumps a whole step per notch. */
	#onWheel = (event: WheelEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		this.#lastInput = event.timeStamp;
		const factor = Math.exp(event.deltaY * 0.0008);
		if (this.mode === 'observe' || this.#gaze) this.#zoom(factor);
		if (this.mode !== 'overview' || this.#gaze) return;
		const current = this.#distanceGoal ?? this.#camera.position.distanceTo(this.#controls.target);
		this.#distanceGoal = MathUtils.clamp(current * factor, this.#controls.minDistance, this.#controls.maxDistance);
	};

	/** Hands the camera to the orbit controls around an object, which then carry the camera along its orbit. */
	#orbit(id: string) {
		const position = this.#positionOf(id)!;
		this.focused = id;
		this.#lastFocus.copy(position);
		this.#controls.target.copy(position);
		this.#controls.minDistance = this.#radiusOf(id) * 1.6;
		this.#controls.enabled = true;
		this.#controls.update();
		this.#sharpen();
	}

	#overviewPosition() {
		const earth = this.#earth.position;
		const away = earth.clone().normalize();
		const along = new Vector3().crossVectors(UP, away).normalize();
		/** Looks back toward the Sun, which sits ~25° off center behind a lit crescent Earth. */
		return along.multiplyScalar(7).addScaledVector(away, 14).addScaledVector(UP, 3.5).add(earth);
	}

	/** Discovered objects done condensing, undiscovered rings drawn with Saturn stay out of reach. */
	#pickable() {
		const targets = [...this.#bodies.values(), ...this.#sky.nebulae.values()];
		return ['sun', 'earth', ...targets.filter(target => target.discovered && target.revealTime < 0).map(target => target.object.id)];
	}

	#playIntro() {
		this.#gaze = null;
		const away = this.#overviewPosition().sub(this.#earth.position).normalize();
		this.#camera.position.copy(this.#earth.position).addScaledVector(away, EARTH_RADIUS * 1.35);
		this.#camera.fov = 30;
		this.#camera.lookAt(this.#earth.position);
		this.mode = 'intro';
		this.#flyTo(() => this.#overviewPosition(), () => this.#earth.position, 50, 4.5, () => this.#enterOverview());
	}

	#placeBodies() {
		this.#earth.place(this.#simTime);
		for (const body of this.#bodies.values()) {
			const { around } = body;
			const parent = around === 'sun' ? ORIGIN : around === 'earth' ? this.#earth.position : this.#bodies.get(around)!.group.position;
			body.place(parent, this.#simTime);
		}
		simClock.value = this.#simTime;
	}

	/** A nebula is where the sky draws it, centered on the camera. */
	#positionOf(id: string): Vector3 | null {
		if (id === 'sun') return ORIGIN;
		if (id === 'earth') return this.#earth.position;
		const nebula = this.#sky.nebulae.get(id);
		if (nebula) return this.#camera.position.clone().addScaledVector(nebula.direction, DEEP_SKY_DISTANCE);
		return this.#bodies.get(id)?.group.position ?? null;
	}

	#radiusOf(id: string) {
		if (id === 'sun') return SUN_RADIUS;
		return (this.#bodies.get(id)?.look ?? this.#sky.nebulae.get(id))?.radius ?? EARTH_RADIUS;
	}

	#render() {
		/** After the camera moved, a frame behind they slid against the planets on every zoom step. */
		this.#sky.follow(this.#camera, this.#canvas.clientHeight);
		this.#markers.update(this.#camera, this.#canvas.clientHeight, this.mode === 'observe');
		this.#camera.updateMatrixWorld();
		const resized = this.#sun.fit(this.#camera, this.#canvas.clientHeight, this.#tuning.bloom > 0 && this.#pipeline.outputNode === this.#withBloom);
		this.#bloom.updateBeforeType = ++this.#renders % this.#tuning.bloomEvery && !resized ? NodeUpdateType.NONE : NodeUpdateType.FRAME;
		this.#pipeline.render();
	}

	/** In high quality the followed body gets its sharp map, the one followed before goes back to its base map. */
	#sharpen() {
		const id = this.quality === 'high' && BODY_LOOKS[this.focused]?.surface ? this.focused : null;
		const sharp = this.#sharp;
		if (sharp?.id === id) return;
		if (sharp) {
			this.#albedoMaps.get(sharp.id)!.value = sharp.base;
			sharp.map?.dispose();
		}
		this.#sharp = null;
		const node = id && this.#albedoMaps.get(id);
		if (!node) return;
		const next = { base: node.value, id, map: null as Texture | null };
		this.#sharp = next;
		/** A missing file (not baked yet) keeps the base map. */
		loadSurface(id + SHARP).then(
			map => {
				if (this.#sharp !== next) return map.dispose();
				next.map = node.value = map;
			},
			() => {},
		);
	}

	/** Lines faded out are hidden too, so they cost no draw call. */
	#showOrbitLines(lines: boolean) {
		this.#earth.orbit.visible = lines;
		for (const body of this.#bodies.values()) body.showOrbit(lines);
	}

	/** Puts back everything `#stage` and the benchmark's tuning change. */
	#snapshot() {
		const bodies = [...this.#bodies.values()].map(body => ({ body, orbit: body.orbit?.visible ?? false, reveal: body.reveal.value, scale: body.mesh.scale.x, visible: body.group.visible }));
		const nebulae = [...this.#sky.nebulae.values()].map(nebula => [nebula, nebula.reveal.value] as const);
		const { far, fov } = this.#camera;
		const position = this.#camera.position.clone();
		const quaternion = this.#camera.quaternion.clone();
		const [quality, simTime, tuning] = [this.quality, this.#simTime, this.#tuning];
		return () => {
			for (const { body, orbit, reveal, scale, visible } of bodies) {
				body.group.visible = visible;
				body.mesh.scale.setScalar(scale);
				body.reveal.value = reveal;
				if (body.orbit) body.orbit.visible = orbit;
			}
			for (const [nebula, reveal] of nebulae) nebula.reveal.value = reveal;
			Object.assign(this.#camera, { far, fov });
			this.#camera.position.copy(position);
			this.#camera.quaternion.copy(quaternion);
			this.#camera.updateProjectionMatrix();
			this.#simTime = simTime;
			this.#placeBodies();
			this.setQuality(quality);
			this.tune(tuning);
		};
	}

	/** Every body in the sky, the clock frozen and the camera on a fixed view, so each variant renders the exact same frame. */
	#stage(scenario: BenchScenario) {
		for (const body of this.#bodies.values()) {
			body.group.visible = true;
			body.mesh.scale.setScalar(1);
			body.reveal.value = 1;
			if (body.orbit) body.orbit.visible = true;
		}
		for (const nebula of this.#sky.nebulae.values()) nebula.reveal.value = 1;
		this.#simTime = 100;
		this.#placeBodies();
		const views: Record<BenchScenario, () => [Vector3, Vector3]> = {
			home: () => [this.#overviewPosition(), this.#earth.position],
			jupiter: () => [this.#viewpoint('jupiter'), this.#positionOf('jupiter')!],
			saturn: () => [this.#viewpoint('saturn'), this.#positionOf('saturn')!],
			sky: () => [this.#observerPosition(), this.#observerPosition().add(GALAXY_CORE)],
			sun: () => [this.#viewpoint('sun'), ORIGIN],
			system: () => [new Vector3(0, 1600, 2600), ORIGIN],
		};
		const [position, look] = views[scenario]();
		this.#camera.fov = 50;
		this.#camera.far = 4 * EARTH_ORBIT * 9.6 + SKY_DISTANCE;
		this.#camera.position.copy(position);
		this.#camera.lookAt(look);
		this.#camera.updateProjectionMatrix();
	}

	#start() {
		this.#lastTime = 0;
		void this.#renderer.setAnimationLoop(this.#frame);
	}

	#startDiscovery(target: Target) {
		this.#hideSignal();
		this.#target = null;
		const { id } = target.object;
		if (target instanceof Nebula) {
			target.startReveal();
			this.#revealing = [target];
			this.revealed = id;
			this.mode = 'discovery';
			this.#applyGlare();
			this.#onDiscover(id);
			this.#gazeAt(target);
			return;
		}
		const body = target;
		const companions = [...this.#bodies.values()].filter(other => other.look.shownWith === id && !other.group.visible);
		body.startReveal();
		body.showOrbit(orbitFade.value > 0);
		for (const companion of companions) companion.startReveal(false);
		this.#revealing = [body, ...companions];
		this.#fitZoomRange();
		this.revealed = id;
		this.mode = 'discovery';
		this.#applyGlare();
		this.#onDiscover(id);
		this.#flyTo(() => this.#viewpoint(id), () => body.group.position, 50, 3.2, () => this.#orbit(id));
	}

	#updateFlight(dt: number) {
		const flight = this.#flight!;
		flight.elapsed += dt;
		const t = easeInOut(Math.min(1, flight.elapsed / flight.duration));
		if (this.#warp) {
			this.#simTime = this.#warp.from + (this.#warp.to - this.#warp.from) * t;
			if (t >= 1) this.#warp = null;
		}
		this.#camera.position.lerpVectors(flight.fromPosition, flight.toPosition(), t);
		this.#camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * t;
		this.#camera.updateProjectionMatrix();
		this.#camera.lookAt(new Vector3().lerpVectors(flight.fromLook, flight.toLook(), t));
		if (flight.elapsed < flight.duration) return;
		this.#flight = null;
		flight.onEnd();
	}

	/** Camera just above the Earth, turned by the drag and zoomed by the field of view, at the eyepiece or on a nebula. */
	#updateEyepiece(dt: number) {
		if (Math.abs(this.#fovGoal - this.#camera.fov) > 1e-3) {
			this.#camera.fov += (this.#fovGoal - this.#camera.fov) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.updateProjectionMatrix();
		}
		const position = this.#observerPosition();
		this.#camera.position.copy(position);
		this.#camera.lookAt(position.add(direction(this.#yaw, this.#pitch)));
	}

	#updateObserve(dt: number) {
		const target = this.#target;
		if (!target) return;
		this.#yaw -= SKY_DRIFT * dt;
		this.#updateEyepiece(dt);

		const signal = this.#signal;
		if (target instanceof Nebula) signal.position.copy(this.#camera.position).addScaledVector(target.direction, DEEP_SKY_DISTANCE);
		else signal.position.copy(target.group.position);
		const distance = signal.position.distanceTo(this.#camera.position);
		const viewHeight = 2 * distance * Math.tan(MathUtils.degToRad(this.#camera.fov) / 2);
		signal.scale.setScalar((viewHeight * SIGNAL_SIZE) / this.#canvas.clientHeight);

		const projected = signal.position.clone().project(this.#camera);
		const behind = projected.z > 1;
		const x = (projected.x * this.#canvas.clientWidth) / 2;
		const y = (-projected.y * this.#canvas.clientHeight) / 2;
		const inside = !behind && Math.hypot(x, y) < RETICLE_RADIUS;
		const faint = inside && target.object.era !== CosmosEras.NAKED_EYE && this.#camera.fov > REFRACTOR_FOV;
		if (faint !== this.faint) this.faint = faint;
		/** Zooming in resolves faster but makes the drift carry the signal out of the reticle sooner. */
		const rate = 0.1 * (55 / this.#camera.fov);
		this.#progress = inside && !faint ? Math.min(1, this.#progress + dt * rate) : Math.max(0, this.#progress - dt * 0.06);
		const onScreen = !behind && Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92;
		const ring = this.#hud.progress.style;
		ring.opacity = onScreen ? '1' : '0';
		ring.transform = `translate(${x}px, ${y}px)`;
		ring.setProperty('--progress', String(this.#progress));
		this.#hud.arrow.style.opacity = inside || onScreen ? '0' : '1';
		if (!onScreen) {
			const angle = Math.atan2(behind ? -y : y, behind ? -x : x);
			const radius = Math.min(this.#canvas.clientWidth, this.#canvas.clientHeight) / 2 - 36;
			this.#hud.arrow.style.transform = `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) rotate(${angle}rad)`;
		}
		if (this.#progress >= 1) this.#startDiscovery(target);
	}

	#updateOverview(dt: number) {
		const focus = this.#positionOf(this.focused)!;
		const delta = focus.clone().sub(this.#lastFocus);
		this.#camera.position.add(delta);
		this.#controls.target.add(delta);
		this.#lastFocus.copy(focus);
		if (this.#distanceGoal !== null) {
			const offset = this.#camera.position.clone().sub(this.#controls.target);
			const distance = offset.length();
			const next = distance + (this.#distanceGoal - distance) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.position.copy(this.#controls.target).add(offset.setLength(next));
			if (Math.abs(this.#distanceGoal - next) < 1e-3) this.#distanceGoal = null;
		}
		this.#controls.update();
	}

	/** Lit-side close-up, the Earth keeps its home view and the Sun is framed from the Earth's side. */
	#viewpoint(id: string) {
		if (id === 'earth') return this.#overviewPosition();
		const position = this.#positionOf(id)!;
		const size = this.#radiusOf(id);
		const fromSun = id === 'sun' ? this.#earth.position.clone().normalize().negate() : position.clone().normalize();
		const along = new Vector3().crossVectors(UP, fromSun).normalize();
		return position.clone().addScaledVector(fromSun, -5.6 * size).addScaledVector(along, 2.8 * size).addScaledVector(UP, 1.4 * size);
	}

	/** Way from `from` to a target, a nebula lies the same way from anywhere. */
	#toward(target: Target, from: Vector3) {
		return target instanceof Nebula ? target.direction.clone() : target.group.position.clone().sub(from).normalize();
	}

	#zoom(factor: number) {
		const [min, max] = this.#gaze ? GAZE_FOV_RANGE : FOV_RANGE;
		this.#fovGoal = MathUtils.clamp(this.#fovGoal * factor, min, max);
	}
}
