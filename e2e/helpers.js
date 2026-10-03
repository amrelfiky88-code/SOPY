import { expect } from '@playwright/test';

export const PASSWORD = 'E2ePass1234';

// A fresh, paying business made through the API: signed up, checkout
// completed in demo mode, setup finished, with one store.
export async function createBusiness(request, { name = 'E2E Cafe', fullName = 'Erin Owner', storeName = 'Main', userCount = 5, branchCount = 2 } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const signup = await request.post('/api/auth/signup', {
    data: { fullName, email, password: PASSWORD, restaurantName: name, country: 'Egypt', branchCount, userCount, language: 'en' },
  });
  expect(signup.status(), await signup.text()).toBe(201);
  const { token } = await signup.json();
  const auth = { Authorization: `Bearer ${token}` };
  for (const path of ['/api/billing/checkout', '/api/billing/mock-complete', '/api/onboarding/complete']) {
    const res = await request.post(path, { headers: auth, data: {} });
    expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  }
  const branch = await request.post('/api/tenants/branches', { headers: auth, data: { name: storeName } });
  expect(branch.status()).toBe(201);
  return { email, token, auth, branchId: (await branch.json()).branch.id };
}

// Signed in as `token`, in English, on every page this context opens.
export async function signIn(context, token, lang = 'en') {
  // Only on the first page: later ones keep whatever the app stored (a new
  // session after a password change, say).
  await context.addInitScript(([t, l]) => {
    if (localStorage.getItem('sopy_signed_in_once')) return;
    localStorage.setItem('sopy_signed_in_once', '1');
    localStorage.setItem('sopy_token', t);
    localStorage.setItem('sopy_lang', l);
  }, [token, lang]);
}

// An invited teammate who has accepted, for chats.
export async function addTeammate(request, auth, fullName = 'Sam Staff') {
  const email = `e2e-staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const invite = await request.post('/api/tenants/users/invite', { headers: auth, data: { fullName, email, role: 'employee' } });
  expect(invite.status(), await invite.text()).toBe(201);
  const token = (await invite.json()).inviteLink.split('token=')[1];
  const accepted = await request.post('/api/auth/accept-invite', { data: { inviteToken: token, password: PASSWORD } });
  expect(accepted.ok()).toBeTruthy();
  return (await accepted.json()).user;
}
