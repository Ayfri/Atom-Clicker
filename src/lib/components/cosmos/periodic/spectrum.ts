import { wavelengthColor } from '#data/elements.js';

/** The visible spectrum from violet to red. */
export const SPECTRUM = `linear-gradient(90deg, ${[380, 420, 450, 480, 510, 550, 580, 610, 650, 700, 780].map(wavelengthColor).join(', ')})`;
