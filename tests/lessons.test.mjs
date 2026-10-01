import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
const code = ts.transpileModule(
  fs.readFileSync(new URL('../lib/lessons.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const L = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const draft = { status: 'draft' };
const lesson = () => ({
  id: 'brain-basics',
  kind: 'landmarks',
  case: 'jane',
  order: 1,
  tracks: ['undergrad', 'med'],
  title: { undergrad: 'Basics', med: 'Basics' },
  summary: { undergrad: 'Start here.', med: 'Start here.' },
  referenceSeries: '02 Axial MPRAGE',
  review: draft,
  landmarks: [
    {
      id: 'thalamus',
      name: 'Thalamus',
      point: [12, -18, -3],
      tracks: ['undergrad', 'med'],
      text: { undergrad: 'A relay [[nucleus|hub]].', med: 'Relay nuclei.' },
      toleranceMm: 6,
      review: draft,
    },
    {
      id: 'putamen',
      name: 'Putamen',
      point: [25, 2, 0],
      tracks: ['med'],
      text: { med: 'Part of the lentiform nucleus.' },
      toleranceMm: 6,
      review: draft,
    },
  ],
  questions: [
    {
      id: 'find-thalamus',
      type: 'find',
      tracks: ['undergrad'],
      landmark: 'thalamus',
    },
    {
      id: 'which',
      type: 'choice',
      tracks: ['med'],
      prompt: { med: 'Which structure is at the marker?' },
      options: ['Putamen', 'Caudate'],
      answer: 0,
      landmark: 'putamen',
      review: draft,
    },
  ],
});
const glossary = [
  {
    id: 'nucleus',
    term: 'Nucleus',
    definition: 'A cluster of neurons.',
    review: draft,
  },
];

/** Applies a change to a fresh valid lesson and returns its errors. */
const broken = (change) => {
  const l = lesson();
  change(l);
  return L.validateLesson(l);
};
const expectError = (errors, pattern) =>
  assert.ok(
    errors.some((e) => pattern.test(e)),
    `expected ${pattern} in ${JSON.stringify(errors)}`,
  );

test('a complete lesson and glossary pass', () => {
  assert.deepEqual(L.validateLesson(lesson()), []);
  assert.deepEqual(L.validateCatalog([lesson()], glossary), []);
});

test('each rule rejects its broken case with a readable message', () => {
  const cases = [
    [(l) => (l.id = 'Brain Basics'), /id must be lowercase/],
    [(l) => (l.kind = 'video'), /kind must be/],
    [(l) => (l.tracks = []), /at least one track/],
    [(l) => (l.tracks = ['undergrad', 'nurse']), /unknown track "nurse"/],
    [(l) => delete l.title.med, /title: missing med text/],
    [
      (l) => delete l.landmarks[0].text.undergrad,
      /thalamus: missing undergrad text/,
    ],
    [
      (l) => (l.landmarks[1].text.undergrad = 'x'),
      /text for "undergrad", which this item is not in/,
    ],
    [(l) => (l.landmarks[0].point = [1, 2]), /three finite numbers/],
    [
      (l) => (l.landmarks[0].point = [1, 2, Number.NaN]),
      /three finite numbers/,
    ],
    [
      (l) => (l.landmarks[0].toleranceMm = 2),
      /toleranceMm must be between 3 and 20/,
    ],
    [(l) => (l.landmarks[1].id = 'thalamus'), /used twice in this lesson/],
    [
      (l) => (l.landmarks[0].tracks = ['undergrad', 'undergrad']),
      /listed twice/,
    ],
    [(l) => (l.tracks = ['med']), /not one of the lesson's tracks/],
    [
      (l) => (l.questions[0].landmark = 'hippocampus'),
      /unknown landmark "hippocampus"/,
    ],
    [
      (l) => (l.questions[0].landmark = 'putamen'),
      /not shown on the undergrad track/,
    ],
    [(l) => delete l.questions[0].landmark, /a find question names a landmark/],
    [
      (l) => (l.questions[1].options = ['Putamen']),
      /at least two different options/,
    ],
    [
      (l) => (l.questions[1].options = ['A', 'A']),
      /at least two different options/,
    ],
    [(l) => (l.questions[1].answer = 2), /index of one option/],
    [(l) => (l.questions[1].type = 'essay'), /type must be "find" or "choice"/],
    [(l) => (l.compareSeries = '04 Axial T2 FLAIR'), /only sequence-compare/],
    [(l) => (l.kind = 'sequence-compare'), /names compareSeries/],
    [(l) => delete l.review, /review is missing/],
    [(l) => (l.order = 0), /order must be a whole number/],
    [(l) => (l.case = 'bob'), /case must be one of jane, glioma/],
    [(l) => delete l.case, /case must be one of jane, glioma/],
  ];
  for (const [change, pattern] of cases) expectError(broken(change), pattern);
});

test('reviewed content must name the reviewer, their role and the date', () => {
  expectError(
    broken((l) => (l.landmarks[0].review = { status: 'reviewed' })),
    /names its reviewer and their role/,
  );
  expectError(
    broken(
      (l) =>
        (l.landmarks[0].review = {
          status: 'reviewed',
          reviewer: 'A. B.',
          role: 'Resident',
          date: 'soon',
        }),
    ),
    /review date/,
  );
  expectError(
    broken((l) => (l.review = { status: 'approved' })),
    /"draft" or "reviewed"/,
  );
  assert.deepEqual(
    broken(
      (l) =>
        (l.landmarks[0].review = {
          status: 'reviewed',
          reviewer: 'A. B.',
          role: 'Resident',
          date: '2026-10-01',
        }),
    ),
    [],
  );
});

test('the catalogue catches unknown glossary terms and duplicate lessons', () => {
  const l = lesson();
  l.landmarks[0].text.med = 'See [[gyrus]].';
  expectError(
    L.validateCatalog([l], glossary),
    /unknown glossary term "gyrus"/,
  );
  expectError(
    L.validateCatalog([lesson(), lesson()], glossary),
    /used by two lessons/,
  );
  expectError(
    L.validateCatalog([lesson(), { ...lesson(), id: 'other' }], glossary),
    /same order/,
  );
  expectError(
    L.validateCatalog([lesson()], [...glossary, ...glossary]),
    /id used twice/,
  );
});

test('glossary markup splits into plain text and terms', () => {
  assert.deepEqual(L.parseGlossaryText('A [[gyrus]] and [[sulcus|sulci]].'), [
    { text: 'A ' },
    { text: 'gyrus', term: 'gyrus' },
    { text: ' and ' },
    { text: 'sulci', term: 'sulcus' },
    { text: '.' },
  ]);
  assert.equal(L.plainText('A [[sulcus|sulci]] here'), 'A sulci here');
  assert.deepEqual(L.parseGlossaryText('no terms'), [{ text: 'no terms' }]);
  // A bare link shows its id as words, never with hyphens.
  assert.deepEqual(L.parseGlossaryText('[[grey-matter]]'), [
    { text: 'grey matter', term: 'grey-matter' },
  ]);
});

test('track helpers show each track only its own lessons, landmarks and questions', () => {
  const l = lesson();
  assert.deepEqual(
    L.landmarksFor(l, 'undergrad').map((x) => x.id),
    ['thalamus'],
  );
  assert.deepEqual(
    L.landmarksFor(l, 'med').map((x) => x.id),
    ['thalamus', 'putamen'],
  );
  assert.deepEqual(
    L.questionsFor(l, 'undergrad').map((q) => q.id),
    ['find-thalamus'],
  );
  assert.deepEqual(
    L.lessonsFor(
      [l, { ...l, id: 'm', tracks: ['med'] }],
      'undergrad',
      'jane',
    ).map((x) => x.id),
    ['brain-basics'],
  );
});

test('series resolve by their original description', () => {
  const series = [
    { id: 'a', originalSeriesDescription: '01 +C Axial MPRAGE' },
    { id: 'b', originalSeriesDescription: '02 Axial MPRAGE' },
  ];
  assert.equal(L.resolveSeries('02 Axial MPRAGE', series), 'b');
  assert.equal(L.resolveSeries('99 Missing', series), '');
});

test('find answers use the landmark tolerance, inclusive, and reject bad clicks', () => {
  const t = lesson().landmarks[0]; // [12,-18,-3], 6 mm
  assert.equal(L.findIsCorrect([12, -18, -3], t), true);
  assert.equal(L.findIsCorrect([18, -18, -3], t), true);
  assert.equal(L.findIsCorrect([18.01, -18, -3], t), false);
  assert.equal(L.findIsCorrect(null, t), false);
  assert.equal(L.findIsCorrect([Number.NaN, 0, 0], t), false);
});

test('scores total up and the best ratio is kept', () => {
  const s = L.score([
    { questionId: 'a', correct: true },
    { questionId: 'b', correct: false },
  ]);
  assert.deepEqual(s, { correct: 1, total: 2 });
  assert.deepEqual(L.betterScore(null, s), s);
  assert.deepEqual(L.betterScore({ correct: 3, total: 4 }, s), {
    correct: 3,
    total: 4,
  });
  assert.deepEqual(L.betterScore({ correct: 0, total: 4 }, s), s);
});

const checkLessons = (dir) =>
  spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      'scripts/check-lessons.mjs',
      dir,
    ],
    { encoding: 'utf8' },
  );

test('lessons:check passes on the shipped lessons', () => {
  const r = checkLessons('lessons');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Lessons OK/);
});

test('lessons:check fails on a broken lesson and on a misnamed file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  fs.writeFileSync(path.join(dir, 'glossary.json'), JSON.stringify(glossary));
  const bad = lesson();
  bad.landmarks[0].review = { status: 'reviewed' };
  fs.writeFileSync(path.join(dir, 'brain-basics.json'), JSON.stringify(bad));
  let r = checkLessons(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /names its reviewer/);
  fs.writeFileSync(
    path.join(dir, 'brain-basics.json'),
    JSON.stringify(lesson()),
  );
  fs.renameSync(
    path.join(dir, 'brain-basics.json'),
    path.join(dir, 'other.json'),
  );
  r = checkLessons(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /file name must be the lesson id/);
  fs.rmSync(dir, { recursive: true });
});

/** A lesson on the glioma case with expert regions. */
const pathology = () => ({
  ...lesson(),
  id: 'glioma',
  case: 'glioma',
  referenceSeries: '03 T1 +C',
  labelSeries: '05 Tumour labels (expert)',
  regions: [
    { value: 1, name: 'Edema', color: '#facc15' },
    { value: 3, name: 'Enhancing tumour', color: '#3b82f6' },
  ],
  source: {
    text: 'Medical Segmentation Decathlon, BRATS_449',
    url: 'https://medicaldecathlon.com',
    license: 'CC BY-SA 4.0',
  },
  landmarks: [{ ...lesson().landmarks[0], region: 3 }],
  questions: [],
});

test('lessons with expert regions are validated', () => {
  assert.deepEqual(L.validateLesson(pathology()), []);
  const cases = [
    [(l) => delete l.labelSeries, /regions need a labelSeries/],
    [(l) => (l.regions[1].value = 1), /region value 1 is used twice/],
    [(l) => (l.regions[0].color = 'yellow'), /colour must be #rrggbb/],
    [(l) => (l.regions[0].name = ''), /region needs a name/],
    [
      (l) => (l.landmarks[0].region = 2),
      /region 2 is not one of the lesson's regions/,
    ],
    [(l) => delete l.source.license, /source needs text, url and license/],
    [(l) => (l.source.url = 'javascript:alert(1)'), /source url must be https/],
  ];
  for (const [change, pattern] of cases) {
    const l = pathology();
    change(l);
    expectError(L.validateLesson(l), pattern);
  }
});

test('each case sees only its own lessons', () => {
  const both = [lesson(), pathology()];
  assert.deepEqual(
    L.lessonsFor(both, 'med', 'jane').map((l) => l.id),
    ['brain-basics'],
  );
  assert.deepEqual(
    L.lessonsFor(both, 'med', 'glioma').map((l) => l.id),
    ['glioma'],
  );
});
