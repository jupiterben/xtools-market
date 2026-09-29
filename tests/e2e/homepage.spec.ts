import { expect, test } from '@playwright/test';

test('root homepage supports search, category, details and client installation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '工具市场', exact: true })).toBeVisible();
  await expect(page.locator('.tool-card:visible')).toHaveCount(8);
  await page.getByLabel('搜索工具').fill('base64');
  await expect(page.locator('.tool-card:visible')).toHaveCount(1);
  await page.getByLabel('搜索工具').fill('');
  await page.getByLabel('工具分类').selectOption('文本工具');
  await expect(page.locator('.tool-card:visible')).toHaveCount(2);
  await page.getByLabel('搜索工具').fill('nonexistent');
  await expect(page.getByRole('heading', { name: '没有找到匹配的工具' })).toBeVisible();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('.tool-card:visible')).toHaveCount(8);
  await page.getByRole('button', { name: 'JSON 工作室详情', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('JSON 工作室');
  await expect(dialog).toContainText('无需系统权限');
  await expect(dialog.getByRole('link', { name: '安装工具' })).toHaveAttribute('href', 'xtools://install?id=json');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'JSON 工作室详情', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('copy source works and denial has clear feedback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.getByRole('button', { name: '复制市场源' }).click();
  await expect(page.locator('#copy-status')).toHaveText('市场源已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:1431/xtools-market/');
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('denied'); } }); });
  await page.getByRole('button', { name: '复制市场源' }).click();
  await expect(page.locator('#copy-status')).toContainText('无法访问剪贴板');
});

test('cards render without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:1431/xtools-market/');
    await expect(page.locator('.tool-card')).toHaveCount(8);
    await expect(page.getByRole('link', { name: '安装JSON 工作室', exact: true })).toHaveAttribute('href', 'xtools://install?id=json');
    await expect(page.getByLabel('搜索工具')).toBeHidden();
  } finally { await context.close(); }
});

test('install links offer a retry and client download without downloading packages', async ({ page }) => {
  const downloads: string[] = [];
  const packages: string[] = [];
  page.on('download', (download) => downloads.push(download.url()));
  page.on('request', (request) => { if (request.url().includes('/packages/')) packages.push(request.url()); });
  await page.goto('./');
  // Capture the external navigation without starting an OS application on the test machine.
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const link = (event.target as Element).closest('a[href^="xtools:"]');
      if (link) {
        document.body.dataset.externalUrl = link.getAttribute('href')!;
        event.preventDefault();
      }
    }, true);
  });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.getByRole('link', { name: '安装UUID 生成器', exact: true }).click();
    const prompt = page.getByRole('dialog', { name: '打开 XTools 客户端' });
    await expect(prompt).toContainText('UUID 生成器');
    await expect(page.locator('body')).toHaveAttribute('data-external-url', 'xtools://install?id=uuid');
    await expect(prompt.getByRole('link', { name: '获取客户端' })).toHaveAttribute('href', 'https://github.com/jupiterben/xtools/releases');
    await prompt.getByRole('link', { name: '再次打开' }).click();
    await expect(prompt.getByRole('link', { name: '再次打开' })).toHaveAttribute('href', 'xtools://install?id=uuid');
    expect(await prompt.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `.logs/install-${width}.png` });
    await prompt.getByRole('button', { name: '关闭安装提示' }).click();
    await expect(page.getByRole('link', { name: '安装UUID 生成器', exact: true })).toBeFocused();
  }
  await page.getByRole('button', { name: 'JSON 工作室详情', exact: true }).click();
  await page.getByRole('link', { name: '安装工具', exact: true }).click();
  await expect(page.locator('#detail')).not.toBeVisible();
  await expect(page.locator('#install-prompt')).toContainText('JSON 工作室');
  await expect(page.locator('#retry-install')).toHaveAttribute('href', 'xtools://install?id=json');
  await expect(page.locator('body')).toHaveAttribute('data-external-url', 'xtools://install?id=json');
  await page.keyboard.press('Escape');
  await expect(page.locator('#install-prompt')).not.toBeVisible();
  expect(downloads).toEqual([]);
  expect(packages).toEqual([]);
  await expect(page.locator('a[download]')).toHaveCount(0);
});

test('desktop and mobile light/dark layouts have no overflow or broken images', async ({ page }) => {
  await page.goto('./');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('img').evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      const columns = await page.locator('.tool-grid').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(width <= 560 ? 1 : width <= 850 ? 2 : 3);
      await page.screenshot({ path: `.logs/home-${colorScheme}-${width}.png`, fullPage: true });
    }
  }
});
