'use client';
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import {
  betterScore,
  findIsCorrect,
  questionsFor,
  score,
  type Lesson,
  type QuizResult,
  type Track,
  type Vec3,
} from '@/lib/lessons';
import GlossaryText from './glossary-text';
import DraftBadge from './draft-badge';
import { saveScores, savedScores } from './track';

type Answer = { correct: boolean; choice?: number };

/**
 * Find questions: the student clicks the structure on a slice, then Check.
 * Only a click made after the question appeared counts. Choice questions may
 * move the marker to a landmark first. Scores stay in this browser.
 */
export default function Quiz({
  lesson,
  track,
  point,
  loading,
  definitions,
  onStart,
  onShow,
  onExit,
}: {
  lesson: Lesson;
  track: Track;
  /** The current focus from the viewer; a new object on every slice click. */
  point: number[] | null;
  /** The viewer is loading a series; answers wait until it is ready. */
  loading: boolean;
  definitions: boolean;
  /** Opens the lesson's reference series, keeping the current position. */
  onStart: () => void;
  onShow: (point: Vec3) => void;
  onExit: () => void;
}) {
  const questions = questionsFor(lesson, track);
  const key = `${lesson.id}:${track}`;
  const [best, setBest] = useState(() => savedScores()[key] ?? null);
  const [step, setStep] = useState(-1); // -1 before the start
  const [results, setResults] = useState<QuizResult[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  // The focus when the question appeared (or when a series load finished);
  // a different object afterwards means the student clicked or scrolled.
  const [startPoint, setStartPoint] = useState<number[] | null>(null);
  const [wasLoading, setWasLoading] = useState(loading);
  if (wasLoading !== loading) {
    setWasLoading(loading);
    if (!loading) setStartPoint(point);
  }

  const question = step >= 0 ? questions[step] : undefined;
  const target = question?.landmark
    ? lesson.landmarks.find((l) => l.id === question.landmark)
    : undefined;
  const clicked = !loading && !!point && point !== startPoint;

  function ask(index: number) {
    setAnswer(null);
    setStep(index);
    setStartPoint(point);
    const next = questions[index];
    const shown = next?.landmark
      ? lesson.landmarks.find((l) => l.id === next.landmark)
      : undefined;
    if (next?.type === 'choice' && shown) onShow(shown.point);
  }
  function record(correct: boolean, choice?: number) {
    if (!question) return;
    setAnswer({ correct, choice });
    const all = [...results, { questionId: question.id, correct }];
    setResults(all);
    if (question.type === 'find' && target) onShow(target.point);
    if (all.length === questions.length) {
      const next = betterScore(best, score(all));
      setBest(next);
      saveScores({ ...savedScores(), [key]: next });
    }
  }

  if (!questions.length)
    return <p className="quiz-empty">This lesson has no questions yet.</p>;

  if (step < 0 || step >= questions.length) {
    const done = step >= questions.length;
    const final = score(results);
    return (
      <section className="quiz" aria-label="Quiz">
        {done ? (
          <output className="quiz-result">
            You got {final.correct} of {final.total} right.
          </output>
        ) : (
          <p>
            {questions.length} questions. For “find” questions, click the
            structure on a slice, then press Check.
          </p>
        )}
        {best && (
          <p className="quiz-best">
            Best in this browser: {best.correct} / {best.total}
          </p>
        )}
        <div className="quiz-actions">
          <button
            className="quiz-primary"
            onClick={() => {
              setResults([]);
              onStart();
              ask(0);
            }}
          >
            {done ? (
              <>
                <RotateCcw size={14} /> Try again
              </>
            ) : (
              'Start the quiz'
            )}
          </button>
          <button onClick={onExit}>Back to exploring</button>
        </div>
      </section>
    );
  }

  const q = question!;
  const review = q.type === 'choice' ? q.review : target?.review;
  return (
    <section className="quiz" aria-label="Quiz">
      <p className="quiz-progress">
        Question {step + 1} of {questions.length}
      </p>
      {review && <DraftBadge review={review} />}
      <h3>
        {q.type === 'find' ? (
          `Find the ${target?.name.replace(/ \((?:right|left)[^)]*\)$/, '').toLowerCase() ?? 'structure'}`
        ) : (
          <GlossaryText
            text={q.prompt[track] ?? ''}
            definitions={definitions}
          />
        )}
      </h3>
      {q.type === 'find' && target && /\(right/.test(target.name) && (
        <p className="quiz-hint">
          On the patient&apos;s right, which is the left of the screen.
        </p>
      )}

      {q.type === 'choice' && (
        <div className="quiz-options">
          {q.options.map((option, i) => (
            <button
              key={option}
              disabled={!!answer}
              aria-pressed={answer?.choice === i}
              className={
                answer && i === q.answer
                  ? 'right'
                  : answer?.choice === i
                    ? 'wrong'
                    : undefined
              }
              onClick={() => record(i === q.answer, i)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {q.type === 'find' && !answer && (
        <p className="quiz-hint">
          {loading
            ? 'Opening the lesson series…'
            : clicked
              ? 'Point placed. Press Check when you are sure.'
              : 'Click a slice to place the point.'}
        </p>
      )}

      {answer ? (
        <output
          className={`quiz-feedback ${answer.correct ? 'right' : 'wrong'}`}
        >
          {answer.correct ? <Check size={16} /> : <X size={16} />}
          <span>
            {answer.correct
              ? 'Correct.'
              : q.type === 'find'
                ? `Not quite. The marker now shows the ${target?.name ?? 'answer'}.`
                : `Not quite. The answer is: ${q.options[q.answer]}.`}{' '}
            {q.type === 'choice' && q.explanation?.[track] && (
              <GlossaryText
                text={q.explanation[track] ?? ''}
                definitions={definitions}
              />
            )}
          </span>
        </output>
      ) : null}

      <div className="quiz-actions">
        {!answer && q.type === 'find' && (
          <button
            className="quiz-primary"
            disabled={!clicked}
            onClick={() => target && record(findIsCorrect(point, target))}
          >
            Check
          </button>
        )}
        {!answer && <button onClick={() => record(false)}>Skip</button>}
        {answer && (
          <button className="quiz-primary" onClick={() => ask(step + 1)}>
            {step + 1 < questions.length ? 'Next question' : 'See the result'}
          </button>
        )}
      </div>
    </section>
  );
}
