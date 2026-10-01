// Generates app/light.css, the light theme, from the app's dark stylesheets.
//
// Every rule that sets a colour gets a light counterpart under
// html[data-theme='light'], with dark surfaces turned light and light text
// turned dark (and darkened until it reads at 5.5:1 on white). Anything
// inside an element marked `mri-stage` (the scan, its overlays, the intro
// video) keeps the dark original: medical images are read on black.
//
//   node scripts/light-theme.mjs          write app/light.css
//   node scripts/light-theme.mjs --check  fail if app/light.css is out of date
//
// Fix individual results in app/light-fixes.css, never in app/light.css.
import { readFileSync, writeFileSync } from 'node:fs';

export const SOURCES = [
  'app/globals.css',
  'app/workspace.css',
  'app/focus-timeline.css',
  'app/learn/learn.css',
];
const OUT = 'app/light.css';
const ROOT = "html[data-theme='light']";
const KEEP = ':not(.mri-stage):not(.mri-stage *)';

// ---------- colours ----------
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

export function parse(text) {
  if (text.startsWith('#')) {
    let h = text.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const [r, g, b, a = '1'] = text
    .replace(/rgba?\(|\)/g, '')
    .split(/[\s,/]+/)
    .filter(Boolean);
  return { r: +r, g: +g, b: +b, a: parseFloat(a) };
}
const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
export function format({ r, g, b, a }) {
  const base = `#${hex(r)}${hex(g)}${hex(b)}`;
  return a >= 1 ? base : `${base}${hex(a * 255)}`;
}
function toHsl({ r, g, b }) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h / 6, s, l };
}
function fromHsl({ h, s, l }, a) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a };
}
const channel = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = ({ r, g, b }) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const TEXT_TARGET = 5.5;

/** The light-theme counterpart of one colour in one role. */
export function lightColor(text, role) {
  const c = parse(text);
  const hsl = toHsl(c);
  if (role === 'bg' || role === 'scroll') {
    // Translucent black is a scrim over content; it stays a scrim.
    if (c.a < 0.6 && hsl.l < 0.1) return format(c);
    if (hsl.l >= 0.4) return format(c); // accents and coloured chips keep their colour
    return format(fromHsl({ ...hsl, l: 1 - hsl.l * 0.35 }, c.a));
  }
  if (role === 'border') {
    if (hsl.l >= 0.4) return format(c);
    return format(fromHsl({ ...hsl, l: 1 - hsl.l * 0.6 }, c.a));
  }
  // Text: keep what already reads on white, flip the rest, then make sure.
  // 5.5:1 on white leaves room for the tinted light panels (4.5:1 on them).
  if (contrast(c, WHITE) >= TEXT_TARGET) return format(c);
  // Light neutrals flip (white text becomes near-black); coloured text and
  // anything already close to readable darkens from its own shade.
  const flip = hsl.l > 0.45 && hsl.s < 0.25 && contrast(c, WHITE) < 3;
  let l = flip ? (1 - hsl.l) * 0.9 + 0.05 : Math.min(hsl.l, 0.6);
  let out = fromHsl({ ...hsl, l }, c.a);
  while (contrast(out, WHITE) < TEXT_TARGET && l > 0) {
    l = Math.max(0, l - 0.02);
    out = fromHsl({ ...hsl, l }, c.a);
  }
  return format(out);
}

function roleOf(prop) {
  if (prop.startsWith('--')) {
    if (/foreground/.test(prop)) return 'fg';
    if (/border|input/.test(prop)) return 'border';
    if (/primary|ring|electric|saffron|destructive/.test(prop)) return null;
    return 'bg';
  }
  if (prop.startsWith('background')) return 'bg';
  if (prop === 'scrollbar-color') return 'scroll';
  if (/^(border|outline|column-rule)/.test(prop)) return 'border';
  if (
    /^(color|caret-color|fill|stroke|text-decoration|text-decoration-color)$/.test(
      prop,
    )
  )
    return 'fg';
  return null; // shadows, filters, accent-color: unchanged
}

// ---------- a small CSS parser (the app's CSS has no braces in strings) ----------
function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Rules as { selector, declarations, media[] }, skipping keyframes and @theme. */
export function rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const walk = (from, to, media) => {
    let i = from;
    while (i < to) {
      const open = text.indexOf('{', i);
      const semi = text.indexOf(';', i);
      if (open === -1 || open >= to) return;
      if (semi !== -1 && semi < open) {
        i = semi + 1; // @import and similar
        continue;
      }
      let depth = 1;
      let close = open + 1;
      while (depth && close < to) {
        if (text[close] === '{') depth++;
        else if (text[close] === '}') depth--;
        close++;
      }
      const head = text.slice(i, open).trim();
      const body = text.slice(open + 1, close - 1);
      if (head.startsWith('@media') || head.startsWith('@supports'))
        walk(open + 1, close - 1, [...media, head]);
      else if (!head.startsWith('@'))
        out.push({ selector: head, declarations: splitTop(body, ';'), media });
      i = close;
    }
  };
  walk(0, text.length, []);
  return out;
}

function lightSelector(selector) {
  return splitTop(selector, ',')
    .map((s) => {
      if (/^(:root|html)\b/.test(s)) return s.replace(/^(:root|html)/, ROOT);
      if (s === '.dark') return ROOT;
      if (/^body\b/.test(s)) return `${ROOT} ${s}`;
      // :not() goes before the pseudo-element, which is always last (::before,
      // ::backdrop, ::-webkit-scrollbar-thumb:hover, ...).
      const pseudo = s.indexOf('::');
      const at = pseudo === -1 ? s.length : pseudo;
      return `${ROOT} ${s.slice(0, at)}${KEEP}${s.slice(at)}`;
    })
    .join(',\n');
}

export function generate(sources = SOURCES) {
  const blocks = [];
  const stageVars = [];
  for (const file of sources) {
    for (const rule of rules(readFileSync(file, 'utf8'))) {
      const changed = [];
      const keptBg = rule.declarations.some((d) => {
        const [prop, ...rest] = d.split(':');
        return (
          roleOf(prop.trim()) === 'bg' &&
          (rest.join(':').match(COLOR) || []).some(
            (c) =>
              lightColor(c, 'bg') === format(parse(c)) && parse(c).a >= 0.6,
          )
        );
      });
      for (const d of rule.declarations) {
        const colon = d.indexOf(':');
        if (colon < 0) continue;
        const prop = d.slice(0, colon).trim();
        const value = d.slice(colon + 1).trim();
        const role = roleOf(prop);
        if (!role || !COLOR.test(value)) continue;
        COLOR.lastIndex = 0;
        // Text on a coloured surface set in the same rule stays as designed.
        if (role === 'fg' && keptBg) continue;
        const next = value.replace(COLOR, (c) => lightColor(c, role));
        if (next !== value) changed.push(`  ${prop}: ${next};`);
        if (prop.startsWith('--') && /^(:root|\.dark)/.test(rule.selector))
          stageVars.push(`  ${prop}: ${value};`);
      }
      if (!changed.length) continue;
      let block = `${lightSelector(rule.selector)} {\n${changed.join('\n')}\n}`;
      for (const m of [...rule.media].reverse())
        block = `${m} {\n${block.replace(/^/gm, '  ')}\n}`;
      blocks.push(`/* ${file} */\n${block}`);
    }
  }
  // Inside the stage the dark design tokens apply again.
  const stage = `${ROOT} .mri-stage {\n${[...new Set(stageVars)].join('\n')}\n  color-scheme: dark;\n}`;
  return `/* Generated by scripts/light-theme.mjs from ${SOURCES.join(', ')}. Do not edit:\n   change the source CSS or the generator, then run node scripts/light-theme.mjs. */\n${ROOT} {\n  color-scheme: light;\n}\n${blocks.join('\n')}\n${stage}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const css = generate();
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== css) {
      console.error(
        'app/light.css is out of date: run node scripts/light-theme.mjs',
      );
      process.exit(1);
    }
    console.log('app/light.css is up to date');
  } else {
    writeFileSync(OUT, css);
    console.log(`Wrote ${OUT} (${css.split('\n').length} lines)`);
  }
}
