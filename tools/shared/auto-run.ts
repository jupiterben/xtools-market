import type { ToolInput } from './transforms.js';

export type RunState =
  | { status: 'idle' | 'waiting' | 'running'; output: '' }
  | { status: 'done'; output: string; elapsed: number }
  | { status: 'error'; output: ''; error: string };

export function createAutoRunner(options: {
  worker: () => Worker;
  payload: () => ToolInput;
  ready: () => boolean;
  update: (state: RunState) => void;
  delay?: number;
  timeout?: number;
}) {
  let worker: Worker | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  const composing = new Set<EventTarget>();

  function stop() {
    revision++;
    clearTimeout(debounce);
    clearTimeout(deadline);
    worker?.terminate();
    worker = undefined;
  }
  function cancel() {
    stop();
    options.update({ status: 'idle', output: '' });
  }
  function schedule(immediate = false) {
    cancel();
    if (composing.size || !options.ready()) return;
    const request = revision;
    options.update({ status: 'waiting', output: '' });
    const execute = () => {
      if (request !== revision) return;
      const started = performance.now();
      const fail = (error: string) => {
        if (request !== revision) return;
        stop();
        options.update({ status: 'error', output: '', error });
      };
      try {
        const payload = options.payload();
        if (payload.input.length > 200_000 || payload.secondary.length > 200_000) {
          fail('单次输入不能超过 200,000 个字符');
          return;
        }
        options.update({ status: 'running', output: '' });
        worker = options.worker();
        deadline = setTimeout(() => fail('处理超时，已停止任务。请缩小输入范围或检查表达式。'), options.timeout ?? 1800);
        worker.onmessage = (event: MessageEvent<{ output?: string; error?: string }>) => {
          if (request !== revision) return;
          if (event.data.error) { fail(event.data.error); return; }
          stop();
          options.update({ status: 'done', output: event.data.output ?? '', elapsed: Math.round(performance.now() - started) });
        };
        worker.onerror = () => fail('工具运行失败，请重试');
        worker.postMessage(payload);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    };
    if (immediate) execute();
    else debounce = setTimeout(execute, options.delay ?? 250);
  }
  function watch(input: HTMLTextAreaElement | HTMLInputElement) {
    input.addEventListener('compositionstart', () => { composing.add(input); cancel(); });
    input.addEventListener('compositionend', () => { composing.delete(input); schedule(); });
    input.addEventListener('input', (event) => {
      if ((event as InputEvent).isComposing || composing.has(input)) { cancel(); return; }
      schedule();
    });
  }
  return { schedule, cancel, watch };
}
