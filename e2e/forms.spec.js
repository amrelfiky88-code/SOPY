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
