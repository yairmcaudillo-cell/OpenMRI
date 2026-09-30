'use client';
import { useId } from 'react';
import { parseGlossaryText } from '@/lib/lessons';
import { GLOSSARY } from '@/lib/lesson-catalog';

/**
 * Lesson text with glossary links. A linked term is a button that shows its
 * definition on hover and on keyboard focus, and hides it on Escape
 * (WCAG 1.4.13). With definitions off, the text reads plainly.
 */
export default function GlossaryText({
  text,
  definitions,
}: {
  text: string;
  definitions: boolean;
}) {
  const base = useId();
  return (
    <>
      {parseGlossaryText(text).map((part, i) => {
        const entry = part.term ? GLOSSARY.get(part.term) : undefined;
        if (!definitions || !entry) return <span key={i}>{part.text}</span>;
        const id = `${base}-${i}`;
        return (
          <span key={i} className="glossary">
            <button
              type="button"
              className="glossary-term"
              aria-describedby={id}
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.currentTarget.blur();
              }}
            >
              {part.text}
            </button>
            <span role="tooltip" id={id} className="glossary-tip">
              <strong>{entry.term}</strong> {entry.definition}
            </span>
          </span>
        );
      })}
    </>
  );
}
