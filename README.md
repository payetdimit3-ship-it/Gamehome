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
