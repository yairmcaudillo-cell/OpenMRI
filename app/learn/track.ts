import type { Track } from '@/lib/lessons';

// Per-browser preferences for learning mode. Storage can be unavailable
// (private windows, blocked site data); the panel then just asks again.
const TRACK_KEY = 'openmri-learning-track';
const GLOSSARY_KEY = 'openmri-learning-glossary';
const SCORE_KEY = 'openmri-learning-scores';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Local storage is optional. */
  }
}

export function savedTrack(): Track | null {
  const value = read(TRACK_KEY);
  return value === 'undergrad' || value === 'med' ? value : null;
}
export const saveTrack = (track: Track) => write(TRACK_KEY, track);

/** Glossary links are on by default for undergraduates, off for medical students. */
export function savedGlossary(track: Track) {
  const value = read(`${GLOSSARY_KEY}-${track}`);
  return value === null ? track === 'undergrad' : value === 'on';
}
export const saveGlossary = (track: Track, on: boolean) =>
  write(`${GLOSSARY_KEY}-${track}`, on ? 'on' : 'off');

type Scores = Record<string, { correct: number; total: number }>;
export function savedScores(): Scores {
  try {
    const value = JSON.parse(read(SCORE_KEY) || '{}') as unknown;
    return value && typeof value === 'object' ? (value as Scores) : {};
  } catch {
    return {};
  }
}
export const saveScores = (scores: Scores) =>
  write(SCORE_KEY, JSON.stringify(scores));
