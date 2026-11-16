# Skolaroid: locking down a campus app

> `TypeScript` `Next.js` `Supabase Auth` `Prisma` `PostgreSQL` `Zod` `Vercel` · 🏆 SE Project Expo 2026 Best Startup · [code](https://github.com/kiloumanjaro/Skolaroid) · [live](https://skolaroid.vercel.app)

**Skolaroid** lets students pin photos and stories to places on a campus map, like a shared yearbook you can walk through. It won **Best Startup** at our Software Engineering Project Expo 2026.

The fun part is the map. My part was making sure **the right people can do the right things**, and nobody else can.

## 1. Only students get in

The app is for one university, so sign-in had to be limited to **school Google accounts** (`@up.edu.ph`). There are two layers to this.

First, the login button asks Google to show only school accounts:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/auth/callback`,
    queryParams: { hd: 'up.edu.ph', prompt: 'select_account' },
  },
});
```

But `hd` is only a **hint** for Google's account picker. Anyone can edit a request in the browser. So the real rule lives on the server side, in an **authentication hook** that checks the email domain and refuses everyone else:

```text
Google OAuth ──▶ Supabase Auth ──▶ auth hook: email domain allowed?
                                        ├─ yes → continue sign-in
                                        └─ no  → reject
```

Rule of thumb I follow now: the frontend makes it *easy* to do the right thing, the backend makes it *impossible* to do the wrong thing.

After Google redirects back, a callback route exchanges the one-time code for a session on the **server** (PKCE flow), so tokens never pass through the URL.

## 2. Every request is checked at the door

Next.js runs a **proxy (middleware)** before every page. It creates a fresh Supabase client for each request, refreshes the session cookie, and checks who the user is. Not signed in and trying to open a protected page? You're sent back to the homepage.

One small detail I liked: an expired or invalid refresh token is treated as "not signed in", not as a crash. Visitors without a session are normal, not an error.

## 3. API routes follow the same 4 steps

I built and optimized the **CRUD routes** for user profiles and memories. Every route follows the same pattern, so it's easy to review:

```ts
// 1. Authenticate — who are you?
const { data: { user } } = await supabase.auth.getUser();
if (!user) return json({ error: 'Not authenticated' }, 401);

// 2. Validate — is the input the right shape?
const parsed = schema.safeParse(await request.json());
if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

// 3. Authorize — are you allowed to do THIS?
if (!canRoleUsePermission(role, 'sendInvitations', group.rolePrivileges))
  return json({ error: 'Forbidden' }, 403);

// 4. Act
```

Authentication and authorization are different questions. "You're logged in" doesn't mean "you can edit this group". Keeping them as separate steps makes that easy to see.

## 4. The invitation system

Private groups needed a way to invite people. I built two kinds of invite:

- **Email invite** — for one person, tied to their email address.
- **Public link** — anyone with the link can join, up to `maxUses` times.

Both share one `Invitation` table. A migration added `isForAll` and `maxUses`, and made `email` optional for public links:

```sql
ALTER TABLE "Invitation"
  ADD COLUMN "isForAll" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxUses"  INTEGER NOT NULL DEFAULT 1,
  ALTER COLUMN "email" DROP NOT NULL;
```

The safety rules:

- Tokens come from Node's `crypto`, so they are random and can't be guessed.
- Invites **expire after 7 days**, and a cleanup route removes old ones.
- Only roles with the `sendInvitations` privilege can create them.
- Accepting checks expiry, remaining uses, and that the group still exists.

## What I took away

Security is mostly about putting each check in the **right layer**: the domain rule in auth, the session check in the proxy, permission checks in each route, and limits like expiry and max uses in the database. If one layer misses something, the next one catches it.

Next: [/blog expense-tracker](cmd:/blog expense-tracker) · [/contact](cmd:/contact)
