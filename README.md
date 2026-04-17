# GenLayer-Chatbot

Closed-domain GenLayer chatbot with:
- deterministic retrieval with optional OpenAI/Gemini synthesis for richer chat answers
- Supabase/PostgreSQL full-text + fuzzy ranking
- Public chat UI with answer sources
- Protected admin dashboard
- Admin database management via CRUD and SQL console

## 1. Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```
3. Fill `.env.local` values.
4. Run database migrations from:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_extractive_search.sql`

## 2. Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
NEXTAUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
DATABASE_URL=
SQL_CONSOLE_ENABLED=false
BOOTSTRAP_TOKEN=
```

`OPENAI_API_KEY` and `GEMINI_API_KEY` are optional. If both exist, OpenAI is used first; Gemini is fallback. If neither exists, extractive mode is used.

Generate `ADMIN_PASSWORD_HASH`:
```bash
node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" "your-admin-password"
```

## 3. Development

```bash
npm run dev
```

Open:
- `/` public chat
- `/admin/login` admin login
- `/admin/dashboard` admin dashboard

## 4. API Surface

- `POST /api/chat`
- `GET /api/suggestions`
- `GET|POST /api/admin/entries`
- `PUT|DELETE /api/admin/entries/:id`
- `GET /api/admin/chats`
- `POST /api/admin/sql` (requires `SQL_CONSOLE_ENABLED=true`)
- `POST /api/bootstrap` (requires `x-bootstrap-token`, runs DB schema bootstrap)
- `GET|POST /api/auth/[...nextauth]`
