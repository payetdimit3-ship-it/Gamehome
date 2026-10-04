# KELVIN-GAMING-SHOP / GameHub

Professional mobile-first gaming marketplace for Tanzania.

## Pages
- Home
- All Games
- Steam Accounts
- eFootball Vikosi
- eFootball Coins / Top-Up
- Gift Cards
- Cloud Gaming / Rental
- Live Scores
- Tournaments
- Courses
- Marketplace
- Wishlist
- My Games / My Orders
- Requests
- Profile
- Health & Community Support
- Contact / FAQ / Terms / Refund

## AI
The server supports four direct AI providers:
- Google Gemini
- OpenAI
- DeepSeek
- Anthropic

Set the keys only in Render Environment Variables. Never commit API keys to GitHub.

Recommended Render variables:
`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`
plus the model variables shown in `.env.example`.

`NEXUS_AI_PRIMARY` chooses the first provider and `NEXUS_AI_FALLBACK` is the second choice. Any other configured provider can be used as an additional fallback.

## Run
```bash
npm install
npm start
```

Render:
- Build Command: `npm install`
- Start Command: `npm start`

This project stores runtime JSON data in `.data/` and can back it up to Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured.


## 🆕 MEDIA + AI BUILDER UPDATE (17 Sep 2026)

### Public pages
- `live.html` — customers watch admin-published live match streams or uploaded match videos.
- `movies.html` — customers watch movie/video uploads.
- `courses.html` — course library with per-course video players + AI Course Tutor.
- `health.html` — Health AI with text + browser voice input/output.
- Global `chat.js` AI assistant now includes microphone input and automatic voice read-out.

### Admin Dashboard
New **📺 Media & Live** tab:
- Add live match/stream using an embed URL or video URL.
- Upload Movies (MP4/WebM/MOV).
- Create courses.
- Upload a video for each course.

New **🧠 AI Web Developer & Manager**:
- Internal Claude-powered JSON action builder.
- Preview or execute approved changes from a prompt box.
- Supported safe actions: products, banners, movies, course videos, live matches and settings.
- It intentionally does NOT execute arbitrary raw JavaScript/SQL/HTML sent by the model.

### Storage
For production on Render, configure Supabase Storage:
```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=gamehub-media
```
The server creates/uses the `gamehub-media` bucket if available; local `/uploads` is only a fallback and may be ephemeral on Render.

### AI Builder
```env
ANTHROPIC_API_KEY=...
NEXUS_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```
Keep all AI/payment secrets only in Render environment variables, never in frontend HTML/JS.

### Important
Only upload/stream movies and sports content that you have the right/permission to distribute. The live page is a player for streams that the admin controls; it does not provide a source of copyrighted broadcasts.


## Live stream links
- YouTube watch/live links are automatically converted to YouTube embed URLs.
- Direct MP4/WebM files play in the built-in video player.
- HLS `.m3u8` streams use hls.js when supported.
- A normal webpage URL cannot always be embedded because the source site may block iframe embedding (X-Frame-Options/CSP).


## Production persistence & payments (important)
Set these on Render before production use:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `SUPABASE_KV_TABLE=kv_store`
- `AZAMPAY_ENVIRONMENT=sandbox` or `production`
- `AZAMPAY_APP_NAME`, `AZAMPAY_CLIENT_ID`, `AZAMPAY_CLIENT_SECRET`
- Optional `AZAMPAY_API_KEY` and `AZAMPAY_API_BASE` according to your current AzamPay merchant documentation.

The checkout page now calls `/api/azampay-pay` and polls `/api/azampay-check/:ref`. The old `/api/clickpesa-*` routes are kept as compatibility aliases.

If `SUPABASE_SERVICE_ROLE_KEY` is missing, Render's local filesystem is not a durable database and product/order data can disappear after a restart/redeploy. The Admin Command Center shows a storage warning in that case.

### Supabase `kv_store` table (if missing)
Run once in Supabase SQL Editor:

```sql
create table if not exists public.kv_store (
  file_name text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kv_store enable row level security;
```

The GameHub server uses the service-role key server-side to read/write this table. Do not expose that key in frontend code.


## UI Update — Professional Store + Hero Studio
- Home hero imebakizwa kama clean gaming hero; trailer cards sasa ziko chini ya hero.
- Kila product ya Shop yenye `trailerUrl` inaonekana kwenye Featured Trailers ikiwa na game name, image, Admin price na Buy Now.
- Admin imepata Dashboard/Overview iliyorejeshwa, Command Center, na Hero Studio bila kuondoa modules za Orders, Customers, Products, Requests, Marketplace, Coupons, Security, Media & Live na AI.
- Hero Studio inaruhusu kuchagua product na kuongeza/kuondoa YouTube, MP4 au WebM trailer. Bei inasomwa moja kwa moja kutoka product, hivyo ikibadilishwa Admin inabadilika Home.
- Orders filters/export na dashboard functions zimeunganishwa kikamilifu; previous missing `loadOrders`, `loadCommandCenter`, `refreshAll`, `renderOrderFilters` na `exportOrdersCSV` zimerudishwa.
- Global storefront styles zimepandishwa kuwa professional dark gaming UI yenye responsive mobile layout.

## LIFEISGAMETZ Pro V3 — Hero, Public Chat & Payments

### Hero / trailers
- Admin → Hero Studio → chagua game → weka Trailer URL.
- Home inaonyesha trailer kubwa juu, kisha Hero copy iko chini ya video.
- Kila trailer inasoma `name`, `imageUrl` na `price` moja kwa moja kutoka product, na ina **Buy Now**.
- Ukibadilisha bei kwenye Bidhaa, bei ya trailer inabadilika pia.

### Public Chat
- `chat.html` ni public na haihitaji login.
- Messages zinahifadhiwa kwenye `public_chat.json` na zinaweza kubackup kupitia Supabase KV.
- Admin → Public Chat inaweza kuondoa ujumbe.

### AzamPay
- Checkout sasa inaruhusu kuchagua provider: `Mpesa`, `Tigo`, `Airtel`, `Halopesa`, `Azampesa`.
- Render env lazima itumie `AZAMPAY_ENVIRONMENT=sandbox` au `production`.
- Weka `AZAMPAY_APP_NAME`, `AZAMPAY_CLIENT_ID`, `AZAMPAY_CLIENT_SECRET`; `AZAMPAY_API_KEY`/`AZAMPAY_API_BASE` hutumika pale merchant docs zako zinapohitaji.
- Callback endpoint ya app ni `/api/azampay-callback`; merchant callback lazima isetiwe kwenye AzamPay merchant/developer configuration kwa URL ya Render ya app yako.
- Admin → Payments inaonyesha kama credentials zimesanidiwa bila kuonyesha secrets.
- Manual payment bado ipo kama fallback na sasa writes zake zinasubiriwa (`await`) ili data isiwe stale kabla ya response.

## 🎨 ZONEPLAY REDESIGN (V6)

One layout for every page (sidebar + topbar + mobile bottom navigation), dark mode.

- `zoneplay-full.css` — design system (tokens, shell, poster cards, hero, tiles, legacy-page skin)
- `zoneplay-shell.js` — builds the sidebar / topbar / bottom nav on **every** page that includes it, marks the active item, shows the logged-in user, cart badge and admin link
- `zp-catalog.js` — shared product loader (`/api/products` + seeded defaults), platform detection and poster cards
- Rebuilt pages: `index.html` (Home), `shop.html` (Store + PSP/PS2/PS3/Switch/Android/PC via `?cat=`), `categories.html` (Games)
- Platform pages use the product's `category` / `type` / `name` (e.g. "PSP", "PS2", "Nintendo Switch"); set the category in Admin → Products to place a game on a platform page.
- Home hero shows admin product trailers/images and `/api/banners`; falls back to built-in slides.
- Remaining pages keep their content and get the new layout + skin; they are redesigned module by module.

### Live Scores
`livescores.html` reads `/api/live-streams` (the matches admin adds under Media & Live). Admin can now set **home/away goals and minute** when adding a match, and update score/status from the list (💾) — new endpoint `POST /api/admin/live-streams/:id/score`.

### Live TV / Sports
`live.html` — one main player (YouTube, MP4/WebM, HLS `.m3u8`, or embed URL), a list of current matches and a card grid. Deep link: `live.html?id=<streamId>` (used by the Live Scores "Tazama" button). The 30s refresh only touches the player when the stream actually changes.

### Gift Cards
`giftcards.html` — brand tiles (Steam, PlayStation, Xbox, Nintendo, Google Play, Apple, Roblox; only brands that have products are shown) + card-faced products with search and sort. Products come from the store catalogue (kind = gift card). Brands are text wordmarks, no logos.

### Academy
`academy.html` — hero with live course/video counts, real courses from `/api/courses` (card → `courses.html?id=`), learning-path tiles, AI Mentor. `courses.html` — one player + lesson playlist (auto-plays next lesson), course tabs, AI Course Tutor (text, mic, read-aloud) via `/api/ai/chat`. Deep links: `courses.html?id=<courseId>&v=<videoId>`, `courses.html#tutor`.

### Cloud Gaming
`cloudgaming.html` — hero, 4-step flow, rental packages and pre-flight notes. Package values come from `ZP.RENTAL` in `zp-catalog.js` (same numbers as `rental.html`); all buttons lead to `rental.html`, which still has the original layout.

### Rental
`rental.html` — packages, custom-time calculator (max 24h) and live cart summary. Packages/prices come from `ZP.RENTAL`, and the custom price rule from `ZP.rentalPrice()` in `zp-catalog.js` (also used by `cloudgaming.html`). Cart items keep the original shape (`rent<min>` / `rentC<min>-<ts>`, `rentalMinutes`).

### Movies
`movies.html` — featured (newest) banner, search + genre chips + sort, poster grid (uses the movie `poster` URL when set, otherwise a generated cover) and a player modal (YouTube or direct/uploaded video; playback stops on close). Deep link: `movies.html?id=<movieId>`. Data: `/api/movies`.

### Community / Chat
`chat.html` — public room (`/api/public-chat/messages`, unchanged API): grouped messages with day separators, your own messages on the right (ids kept only in this browser's localStorage), nickname remembered, inline errors (incl. the server's rate-limit message), quick emoji, optional voice input, polling every 7s that never moves the scroll position unless you are at the bottom. `community.html` (Community Help) is a different page and keeps its old layout for now.

### Health Assistant
`health.html` — prominent (non-dismissible) medical disclaimer, chat with the health AI (`POST /api/ai/health` with `{message, history[last 8]}`, unchanged), suggested questions, voice input (auto-sends), read-aloud, reset button, and links to Health Network / Recovery / Community Fund / Community Help. Nothing from the conversation is stored in the browser.

### eFootball
`efootball.html` — hero, tabs to Coins & Top-Up / Tournaments, squad poster grid (products with `section:'efootball'`, loaded with `ZP.loadSection('efootball')`), search + sort, wishlist hearts, links to related pages. `topup.html` (Coins) keeps its old layout for now.

### Coins & Top-Up
`topup.html` — top-up packages from the catalogue (any admin section, kind = top-up/coins/points, plus the built-in defaults), filter by game, search, sort; falls back to the defaults if the API is unreachable. Contact details live in `ZP.CONTACT` (`zp-catalog.js`): WhatsApp 0786 095 758, lifeisgametz@gmail.com. Old placeholder numbers/emails in page footers were replaced site-wide.

### AI Assistant
`ai.html` (sidebar → AI Assistant) — full-page version of the site chat: suggested questions, conversation with the last 10 turns sent as `history` to `POST /api/ai/chat` (unchanged), voice input, read-aloud on demand (no auto-speak), reset, and WhatsApp/email handoff. The floating chat bubble is hidden on this page; the header AI button focuses the input here.

### Marketplace
`marketplace.html` — partner businesses from `/api/marketplace` (admin-posted): search, category chips, sort, cards with WhatsApp / email / website button built from the listing's `contact` (local numbers like 0712… are converted to wa.me/255712…; anything else is shown as plain text). "Orodhesha Biashara" opens WhatsApp with a prefilled message.

### My Games / Library
`mygames.html` — (1) rental timers from `localStorage.gamehubRentals` (live countdown + progress bar, last 5 finished ones kept as history), (2) GeForce NOW launcher, (3) Library built from the customer's *successful* orders via `GET /api/my-orders` (download links; account details are hidden until clicked, with copy buttons; rentals are excluded). Pending orders are counted with a link to `myorders.html`.

### Cart
`cart.html` — rows with quantity stepper (1–99), remove with undo toast, two-step "Futa Kikapu", live total and count, payment-method chips, and suggested products when empty. Same storage key/shape (`gamehubCart`), so `checkout.html` and `rental.html` are unaffected. Item names are escaped before rendering.

### Wishlist
`wishlist.html` — saved games (`localStorage.gamehubWishlist`, price accepted as number or "45,000 TZS") shown as poster cards; prices are refreshed from the shop (`ZP.loadSection('*')` + built-in defaults): chips show "Bei imeshuka/imepanda" or "HAIPATIKANI TENA" (only when the shop answered). Heart removes with an undo toast, "Futa zote" needs a second click, sort by newest/price/name. Buying goes through `product.html` so the cart item keeps its usual shape.

### Profile
`profile.html` — account card (name, email, role), stats (orders / active rentals / wishlist / cart), tournament balance when > 0, shortcuts, logout, admin button, WhatsApp for account changes. **Fix:** the old page called `/api/auth/me` without the `Authorization` token, so it always said "Ingia kwanza"; it now sends `gamehubToken`. There is no profile-edit API, so nothing is editable here yet.

### Checkout
`checkout.html` — two-column layout (payment on the left, order summary + coupon on the right; summary first on phones). **Payment API contract unchanged:** `POST /api/coupons/check`, `POST /api/azampay-pay {total, phone(255…), provider, name, items}` then polling `GET /api/azampay-check/:tx_ref` every 5s (max 36), `POST /api/manual-pay {items,total,txRef,phone}`; cart/quick-buy sources (`gamehubCart`, `?quick=1` + `gamehubQuickBuy`) and success handling (`gamehubLastOrder`, cart cleared, redirect to `success.html` / `myorders.html`) are the same. Changes: names escaped, phone validated (255 + 9 digits) before calling the API, login banner up front, name prefilled from the account, the unused e-mail field replaced by a note showing the account e-mail, and the internal note about Render merchant credentials removed from the customer-facing page.
**Known risk (server side, not changed):** totals, item prices and the coupon discount are computed in the browser and trusted by the server — re-price the order on the server before going live.

### Login
`login.html` — split layout (welcome panel + form), password show/hide, "Umesahau password?" hands over to WhatsApp support with the typed e-mail (there is no reset API), already-signed-in notice. **Fix:** checkout sends `login.html?return=checkout.html` but the old page always went to `index.html`; it now returns to the requested page. Only plain same-site pages (`name.html` with an optional query) are accepted — external, `//` and `../` targets fall back to `index.html`. API unchanged: `POST /api/auth/login` → `gamehubToken` + `gamehubUser`. `register.html` still ignores `?return=` (next page).

### Register
`register.html` — same split layout as `login.html`, password show/hide, already-signed-in notice, client-side checks matching the server (`password.length>=4`, optional phone format), and now honours `?return=` the same safe way as Login (falls back to `index.html` for anything that isn't a plain same-site page). API unchanged: `POST /api/auth/register`.

### Settings (new — device preferences, no account-settings API exists)
`settings.html` — device-only preferences (stored under `zp_*` keys in localStorage via `ZP.pref`/`ZP.setPref` in `zp-catalog.js`), reachable from the sidebar (ZAIDI) and the account menu:
- **AI reply language** (Kiswahili/English) — applied to every AI call (`ai.html`, `health.html`, `courses.html` tutor) by prefixing the message with an instruction via `ZP.aiMessage()`; Swahili is the default and leaves messages unchanged.
- **Data Saver** (`ZP.dataSaver()`) — when on, video/stream embeds don't autoplay: Home hero slides, `live.html`'s player and the `movies.html` modal all show a tap-to-play overlay instead.
- **Sauti ya Ujumbe Mpya** — a short Web Audio beep (`ZP.beep()`, no audio file) when Community Chat receives a new message from someone else (not your own, not the initial load).
- Device-data summary (cart/wishlist/active-rental counts) and a two-step "Futa Data ya Kifaa" that clears cart, wishlist and these preferences on this browser only — account, orders and rentals are untouched.
- No account-detail fields (name/email/password) — the server has no endpoint for that; a WhatsApp button is offered instead, same as Profile.

### Community Help
`community.html` — hero, 4 pillar cards (Health Education → `health.html`, Online Safety, Financial Literacy, Emergency Information — the last 3 jump to sections on this page), safety/financial tip lists (general, non-diagnostic advice), a strip linking to Health Network / Recovery Support / Community Fund / Community Chat, and a non-specific emergency notice (no invented phone numbers — it points people to local official services). WhatsApp buttons open with a prefilled message. **Fix:** removed a stale sidebar alias that made `community.html` highlight "Community / Chat" instead of its own "Community Help" entry.
**Known site-wide quirk (not introduced here):** the floating "Msaidizi AI" button (`#ghChatBtn` in `chat.js`) is fixed at the bottom-right on every page and can sit over content on long mobile pages, including this one.

### Admin (dedicated sidebar, business logic untouched)
Admin already inherited the shared shell/skin from Step 1 (sidebar+topbar+card colours). This pass replaces the **customer sidebar** with a dedicated **Admin OS sidebar** (`ADMIN_NAV` in `zoneplay-shell.js`) matching the 13 tabs — Dashboard, Command Center, Mauzo, Payments, Public Chat, Wateja, Bidhaa, Hero Studio, Requests, Marketplace, Coupons, Usalama, Media & Live, AI — plus "Rudi Dukani". The old top pill-row (`.admin-tabs`) still exists and works, just visually hidden (`display:none`) since the sidebar replaces it; nothing about tab switching, forms, or data loading inside each tab was changed.
- Deep-linking: `admin.html#tab-products` opens that tab on load; clicking a tab (sidebar or the hidden pill row) keeps the hash in sync (`location.hash`), so the sidebar highlight, browser back/forward, and bookmarks all agree.
- The 5-item mobile bottom nav (Home/Store/Cart/Library/Profile) is hidden on `admin.html` — it's for shoppers, not staff.
- **Deliberately not done** (would touch business-critical logic and needs a live login to verify safely): rebuilding the internal tab content (tables, upload forms, Command Center, Security) with the `zp-*` component classes used elsewhere. It currently keeps its original markup/CSS classes (`dash-hero-card`, `tab-btn`, etc.), just recoloured to match. Say the word if you want that deeper pass — it touches products, payments, security and user management, so it's worth doing as its own careful session with your real login.

### My Orders
`myorders.html` was **never migrated** in earlier steps (missing `zoneplay-full.css`, old `style.css` sidebar) — fully rebuilt now. Status chips (Zote/Zilizothibitishwa/Zinazosubiri/Zenye Tatizo), one card per order (tx_ref, date, total, status pill, items), download buttons and hidden-by-default account credentials with copy buttons (same pattern as My Games). API unchanged: `GET /api/my-orders`, and the ClickPesa self-heal check (`GET /api/clickpesa-check/:tx_ref`) still runs once per pending order and silently reloads the list if any turned successful. **Fix:** removed a stale sidebar alias that made `myorders.html` highlight "My Games / Library" instead of its own "My Orders" entry.

### Steam Accounts
`steamaccounts.html` was also never fully migrated (old `style.css` sidebar block) — rebuilt using the shared poster-card grid (`ZP.loadSection('steam')`, forced `kind:'account'` so cards show the ACCOUNT tag), search, sort, and a safety note that credentials appear in My Orders after payment. **Fix:** removed a stale sidebar alias that made it highlight "Store" instead of its own "Steam Accounts" entry.

### Tournaments
`tournaments.html` — also never migrated (old sidebar). Rebuilt: hero with live counts, a card grid (name, game, date, description, OPEN/LIVE/CLOSED badge — CLOSED tournaments have no "Jiunge" button), and registration through a modal instead of an always-visible inline form. New reusable `.gm-modal`/`.gm-box` classes (generic popup dialog) for this and future pages. API unchanged: `GET /api/tournaments`, `POST /api/tournaments/register {tournamentId,name,phone,game,userToken}`.
**Bug fixed (this pass, found while testing the modal):** the modal's `<input>`s inherited plain white browser styling because they sit outside `.zp-content` (deliberately, like the Movies/Live TV modals, so a modal is never affected by the page's own layout) — `.gm-modal input/select/textarea` now has its own explicit dark styling instead of depending on that scope.
**Sidebar bug fixed for 4 pages at once:** `community.html`, `myorders.html`, `steamaccounts.html` and `tournaments.html` each already had their own dedicated sidebar entry, but a leftover `ALIAS` mapping (from before those pages existed as their own destinations) made the sidebar highlight a *different* item instead. While fixing this I found and fixed three more of the same bug that hadn't been reported yet: `topup.html` (was highlighting "eFootball / Top Up" instead of its own "eFootball Coins"), `rental.html` (was highlighting "Cloud Gaming" instead of its own "Cloud Rental"), and `recommendations.html` (was highlighting "Store" instead of its own "Recommendations"). `ALIAS` in `zoneplay-shell.js` now only contains the pages that genuinely have no sidebar entry of their own: `product.html`, `checkout.html`, `success.html`, `courses.html`.

### Contact
`contact.html` — hero, three real contact cards (WhatsApp/email/phone via `ZP.CONTACT`), quick links to FAQ/Terms/Requests/My Orders. No contact-form endpoint exists on the server, so this page only offers the direct channels rather than a form that would go nowhere.

### FAQ
`faq.html` — same 7 questions, now as an accessible `<details>/<summary>` accordion (first one open by default) instead of always-expanded text blocks.

### Terms & Refund
`terms.html` and `refund.html` — numbered policy-section cards, cross-linked tabs between the two, and a WhatsApp CTA on Refund pre-filled with a Jina/Tarehe/Tx Reference/Tatizo template. **Fix:** `refund.html` had no sidebar representation at all (highlighted nothing); added to `ALIAS` so it highlights the shared "Terms & Refund" entry, same as `terms.html`.

### Game Requests
`requests.html` — also never migrated (old sidebar block). Rebuilt: submission form with inline status (was already inline), and a ranked list (🏆 for #1) with a per-row vote button and inline confirmation. API unchanged: `GET/POST /api/requests`, `POST /api/requests/:id/vote`.
**Fix:** replaced the two `alert()` popups (vote result, "ingia kwanza") with inline text next to each row. **Bug fixed while testing:** the vote confirmation used to be wiped instantly because the list reloaded immediately after a successful vote — the reload is now delayed ~900ms so the person actually sees "✅ Kura yako imeongezwa!" first.

### Recovery Support, Health Network, Community Fund
`recovery.html`, `professionals.html`, `community-fund.html` — all three were static, never-migrated pages (old sidebar block, no APIs). Rebuilt with the hero + card + emergency-notice patterns used elsewhere; **copy is unchanged** (including the "AI is not diagnosis" disclaimers, the generic "VERIFIED" wording on Health Network which describes categories rather than real listings, and the honest "prototype" note next to Community Fund's TSh 0 figures — there's no fund API, so those numbers are not live). Recovery Support keeps its emergency notice with no invented phone numbers.
**Bug fixed (also affected `community.html` from earlier):** bullet icons in `.cu-tips` lists rendered as empty circles because the generic `.zp-body svg.ic` sizing rule outranked `.cu-tips svg`; now targets `.cu-tips li svg.ic`.

### Rich live-match detail (events / lineups / stats) + homepage Live Football widget
Matches the "Live Match Streaming" admin mockup's level of detail, built on **admin-entered data** (still not an external football API — see note below).
- **`server.js`**: `live_streams` entries can now carry `events` (goal/yellow/red/sub timeline), `stats` (possession/shots/corners/fouls/yellow/red, each `[home,away]`), `lineupHome`/`lineupAway`. New sanitizers `cleanEvents`/`cleanStats`/`cleanLineup` accept either structured JSON or the plain-text formats the Admin textareas use, and cap lengths. Both `POST /api/admin/live-streams` (create) and `POST /api/admin/live-streams/:id/score` (update) accept these fields; omitting them leaves existing data untouched on update.
- **`admin.html`**: the "Ongeza Live Match" form has a collapsible "Zaidi" section for events (`dakika|aina|timu|maelezo` per line), 6 stat pairs, and two lineup textareas. Every already-listed match also gets its own collapsible "✏️ Matukio / Stats / Lineups" editor, pre-filled from its current data, saving via the same score-update endpoint (`saveLiveDetails()`).
- **`live.html`**: new tabs under the match info card — **Matukio** (sorted timeline, ⚽/🟨/🟥/🔄 icons), **Lineups** (two columns), **Stats** (possession-style comparison bars), **H2H** (honestly says it needs a real match API, nothing invented). Each tab is hidden/empty-state when that data hasn't been entered; counts badge the tab.
- **`index.html`**: new "⚽ Live Football" widget below the trust bar — up to 3 live/upcoming matches (ended ones excluded) as compact score rows linking to `live.html?id=`, styled like the homepage mockup. Hides itself entirely if there are no live/upcoming matches or the API fails.

### On the real football-API request
The person asked to wire a **real** live-scores/live-match football API they say they already have access to, matching the provided mockups. No provider name or API key was supplied yet, so nothing calls an external API — these features still run on admin-entered match data (real in the sense that admin types real scores/events, not simulated). Once given the provider (e.g. API-Football/API-Sports, football-data.org, SportMonks, LiveScore) and a key, the integration point is clean: a server-side poller in `server.js` that maps that provider's fixtures/events/lineups/stats into the same `live_streams.json` shape above (or a parallel source merged into `GET /api/live-streams`), after which `live.html`, `livescores.html` and the homepage widget need no changes — they already render whatever is in that shape. Deliberately did **not** fabricate a live viewer counter ("12,458 watching") shown in the mockup, since there's no real tracking behind it.
