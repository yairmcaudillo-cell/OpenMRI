import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { contrast, lightColor, parse, rules } from '../scripts/light-theme.mjs';

const WHITE = parse('#ffffff');

test('app/light.css is generated from the current stylesheets', () => {
  const r = spawnSync(
    process.execPath,
    ['scripts/light-theme.mjs', '--check'],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, r.stderr);
});

test('dark surfaces turn light; scrims and accent surfaces stay', () => {
  assert.equal(lightColor('#000', 'bg'), '#ffffff');
  assert.ok(contrast(parse(lightColor('#130d1e', 'bg')), WHITE) < 1.1);
  assert.equal(lightColor('rgba(0, 0, 0, 0.55)', 'bg'), '#0000008c');
  assert.equal(lightColor('#8052ff', 'bg'), '#8052ff');
});

test('every text colour reads at 4.6:1 or better on white after mapping', () => {
  for (const c of [
    '#fff',
    '#aaa',
    '#777',
    '#999',
    '#c1aaff',
    '#ffcf6b',
    '#8052ff',
    '#a8f0c8',
    '#ffb3a1',
    '#e8d9b5',
  ])
    assert.ok(
      contrast(parse(lightColor(c, 'fg')), WHITE) >= 4.6,
      `${c} -> ${lightColor(c, 'fg')}`,
    );
});

test('the parser reads media blocks and skips keyframes', () => {
  const found = rules(
    '@keyframes spin{to{color:#fff}} .a{color:#fff} @media (max-width: 9px){.b::before{background:#000}}',
  );
  assert.deepEqual(
    found.map((r) => [r.selector, r.media]),
    [
      ['.a', []],
      ['.b::before', ['@media (max-width: 9px)']],
    ],
  );
});
