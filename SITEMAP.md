# LIFEISGAMETZ V2 — Official 66 Page Sitemap

## User Side — 41 Pages

1. 🏠 **Home** — `user/home.html`
2. 🛍️ **Store** — `user/store.html`
3. 🎮 **Games** — `user/games.html`
4. 🎮 **PSP Gaming** — `user/psp-gaming.html`
5. 🎮 **PS2 Gaming** — `user/ps2-gaming.html`
6. 🎮 **PS3 Gaming** — `user/ps3-gaming.html`
7. 📱 **Winlator & GameHub** — `user/winlator-gamehub.html`
8. 🎮 **Nintendo Switch** — `user/nintendo-switch.html`
9. 📱 **Android Gaming** — `user/android-gaming.html`
10. 🖥️ **PC Gaming** — `user/pc-gaming.html`
11. 🎬 **Movies** — `user/movies.html`
12. 📺 **Live TV / eSports** — `user/live-tv-esports.html`
13. ⚽ **Live Scores** — `user/live-scores.html`
14. 🏆 **Tournament** — `user/tournament.html`
15. 🎰 **Betting** — `user/betting.html`
16. 🎓 **Academy** — `user/academy.html`
17. ☁️ **Cloud Gaming** — `user/cloud-gaming.html`
18. ⚽ **eFootball / Top Up** — `user/efootball-topup.html`
19. 🎁 **Gift Cards** — `user/gift-cards.html`
20. 💬 **Community / Chat** — `user/community-chat.html`
21. 🩺 **Health Assistant** — `user/health-assistant.html`
22. 🤖 **AI Assistant** — `user/ai-assistant.html`
23. 🛒 **Marketplace** — `user/marketplace.html`
24. ❤️ **Wishlist** — `user/wishlist.html`
25. 🛒 **Cart** — `user/cart.html`
26. 🎮 **My Games / Library** — `user/my-games-library.html`
27. 👤 **Profile** — `user/profile.html`
28. 🔐 **Login** — `user/login.html`
29. 📝 **Register** — `user/register.html`
30. 📦 **Product Details** — `user/product-details.html`
31. 💳 **Checkout** — `user/checkout.html`
32. ⚽ **Live Football / Watch Match** — `user/live-football-watch.html`
33. 🎬 **Live Movies Player** — `user/live-movies-player.html`
34. 🎞️ **Game Trailer** — `user/game-trailer.html`
35. 🎓 **Courses** — `user/courses.html`
36. 📺 **Sports TV** — `user/sports-tv.html`
37. 📰 **Sports News** — `user/sports-news.html`
38. 📋 **My Orders** — `user/my-orders.html`
39. 💰 **Requests / Transactions** — `user/requests-transactions.html`
40. 📞 **Contact / Support** — `user/contact-support.html`
41. ❓ **FAQ / Help** — `user/faq-help.html`

## Admin Dashboard — 25 Pages

1. 📊 **Admin Dashboard** — `admin/dashboard.html`
2. 🎮 **Games Management** — `admin/games-management.html`
3. 📦 **Products Management** — `admin/products-management.html`
4. 🎬 **Movies Management** — `admin/movies-management.html`
5. 🎞️ **Trailers Management** — `admin/trailers-management.html`
6. 🏠 **Hero / Homepage Management** — `admin/hero-homepage-management.html`
7. ⚽ **Live Matches Management** — `admin/live-matches-management.html`
8. ⚽ **eFootball / Top Up Management** — `admin/efootball-topup-management.html`
9. ☁️ **Cloud Gaming Management** — `admin/cloud-gaming-management.html`
10. 🎁 **Gift Cards Management** — `admin/gift-cards-management.html`
11. 🛍️ **Marketplace Management** — `admin/marketplace-management.html`
12. 👥 **Users Management** — `admin/users-management.html`
13. 🛒 **Orders & Sales** — `admin/orders-sales.html`
14. 🏷️ **Coupons & Discounts** — `admin/coupons-discounts.html`
15. 💸 **Withdraw Requests** — `admin/withdraw-requests.html`
16. 🎧 **Support Tickets** — `admin/support-tickets.html`
17. 🎓 **Courses Management** — `admin/courses-management.html`
18. 🎥 **Lessons / Videos Management** — `admin/lessons-videos-management.html`
19. 👨‍🎓 **Students Management** — `admin/students-management.html`
20. 📺 **Sports TV Management** — `admin/sports-tv-management.html`
21. 📰 **Sports News Management** — `admin/sports-news-management.html`
22. 📈 **Analytics** — `admin/analytics.html`
23. 📑 **Reports** — `admin/reports.html`
24. 💾 **Storage & Server** — `admin/storage-server.html`
25. ⚙️ **Settings** — `admin/settings.html`

## Design rule

The supplied design pack is treated as the visual reference. The implementation uses a unified dark/neon LIFEISGAMETZ system while keeping User and Admin information architecture separate.

## Backend

This V2 is the full UI/page architecture. Existing legacy code is preserved under `legacy/` for migration of real functionality. Render/Supabase/API-Football/NEXUS/ClickPesa endpoints are not invented here.

## V15 ROUTING FIX
- Canonical user pages are stored at project root and are also available through `/user/<page>` compatibility routes.
- Canonical admin pages are stored at project root and are also available through `/admin/<page>` compatibility routes.
- Sidebar navigation now points to the canonical filenames that actually exist.
- Sports TV and Sports News are explicitly present in the main navigation.
- `home.html` now uses the same modern homepage as `index.html`.
