import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoRunner, type RunState } from '../tools/shared/auto-run.js';
import { transform, type ToolInput } from '../tools/shared/transforms.js';

function setup() {
  const states: RunState[] = [];
  const workers: { terminated: boolean; onmessage?: (event: { data: { output?: string; error?: string } }) => void; onerror?: () => void; posted?: ToolInput }[] = [];
  let input = 'one';
  const runner = createAutoRunner({
    ready: () => !!input,
    payload: () => ({ id: 'json', input, secondary: '', mode: '', option: '' }),
    update: (state) => states.push(state),
    worker: () => {
      const worker = {
        terminated: false,
        onmessage: undefined as undefined | ((event: { data: { output?: string; error?: string } }) => void),
        onerror: undefined as undefined | (() => void),
        posted: undefined as ToolInput | undefined,
        postMessage(payload: ToolInput) { this.posted = payload; },
        terminate() { this.terminated = true; },
      };
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  return { runner, workers, states, setInput: (value: string) => { input = value; } };
}

test('typing is debounced; only the latest input is submitted', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runner, workers, setInput } = setup();
  runner.schedule();
  t.mock.timers.tick(200);
  setInput('two');
  runner.schedule();
  t.mock.timers.tick(200);
  assert.equal(workers.length, 0);
  t.mock.timers.tick(50);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].posted?.input, 'two');
  runner.cancel();
});

test('superseded workers cannot publish results or errors', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runner, workers, states, setInput } = setup();
  runner.schedule(true);
  setInput('two');
  runner.schedule(true);
  assert.equal(workers[0].terminated, true);
  workers[1].onmessage!({ data: { output: 'two-result' } });
  workers[0].onmessage!({ data: { output: 'stale' } });
  workers[0].onerror!();
  assert.equal(states.at(-1)?.output, 'two-result');
  t.mock.timers.tick(3000);
  assert.equal(states.at(-1)?.status, 'done');
});

test('empty inputs cancel work, timeout stops without retry loops, next edit recovers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runner, workers, states, setInput } = setup();
  runner.schedule();
  setInput('');
  runner.schedule();
  t.mock.timers.tick(2000);
  assert.equal(workers.length, 0);
  setInput('next');
  runner.schedule(true);
  t.mock.timers.tick(1800);
  assert.equal(workers[0].terminated, true);
  assert.equal(states.at(-1)?.status, 'error');
  t.mock.timers.tick(9000);
  assert.equal(workers.length, 1);
  runner.schedule(true);
  workers[1].onmessage!({ data: { output: 'recovered' } });
  assert.equal(states.at(-1)?.output, 'recovered');
});

test('composition defers processing even across option changes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runner, workers } = setup();
  const input = new EventTarget();
  runner.watch(input as HTMLInputElement);
  input.dispatchEvent(new Event('compositionstart'));
  input.dispatchEvent(new Event('input'));
  runner.schedule(true);
  t.mock.timers.tick(1000);
  assert.equal(workers.length, 0);
  input.dispatchEvent(new Event('compositionend'));
  input.dispatchEvent(new Event('input'));
  t.mock.timers.tick(250);
  assert.equal(workers.length, 1);
  runner.cancel();
});

test('oversized input never starts a worker', () => {
  const { runner, workers, states, setInput } = setup();
  setInput('x'.repeat(200001));
  runner.schedule(true);
  assert.equal(workers.length, 0);
  assert.equal(states.at(-1)?.status, 'error');
});

test('timestamp auto mode handles common seconds/milliseconds with explicit overrides', async () => {
  const run = (input: string, option: string) => transform({ id: 'timestamp', input, option, secondary: '', mode: '' });
  assert.match(await run('1700000000', 'auto'), /2023-11-14T22:13:20.000Z/);
  assert.match(await run('1700000000000', 'auto'), /2023-11-14T22:13:20.000Z/);
  assert.match(await run('0', 'auto'), /1970-01-01T00:00:00.000Z/);
  assert.match(await run('-1', 'seconds'), /1969-12-31T23:59:59.000Z/);
  assert.match(await run('1000', 'milliseconds'), /1970-01-01T00:00:01.000Z/);
  assert.match(await run('2026-09-30T12:00:00Z', 'auto'), /2026-09-30T12:00:00.000Z/);
});
