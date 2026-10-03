import { test, expect } from '@playwright/test';
import { createBusiness, PASSWORD } from './helpers.js';

test.describe('signing in', () => {
  test('a business owner logs in and lands on Today', async ({ page, request }) => {
    const { email } = await createBusiness(request, { fullName: 'Erin Owner' });
    await page.goto('/login');
    await page.getByLabel('Email').fill(`  ${email.toUpperCase()} `); // phones add capitals and spaces
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.locator('.hero-greeting')).toContainText('Erin');
  });

  test('a wrong password says so and stays on the page', async ({ page, request }) => {
    const { email } = await createBusiness(request);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.locator('.error-banner')).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('"Forgot your password?" carries the typed email over', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    // With no email or SMS service on the server, the page says reset is unavailable.
    const emailBox = page.locator('#forgot-email');
    if (await emailBox.count()) await expect(emailBox).toHaveValue('someone@example.com');
    else await expect(page.getByText('Password reset is unavailable right now.', { exact: false })).toBeVisible();
  });

  test('a password can be shown while typing', async ({ page }) => {
    await page.goto('/login');
    const box = page.getByLabel('Password', { exact: true });
    await box.fill('secret123');
    await expect(box).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /Show password/i }).click();
    await expect(box).toHaveAttribute('type', 'text');
  });
});
