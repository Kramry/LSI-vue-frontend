# lsi-smarttrack-frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## SmartTrack API integration

The current Vue login and attendance scanner use LavaLust's existing PHP
session. This is a better fit for this same-origin app than storing JWTs in
browser storage: the session cookie is HTTP-only, and state-changing requests
send the session CSRF token in `X-CSRF-Token`.

The development API base is `/api`. `.env.development` proxies it to
`http://localhost:8000` by default. Update `API_PROXY_TARGET` there if your
backend listens elsewhere. Production builds use the backend's `/api` URL
from `.env.production`; override `VITE_API_BASE_URL` in the deployment
environment when deploying to a different backend. Prefer serving the Vue app
and PHP API on the same origin. If they use separate origins, set the backend
`SMARTTRACK_FRONTEND_ORIGIN` to the exact frontend origin. For a cross-site
frontend, also set `SESSION_COOKIE_SAMESITE=None` and
`SESSION_COOKIE_SECURE=true`; use HTTPS. The default cookie policy remains
`SameSite=Strict`.

### Login and attendance endpoints

These endpoints use `{ "ok": true, "data": ..., "message": "" }` or
`{ "ok": false, "message": "...", "errors": {...} }`.

| Method and path | Request | Roles |
|---|---|---|
| `GET /api/session` | None; returns authentication state and a CSRF token | Public |
| `POST /api/login` | `{ "username": "...", "password": "..." }` | Public; CSRF required |
| `POST /api/register` | `{ "full_name": "...", "username": "...", "email": "...", "password": "...", "password_confirmation": "..." }` | Public; CSRF required; creates a trainee account |
| `POST /api/logout` | Empty JSON body | Signed-in users; CSRF required |
| `GET /api/attendance/classes` | None | Administrator, staff, instructor |
| `GET /api/attendance/classes/{classId}/schedules` | None; today's sessions | Administrator, staff, instructor |
| `GET /api/attendance/today` | None; today's records | Administrator, staff, instructor |
| `POST /api/attendance/scan` | `{ "qr_code": "...", "scan_action": "in", "class_id": 1, "schedule_id": 1 }`; schedule may be `null` | Administrator, staff, instructor; CSRF required |

Login failures return `401`; missing authentication returns `401`; forbidden
roles/classes return `403` or `404`; invalid fields and scan conflicts return
`422`. The attendance view stores scans in IndexedDB when offline and retries
them when connectivity returns. A rejected queued scan is removed and shown as
an error rather than retried indefinitely.

### First-slice test checklist

1. Open `/login`; submit invalid credentials. Expect `401` and an error toast.
2. Sign in with an active account. Expect a session cookie and user/CSRF data;
   the app should open the dashboard.
3. Open Attendance as administrator, staff, or instructor. Expect authorized
   classes, today's schedules, and the live attendance list (or an empty state).
4. Select a class and scan an enrolled trainee QR code for time-in. Expect the
   returned trainee name and `Present` or `Late`, and a new live-list row.
5. Scan the same trainee for time-out. Expect the same server-calculated status
   and a populated time-out in the live list.
6. Submit a blank/invalid scan or a trainee not enrolled in that class. Expect
   `422` with a message; try a class outside an instructor's assignment and
   expect access to be denied.
7. Remove network access in browser DevTools, scan a code, and confirm the
   pending-sync badge. Restore access and confirm the queued scan appears in
   today's list.

Example requests (replace `<csrf>` with the token from the session/login
response; keep the cookie jar between calls):

```powershell
curl.exe -i -c session.txt "http://localhost/LavaLust-dev-v4-LSI/LavaLust-dev-v4/public/api/session"
curl.exe -i -b session.txt -c session.txt -H "Content-Type: application/json" -H "X-CSRF-Token: <csrf>" --data-raw '{"username":"staff1","password":"your-password"}' "http://localhost/LavaLust-dev-v4-LSI/LavaLust-dev-v4/public/api/login"
curl.exe -i -b session.txt -H "Content-Type: application/json" -H "X-CSRF-Token: <csrf-from-login>" --data-raw '{"qr_code":"LSI-QR-001","scan_action":"in","class_id":1,"schedule_id":null}' "http://localhost/LavaLust-dev-v4-LSI/LavaLust-dev-v4/public/api/attendance/scan"
```

Attendance history, reports, absence alerts, announcements, inquiries,
documents, user accounts, ID generation, assessments, certificates, and
payments remain for subsequent screen-by-screen integration.
