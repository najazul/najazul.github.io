# Blog

Notes on how I built my highlighted projects: the design choices, the bugs, and what I'd change.

## Posts

1. [**Shipping a .NET + React expense tracker on free-tier cloud**](cmd:/blog expense-tracker)
   Google sign-in to my own JWT, receipts in Cloudflare R2, two Docker containers on Render, and a pinger that keeps them awake.
   `C#` `ASP.NET Core` `PostgreSQL` `Docker` `Cloudflare` · ~6 min read

2. [**drAIn: building a geocoding worker that doesn't fall over**](cmd:/blog drain)
   A database trigger, a Supabase Edge Function, and a free geocoding API with a strict rate limit. Plus the K-means model behind our first flood hotspots.
   `Supabase` `Deno` `PostgreSQL` `Python` · ~6 min read

3. [**Skolaroid: locking down a campus app**](cmd:/blog skolaroid)
   Route protection, domain-only Google sign-in, and an invitation system with email invites and multi-use links.
   `Next.js` `Supabase` `Prisma` `Zod` · ~5 min read

Tip: open a post with `/blog <name>` or `cat blog/<name>.md`.
