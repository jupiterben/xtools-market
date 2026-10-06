import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRegexFlags, regexPresets } from '../tools/regex/presets.js';
import { transform } from '../tools/shared/transforms.js';

test('each preset compiles and matches its own example in the tool engine', async () => {
  assert.equal(regexPresets.length, 12);
  assert.equal(new Set(regexPresets.map((preset) => preset.id)).size, regexPresets.length);
  for (const preset of regexPresets) {
    assert.ok(preset.flags.includes('g'));
    const result = await transform({ id: 'regex', input: preset.sample, secondary: preset.pattern, option: preset.flags, mode: '' });
    const matches = JSON.parse(result);
    assert.ok(matches.length > 0, preset.id);
    assert.ok(matches.length < 1000, preset.id);
    assert.ok(matches.every((match: { index: number; match: string }) =>
      preset.sample.slice(match.index, match.index + match.match.length) === match.match));
  }
});

test('bounded presets reject invalid segments without matching valid-looking suffixes', () => {
  const cases: Record<string, string[]> = {
    ipv4: ['256.1.2.3', '999.192.168.1.1', '01.2.3.4', '1.2.3.4.5', 'a127.0.0.1'],
    date: ['2026-13-01', '2026-00-20', '2026-01-32'],
    time: ['24:00:00', '12:60:00', '12:00:60'],
    uuid: ['550e8400-e29b-11d4-a716-446655440000'],
    'hex-color': ['#ffff', '#1234567', '#ggg', '#123xyz'],
    integer: ['12.34', 'v12', '++12', '12abc'],
    decimal: ['v1.23', '1.2.3', '++1.25'],
  };
  for (const [id, inputs] of Object.entries(cases)) {
    const preset = regexPresets.find((item) => item.id === id)!;
    for (const input of inputs) assert.equal(new RegExp(preset.pattern, preset.flags).test(input), false, `${id}: ${input}`);
  }
});

test('inserting a preset preserves existing flags and adds required Unicode or multiline flags', () => {
  assert.equal(mergeRegexFlags('gim', 'gu'), 'gimu');
  assert.equal(mergeRegexFlags('gsu', 'gi'), 'gisu');
  assert.equal(mergeRegexFlags('g', 'g'), 'g');
});
