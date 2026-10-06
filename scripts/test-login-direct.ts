import { AuthService } from '../src/modules/auth/services/authService';
import dotenv from 'dotenv';

dotenv.config();

async function testLogin() {
  const authService = new AuthService();

  console.log('--- Testing direct authService.login ---');

  const emailsToTest = [
    { email: 'its.phestone@gmail.com', pass: 'abachadA@21' },
    { email: 'itsphestone@gmail.com', pass: 'abachadA@21' },
    { email: 'support@skiespro.internal', pass: 'SkiesStaff2026!' },
    { email: 'admin@skiespro.internal', pass: 'SkiesStaff2026!' },
    { email: 'just1abacha@gmail.com', pass: 'SkiesPro@2026' },
  ];

  for (const item of emailsToTest) {
    try {
      const res: any = await authService.login(item.email, item.pass, '127.0.0.1', 'test');
      if (res.user) {
        console.log(`✅ ${item.email} login SUCCESS! Token: ${res.access_token.substring(0, 15)}...`);
      } else {
        console.log(`⚠️ ${item.email} login returned non-token response:`, res);
      }
    } catch (err: any) {
      console.error(`❌ ${item.email} login ERROR:`, err.message);
    }
  }
}

testLogin();
