import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

export const databaseConfig = {
  url: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Supabase client for application queries
export const supabase = createClient(databaseConfig.supabaseUrl, databaseConfig.supabaseAnonKey, {
  db: {
    schema: 'app_auth', // Use custom auth schema instead of Supabase's built-in auth
  },
});

// Supabase admin client (service role) for privileged operations
export const supabaseAdmin = createClient(
  databaseConfig.supabaseUrl,
  databaseConfig.supabaseServiceRoleKey,
  {
    db: {
      schema: 'app_auth', // Use custom auth schema instead of Supabase's built-in auth
    },
  }
);

// PostgreSQL pool for raw SQL (migrations, complex queries)
export const pgPool = new Pool({
  connectionString: databaseConfig.url,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: process.env.NODE_ENV === 'test' ? 2000 : 10000,
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
