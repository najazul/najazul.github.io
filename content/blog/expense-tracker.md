# Shipping a .NET + React expense tracker on free-tier cloud

> `C#` `ASP.NET Core` `EF Core` `PostgreSQL` `React` `Docker` `Cloudflare R2` · [code](https://github.com/najazul/expense-tracker) · [live](https://expense-tracker.normanjazuljr.dev)

I wanted one project that was mine from the database up to the DNS record. An expense tracker is small enough to finish, but it still has every hard part of a real app: users, auth, file uploads, and deployment.

## The shape of it

Two separate services, each in its own Docker container:

```text
 React SPA (Vite + TanStack Router)      C# ASP.NET Core REST API
 ┌───────────────────────────┐          ┌──────────────────────────┐
 │ Google sign-in button     │  HTTPS   │ AuthController           │
 │ dashboard, forms, uploads │ ───────▶ │ ExpensesController       │
 └───────────────────────────┘   JWT    └────────────┬─────────────┘
                                                     │
                                ┌────────────────────┼───────────────────┐
                                ▼                    ▼                   ▼
                          PostgreSQL           Cloudflare R2        Google (verify
                          (EF Core)            (receipts)           ID tokens)
```

The API follows a simple layered pattern: **Controllers** handle HTTP, **Services** hold the logic behind interfaces (`IAuthService`, `IExpenseService`, `IStorageService`), and **DTOs** decide exactly what goes in and out. The database never leaks straight into a response.

## Auth: Google proves who you are, my API decides what you get

The frontend uses Google Identity Services to get a Google **ID token**. The API does not trust it blindly. It checks the token's signature and checks that the audience is *my* client ID, then finds or creates the user and issues its **own** JWT:

```csharp
var settings = new GoogleJsonWebSignature.ValidationSettings
{
    Audience = new[] { googleClientId }   // reject tokens made for other apps
};
var payload = await GoogleJsonWebSignature.ValidateAsync(googleIdToken, settings);

var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject);
// ...create or update the user, then:
var token = GenerateJwt(user);   // HMAC-SHA256, issuer + audience + expiry
```

Every protected endpoint then validates **issuer, audience, lifetime, and signing key**. Why a second token? Because now my API controls the claims and the expiry, and the rest of the backend only has to understand one kind of token.

## Receipts go to R2, not to Postgres

Storing images in the database makes backups slow and queries heavy. So uploads go to a **Cloudflare R2** bucket through the S3-compatible API, and Postgres only keeps the URL:

```csharp
var key = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
await _s3Client.PutObjectAsync(new PutObjectRequest {
    BucketName = _bucketName, Key = key, InputStream = stream,
    ContentType = file.ContentType, DisablePayloadSigning = true // R2 needs this
});
return $"{_publicDomain}/{key}";
```

Two small details mattered. A random GUID as the file name means users can't overwrite each other's files or guess file names. And because I used the AWS SDK, moving to real S3 later is only a config change. R2 also has **zero egress fees**, which is a big deal on a student budget.

## Docker + Render, and the "free tier sleeps" problem

The API uses a multi-stage .NET Dockerfile (SDK image to build, smaller runtime image to run). The frontend gets the API URL baked in at build time with `--build-arg VITE_API_BASE=...`.

Then I hit the classic free-tier problem: Render puts idle services to sleep, so the first visitor waits for a cold start of **two** containers. My fix was a scheduled cron job that pings both services so they stay warm.

Other things that bit me during deploy:

- **CORS** — the API only allows origins from a configured allow-list (`Cors:AllowedOrigins`), and refuses to start without one.
- **Host header** — Vite's preview server rejects unknown hosts, so I had to allow the public domain.
- **Cloudflare in front** — custom domain, DNS, and strict SSL redirects so credentials never travel over plain HTTP.

## What I'd do next

Looking at it with a security mindset, there are a few upgrades I want to make:

1. **Private receipts.** Receipts are public URLs right now. They're hard to guess, but "hard to guess" is not access control. Short-lived **pre-signed URLs** would be better.
2. **Refresh tokens** with a shorter JWT lifetime, instead of one 7-day token.
3. **Structured logging** instead of `Console.WriteLine`, so I can send it to a real log tool.

Small project, but it taught me the whole path: schema → API → auth → storage → container → DNS.

Next: [/blog drain](cmd:/blog drain) · [/blog](cmd:/blog)
