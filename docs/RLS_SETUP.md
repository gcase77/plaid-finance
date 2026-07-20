# Row Level Security (RLS) Setup Guide

This guide explains how to configure Prisma to respect Supabase Row Level Security (RLS) policies.

## Overview

Row Level Security (RLS) is a database-level security feature that restricts which rows users can access in database tables. By default, Prisma connections bypass RLS because they use a service role connection. This guide shows you how to make Prisma respect RLS policies.

## Current Implementation

Your application uses a **dual-layer security approach**:

### 1. Application-Level Filtering (Default)

The `createUserScopedClient()` function automatically filters queries by `user_id` at the application level. This provides:
- ✅ Better performance (no RLS overhead)
- ✅ Works immediately without additional setup
- ✅ Prevents accidental data leakage in your application code

**How it works:**
```typescript
// Automatically adds user_id filters to all queries
const items = await req.prisma.items.findMany(); 
// Becomes: SELECT * FROM items WHERE user_id = $1
```

### 2. Database-Level RLS (Opt-in)

For operations requiring strict database-level security, you can use the `$withRls()` method:
- ✅ Enforced at the database level
- ✅ Cannot be bypassed by application code
- ✅ Additional layer of security for sensitive operations

**How it works:**
```typescript
// Executes within a transaction with RLS context
const items = await req.prisma.$withRls(async (tx) => {
  return await tx.items.findMany();
});
```

## Prerequisites

Before RLS will work, you must:

1. ✅ **RLS is enabled** (already done via migration `20260301014721_rls_user_sync_func`)
2. ❌ **RLS policies are NOT yet created** (you need to do this)

## Step 1: Apply RLS Policies

RLS policies define **who** can access **what** data. Apply them via the Supabase SQL Editor:

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `prisma/rls-policies.sql`
4. Paste and execute the SQL

This will create policies for all tables that ensure users can only access their own data.

## Step 2: Verify RLS is Working

After applying the policies, verify they're active:

```sql
-- Check that RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

## Step 3: Update Your Connection String (Optional)

### Current Setup
You're currently using `DATABASE_URL` which likely points to a **pooler connection** (transaction mode). This is fine and will continue to work.

### Option A: Keep Using Transaction Mode (Recommended)
Continue using your current `DATABASE_URL`. The application-level filtering provides good security, and you can opt-in to RLS when needed with `$withRls()`.

### Option B: Use Session Mode for Full RLS
If you want **all** Prisma queries to respect RLS by default, change your connection string:

1. In Supabase Dashboard → **Settings** → **Database**
2. Find your **Session Pooler** connection string (port 5432, not 6543)
3. Update your `.env`:
   ```
   DATABASE_URL="postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1"
   ```

**Note:** Session mode has different performance characteristics. We recommend Option A (keeping transaction mode + application-level filtering).

## Usage Patterns

### Default: Application-Level Filtering

Most of your code already uses this automatically:

```typescript
// In your route handlers
app.get("/api/items", async (req: ServerRequest, res) => {
  // req.prisma is automatically scoped to the authenticated user
  const items = await req.prisma.items.findMany();
  res.json(items);
});
```

### Opt-in: Database-Level RLS

Use this for sensitive operations or when you need absolute certainty:

```typescript
// For sensitive financial operations
app.post("/api/transfer", async (req: ServerRequest, res) => {
  const result = await req.prisma.$withRls(async (tx) => {
    // Both queries are protected by database-level RLS
    const fromAccount = await tx.accounts.findUnique({ 
      where: { id: req.body.fromAccountId } 
    });
    const toAccount = await tx.accounts.findUnique({ 
      where: { id: req.body.toAccountId } 
    });
    
    // ... perform transfer logic
    return { success: true };
  });
  
  res.json(result);
});
```

### When to Use Each Approach

| Scenario | Use |
|----------|-----|
| Standard CRUD operations | Application-level (default) |
| High-performance batch operations | Application-level (default) |
| Sensitive financial transactions | `$withRls()` |
| Operations requiring audit trail | `$withRls()` |
| Multi-tenant data access | `$withRls()` |
| Admin operations (via service role) | Neither (use `prisma` directly) |

## Understanding the Security Model

### Application-Level Filtering
```
User Request → Auth Middleware → createUserScopedClient(userId) 
→ Prisma Extension adds WHERE user_id = userId → Database
```

**Pros:**
- Fast (no RLS computation overhead)
- Works with connection pooling
- Easier to debug

**Cons:**
- Can be bypassed if you accidentally use the wrong client
- No protection against SQL injection in raw queries

### Database-Level RLS
```
User Request → Auth Middleware → $withRls() 
→ SET request.jwt.claims → Prisma Query → Database checks RLS policies
```

**Pros:**
- Cannot be bypassed by application code
- Protects against SQL injection
- Defense in depth

**Cons:**
- Slightly slower (RLS policy evaluation)
- Requires session mode or per-transaction setup
- More complex to debug

## Troubleshooting

### "No rows returned" when I expect data

This means RLS is working! Check:
1. Are policies applied correctly? Run the verification queries from Step 2
2. Is the user authenticated? Check `auth.user_id()` returns the correct UUID
3. Does the data actually belong to this user? Check the `user_id` column

### Queries work without `$withRls()` but fail with it

The application-level filtering is more permissive. This could mean:
1. RLS policies are stricter than the application filters
2. The JWT claims are not set correctly
3. The `auth.user_id()` function is not returning the expected value

Debug by running:
```sql
SELECT current_setting('request.jwt.claims', true);
SELECT auth.user_id();
```

### Connection pool errors

If you see "connection pool timeout" errors after switching to session mode:
1. Reduce `connection_limit` in your connection string
2. Increase your Supabase connection pool size
3. Consider switching back to transaction mode + `$withRls()` pattern

## Migration Strategy

You don't need to change anything immediately. The current setup is secure because:

1. ✅ Application-level filtering is active
2. ✅ RLS is enabled (even if policies aren't created yet)
3. ✅ You can add RLS policies at any time without code changes

**Recommended approach:**
1. Apply RLS policies from `prisma/rls-policies.sql` (defense in depth)
2. Continue using application-level filtering for most operations
3. Use `$withRls()` for sensitive operations
4. Monitor and test in development before production

## Further Reading

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Postgres RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma + Supabase Guide](https://supabase.com/docs/guides/integrations/prisma)
