import TransformWorker from '../shared/transform.worker?worker&inline';
import { PROTOCOL_VERSION } from '../shared/protocol';
import { createAutoRunner } from '../shared/auto-run';
import { bindSegments, createResult, createUndo, iconButton, segments, segmentValue } from '../shared/ui';
import { mergeRegexFlags, regexPresets } from './presets';
import '../shared/style.css';
import './style.css';

const root = document.querySelector<HTMLElement>('#tool')!;
let session = '';

function render() {
  root.classList.add('tool-workspace', 'regex-tool');
  root.innerHTML = `
    <section class="regex-expression" aria-label="正则设置">
      <div class="regex-heading">
        <label for="pattern">表达式</label>
        <div class="regex-flags" role="group" aria-label="正则标记">
          <label title="全局匹配"><input type="checkbox" value="g" checked disabled aria-label="g 全局匹配">g</label>
          <label title="忽略大小写"><input type="checkbox" value="i" aria-label="i 忽略大小写">i</label>
          <label title="多行锚点"><input type="checkbox" value="m" aria-label="m 多行锚点">m</label>
          <label title="点号匹配换行"><input type="checkbox" value="s" aria-label="s 点号匹配换行">s</label>
          <label title="Unicode 模式"><input type="checkbox" value="u" aria-label="u Unicode 模式">u</label>
        </div>
        <div class="commands">
          ${iconButton('undo', '撤销上次替换', 'undo', true)}
          ${iconButton('sample', '载入示例', 'sample')}
          ${iconButton('clear', '清空输入', 'clear')}
        </div>
      </div>
      <textarea id="pattern" aria-label="表达式" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <div class="regex-preset-bar">
        <span class="mode-label">常用表达式</span>
        ${segments('preset-mode', '预设应用方式', [['replace', '替换'], ['insert', '插入']])}
        <span id="preset-status" role="status"></span>
      </div>
      <div id="presets" role="group" aria-label="常用表达式"></div>
    </section>
    <div id="error" role="alert" hidden></div>
    <div class="editors">
      <section class="editor"><div class="editor-heading"><label for="input">输入</label><span id="input-count">0 字符</span></div><textarea id="input" spellcheck="false" aria-label="输入" placeholder="待匹配文本"></textarea></section>
      <section class="editor result"><div class="editor-heading"><label for="output">输出</label><div class="output-actions">
        <span id="result-state" role="status">就绪</span><span id="copy-status" role="status"></span>${iconButton('copy', '复制结果', 'copy', true)}
      </div></div><textarea id="output" spellcheck="false" readonly aria-label="输出"></textarea></section>
    </div>
    <div class="editor-footer"><span>RegExp / UTF-8</span><span id="output-count">0 字符</span></div>`;

  const pattern = root.querySelector<HTMLTextAreaElement>('#pattern')!;
  const input = root.querySelector<HTMLTextAreaElement>('#input')!;
  const status = root.querySelector<HTMLElement>('#preset-status')!;
  const flags = [...root.querySelectorAll<HTMLInputElement>('.regex-flags input')];
  const presets = root.querySelector<HTMLElement>('#presets')!;
  const names = ['邮箱', '网址', 'IPv4', '日期', '时间', '整数', '小数', '中文', 'UUID', '颜色', '空白', '空白行'];
  let selectedId = regexPresets[0].id;
  const getFlags = () => flags.filter((flag) => flag.checked).map((flag) => flag.value).join('');
  const setFlags = (value: string) => { for (const flag of flags) flag.checked = value.includes(flag.value); };
  for (const [index, item] of regexPresets.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = names[index];
    button.dataset.preset = item.id;
    button.setAttribute('aria-label', `使用${item.name}`);
    button.title = `${item.name} /${item.pattern}/${item.flags}`;
    presets.append(button);
  }
  const result = createResult(root, session);
  const runner = createAutoRunner({
    worker: () => new TransformWorker(),
    payload: () => ({ id: 'regex', input: input.value, secondary: pattern.value, mode: '', option: getFlags() }),
    ready: () => !!(input.value && pattern.value),
    update: (state) => {
      root.querySelector('#input-count')!.textContent = `${input.value.length.toLocaleString()} 字符`;
      for (const button of presets.querySelectorAll<HTMLButtonElement>('button')) {
        const item = regexPresets.find((preset) => preset.id === button.dataset.preset)!;
        button.setAttribute('aria-pressed', String(item.pattern === pattern.value && item.flags === getFlags()));
      }
      result.update(state);
    },
  });
  const remember = createUndo(root.querySelector<HTMLButtonElement>('#undo')!,
    () => ({ pattern: pattern.value, input: input.value, flags: getFlags(), selectedId }),
    (previous) => {
      pattern.value = previous.pattern;
      input.value = previous.input;
      setFlags(previous.flags);
      selectedId = previous.selectedId;
      status.textContent = '';
      runner.schedule(true);
    });
  bindSegments(root, () => {});
  presets.onclick = (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-preset]');
    const item = regexPresets.find((preset) => preset.id === button?.dataset.preset);
    if (!item) return;
    remember();
    selectedId = item.id;
    const replace = segmentValue(root, 'preset-mode') === 'replace';
    pattern.setRangeText(item.pattern, replace ? 0 : pattern.selectionStart, replace ? pattern.value.length : pattern.selectionEnd, 'end');
    setFlags(replace ? item.flags : mergeRegexFlags(getFlags(), item.flags));
    status.textContent = `${replace ? '已替换' : '已插入'}：${names[regexPresets.indexOf(item)]}`;
    pattern.focus({ preventScroll: true });
    runner.schedule(true);
  };
  root.querySelector<HTMLButtonElement>('#sample')!.onclick = () => {
    remember();
    const item = regexPresets.find((preset) => preset.id === selectedId)!;
    pattern.value = item.pattern;
    setFlags(item.flags);
    input.value = item.sample;
    status.textContent = '';
    runner.schedule(true);
  };
  root.querySelector<HTMLButtonElement>('#clear')!.onclick = () => {
    remember();
    input.value = '';
    status.textContent = '';
    runner.cancel();
    input.focus();
  };
  runner.watch(pattern);
  runner.watch(input);
  for (const flag of flags) flag.onchange = () => runner.schedule(true);
  for (const field of [pattern, input]) field.addEventListener('input', () => status.textContent = '');
  root.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      runner.schedule(true);
    }
  });
  pattern.value = regexPresets[0].pattern;
  setFlags(regexPresets[0].flags);
  runner.schedule(true);
  input.focus({ preventScroll: true });
}

window.addEventListener('message', (event) => {
  if (event.source !== parent || !event.data || event.data.protocol !== PROTOCOL_VERSION) return;
  if (event.data.type === 'xtools:init' && !session && typeof event.data.session === 'string'
    && event.data.toolId === __TOOL_ID__ && event.data.toolId === 'regex') {
    session = event.data.session;
    document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
    render();
  }
  if (event.data.type === 'xtools:theme' && event.data.session === session) {
    document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
  }
});
