import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || '';

if (!dbUrl) {
  console.error('❌ Missing environment variable: DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function seedPaymentGateways() {
  console.log('--- Step 3: WP-15 Seed & Configure Payment Gateways (M-Pesa) ---\n');

  const client = await pool.connect();

  try {
    const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    const shortcode = process.env.MPESA_SHORTCODE || process.env.MPESA_BUSINESS_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || '';
    const consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    const callbackUrl = process.env.MPESA_CALLBACK_URL || '';
    const initiatorName = process.env.MPESA_INITIATOR_NAME || 'testapi';
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL || 'SandboxSecurityCredential';

    const configPayload = {
      environment,
      shortcode,
      passkey,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      callback_url: callbackUrl,
      initiator_name: initiatorName,
      security_credential: securityCredential,
    };

    console.log('🔍 Validating M-Pesa configuration keys...');
    const keyFields: (keyof typeof configPayload)[] = [
      'environment',
      'shortcode',
      'passkey',
      'consumer_key',
      'consumer_secret',
      'callback_url',
      'initiator_name',
      'security_credential',
    ];

    const emptyFields = keyFields.filter((f) => !configPayload[f]);

    if (emptyFields.length > 0) {
      console.warn(`⚠️ Warning: The following config fields are empty: ${emptyFields.join(', ')}`);
    } else {
      console.log('✅ All key M-Pesa configuration fields are non-empty.');
    }

    console.log('\n🔄 Updating payments.payment_gateways in database...');

    let res = await client.query(
      `UPDATE payments.payment_gateways
       SET config = $1::jsonb,
           is_active = TRUE
       WHERE LOWER(name) = 'm-pesa' OR LOWER(name) = 'mpesa'
       RETURNING *`,
      [JSON.stringify(configPayload)]
    );

    if (res.rows.length === 0) {
      console.log('➕ Gateway not found. Inserting new M-Pesa gateway record...');
      res = await client.query(
        `INSERT INTO payments.payment_gateways (name, provider_type, is_active, config)
         VALUES ('M-Pesa', 'mobile_money', TRUE, $1::jsonb)
         RETURNING *`,
        [JSON.stringify(configPayload)]
      );
    }

    const updatedGateway = res.rows[0];
    console.log('\n========================================================================================');
    console.log('🎉 M-PESA PAYMENT GATEWAY CONFIGURATION SUMMARY');
    console.log('========================================================================================');
    console.log(`ID:            ${updatedGateway.id}`);
    console.log(`Name:          ${updatedGateway.name}`);
    console.log(`Provider Type: ${updatedGateway.provider_type}`);
    console.log(`Is Active:     ${updatedGateway.is_active}`);
    console.log('Config Payload:');
    const redactedConfig = {
      ...updatedGateway.config,
      passkey: updatedGateway.config.passkey ? '***REDACTED***' : '',
      consumer_key: updatedGateway.config.consumer_key ? '***REDACTED***' : '',
      consumer_secret: updatedGateway.config.consumer_secret ? '***REDACTED***' : '',
      security_credential: updatedGateway.config.security_credential ? '***REDACTED***' : '',
    };
    console.dir(redactedConfig, { depth: null });
    console.log('========================================================================================\n');

  } catch (err: any) {
    console.error('❌ Error configuring payment gateways:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPaymentGateways();
