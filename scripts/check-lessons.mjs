// Validates every lesson in lessons/ and the glossary: structure, per-track
// text, review rules, ids, and glossary links. Part of `npm run check`.
// Geometry (points inside the head on the real demo scan) is checked by
// tests/test_lessons.py, which needs the Python environment.
//
//   node --experimental-strip-types scripts/check-lessons.mjs [directory]
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateCatalog } from '../lib/lessons.ts';

const dir = path.resolve(process.argv[2] || 'lessons');
const read = (name) => {
  try {
    return JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exit(1);
  }
};
const names = readdirSync(dir).filter(
  (n) => n.endsWith('.json') && n !== 'glossary.json',
);
const lessons = names.map(read);
const errors = validateCatalog(lessons, read('glossary.json'));
lessons.forEach((l, i) => {
  if (l?.id !== names[i].replace(/\.json$/, ''))
    errors.push(`${names[i]}: the file name must be the lesson id plus .json`);
});
if (errors.length) {
  console.error(`${errors.length} problem(s) in ${dir}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const count = (fn) => lessons.reduce((n, l) => n + fn(l), 0);
const drafts = count(
  (l) => l.landmarks.filter((m) => m.review.status === 'draft').length,
);
console.log(
  `Lessons OK: ${lessons.length} lessons, ${count((l) => l.landmarks.length)} landmarks (${drafts} still draft), ${count((l) => l.questions.length)} questions.`,
);
