'use client';
import { useEffect, useId, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  X,
} from 'lucide-react';
import {
  TRACKS,
  TRACK_LABELS,
  landmarksFor,
  lessonsFor,
  resolveSeries,
  type Lesson,
  type CaseId,
  type Overlay,
  type Track,
  type Vec3,
} from '@/lib/lessons';
import { LESSONS } from '@/lib/lesson-catalog';
import { meshUrl } from '@/lib/online';
import DraftBadge from './draft-badge';
import GlossaryText from './glossary-text';
import Quiz from './quiz';
import { saveGlossary, saveTrack, savedGlossary, savedTrack } from './track';

export type LearnSeries = {
  id: string;
  label: string;
  originalSeriesDescription?: string;
  /** A region's 3D model, for label-map series. */
  meshes?: { value: number; url: string; triangles: number }[];
};

const NOTICES: Record<CaseId, string> = {
  jane: 'For learning general anatomy. This scan shows changes after surgery and is not a normal reference. Not medical advice.',
  glioma:
    'For learning how brain tumours look in general. The text is not about this person and gives no diagnosis. Not medical advice.',
};
const fileName = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.stl`;

const TRACK_HINTS: Record<Track, string> = {
  undergrad:
    'Neuroscience, psychology or anatomy courses. Fewer structures, plain language.',
  med: 'Preclinical neuroanatomy. More structures, anatomical detail and clinical relevance.',
};

export default function LearnPanel({
  caseId,
  series,
  point,
  sliceInput,
  loading,
  onShow,
  onSeries,
  onOverlay,
  otherCases = [],
  onClose,
}: {
  /** The open study's teaching case; only its lessons are listed. */
  caseId: CaseId;
  series: LearnSeries[];
  /** The viewer's focus in mm while visible; a new array on every move. */
  point: number[] | null;
  /** Counts clicks and scrolls on the slices. */
  sliceInput: number;
  loading: boolean;
  /** Moves the focus to a point on a series; with a second series, side by side. */
  onShow: (seriesId: string, point: Vec3, compareWith?: string) => void;
  /** Opens a series (and a second one beside it) keeping the position. */
  onSeries: (seriesId: string, compareWith?: string) => void;
  /** What to draw of the lesson's expert regions; null when there is none. */
  onOverlay: (overlay: Overlay | null) => void;
  /** Other teaching cases to switch to, listed under the lessons. */
  otherCases?: { name: string; open: () => void }[];
  onClose: () => void;
}) {
  // Only rendered after a click in the browser, so storage is readable here.
  const [track, setTrack] = useState<Track | null>(savedTrack);
  const [definitions, setDefinitions] = useState(() =>
    savedGlossary(savedTrack() ?? 'undergrad'),
  );
  const [lessonId, setLessonId] = useState('');
  const [landmarkId, setLandmarkId] = useState('');
  const [quiz, setQuiz] = useState(false);
  // Regions the learner switched off, per view; reset when a lesson opens.
  const [offSlices, setOffSlices] = useState<number[]>([]);
  const [offModels, setOffModels] = useState<number[]>([]);

  // When a view is replaced, keyboard focus moves to its heading instead of
  // falling back to the page.
  const ids = useId();
  const listHeading = `${ids}-lessons`;
  const lessonHeading = `${ids}-lesson`;
  const focusSoon = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.focus());

  const chooseTrack = (next: Track) => {
    setTrack(next);
    saveTrack(next);
    setDefinitions(savedGlossary(next));
  };
  const lessons = track ? lessonsFor(LESSONS, track, caseId) : [];
  const lesson = lessons.find((l) => l.id === lessonId);
  const landmarks = lesson && track ? landmarksFor(lesson, track) : [];
  const index = landmarks.findIndex((l) => l.id === landmarkId);
  const landmark = index >= 0 ? landmarks[index] : undefined;
  const referenceId = lesson
    ? resolveSeries(lesson.referenceSeries, series)
    : '';
  const compareId = lesson?.compareSeries
    ? resolveSeries(lesson.compareSeries, series)
    : '';
  const missing =
    !!lesson && (!referenceId || (!!lesson.compareSeries && !compareId));
  const labels = lesson?.labelSeries
    ? series.find((s) => s.id === resolveSeries(lesson.labelSeries!, series))
    : undefined;
  const regions = labels ? lesson?.regions : undefined;

  useEffect(() => {
    if (!labels || !regions) return;
    const values = regions.map((r) => r.value);
    onOverlay({
      seriesId: labels.id,
      regions,
      onSlices: values.filter((v) => !offSlices.includes(v)),
      inModels: values.filter((v) => !offModels.includes(v)),
    });
    return () => onOverlay(null);
  }, [labels, regions, offSlices, offModels, onOverlay]);
  const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  function show(lessonToShow: Lesson, id: string) {
    const target = lessonToShow.landmarks.find((l) => l.id === id);
    const seriesId = resolveSeries(lessonToShow.referenceSeries, series);
    const second = lessonToShow.compareSeries
      ? resolveSeries(lessonToShow.compareSeries, series)
      : undefined;
    setLandmarkId(id);
    if (target && seriesId && second !== '')
      onShow(seriesId, target.point, second);
  }

  return (
    <aside className="side-panel learn-panel" aria-label="Learning mode">
      <header>
        <GraduationCap size={20} />
        <span className="eyebrow">LEARNING MODE</span>
        <button
          className="icon-button"
          aria-label="Close learning mode"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>

      {!track ? (
        <section className="track-picker">
          <h2>Who is learning?</h2>
          <p>
            Choose a track. The scan and the landmarks are the same; the depth
            of the text and the quiz change. You can switch at any time.
          </p>
          {TRACKS.map((t) => (
            <button
              key={t}
              onClick={() => {
                chooseTrack(t);
                focusSoon(listHeading);
              }}
            >
              <strong>{TRACK_LABELS[t]}</strong>
              <small>{TRACK_HINTS[t]}</small>
            </button>
          ))}
        </section>
      ) : (
        <>
          <fieldset className="track-switch">
            <legend>Track</legend>
            {TRACKS.map((t) => (
              <button
                key={t}
                aria-pressed={track === t}
                onClick={() => chooseTrack(t)}
              >
                {TRACK_LABELS[t]}
              </button>
            ))}
          </fieldset>
          <p className="learn-notice" role="note">
            {NOTICES[caseId]}
          </p>

          {!lesson ? (
            <nav className="lesson-list" aria-label="Lessons">
              <h2 id={listHeading} tabIndex={-1}>
                Lessons
              </h2>
              {lessons.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLessonId(l.id);
                    setLandmarkId('');
                    setOffSlices([]);
                    setOffModels([]);
                    setQuiz(false);
                    focusSoon(lessonHeading);
                  }}
                >
                  <span className="lesson-order">
                    {String(l.order).padStart(2, '0')}
                  </span>
                  <span>
                    <strong>{l.title[track]}</strong>
                    <small>{landmarksFor(l, track).length} landmarks</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!lessons.length && (
                <p>No lessons are available for this track.</p>
              )}
              {otherCases.length > 0 && (
                <>
                  <h3>More teaching cases</h3>
                  {otherCases.map((c) => (
                    <button key={c.name} onClick={c.open}>
                      <span>
                        <strong>{c.name}</strong>
                        <small>Another scan, with its own lessons</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </>
              )}
            </nav>
          ) : (
            <section className="lesson" aria-label={lesson.title[track]}>
              <button
                className="back-link"
                onClick={() => {
                  setLessonId('');
                  setLandmarkId('');
                  focusSoon(listHeading);
                }}
              >
                <ArrowLeft size={14} /> All lessons
              </button>
              <h2 id={lessonHeading} tabIndex={-1}>
                {lesson.title[track]}
              </h2>
              <DraftBadge review={lesson.review} />
              <p className="lesson-summary">
                <GlossaryText
                  text={lesson.summary[track] ?? ''}
                  definitions={definitions}
                />
              </p>
              <label className="definitions-toggle">
                <input
                  type="checkbox"
                  checked={definitions}
                  onChange={(e) => {
                    setDefinitions(e.target.checked);
                    saveGlossary(track, e.target.checked);
                  }}
                />
                Show definitions
              </label>
              {regions && labels && (
                <section className="region-legend" aria-label="Expert outline">
                  <h3>Expert outline</h3>
                  <p>
                    Drawn by experts for the dataset; OpenMRI only shows it.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Region</th>
                        <th scope="col">Slices</th>
                        <th scope="col">3D</th>
                        <th scope="col">
                          <span className="sr-only">3D model file</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((r) => {
                        const mesh = labels.meshes?.find(
                          (m) => m.value === r.value,
                        );
                        return (
                          <tr key={r.value}>
                            <th scope="row">
                              <span
                                className="region-swatch"
                                style={{ background: r.color }}
                                aria-hidden
                              />
                              {r.name}
                            </th>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`${r.name} on the slices`}
                                checked={!offSlices.includes(r.value)}
                                onChange={() =>
                                  setOffSlices((l) => toggle(l, r.value))
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`${r.name} in 3D`}
                                disabled={!mesh}
                                checked={!!mesh && !offModels.includes(r.value)}
                                onChange={() =>
                                  setOffModels((l) => toggle(l, r.value))
                                }
                              />
                            </td>
                            <td>
                              {mesh && (
                                <a
                                  href={meshUrl(mesh.url)}
                                  download={fileName(r.name)}
                                  aria-label={`Download the ${r.name} 3D model (STL)`}
                                  title="Download 3D model (STL)"
                                >
                                  <Download size={14} />
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}
              {lesson.source && (
                <p className="source-credit">
                  Scan and outline:{' '}
                  <a href={lesson.source.url} target="_blank" rel="noreferrer">
                    {lesson.source.text}
                  </a>
                  , {lesson.source.license}.
                </p>
              )}
              {missing && (
                <p className="learn-error" role="alert">
                  A series this lesson uses (
                  {[lesson.referenceSeries, lesson.compareSeries]
                    .filter(Boolean)
                    .join(', ')}
                  ) is not in this study.
                </p>
              )}

              <fieldset className="track-switch lesson-mode">
                <legend>Lesson mode</legend>
                <button aria-pressed={!quiz} onClick={() => setQuiz(false)}>
                  Explore
                </button>
                <button aria-pressed={quiz} onClick={() => setQuiz(true)}>
                  Quiz
                </button>
              </fieldset>

              {quiz && (
                <Quiz
                  key={`${lesson.id}:${track}`}
                  lesson={lesson}
                  track={track}
                  point={point}
                  sliceInput={sliceInput}
                  loading={loading}
                  definitions={definitions}
                  onStart={() =>
                    !missing && onSeries(referenceId, compareId || undefined)
                  }
                  onShow={(p) =>
                    !missing && onShow(referenceId, p, compareId || undefined)
                  }
                  onExit={() => setQuiz(false)}
                />
              )}

              {!quiz && landmark && (
                <article className="landmark-card" aria-live="polite">
                  <h3>{landmark.name}</h3>
                  <DraftBadge review={landmark.review} />
                  <p>
                    <GlossaryText
                      text={landmark.text[track] ?? ''}
                      definitions={definitions}
                    />
                  </p>
                  <div className="landmark-steps">
                    <button
                      aria-label="Previous landmark"
                      disabled={index <= 0}
                      onClick={() => show(lesson, landmarks[index - 1].id)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>
                      {index + 1} / {landmarks.length}
                    </span>
                    <button
                      aria-label="Next landmark"
                      disabled={index >= landmarks.length - 1}
                      onClick={() => show(lesson, landmarks[index + 1].id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </article>
              )}

              {!quiz && (
                <ol className="landmark-list" aria-label="Landmarks">
                  {landmarks.map((l) => (
                    <li key={l.id}>
                      <button
                        aria-current={l.id === landmarkId ? 'true' : undefined}
                        disabled={missing}
                        onClick={() => show(lesson, l.id)}
                      >
                        {l.name}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
