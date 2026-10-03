import { test, expect } from '@playwright/test';
import { createBusiness, signIn, PASSWORD } from './helpers.js';

test.describe('Team & stores', () => {
  test('invite, accept, change role, disable (signed out), re-enable within the plan, reset link', async ({ page, context, request, browser }) => {
    const biz = await createBusiness(request, { userCount: 2 }); // owner + one more
    await signIn(context, biz.token);
    await page.goto('/app/team');
    await page.locator('button[aria-pressed]').nth(1).click(); // Users tab

    // Invite: the link appears, ready to send.
    const email = `e2e-team-${Date.now()}@example.com`;
    await page.locator('#ifn').fill('Nora Staff');
    await page.locator('#iem').fill(email);
    await page.getByRole('button', { name: 'Invite user' }).click();
    const link = page.locator('.invite-link');
    await expect(link).toContainText(email);
    const inviteUrl = new URL(await link.locator('.invite-link-url').innerText());
    const invitePath = inviteUrl.pathname + inviteUrl.search;

    // The plan is full now (2 users): a third invite is refused with a reason.
    await page.locator('#ifn').fill('Too Many');
    await page.locator('#iem').fill(`e2e-team-x-${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Invite user' }).click();
    await expect(page.locator('.error-banner')).toContainText(/Your plan covers 2 users/);

    // Nora accepts in her own browser.
    const nora = await browser.newContext();
    const noraPage = await nora.newPage();
    await noraPage.goto(invitePath);
    await noraPage.locator('#password').fill(PASSWORD);
    await noraPage.getByRole('button', { name: /Set password/ }).click();
    await expect(noraPage).toHaveURL(/\/app\/dashboard/);

    // Promote her; the change sticks after a reload.
    await page.reload();
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByLabel(/Role for Nora Staff/).selectOption('store_manager');
    await page.reload();
    await page.locator('button[aria-pressed]').nth(1).click();
    await expect(page.getByLabel(/Role for Nora Staff/)).toHaveValue('store_manager');

    // Disable her: her open session ends at its next request.
    const row = page.locator('tr').filter({ hasText: 'Nora Staff' });
    await row.getByRole('button', { name: 'Disable' }).click();
    await row.getByRole('button', { name: 'Disable' }).click(); // confirm
    await expect(row.getByRole('button', { name: 'Enable' })).toBeVisible();
    await noraPage.goto('/app/inbox');
    await expect(noraPage).toHaveURL(/\/login/);

    // Re-enable (a seat is free again), then a reset link for her.
    await row.getByRole('button', { name: 'Enable' }).click();
    await expect(row.getByRole('button', { name: 'Reset password' })).toBeVisible();
    await row.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.locator('.invite-link')).toContainText(/reset/i);
    await nora.close();
  });
});
