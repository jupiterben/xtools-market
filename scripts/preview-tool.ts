import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRegistry } from '../src/registry.js';
import { escapeHtml } from '../src/homepage.js';

const id = process.argv[2] ?? 'regex';
const registry = await loadRegistry('registry');
if (id === 'all') {
  const releases = [...registry.latest.values()];
  const tools = releases.map((release) => ({
    id: release.manifest.id, name: release.manifest.name, version: release.manifest.version,
    html: registry.packages.get(release.sha256)!.toString('utf8'),
  }));
  const favicon = (await readFile('web/favicon.png')).toString('base64');
  const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>XTools 工具预览</title>
<style>
*{box-sizing:border-box;letter-spacing:0}html,body{margin:0;height:100%;font:13px "Segoe UI","Microsoft YaHei",sans-serif;color:#262c30;background:#fff}
body{display:flex;flex-direction:column}header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid #e3e7eb;min-height:52px}
.brand{display:flex;align-items:center;gap:8px;font-weight:600}select{min-height:34px;max-width:180px;padding:4px 8px;font:inherit;background:inherit;color:inherit;border:1px solid #c8ced3;border-radius:4px}
header span:last-child{font-size:12px;color:#687179}main{flex:1;min-height:0}iframe{display:block;width:100%;height:100%;border:0}[hidden]{display:none!important}
@media(prefers-color-scheme:dark){html,body{background:#1c1e20;color:#e4e7e9}header{border-color:#373c40}select{background:#25292d}header span:last-child{color:#a5adb5}}
</style></head><body>
<header><span class="brand"><img src="data:image/png;base64,${favicon}" alt="" width="24" height="24">XTools</span>
<select id="tool-select" aria-label="选择工具">${tools.map((tool) => `<option value="${escapeHtml(tool.id)}">${escapeHtml(tool.name)}</option>`).join('')}</select>
<span id="version"></span></header><main id="frames"></main>
<script>
const tools = ${JSON.stringify(tools).replace(/</g, '\\u003c')};
const theme = matchMedia('(prefers-color-scheme: dark)');
const frames = new Map();
const session = 'local-tool-preview';
const select = document.getElementById('tool-select');
function showTool() {
  const tool = tools.find(item => item.id === select.value);
  for (const frame of frames.values()) frame.hidden = true;
  let frame = frames.get(tool.id);
  if (!frame) {
    frame = document.createElement('iframe');
    frame.title = tool.name;
    frame.setAttribute('sandbox','allow-scripts');
    frame.referrerPolicy = 'no-referrer';
    frame.onload = () => frame.contentWindow.postMessage({ type:'xtools:init',protocol:1,session,toolId:tool.id,theme:theme.matches?'dark':'light' },'*');
    frames.set(tool.id,frame);
    document.getElementById('frames').append(frame);
    frame.srcdoc = tool.html;
  }
  frame.hidden = false;
  document.getElementById('version').textContent = 'v' + tool.version;
}
select.onchange = showTool;
theme.addEventListener('change', () => {
  for(const frame of frames.values()) frame.contentWindow.postMessage({type:'xtools:theme',protocol:1,session,theme:theme.matches?'dark':'light'},'*');
});
showTool();
</script></body></html>`;
  await mkdir('.build', { recursive: true });
  const path = resolve('.build', 'preview-tools.html');
  await writeFile(path, page);
  console.log(`Verified all-tool preview: ${path}`);
} else {
const release = registry.latest.get(id);
if (!release) throw new Error(`Unknown tool: ${id}`);
const html = registry.packages.get(release.sha256)!.toString('utf8');
const page = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(release.manifest.name)} ${escapeHtml(release.manifest.version)}</title>
<style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style></head>
<body><iframe id="tool" title="${escapeHtml(release.manifest.name)}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
<script>
const frame = document.getElementById('tool');
const session = 'local-tool-preview';
const theme = matchMedia('(prefers-color-scheme: dark)');
frame.onload = () => frame.contentWindow.postMessage({ type: 'xtools:init', protocol: 1, session,
  toolId: ${JSON.stringify(id)}, theme: theme.matches ? 'dark' : 'light' }, '*');
theme.addEventListener('change', () => frame.contentWindow.postMessage({
  type: 'xtools:theme', protocol: 1, session, theme: theme.matches ? 'dark' : 'light'
}, '*'));
frame.srcdoc = ${JSON.stringify(html).replace(/</g, '\\u003c')};
</script></body></html>`;
await mkdir('.build', { recursive: true });
const path = resolve('.build', `preview-${id}.html`);
await writeFile(path, page);
console.log(`Verified local preview (${id}@${release.manifest.version}): ${path}`);
}
