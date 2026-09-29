const cards = [...document.querySelectorAll('[data-tool]')];
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty');
const source = new URL('./', location.href).href;
document.querySelector('#source-url').textContent = source;
document.querySelector('[data-controls]').hidden = false;

function filter() {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  for (const card of cards) {
    card.hidden = !(card.dataset.search.includes(term) && (!category.value || card.dataset.category === category.value));
    if (!card.hidden) visible++;
  }
  count.textContent = `${visible} 款工具`;
  empty.hidden = visible !== 0;
}
search.addEventListener('input', filter);
category.addEventListener('change', filter);
document.querySelector('#reset').addEventListener('click', () => {
  search.value = '';
  category.value = '';
  filter();
  search.focus();
});
const copyButton = document.querySelector('#copy-source');
copyButton.hidden = false;
copyButton.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(source);
    status.textContent = '市场源已复制';
  } catch {
    status.textContent = '无法访问剪贴板，请选择上方地址复制。';
  }
});

const dialog = document.querySelector('#detail');
for (const button of document.querySelectorAll('[data-detail]')) {
  button.hidden = false;
  button.addEventListener('click', () => {
    document.querySelector('#detail-title').textContent = button.dataset.name;
    document.querySelector('#detail-description').textContent = button.closest('article').querySelector('.description').textContent;
    document.querySelector('#detail-version').textContent = `v${button.dataset.version}`;
    document.querySelector('#detail-size').textContent = `${(Number(button.dataset.bytes) / 1024).toFixed(1)} KB`;
    document.querySelector('#detail-versions').textContent = button.dataset.versions;
    document.querySelector('#detail-sha').value = button.dataset.sha;
    const install = document.querySelector('#detail-install');
    install.href = `xtools://install?id=${encodeURIComponent(button.dataset.detail)}`;
    install.dataset.name = button.dataset.name;
    dialog.showModal();
  });
}
document.querySelector('#close-detail').addEventListener('click', () => dialog.close());

const installPrompt = document.querySelector('#install-prompt');
for (const link of document.querySelectorAll('[data-install]')) {
  link.addEventListener('click', () => {
    document.querySelector('#install-name').textContent = link.dataset.name;
    document.querySelector('#retry-install').href = link.href;
    if (dialog.open) dialog.close();
    if (!installPrompt.open) installPrompt.showModal();
    // Keep the native link navigation in the user's click gesture.
  });
}
document.querySelector('#close-install').addEventListener('click', () => installPrompt.close());
