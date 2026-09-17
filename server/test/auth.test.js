import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestDb, closeDb } from '../test-utils/db.js';
import { startTestServer, makeClient } from '../test-utils/server.js';

let close, api;

before(async () => {
  await resetTestDb();
  const server = await startTestServer();
  close = server.close;
  api = makeClient(server.baseUrl);
});

after(async () => {
  await close();
  await closeDb();
});

const owner = {
  fullName: 'Amina Youssef',
  email: 'amina@example.com',
  password: 'SopyDemo123',
  restaurantName: 'The Nile Bistro',
  country: 'Egypt',
  branchCount: 3,
  userCount: 8,
};

test('signup creates a tenant + business_owner user and returns a usable token', async () => {
  const res = await api('POST', '/api/auth/signup', { body: owner });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'business_owner');
  assert.equal(res.body.tenant.restaurant_name, owner.restaurantName);
  assert.equal(res.body.tenant.onboarding_step, 'configure_data');
  assert.ok(res.body.token);

  const me = await api('GET', '/api/auth/me', { token: res.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, owner.email);
});

test('signup with a duplicate email is rejected with 409, not a duplicate account', async () => {
  const res = await api('POST', '/api/auth/signup', { body: owner });
  assert.equal(res.status, 409);
});

test('login with the wrong password is rejected with 401', async () => {
  const res = await api('POST', '/api/auth/login', { body: { email: owner.email, password: 'wrong-password' } });
  assert.equal(res.status, 401);
});

test('login with correct credentials returns the same tenant', async () => {
  const res = await api('POST', '/api/auth/login', { body: { email: owner.email, password: owner.password } });
  assert.equal(res.status, 200);
  assert.equal(res.body.tenant.restaurant_name, owner.restaurantName);
});

// Backs the "Your profile" card on the account page. Email is left out
// on purpose — it's the login identity with a global unique index, so
// it must not be changeable through a profile edit.
test('a user can edit their own profile, but not their email', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: owner.email, password: owner.password } });
  const token = login.body.token;

  const res = await api('PATCH', '/api/auth/me', {
    token,
    body: { fullName: 'Amina Y. Hassan', title: 'Founder', phone: '+201234567890', email: 'hijack@example.com' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.fullName, 'Amina Y. Hassan');
  assert.equal(res.body.user.title, 'Founder');
  assert.equal(res.body.user.phone, '+201234567890');
  assert.equal(res.body.user.email, owner.email, 'email must be ignored by the profile edit');

  const me = await api('GET', '/api/auth/me', { token });
  assert.equal(me.body.user.fullName, 'Amina Y. Hassan');
  assert.equal(me.body.user.email, owner.email);
});

test('a profile edit cannot blank out the name', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: owner.email, password: owner.password } });
  const res = await api('PATCH', '/api/auth/me', { token: login.body.token, body: { fullName: '   ' } });
  assert.equal(res.status, 400);
});

test('protected routes reject requests with no token', async () => {
  const res = await api('GET', '/api/auth/me');
  assert.equal(res.status, 401);
});

test('protected routes reject a garbage token', async () => {
  const res = await api('GET', '/api/auth/me', { token: 'not-a-real-jwt' });
  assert.equal(res.status, 401);
});
