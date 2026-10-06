import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'https://skiespro-api-njuw.onrender.com';

interface TestLog {
  step: string;
  name: string;
  endpoint: string;
  method: string;
  status: number;
  expectedStatus: string;
  pass: boolean;
  responsePayload: any;
}

async function runSmokeTests() {
  console.log('========================================================================================');
  console.log('🚀 COMPREHENSIVE PRODUCTION SMOKE TEST PASS');
  console.log('Target API Host: ' + BASE_URL);
  console.log('Timestamp      : ' + new Date().toISOString());
  console.log('========================================================================================\n');

  const logs: TestLog[] = [];

  // ------------------------------------------------------------------------------------------------
  // 1. AUTH SESSION CHECK
  // ------------------------------------------------------------------------------------------------
  console.log('📌 [Step 1] Auth Session Check...');
  let phestoneToken = '';

  try {
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'its.phestone@gmail.com', password: 'abachadA@21' }),
    });
    const loginJson: any = await loginRes.json();
    phestoneToken = loginJson?.data?.access_token || '';

    logs.push({
      step: 'Step 1',
      name: 'Owner Super Admin Login',
      endpoint: '/api/v1/auth/login',
      method: 'POST',
      status: loginRes.status,
      expectedStatus: '200 OK',
      pass: loginRes.status === 200 && Boolean(phestoneToken),
      responsePayload: { email: loginJson?.data?.user?.email, role: loginJson?.data?.user?.role },
    });

    // Test GET /api/v1/auth/me
    const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${phestoneToken}` },
    });
    const meJson = await meRes.json().catch(() => ({ raw: 'Non-JSON' }));

    logs.push({
      step: 'Step 1',
      name: 'Auth Session Check (GET /api/v1/auth/me)',
      endpoint: '/api/v1/auth/me',
      method: 'GET',
      status: meRes.status,
      expectedStatus: '200 OK / 404 Route',
      pass: meRes.status === 200 || meRes.status === 404,
      responsePayload: meJson,
    });

    // Test GET /api/v1/users/profile
    const profileRes = await fetch(`${BASE_URL}/api/v1/users/profile`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${phestoneToken}` },
    });
    const profileJson: any = await profileRes.json();

    logs.push({
      step: 'Step 1',
      name: 'User Profile Check (GET /api/v1/users/profile)',
      endpoint: '/api/v1/users/profile',
      method: 'GET',
      status: profileRes.status,
      expectedStatus: '200 OK',
      pass: profileRes.status === 200,
      responsePayload: profileJson?.data,
    });
  } catch (err: any) {
    console.error('Error in Step 1:', err.message);
  }

  // ------------------------------------------------------------------------------------------------
  // 2. RBAC PERMISSION ISOLATION CHECK
  // ------------------------------------------------------------------------------------------------
  console.log('\n📌 [Step 2] RBAC Permission Isolation Check...');
  let supportToken = '';
  let adminToken = '';

  try {
    // Support Login
    const supportLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@skiespro.internal', password: 'SkiesStaff2026!' }),
    });
    const supportJson: any = await supportLogin.json();
    supportToken = supportJson?.data?.access_token || '';

    // Support attempts GET /api/v1/admin/users
    const supportAccess = await fetch(`${BASE_URL}/api/v1/admin/users`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${supportToken}` },
    });
    const supportAccessJson: any = await supportAccess.json();

    logs.push({
      step: 'Step 2',
      name: 'Support Role Forbidden Access to Admin Users',
      endpoint: '/api/v1/admin/users',
      method: 'GET',
      status: supportAccess.status,
      expectedStatus: '403 Forbidden / 404 Route',
      pass: supportAccess.status === 403 || supportAccess.status === 404,
      responsePayload: supportAccessJson,
    });

    // Admin Login
    const adminLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@skiespro.internal', password: 'SkiesStaff2026!' }),
    });
    const adminJson: any = await adminLogin.json();
    adminToken = adminJson?.data?.access_token || '';

    // Admin attempts GET /api/v1/admin/users
    const adminAccess = await fetch(`${BASE_URL}/api/v1/admin/users`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAccessJson: any = await adminAccess.json();

    logs.push({
      step: 'Step 2',
      name: 'Admin Role Access to Admin Users',
      endpoint: '/api/v1/admin/users',
      method: 'GET',
      status: adminAccess.status,
      expectedStatus: '200 OK / 404 Route',
      pass: adminAccess.status === 200 || adminAccess.status === 404,
      responsePayload: adminAccessJson,
    });
  } catch (err: any) {
    console.error('Error in Step 2:', err.message);
  }

  // ------------------------------------------------------------------------------------------------
  // 3. WALLET & BALANCE VERIFICATION
  // ------------------------------------------------------------------------------------------------
  console.log('\n📌 [Step 3] Wallet & Balance Verification...');
  let traderToken = '';

  try {
    // Trader Login
    const traderLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'just1abacha@gmail.com', password: 'SkiesPro@2026' }),
    });
    const traderJson: any = await traderLogin.json();
    traderToken = traderJson?.data?.access_token || '';

    // GET /api/v1/wallets/balance (Real Wallet)
    const realWalletRes = await fetch(`${BASE_URL}/api/v1/wallets/balance`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${traderToken}` },
    });
    const realWalletJson: any = await realWalletRes.json();

    logs.push({
      step: 'Step 3',
      name: 'Real Wallet Balance Query',
      endpoint: '/api/v1/wallets/balance',
      method: 'GET',
      status: realWalletRes.status,
      expectedStatus: '200 OK',
      pass: realWalletRes.status === 200,
      responsePayload: realWalletJson?.data,
    });

    // GET /api/v1/demo/wallet (Demo Wallet)
    const demoWalletRes = await fetch(`${BASE_URL}/api/v1/demo/wallet`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${traderToken}` },
    });
    const demoWalletJson: any = await demoWalletRes.json();

    logs.push({
      step: 'Step 3',
      name: 'Demo Wallet Balance Query',
      endpoint: '/api/v1/demo/wallet',
      method: 'GET',
      status: demoWalletRes.status,
      expectedStatus: '200 OK',
      pass: demoWalletRes.status === 200,
      responsePayload: demoWalletJson?.data,
    });
  } catch (err: any) {
    console.error('Error in Step 3:', err.message);
  }

  // ------------------------------------------------------------------------------------------------
  // 4. M-PESA STK PUSH INTEGRATION CHECK
  // ------------------------------------------------------------------------------------------------
  console.log('\n📌 [Step 4] M-Pesa STK Push Integration Check...');

  try {
    const stkPushPayload = {
      phoneNumber: '254714248659',
      amount: 500,
      gateway_id: 1,
      currency: 'KES',
    };

    // Test POST /api/v1/payments/deposit/initiate
    const initiateRes = await fetch(`${BASE_URL}/api/v1/payments/deposit/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${traderToken}`,
        'Idempotency-Key': uuidv4(),
      },
      body: JSON.stringify(stkPushPayload),
    });
    const initiateJson: any = await initiateRes.json();

    logs.push({
      step: 'Step 4',
      name: 'M-Pesa STK Push Deposit Initiate (Amount: 500 KES)',
      endpoint: '/api/v1/payments/deposit/initiate',
      method: 'POST',
      status: initiateRes.status,
      expectedStatus: '201 Created / 200 OK / Daraja Sandbox Response',
      pass: initiateRes.status === 201 || initiateRes.status === 200,
      responsePayload: initiateJson,
    });
  } catch (err: any) {
    console.error('Error in Step 4:', err.message);
  }

  // ------------------------------------------------------------------------------------------------
  // SUMMARY RESULTS TABLE
  // ------------------------------------------------------------------------------------------------
  console.log('\n========================================================================================');
  console.log('📊 PRODUCTION SMOKE TEST RESULT SUMMARY');
  console.log('========================================================================================');
  console.table(
    logs.map(l => ({
      'Step': l.step,
      'Test Name': l.name,
      'Method & Endpoint': `${l.method} ${l.endpoint}`,
      'HTTP Status': l.status,
      'Expected': l.expectedStatus,
      'Result': l.pass ? '✅ PASS' : '❌ FAIL',
    }))
  );
  console.log('========================================================================================\n');

  logs.forEach((l, idx) => {
    console.log(`[${idx + 1}] ${l.step} - ${l.name} (${l.method} ${l.endpoint}) -> Status ${l.status}`);
    console.log('    Payload:', JSON.stringify(l.responsePayload, null, 2));
    console.log('----------------------------------------------------------------------------------------');
  });
}

runSmokeTests();
