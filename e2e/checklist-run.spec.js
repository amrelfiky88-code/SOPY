import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBusiness, signIn } from './helpers.js';

// A fake camera stands in for the phone's; evidence still goes through
// getUserMedia (there is no file input to use instead). It plays a small
// generated video: Chromium's built-in fake device could vanish for seconds
// after its first use in a busy, freshly started browser ("Requested device
// not found"), which made this test flaky.
function fakeVideo() {
  const file = path.join(os.tmpdir(), 'sopy-e2e-camera.y4m');
  if (!fs.existsSync(file)) {
    const w = 320;
    const h = 240;
    const parts = [Buffer.from(`YUV4MPEG2 W${w} H${h} F10:1 Ip A1:1 C420jpeg\n`)];
    for (let f = 0; f < 4; f++) {
      parts.push(Buffer.from('FRAME\n'));
      const luma = Buffer.alloc(w * h);
      for (let i = 0; i < luma.length; i++) luma[i] = ((i % w) + f * 40) % 256;
      parts.push(luma, Buffer.alloc((w / 2) * (h / 2), 110), Buffer.alloc((w / 2) * (h / 2), 150));
    }
    fs.writeFileSync(file, Buffer.concat(parts));
  }
  return file;
}

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fakeVideo()}`],
  },
  permissions: ['camera'],
});

test('a run with a failed critical checkpoint: photos, submit, Red scorecard, incident in the Inbox', async ({ page, context, request }) => {
  const biz = await createBusiness(request);
  await signIn(context, biz.token);
  const run = await (await request.post('/api/checklists/library/run', { headers: biz.auth, data: { group: 'SOP 1: Opening', branchId: biz.branchId } })).json();
  await page.goto(`/app/checklists/run/${run.submission.id}`);

  const items = page.locator('.run-item');
  await expect(items.first()).toBeVisible({ timeout: 20_000 });
  const count = await items.count();
  // Submit stays off until every checkpoint has an answer and a photo.
  const submit = page.getByRole('button', { name: /Submit/ });
  await expect(submit).toBeDisabled();

  let failedCritical = false;
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const critical = await item.locator('.pill-red').count();
    const answers = item.locator('.answer-row button');
    if (critical && !failedCritical) { await answers.nth(1).click(); failedCritical = true; } // not compliant
    else await answers.nth(0).click();
    await item.locator('.camera-btn').click();
    const shutter = item.locator('.capture-btn');
    await expect(shutter).toBeEnabled({ timeout: 20_000 });
    await shutter.click();
    await expect(item.locator('.pill-green')).toBeVisible({ timeout: 20_000 }); // photo saved
  }
  expect(failedCritical, 'SOP 1 has a critical checkpoint').toBeTruthy();

  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('.rag-banner')).toHaveClass(/rag-red/);
  await expect(page.locator('.score-value')).toBeVisible();

  await page.goto('/app/inbox');
  await expect(page.locator('.list-row').filter({ hasText: /Incident/ }).first()).toBeVisible();
});
