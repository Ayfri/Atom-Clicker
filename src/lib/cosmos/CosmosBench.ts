import type { WebGPURenderer } from 'three/webgpu';
import type { BenchScenario, CosmosTuning } from './CosmosScene.svelte.js';

interface BenchTarget {
	/** What players get, every variant applies over it. */
	defaults: CosmosTuning;
	/** Runs or stops the scene's own animation loop, with its clock and idle cap. */
	loop: (on: boolean) => void;
	render: () => void;
	renderer: WebGPURenderer;
	restore: () => void;
	stage: (scenario: BenchScenario) => void;
	tune: (tuning: Partial<CosmosTuning>) => void;
}

interface BenchExperiment {
	name: string;
	scenarios: readonly BenchScenario[];
	/** Applied over the defaults, the first one is the baseline. */
	variants: Readonly<Record<string, Partial<CosmosTuning>>>;
}

export interface BenchOptions {
	/** Experiment names, `idle` compares the real loop with and without the idle cap. */
	experiments: readonly string[];
	frames: number;
	idleSeconds: number;
	/** Variants run in a rotated order each round, so clock boosts and heat land on every one of them alike. */
	rounds: number;
	/** Multiplies every variant's pixel ratio, a fast GPU otherwise finishes most passes inside one timestamp step. */
	scale: number;
	/** Frames dropped after each switch, they absorb shader compiles and buffer resizes. */
	warmup: number;
}

const EXPERIMENTS: readonly BenchExperiment[] = [
	{ name: 'bloom', scenarios: ['home', 'sun', 'sky'], variants: { half: { bloom: 0.5 }, quarter: { bloom: 0.25 }, off: { bloom: 0 } } },
	{ name: 'pixelRatio', scenarios: ['home', 'sky', 'jupiter', 'saturn', 'system'], variants: { '1.5': { pixelRatio: 1.5 }, '1': { pixelRatio: 1 }, '0.75': { pixelRatio: 0.75 } } },
];

const DEFAULT_OPTIONS: BenchOptions = { experiments: [...EXPERIMENTS.map(({ name }) => name), 'idle'], frames: 40, idleSeconds: 3, rounds: 6, scale: 1, warmup: 20 };

/**
 * Chrome floors GPU timestamps to 65.5 µs steps unless WebGPU developer features are on. The floor lands at a random phase, so the
 * mean of many frames stays exact while the median snaps to steps: compare means.
 */
interface Stats {
	/** Half width of the mean's 95% confidence interval. */
	ci: number;
	mean: number;
	median: number;
	n: number;
	sd: number;
}

interface BenchRow {
	cpu: Stats;
	/** Mean GPU time change against the baseline, in percent. */
	delta: number;
	experiment: string;
	gpu: Stats;
	/** Mean GPU time of each render pass in the order three issues them: the output pass, the scene, then the bloom passes. */
	passes: number[];
	scenario: string;
	variant: string;
	/** Rounds where the variant's mean beat the baseline's: a real gain wins nearly all of them. */
	wins: string;
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const total = (passes: readonly number[]) => passes.reduce((sum, ms) => sum + ms, 0);

function stats(values: readonly number[]): Stats {
	const average = mean(values);
	const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1));
	const order = [...values].sort((a, b) => a - b);
	return { ci: (1.96 * sd) / Math.sqrt(values.length), mean: average, median: order[Math.floor(order.length / 2)], n: values.length, sd };
}

/** three keeps the GPU time of every pass since the last resolve here, keyed `r:<call>:<context>:f<frame>`, with no public reader. */
interface TimestampBackend {
	timestampQueryPool: { render?: { timestamps: Map<string, number> } };
}

/** GPU time of each pass of every frame rendered since the last call, frames in order and passes in call order. */
async function gpuFrames(renderer: WebGPURenderer) {
	await renderer.resolveTimestampsAsync('render');
	const pool = (renderer.backend as unknown as TimestampBackend).timestampQueryPool.render;
	const frames = new Map<number, [call: number, ms: number][]>();
	for (const [uid, ms] of pool?.timestamps ?? []) {
		const [, call, , frame] = uid.split(':');
		const id = Number(frame.slice(1));
		frames.set(id, [...(frames.get(id) ?? []), [Number(call), ms]]);
	}
	return [...frames]
		.sort(([a], [b]) => a - b)
		.map(([, passes]) => passes.sort(([a], [b]) => a - b).map(([, ms]) => ms));
}

/** Renders on the display's own pacing, so the GPU runs at the clocks players get, and returns each frame's CPU time. */
function renderFrames({ render, renderer }: BenchTarget, count: number) {
	return new Promise<number[]>(resolve => {
		const cpu: number[] = [];
		void renderer.setAnimationLoop(() => {
			const start = performance.now();
			render();
			cpu.push(performance.now() - start);
			if (cpu.length < count) return;
			void renderer.setAnimationLoop(null);
			resolve(cpu);
		});
	});
}

/** Rotated each round and flipped every other one, so no variant always follows the same one. */
const roundOrder = (names: readonly string[], round: number) => {
	const rotated = names.map((_, i) => names[(i + round) % names.length]);
	return round % 2 ? rotated.reverse() : rotated;
};

/** The query pool holds 2048 timestamps, two per pass: 0.4 s of bloom frames at 144 Hz fits. */
const IDLE_WINDOW = 400;

async function idleRun(target: BenchTarget, options: BenchOptions) {
	const variants = ['uncapped', 'capped'];
	const samples = new Map(variants.map(name => [name, { gpu: [] as number[], rendered: [] as number[] }]));
	target.restore();
	for (let round = 0; round < options.rounds; round++) {
		for (const name of roundOrder(variants, round)) {
			target.tune({ ...target.defaults, idleCap: name === 'capped' });
			target.loop(true);
			await new Promise(resolve => setTimeout(resolve, 500));
			await gpuFrames(target.renderer);
			for (let elapsed = 0; elapsed < options.idleSeconds * 1000; elapsed += IDLE_WINDOW) {
				const start = performance.now();
				await new Promise(resolve => setTimeout(resolve, IDLE_WINDOW));
				const frames = await gpuFrames(target.renderer);
				const seconds = (performance.now() - start) / 1000;
				samples.get(name)!.gpu.push(total(frames.map(total)) / seconds);
				samples.get(name)!.rendered.push(frames.length / seconds);
			}
			target.loop(false);
		}
	}
	return variants.map(variant => ({ gpuPerSecond: stats(samples.get(variant)!.gpu), rendered: stats(samples.get(variant)!.rendered), variant }));
}

/**
 * Times every variant of the chosen experiments on their fixed views with the GPU's own timestamps, and tables the results.
 * @example const { idle, rows } = await runBench(target, { experiments: ['bloom'], rounds: 4 });
 */
export async function runBench(target: BenchTarget, overrides: Partial<BenchOptions> = {}) {
	const options = { ...DEFAULT_OPTIONS, ...overrides };
	const rows: BenchRow[] = [];
	for (const { name: experiment, scenarios, variants } of EXPERIMENTS.filter(({ name }) => options.experiments.includes(name))) {
		const names = Object.keys(variants);
		for (const scenario of scenarios) {
			const samples = new Map(names.map(name => [name, { cpu: [] as number[], gpu: [] as number[][], rounds: [] as number[] }]));
			for (let round = 0; round < options.rounds; round++) {
				for (const name of roundOrder(names, round)) {
					const tuning = { ...target.defaults, ...variants[name] };
					target.tune({ ...tuning, pixelRatio: tuning.pixelRatio * options.scale });
					target.stage(scenario);
					await renderFrames(target, options.warmup);
					await gpuFrames(target.renderer);
					const cpu = await renderFrames(target, options.frames);
					const gpu = (await gpuFrames(target.renderer)).slice(-options.frames);
					const sample = samples.get(name)!;
					sample.cpu.push(...cpu);
					sample.gpu.push(...gpu);
					sample.rounds.push(mean(gpu.map(total)));
				}
				console.info(`[cosmos bench] ${experiment} · ${scenario} · round ${round + 1}/${options.rounds}`);
			}
			const baseline = samples.get(names[0])!;
			const baselineMean = mean(baseline.gpu.map(total));
			for (const [variant, { cpu, gpu, rounds }] of samples) {
				const totals = gpu.map(total);
				rows.push({
					cpu: stats(cpu),
					delta: (mean(totals) / baselineMean - 1) * 100,
					experiment,
					gpu: stats(totals),
					passes: Array.from({ length: Math.max(...gpu.map(passes => passes.length)) }, (_, i) => mean(gpu.map(passes => passes[i] ?? 0))),
					scenario,
					variant,
					wins: variant === names[0] ? '' : `${rounds.filter((average, i) => average < baseline.rounds[i]).length}/${rounds.length}`,
				});
			}
		}
	}
	const idle = options.experiments.includes('idle') ? await idleRun(target, options) : [];
	const ms = (value: number) => Number(value.toFixed(3));
	console.table(
		rows.map(({ cpu, delta, experiment, gpu, passes, scenario, variant, wins }) => ({
			experiment,
			scenario,
			variant,
			'gpu mean': ms(gpu.mean),
			'± 95%': ms(gpu.ci),
			'Δ %': Number(delta.toFixed(1)),
			wins,
			'output · scene · bloom': `${ms(passes[0])} · ${ms(passes[1] ?? 0)} · ${ms(total(passes.slice(2)))}`,
			'cpu median': ms(cpu.median),
		})),
	);
	if (idle.length) console.table(idle.map(({ gpuPerSecond, rendered, variant }) => ({ variant, fps: ms(rendered.mean), 'gpu ms/s': ms(gpuPerSecond.mean), '± 95%': ms(gpuPerSecond.ci) })));
	return { idle, options, rows };
}
