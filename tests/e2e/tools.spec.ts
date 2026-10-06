import { expect, test } from '@playwright/test';
import { openTool, setTheme } from './tool-harness.js';

test.describe.configure({ mode: 'serial' });

test('JSON needs no run click; formatting, validation and reversible replacements are immediate', async ({ page }) => {
  const frame = await openTool(page, 'json');
  const input = frame.getByLabel('输入', { exact: true });
  const output = frame.getByLabel('输出', { exact: true });
  await expect(input).toHaveValue('');
  await expect(frame.getByRole('button', { name: '复制结果', exact: true })).toBeDisabled();
  await expect(frame.getByRole('button', { name: '运行', exact: true })).toHaveCount(0);
  await input.fill('{"a":1}');
  await expect(output).toHaveValue('{\n  "a": 1\n}');
  await frame.getByRole('button', { name: '4 空格', exact: true }).click();
  await expect(output).toHaveValue('{\n    "a": 1\n}');
  await frame.getByRole('button', { name: '压缩', exact: true }).click();
  await expect(output).toHaveValue('{"a":1}');
  await expect(frame.getByRole('button', { name: '4 空格', exact: true })).toBeDisabled();
  await input.fill('{broken');
  await expect(frame.getByRole('alert')).toBeVisible();
  await expect(output).toHaveValue('');
  await expect(frame.getByRole('button', { name: '复制结果', exact: true })).toBeDisabled();
  await input.fill('{"restored":true}');
  await expect(output).toHaveValue('{"restored":true}');
  await expect(frame.getByRole('alert')).toBeHidden();
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await expect(output).toHaveValue(/XTools/);
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(input).toHaveValue('{"restored":true}');
  await frame.getByRole('button', { name: '清空输入', exact: true }).click();
  await expect(output).toHaveValue('');
  await expect(frame.getByRole('alert')).toBeHidden();
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(output).toHaveValue('{"restored":true}');
});

for (const id of ['base64', 'url']) {
  test(`${id} converts on edit, reverses in one click, and loads mode-appropriate examples`, async ({ page }) => {
    const frame = await openTool(page, id);
    const input = frame.getByLabel('输入', { exact: true });
    const output = frame.getByLabel('输出', { exact: true });
    const text = '你好 & hello';
    const encoded = id === 'url' ? encodeURIComponent(text) : Buffer.from(text).toString('base64');
    await input.fill(text);
    await expect(output).toHaveValue(encoded);
    await frame.getByRole('button', { name: '反向转换', exact: true }).click();
    await expect(input).toHaveValue(encoded);
    await expect(output).toHaveValue(text);
    await expect(frame.getByRole('button', { name: '解码', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
    await expect(input).toHaveValue(text);
    await expect(output).toHaveValue(encoded);
    await frame.getByRole('button', { name: '解码', exact: true }).click();
    await input.fill(id === 'url' ? '%ZZ' : '???');
    await expect(frame.getByRole('alert')).toBeVisible();
    await expect(frame.getByRole('button', { name: '反向转换', exact: true })).toBeDisabled();
    await frame.getByRole('button', { name: '载入示例', exact: true }).click();
    await expect(output).not.toHaveValue('');
    await expect(frame.getByRole('alert')).toBeHidden();
  });
}

test('timestamp auto-detects and explicit units or current time recompute without a run button', async ({ page }) => {
  const frame = await openTool(page, 'timestamp');
  const input = frame.getByLabel('输入', { exact: true });
  const output = frame.getByLabel('输出', { exact: true });
  await expect(output).toHaveValue(/Unix/);
  await input.fill('1700000000000');
  await expect(output).toHaveValue(/2023-11-14T22:13:20/);
  await input.fill('1700000000');
  await expect(output).toHaveValue(/2023-11-14T22:13:20/);
  await frame.getByRole('button', { name: '毫秒', exact: true }).click();
  await expect(output).toHaveValue(/1970-01-20T16:13:20/);
  await frame.getByRole('button', { name: '当前时间', exact: true }).click();
  await expect(input).toHaveValue(/^\d{13}$/);
  await expect(output).not.toHaveValue('');
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(input).toHaveValue('1700000000');
});

test('UUID starts ready, quantity shortcuts and numeric edits regenerate, invalid counts recover', async ({ page }) => {
  const frame = await openTool(page, 'uuid');
  const output = frame.getByLabel('输出', { exact: true });
  await expect(output).toHaveValue(/^[^\n]+(\n[^\n]+){4}$/);
  await frame.getByRole('button', { name: '10', exact: true }).click();
  await expect(frame.getByLabel('生成数量')).toHaveValue('10');
  await expect(output).toHaveValue(/^[^\n]+(\n[^\n]+){9}$/);
  const before = await output.inputValue();
  await frame.getByRole('button', { name: '重新生成', exact: true }).click();
  await expect(output).not.toHaveValue(before);
  await frame.getByLabel('生成数量').fill('101');
  await expect(frame.getByRole('alert')).toContainText('1 到 100');
  await frame.getByLabel('生成数量').fill('1');
  await expect(output).toHaveValue(/^[a-f0-9-]{36}$/);
  await expect(frame.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const saved = await output.inputValue();
  await frame.getByRole('button', { name: '清空输入', exact: true }).click();
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(output).toHaveValue(saved);
});

test('hash algorithms switch in one click and edits never show stale output', async ({ page }) => {
  const frame = await openTool(page, 'hash');
  const input = frame.getByLabel('输入', { exact: true });
  const output = frame.getByLabel('输出', { exact: true });
  await input.fill('abc');
  await expect(output).toHaveValue('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await frame.getByRole('button', { name: 'SHA-384', exact: true }).click();
  await expect(output).toHaveValue(/^[a-f0-9]{96}$/);
  await frame.getByRole('button', { name: 'SHA-512', exact: true }).click();
  await expect(output).toHaveValue(/^[a-f0-9]{128}$/);
  await input.fill('first');
  await input.fill('last');
  await frame.getByRole('button', { name: 'SHA-256', exact: true }).click();
  const expected = await page.evaluate(async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('last')))].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  await expect(output).toHaveValue(expected);
  await frame.getByRole('button', { name: '清空输入', exact: true }).click();
  await expect(output).toHaveValue('');
});

test('diff reacts to both editors, swaps once and restores both after clear', async ({ page }) => {
  const frame = await openTool(page, 'diff');
  const input = frame.getByLabel('输入', { exact: true });
  const second = frame.getByLabel('对比文本', { exact: true });
  const output = frame.getByLabel('输出', { exact: true });
  await input.fill('a\nb\n');
  await second.fill('a\nc\n');
  await expect(output).toHaveValue(/- b\n\+ c/);
  await frame.getByRole('button', { name: '交换两段文本', exact: true }).click();
  await expect(output).toHaveValue(/- c\n\+ b/);
  await frame.getByRole('button', { name: '清空输入', exact: true }).click();
  await expect(output).toHaveValue('');
  await frame.getByRole('button', { name: '撤销上次替换', exact: true }).click();
  await expect(input).toHaveValue('a\nc\n');
  await expect(second).toHaveValue('a\nb\n');
  await second.fill('a\nc\n');
  await expect(output).toHaveValue('两段文本完全一致');
  await input.fill('');
  await expect(output).toHaveValue('+ a\n+ c');
});

test('IME composition waits until committed; copy works in the sandbox and denial has a fallback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const frame = await openTool(page, 'base64');
  const input = frame.getByLabel('输入', { exact: true });
  const output = frame.getByLabel('输出', { exact: true });
  await input.evaluate((element: HTMLTextAreaElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'ni';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
  });
  await page.waitForTimeout(400);
  await expect(output).toHaveValue('');
  await input.evaluate((element: HTMLTextAreaElement) => {
    element.value = '你好';
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await expect(output).toHaveValue(Buffer.from('你好').toString('base64'));
  await frame.getByRole('button', { name: '复制结果', exact: true }).click();
  await expect(frame.locator('#copy-status')).toHaveText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(Buffer.from('你好').toString('base64'));
  await frame.locator('body').evaluate(() => {
    document.execCommand = () => false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await frame.getByRole('button', { name: '复制结果', exact: true }).click();
  await expect(frame.locator('#copy-status')).toContainText('复制受限');
  expect(await output.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe((await output.inputValue()).length);
});

for (const id of ['json', 'base64', 'url', 'timestamp', 'uuid', 'hash', 'diff']) {
  test(`${id} layout is usable in light/dark desktop/mobile viewports`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const frame = await openTool(page, id);
    if (!['timestamp', 'uuid'].includes(id)) await frame.getByRole('button', { name: '载入示例', exact: true }).click();
    await expect(frame.getByLabel('输出', { exact: true })).not.toHaveValue('');
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      for (const width of [320, 768, 1320]) {
        await page.setViewportSize({ width, height: 850 });
        expect(await frame.locator('html').evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
        expect(await frame.locator('button:visible').evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth + 1))).toBe(true);
        await page.screenshot({ path: `.logs/ux-${id}-${theme}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}
