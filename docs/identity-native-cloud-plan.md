# Phase A — native continuation through EAS cloud

Status: `LOCAL_PREPARATION_COMPLETE_PENDING_OPERATOR_CONFIRMATION` (2026-10-08).

This plan supersedes the local-build prerequisites in the earlier Native
Readiness continuation. The route is **Expo SDK 54 → EAS cloud development APK
→ a verified physical Android device**. Android Studio, a local JDK, the full
Android SDK and an emulator are not prerequisites for this route. Expo provides
the native build environment remotely. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/?buildenv=build-with-eas)

## 1. Preserve the Web witness and review local preparation

Frontend baseline: `458531615804e42779d2ce9726f2f2cd982e1a63`.
Backend baseline: `3d3f574209a8c913b40f3c15ac26e6ea168cc950`.

The earlier 28/28 Web receipt, databases and source manifests remain historical
evidence. The provider fix and backend Guard are unchanged. The previous frontend
lockfile is retained with SHA-256
`1bdfd65424ac71b7255f4847644ef07e6235c39fd81a4fa0934ce3d63c3ff2fc`;
the new lockfile is a reviewable working-tree change, with no history reset.

Prepared dependencies stay on SDK 54: Expo `54.0.37`, dev-client `6.0.21`, the
SDK-matched constants/font/linking/router/splash/web-browser patches, and SVG
`15.12.1` pinned exactly.
React `19.1.0`, React Native `0.81.5` and SecureStore `15.0.8` are retained.
`babel-preset-expo ~54.0.12` is now explicit because `babel.config.js` requires it;
the first Web export after resolution failed without that declaration.
[SDK 54 package contract](https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json)

Review the complete lockfile diff, including transitive changes. Resolution also
changed existing navigation packages within their declared ranges:
`@react-navigation/elements 2.9.2 → 2.9.44` and
`@react-navigation/native 7.1.25 → 7.5.0`. No blanket audit fix or major SDK/RN
upgrade was applied. npm's audit summary is not a security qualification.

`app.config.js` uses `APP_VARIANT=identity-test` to select:

| Field | Dedicated test value | Default app |
|---|---|---|
| Display name | DARA Identity Test | ai-terminal |
| Android package | com.anonymous.aiterminal.identitytest | com.anonymous.aiterminal |
| Scheme | daraidentitytest | aiterminal |
| Slug | dara-identity-test | ai-terminal |

The test variant adds the dev-client plugin with its generated scheme disabled;
use the explicit `daraidentitytest` scheme for Metro. The original static config
stays in `app.json`. [Expo app variants](https://docs.expo.dev/build-reference/variants/)

## 2. Review the cloud build profile

`eas.json` has one profile: `identity-development`, pinned to EAS CLI `24.12.0`.
It uses `developmentClient: true`, internal distribution, the `development`
environment, `:app:assembleDebug`, `withoutCredentials: true`, and no automatic
version increment. It requests an installable debug APK, with standard debug
signing rather than configuring managed signing credentials. It defines no
production/store submission or update channel. [EAS profile schema](https://docs.expo.dev/eas/json/)

Profile public values are `APP_VARIANT=identity-test`, `EXPO_NO_DOTENV=1`,
`EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3101` and tenant `enterprise-pilot`.
They contain no login credentials. A development APK loads JavaScript from Metro;
start Metro with the same variant and public API values. Build-profile values
alone do not configure that later Metro process.

No Expo account/owner or EAS project UUID has been invented or linked. The
operator must identify the authorized account and dedicated project. Before
submission, review the account's remote development-environment variables too:
`.easignore` and disabled dotenv loading do not exclude variables supplied by EAS.
If account linkage changes app config or profile bytes, refresh the upload
inventory and review the resulting scope before submission.

## 3. Approve exact source upload contents

`.easignore` is an allowlist because EAS uses it in place of `.gitignore`.
It permits application source, assets, required build config, package metadata,
the lockfile and EAS config. It excludes all other root paths and excludes local
env/credentials/signing files inside allowed directories as well.
[EAS ignore behavior](https://docs.expo.dev/build-reference/easignore/)

Local staging used the inspected `makeShallowCopyAsync` function from the pinned
EAS CLI package without invoking an EAS command or account context. The exact
inventory records **63 files, 1,177,511 uncompressed bytes**, each with size and
SHA-256. Inventory digest:
`275e50d074b731c5b03e4f993ed0d036a0b51c0647e24a715f3fba9dd08c3113`.
This is the source-file scope, not a claim about an uploaded/compressed archive.
[EAS local packaging source](https://github.com/expo/eas-cli/blob/v24.12.0/packages/eas-cli/src/vcs/local.ts)

| Included group | Files |
|---|---:|
| Root build/config files | 12 |
| app | 10 |
| assets | 10 |
| auth | 6 |
| components | 9 |
| constants | 1 |
| hooks | 3 |
| redux | 7 |
| screens | 5 |

Git history, node_modules, generated android/ios folders, private envs,
identity-private, the sibling backend, IDE state, docs, test files, receipts,
logs and signing material are excluded. Included symlinks/nonregular files are
rejected. A heuristic scan of included text found no known private-key/token or
credential-bearing HTTP URL patterns; it is not proof that every possible
embedded secret is absent.

For any later approved upload, use EAS CLI `24.12.0` with `EAS_NO_VCS=1` and
`EAS_PROJECT_ROOT` explicitly set to the frontend directory; this binds the
upload to the same local-copy implementation used for review. Re-stage into a
fresh external directory and compare every path/size/hash immediately before
submission. Any scope, content, profile, CLI version or remote-env change needs
review again. Do not use `eas build:inspect` as an unauthenticated preflight: it
enters account/project contexts before its archive stage.
[EAS inspect implementation](https://github.com/expo/eas-cli/blob/v24.12.0/packages/eas-cli/src/commands/build/inspect.ts)

## 4. Operator confirmation gate

No login, project creation/linking, source upload, signing configuration,
build submission, update publication or paid build has been performed.
Confirmation must cover these concrete items before a cloud submission:

1. Expo account/owner and the actual dedicated EAS project UUID; review its
   development environment and internal-build access/distribution settings.
2. The reviewed source inventory and any refreshed digest after linkage.
3. Android profile `identity-development`: dedicated app identity, debug APK,
   standard debug signing, `withoutCredentials`, and the public environment values.
4. Cost boundary: default is **zero paid usage**. Verify available free quota
   before submitting; stop if the account requires payment or an upgrade.

Only after confirmation may the operator link the project and submit the cloud
build. If linkage requires source changes, review the refreshed scope first.
No signing-credential creation/rotation or paid usage is implicitly authorized.

## 5. Private device-to-local-backend route

Proposed route: **USB ADB reverse on one verified physical device**. Standalone
platform-tools may be supplied separately; no local native compiler is needed.
ADB has not been installed and no device has yet been enumerated.
[Standalone platform-tools](https://developer.android.com/tools/releases/platform-tools)

Use proposed API port `3101` and Metro port `8083`. Both were free when checked;
recheck before use. Bind the new identity-only Nest process to `127.0.0.1`, and
Metro to localhost. Preserve existing processes and mappings. After selecting
the exact authorized device serial, inspect its mappings and only then add:

```sh
: "${IDENTITY_TEST_DEVICE_SERIAL:?Set the verified physical target serial}"
adb -s "$IDENTITY_TEST_DEVICE_SERIAL" reverse --list
adb -s "$IDENTITY_TEST_DEVICE_SERIAL" reverse tcp:3101 tcp:3101
adb -s "$IDENTITY_TEST_DEVICE_SERIAL" reverse tcp:8083 tcp:8083
```

The app uses device loopback `http://127.0.0.1:3101`, carried over the selected
USB connection to host loopback; Metro uses device localhost port `8083`. No LAN
bind, public tunnel, public API or database publication is involved. Reconnect
and recheck mappings after USB/device changes. Remove only mappings introduced
by this test. Wireless ADB or VPN alternatives require a separate reviewed route.

Future Metro command, **after the dedicated APK is installed**, is:

```sh
APP_VARIANT=identity-test EXPO_NO_DOTENV=1 \
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3101 \
EXPO_PUBLIC_TENANT_SLUG=enterprise-pilot \
npx expo start --dev-client --localhost --port 8083 --scheme daraidentitytest
```

Use a fresh ignored native-only env and fresh test database for the new Nest
process. Keep `APP_HOST=127.0.0.1`, `DB_SYNCHRONIZE=false`, synthetic roster,
development-test OTP, real TTL/rate limits and `request_inactivity`. Load the
new env explicitly and clear inherited AUTH/DB/PORT settings; existing npm
identity scripts hardcode the older env and must not accidentally target mydb.
No env/database/backend process or forwarding was created in this preparation.

For mixed Web/native scenarios, use a **separate Web Metro process** on port
`8084` with its own public API value, while native Metro stays on `8083`:

```sh
APP_VARIANT= EXPO_NO_DOTENV=1 \
EXPO_PUBLIC_API_BASE_URL=http://localhost:3101 \
EXPO_PUBLIC_TENANT_SLUG=enterprise-pilot \
npx expo start --web --localhost --port 8084
```

Allow only the explicit Web origin `http://localhost:8084` in the new backend's
`AUTH_WEB_ORIGINS`. Web cookies use localhost for both UI and API. Native keeps
loopback `127.0.0.1` with Bearer tokens through USB. A single Metro process cannot
serve both API environment values; verify all proposed ports are still free.

## 6. Verify APK and target, then run N01–N12

Record cloud build ID, APK SHA-256, profile/config/manifest identity, physical
device model/OS/serial (sanitize public evidence), and installed package. Inspect
the actual APK permissions, debug flags, signing and backup resources before
acceptance. Confirm the existing app remains installed and untouched.

Disposable no-install prebuild succeeded without a local JDK/SDK. Its generated
source has the test package/scheme and debug-only cleartext permission; its main
manifest references SecureStore backup XML, whose installed library resources
exclude SecureStore in both cloud backup and device transfer. This is
`GENERATED_SOURCE_CONFIG_REVIEWED`, not merged APK, hardware-backed storage or
backup/restore evidence. The release HTTPS check in the provider is unchanged.

Every native scenario is currently `NOT_RUN_PENDING_APK_AND_VERIFIED_TARGET`:

| ID | Actual physical-device acceptance |
|---|---|
| N01 | Clean dedicated install; no authenticated private UI |
| N02 | Fixture login; actual SecureStore and memory-only access token |
| N03 | Process close/relaunch and server-confirmed session restore |
| N04 | Real five-minute access TTL and refresh rotation |
| N05 | Logout, process restart and no restored session |
| N06 | Revoke Android session from independent Web session |
| N07 | Three independent mixed native/Web logins; two-session cap |
| N08 | A→B identity switch resets private Redux state |
| N09 | Late old-session success/error cannot restore or hide new identity |
| N10 | Network failure and lost refresh acknowledgment without unsafe retry |
| N11 | Synthetic membership suspension rejects the next protected request |
| N12 | Uninstall/reinstall only the separate identity-test app |

No identity success responses may be mocked. Preserve real TTL/cooldown/limiter
behavior. Fault injection is labeled explicitly. Do not export OTP, tokens,
storageState, HAR, raw credential logs or private database content. APK
installation alone is not native acceptance.

## Validation and rollback

SDK install check, Expo Doctor 18/18, typecheck, 9/9 fake-adapter identity tests,
EAS schema, default/test config evaluation, local staging and Web export passed.
The 28-case real Web suite was not rerun for these dependency versions; its prior
receipt remains historical. APK build/install, ADB, real SecureStore and all
native acceptance cases remain unexecuted.

No local Android build tools or system packages were installed. npm dependencies
were resolved locally; EAS CLI is an external temporary inspection tool, not a
project dependency. The previous lockfile/package/config and guides are retained
for a selective rollback. Restore only this preparation's hunks and added files
after checking for later user edits; retain the earlier guide append, Web fix,
backend guard and witness databases. Reinstall from the matched original
package/lock pair if rolling back dependencies; never reset/clean either repo.
