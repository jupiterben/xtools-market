import { expect, type Page } from '@playwright/test';
import { buildTool } from '../../scripts/build-tool.js';

const builds = new Map<string, Promise<Buffer>>();
export async function openTool(page: Page, id: string) {
  if (!builds.has(id)) builds.set(id, buildTool(id));
  const html = (await builds.get(id)!).toString('utf8');
  await page.route('**/tool-harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tools test</title></head><body style="margin:0"><iframe title="工具" sandbox="allow-scripts" style="display:block;width:100%;height:100vh;border:0"></iframe></body></html>',
  }));
  await page.goto('./tool-harness');
  await page.evaluate(({ html, id }) => {
    const frame = document.querySelector('iframe')!;
    frame.onload = () => frame.contentWindow!.postMessage({ type: 'xtools:init', protocol: 1, session: 'tool-test', toolId: id, theme: 'light' }, '*');
    frame.srcdoc = html;
  }, { html, id });
  const frame = page.frameLocator('iframe');
  await expect(frame.getByLabel('输出', { exact: true })).toBeVisible();
  return frame;
}

export async function setTheme(page: Page, theme: string) {
  await page.evaluate((theme) => document.querySelector('iframe')!.contentWindow!.postMessage({
    type: 'xtools:theme', protocol: 1, session: 'tool-test', theme,
  }, '*'), theme);
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', theme);
}
