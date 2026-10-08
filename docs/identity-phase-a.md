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

## Local Web acceptance — 2026-10-08

The real Expo UI passed all 14 mission scenarios in Chromium 151.0.7922.34 and Firefox 153.0 (28 passed, 0 failed, 0 blocked), using Playwright 1.62.1 with separate, nonpersistent contexts. The API ran the actual Nest bootstrap against the dedicated synthetic browser database. Normal login responses were not intercepted; routing was used only for explicit failure/delay scenarios.

A real regression was reproduced in `auth/provider.tsx`: an old foreground `me()` rejection could show the problem screen after a different person had signed in. Foreground and timer revalidation now capture their originating session ID and ignore errors after that session has been cleared or replaced. W14 passed in both browsers with genuine delayed 200/401 responses and the old request's original cookie; the new session remained authorized and visible. W13 still showed the retry screen for a current-session network failure.

W12 seeded the private Redux UI mode through the existing Chat screen, then verified its reset and the displayed person after A logged out and B signed in, without reloading the document or calling a model. This covers that observable state; it does not prove disk/cache erasure or every Redux field.

The idle observation ran for approximately 126 seconds per browser with no human input: two foreground `me` responses were observed and the database `last_seen_at` advanced. The current policy measures request/session inactivity. Human inactivity and actual idle/absolute expiry require separate acceptance; timeout values were not changed.

`npm run typecheck`, all 9 `npm run test:identity` tests, and `git diff --check` passed with Node 24.18.0 / npm 11.16.0. The existing lockfile changes were preserved byte-for-byte. The existing Expo SVG compatibility warning remains separate from this local Web result. Android/SecureStore, SMS, production HTTPS cookies, Safari/PWA delivery, and business/model paths were not exercised.

The tested frontend HEAD was `5b292ac330fcdb43097aab72859e9e2872ffac07` with an uncommitted provider fix and the user's existing lockfile changes. The full tested source manifest, final delivery state, scenario matrix, harness and scope are in the [sanitized receipt](/home/daraarian/.codex/state/plugins/codex-security/scans/N8n-orchestrator-nestjs/artifacts-c806da034dd4f5aba6f4375d96020af0e56dc5a2a7059808d8ea43d00fac36b2/artifacts/phase-a-browser-20261008.receipt.json) and [acceptance report](/home/daraarian/.codex/state/plugins/codex-security/scans/N8n-orchestrator-nestjs/artifacts-c806da034dd4f5aba6f4375d96020af0e56dc5a2a7059808d8ea43d00fac36b2/hardening/phase-a-browser-acceptance-20261008.md). This stage made no commit or push.

## Native readiness checkpoint — 2026-10-08

Status: `BLOCKED_ANDROID_TOOLCHAIN_UNAVAILABLE`. The frontend was clean at `458531615804e42779d2ce9726f2f2cd982e1a63`; all 79 files matched the preserved Web delivery manifest, including the late-response fix. Typecheck and the 9 fake-adapter client tests passed again. This does not test actual Android SecureStore.

Node 24.18.0 / npm 11.16.0, Expo 54.0.29, React Native 0.81.5 and SecureStore 15.0.8 were found. `expo install --check` and Expo Doctor 1.20.4 reported eight SDK-54 dependency version differences; Doctor passed 17/18 checks. Those versions were recorded as recommendations, not applied at this stop boundary.

Only Java runtime 25.0.2 was found; `javac`, Android SDK, ADB and emulator were not discovered in PATH or searched installation locations. Gradle and an app wrapper were unavailable; `android/` and `ios/` were absent. No prebuild, APK build/install, device discovery, native backend environment or native database was attempted. N01–N12 are BLOCKED by this capability gate, not failed authentication tests.

The current application ID remains `com.anonymous.aiterminal`. Before any future install/uninstall, configure a separate test ID/name/scheme and verify the selected target. SecureStore backup plugin settings were CONFIG_REVIEWED only; generated manifests and actual backup/restore were not tested. Any HTTP exception must be confined to debug/test sources and checked separately from release.

No dependency, application/configuration or private env was changed; only readiness documentation was added. The original 28/28 Web evidence remains historical and was not rerun. See the [native receipt](/home/daraarian/.codex/state/plugins/codex-security/scans/DARA-GPT/artifacts-d35f090db1253ae68d9c81685fe9fd9a90cc215f6262e2e00cc5df40526d6f73/artifacts/phase-a-native-readiness-20261008.receipt.json) and [matrix/continuation report](/home/daraarian/.codex/state/plugins/codex-security/scans/DARA-GPT/artifacts-d35f090db1253ae68d9c81685fe9fd9a90cc215f6262e2e00cc5df40526d6f73/hardening/phase-a-native-readiness-20261008.md) for source hashes, exact diagnostic differences and the stop reason. No services, databases, volumes, commits or pushes were changed by this native-readiness run.

## Revised native continuation — EAS cloud, 2026-10-08

The operator replaced the local-toolchain route with SDK 54 + EAS cloud development build + a verified physical Android target. Local Android Studio/JDK/full SDK/emulator installation is not a prerequisite. The earlier blocked receipt remains historical evidence.

SDK-54 corrections, expo-dev-client, an isolated test variant, a debug cloud profile and a locally inventoried upload allowlist are prepared. Web export, typecheck and client checks passed; physical SecureStore and N01–N12 remain unexecuted. Account/project, exact upload scope, profile and zero-paid-usage confirmation are required before any cloud submission. The proposed private route is device-specific USB ADB reverse to fresh loopback-bound test services; standalone platform-tools are a separate proposal. See the [reviewable cloud continuation plan](identity-native-cloud-plan.md).
