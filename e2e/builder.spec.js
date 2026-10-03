import { test, expect } from '@playwright/test';
import { createBusiness, signIn } from './helpers.js';

test.describe('from the Library to a checklist on Today', () => {
  test('Add to checklist → save → assign with a due time → Start opens the run', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);

    await page.goto(`/app/library/${encodeURIComponent('SOP 1: Opening')}`);
    await page.getByRole('button', { name: 'Add to checklist' }).click();
    await expect(page).toHaveURL(/\/app\/checklists$/);
    // The SOP's checkpoints arrive selected, with its name.
    await expect(page.locator('#tname')).not.toHaveValue('');
    const picked = await page.locator('input[type=checkbox]:checked').count();
    expect(picked).toBeGreaterThan(3);

    await page.locator('#tname').fill('Morning opening');
    await page.getByRole('button', { name: /^Save checklist/ }).click();
    await expect(page.locator('.success-banner')).toContainText('Morning opening');

    await page.locator('#atpl').selectOption({ label: 'Morning opening' });
    await page.locator('#adue').fill('09:30');
    await page.getByRole('button', { name: /^Assign/ }).click();
    await expect(page.locator('.success-banner')).toBeVisible();
    await expect(page.locator('table')).toContainText('09:30');

    await page.goto('/app/dashboard');
    const row = page.locator('.list-row, .assignment-row, .card').filter({ hasText: 'Morning opening' }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('09:30');
    await row.getByRole('button').first().click();
    await expect(page).toHaveURL(/\/app\/checklists\/run\//);
    await expect(page.locator('.run-item')).toHaveCount(picked);
  });
});
