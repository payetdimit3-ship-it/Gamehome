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
