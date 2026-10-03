import { test, expect } from '@playwright/test';
import { createBusiness, signIn } from './helpers.js';

test.describe('Kitchen daily report', () => {
  test('a freezer reading below zero can be typed and is in range; 18 is flagged', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/forms/kitchen');
    await page.getByRole('button', { name: /Start today|Continue/ }).click();

    const freezerStart = page.getByRole('spinbutton', { name: /Freezer.*Start/ });
    // The iPhone decimal keypad has no minus key; it must not be requested.
    await expect(freezerStart).not.toHaveAttribute('inputmode', 'decimal');
    await expect(freezerStart).toHaveAttribute('step', 'any');

    await freezerStart.fill('-18');
    await expect(freezerStart).not.toHaveClass(/temp-out/);
    await freezerStart.fill('18');
    await expect(freezerStart).toHaveClass(/temp-out/);
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('Start tapped twice opens one draft', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/forms/kitchen');
    await page.getByRole('button', { name: /Start today/ }).dblclick();
    await expect(page.getByRole('spinbutton', { name: /Freezer.*Start/ })).toBeVisible();
    const drafts = await request.get(`/api/submissions?status=in_progress`, { headers: biz.auth });
    expect((await drafts.json()).submissions).toHaveLength(1);
  });
});

test.describe('phone ergonomics', () => {
  test('store pickers outside cards are 16px, so iPhone Safari does not zoom on tap', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    // The picker only appears with more than one store.
    await request.post('/api/tenants/branches', { headers: biz.auth, data: { name: 'Second' } });
    await signIn(context, biz.token);
    await page.goto('/app/nfsa');
    const size = await page.locator('.sticky-store-select').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});

test.describe('saving without a signal', () => {
  test('an autosave that fails says so, and saves by itself when the signal returns', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/forms/kitchen');
    await page.getByRole('button', { name: /Start today/ }).click();
    const fridge = page.getByRole('spinbutton', { name: /Walk-in Refrigerator #1.*Start/ });
    await expect(fridge).toBeVisible();

    await context.setOffline(true);
    await fridge.fill('4');
    await expect(page.getByText(/Not saved yet: no connection/)).toBeVisible({ timeout: 8000 });

    await context.setOffline(false);
    await expect(page.getByText('All changes saved.')).toBeVisible({ timeout: 15_000 });
    const drafts = await (await request.get('/api/submissions/draft?kind=kitchen_daily&branchId=' + biz.branchId, { headers: biz.auth })).json();
    expect(drafts.submission.form_data.temperatureLog.fridge1.s).toBe('4');
  });

  test('changes made offline survive closing the app', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/forms/kitchen');
    await page.getByRole('button', { name: /Start today/ }).click();
    await expect(page.getByRole('spinbutton', { name: /Walk-in Refrigerator #1.*Start/ })).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('spinbutton', { name: /Walk-in Refrigerator #1.*Start/ }).fill('3');
    await expect(page.getByText(/Not saved yet/)).toBeVisible({ timeout: 8000 });
    await page.close(); // the app is closed before the signal returns

    await context.setOffline(false);
    const again = await context.newPage();
    await again.goto('/app/forms/kitchen');
    await again.getByRole('button', { name: /Continue/ }).click();
    await expect(again.getByRole('spinbutton', { name: /Walk-in Refrigerator #1.*Start/ })).toHaveValue('3');
    await expect(again.getByText('All changes saved.')).toBeVisible({ timeout: 15_000 });
  });
});
