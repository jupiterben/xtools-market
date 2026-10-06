import copyIcon from 'lucide-static/icons/copy.svg?raw';
import undoIcon from 'lucide-static/icons/undo-2.svg?raw';
import clearIcon from 'lucide-static/icons/eraser.svg?raw';
import sampleIcon from 'lucide-static/icons/file-input.svg?raw';
import swapIcon from 'lucide-static/icons/arrow-left-right.svg?raw';
import refreshIcon from 'lucide-static/icons/refresh-cw.svg?raw';
import { PROTOCOL_VERSION } from './protocol';
import type { RunState } from './auto-run';

export const icons = { copy: copyIcon, undo: undoIcon, clear: clearIcon, sample: sampleIcon, swap: swapIcon, refresh: refreshIcon };
export function iconButton(id: string, label: string, icon: keyof typeof icons, disabled = false) {
  return `<button id="${id}" class="icon-button" type="button" title="${label}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${icons[icon]}</button>`;
}
export function segments(id: string, label: string, values: [string, string][], selected = values[0][0]) {
  return `<div class="segmented" id="${id}" role="group" aria-label="${label}">${values.map(([value, text]) =>
    `<button type="button" data-value="${value}" aria-pressed="${value === selected}">${text}</button>`).join('')}</div>`;
}
export function segmentValue(root: ParentNode, id: string) {
  return root.querySelector<HTMLButtonElement>(`#${id} [aria-pressed="true"]`)?.dataset.value ?? '';
}
export function setSegment(root: ParentNode, id: string, value: string) {
  for (const button of root.querySelectorAll<HTMLButtonElement>(`#${id} button`)) {
    button.setAttribute('aria-pressed', String(button.dataset.value === value));
  }
}
export function bindSegments(root: ParentNode, change: (id: string) => void) {
  for (const group of root.querySelectorAll<HTMLElement>('.segmented')) {
    group.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-value]');
      if (!button || button.disabled || button.getAttribute('aria-pressed') === 'true') return;
      setSegment(root, group.id, button.dataset.value!);
      change(group.id);
    });
  }
}

export function createUndo<T>(button: HTMLButtonElement, read: () => T, restore: (value: T) => void) {
  const history: T[] = [];
  button.onclick = () => {
    const value = history.pop();
    if (value !== undefined) restore(value);
    button.disabled = history.length === 0;
  };
  return () => {
    history.push(read());
    if (history.length > 10) history.shift();
    button.disabled = false;
  };
}

export function createResult(root: ParentNode, session: string) {
  const output = root.querySelector<HTMLTextAreaElement>('#output')!;
  const count = root.querySelector<HTMLElement>('#output-count')!;
  const state = root.querySelector<HTMLElement>('#result-state')!;
  const error = root.querySelector<HTMLElement>('#error')!;
  const copy = root.querySelector<HTMLButtonElement>('#copy')!;
  const copyStatus = root.querySelector<HTMLElement>('#copy-status')!;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  copy.onclick = async () => {
    if (copy.disabled) return;
    const current = revision;
    const value = output.value;
    let copied = false;
    // Opaque sandbox frames may not get Clipboard API access. Keep copying local to this user gesture.
    try {
      const previous = document.activeElement as HTMLElement | null;
      const start = output.selectionStart;
      const end = output.selectionEnd;
      output.focus({ preventScroll: true });
      output.select();
      copied = document.execCommand('copy');
      output.setSelectionRange(start, end);
      previous?.focus({ preventScroll: true });
    } catch { /* Try the modern API when the host grants access. */ }
    if (!copied) {
      try { await navigator.clipboard.writeText(value); copied = true; } catch { /* Display selectable output on denial. */ }
    }
    if (current !== revision) return;
    copyStatus.textContent = copied ? '已复制' : '复制受限，请手动复制已选结果';
    if (!copied) { output.focus(); output.select(); }
    clearTimeout(timer);
    timer = setTimeout(() => { if (current === revision) copyStatus.textContent = ''; }, 3000);
  };
  function update(result: RunState) {
    revision++;
    clearTimeout(timer);
    copyStatus.textContent = '';
    error.hidden = result.status !== 'error';
    error.textContent = result.status === 'error' ? result.error : '';
    output.value = result.output;
    copy.disabled = result.status !== 'done' || !result.output;
    count.textContent = `${result.output.length.toLocaleString()} 字符`;
    state.textContent = result.status === 'done' ? `${result.elapsed} ms`
      : result.status === 'error' ? '处理失败' : result.status === 'idle' ? '就绪' : '更新中';
    output.setAttribute('aria-busy', String(result.status === 'waiting' || result.status === 'running'));
    parent.postMessage({ type: 'xtools:result', protocol: PROTOCOL_VERSION, session, output: result.output }, '*');
  }
  return { update, output };
}
