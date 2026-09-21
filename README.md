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
