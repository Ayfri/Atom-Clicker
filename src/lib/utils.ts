const SUFFIXES = [
	'',
	'K',
	'M',
	'B',
	'T',
	'Qa',
	'Qi',
	'Sx',
	'Sp',
	'Oc',
	'No',
	'Dc',
	'UDc',
	'DDc',
	'TDc',
	'QaDc',
	'QiDc',
	'SxDc',
	'SpDc',
	'OcDc',
	'NoDc',
	'Vg',
	'UVg',
	'DVg',
	'TVg',
	'QaVg',
	'QiVg',
	'SxVg',
	'SpVg',
	'OcVg',
	'NoVg',
	'Tg',
	'UTg',
	'DTg',
	'TTg',
	'QaTg',
	'QiTg',
	'SxTg',
	'SpTg',
	'OcTg',
	'NoTg',
	'Qag',
	'UQag',
	'DQag',
	'TQag',
	'QaQag',
	'QiQag',
	'SxQag',
	'SpQag',
	'OcQag',
	'NoQag',
	'Qig',
	'UQig',
	'DQig',
	'TQig',
	'QaQig',
	'QiQig',
	'SxQig',
	'SpQig',
	'OcQig',
	'NoQig',
	'Sxg',
	'USxg',
	'DSxg',
	'TSxg',
	'QaSxg',
	'QiSxg',
	'SxSxg',
	'SpSxg',
	'OcSxg',
	'NoSxg',
	'Spg',
	'USpg',
	'DSpg',
	'TSpg',
	'QaSpg',
	'QiSpg',
	'SxSpg',
	'SpSpg',
	'OcSpg',
	'NoSpg',
	'Ocg',
	'UOcg',
	'DOcg',
	'TOcg',
	'QaOcg',
	'QiOcg',
	'SxOcg',
	'SpOcg',
	'OcOcg',
	'NoOcg',
	'Nog',
	'UNog',
	'DNog',
	'TNog',
	'QaNog',
	'QiNog',
	'SxNog',
	'SpNog',
	'OcNog',
	'NoNog',
	'Dg',
	'UDg',
	'DDg',
	'TDg',
	'QaDg',
	'QiDg',
	'SxDg',
	'SpDg',
	'OcDg',
	'NoDg',
];

const EPSILON = 0.0001;

export function formatNumber(num: number, precision = 2): string {
	if (!Number.isFinite(num)) {
		return '∞';
	}

	const absNum = Math.abs(num);

	if (absNum < 1000) {
		// Handle floating-point precision: check if close to integer
		const rounded = Math.round(num);
		if (Math.abs(num - rounded) < EPSILON) {
			return `${rounded}`;
		} else {
			return `${num.toFixed(precision)}`;
		}
	}

	const exponent = Math.floor(Math.log(absNum) / Math.log(1000));
	const suffixIndex = Math.min(exponent, SUFFIXES.length - 1);
	const suffix = SUFFIXES[suffixIndex];
	const scaled = num / Math.pow(1000, suffixIndex);

	return `${scaled.toFixed(precision)}${suffix}`;
}

export function formatNumberFull(num: number): string {
	if (!Number.isFinite(num)) {
		return '∞';
	}

	return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d ${hours % 24}h ${minutes % 60}m`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}

export function shortNumberText(num: number): string {
	const names = ['double', 'triple', 'quadruple', 'quintuple', 'sextuple', 'septuple', 'octuple', 'nonuple', 'decuple'];
	return names[num - 2] || `${num}x`;
}

export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

export function randomValue<T>(array: T[]): T {
	return array[Math.floor(Math.random() * array.length)];
}
