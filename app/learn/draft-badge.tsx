import type { Review } from '@/lib/lessons';

/** Every item shows whether a person has reviewed it. */
export default function DraftBadge({ review }: { review: Review }) {
  return review.status === 'draft' ? (
    <span className="draft-badge">Draft, not reviewed</span>
  ) : (
    <span className="reviewed-badge">
      Reviewed by {review.reviewer}, {review.role}
    </span>
  );
}
