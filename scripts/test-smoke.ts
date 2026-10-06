import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'https://skiespro-api-njuw.onrender.com';

async function testAll() {
  console.log('=== TESTING RENDER PRODUCTION API ===\n');

  // Test 1: Auth Session Check
  console.log('--- 1. Auth Session Check ---');
  const loginRes1 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'its.phestone@gmail.com', password: 'abachadA@21' }),
  });
  console.log(`Login status: ${loginRes1.status}`);
  const loginData1: any = await loginRes1.json();
  const token1 = loginData1?.data?.access_token || loginData1?.data?.token;
  console.log(`Token obtained: ${token1 ? 'YES' : 'NO'}`);

  const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`GET /api/v1/auth/me status: ${meRes.status}`);
  console.log(`Payload:`, await meRes.text());

  const profileRes = await fetch(`${BASE_URL}/api/v1/users/profile`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`GET /api/v1/users/profile status: ${profileRes.status}`);
  console.log(`Payload:`, await profileRes.text());

  // Test 2: RBAC Check
  console.log('\n--- 2. RBAC Check ---');
  const loginSupport = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'support@skiespro.internal', password: 'SkiesStaff2026!' }),
  });
  console.log(`Login support status: ${loginSupport.status}`);
  const supportData: any = await loginSupport.json();
  const supportToken = supportData?.data?.access_token || supportData?.data?.token;

  const supportAdminUsers = await fetch(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${supportToken}` },
  });
  console.log(`Support GET /api/v1/admin/users status: ${supportAdminUsers.status}`);
  console.log(`Payload:`, await supportAdminUsers.text());

  const loginAdmin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@skiespro.internal', password: 'SkiesStaff2026!' }),
  });
  console.log(`Login admin status: ${loginAdmin.status}`);
  const adminData: any = await loginAdmin.json();
  const adminToken = adminData?.data?.access_token || adminData?.data?.token;

  const adminUsers = await fetch(`${BASE_URL}/api/v1/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken || token1}` },
  });
  console.log(`Admin GET /api/v1/admin/users status: ${adminUsers.status}`);
  console.log(`Payload:`, await adminUsers.text());

  // Test 3: Wallet Verification
  console.log('\n--- 3. Wallet Verification ---');
  const loginTrader = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'just1abacha@gmail.com', password: 'SkiesPro@2026' }),
  });
  console.log(`Login trader status: ${loginTrader.status}`);
  const traderData: any = await loginTrader.json();
  const traderToken = traderData?.data?.access_token || traderData?.data?.token;

  const walletRes1 = await fetch(`${BASE_URL}/api/v1/wallets`, {
    headers: { Authorization: `Bearer ${traderToken}` },
  });
  console.log(`GET /api/v1/wallets status: ${walletRes1.status}`);
  console.log(`Payload:`, await walletRes1.text());

  const walletRes2 = await fetch(`${BASE_URL}/api/v1/wallets/balance`, {
    headers: { Authorization: `Bearer ${traderToken}` },
  });
  console.log(`GET /api/v1/wallets/balance status: ${walletRes2.status}`);
  console.log(`Payload:`, await walletRes2.text());

  // Test 4: M-Pesa STK Push Check
  console.log('\n--- 4. M-Pesa STK Push Check ---');
  const stk1 = await fetch(`${BASE_URL}/api/v1/payments/deposit/stkpush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${traderToken}`,
      'Idempotency-Key': uuidv4(),
    },
    body: JSON.stringify({ phoneNumber: '254714248659', amount: 100 }),
  });
  console.log(`POST /api/v1/payments/deposit/stkpush status: ${stk1.status}`);
  console.log(`Payload:`, await stk1.text());

  const stk2 = await fetch(`${BASE_URL}/api/v1/payments/deposit/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${traderToken}`,
      'Idempotency-Key': uuidv4(),
    },
    body: JSON.stringify({ phoneNumber: '254714248659', amount: 100, gateway_id: 1, currency: 'KES' }),
  });
  console.log(`POST /api/v1/payments/deposit/initiate status: ${stk2.status}`);
  console.log(`Payload:`, await stk2.text());
}

testAll();
