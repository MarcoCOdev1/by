# BYPASSER

A Node.js/Express website with a completely manual, copy-paste PowerShell guide, a Discord community connection, a user dashboard, and an administrator console. React/React Router frontend with Vite and Tailwind, original reference-inspired layouts, a borderless local hero photo, a reusable Canvas2D Herbarium renderer, and a calm voxel horizon. No licensed React Bits code, private registries, generated installers, or batch files.

## Local startup

Requires Node.js 20.19+ or 22.12+ on a supported release line and npm. SQLite uses native addons; use a supported LTS runtime with prebuilt binaries, or install Python and C++ build tools. The pinned better-sqlite3 12.11 line supports Node.js 20 and the workspace's Node.js 24. The session store uses an explicit sqlite3 6.x override to avoid its older vulnerable install-tool dependency chain. package.json allows install scripts for the two SQLite addons and Vite's esbuild. On npm versions that require manual approval, approve **only** those packages with `npm approve-scripts better-sqlite3 sqlite3 esbuild`, then run `npm rebuild better-sqlite3 sqlite3 esbuild` if needed.

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Development uses Vite middleware and HMR on the same Express origin, so cookies, OAuth, and report submissions remain same-origin. `npm run dev` requires development settings; `npm start` serves the compiled app and requires `npm run build` first. Development adds per-response script nonces, HMR connections, and Vite style allowances; production retains self-only scripts/styles. Without an `.env`, development runs with an ephemeral session secret and a clear Discord configuration checklist. The entire guide, anonymous reports, and existing downloads work. Discord is visibly unconfigured, not simulated.

For persistent sessions and Discord locally, create or edit your private `.env` and set:

```dotenv
NODE_ENV=development
BASE_URL=http://localhost:3000
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
TRUST_PROXY=0
```

Generate a secret using `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and place its output in SESSION_SECRET. Never commit `.env`. Production validates HTTPS, a non-placeholder session secret of at least 32 characters, matching redirect URI, Discord credentials, ID formats, and the webhook URL.

For a compiled local preview with your existing Discord credentials, run `npm run build`, then `npm run preview:discord`. Open **http://localhost:3000** and click Connect. This mode loads `.env` but overrides the transport to local HTTP in this process only; production settings and secrets are unchanged. It does not start the bot gateway, send welcome DMs, or deliver report webhooks. Authorized server enrollment and the optional welcome role still use the bot's REST credentials. The default `node scripts/preview.mjs` remains credential-free on port 3101.

Register **http://localhost:3000/auth/callback** under OAuth2 → Redirects at https://discord.com/developers/applications. This is a callback, not a link to start login: start through the website to establish the state/session cookie. Use `localhost` consistently, not `127.0.0.1` or HTTPS. The bot must already be installed in GUILD_ID with Create Instant Invite permission; welcome roles also require Manage Roles and the correct role hierarchy. A direct HTTP server cannot use an HTTPS localhost callback or production Secure cookies without a TLS reverse proxy.

## Discord configuration

1. Create an application at https://discord.com/developers/applications. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET from OAuth2 settings.
2. Add the exact DISCORD_REDIRECT_URI to the application's OAuth2 redirect list.
3. Create a bot and place its token in BOT_TOKEN. Put the destination server ID in GUILD_ID. IDs can be copied with Discord Developer Mode enabled.
4. Install the bot in that guild with **bot** and **applications.commands** scopes. Grant Create Instant Invite, Manage Roles, and Send Messages. Put the bot's role above WELCOME_ROLE_ID. Do not grant Administrator.
5. Set WELCOME_ROLE_ID to an optional assignable role. Set WELCOME_DM=true only if welcome DMs are desired. Members with closed DMs are handled gracefully.
6. Enable **Server Members Intent** in the developer portal and set GUILD_MEMBERS_INTENT=true to receive `guildMemberAdd` events. Guild enrollment via REST works without this privileged gateway intent.
7. Set ADMIN_IDS to comma-separated owner IDs. There is no anonymous development admin bypass. Owners can promote other users; promoted administrators can moderate but cannot grant admin privileges.
8. Optionally add a Discord channel webhook as DISCORD_WEBHOOK_URL for reports. It is never sent to the browser.
9. Register commands after configuration:

```powershell
npm run deploy:commands
```

Commands: `/ping`, `/stats`, `/download`, `/guide`, `/whoami`, `/invite`.

The website explicitly tells users that login shares their Discord profile/email and requests automatic server enrollment. OAuth requests `identify email guilds.join` with state protection and a ten-minute expiry. A successful callback rotates the session, saves the user, redirects immediately, and starts enrollment independently. Discord failures do not block login. The dashboard polls the stored result and offers reconnection after a failure. Access tokens stay in memory only for enrollment and are then revoked; they are not stored in SQLite or sessions. Leaving the server does not automatically erase the historical enrollment record.

## Downloads and guide content

The existing `data/downloads/FPS Unlocker.exe` is preserved and served under the public name `FPS-Unlocker.exe`. A file named `data/downloads/FPS-Unlocker.exe` takes priority if supplied later. Only that download and `tuto.md` are allowed; arbitrary paths and symlinks outside the downloads directory are rejected. Successful GET transfers increment download/event counts. HEAD requests do not.

`src/content/steps.js` contains all seven steps and the supplied Add-Content blocks in full, using String.raw to preserve backslashes. Startup renders `data/downloads/tuto.md` from the same data, keeping the offline commands synchronized with the website. It also creates missing banner/OG/favicon raster placeholders locally. The hero displays `public/img/700520917086135525.jpg` directly, without a border, frame, captions, or dither effect. Both music controls share `public/audio/li7wak.mp3`, with looping playback only after a user click. Playback starts directly from the gesture; decode/network failures show an error rather than substituting synthesized audio. Public customization belongs in `client/site.js`; empty credit images display their exact config keys. Shared image/audio assets remain under `/public`.

Do not execute the tutorial on the web server. Its Python scripts are commands for the reader's own Windows computer, not backend programs. This implementation did not run the third-party executable, alter hosts, or trust a certificate on the developer's machine.

### Accuracy and safety notes

- The supplied compatibility status and test date are author claims, not independent verification of the executable.
- Only step **5** needs Administrator rights; the draft's reference to step 4 was incorrect.
- “Permanent” means a ten-year token while the local server runs, not unlimited runtime. Python and cryptography are prerequisites despite the draft's “nothing to install” wording.
- CurrentUser root trust is account-specific; WinHTTP behavior depends on the account and application.
- Add-Content appends. Use a fresh folder; repeat pastes duplicate script lines.
- The supplied Python server listens on 0.0.0.0 and prints request bodies. Keep it private, never enter real credentials, and change the bind address to 127.0.0.1 for local-only use.
- Back up hosts before changing it. The supplied revert removes **all** matching entries/certificates, not only those created in this session.
- A local domain redirect does not guarantee anonymity or prevent unrelated telemetry.
- Publish a third-party executable only if you have redistribution rights. MIT covers this website and guide, not the vendor's binary.

## APIs and administrator console

All JSON uses `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Endpoint | Purpose |
| --- | --- |
| GET /api/health | Process health, uptime, version |
| GET /api/stats | Users, completed downloads, recorded joins |
| GET /api/tool | Full guide, requirements, verify/revert, reference, fixes |
| GET /api/auth/me and /auth/me | Safe profile or null, Discord availability |
| GET /api/downloads | Two whitelisted files, size, SHA-256, availability, hits |
| GET /api/media | li7wak.mp3 availability and its public source URL |
| GET /auth/login and /auth/callback | Discord OAuth flow |
| POST /auth/logout | Same-origin sign-out; GET exists with a same-origin navigation guard |
| GET /dashboard | Authenticated dashboard |
| POST /reports | Anonymous/authenticated report, 5 per IP per hour |
| GET /reports | Authenticated user's own reports |
| GET /admin | Guarded administrator page |
| GET /admin/stats | Counts and last 20 events |
| GET /admin/users?q=&offset= | Escaped parameterized user search, 100 per page |
| POST /admin/users/:id | action: ban, unban, promote, demote |
| GET /admin/reports?status= | Last 200 reports, optional status filter |
| POST /admin/reports/:id | status: open, investigating, resolved, closed |
| GET /admin/export.csv | CSV export with spreadsheet formula protection |

Reports are saved before asynchronous webhook delivery. Failed webhooks are logged without losing the report; delivery is best-effort, not a durable queue. Ban checks and admin permissions are read from the database on every request. Account pages cannot bypass guards through `/public/*.html`.

## flowersland.xyz: Namecheap, Vercel, and Discord setup

The production `.env` now uses the following public settings. Existing secrets are not replaced. Bot `/guide`, `/download`, and sign-in links use BASE_URL automatically; no command re-registration is needed just to change the domain.

```dotenv
NODE_ENV=production
PORT=3000
BASE_URL=https://flowersland.xyz
DISCORD_REDIRECT_URI=https://flowersland.xyz/auth/callback
TRUST_PROXY=1
```

These values configure the application; they do not register a domain, issue a certificate, deploy a server, or update the Discord portal. Local tests and `npm run preview:discord` intentionally continue to use localhost.

### 1. Choose a persistent backend first

The complete app cannot run unchanged as a static Vercel deployment or a Vercel Function. It needs persistent SQLite application/session files, an always-running Discord gateway, and background enrollment/webhook work. A static frontend upload alone also omits Express-served `/public` images/fonts/audio and protected service routes.

A compatible Vercel layout is **flowersland.xyz → Vercel reverse proxy → persistent Express host**. The Express host serves the built React app, APIs, downloads, and bot; Vercel is the public entry point. Use a VPS, or a continuously running service with a persistent disk/volume on a provider such as Railway or Render. A free ephemeral/sleeping service is not a substitute for persistent storage and the gateway.

On that backend:

- Use Node.js 24 LTS or the supplied Dockerfile. Run one app instance.
- Securely supply `.env` or equivalent server environment settings, including the Discord credentials, SESSION_SECRET, guild/role/admin IDs, and optional report webhook. Never upload `.env` to Git or a static output directory; never prefix secrets with `VITE_`.
- Mount persistent `DATA_DIR` and `LOG_DIR`; preserve the existing downloads and databases. The Docker instructions below already mount `data/` and `logs/`.
- Build with `npm ci` then `npm run build`, and run `npm start` as a managed service, or use the Docker/PM2 instructions below. Use `npm start`, not the local preview, to launch the gateway.
- Obtain a separate HTTPS origin address from your backend provider, such as its assigned service hostname. Keep BASE_URL and the OAuth callback on **flowersland.xyz**, not on that origin address.

The backend host and HTTPS origin address have not been selected or deployed. Those are required before the Vercel routing can be completed.

### 2. Configure Vercel's public entry point

For the reverse-proxy layout, create a separate minimal proxy project/repository containing a `vercel.json` like this. Replace the illustrative `YOUR_BACKEND_HOST` with the real HTTPS origin host; do not point it back to flowersland.xyz or it will loop. This is a setup template, not an installed deployment configuration.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "https://YOUR_BACKEND_HOST/:path*"
    }
  ]
}
```

In Vercel, use **Add New → Project**, import that proxy repository, select **Other** as the framework, disable the build command, and use `.` as the output directory. Do not upload the app's `.env`, databases, logs, or executable to that proxy project. No Discord secrets belong in the public proxy project.

Before going live, configure and verify the origin reverse proxy:

- The current CSRF guard compares browser Origin with Express's protocol and **Host header**. The trusted origin proxy must send `Host: flowersland.xyz` and HTTPS protocol to Express for public requests. Forwarding only `/api` or relying on `X-Forwarded-Host` alone is insufficient. Preserve request methods, bodies, query strings, Cookie, and Set-Cookie.
- Restrict trusted forwarding headers to authenticated/trusted proxy traffic. Configure client-IP handling so visitors do not all share one proxy IP/rate-limit bucket, and direct clients cannot spoof IPs. Set TRUST_PROXY for the actual topology; do not blindly use `true` or increase the hop count. The supplied Nginx file is for a **direct, one-proxy VPS deployment**, not a configured Vercel-to-origin chain.
- Preserve the backend's `Cache-Control: no-store` for account/API/report/download responses. Do not add CDN caching to personalized pages or counted downloads.
- Proxy the whole site, including `/auth`, `/api`, `/reports`, `/dashboard`, `/admin`, `/dl`, `/public`, and `/assets`. Do not replace service routes with a catch-all `/index.html` rewrite. Test the root, query strings, redirects, downloads, and session cookies through the public domain.

If instead hosting the frontend build itself on Vercel, its settings are **Vite**, root repository directory, install `npm ci`, build `npm run build`, output `dist/client`. That is **not** a complete deployment: public assets, protected page/service routing, same-origin proxy headers, and cache behavior still need configuration. No split frontend routing or backend migration has been implemented here.

### 3. Add the domain in Vercel

Open the proxy project's **Settings → Domains → Add Domain**. Add `flowersland.xyz` to the production deployment. Also add `www.flowersland.xyz` and configure it to redirect to `https://flowersland.xyz`; the apex is the canonical login origin.

Vercel shows the required DNS records. Copy the **exact values for this project**; do not assume a generic Vercel IP or CNAME target. Vercel provisions public HTTPS once DNS validates. A separate HTTPS certificate is still needed at the backend origin.

### 4. Configure Namecheap DNS

Open **Namecheap → Domain List → Manage** next to flowersland.xyz.

- If using Namecheap BasicDNS/PremiumDNS/FreeDNS, open **Advanced DNS → Host Records**. If the domain uses another DNS provider's nameservers, edit records at that authoritative provider instead.
- Add/update **A Record**, host `@`, value = the apex IP Vercel displays, TTL Automatic.
- Add/update **CNAME Record**, host `www`, value = the CNAME Vercel displays, TTL Automatic. DNS values are hosts/IPs, not `https://` URLs.
- Add the exact ownership-verification **TXT** record only if Vercel requests it.
- Replace conflicting parking, URL redirect, A/AAAA, or CNAME records only for the website hosts being changed. Preserve mail MX records and unrelated verification TXT records. Record existing DNS values before changes.
- If a VPS origin uses `backend.flowersland.xyz`, add a separate `backend` A record pointing to that VPS and configure TLS there. Do **not** point the apex at the VPS as well when it is assigned to Vercel.

Keep Namecheap nameservers when using this record-based method; a nameserver migration is unnecessary. Allow DNS propagation, then use Vercel's domain check until it reports a valid configuration and HTTPS works.

### 5. Configure the Discord Developer Portal

Open https://discord.com/developers/applications and select the **same application** whose client ID and bot token the backend uses.

1. **OAuth2 → Redirects → Add Redirect**: register exactly `https://flowersland.xyz/auth/callback` and save. Do not add `www`, a trailing slash, a port, or `/auth/login`. Keep the separate HTTP localhost callback only if you still want local OAuth testing.
2. **OAuth2**: securely copy the application's client ID and client secret into the backend's DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET settings. A client ID is public; the secret is not.
3. **Bot**: securely set BOT_TOKEN on the backend. Enable **Server Members Intent** because this workspace has GUILD_MEMBERS_INTENT=true; do not enable Message Content Intent unnecessarily. Guild enrollment itself uses REST and does not need the gateway intent.
4. **OAuth2 → URL Generator**: select `bot` and `applications.commands`, grant **Create Instant Invite**, plus **Manage Roles** if assigning a welcome role and **Send Messages** where commands need it. Open the generated installation link and install the bot in the destination server. Do not grant Administrator. This install link is distinct from website login.
5. Enable **User Settings → Advanced → Developer Mode** in Discord. Copy the destination server ID into GUILD_ID, an optional role ID into WELCOME_ROLE_ID, and your account ID into ADMIN_IDS. Put the bot's role above the welcome role and do not select a managed/integration role. WELCOME_DM=false keeps welcome DMs disabled.
6. If using report notifications, create a channel webhook under **Server Settings → Integrations → Webhooks** and securely set DISCORD_WEBHOOK_URL on the backend. Do not publish that URL.
7. After deploying the backend with its environment settings, run `npm run deploy:commands` once to register slash commands. Restart/redeploy the backend after later environment changes. The local preview deliberately does not launch the gateway.

Website OAuth already requests `identify email guilds.join` with consent. After the visitor authorizes, the app attempts automatic enrollment; the bot must already be installed with permission. Login remains successful if enrollment fails. There is no consent bypass or silent forced membership.

### 6. Verify before publishing

- Open `https://flowersland.xyz` and `https://flowersland.xyz/api/health`; check image/font/audio delivery and the offline guide/download links.
- Start OAuth through Connect or `https://flowersland.xyz/auth/login`, **not** by opening the callback directly. Complete authorization, confirm the dashboard session, and check enrollment. The callback is for Discord to redirect to after authorization.
- Confirm reports, account sign-out, admin permissions, and CSV export still work through the public proxy; a CSRF 403 indicates an origin/header mismatch to fix, not a reason to disable protection.
- Restart the backend and verify sessions/data persist. Confirm bot `/guide` and `/download` links use flowersland.xyz.
- If any credentials have appeared in logs, screenshots, or shared output, rotate the bot token, OAuth client secret, webhook, and session secret before publishing. Session-secret rotation invalidates old logins.

No Namecheap records, Vercel project/deployment, live Discord portal settings, or actual server membership were changed or verified by this configuration update.

Official references: [Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Vercel external rewrites](https://vercel.com/docs/rewrites), and [Namecheap A-record setup](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/).

## Production VPS: Nginx + Certbot

Use an Ubuntu/Debian VPS, DNS A record pointing your domain to the VPS (and AAAA only if IPv6 works), ports 80/443 open, and an unprivileged account owning `/opt/bypasser`. Upload the project there. Install Node.js 20.19+ or 22.12+ through your trusted package source, or Docker Engine + the Compose plugin through their official installation process. Do not run the app as root.

```sh
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

For a direct VPS deployment (without Vercel in front), point flowersland.xyz's DNS A record at the VPS instead of Vercel. Create `.env` with the production values above, TRUST_PROXY=1, and all required secrets. Set restrictive permissions on `.env`. The supplied `nginx/bypasser.conf` now uses `server_name flowersland.xyz`. Enable it, then:

```sh
sudo cp /opt/bypasser/nginx/bypasser.conf /etc/nginx/sites-available/bypasser
sudo ln -s /etc/nginx/sites-available/bypasser /etc/nginx/sites-enabled/bypasser
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d flowersland.xyz
sudo certbot renew --dry-run
```

Certbot adds TLS and the HTTP-to-HTTPS redirect. Check its automatic renewal timer. This direct setup expects flowersland.xyz to resolve to the VPS; a Vercel origin needs its own separate hostname/configuration. Access production through HTTPS; secure session cookies intentionally do not work over plain HTTP. Keep the application port inaccessible from the public internet. Nginx replaces client forwarding headers; do not set TRUST_PROXY=true or put an additional proxy in front without adjusting the trust boundary.

### Docker deployment

The multi-stage node:24-alpine build uses the same Node.js release line as local verification in both stages, compiles SQLite addons, builds the React frontend into `dist/client`, prunes development dependencies, and runs as the non-root `node` user. Bind mounts preserve `data/` and `logs/`. On Linux, ensure those directories and existing database files are writable by container UID 1000 before startup. The executable is excluded from the image; put it in the host's mounted `data/downloads/` directory.

```sh
cd /opt/bypasser
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 app
```

Compose starts the app on host loopback port 3000; the host Nginx/Certbot configuration above completes the HTTPS deployment. `.env` is required. For an intentional local Docker preview without Discord, use NODE_ENV=development, local HTTP URLs and TRUST_PROXY=0 (the compiled frontend is still served); use HTTPS production settings before exposing the site. Do not run Docker and PM2 copies simultaneously against the same port/data.

### PM2 alternative

In `/opt/bypasser` as the unprivileged app owner:

```sh
npm ci
npm run build
npm prune --omit=dev
npm install -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Run the exact startup command PM2 prints for your account. PM2 uses one fork process (not cluster mode) so the Discord gateway and in-memory rate limits are not duplicated. Restarts above 300 MB are configured. For updates use `pm2 restart bypasser --update-env`. Bind the app behind Nginx and restrict public access to port 3000.

## Security, storage, and operations

- Production Helmet CSP is self-only for scripts/styles, permits Discord avatars and local/data image masks, and blocks framing and inline event handlers. Vite development exceptions never apply to compiled production delivery. HSTS/upgrade-insecure-requests are production-only.
- HTTP-only SameSite=Lax session cookies are secure in production; connect-sqlite3 stores sessions in `data/sessions.sqlite`.
- Global rate limit: 120/minute per IP; auth: 20/minute; report POSTs: 5/hour. Limits are process-local and reset at restart. Stay on one app instance unless introducing a shared limiter store.
- Same-origin Origin validation protects mutation endpoints, including anonymous reports. The honeypot and strict length/type checks help reduce spam; no HTML from user input is rendered.
- SQLite schema is in `src/db.js`, WAL and a five-second busy timeout are enabled. The application database is `data/bypasser.db`.
- Users include Discord email/locale; download records include IP/user-agent. Reports can be relayed to Discord. Configure a suitable privacy notice and retention policy for your deployment.
- Events and JSON Pino logs record logins, joins, downloads, admin actions, reports, and failures without OAuth tokens or client secrets. Pino writes `logs/app.log`. Rotate these logs using your OS logrotate policy; PM2's output files need rotation too.
- Back up SQLite using its backup API or stop the app cleanly before copying database files. Do not copy only the main database while WAL writes are active. Keep backup permissions restrictive and test restore procedures.
- SIGINT/SIGTERM stop the HTTP listener, Discord client, and database connections.

## Verification

```powershell
npm test
npx --yes playwright install chromium
npm run test:browser
```

Tests use the built-in Node.js test runner and an isolated temporary data directory under the workspace. They cover response envelopes, static pages/CSP, full guide/offline parity, hashes/download counts and traversal rejection, CSRF/body validation, OAuth state/scope/session rotation with mocked Discord fetch, enrollment success/failure, reports, administration, bans, CSV formula protection, and rate limits. Mocked Discord tests are not proof of live OAuth, permissions, role hierarchy, webhook delivery, or slash-command registration. Those require configured credentials and a real guild.

Media, login configuration, and font/glass verification covers a production build, 15 backend tests (including production-domain bot links and local-preview overrides), 49 synthetic raster/React interaction tests, and six Chromium acceptance tests. Browser checks cover actual 1440×900 and 360×800 viewports, additional 1024px/768px typography checks, local-font loading, dark/light gradient glass surfaces, the borderless supplied JPEG, nonempty voxel frames, animation/pause/resume/offscreen behavior, reduced motion, all ten exact command copies (normalizing only Windows clipboard CRLF), no audio autoplay, actual MP3 decoding/playback, and shared header/record play/mute controls, consent cancellation, anonymous report submission, own-report isolation/enrollment polling, admin search/pagination/moderation/triage/CSV, sign-out, primary-button text contrast, and mobile account layouts. Screenshots are saved under `data/.test-browser-evidence/`; tests use fresh isolated databases and never run guide commands or the executable.

One additional development smoke test passed for nonce CSP, styled React, and a connected Vite HMR socket on the Express origin. Run it separately in PowerShell:

```powershell
$env:PREVIEW_TEST_DEV='1'
try { npm run test:browser } finally { $env:PREVIEW_TEST_DEV='' }
```

Dependency audit reported zero vulnerabilities. Browser acceptance uses test identities; Discord API behavior is mocked by backend tests. The real-credential local preview's OAuth redirect and state-cookie creation were verified without following the authorization link. Completed live OAuth, guild permissions, role hierarchy, and deployment through Docker/PM2/Nginx/Certbot remain unverified. Docker was not available locally; its updated configuration was inspected, not built or run. Those checks require the target infrastructure and authorized credentials.

## Canvas artwork and original layouts

The landing page now uses the supplied JPEG directly. The renderer remains reusable and tested, but is not mounted in the hero. `client/effects/herbarium-preset.json` preserves the full supplied preset. `AsciiCanvas` accepts `source` and `overrides`; defaults use the locally vendored `public/img/ref-045.webp` from `https://21st.dev/ascii-editor/demos/generated/ref-045.webp`. It is source photography, not React Bits component code; review photography rights before public redistribution.

The independent renderer samples actual RGB averages and implements all 25 requested modes, deterministic coverage, density/inversion/edges, ordered Bayer dither, contour interpolation, vertical halfblocks, character ramps, and self-animated matrix streams. Processing order is background/primitives, brightness/contrast/saturation/grayscale, blend tint, blur, post-effects, lights, then photo-reveal mask. All supplied post-effect keys are supported. Opaque grayscale masks use luminance; masks with transparency use alpha. Missing masks are inert. Brush metadata is accepted, but there is no painting editor.

Artwork uses a bounded DPR and reusable raster buffers, a maximum 30fps clock, and visibility/intersection pausing. The navigation's pause control stops Canvas and CSS motion; system reduced motion renders static artwork, freezes the gradient ribbons, and suppresses orbit, tilt, and record rotation. The ambient background also pauses in hidden tabs and preserves manual pause when returning. Audio is gesture-only and never autoplays. Reference layouts are original adaptations of the supplied descriptions, not installed Pro components. Counters are real; factual cards replace testimonials and Discord updates replace unsupported newsletter submission.

Typography uses the supplied local assets under `public/fonts`: WANARASETA for UI/body text, Casa Sol Display for headings, Casa Sol Script for accents, and Flower Frame for decorative credit artwork. Command blocks remain monospaced. Fonts are served by Express under `/public/fonts`, so Vite leaves these URLs unchanged for runtime delivery; no external font service or additional CSP allowance is required.

Frontend source is in `client/`; compiled output is in `dist/client`. `/dashboard` and `/admin` have both server and client guards. Unknown service routes stay JSON errors; unknown page routes return HTTP 404 with the React shell. Legacy account-page aliases still redirect through protected routes. Production does not serve Vite's source files.

For a credential-free compiled preview on port 3101: `npm run build`, then `node scripts/preview.mjs`. This skips local environment-file loading and does not start the Discord bot. For isolated browser acceptance on port 3102: `node tests/preview.mjs`; that harness creates a separate test database and test-only identities, is excluded from Docker, and must never be deployed as a service.

## 🇫🇷 En bref

Everything is manual: read the guide, copy each PowerShell block yourself, and keep control over certificate trust and hosts changes. Discord login is optional and clearly requests permission for server enrollment.

## 🇲🇦 B d-Darija

Start with the requirements, follow the seven steps in order, and use the troubleshooting section when needed. Keep the local server private, avoid real passwords, and revert the changes when finished.

## License

MIT for website code and documentation. Independent project; not affiliated with SEVEN Corporation or any other vendor.
