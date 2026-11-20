<div align="center">
  <h1>NearU</h1>
  <p><strong>Real connections. Right around campus.</strong></p>
  <p>Verified college-exclusive dating web application for GL Bajaj Institute of Technology & Management students.</p>
</div>

---

## Tech Stack
- **Frontend**: React 19, Tailwind CSS v4, Lucide React, Motion
- **Backend**: Node.js / Express with TypeScript (TSX)
- **Auth & Database**: Supabase (Auth + PostgreSQL with Drizzle ORM)
- **AI**: Google GenAI SDK (Gemini)

---

## Setup & Configuration

### 1. Prerequisites
- Node.js (v18+)
- A Supabase Project (with Google OAuth enabled if using Google Sign-In)

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Provide your Supabase and Gemini credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server verification).
- `DATABASE_URL` (or `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`): PostgreSQL connection details.
- `GEMINI_API_KEY`: Your Google Gemini API key.

### 3. Database Migration
Apply the database schema and RLS policies using Supabase SQL editor or CLI from:
```
supabase/migrations/001_nearu_schema_and_rls.sql
```

For the **Passed Profiles** feature, also apply (after 001; safe to re-run):
```
supabase/migrations/003_passed_profiles.sql
```
It reuses the existing `passes` table, adds an index, and replaces the broad passes policy with
explicit own-rows-only SELECT / INSERT / DELETE policies (no UPDATE).

### 4. Run Locally
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```
