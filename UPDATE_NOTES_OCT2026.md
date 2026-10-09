# LIFEISGAMETZ update notes

## Changes in this build
- Fixed root-page stylesheet/script paths that incorrectly pointed to a missing `../assets/` directory.
- Added the AI Gaming Agent widget to game categories and Community / Community Chat. It uses the existing `/api/ai/chat` endpoint and includes page/category context, device-compatibility questions, and game-settings guidance.
- Added a Free Games shelf to gaming category pages. Only items marked `saleType: "free"` or with price `0` appear there; paid items are not automatically made free.
- Expanded Admin Dashboard > Bidhaa Zako with three game-link inputs, a Free/Paid selector, platform, minimum/recommended specifications, and recommended graphics settings.
- Updated product API create/update logic to save multiple links and compatibility metadata, and to allow a legitimate zero-price free game.
- Retained the existing AI-provider setup, checkout/payment integrations, and existing project pages.
- Kept the supplied screenshot ZIP as a separate design reference; its screenshots are not used as page backgrounds or product art.

## Important deployment note
The AI Agent needs the project to run through the Node/Express server and requires a working AI provider key in Render. Product creation/editing still requires an authorized admin/staff session. If the project has no configured persistent storage, local JSON-backed data may not survive a Render redeploy; configure the existing Supabase settings for durable storage.
