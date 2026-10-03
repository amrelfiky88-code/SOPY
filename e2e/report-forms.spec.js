import { test, expect } from '@playwright/test';
import { createBusiness, signIn } from './helpers.js';

// Every daily and visit report: start, sign off with a name from the team,
// submit, then open the saved report. Labels must read as words in the
// viewer's language (a missing one shows as a raw key like f.bar_daily.x).
const FORMS = [
  ['/app/forms/kitchen', 'kitchen_daily'],
  ['/app/forms/bar', 'bar_daily'],
  ['/app/forms/opening', 'opening_daily'],
  ['/app/forms/closing', 'closing_daily'],
  ['/app/forms/qc-visit', 'qc_visit'],
  ['/app/forms/area-manager-visit', 'area_manager_visit'],
  ['/app/forms/ops-manager-visit', 'ops_manager_visit'],
];

for (const lang of ['en', 'ar']) {
  test(`all seven reports submit and read back (${lang})`, async ({ page, context, request }) => {
    test.setTimeout(180_000);
    const biz = await createBusiness(request, { fullName: 'Erin Owner' });
    // The account's own language wins after sign-in.
    await request.patch('/api/auth/me', { headers: biz.auth, data: { language: lang } });
    await signIn(context, biz.token, lang);
    for (const [path, kind] of FORMS) {
      await page.goto(path);
      await page.locator('.card .btn-primary').first().click(); // Start
      const submit = page.locator('.sticky-action-bar .btn-primary, button.btn-primary').filter({ hasText: lang === 'ar' ? 'إرسال واعتماد' : 'Submit & sign off' });
      await expect(submit).toBeVisible();
      // Pick Erin in every "choose a name" list (the signer is one of them).
      const pickers = page.locator('select').filter({ has: page.locator('option', { hasText: 'Erin Owner' }) });
      const n = await pickers.count();
      expect(n, `${kind}: a name list`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await pickers.nth(i).selectOption({ label: 'Erin Owner' });
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(submit).toHaveCount(0, { timeout: 15_000 }); // the submitted screen replaces the form

      const list = await (await request.get('/api/submissions?status=submitted', { headers: biz.auth })).json();
      const saved = list.submissions.find((s) => s.kind === kind);
      expect(saved, `${kind} is in Reports`).toBeTruthy();
      await page.goto(`/app/reports/${saved.id}`);
      await expect(page.locator('.report-doc, main').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      expect(text, `${kind}: raw label keys`).not.toMatch(/\bf\.[a-z_]+\.[a-zA-Z.[\]*]+/);
      expect(text, `${kind}: undefined`).not.toMatch(/undefined|NaN|\[object Object\]/);
      expect(text).toContain('Erin Owner');
    }
  });
}
