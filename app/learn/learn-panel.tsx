'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  X,
} from 'lucide-react';
import {
  TRACKS,
  TRACK_LABELS,
  landmarksFor,
  lessonsFor,
  plainText,
  resolveSeries,
  type Lesson,
  type Review,
  type Track,
  type Vec3,
} from '@/lib/lessons';
import { LESSONS } from '@/lib/lesson-catalog';
import { saveTrack, savedTrack } from './track';

export type LearnSeries = {
  id: string;
  label: string;
  originalSeriesDescription?: string;
};

const TRACK_HINTS: Record<Track, string> = {
  undergrad:
    'Neuroscience, psychology or anatomy courses. Fewer structures, plain language.',
  med: 'Preclinical neuroanatomy. More structures, anatomical detail and clinical relevance.',
};

export function DraftBadge({ review }: { review: Review }) {
  return review.status === 'draft' ? (
    <span className="draft-badge">Draft, not reviewed</span>
  ) : (
    <span className="reviewed-badge">
      Reviewed by {review.reviewer}, {review.role}
    </span>
  );
}

export default function LearnPanel({
  series,
  onShow,
  onClose,
}: {
  series: LearnSeries[];
  /** Moves the focus to a point on a series (switching series if needed). */
  onShow: (seriesId: string, point: Vec3) => void;
  onClose: () => void;
}) {
  // Only rendered after a click in the browser, so storage is readable here.
  const [track, setTrack] = useState<Track | null>(savedTrack);
  const [lessonId, setLessonId] = useState('');
  const [landmarkId, setLandmarkId] = useState('');

  const chooseTrack = (next: Track) => {
    setTrack(next);
    saveTrack(next);
  };
  const lessons = track ? lessonsFor(LESSONS, track) : [];
  const lesson = lessons.find((l) => l.id === lessonId);
  const landmarks = lesson && track ? landmarksFor(lesson, track) : [];
  const index = landmarks.findIndex((l) => l.id === landmarkId);
  const landmark = index >= 0 ? landmarks[index] : undefined;
  const referenceId = lesson
    ? resolveSeries(lesson.referenceSeries, series)
    : '';

  function show(lessonToShow: Lesson, id: string) {
    const target = lessonToShow.landmarks.find((l) => l.id === id);
    const seriesId = resolveSeries(lessonToShow.referenceSeries, series);
    setLandmarkId(id);
    if (target && seriesId) onShow(seriesId, target.point);
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
            <button key={t} onClick={() => chooseTrack(t)}>
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
            For learning general anatomy. This scan shows changes after surgery
            and is not a normal reference. Not medical advice.
          </p>

          {!lesson ? (
            <nav className="lesson-list" aria-label="Lessons">
              <h2>Lessons</h2>
              {lessons.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLessonId(l.id);
                    setLandmarkId('');
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
            </nav>
          ) : (
            <section className="lesson" aria-label={lesson.title[track]}>
              <button
                className="back-link"
                onClick={() => {
                  setLessonId('');
                  setLandmarkId('');
                }}
              >
                <ArrowLeft size={14} /> All lessons
              </button>
              <h2>{lesson.title[track]}</h2>
              <DraftBadge review={lesson.review} />
              <p className="lesson-summary">
                {plainText(lesson.summary[track] ?? '')}
              </p>
              {!referenceId && (
                <p className="learn-error" role="alert">
                  The series this lesson uses, {lesson.referenceSeries}, is not
                  in this study.
                </p>
              )}

              {landmark && (
                <article className="landmark-card" aria-live="polite">
                  <h3>{landmark.name}</h3>
                  <DraftBadge review={landmark.review} />
                  <p>{plainText(landmark.text[track] ?? '')}</p>
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

              <ol className="landmark-list" aria-label="Landmarks">
                {landmarks.map((l) => (
                  <li key={l.id}>
                    <button
                      aria-current={l.id === landmarkId ? 'true' : undefined}
                      disabled={!referenceId}
                      onClick={() => show(lesson, l.id)}
                    >
                      {l.name}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </aside>
  );
}
