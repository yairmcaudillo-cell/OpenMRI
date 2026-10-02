import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lightColor } from '../scripts/light-theme.mjs';

// WCAG 2.2 contrast for learning mode. Each pair is foreground on background
// as used in app/learn/learn.css; text needs 4.5:1, focus rings and control
// borders 3:1. Every colour must still appear in the stylesheet, so a colour
// change fails here until the pair is re-checked.
const css = fs.readFileSync(
  new URL('../app/learn/learn.css', import.meta.url),
  'utf8',
);
const panel = '#000000'; // .side-panel background (workspace.css)
const text = [
  ['panel text', '#aaaaaa', panel],
  ['landmark list', '#cccccc', panel],
  ['lesson meta (10 px)', '#999999', panel],
  ['track switch', '#aaaaaa', panel],
  ['track switch, selected', '#ffffff', '#2a1d4a'],
  ['notice', '#e8d9b5', '#120e05'],
  ['back link', '#b79dff', panel],
  ['draft badge', '#ffcf6b', '#1a1305'],
  ['reviewed badge', '#a8f0c8', '#08170f'],
  ['glossary term', '#d9ccff', panel],
  ['glossary definition', '#dddddd', '#140e20'],
  ['right answer', '#cff5df', '#08170f'],
  ['wrong answer', '#ffd6cc', '#1c0b07'],
  ['answer mark, wrong', '#ffb3a1', '#1c0b07'],
  ['primary button', '#ffffff', '#8052ff'],
  ['error', '#ffb3a1', panel],
];
const nonText = [
  ['focus ring', '#b79dff', panel],
  ['draft badge border', '#ffb829', '#1a1305'],
  ['right answer border', '#5fbf8f', '#08170f'],
  ['wrong answer border', '#ff8a70', '#1c0b07'],
];

const channel = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const short = (hex) =>
  /^#(.)\1(.)\2(.)\3$/.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
const inCss = (hex) =>
  hex === panel || css.includes(hex) || css.includes(short(hex));

test('the contrast formula matches known values', () => {
  assert.equal(Math.round(ratio('#ffffff', '#000000')), 21);
  assert.ok(Math.abs(ratio('#777777', '#ffffff') - 4.48) < 0.01);
});

test('learning-mode text meets 4.5:1', () => {
  for (const [name, fg, bg] of text) {
    assert.ok(
      inCss(fg) && inCss(bg),
      `${name}: ${fg} on ${bg} is not in learn.css`,
    );
    assert.ok(ratio(fg, bg) >= 4.5, `${name}: ${ratio(fg, bg).toFixed(2)}:1`);
  }
});

test('focus rings and state borders meet 3:1', () => {
  for (const [name, fg, bg] of nonText) {
    assert.ok(
      inCss(fg) && inCss(bg),
      `${name}: ${fg} on ${bg} is not in learn.css`,
    );
    assert.ok(ratio(fg, bg) >= 3, `${name}: ${ratio(fg, bg).toFixed(2)}:1`);
  }
});

test('the same pairs meet 4.5:1 in the light theme (app/light.css)', () => {
  for (const [name, fg, bg] of text) {
    // Text on an accent surface keeps its colour; dark surfaces turn light.
    const lightBg = lightColor(bg, 'bg');
    const lightFg = lightBg === bg && bg !== panel ? fg : lightColor(fg, 'fg');
    assert.ok(
      ratio(lightFg, lightBg) >= 4.5,
      `${name}: ${lightFg} on ${lightBg} is ${ratio(lightFg, lightBg).toFixed(2)}:1`,
    );
  }
});
