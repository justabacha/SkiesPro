#!/usr/bin/env ts-node
/**
 * Migration Runner Script
 * 
 * This script runs SQL migration files against the database.
 * It reads migrations from the migrations/ directory and executes them in order.
 * 
 * Usage:
 *   npm run migrate              # Run all pending migrations
 *   npm run migrate:up 001       # Run specific migration
 * 
 * Environment Variables Required:
 *   DATABASE_URL - PostgreSQL connection string
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Create PostgreSQL pool directly for migrations
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

interface Migration {
  filename: string;
  filepath: string;
  version: string;
}

/**
 * Get all migration files sorted by version
 */
function getMigrations(): Migration[] {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  return files.map(filename => ({
    filename,
    filepath: path.join(MIGRATIONS_DIR, filename),
    version: filename.split('_')[0]
  }));
}

/**
 * Execute a single migration file
 */
async function runMigration(migration: Migration): Promise<void> {
  console.log(`Running migration: ${migration.filename}`);
  
  const sql = fs.readFileSync(migration.filepath, 'utf-8');
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ Migration ${migration.filename} completed`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Migration ${migration.filename} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all migrations
 */
async function runAllMigrations(): Promise<void> {
  const migrations = getMigrations();
  
  if (migrations.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  console.log(`Found ${migrations.length} migration files.`);
  
  for (const migration of migrations) {
    try {
      await runMigration(migration);
    } catch (error) {
      console.error('Migration failed. Stopping execution.');
      process.exit(1);
    }
  }
  
  console.log('All migrations completed successfully.');
}

/**
 * Run a specific migration by version
 */
async function runSpecificMigration(version: string): Promise<void> {
  const migrations = getMigrations();
  const migration = migrations.find(m => m.version === version);
  
  if (!migration) {
    console.error(`Migration ${version} not found.`);
    process.exit(1);
  }
  
  await runMigration(migration);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await runAllMigrations();
  } else if (args[0] === 'up' && args[1]) {
    await runSpecificMigration(args[1]);
  } else {
    console.log('Usage:');
    console.log('  npm run migrate              # Run all migrations');
    console.log('  npm run migrate:up <version> # Run specific migration');
    process.exit(1);
  }
  
  await pgPool.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
