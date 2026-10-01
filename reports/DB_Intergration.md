# Supabase Integration & Configuration Report - SkiesPro

This document provides a comprehensive review of the Supabase integration within the SkiesPro project, documenting current configurations and providing recommendations for Kotlin-based applications to achieve similar seamless integration.

## 1. Current Supabase Configuration

The SkiesPro project integrates Supabase as its primary backend-as-a-service (BaaS), providing PostgreSQL database hosting, authentication (via custom schemas), and object storage.

### 1.1 Environment Variables
Configuration is centralized in the `.env` file at the project root:

| Variable | Description | Usage |
|----------|-------------|-------|
| `DATABASE_URL` | PostgreSQL Connection String | Used for direct DB connections (Transaction Pooler). |
| `SUPABASE_URL` | Project API URL | Used by Supabase SDK for PostgREST/Storage. |
| `SUPABASE_ANON_KEY` | Anonymous API Key | Client-side access with RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API Key | Server-side bypass of RLS (Internal services). |

### 1.2 Client Initialization
The application initializes two Supabase clients and a PostgreSQL pool in `src/config/database.ts`:

- **`supabase`**: Standard client using `SUPABASE_ANON_KEY`. Configured to use the `app_auth` schema.
- **`supabaseAdmin`**: Privileged client using `SUPABASE_SERVICE_ROLE_KEY`.
- **`pgPool`**: A `pg.Pool` instance for raw SQL execution, used for migrations and performance-critical queries.

### 1.3 Schema Strategy
SkiesPro uses a custom schema approach:
- **`app_auth`**: Houses user authentication and profile data, isolated from Supabase's internal `auth` schema to maintain control over user logic while leveraging Supabase infrastructure.
- **`trading`**: Houses domain-specific trading data (contracts, assets, etc.).

### 1.4 Migration Management
Migrations are handled via a custom TypeScript runner:
- **Location**: `migrations/*.sql`
- **Runner**: `scripts/run-migrations.ts`
- **Execution**: `npm run migrate`
This script uses the `DATABASE_URL` to execute SQL files sequentially against the Supabase instance.

---

## 2. Terminal & Agent Workspace Access

To access the database from the terminal or an AI agent workspace without using the Supabase Dashboard:

### 2.1 Direct SQL Access (psql)
You can connect directly using the `DATABASE_URL`:
```bash
psql "postgresql://postgres.sajkjbbhhblafhelesey:SkiesPro2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

### 2.2 Using Node.js Scripts
The project includes utility scripts for checking the database:
- `node scripts/check-constraints.js`: Inspects database constraints.
- `npm run migrate`: Applies pending migrations.

### 2.3 Supabase CLI (Recommended)
While not currently initialized in the project root, the Supabase CLI can be used:
1. **Install**: `npm install supabase --save-dev`
2. **Login**: `npx supabase login`
3. **Link**: `npx supabase link --project-ref sajkjbbhhblafhelesey`
4. **DB Pull**: `npx supabase db pull` (Generates local schema representation)

---

## 3. Recommendation for Kotlin Developers

For a user building a Kotlin application, the following setup is recommended to replicate this "IDE-first" workflow.

### 3.1 IDE Database Integration (IntelliJ IDEA)
Instead of the dashboard, use the **Database Tool Window**:
1. Open **View > Tool Windows > Database**.
2. Click **+ > Data Source > PostgreSQL**.
3. Use the `DATABASE_URL` components:
   - **Host**: `aws-0-us-east-1.pooler.supabase.com`
   - **Port**: `6543`
   - **User**: `postgres.sajkjbbhhblafhelesey`
   - **Password**: `SkiesPro2026`
4. This allows you to run SQL, view tables, and manage data directly within IntelliJ.

### 3.2 Kotlin Libraries
- **[supabase-kt](https://github.com/supabase-community/supabase-kt)**: The official-community SDK for Kotlin. It supports Auth, Functions, PostgREST, and Storage.
  ```kotlin
  val supabase = createSupabaseClient(
      supabaseUrl = System.getenv("SUPABASE_URL"),
      supabaseKey = System.getenv("SUPABASE_ANON_KEY")
  ) {
      install(Postgrest)
      install(Storage)
  }
  ```
- **Exposed / SQLDelight**: For type-safe SQL queries using the direct PostgreSQL connection.

### 3.3 Automated Migrations in Kotlin
Use **Flyway** or **Liquibase** to manage migrations:
1. Place `.sql` migrations in `src/main/resources/db/migration`.
2. Configure Flyway to use the `DATABASE_URL`.
3. Migrations will run automatically when the Kotlin app starts, or via Gradle tasks (`./gradlew flywayMigrate`).

### 3.4 Environment Management
Use `github.com/cdimascio/dotenv-kotlin` to load the `.env` file in your Kotlin project, ensuring consistency with the existing Node.js setup.

---

## 4. Summary of Recommendations

1. **Centralize Config**: Keep all Supabase credentials in a `.env` file.
2. **Dual Access Path**: 
   - Use the **SDK** for standard CRUD and Storage.
   - Use **JDBC/Direct Pool** for complex queries and migrations.
3. **Internalize Tooling**: Use the Supabase CLI and IntelliJ Database tools to minimize reliance on the web dashboard.
4. **Custom Schemas**: Continue using specialized schemas (like `app_auth` and `trading`) to keep the `public` schema clean and avoid conflicts with Supabase internals.
