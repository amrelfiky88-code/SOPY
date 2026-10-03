import { test, expect } from '@playwright/test';
import { createBusiness, signIn, addTeammate } from './helpers.js';

test.describe('bad connections and impatient fingers', () => {
  test('offline, Today says so with Try again — not "nothing assigned" — and recovers by itself', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/library'); // the app itself loads while online
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

    await context.setOffline(true);
    await page.evaluate(() => { history.pushState({}, '', '/app/dashboard'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page.locator('.error-banner')).toContainText(/connection/i);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText(/No tasks assigned|nothing assigned/i)).toHaveCount(0);

    await context.setOffline(false); // the 'online' event reloads what failed
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });

  test('offline, Profile & billing does not claim there is no subscription', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await page.goto('/app/library');
    await context.setOffline(true);
    await page.evaluate(() => { history.pushState({}, '', '/app/account'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page.locator('#billing .error-banner')).toBeVisible();
    await expect(page.getByText('No active subscription')).toHaveCount(0);
    await context.setOffline(false);
    await expect(page.locator('#billing .error-banner')).toHaveCount(0);
  });

  test('a screen whose file cannot be downloaded offers Reload, not a blank page', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    await signIn(context, biz.token);
    await context.route('**/assets/KpiDashboard-*.js', (route) => route.abort());
    await page.goto('/app/kpi');
    await expect(page.getByRole('alert')).toContainText(/couldn’t load/);
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  test('double-tapping Send on a slow line sends one message', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    const mate = await addTeammate(request, biz.auth);
    const { threadId } = await (await request.post('/api/inbox/threads', { headers: biz.auth, data: { userId: mate.id } })).json();
    await signIn(context, biz.token);
    await page.goto(`/app/inbox/${threadId}`);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 600, downloadThroughput: 50_000, uploadThroughput: 50_000 });

    await page.locator('.composer textarea').fill('only once please');
    await page.locator('.send-btn').dblclick();
    await expect(page.locator('.composer textarea')).toHaveValue('', { timeout: 15_000 });
    const thread = await (await request.get(`/api/inbox/threads/${threadId}`, { headers: biz.auth })).json();
    expect(thread.messages.filter((m) => m.body === 'only once please')).toHaveLength(1);
  });

  test('a report submitted twice at once counts once (server)', async ({ request }) => {
    const biz = await createBusiness(request);
    const tpl = await (await request.post('/api/checklists/templates', { headers: biz.auth, data: { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] } })).json();
    const sub = await (await request.post('/api/submissions', { headers: biz.auth, data: { templateId: tpl.template.id, branchId: biz.branchId } })).json();
    const statuses = await Promise.all([1, 2, 3].map(() => request.post(`/api/submissions/${sub.submission.id}/submit`, { headers: biz.auth, data: {} }).then((r) => r.status())));
    expect(statuses.sort()).toEqual([200, 409, 409]);
  });
});

test('coming back to the app refreshes the unread counts and an open chat at once', async ({ page, context, request }) => {
  const biz = await createBusiness(request);
  const mate = await addTeammate(request, biz.auth);
  const { threadId } = await (await request.post('/api/inbox/threads', { headers: biz.auth, data: { userId: mate.id } })).json();
  await signIn(context, biz.token);
  await page.goto(`/app/inbox/${threadId}`);
  await page.waitForLoadState('networkidle');
  const summary = page.waitForRequest((r) => r.url().includes('/api/inbox/summary'), { timeout: 3000 });
  const thread = page.waitForRequest((r) => r.url().endsWith(`/api/inbox/threads/${threadId}`), { timeout: 3000 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await Promise.all([summary, thread]);
});
