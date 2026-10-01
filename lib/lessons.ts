/**
 * Learning mode content model. Lessons are JSON files in `lessons/`; this
 * module types them, validates them, and holds the pure helpers the panel and
 * the quiz use. It imports nothing, so `node --experimental-strip-types` can
 * run it directly for `npm run lessons:check`.
 */

export type Track = 'undergrad' | 'med';
export const TRACKS: readonly Track[] = ['undergrad', 'med'];
export const TRACK_LABELS: Record<Track, string> = {
  undergrad: 'Undergraduate',
  med: 'Medical student',
};
export type Vec3 = [number, number, number];
/** Text written once per track. Every track the item belongs to needs text. */
export type TrackText = Partial<Record<Track, string>>;

/** Only a person sets `reviewed`, and names themselves when they do. */
export type Review =
  | { status: 'draft' }
  | { status: 'reviewed'; reviewer: string; role: string; date: string };

export type Landmark = {
  id: string;
  name: string;
  /** Physical RAS millimetres on the lesson's reference series. */
  point: Vec3;
  tracks: Track[];
  text: TrackText;
  /** How close a quiz click must be, in mm. At least 3 (PROGRESS.md CP-0.3). */
  toleranceMm: number;
  review: Review;
};

export type FindQuestion = {
  id: string;
  type: 'find';
  tracks: Track[];
  landmark: string;
};
export type ChoiceQuestion = {
  id: string;
  type: 'choice';
  tracks: Track[];
  prompt: TrackText;
  options: string[];
  answer: number;
  /** Optional landmark the marker jumps to while the question is shown. */
  landmark?: string;
  explanation?: TrackText;
  review: Review;
};
export type Question = FindQuestion | ChoiceQuestion;

export type Lesson = {
  id: string;
  kind: 'landmarks' | 'sequence-compare';
  /** Position in the lesson list, from 1. */
  order: number;
  tracks: Track[];
  title: TrackText;
  summary: TrackText;
  /** `originalSeriesDescription` of the demo series the points are placed on. */
  referenceSeries: string;
  /** Second series shown side by side, only for `sequence-compare`. */
  compareSeries?: string;
  landmarks: Landmark[];
  questions: Question[];
  review: Review;
};

export type GlossaryEntry = {
  id: string;
  term: string;
  definition: string;
  review: Review;
};

export const MIN_TOLERANCE_MM = 3;
export const MAX_TOLERANCE_MM = 20;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `[[id]]` or `[[id|shown text]]` marks a glossary term inside lesson text. */
const TERM = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** Unknown JSON values in error messages, never as "[object Object]". */
const show = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : JSON.stringify(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function checkId(value: unknown, where: string, errors: string[]) {
  if (typeof value !== 'string' || !ID.test(value))
    errors.push(`${where}: id must be lowercase words joined by hyphens`);
}

function checkTracks(
  value: unknown,
  allowed: readonly Track[],
  where: string,
  errors: string[],
): Track[] {
  if (!Array.isArray(value) || !value.length) {
    errors.push(`${where}: tracks must list at least one track`);
    return [];
  }
  const tracks: Track[] = [];
  for (const t of value) {
    if (!TRACKS.includes(t as Track))
      errors.push(`${where}: unknown track "${show(t)}"`);
    else if (!allowed.includes(t as Track))
      errors.push(
        `${where}: track "${show(t)}" is not one of the lesson's tracks`,
      );
    else if (tracks.includes(t as Track))
      errors.push(`${where}: track "${show(t)}" listed twice`);
    else tracks.push(t as Track);
  }
  return tracks;
}

function checkText(
  value: unknown,
  tracks: Track[],
  where: string,
  errors: string[],
) {
  if (!isObject(value)) {
    errors.push(`${where}: text per track is missing`);
    return;
  }
  for (const t of tracks)
    if (!nonEmpty(value[t])) errors.push(`${where}: missing ${t} text`);
  for (const key of Object.keys(value))
    if (!tracks.includes(key as Track))
      errors.push(`${where}: text for "${key}", which this item is not in`);
}

function checkReview(value: unknown, where: string, errors: string[]) {
  if (!isObject(value)) {
    errors.push(`${where}: review is missing`);
    return;
  }
  if (value.status === 'draft') return;
  if (value.status !== 'reviewed') {
    errors.push(`${where}: review status must be "draft" or "reviewed"`);
    return;
  }
  if (!nonEmpty(value.reviewer) || !nonEmpty(value.role))
    errors.push(`${where}: a reviewed item names its reviewer and their role`);
  if (typeof value.date !== 'string' || !DATE.test(value.date))
    errors.push(`${where}: a reviewed item has a review date (YYYY-MM-DD)`);
}

/** Returns readable errors; an empty list means the lesson is valid. */
export function validateLesson(input: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(input)) return ['The lesson is not a JSON object'];
  const where = `lesson ${show(input.id ?? '?')}`;
  checkId(input.id, where, errors);
  if (input.kind !== 'landmarks' && input.kind !== 'sequence-compare')
    errors.push(`${where}: kind must be "landmarks" or "sequence-compare"`);
  if (!Number.isInteger(input.order) || (input.order as number) < 1)
    errors.push(`${where}: order must be a whole number from 1`);
  const tracks = checkTracks(input.tracks, TRACKS, where, errors);
  checkText(input.title, tracks, `${where} title`, errors);
  checkText(input.summary, tracks, `${where} summary`, errors);
  checkReview(input.review, where, errors);
  if (!nonEmpty(input.referenceSeries))
    errors.push(`${where}: referenceSeries names a demo series`);
  if (input.kind === 'sequence-compare') {
    if (!nonEmpty(input.compareSeries))
      errors.push(`${where}: a sequence-compare lesson names compareSeries`);
    else if (input.compareSeries === input.referenceSeries)
      errors.push(`${where}: compareSeries must differ from referenceSeries`);
  } else if (input.compareSeries !== undefined)
    errors.push(`${where}: only sequence-compare lessons have compareSeries`);

  const ids = new Set<string>();
  const unique = (id: unknown, at: string) => {
    if (typeof id !== 'string') return;
    if (ids.has(id))
      errors.push(`${at}: id "${id}" is used twice in this lesson`);
    ids.add(id);
  };
  const landmarks = new Map<string, Track[]>();
  if (!Array.isArray(input.landmarks))
    errors.push(`${where}: landmarks must be a list`);
  else
    input.landmarks.forEach((raw: unknown, i) => {
      const at = `${where} landmark ${isObject(raw) ? show(raw.id) : i}`;
      if (!isObject(raw)) return errors.push(`${at}: not an object`);
      checkId(raw.id, at, errors);
      unique(raw.id, at);
      if (!nonEmpty(raw.name)) errors.push(`${at}: name is missing`);
      if (
        !Array.isArray(raw.point) ||
        raw.point.length !== 3 ||
        !raw.point.every((v) => typeof v === 'number' && Number.isFinite(v))
      )
        errors.push(`${at}: point must be three finite numbers (RAS mm)`);
      const own = checkTracks(raw.tracks, tracks, at, errors);
      checkText(raw.text, own, at, errors);
      if (
        typeof raw.toleranceMm !== 'number' ||
        raw.toleranceMm < MIN_TOLERANCE_MM ||
        raw.toleranceMm > MAX_TOLERANCE_MM
      )
        errors.push(
          `${at}: toleranceMm must be between ${MIN_TOLERANCE_MM} and ${MAX_TOLERANCE_MM}`,
        );
      checkReview(raw.review, at, errors);
      if (typeof raw.id === 'string') landmarks.set(raw.id, own);
    });

  if (!Array.isArray(input.questions))
    errors.push(`${where}: questions must be a list`);
  else
    input.questions.forEach((raw: unknown, i) => {
      const at = `${where} question ${isObject(raw) ? show(raw.id) : i}`;
      if (!isObject(raw)) return errors.push(`${at}: not an object`);
      checkId(raw.id, at, errors);
      unique(raw.id, at);
      const own = checkTracks(raw.tracks, tracks, at, errors);
      const target = raw.landmark;
      if (target !== undefined) {
        const landmarkTracks = landmarks.get(show(target));
        if (!landmarkTracks)
          errors.push(`${at}: unknown landmark "${show(target)}"`);
        else
          for (const t of own)
            if (!landmarkTracks.includes(t))
              errors.push(
                `${at}: landmark "${show(target)}" is not shown on the ${t} track`,
              );
      }
      if (raw.type === 'find') {
        if (target === undefined)
          errors.push(`${at}: a find question names a landmark`);
      } else if (raw.type === 'choice') {
        checkText(raw.prompt, own, `${at} prompt`, errors);
        if (raw.explanation !== undefined)
          checkText(raw.explanation, own, `${at} explanation`, errors);
        const options = raw.options;
        if (
          !Array.isArray(options) ||
          options.length < 2 ||
          !options.every(nonEmpty) ||
          new Set(options).size !== options.length
        )
          errors.push(`${at}: at least two different options`);
        else if (
          !Number.isInteger(raw.answer) ||
          (raw.answer as number) < 0 ||
          (raw.answer as number) >= options.length
        )
          errors.push(`${at}: answer must be the index of one option`);
        checkReview(raw.review, at, errors);
      } else errors.push(`${at}: type must be "find" or "choice"`);
    });
  return errors;
}

export function validateGlossary(input: unknown): string[] {
  if (!Array.isArray(input)) return ['The glossary is not a list'];
  const errors: string[] = [];
  const ids = new Set<string>();
  input.forEach((raw: unknown, i) => {
    const at = `glossary ${isObject(raw) ? show(raw.id) : i}`;
    if (!isObject(raw)) return errors.push(`${at}: not an object`);
    checkId(raw.id, at, errors);
    if (typeof raw.id === 'string') {
      if (ids.has(raw.id)) errors.push(`${at}: id used twice`);
      ids.add(raw.id);
    }
    if (!nonEmpty(raw.term)) errors.push(`${at}: term is missing`);
    if (!nonEmpty(raw.definition)) errors.push(`${at}: definition is missing`);
    checkReview(raw.review, at, errors);
  });
  return errors;
}

/** Every text of a lesson with where it sits, for cross-checks. */
function texts(lesson: Lesson): [string, string][] {
  const out: [string, string][] = [];
  const add = (where: string, text: TrackText | undefined) => {
    for (const [track, value] of Object.entries(text ?? {}))
      if (typeof value === 'string') out.push([`${where} (${track})`, value]);
  };
  add(`lesson ${lesson.id} title`, lesson.title);
  add(`lesson ${lesson.id} summary`, lesson.summary);
  for (const l of lesson.landmarks)
    add(`lesson ${lesson.id} landmark ${l.id}`, l.text);
  for (const q of lesson.questions)
    if (q.type === 'choice') {
      add(`lesson ${lesson.id} question ${q.id} prompt`, q.prompt);
      add(`lesson ${lesson.id} question ${q.id} explanation`, q.explanation);
    }
  return out;
}

/** Checks the whole catalogue: each lesson, the glossary, and links between them. */
export function validateCatalog(
  lessons: unknown[],
  glossary: unknown,
): string[] {
  const errors = [...validateGlossary(glossary)];
  const lessonErrors = lessons.map(validateLesson);
  lessonErrors.forEach((e) => errors.push(...e));
  const seen = new Set<string>();
  for (const l of lessons)
    if (isObject(l) && typeof l.id === 'string') {
      if (seen.has(l.id)) errors.push(`lesson ${l.id}: id used by two lessons`);
      seen.add(l.id);
    }
  const orders = lessons.map((l) => (isObject(l) ? l.order : undefined));
  if (new Set(orders).size !== orders.length)
    errors.push('Two lessons have the same order');
  if (errors.length) return errors;
  const terms = new Set((glossary as GlossaryEntry[]).map((g) => g.id));
  for (const lesson of lessons as Lesson[])
    for (const [where, text] of texts(lesson))
      for (const part of parseGlossaryText(text))
        if (part.term !== undefined && !terms.has(part.term))
          errors.push(`${where}: unknown glossary term "${part.term}"`);
  return errors;
}

export type TextPart = { text: string; term?: string };
/** Splits text into plain parts and glossary terms (`[[id]]`, `[[id|shown]]`). */
export function parseGlossaryText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TERM)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const id = match[1].trim();
    const shown = (match[2] ?? id.replaceAll('-', ' ')).trim();
    parts.push({ text: shown || id, term: id });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Text with glossary markup removed, for screen-reader labels and search. */
export const plainText = (text: string) =>
  parseGlossaryText(text)
    .map((p) => p.text)
    .join('');

export const lessonsFor = (lessons: Lesson[], track: Track) =>
  lessons.filter((l) => l.tracks.includes(track));
export const landmarksFor = (lesson: Lesson, track: Track) =>
  lesson.landmarks.filter((l) => l.tracks.includes(track));
export const questionsFor = (lesson: Lesson, track: Track) =>
  lesson.questions.filter((q) => q.tracks.includes(track));

/** Finds a demo series by its description; empty when the study lacks it. */
export function resolveSeries(
  description: string,
  series: { id: string; originalSeriesDescription?: string; label?: string }[],
) {
  return (
    series.find((s) => (s.originalSeriesDescription ?? s.label) === description)
      ?.id ?? ''
  );
}

/** A find answer is right when the click lies within the landmark's tolerance. */
export function findIsCorrect(click: number[] | null, landmark: Landmark) {
  if (!click || click.length < 3 || !click.slice(0, 3).every(Number.isFinite))
    return false;
  const d = Math.hypot(
    click[0] - landmark.point[0],
    click[1] - landmark.point[1],
    click[2] - landmark.point[2],
  );
  return d <= landmark.toleranceMm;
}

export type QuizResult = { questionId: string; correct: boolean };
export const score = (results: QuizResult[]) => ({
  correct: results.filter((r) => r.correct).length,
  total: results.length,
});

/** Best score per lesson and track, kept only in this browser. */
export function betterScore(
  previous: { correct: number; total: number } | null,
  next: { correct: number; total: number },
) {
  if (!previous || !previous.total) return next;
  return next.correct / next.total > previous.correct / previous.total
    ? next
    : previous;
}
