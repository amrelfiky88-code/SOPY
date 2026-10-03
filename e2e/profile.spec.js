import { test, expect } from '@playwright/test';
import { createBusiness, signIn, PASSWORD } from './helpers.js';

test.describe('Profile', () => {
  test('edit details with a pasted phone number; it is saved with its country code', async ({ page, context, request }) => {
    const biz = await createBusiness(request, { fullName: 'Erin Owner' });
    await signIn(context, biz.token);
    await page.goto('/app/account');
    await page.getByLabel('Full name').fill('Erin O. Owner');
    await page.locator('#profile-phone').fill('+44 7700 900123'); // pasted with its code
    // A finger tap straight after typing: the tab bar used to come back
    // under the finger and swallow it, so nothing was saved.
    await page.getByRole('button', { name: 'Save profile' }).tap();
    await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible();
    const me = await (await request.get('/api/auth/me', { headers: biz.auth })).json();
    expect(me.user.fullName).toBe('Erin O. Owner');
    expect(me.user.phone).toBe('+44 7700900123'); // saved as +<code> <digits>
  });

  test('notification switches save and survive a reload', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/account');
    const first = page.getByRole('switch').first();
    const before = await first.getAttribute('aria-checked');
    await first.click();
    await expect(first).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    await page.reload();
    await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  });

  test('changing the password keeps this device signed in and signs out the others', async ({ page, context, request, browser }) => {
    const biz = await createBusiness(request);
    await new Promise((r) => setTimeout(r, 1100)); // sessions are stamped to the second
    await signIn(context, biz.token);
    const other = await browser.newContext();
    await signIn(other, biz.token);
    const otherPage = await other.newPage();
    await otherPage.goto('/app/dashboard');
    await expect(otherPage).toHaveURL(/\/app\/dashboard/);

    await page.goto('/app/account');
    await page.getByRole('button', { name: 'Change password' }).click(); // opens the form
    await page.locator('#pw-current').fill(PASSWORD);
    await page.locator('#pw-new').fill('BrandNew5678');
    await page.locator('#pw-confirm').fill('BrandNew5678');
    await page.locator('form').filter({ has: page.locator('#pw-current') }).getByRole('button', { name: 'Change password' }).tap();
    await expect(page.getByText(/Password changed/)).toBeVisible();

    await page.goto('/app/inbox');
    await expect(page).toHaveURL(/\/app\/inbox/); // still signed in here
    await otherPage.goto('/app/inbox');
    await expect(otherPage).toHaveURL(/\/login/); // the other phone is signed out
    await other.close();
  });

  test('switching the language flips the layout to right-to-left and is remembered', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/account');
    await page.getByRole('radio', { name: 'العربية' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const me = await (await request.get('/api/auth/me', { headers: biz.auth })).json();
    expect(me.user.language).toBe('ar');
  });
});
