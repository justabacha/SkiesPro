import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

export const databaseConfig = {
  get url() {
    return process.env.DATABASE_URL || '';
  },
  get supabaseUrl() {
    return process.env.SUPABASE_URL || '';
  },
  get supabaseAnonKey() {
    return process.env.SUPABASE_ANON_KEY || '';
  },
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  },
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
  max: Number.parseInt(process.env.DB_POOL_MAX || '15', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pgPool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
