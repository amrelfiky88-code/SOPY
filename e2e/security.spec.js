import { test, expect } from '@playwright/test';
import { createBusiness, signIn, addTeammate } from './helpers.js';

const PAYLOAD = '<img src=x onerror="window.__xss=1">';

test.describe('untrusted text', () => {
  test('names and messages with markup show as text and never run', async ({ page, context, request }) => {
    const biz = await createBusiness(request, { name: `Cafe ${PAYLOAD}`, fullName: `Owner ${PAYLOAD}`, storeName: `Store ${PAYLOAD}` });
    const mate = await addTeammate(request, biz.auth, `Staff "><svg onload=window.__xss=2>`);
    const thread = await (await request.post('/api/inbox/threads', { headers: biz.auth, data: { userId: mate.id } })).json();
    await request.post(`/api/inbox/threads/${thread.threadId}/messages`, { headers: biz.auth, data: { body: `hello ${PAYLOAD}` } });

    await signIn(context, biz.token);
    for (const path of ['/app/dashboard', '/app/team', '/app/inbox', `/app/inbox/${thread.threadId}`, '/app/account']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => window.__xss ?? null), path).toBeNull();
      await expect(page.locator('img[src="x"], svg[onload]')).toHaveCount(0);
    }
    // …and the payload is there, as plain text.
    expect(await page.locator('body').innerText()).toContain('onerror=');
  });

  test('the page forbids foreign scripts and inline handlers (CSP)', async ({ page, request }) => {
    const res = await request.get('/login');
    const csp = res.headers()['content-security-policy'] || '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");

    await page.goto('/login');
    const blocked = await page.evaluate(async () => {
      const seen = [];
      document.addEventListener('securitypolicyviolation', (e) => seen.push(e.violatedDirective));
      const s = document.createElement('script');
      s.src = 'https://evil.example.com/x.js';
      document.head.appendChild(s);
      const img = document.createElement('img');
      img.setAttribute('onerror', 'window.__xss = 1');
      img.src = 'x';
      document.body.appendChild(img);
      await new Promise((r) => setTimeout(r, 1000));
      return { seen, ran: window.__xss ?? null };
    });
    expect(blocked.ran).toBeNull();
    expect(blocked.seen).toEqual(expect.arrayContaining(['script-src-elem', 'script-src-attr']));
  });

  test('a crafted email answers at once instead of freezing the server', async ({ request }) => {
    const started = Date.now();
    const res = await request.post('/api/auth/signup', {
      data: { fullName: 'X', email: `a@${'a.'.repeat(400_000)}@`, password: 'Password123', restaurantName: 'R', country: 'Egypt' },
    });
    expect(res.status()).toBe(400);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
