# GenLayer-Chatbot

Closed-domain GenLayer chatbot with:
- Gemini embeddings + answer generation
- Supabase/PostgreSQL + pgvector retrieval
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
4. Run database migration from `supabase/migrations/001_init.sql`.

## 2. Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
NEXTAUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
DATABASE_URL=
SQL_CONSOLE_ENABLED=false
```

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
- `GET|POST /api/admin/entries`
- `PUT|DELETE /api/admin/entries/:id`
- `GET /api/admin/chats`
- `POST /api/admin/sql` (requires `SQL_CONSOLE_ENABLED=true`)
- `GET|POST /api/auth/[...nextauth]`
