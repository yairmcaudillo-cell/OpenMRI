import type { ImgHTMLAttributes } from 'react';

/**
 * Stand-in for next/image in the online build, which has no Next-style
 * framework. Only Focus over time uses it (with `unoptimized`), and that panel
 * is not offered online; this keeps the viewer compiling unchanged.
 */
export default function Image({
  unoptimized: _unoptimized,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  // oxlint-disable-next-line nextjs/no-img-element -- this is the replacement
  return <img {...props} alt={props.alt ?? ''} />;
}
