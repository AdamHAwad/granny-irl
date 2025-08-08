# Sign in with Apple – Setup Guide (Supabase + Next.js + Capacitor)

This app uses Supabase Auth for social logins. To enable Apple login in the future, follow these steps exactly. This guide documents all required IDs, secrets, and URLs and how our code integrates them (web and mobile deep-link flow).

## Overview
- Flow type: Web OAuth via Supabase (no native Apple SDK required)
- Callback handling: Supabase callback URL (server) and custom URL scheme for mobile deep link: `com.prowl.app://oauth`
- Code integration points:
  - `contexts/AuthContext.tsx` → add `signInWithApple()` mirroring `signInWithGoogle()`
  - UI button in unauthenticated view
  - No Xcode capability required for this approach; URL scheme already exists

## Prerequisites
- Apple Developer account (Team Admin access)
- Supabase project admin access

## Part 1 – Apple Developer Portal
1) Create (or confirm) iOS App ID
- Bundle ID used by the app: `com.prowl.app`

2) Create a Services ID (this is the OAuth Client ID)
- Dev Portal → Identifiers → “+” → Services IDs
- Identifier (Client ID): choose a string you will use in Supabase, e.g. `com.prowl.app` or `com.prowl.app.login`
- Enable “Sign in with Apple”, click Configure:
  - Primary App ID: select your iOS App ID (e.g. `com.prowl.app`)
  - Web Domain(s): add your web domain(s) (e.g. `granny-irl.vercel.app` and any custom domain)
  - Return URL: paste your Supabase callback URL (see Part 2)

3) Verify your web domain(s)
- Apple provides a domain association file to host at `/.well-known/apple-developer-domain-association.txt`
- Place the file in `public/.well-known/` and deploy so it’s reachable at `https://<your-domain>/.well-known/apple-developer-domain-association.txt`

4) Create a Sign in with Apple Key
- Keys → “+” → enable “Sign in with Apple” → Register → download the `.p8` file
- Record:
  - Team ID (from Membership)
  - Key ID (shown next to the key)
  - Keep the `.p8` file safe (you can’t re-download it)

## Part 2 – Supabase Configuration
Supabase → Authentication → Providers → Apple
- Enable provider
- Client IDs: your Services ID (exact match), e.g. `com.prowl.app` or `com.prowl.app.login`
- Secret Key (for OAuth): paste the Apple client secret JWT (see Part 3)
- Callback URL: shown by Supabase, format:
  - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

Supabase → Authentication → URL Configuration
- Site URL: your production site, e.g. `https://granny-irl.vercel.app`
- Additional Redirect URLs: add the mobile deep link `com.prowl.app://oauth`

## Part 3 – Generate Apple Client Secret (JWT)
Apple requires a JWT “client secret” signed with your `.p8` key. It expires every 6 months.

Inputs you need:
- TEAM_ID: Apple Developer Team ID
- KEY_ID: The Key ID of the `.p8` key
- CLIENT_ID: Your Services ID from Part 1 (the same string you put in Supabase Client IDs)
- PRIVATE_KEY: contents of the `.p8` file

Example Node script (run locally):
```bash
npm i jsonwebtoken
```
```javascript
// gen-apple-secret.js
const fs = require('fs');
const jwt = require('jsonwebtoken');

const TEAM_ID = 'YOUR_TEAM_ID';
const KEY_ID = 'YOUR_KEY_ID';
const CLIENT_ID = 'YOUR_SERVICES_ID'; // e.g. com.prowl.app or com.prowl.app.login
const PRIVATE_KEY = fs.readFileSync('./AuthKey_YOUR_KEY_ID.p8', 'utf8');

const token = jwt.sign(
  {},
  PRIVATE_KEY,
  {
    algorithm: 'ES256',
    expiresIn: '180d', // Apple max is 6 months
    issuer: TEAM_ID, // iss
    audience: 'https://appleid.apple.com', // aud
    subject: CLIENT_ID, // sub
    keyid: KEY_ID, // kid
  }
);

console.log(token);
```
Run:
```bash
node gen-apple-secret.js
```
Then paste the printed token into Supabase → Apple → “Secret Key (for OAuth)”. Set a calendar reminder to regenerate before 6 months.

## Part 4 – App Code Changes (when re-enabling)
1) Auth function
- In `contexts/AuthContext.tsx`, add:
```ts
await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: { redirectTo: isMobile ? 'com.prowl.app://oauth' : siteUrl }
});
```
- Keep the same deep-link handling already implemented for Google.

2) UI
- Add a `SignInWithAppleButton` that calls `signInWithApple()`.

3) Mobile deep link (already present)
- `Info.plist` → URL Types includes scheme `com.prowl.app`.
- No extra Xcode capability is required for web OAuth.

## Common Errors
- `Unsupported provider: missing OAuth secret` → The Apple client secret (JWT) is not set in Supabase or expired. Generate a fresh JWT and paste it.
- Invalid Client ID → The Services ID in Supabase must exactly match the one created in Apple.
- Callback blocked → Ensure the Supabase callback URL is added in the Services ID configuration in Apple.
- Mobile not returning → Ensure `com.prowl.app://oauth` is listed in Supabase Additional Redirect URLs; our deep link handler in `AuthContext` will pick up the session.

## Optional: Native Apple Sign-In (future)
If you want the fully native Apple dialog inside the app, integrate a Capacitor Apple Sign-In plugin and then call `supabase.auth.signInWithIdToken` using the identity token from the native API. This requires adding the “Sign In with Apple” capability in Xcode.

---
Maintainer notes:
- This document replaces back-and-forth setup questions and captures all required artifacts and where to place them.
- Rotate the Apple client secret token every 6 months.
