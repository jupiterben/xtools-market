import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Registry } from './registry.js';

const require = createRequire(import.meta.url);
const iconNames: Record<string, string> = {
  json: 'braces', base64: 'binary', url: 'link', timestamp: 'clock',
  uuid: 'fingerprint', hash: 'hash', regex: 'regex', diff: 'file-diff',
};
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

async function icon(name: string): Promise<string> {
  const svg = await readFile(require.resolve(`lucide-static/icons/${name}.svg`), 'utf8');
  return `<span class="icon" aria-hidden="true">${svg}</span>`;
}

export async function renderHomepage(registry: Registry): Promise<string> {
  const [box, search, install, copy, github, arrow, shield, info, close] = await Promise.all(
    ['box', 'search', 'app-window', 'copy', 'git-fork', 'arrow-up-right', 'shield-check', 'info', 'x'].map(icon),
  );
  const categories = [...new Set([...registry.latest.values()].map(({ manifest }) => manifest.category))];
  const cards = await Promise.all([...registry.latest.values()].map(async (release) => {
    const tool = release.manifest;
    const versions = registry.catalog.releases.filter((entry) => entry.manifest.id === tool.id).length;
    const name = escapeHtml(tool.name);
    const keywords = escapeHtml(`${tool.name} ${tool.subtitle} ${tool.description} ${tool.tags.join(' ')}`.toLowerCase());
    return `<article class="tool-card" data-tool="${escapeHtml(tool.id)}" data-category="${escapeHtml(tool.category)}" data-search="${keywords}">
      <div class="card-top"><span class="tool-icon ${escapeHtml(tool.color)}">${await icon(iconNames[tool.id] ?? 'box')}</span>
        <button class="icon-button" type="button" data-detail="${escapeHtml(tool.id)}" data-name="${name}" data-sha="${release.sha256}" data-version="${escapeHtml(tool.version)}" data-bytes="${release.bytes}" data-versions="${versions}" title="${name}详情" aria-label="${name}详情" hidden>${info}</button>
      </div>
      <h2>${name}</h2><p class="subtitle">${escapeHtml(tool.subtitle)}</p>
      <p class="description">${escapeHtml(tool.description)}</p>
      <div class="tags">${tool.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="card-footer"><span class="version">v${escapeHtml(tool.version)}</span>
        <a class="install" data-install data-name="${name}" href="xtools://install?id=${encodeURIComponent(tool.id)}" aria-label="安装${name}">${install}安装</a>
      </div>
    </article>`;
  }));

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="XTools 官方工具市场，发现工具并在 XTools 客户端中安装。">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="color-scheme" content="light dark">
  <title>XTools 工具市场</title>
  <link rel="icon" type="image/png" href="./favicon.png">
  <link rel="stylesheet" href="./market.css">
  <script src="./market.js" defer></script>
</head>
<body data-market-home>
  <a class="skip-link" href="#main">跳到工具列表</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="./" aria-label="XTools 工具市场首页"><img src="./favicon.png" alt="" width="30" height="30"><span>XTools</span></a>
    <span class="nav-current">工具市场</span>
    <nav aria-label="项目链接">
      <a class="client-link" href="https://github.com/jupiterben/xtools/releases">客户端${arrow}</a>
      <a class="icon-button" href="https://github.com/jupiterben/xtools-market" title="GitHub 仓库" aria-label="GitHub 仓库">${github}</a>
    </nav>
  </div></header>
  <main id="main">
    <div class="page-heading"><div><h1>工具市场</h1><p>开发者的日常工具。</p></div><span class="trusted">${shield}官方发布</span></div>
    <div class="toolbar" data-controls hidden>
      <div class="search-field">${search}<input id="search" type="search" aria-label="搜索工具" placeholder="搜索工具…" autocomplete="off"></div>
      <select id="category" aria-label="工具分类"><option value="">全部分类</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select>
    </div>
    <div class="list-heading"><span id="result-count" role="status">${registry.latest.size} 款工具</span><span>本地运行 · 无需账号</span></div>
    <section class="tool-grid" aria-label="工具列表">${cards.join('\n')}</section>
    <div class="empty-state" id="empty" hidden>${search}<h2>没有找到匹配的工具</h2><button id="reset" class="button" type="button">重置筛选</button></div>
    <section class="source-section" aria-labelledby="source-heading">
      <div><h2 id="source-heading">市场源</h2><a href="./catalog.json">签名目录${arrow}</a></div>
      <div class="source-address"><code id="source-url">https://jupiterben.github.io/xtools-market/</code><button class="icon-button" id="copy-source" title="复制市场源" aria-label="复制市场源" hidden>${copy}</button></div>
      <p class="copy-status" id="copy-status" role="status"></p>
    </section>
    <footer><span>${box}XTools</span><a href="https://github.com/jupiterben/xtools-market/tree/main/tools">工具源码${arrow}</a></footer>
  </main>
  <dialog id="detail" aria-labelledby="detail-title">
    <div class="dialog-heading"><h2 id="detail-title">工具详情</h2><button class="icon-button" id="close-detail" type="button" title="关闭详情" aria-label="关闭详情">${close}</button></div>
    <p id="detail-description"></p>
    <dl><div><dt>版本</dt><dd id="detail-version"></dd></div><div><dt>包大小</dt><dd id="detail-size"></dd></div><div><dt>已发布版本</dt><dd id="detail-versions"></dd></div><div><dt>系统权限</dt><dd>无需系统权限</dd></div></dl>
    <label class="checksum-label" for="detail-sha">SHA-256</label><input id="detail-sha" readonly spellcheck="false">
    <div class="dialog-actions"><a id="detail-install" data-install class="install">${install}安装工具</a></div>
  </dialog>
  <dialog id="install-prompt" aria-labelledby="install-title" aria-describedby="install-message">
    <div class="dialog-heading"><h2 id="install-title">打开 XTools 客户端</h2><button class="icon-button" id="close-install" type="button" title="关闭安装提示" aria-label="关闭安装提示">${close}</button></div>
    <p id="install-message">请在浏览器提示中允许打开 XTools，然后在客户端确认安装 <strong id="install-name"></strong>。</p>
    <p class="install-help">未弹出提示？请确认已安装支持网页唤起的 XTools 客户端。</p>
    <div class="dialog-actions">
      <a class="button" href="https://github.com/jupiterben/xtools/releases" target="_blank" rel="noopener noreferrer">获取客户端${arrow}</a>
      <a id="retry-install" class="install">${install}再次打开</a>
    </div>
  </dialog>
</body></html>`;
}
