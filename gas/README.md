# JavaScript学習プラットフォーム v0.7 GAS連携・発行管理

This directory contains GAS-compatible source and local mock tests. It does not deploy Apps Script, connect to Google accounts, create production spreadsheets, send real email, or change Drive sharing.

## File Structure

- `IssuanceBackend.js`: GAS-compatible backend source. Copy to Apps Script as `Code.gs` or split into `.gs` files.
- `IssuanceBackend.local-tests.js`: Node-based local mock tests for the GAS backend.
- `admin/`: interviewer issuance web app. Deploy in a **separate** Apps Script project from the public learner bridge. See `admin/README.md`.
- `../platform/issuance-v06-client.js`: optional GitHub Pages bridge helper. It is not loaded by default and contains no production endpoint or secrets.

## Adopted Communication Method

Recommended production path: use a public learner-only GAS Web App HTML Service bridge. Deploy the learner bridge with `Who has access: Anyone` (or the broadest learner audience available in the operator's account), embed it from GitHub Pages in a hidden `iframe`, then send structured learner issuance data with `window.postMessage`. The GAS page calls server-side Apps Script with `google.script.run`.

A private `Who has access: Only myself` Web App is not a viable bridge for the GitHub Pages learner flow. It may load a Google login/permission document inside the iframe instead of the bridge HTML, especially for other users, signed-out browsers, or cross-site embedded contexts. In that state the iframe `load` event can still fire, but no bridge script runs, so no `ready`, diagnostic, or `pong` message is posted back.

Why this is preferred:

- Direct `fetch()` from GitHub Pages to a GAS Web App often hits browser CORS limits because Apps Script responses cannot reliably add arbitrary `Access-Control-Allow-Origin` headers.
- HTML Service plus `google.script.run` keeps the actual server call same-origin inside GAS.
- The GitHub Pages side does not need sheet IDs, script properties, admin tokens, or Drive identifiers.
- Structured quiz data is transferred in the message body, not URL parameters.
- Unsafe JSONP and URL-param credential designs are intentionally not used.
- Public access is limited to the learner bridge route: `doGet()` returns the HTML bridge, the bridge only handles safe ping plus learner issuance, and `doPost()` remains disabled. `LEARNER_PAGE_ORIGIN` is a message-origin filter only; one-time code validation, admin guards, attempt limiting, and audit logging remain server-side controls.

Concrete data route:

1. GitHub Pages loads normal learner UI and validates quiz data locally.
2. A deployment-specific page creates `JSQuizGasBridgeV06.createGasBridgeClient({ bridgeUrl })`.
3. `platform/issuance-v06-client.js` creates a fresh random `bridgeSession`, appends it to the GAS iframe URL, and creates a hidden 1px `iframe` under `document.body` by default. A specific container can be passed as `frameContainer` if the operator wants a visible status area. The iframe should not be reused for admin work.
4. GAS `doGet(e)` reads the `bridgeSession`, injects it into the HTML Service bridge, and the bridge posts `jsquiz:v0.7:ready` with that same session.
5. GitHub Pages accepts `ready` only when the reply origin is allowed/expected and `bridgeSession` matches. It then stores `event.source` as the trusted bridge frame, even when it differs from the outer `iframe.contentWindow`.
6. GitHub Pages sends `{ type: "jsquiz:v0.6:issue", requestId, bridgeSession, payload }` to the trusted ready source using the exact ready origin as `targetOrigin`.
7. The GAS HTML Service page receives the message, verifies `event.origin === LEARNER_PAGE_ORIGIN` and `data.bridgeSession === bridgeSession`, then calls `google.script.run.issueWorkFromBridge(payload)`.
8. GAS validates code, requestId, email, and quiz data server-side, writes state to the spreadsheet, saves the generated HTML to Drive where possible, and sends email where configured.
9. GAS replies to `event.source.postMessage(...)` using the exact allowed origin, never `"*"`, and includes the same `bridgeSession`.
10. GitHub Pages accepts result/error replies only from the trusted ready source, exact trusted ready origin, matching requestId, and matching `bridgeSession`.

`doGet()` serves only this HTML Service bridge page. `doPost()` intentionally returns an error for all JSON requests; direct public `verifyCode`, `issueWork`, or admin-like POST actions are not part of the Web App surface. Admin operation functions are for Apps Script editor/private admin use only and must not be linked from the learner bridge or exposed in GitHub Pages. For an `Anyone` learner deployment, set `PUBLIC_LEARNER_DEPLOYMENT=true`; that hard-rejects admin/test helper wrappers even if a caller can name them with `google.script.run`.

Timeout and duplicate submit behavior:

- The browser client defaults to a 30 second timeout. On timeout it removes the iframe, clears listeners, and rejects the Promise.
- The browser client keeps an in-memory `inFlight` map by `requestId` and rejects duplicate submit attempts while the same request is pending.
- Server-side `requestId` idempotency is still authoritative. A completed retry with the same code/email/quiz data returns the cached result; the same `requestId` with different code or work data is rejected as `REQUEST_CONFLICT`.

Origin rules:

- GitHub Pages sends ping/issue only to the nonce-validated ready source, using that exact ready origin as `targetOrigin`. The outer iframe `contentWindow` is not the required send target.
- GAS requires script property `LEARNER_PAGE_ORIGIN` and rejects messages when it is blank or does not match `event.origin`.
- GAS posts result/error responses back to `LEARNER_PAGE_ORIGIN`.
- GitHub Pages accepts replies only from an explicit allowlist/expected GAS HTML Service origin and from the ready-verified bridge source. By default the allowlist contains the GAS Web App origin; when Apps Script runs the HTML under `https://*.script.googleusercontent.com`, the bridge session nonce is required before that inner frame can become trusted. Deployment-specific code may still add a separate exact `replyOrigin` / `allowedReplyOrigins` value after verifying the real HTML Service reply origin.
- Wildcard `targetOrigin` is avoided by default. Apps Script HTML Service iframe behavior must still be verified in the deployed browser environment because the Web App URL is usually `https://script.google.com`, while the sandboxed HTML content can run under a `https://*.script.googleusercontent.com` origin.
- `postMessage` send `targetOrigin` must match the actual recipient window being messaged. A reply allowlist origin is separate: it controls what GitHub Pages accepts from GAS. Do not replace either side with `"*"`.
- If the connectivity test receives `ready` from `script.googleusercontent.com` and `source` is not the created outer iframe, this is treated as the expected HTML Service nesting behavior. Do not bypass source validation; trust only the nonce-validated ready source and send ping/issue messages to that exact window with its exact origin.

Alternatives considered:

- Private GAS HTML Service iframe from GitHub Pages: rejected for learner production. GAS access control can serve login/permission UI in the iframe, so `load` is not proof that the bridge script ran. This matches the real environment symptom: iframe load succeeded, pings were sent, and no GAS-origin message arrived.
- Public learner-only GAS HTML Service bridge iframe: selected. It avoids browser CORS reads, keeps server work inside GAS, supports strict `LEARNER_PAGE_ORIGIN`, does not expose admin tokens to GitHub Pages, and can keep `doPost()` disabled.
- Direct GAS Web App `fetch()` / `doPost`: rejected for this version. Apps Script Web Apps cannot reliably return arbitrary CORS headers for a GitHub Pages browser client, and enabling a public JSON POST endpoint would create a larger abuse surface.
- GAS-hosted full learner page or redirect flow: viable fallback if iframe source validation cannot be made reliable, but it moves the learner UI away from GitHub Pages and changes the user journey more than necessary.
- Form POST / `no-cors` / JSONP-like approaches: rejected. `no-cors` hides the response, form POST makes result handling brittle, and JSONP/callback designs encourage unsafe execution or leakage through URLs.
- Paid/server proxy: not selected because the scope asks for a safe/free connection model.

Real deployment is required to definitively verify `script.google.com`/`googleusercontent.com` iframe behavior, X-Frame behavior with `ALLOWALL`, `google.script.run`, and exact origin values.

## v0.7 Browser Connectivity Test

`../platform/gas-bridge-connectivity-test.html` is a test-only page for verifying the GitHub Pages to GAS HTML Service `postMessage` bridge before sending any real issuance data.

Before using it:

1. Paste the latest `gas/IssuanceBackend.js` into Apps Script.
2. Redeploy or update the Web App so the HTML Service bridge includes the v0.7 ping handler.
3. Deploy the learner bridge Web App with `Who has access: Anyone` for public learners. Do not use `Only myself` for the GitHub Pages learner bridge test.
4. Confirm Script Property `LEARNER_PAGE_ORIGIN` exactly matches the origin that serves the test page, for example `https://example.github.io`.
5. Open `platform/gas-bridge-connectivity-test.html` from the same GitHub Pages origin.
6. Paste the GAS Web App URL and click `接続テストを開始`.

The test page sends only:

```json
{
  "type": "jsquiz:v0.7:ping",
  "requestId": "gas-bridge-test-...",
  "bridgeSession": "bridge-...",
  "sentAt": "...",
  "purpose": "gas-bridge-connectivity-test"
}
```

It does not send issuance codes, email addresses, quiz data, work HTML, admin tokens, spreadsheet IDs, Drive folder IDs, script properties, or other secrets. The GAS bridge replies with only safe diagnostics: `ok`, `requestId`, `timestamp`, `observedOrigin`, `locationOrigin`, `learnerOriginConfigured`, and `bridgeVersion`. The ping handler does not call `issueWorkFromBridge()`, does not touch the spreadsheet, does not save Drive files, and does not send email.

Result meanings:

- `成功`: iframe loaded, GAS sent a nonce-matched `jsquiz:v0.7:ready`, the page sent ping to that ready source with the exact ready origin, and GAS replied with a nonce-matched `jsquiz:v0.7:pong` from the same trusted source.
- `タイムアウト`: iframe may not have loaded a bridge that can answer ping, the Web App may still be on the old code, the user may be blocked by login/access settings, the send `targetOrigin` may not match the recipient window, or the reply origin may be `script.googleusercontent.com` and not yet allowlisted.
- `失敗`: URL, iframe loading, or browser-level loading failed before a valid pong was received.

### v0.7 Connectivity Troubleshooting

Use this flow before any real issuance test:

1. Paste the latest `gas/IssuanceBackend.js` into Apps Script and redeploy the Web App. Updating the editor file alone is not enough for an existing deployment.
2. Set `LEARNER_PAGE_ORIGIN` to the exact origin serving the test page, for example `https://example.github.io`. Do not include a path or trailing slash.
3. For the first test, leave `期待する応答 origin` blank. The page will allow the Web App origin and the expected Apps Script HTML Service `script.googleusercontent.com` reply family only when the random `bridgeSession` matches.
4. If logs show a safe `ready` from `https://*.script.googleusercontent.com`, the page will store that exact ready origin as the trusted ping target. If you want stricter deployment documentation, copy only that exact origin into `期待する応答 origin` and test again. This is an explicit allowlist entry, not a wildcard `postMessage` target.
5. If `iframe load` succeeds but no `ready`, diagnostic, or pong arrives while access is `Only myself`, treat the result as expected access-control failure for the GitHub Pages learner bridge. Open the GAS Web App URL directly only to confirm whether a Google login/permission page is being served; do not keep patching the private iframe path for learner production.
6. If `ready` arrives and `source確認` shows that the source differs from the outer iframe, this is acceptable only when origin and `bridgeSession` are valid. The page stores that `event.source` as the trusted bridge window and sends ping to that window, not to the outer iframe.

Likely causes for `iframe load: success`, `ping sent: yes`, `pong received: no`:

- The Web App access is `Only myself`, so the iframe loaded Google access/login UI instead of the bridge HTML. This is a GAS deployment/access constraint, not a bug in the local ping payload.
- The deployed Web App is still running older GAS code without the v0.7 ping/ready handler.
- The parent posted to `script.google.com`, but the Apps Script HTML content that owns the message listener is sandboxed under `script.googleusercontent.com`.
- `LEARNER_PAGE_ORIGIN` does not exactly match the GitHub Pages origin.

If HTML Service iframe source validation cannot be made reliable in the real browser, safer alternatives are:

- Use a small server-side proxy under the same site origin to call Apps Script or the Apps Script Execution API.
- Use a same-origin backend endpoint for issuance and keep GAS as a private backend dependency.
- Use a user-initiated top-level GAS flow for issuance instead of hidden iframe messaging.

## Spreadsheet Design

`setupSpreadsheetSchema()` creates these sheets:

- `issuance_codes`: `codeId`, `codeHash`, `applicantId`, `email`, `attendanceConfirmed`, `status`, `issuedAt`, `redeemedAt`, `deliveryStatus`, `deliveryReference`, `workId`, `htmlFileId`, `disabledAt`, `disabledBy`, `disabledReason`, `updatedAt`
- `issuance_history`: `eventId`, `codeId`, `eventType`, `requestId`, `createdAt`, `details`
- `issuance_requests`: `requestId`, `codeId`, `requestHash`, `status`, `createdAt`, `completedAt`, `resultJson`, `errorCode`

Spreadsheet has no real unique constraints, so `generateCode()` and request handling check duplicate `codeHash`, `codeId`, and `requestId` while holding a script lock.

## Callable GAS Server Function Surface

Apps Script HTML Service can invoke top-level server functions with `google.script.run` from the served page context. The learner deployment therefore treats hiding names in HTML as insufficient and protects each callable wrapper server-side:

- `doGet()`: HTML Service entry point. Serves the learner bridge unless Script Property `ADMIN_WEB_APP=true`, in which case it serves the interviewer app from `admin/AdminIssuanceApp.js`. Do not set that property on the public learner deployment.
- `doPost()`: disabled; returns `INVALID_REQUEST` for all JSON/API attempts.
- `issueWorkFromBridge(payload)`: learner-only issue path. It validates requestId, code, email, and quiz data server-side, enforces one-time code use under lock, applies failed-attempt limiting, and logs rejected attempts without plaintext codes.
- `setupSpreadsheetSchema(input)`: admin/setup helper. Requires explicit `input.adminToken` and is hard-rejected when `PUBLIC_LEARNER_DEPLOYMENT=true`.
- `adminGenerateCode(input)`, `adminDisableCode(input)`, `adminStatusLookup(input)`, `adminResend(input)`: admin helpers. Each requires explicit `input.adminToken`; none reads a token from the browser. All are hard-rejected when `PUBLIC_LEARNER_DEPLOYMENT=true`.
- `testGenerateCode()`: editor-only helper. It is hard-rejected when `PUBLIC_LEARNER_DEPLOYMENT=true` and otherwise runs only when `ENABLE_GAS_EDITOR_TEST_HELPERS=true`. Leave that property unset or `false` before publishing the learner Web App.

Production recommendation: keep the public learner project/deployment minimal. Run admin operations in a separate Apps Script project/deployment limited to administrator Google accounts, or run them from the Apps Script editor before setting `PUBLIC_LEARNER_DEPLOYMENT=true`.

## Script Properties

Set these in Apps Script project properties before production use:

- `SPREADSHEET_ID`: target spreadsheet ID. If omitted, the active spreadsheet is used.
- `ADMIN_API_TOKEN`: admin-only function token. Do not place this in GitHub Pages.
- `CODE_HASH_PEPPER`: secret pepper added before SHA-256 hashing. Do not place this in GitHub Pages.
- `DELIVERY_FOLDER_ID`: Drive folder used for generated HTML files. If omitted, root folder is used.
- `LEARNER_PAGE_ORIGIN`: exact GitHub Pages origin allowed to send iframe bridge messages, for example `https://example.github.io`.
- `PUBLIC_LEARNER_DEPLOYMENT`: set to `true` before deploying the learner bridge with `Who has access: Anyone`. This disables top-level admin wrappers and editor test helpers in that deployment.
- `ENABLE_GAS_EDITOR_TEST_HELPERS`: leave unset or `false` for production. Set to `true` only in an editor-only/private test context and never together with an `Anyone` learner deployment.
- `ISSUANCE_ATTEMPT_LIMIT`: failed learner issuance attempts allowed per code/client surrogate in the window. Default: `5`. Set to `0` only to disable the built-in limiter during controlled local troubleshooting.
- `ISSUANCE_ATTEMPT_WINDOW_SECONDS`: limiter window in seconds. Default: `600`.

## Web App Deploy Settings

Recommended learner bridge settings after review:

- Execute as: the script owner or controlled service account-equivalent Apps Script owner.
- Who has access: `Anyone` for public GitHub Pages learners. `Only myself` is acceptable for editor/admin tests, but not for the embedded learner bridge.
- Public route scope: keep only learner issuance available through the `doGet()` HTML Service bridge. The bridge accepts only `jsquiz:v0.7:ping` and `jsquiz:v0.6:issue` messages from `LEARNER_PAGE_ORIGIN`. `doPost()` is disabled by design. Set `PUBLIC_LEARNER_DEPLOYMENT=true` so top-level admin/test wrappers reject even if called by name.
- Do not make generated Drive files public by default. The implementation saves files and emails a notice/link reference, but sharing policy must be decided by the operator.
- Strong recommendation for v0.7: separate learner and admin surfaces. Keep `issueWorkFromBridge` in the public learner deployment, and move `adminGenerateCode`, `adminDisableCode`, `adminStatusLookup`, and `adminResend` to either a separate Apps Script project/deployment limited to administrator Google accounts or a private admin UI. Token-only admin protection is useful, but a public Web App still exposes callable function names and depends on token secrecy.

Security risk assessment for `Anyone` learner bridge:

- Main new risk: anyone on the internet can load the bridge URL. Mitigation: the bridge rejects messages unless `event.origin` exactly equals `LEARNER_PAGE_ORIGIN`; GitHub Pages never receives admin tokens; the learner request still needs a valid one-time issuance code; attendance/status checks and quiz validation run server-side.
- Abuse risk: public users can attempt codes. Mitigation: failed learner issuance attempts are counted with a CacheService-backed limiter by hashed code/client surrogate, rejected attempts are written to `issuance_history`, and Apps Script quotas should still be monitored.
- Admin risk: a public learner deployment should not contain admin UI/routes. Keep admin actions in the Apps Script editor or a separate private admin deployment; do not place `ADMIN_API_TOKEN` in GitHub Pages.

## Issuance Code Management

- Codes are generated server-side only.
- Plaintext code is returned only from `generateCode()` for delivery/printing at creation time.
- Spreadsheet rows store `codeHash`, not plaintext code.
- Status values are `valid`, `used`, and `disabled`.
- Attendance must be confirmed server-side before issuance.
- Used and disabled codes are rejected server-side.
- Invalid, missing, disabled, used, unconfirmed, conflicting, and rate-limited learner issuance attempts are logged to `issuance_history` as `code_rejected`. Audit details include the rejection reason, code hash/surrogate where available, hashed client/email surrogates where available, and request presence. Plaintext issuance codes are not logged.
- Failed learner issuance attempts are limited by `ISSUANCE_ATTEMPT_LIMIT` and `ISSUANCE_ATTEMPT_WINDOW_SECONDS`. Successful issuance clears the limiter bucket for that code/client surrogate.
- `requestId` is stored in `issuance_requests`; completed retries return the cached result.
- `requestHash` binds `requestId` to code, email, and validated quiz data so the same `requestId` cannot be reused for different work data.
- v0.9 `quizData` is a work object `{ gameTitle, backgroundColor, textColor, questions }` rather than a bare 3-question array. Colors must be `#RRGGBB` or a named allowlist value. After updating `IssuanceBackend.js`, redeploy the Web App so issued HTML matches the learner preview (title screen, colors, 3 questions, results).
- Delivery failure does not create a second issuance. Admin resend is separate.
- If HTML generation and Drive save succeed but mail fails, `htmlFileId`, `workId`, history, and current state are preserved for admin resend.
- If Drive file creation itself fails before a file ID exists, the code is marked used with delivery failure but there is no generated file to resend. The operator must reissue manually after reviewing history; this real-environment failure mode needs production rehearsal.
- Spreadsheet writes are not transactional. The implementation writes request/code/history in a consistent order and local/browser tests cover first state-write failure and history append failure, but Apps Script/Spreadsheet partial failures still need operational recovery procedures.
- History append failure is treated as non-authoritative failure: the main code/request state continues, and adapters may capture `appendHistoryFailure` diagnostics. In production, monitor Apps Script executions because a spreadsheet outage can still leave incomplete audit rows.

## GAS Editor Issuance Code Test

To test v0.7 issuance code generation from the Apps Script editor without deploying a Web App or sending email:

1. Paste the latest `IssuanceBackend.js` into Apps Script.
2. Confirm Script Properties are set: `SPREADSHEET_ID`, `ADMIN_API_TOKEN`, and `CODE_HASH_PEPPER`.
3. Confirm `PUBLIC_LEARNER_DEPLOYMENT` is unset or `false`. `testGenerateCode()` is always rejected when public learner mode is enabled.
4. Set `ENABLE_GAS_EDITOR_TEST_HELPERS=true` only for the short editor-only test window.
5. Optional: set `LOG_TEST_PLAINTEXT_CODE` to `true` only while testing if you need the generated plaintext code in the execution log. Leave it unset or set it to `false` for production.
6. In the Apps Script function selector, choose `testGenerateCode`.
7. Click Run and authorize if Apps Script asks.
8. Open Executions or Logs and confirm `testGenerateCode result` appears.
9. Confirm a new row was added to `issuance_codes` with `attendanceConfirmed` set to `true` and `status` set to `valid`.
10. If plaintext logging was enabled, copy the `[TEST ONLY] Plaintext generated code` value for manual testing, then disable `LOG_TEST_PLAINTEXT_CODE`.
11. Remove or set `ENABLE_GAS_EDITOR_TEST_HELPERS=false` before any public deploy.

`testGenerateCode()` reads `ADMIN_API_TOKEN` from Script Properties only after the helper flag/public-mode guard passes, uses a fake `test-applicant-*` applicant ID, and calls `adminGenerateCode()` so the code is registered in the configured spreadsheet. It does not call the learner issuance flow and does not send email. Do not include it in a public learner deployment without `PUBLIC_LEARNER_DEPLOYMENT=true`; that property is the production hard stop for this helper.

## Mail Distribution

The default design is Drive-save plus email notification:

1. Server validates quiz data.
2. Server generates standalone HTML.
3. Server saves the HTML file to Drive.
4. Server sends email using `MailApp`.
5. Delivery status, Drive file ID, and reference are recorded.

Local tests mock Drive and mail. No real email is sent locally.

Delivery constraints:

- Recipients do not need Google accounts to receive email, but they may need Google account access if the Drive file is shared with restricted permissions.
- The safest default is not to make files public automatically. Operators can either send the HTML as an attachment in a later implementation, manually approve Drive sharing, or provide domain-restricted access.
- Public link sharing reduces recipient friction but creates third-party forwarding risk. Domain-restricted sharing reduces leakage but may block Google-account-less recipients.
- MailApp has daily quotas and anti-abuse limits. Quota exhaustion should be treated as delivery failure and recovered through admin resend after quota recovery.
- File retention should be defined before production: retention folder, naming, owner, deletion period, and who may access historical files.

## Security Measures

- No sheet IDs, admin credentials, or secret peppers are embedded in GitHub Pages.
- Code hashing uses SHA-256 with a server-side pepper.
- Code verification and issue count enforcement happen server-side.
- Learner JavaScript source is not submitted; only `getLastValidQuizData()` structured data should be sent.
- Quiz data is revalidated server-side with strict shape and length checks.
- Admin operations require an explicit `adminToken` parameter and are disabled entirely when `PUBLIC_LEARNER_DEPLOYMENT=true`.
- General learner browsers do not receive `ADMIN_API_TOKEN`; `platform/issuance-v06-client.js` sends only code, requestId, optional email, and validated quiz data.
- The only public learner Web App route is the HTML Service bridge served by `doGet()`, which calls `issueWorkFromBridge()` with `google.script.run`. `doPost()` rejects all direct JSON requests, including `verifyCode`, `issueWork`, and admin-like actions.
- Admin routes remain server/editor functions: `setupSpreadsheetSchema`, `adminGenerateCode`, `adminDisableCode`, `adminStatusLookup`, and `adminResend`. GitHub Pages and general learner browsers must never receive `ADMIN_API_TOKEN`.
- Rotate `ADMIN_API_TOKEN` by setting a new long random script property, updating any private admin tooling, verifying the new token, then invalidating the old token. Do not commit it to GitHub Pages.
- Stronger admin option: put admin functions in a separate Apps Script project or a deployment limited to Google accounts/admins, and leave the learner Web App token-free. If learner access requires "Anyone" Web App access, do not expose admin HTML or admin callable wrappers from that deployment.
- Script locking protects duplicate code generation and one-time issuance.
- Public learner deployments use CacheService-backed failed-attempt throttling by code/client surrogate. The limiter is configurable with `ISSUANCE_ATTEMPT_LIMIT` and `ISSUANCE_ATTEMPT_WINDOW_SECONDS`.
- Generated standalone HTML escapes inline JSON and avoids external scripts, `eval`, and `new Function`.

## Production Checklist

- Create or choose a spreadsheet, then set `SPREADSHEET_ID`.
- Set strong `ADMIN_API_TOKEN` and `CODE_HASH_PEPPER` script properties.
- Run `setupSpreadsheetSchema({ adminToken: "..." })` once before enabling public learner mode, or use a separate private admin project/deployment.
- Decide Drive sharing policy. Do not default to unrestricted public links.
- Configure `DELIVERY_FOLDER_ID` and mail sender policy.
- Run `setupSpreadsheetSchema({ adminToken: "..." })` before setting public learner mode, or run setup from a separate private admin project/deployment.
- Set `ENABLE_GAS_EDITOR_TEST_HELPERS=false` or remove it.
- Set `PUBLIC_LEARNER_DEPLOYMENT=true` for the public learner Web App.
- Set `ISSUANCE_ATTEMPT_LIMIT` and `ISSUANCE_ATTEMPT_WINDOW_SECONDS` or accept defaults (`5` attempts / `600` seconds).
- Deploy the learner Web App with `Who has access: Anyone`, then record only the bridge URL in deployment-specific frontend configuration.
- Monitor failed-code-attempt audit rows, Apps Script executions, CacheService behavior, Drive/Mail quotas, and alerting.
- Verify the HTML Service bridge in a real browser after deployment.

## Local Verification

Run:

```powershell
node --check gas/IssuanceBackend.js
node gas/IssuanceBackend.local-tests.js
node platform/issuance-tests.js
```

When Node is unavailable, open these browser harnesses locally:

- `../platform/issuance-browser-tests.html`: v0.5 compatibility/browser issuance tests.
- `../platform/issuance-v06-browser-tests.html`: v0.6 GAS backend browser-equivalent tests.

These are mock/local tests. Real Apps Script, `LockService`, `SpreadsheetApp`, `PropertiesService`, `MailApp`, `DriveApp`, deployment permissions, CORS behavior, iframe redirect origins, and email delivery remain unperformed until a real GAS deployment is intentionally created.
