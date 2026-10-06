import TransformWorker from './transform.worker?worker&inline';
import { PROTOCOL_VERSION, type ToolId } from './protocol';
import { createAutoRunner } from './auto-run';
import { bindSegments, createResult, createUndo, iconButton, icons, segments, segmentValue, setSegment } from './ui';
import './style.css';

const samples: Record<Exclude<ToolId, 'regex'>, string> = {
  json: '{"project":"XTools","tools":["JSON","Base64","Timestamp"],"localFirst":true}',
  base64: '你好，开发者。Hello, developer.',
  url: 'https://example.com/search?q=开发者工具&sort=recent',
  timestamp: '',
  uuid: '5',
  hash: 'Hello, XTools!',
  diff: '{\n  "name": "xtools",\n  "version": "0.1.0"\n}',
};
const root = document.querySelector<HTMLElement>('#tool')!;
let session = '';

function render(toolId: Exclude<ToolId, 'regex'>) {
  const codec = toolId === 'base64' || toolId === 'url';
  root.classList.add('tool-workspace', `tool-${toolId}`);
  root.innerHTML = `
    <div class="toolbar">
      <div class="options"></div>
      <div class="commands">
        ${iconButton('undo', '撤销上次替换', 'undo', true)}
        ${iconButton('sample', toolId === 'timestamp' ? '当前时间' : '载入示例', 'sample')}
        ${iconButton('clear', '清空输入', 'clear')}
      </div>
    </div>
    <div id="error" role="alert" hidden></div>
    <div class="editors ${toolId === 'diff' ? 'three-columns' : ''} ${toolId === 'uuid' ? 'output-only' : ''}">
      <section class="editor input-editor" ${toolId === 'uuid' ? 'hidden' : ''}>
        <div class="editor-heading"><label for="input">输入</label><span id="input-count">0 字符</span></div>
        <textarea id="input" spellcheck="false" aria-label="输入" autocapitalize="off" placeholder="${toolId === 'json' ? '{ &quot;key&quot;: &quot;value&quot; }' : toolId === 'timestamp' ? '时间戳或日期' : '待处理文本'}"></textarea>
      </section>
      <section class="editor" id="secondary-editor" ${toolId !== 'diff' ? 'hidden' : ''}>
        <div class="editor-heading"><label for="secondary">对比文本</label>${toolId === 'diff' ? iconButton('swap', '交换两段文本', 'swap') : ''}</div>
        <textarea id="secondary" spellcheck="false" aria-label="对比文本"></textarea>
      </section>
      <section class="editor result">
        <div class="editor-heading"><label for="output">输出</label><div class="output-actions">
          <span id="result-state" role="status">就绪</span><span id="copy-status" role="status"></span>
          ${codec ? iconButton('swap', '反向转换', 'swap', true) : ''}
          ${iconButton('copy', '复制结果', 'copy', true)}
        </div></div>
        <textarea id="output" spellcheck="false" readonly aria-label="输出"></textarea>
      </section>
    </div>
    <div class="editor-footer"><span>${toolId === 'json' ? 'JSON' : 'TEXT'} / UTF-8</span><span id="output-count">0 字符</span></div>`;
  const options = root.querySelector<HTMLElement>('.options')!;
  const input = root.querySelector<HTMLTextAreaElement>('#input')!;
  const secondary = root.querySelector<HTMLTextAreaElement>('#secondary')!;
  const count = root.querySelector<HTMLElement>('#input-count')!;
  const undoButton = root.querySelector<HTMLButtonElement>('#undo')!;
  const sampleButton = root.querySelector<HTMLButtonElement>('#sample')!;
  const swapButton = root.querySelector<HTMLButtonElement>('#swap');
  if (toolId === 'json') {
    options.innerHTML = segments('mode', 'JSON 操作', [['format', '格式化'], ['compact', '压缩']])
      + segments('option', '缩进', [['2', '2 空格'], ['4', '4 空格']]);
  } else if (codec) {
    options.innerHTML = segments('mode', '转换方向', [['encode', '编码'], ['decode', '解码']]);
  } else if (toolId === 'hash') {
    options.innerHTML = segments('option', '哈希算法', [['SHA-256', 'SHA-256'], ['SHA-384', 'SHA-384'], ['SHA-512', 'SHA-512']]);
  } else if (toolId === 'timestamp') {
    options.innerHTML = segments('option', '时间戳单位', [['auto', '自动'], ['seconds', '秒'], ['milliseconds', '毫秒']]);
  } else if (toolId === 'uuid') {
    options.innerHTML = `<label class="select-label" for="quantity">数量<input id="quantity" type="number" min="1" max="100" step="1" value="5" aria-label="生成数量"></label>
      ${segments('quantity-presets', '快捷数量', [['1', '1'], ['5', '5'], ['10', '10'], ['20', '20'], ['100', '100']], '5')}
      <button id="generate" class="primary" type="button">${icons.refresh}重新生成</button>`;
    sampleButton.hidden = true;
  } else {
    options.innerHTML = '<span class="mode-label">逐行对比</span>';
  }
  const quantity = root.querySelector<HTMLInputElement>('#quantity');
  const result = createResult(root, session);
  const value = (id: string) => segmentValue(root, id);
  function updateControls() {
    count.textContent = `${input.value.length.toLocaleString()} 字符`;
    if (quantity) setSegment(root, 'quantity-presets', quantity.value);
    for (const button of root.querySelectorAll<HTMLButtonElement>('#option button')) {
      button.disabled = toolId === 'json' && value('mode') === 'compact';
    }
  }
  const runner = createAutoRunner({
    worker: () => new TransformWorker(),
    ready: () => toolId === 'diff' ? !!(input.value || secondary.value)
      : toolId === 'uuid' ? quantity!.value !== '' : input.value !== '',
    payload: () => ({
      id: toolId, input: quantity?.value ?? input.value, secondary: secondary.value, mode: value('mode'), option: value('option'),
    }),
    update: (state) => {
      updateControls();
      result.update(state);
      if (codec && swapButton) swapButton.disabled = state.status !== 'done' || !state.output;
    },
  });
  const remember = createUndo(undoButton,
    () => ({ input: input.value, secondary: secondary.value, quantity: quantity?.value, output: result.output.value, mode: value('mode'), option: value('option') }),
    (previous) => {
      input.value = previous.input;
      secondary.value = previous.secondary;
      if (quantity) quantity.value = previous.quantity ?? '5';
      setSegment(root, 'mode', previous.mode);
      setSegment(root, 'option', previous.option);
      if (quantity && previous.output) {
        runner.cancel();
        result.update({ status: 'done', output: previous.output, elapsed: 0 });
      } else runner.schedule(true);
    });
  runner.watch(input);
  runner.watch(secondary);
  if (quantity) runner.watch(quantity);
  bindSegments(root, (id) => {
    if (id === 'quantity-presets' && quantity) quantity.value = value(id);
    runner.schedule(true);
  });
  if (swapButton) swapButton.onclick = () => {
    remember();
    if (codec) {
      input.value = result.output.value;
      setSegment(root, 'mode', value('mode') === 'encode' ? 'decode' : 'encode');
    } else {
      [input.value, secondary.value] = [secondary.value, input.value];
    }
    runner.schedule(true);
  };
  sampleButton.onclick = () => {
    remember();
    const sample = samples[toolId];
    input.value = toolId === 'timestamp'
      ? String(value('option') === 'milliseconds' ? Date.now() : Math.floor(Date.now() / 1000))
      : codec && value('mode') === 'decode'
        ? toolId === 'url' ? encodeURIComponent(sample) : btoa(Array.from(new TextEncoder().encode(sample), (byte) => String.fromCharCode(byte)).join(''))
        : sample;
    if (toolId === 'diff') secondary.value = '{\n  "name": "xtools",\n  "version": "0.2.0",\n  "private": true\n}';
    runner.schedule(true);
  };
  root.querySelector<HTMLButtonElement>('#clear')!.onclick = () => {
    remember();
    input.value = '';
    secondary.value = '';
    if (quantity) quantity.value = '';
    runner.cancel();
    (quantity ?? input).focus();
  };
  root.querySelector<HTMLButtonElement>('#generate')?.addEventListener('click', () => runner.schedule(true));
  root.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      runner.schedule(true);
    }
  });
  if (toolId === 'timestamp') input.value = String(Math.floor(Date.now() / 1000));
  runner.schedule(true);
  (quantity ?? input).focus({ preventScroll: true });
}

window.addEventListener('message', (event) => {
  if (event.source !== parent || !event.data || event.data.protocol !== PROTOCOL_VERSION) return;
  if (event.data.type === 'xtools:init' && !session && typeof event.data.session === 'string'
    && event.data.toolId === __TOOL_ID__ && Object.hasOwn(samples, event.data.toolId)) {
    session = event.data.session;
    document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
    render(event.data.toolId);
  }
  if (event.data.type === 'xtools:theme' && event.data.session === session) {
    document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
  }
});
