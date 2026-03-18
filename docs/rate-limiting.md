# Email Rate Limiting Guide

## What is "Email Rate Limit Exceeded"?

This error occurs when too many emails are sent to the same recipient within a short time period. Email services enforce limits to prevent spam and abuse.

## Common Limits by Service

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| **Supabase** | 3-4 emails/hour | Up to 30,000/month |
| **Resend** | 100 emails/day | 50,000+/month |
| **SendGrid** | 100 emails/day | Up to 100/day (free) |
| **Postmark** | 100 emails/one-time | 1.7x email cost |

## Solutions Implemented

### 1. Client-Side Rate Limiting
File: `lib/rate-limit.ts`

- Tracks email requests per email address
- Limits: 3 emails per hour
- In-memory storage (resets on server restart)
- For production, use Redis or Upstash

### 2. User-Friendly Error Messages
File: `app/auth/login/page.tsx`

- Detects rate limit errors
- Shows clear message to users
- Suggests wait time

### 3. Rate Limit Status Component
File: `components/rate-limit-status.tsx`

- Shows remaining requests to user
- Displays countdown when limited
- Updates automatically

## How to Use

### In Your Auth Flow:

```typescript
import { checkRateLimit, getRateLimitError } from "@/lib/rate-limit";

// Before sending email
const rateLimit = checkRateLimit(email, "magic");

if (!rateLimit.allowed) {
  const error = getRateLimitError(rateLimit.retryAfter);
  return toast({
    title: error.title,
    description: error.description,
  });
}

// Send email...
```

### In Your Login Form:

```tsx
import { RateLimitStatus } from "@/components/rate-limit-status";

<Input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
<RateLimitStatus email={email} type="magic" className="mt-2" />
```

## Production Recommendations

### 1. Use Redis for Distributed Rate Limiting

```bash
npm install ioredis
```

```typescript
// lib/rate-limit-redis.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimitRedis(email: string) {
  const key = `ratelimit:${email}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour
  }

  return count <= 3; // Max 3 per hour
}
```

### 2. Use Upstash (Redis-compatible, edge-ready)

```bash
npm install @upstash/redis
```

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

### 3. Implement Exponential Backoff

Show users increasingly longer wait times for repeated requests:

```typescript
const delays = [30, 60, 300, 3600]; // 30s, 1m, 5m, 1h
const delay = delays[Math.min(attempts, delays.length - 1)];
```

## Handling the Error Gracefully

When rate limit is exceeded:

1. **Show clear message**: "Please wait X minutes"
2. **Disable button**: Prevent repeated attempts
3. **Show countdown**: Let user know when they can try again
4. **Offer alternative**: "Contact support" for urgent cases

## Testing Rate Limiting

```bash
# Test with multiple requests
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/send-email \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","type":"magic"}'
  sleep 1
done
```

## Monitoring

Set up alerts for:

- High rate limit hit rate (possible abuse)
- Failed email sends
- Unusual email patterns

## Additional Protections

1. **CAPTCHA** after 2nd failed attempt
2. **IP-based rate limiting** alongside email-based
3. **Verification cooldown** between requests
4. **Email confirmation** before allowing more requests
