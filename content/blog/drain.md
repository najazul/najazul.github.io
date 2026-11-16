# drAIn: building a geocoding worker that doesn't fall over

> `Supabase` `Deno Edge Functions` `PostgreSQL` `Python` `scikit-learn` · 🏆 PJDSC 2025 Champion · [code](https://github.com/kiloumanjaro/drAIn) · [live](https://ai-drain.vercel.app/)

**drAIn** is a flood-resilience platform. It runs SWMM (Storm Water Management Model) simulations of a city's drainage network and lets residents report flooding and clogged drains. Our team won the **Philippine Junior Data Science Challenge 2025** with it.

My two main parts: the **serverless geocoding worker**, and the **K-means model** that found our first flood hotspots.

## The problem

Citizens send flood reports with GPS coordinates like `10.3157, 123.8854`. Planners don't think in coordinates. They want *"Osmeña Blvd, Cebu City"*. So every report needs to be **reverse-geocoded**: coordinates in, readable address out.

We used **Nominatim** (OpenStreetMap's free geocoder). It's free, but its usage policy allows **at most 1 request per second**. If 50 reports come in at once, you can't just call the API 50 times.

## The design: trigger → worker → queue

```text
 new report row ──▶ DB trigger (request_geocode)
                         │  POST + secret header
                         ▼
                 Edge Function: geocodeWorker
                   1. check secret     (fail closed)
                   2. take a lock      (one run at a time)
                   3. loop 'pending' reports, 1 req / sec
                   4. save address  → 'completed'
                      no address    → 'failed'
                      API down      → stay 'pending'
```

The database is the queue. Each report has a status: `pending`, `processing`, `completed`, or `failed`. The worker only picks up `pending` rows, so if it crashes nothing is lost: the next run continues where it stopped.

## Security: who is allowed to start the worker?

Only the database should call this function. So the trigger sends a secret header (the secret lives in **Supabase Vault**, not in code), and the worker compares it in **constant time**:

```ts
function timingSafeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;   // always checks every byte
}
```

A normal `===` stops at the first wrong character, so in theory an attacker can time the responses and guess the secret one character at a time. A constant-time compare closes that gap. The worker also **fails closed**: if the secret is missing or shorter than 16 characters, every call is refused.

## Reliability: what we learned the hard way

The first version worked on a demo day. Real traffic showed the edge cases, and we hardened it:

- **"Down" is not the same as "no answer."** A timeout, a 5xx, or a 429 says nothing about the report, so it stays `pending`. Only a real "no address here" marks it `failed`. Before this, a short outage marked every report it touched as failed forever.
- **Rate limit always, not only after success.** At least 1 second between requests, even after an error.
- **Circuit breaker.** After 3 "unavailable" answers in a row, the run stops instead of hammering a service that is already struggling.
- **Stale locks.** If a run dies while holding the lock, a lock older than 3 minutes is taken over, so geocoding can't get stuck forever.
- **10-second timeout** on each request.

The decision logic lives in a separate pure file (`decide.ts`) with no network or database code, so it can be unit tested easily.

## The ML side: K-means for flood hotspots

Before the simulation features were done, we needed a first answer to *"where does it flood?"*. I aggregated drainage and flood data in Python and ran **K-means clustering** with scikit-learn to group areas with similar patterns. That gave us the first high-risk zones on the map.

Later, the team moved the main ranking to a **transparent hazard score** computed from SWMM results (flood volume, how long it stays flooded, peak rate). For planners, a score you can explain beats a cluster label. That was a good lesson for me: the "smartest" model is not always the most useful one.

Next: [/blog skolaroid](cmd:/blog skolaroid) · [/blog](cmd:/blog)
