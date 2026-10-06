import { expect, test } from '@playwright/test';
import { regexPresets } from '../../tools/regex/presets.js';
import { openTool, setTheme } from './tool-harness.js';

test.describe.configure({ mode: 'serial' });

test('presets apply with one click; insertion preserves other text and undo restores it', async ({ page }) => {
  const frame = await openTool(page, 'regex');
  const pattern = frame.getByLabel('表达式', { exact: true });
  const input = frame.getByLabel('输入', { exact: true });
  await input.fill('中文 hello@example.com');
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/hello@example.com/);
  await frame.getByRole('button', { name: '使用中文汉字', exact: true }).click();
  await expect(pattern).toHaveValue(String.raw`\p{Script=Han}+`);
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/"match": "中文"/);
  await expect(input).toHaveValue('中文 hello@example.com');
  await expect(frame.getByLabel('u Unicode 模式')).toBeChecked();
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(pattern).toHaveValue(regexPresets[0].pattern);
  await expect(frame.getByLabel('i 忽略大小写')).toBeChecked();
  await frame.getByRole('button', { name: '插入', exact: true }).click();
  await pattern.fill('^(prefix)suffix$');
  await pattern.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 8));
  await frame.getByRole('button', { name: '使用中文汉字', exact: true }).click();
  await expect(pattern).toHaveValue(String.raw`^(\p{Script=Han}+)suffix$`);
  await expect(pattern).toBeFocused();
  await expect(frame.getByLabel('u Unicode 模式')).toBeChecked();
  await expect(frame.getByLabel('i 忽略大小写')).toBeChecked();
  await pattern.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(element.value.length, element.value.length));
  await frame.getByRole('button', { name: '使用连续空白', exact: true }).click();
  await expect(pattern).toHaveValue(String.raw`^(\p{Script=Han}+)suffix$\s+`);
  await frame.getByRole('button', { name: '替换', exact: true }).click();
  await frame.getByRole('button', { name: '使用IPv4 地址', exact: true }).click();
  await expect(pattern).toHaveValue(regexPresets.find((preset) => preset.id === 'ipv4')!.pattern);
  await expect(input).toHaveValue('中文 hello@example.com');
});

test('all presets run automatically; invalid expressions and flags recover without a run button', async ({ page }) => {
  const frame = await openTool(page, 'regex');
  await expect(frame.getByRole('button', { name: '运行', exact: true })).toHaveCount(0);
  for (const preset of regexPresets) {
    await frame.getByRole('button', { name: `使用${preset.name}`, exact: true }).click();
    await frame.getByRole('button', { name: '载入示例', exact: true }).click();
    await expect(frame.getByLabel('表达式', { exact: true })).toHaveValue(preset.pattern);
    await expect(frame.getByLabel('输入', { exact: true })).toHaveValue(preset.sample);
    await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/"index":/);
    await expect(frame.getByRole('alert')).toBeHidden();
  }
  await frame.getByLabel('表达式', { exact: true }).fill('[');
  await expect(frame.getByRole('alert')).toBeVisible();
  await frame.getByLabel('表达式', { exact: true }).fill('([a-z])(\\d)');
  await frame.getByLabel('输入', { exact: true }).fill('a1 b2');
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/"groups": \[\s+"a",\s+"1"/);
  await expect(frame.getByRole('alert')).toBeHidden();
  await frame.getByLabel('表达式', { exact: true }).fill('abc');
  await frame.getByLabel('输入', { exact: true }).fill('ABC');
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue('没有匹配结果');
  await frame.getByLabel('i 忽略大小写').check();
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/"match": "ABC"/);
  await frame.getByRole('button', { name: '清空输入', exact: true }).click();
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue('');
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/"match": "ABC"/);
});

test('timeout is bounded and replacing a running expression cancels stale work', async ({ page }) => {
  const frame = await openTool(page, 'regex');
  await frame.getByLabel('表达式', { exact: true }).fill('(a+)+$');
  await frame.getByLabel('输入', { exact: true }).fill(`${'a'.repeat(40)}!`);
  await expect(frame.getByRole('alert')).toContainText('处理超时', { timeout: 6000 });
  await frame.getByLabel('输入', { exact: true }).fill(`${'a'.repeat(41)}!`);
  await page.waitForTimeout(400);
  await frame.getByRole('button', { name: '使用邮箱（常见格式）', exact: true }).click();
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/hello@example.com/);
  await page.waitForTimeout(2000);
  await expect(frame.getByRole('alert')).toBeHidden();
  await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/hello@example.com/);
});

test('large editor and one-click presets fit light/dark desktop/mobile viewports', async ({ page }) => {
  const frame = await openTool(page, 'regex');
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    for (const width of [320, 390, 768, 1320]) {
      await page.setViewportSize({ width, height: 850 });
      await frame.getByRole('button', { name: '使用IPv4 地址', exact: true }).click();
      await frame.getByRole('button', { name: '载入示例', exact: true }).click();
      await expect(frame.getByLabel('输出', { exact: true })).toHaveValue(/127.0.0.1/);
      const rect = await frame.getByLabel('表达式', { exact: true }).boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(100);
      expect(rect!.width).toBeGreaterThan(width * 0.85);
      expect(await frame.locator('html').evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
      await expect(frame.getByRole('button', { name: '使用中文汉字', exact: true })).toBeInViewport();
      await page.screenshot({ path: `.logs/ux-regex-${theme}-${width}.png` });
    }
  }
});
