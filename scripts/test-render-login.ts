const RENDER_URL = 'https://skiespro-api-njuw.onrender.com';

async function testRender() {
  const cases = [
    { name: 'Phestone with dot', email: 'its.phestone@gmail.com', pass: 'abachadA@21' },
    { name: 'Phestone no dot', email: 'itsphestone@gmail.com', pass: 'abachadA@21' },
    { name: 'Support', email: 'support@skiespro.internal', pass: 'SkiesStaff2026!' },
    { name: 'Admin', email: 'admin@skiespro.internal', pass: 'SkiesStaff2026!' },
    { name: 'Trader Abacha', email: 'just1abacha@gmail.com', pass: 'SkiesPro@2026' },
  ];

  for (const c of cases) {
    console.log(`\nTesting ${c.name} (${c.email})...`);
    const res = await fetch(`${RENDER_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: c.email, password: c.pass }),
    });

    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
  }
}

testRender();
