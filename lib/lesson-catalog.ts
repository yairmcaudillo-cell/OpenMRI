/// <reference types="vite/client" />
import { validateCatalog, type GlossaryEntry, type Lesson } from './lessons';

/**
 * Every lesson in `lessons/` is bundled at build time: adding a JSON file is
 * enough, no code changes. `npm run lessons:check` validates the same files
 * before they ship; the check here only keeps a broken file from reaching the
 * panel if that step was skipped.
 */
const files = import.meta.glob<unknown>('../lessons/*.json', {
  eager: true,
  import: 'default',
});
const glossaryFile = files['../lessons/glossary.json'];
const lessonFiles = Object.entries(files)
  .filter(([path]) => !path.endsWith('/glossary.json'))
  .map(([, lesson]) => lesson);

const problems = validateCatalog(lessonFiles, glossaryFile);
if (problems.length)
  console.error('Learning mode is off: the lessons are invalid.', problems);

export const LESSONS: Lesson[] = problems.length
  ? []
  : (lessonFiles as Lesson[]).sort((a, b) => a.order - b.order);
export const GLOSSARY: Map<string, GlossaryEntry> = new Map(
  problems.length
    ? []
    : (glossaryFile as GlossaryEntry[]).map((g) => [g.id, g]),
);
