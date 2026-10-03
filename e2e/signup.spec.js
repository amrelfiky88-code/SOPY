import { test, expect } from '@playwright/test';

test.describe('a new business signs up', () => {
  test('Get started → configure → pricing → checkout (demo) → setup → Today', async ({ page }) => {
    const email = `e2e-signup-${Date.now()}@example.com`;
    await page.goto('/get-started');
    await page.locator('#fullName').fill('Dina Founder');
    await page.locator('#email').fill(email);
    await page.locator('#country').selectOption('Egypt');
    await page.locator('#phone').fill('01001234567'); // national number: +20 comes from the country
    await page.locator('#password').fill('Founder1234');
    await page.locator('#restaurantName').fill('Dina Kitchen');
    await page.locator('#branchCount').fill('2');
    await page.locator('#userCount').fill('4');
    await page.locator('form button[type=submit]').click();

    await expect(page).toHaveURL(/\/configure$/);
    await expect(page.locator('#branchCount')).toHaveValue('2');
    await page.locator('form button[type=submit]').click();

    await expect(page).toHaveURL(/\/pricing$/);
    const total = await page.locator('.summary-row').last().innerText();
    await page.getByRole('button', { name: /Continue to checkout|checkout/i }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    // The checkout total is the price the Pricing page showed.
    expect(await page.locator('.summary-row').filter({ hasText: /\$\d/ }).last().innerText()).toContain(total.match(/\$[\d.,]+/)[0]);
    await page.getByRole('button', { name: 'Activate in demo mode' }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole('button', { name: 'Continue' }).click(); // roles
    await page.locator('#branchName').fill('Zamalek');
    await page.getByRole('button', { name: 'Add branch' }).click();
    await expect(page.getByText('Zamalek')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click(); // stores
    await page.getByRole('button', { name: 'Finish onboarding' }).click();

    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.locator('.hero-greeting')).toContainText('Dina Kitchen');
    const me = await page.evaluate(() => fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('sopy_token')}` } }).then((r) => r.json()));
    expect(me.user.phone).toBe('+20 1001234567');
    expect(me.tenant.onboarding_step).toBe('complete');
  });
});
