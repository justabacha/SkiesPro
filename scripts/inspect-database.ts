import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 10000,
});

interface TableInfo {
  schema: string;
  table: string;
  rowCount: number;
}

interface ColumnInfo {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
}

interface FKInfo {
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
}

interface RLSStatus {
  schemaName: string;
  tableName: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
}

interface PolicyInfo {
  schemaName: string;
  tableName: string;
  policyName: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  withCheck: string | null;
}

async function runInspection() {
  console.log('Starting Database Inspection...');
  const client = await pool.connect();

  try {
    // 1. Fetch all tables across all custom schemas
    const tablesRes = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name;
    `);

    const tableList: TableInfo[] = [];
    for (const row of tablesRes.rows) {
      const schema = row.table_schema;
      const table = row.table_name;
      try {
        const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "${schema}"."${table}"`);
        tableList.push({
          schema,
          table,
          rowCount: countRes.rows[0]?.count ?? 0,
        });
      } catch (err: any) {
        console.warn(`Could not count rows for ${schema}.${table}:`, err.message);
        tableList.push({
          schema,
          table,
          rowCount: -1,
        });
      }
    }

    // 2. Fetch Columns Info
    const columnsRes = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name, ordinal_position;
    `);

    const columnsList: ColumnInfo[] = columnsRes.rows.map(r => ({
      schema: r.table_schema,
      table: r.table_name,
      column: r.column_name,
      dataType: r.data_type,
      isNullable: r.is_nullable,
      columnDefault: r.column_default,
    }));

    // 3. Fetch Foreign Key Dependencies
    const fkRes = await client.query(`
      SELECT
        tc.table_schema AS source_schema,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_schema AS target_schema,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY tc.table_schema, tc.table_name, kcu.column_name;
    `);

    const fkList: FKInfo[] = fkRes.rows.map(r => ({
      sourceSchema: r.source_schema,
      sourceTable: r.source_table,
      sourceColumn: r.source_column,
      targetSchema: r.target_schema,
      targetTable: r.target_table,
      targetColumn: r.target_column,
      constraintName: r.constraint_name,
    }));

    // 4. Fetch RLS Status
    const rlsRes = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY n.nspname, c.relname;
    `);

    const rlsStatusList: RLSStatus[] = rlsRes.rows.map(r => ({
      schemaName: r.schema_name,
      tableName: r.table_name,
      rlsEnabled: r.rls_enabled,
      rlsForced: r.rls_forced,
    }));

    // 5. Fetch RLS Policies
    const policiesRes = await client.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schemaname, tablename, policyname;
    `);

    const policyList: PolicyInfo[] = policiesRes.rows.map(r => ({
      schemaName: r.schemaname,
      tableName: r.tablename,
      policyName: r.policyname,
      permissive: r.permissive,
      roles: r.roles || [],
      cmd: r.cmd,
      qual: r.qual,
      withCheck: r.with_check,
    }));

    // 6. Registered Users in `app_auth.users`
    let usersData: any[] = [];
    try {
      const usersRes = await client.query(`
        SELECT *
        FROM app_auth.users
        ORDER BY created_at DESC;
      `);
      usersData = usersRes.rows;
    } catch (err: any) {
      console.warn('Could not query app_auth.users:', err.message);
    }

    // 7. Sample Data from Core Tables
    const sampleDataMap: Record<string, any[]> = {};
    const keyTablesToSample = [
      { schema: 'admin', table: 'audit_logs' },
      { schema: 'admin', table: 'admin_actions' },
      { schema: 'admin', table: 'support_tickets' },
      { schema: 'admin', table: 'system_jobs' },
      { schema: 'wallet', table: 'wallets' },
      { schema: 'wallet', table: 'ledger_entries' },
      { schema: 'wallet', table: 'bank_accounts' },
      { schema: 'compliance', table: 'kyc_documents' },
      { schema: 'compliance', table: 'sanctions_checks' },
      { schema: 'trading', table: 'contracts' },
      { schema: 'trading', table: 'orders' },
      { schema: 'trading', table: 'positions' },
      { schema: 'trading', table: 'trades' },
      { schema: 'payments', table: 'deposits' },
      { schema: 'payments', table: 'withdrawals' },
    ];

    for (const item of keyTablesToSample) {
      const fullKey = `${item.schema}.${item.table}`;
      const exists = tableList.some(t => t.schema === item.schema && t.table === item.table);
      if (exists) {
        try {
          const sampleRes = await client.query(`
            SELECT * FROM "${item.schema}"."${item.table}"
            LIMIT 5;
          `);
          sampleDataMap[fullKey] = sampleRes.rows;
        } catch (err: any) {
          sampleDataMap[fullKey] = [{ error: err.message }];
        }
      }
    }

    // Also sample any other table that has rowCount > 0 but isn't in keyTablesToSample
    for (const t of tableList) {
      const fullKey = `${t.schema}.${t.table}`;
      if (t.rowCount > 0 && !sampleDataMap[fullKey] && t.schema !== 'app_auth') {
        try {
          const sampleRes = await client.query(`
            SELECT * FROM "${t.schema}"."${t.table}"
            LIMIT 5;
          `);
          sampleDataMap[fullKey] = sampleRes.rows;
        } catch (err: any) {
          sampleDataMap[fullKey] = [{ error: err.message }];
        }
      }
    }

    // Generate Markdown Report
    let md = `# DATABASE INSPECTION SNAPSHOT

> **Generated At**: ${new Date().toISOString()}
> **Environment**: ${process.env.NODE_ENV || 'development'}
> **Database Host / Connection**: ${connectionString.replace(/:[^:@]+@/, ':****@')}
> **Diagnostic Mode**: Strictly Read-Only

---

## §1 Executive Summary

| Metric | Value |
|--------|-------|
| **Total Custom Schemas** | ${Array.from(new Set(tableList.map(t => t.schema))).length} |
| **Total Tables** | ${tableList.length} |
| **Total Foreign Keys** | ${fkList.length} |
| **Total Active RLS Policies** | ${policyList.length} |
| **Registered Users Count** | ${usersData.length} |

---

## §2 Schema & Table Inventory (With Exact Row Counts)

`;

    // Group tables by schema
    const schemas = Array.from(new Set(tableList.map(t => t.schema))).sort();
    for (const sch of schemas) {
      md += `### Schema: \`${sch}\`\n\n`;
      md += `| Table Name | Row Count | RLS Enabled | RLS Forced |\n`;
      md += `|------------|-----------|-------------|------------|\n`;
      const schTables = tableList.filter(t => t.schema === sch);
      for (const t of schTables) {
        const rls = rlsStatusList.find(r => r.schemaName === sch && r.tableName === t.table);
        const rlsStr = rls ? (rls.rlsEnabled ? '✅ YES' : '❌ NO') : 'N/A';
        const forcedStr = rls ? (rls.rlsForced ? '✅ YES' : '❌ NO') : 'N/A';
        const countStr = t.rowCount === -1 ? 'ERROR' : t.rowCount.toLocaleString();
        md += `| \`${t.table}\` | **${countStr}** | ${rlsStr} | ${forcedStr} |\n`;
      }
      md += `\n`;
    }

    md += `---

## §3 Registered Users (\`app_auth.users\`)

Total registered users in \`app_auth.users\`: **${usersData.length}**

`;

    if (usersData.length === 0) {
      md += `*No registered users found in \`app_auth.users\`.*\n\n`;
    } else {
      const sampleUserKeys = Object.keys(usersData[0] || {});
      md += `Columns present: \`${sampleUserKeys.join(', ')}\`\n\n`;
      md += `| # | User ID | Email | Role/Type | Status | Confirmed/Verified | Created At |\n`;
      md += `|---|---------|-------|-----------|--------|--------------------|------------|\n`;
      usersData.forEach((u, idx) => {
        const roleVal = u.role || u.user_role || u.role_id || 'N/A';
        const statusVal = u.status || u.account_status || 'N/A';
        const confirmedVal = u.email_confirmed_at || u.is_email_verified || u.verified || 'N/A';
        md += `| ${idx + 1} | \`${u.id}\` | \`${u.email}\` | \`${roleVal}\` | \`${statusVal}\` | ${confirmedVal instanceof Date ? confirmedVal.toISOString() : confirmedVal} | ${u.created_at ? new Date(u.created_at).toISOString() : 'N/A'} |\n`;
      });
      md += `\n`;
    }

    md += `---

## §4 Foreign Key Dependency Tree & Identity Table References

### §4.1 Incoming & Outgoing FKs Referencing \`app_auth.users\`

`;

    const appAuthUsersFKs = fkList.filter(
      fk => (fk.targetSchema === 'app_auth' && fk.targetTable === 'users') ||
            (fk.sourceSchema === 'app_auth' && fk.sourceTable === 'users')
    );

    if (appAuthUsersFKs.length === 0) {
      md += `*No foreign keys directly referencing \`app_auth.users\` found.*\n\n`;
    } else {
      md += `| Direction | Source Table | Source Column | Target Table | Target Column | Constraint Name |\n`;
      md += `|-----------|--------------|---------------|--------------|---------------|-----------------|\n`;
      appAuthUsersFKs.forEach(fk => {
        const dir = (fk.targetSchema === 'app_auth' && fk.targetTable === 'users')
          ? '➡️ References `app_auth.users`'
          : '⬅️ From `app_auth.users`';
        md += `| ${dir} | \`${fk.sourceSchema}.${fk.sourceTable}\` | \`${fk.sourceColumn}\` | \`${fk.targetSchema}.${fk.targetTable}\` | \`${fk.targetColumn}\` | \`${fk.constraintName}\` |\n`;
      });
      md += `\n`;
    }

    md += `### §4.2 Complete Database Foreign Key Relationships

`;

    if (fkList.length === 0) {
      md += `*No foreign keys found in database.*\n\n`;
    } else {
      md += `| Source Schema.Table | Source Column | Target Schema.Table | Target Column | Constraint Name |\n`;
      md += `|---------------------|---------------|---------------------|---------------|-----------------|\n`;
      fkList.forEach(fk => {
        md += `| \`${fk.sourceSchema}.${fk.sourceTable}\` | \`${fk.sourceColumn}\` | \`${fk.targetSchema}.${fk.targetTable}\` | \`${fk.targetColumn}\` | \`${fk.constraintName}\` |\n`;
      });
      md += `\n`;
    }

    md += `---

## §5 Row Level Security (RLS) Policies

Total Policies Defined: **${policyList.length}**

`;

    if (policyList.length === 0) {
      md += `*No active RLS policies (\`pg_policies\`) found in custom schemas.*\n\n`;
    } else {
      md += `| Schema | Table | Policy Name | Permissive | Command | Roles | Definition / Expression |\n`;
      md += `|--------|-------|-------------|------------|---------|-------|------------------------|\n`;
      policyList.forEach(p => {
        const rolesStr = p.roles.length > 0 ? p.roles.join(', ') : 'ALL';
        const qualStr = (p.qual || p.withCheck || 'N/A').replace(/\n/g, ' ');
        md += `| \`${p.schemaName}\` | \`${p.tableName}\` | \`${p.policyName}\` | ${p.permissive} | \`${p.cmd}\` | \`${rolesStr}\` | \`${qualStr}\` |\n`;
      });
      md += `\n`;
    }

    md += `---

## §6 Sample Data Snapshot Across Core Schemas

`;

    for (const [tableKey, rows] of Object.entries(sampleDataMap)) {
      md += `### Table: \`${tableKey}\` (Sample Rows: ${rows.length})\n\n`;
      if (rows.length === 0) {
        md += `*Table is empty (0 rows).*\n\n`;
      } else if (rows[0] && rows[0].error) {
        md += `*Error querying sample data: ${rows[0].error}*\n\n`;
      } else {
        md += `\`\`\`json\n${JSON.stringify(rows, null, 2)}\n\`\`\`\n\n`;
      }
    }

    md += `---

## §7 Detailed Column Inventory

`;

    for (const sch of schemas) {
      md += `<details>\n<summary><b>Schema: ${sch} Columns Detail</b></summary>\n\n`;
      const schTables = tableList.filter(t => t.schema === sch);
      for (const t of schTables) {
        md += `#### Table: \`${sch}.${t.table}\`\n\n`;
        md += `| Column Name | Data Type | Is Nullable | Default |\n`;
        md += `|-------------|-----------|-------------|---------|\n`;
        const cols = columnsList.filter(c => c.schema === sch && c.table === t.table);
        for (const c of cols) {
          md += `| \`${c.column}\` | \`${c.dataType}\` | ${c.isNullable} | \`${c.columnDefault ?? 'NULL'}\` |\n`;
        }
        md += `\n`;
      }
      md += `</details>\n\n`;
    }

    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, 'DATABASE_INSPECTION_SNAPSHOT.md');
    fs.writeFileSync(reportPath, md, 'utf-8');

    console.log(`\n✅ Database Inspection Complete!`);
    console.log(`Report generated successfully at: ${reportPath}`);

  } catch (error) {
    console.error('Fatal error during database inspection:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runInspection();
