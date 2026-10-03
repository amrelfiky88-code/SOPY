import { test, expect } from '@playwright/test';
import { createBusiness, signIn } from './helpers.js';

async function submittedKitchenReport(request, biz) {
  const tpl = await (await request.post('/api/checklists/templates', { headers: biz.auth, data: { name: 'Kitchen Daily Report', kind: 'kitchen_daily', itemIds: [] } })).json();
  const sub = await (await request.post('/api/submissions', { headers: biz.auth, data: { templateId: tpl.template.id, branchId: biz.branchId } })).json();
  await request.patch(`/api/submissions/${sub.submission.id}`, { headers: biz.auth, data: { formData: { temperatureLog: { fridge1: { s: '4' } }, signOff: { supervisorName: 'Erin Owner' } } } });
  await request.post(`/api/submissions/${sub.submission.id}/submit`, { headers: biz.auth, data: {} });
  return sub.submission.id;
}

test.describe('Reports and sharing', () => {
  test('find a report, copy its link; the link opens the PDF without signing in', async ({ page, context, request, playwright }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const biz = await createBusiness(request, { storeName: 'Heliopolis' });
    await submittedKitchenReport(request, biz);
    await signIn(context, biz.token);

    await page.goto('/app/reports');
    await page.getByRole('searchbox').fill('helio'); // store name, any case
    await page.locator('.report-list .list-row').first().click();
    await expect(page).toHaveURL(/\/app\/reports\//);

    const copy = page.getByRole('button', { name: 'Copy link' });
    await expect(copy).toBeEnabled({ timeout: 30_000 }); // once the PDF is built
    await copy.click();
    await expect(page.getByText('Link copied.', { exact: false })).toBeVisible();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toMatch(/\/api\/shared\/[A-Za-z0-9_-]{32}$/);

    const anon = await playwright.request.newContext();
    const pdf = await anon.get(url);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await anon.dispose();
  });

  test('when the browser refuses to copy, the link is shown to copy by hand (not "copied")', async ({ page, context, request }) => {
    const biz = await createBusiness(request);
    const id = await submittedKitchenReport(request, biz);
    await signIn(context, biz.token);
    // As iPhone Safari after the upload: both ways of copying are refused.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) } });
      document.execCommand = () => false;
    });
    await page.goto(`/app/reports/${id}`);
    const copy = page.getByRole('button', { name: 'Copy link' });
    await expect(copy).toBeEnabled({ timeout: 30_000 });
    await copy.click();
    const field = page.locator('input.manual-link');
    await expect(field).toBeVisible();
    await expect(field).toHaveValue(/\/api\/shared\//);
    await expect(page.getByText('Link copied.', { exact: false })).toHaveCount(0);
  });
});
