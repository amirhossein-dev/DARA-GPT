# Identity / Session Phase A — Expo application

This is a patch overlay for the existing Expo 54 application, not a separate app. It adds sign-in, protected routes, session bootstrap/refresh, Account & Sessions, and server-derived enterprise display. Existing chat/model mocks are not converted into live AI in this phase.

## Setup
1. Apply the reviewed frontend patch on a new local branch.
2. `npm install` resolves `expo-secure-store ~15.0.8` (SDK54) and explicit Node test types; review and commit package-lock. No lockfile update or dependency installation was claimed in the builder environment. Run `npx expo install --check` to check compatibility.
3. Copy `.env.example` to the existing ignored local env location (usually `.env.local`); ensure it is not committed. Only EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_TENANT_SLUG go there. No authentication keys or OTP code.
4. Start the patched backend, apply its identity migration and provision a synthetic/development member first.
5. `npm run web` with API http://localhost:3000 and web http://localhost:8081 is the simplest initial test. Use the same hostname spelling on both sides; localhost and 127.0.0.1 are not interchangeable cookie hosts.
6. Enter organization `enterprise-pilot`, the provisioned E.164 phone, self-reported names, and the private AUTH_DEV_OTP from backend developer configuration. The development banner explicitly says no SMS/real phone verification. Neither app nor API embeds/displays a fixed code.

## Boundaries and behavior
- Web/PWA stores no token in localStorage/sessionStorage. It uses backend HttpOnly cookie plus in-memory CSRF. Native uses access token in the IdentityClient closure and refresh token only in Expo SecureStore. There is no plaintext fallback.
- Session restoration must be confirmed by the server before protected routes render. AppState foreground and a 60-second foreground check refresh roles/status. Offline state is unresolved, not a claimed valid session.
- Identity change/logout resets existing private Redux slices. It does not claim deletion from other devices, browser caches, backend message logs or backups. Do not cache identity/CRM endpoints in a service worker.
- Refresh and state-changing client operations are serialized. An old me response cannot revive a logged-out session. Network error on logout is not reported as successful server revocation.
- Third active-device login closes oldest session by the configured pilot policy. The Account screen lists/revokes owned sessions; labels are client-provided, not attested device identity.
- Enterprise and role values are read from the server. The plan purchase controls remain disabled; the old plan Redux slice is not an authorization source.
- Protected UI is navigation assistance, not server security. Server validates session/membership on every authenticated request.
- Native code has been authored, not built on a device by the builder. Rebuild the native dev client/APK after adding SecureStore; do not assume an existing build contains it.
- Android emulator can use its host mapping (often 10.0.2.2) but HTTPS, cleartext policy and reachability must be checked on that environment. A physical device cannot reach Fedora through its own localhost. Do not globally enable cleartext in release or expose unauthenticated development APIs to solve it.
- Release requires HTTPS. For web, prefer same-origin /api reverse proxy. Cross-site cookie flows are not the deployment default and are not verified here.

## Checks
`npm run test:identity`: nine pure-client lifecycle tests using fake fetch/secure-storage adapters (not actual OS storage).
`npm run typecheck`: full Expo project type check on the target.
`npm run web`: browser acceptance: sign in, refresh page, Account, logout current/all, then sign in as a different user and verify prior Redux state is not shown.
`npm run android`: native acceptance after toolchain setup; verify SecureStore restore, rotation and revocation on real device.

The builder executed only isolated TypeScript domain/client tests and syntax checks; no APK, Expo Web build, React runtime or real SecureStore test was performed.

## Local verification — 2026-10-07
- Applied all 18 frontend overlay files against the exact baseline on `codex/identity-session-phase-a` and synchronized `package-lock.json` with `npm install`. The new SecureStore dependency resolves to 15.0.8; explicit Node test types resolve to 22.20.5.
- Full project `npm run typecheck` and all nine `npm run test:identity` tests passed using Node 24.19.0.
- Expo Web export passed, compiling the browser bundle and 15 static routes. The check used the synthetic HTTPS API URL `https://api.example.test` and a temporary output directory; it did not connect to a backend or establish a browser session.
- `expo install --check` reports existing baseline dependency mismatches: Expo, constants, font, linking, router, splash-screen, web-browser, and react-native-svg. Their locked versions were retained; the added SecureStore dependency was not flagged. These compatibility findings remain separate from the passing typecheck and Web export.
- No browser login flow, Android/iOS build, real SecureStore/device behavior, or production deployment was tested. No private runtime environment was created. `git diff --check` passed.
