# Mabadiliko V15

## Vipengele vipya
- Links nyingi kwa game moja (admin: "Ongeza Link") — `products.links = [{label,url}]`
- Free Games: `free-games.html`, tiki ya FREE kwenye admin, chip ya "Free" dukani
- AI kwenye Community Chat: kitufe "Uliza AI" au `@AI` — `POST /api/public-chat/ai`
- Game Advisor (AI) kwa kila category + ukurasa wa bidhaa: `game-advisor.html`, `game-advisor.js`, `POST /api/ai/game-advisor`
- Winlator & GameHub: `winlator-gamehub.html`
- Admin: platform + specs za game (AI inazitumia)

## Kuunganisha pages (V16: pages zote 100 ni kamili, hakuna redirects)
- Pages 54 za zamani (placeholder bila CSS) sasa ni pages KAMILI zenye anwani zao wenyewe, zinatengenezwa na `python3 tools/build-pages.py`
  - user pages (30) = nakala ya ukurasa halisi (mf. `psp-gaming.html` = shop ya PSP, `store.html` = shop)
  - admin pages (24) = admin.html inayofungua tab yake pekee (mf. `users-management.html` = Customers)
  - Ukibadilisha `shop.html`, `admin.html` n.k., endesha script tena ili nakala zisasishwe
- `betting.html` na `sports-news.html` kwa sasa zinaonyesha Live Matches (hakuna mfumo wa kubet wala habari bado)
- Pages zote halisi zipo kwenye sidebar/MORE ya `zoneplay-shell.js`
- `admin.html` sasa inafungua tab kutoka kwenye URL hash

## Usalama
- `/api/products` haitoi tena password za akaunti wala links za games za kulipia kwa wateja; hutolewa kupitia `/api/my-orders` baada ya malipo

## V17 — marekebisho ya server.js (usalama na malipo)
- Bei/total ya checkout inahesabiwa na SERVER kutoka kwenye products + kuponi + shipping (mteja hawezi kubadilisha bei). Rentals zina bei ya server.
- Webhook ya ClickPesa haiaminiki tena: server inauliza ClickPesa moja kwa moja (`GET /payments/{orderReference}`) kabla ya kuthibitisha. Kama ukaguzi ukishindikana order inabaki pending (admin athibitishe kwa mkono).
- orderReference ni ya nasibu (si timestamp tu); tx ref ya manual haitumiki mara mbili; kikomo cha ripoti 5 za manual zinazosubiri.
- Kuponi: inahitaji login, haihesabiwi wakati wa kukagua bali order inapotengenezwa.
- `ADMIN_EMAIL` haina default tena. Admin wa password-register anapewa mara ya kwanza tu; `ADMIN_SETUP_KEY` inalinganishwa kwa timing-safe.
- Files za siri (server.js, package.json, *.json za root, *.md, tools/, dotfiles) hazitolewi tena na static server.
- `getIP` inatumia `trust proxy` (IP haiwezi kughushiwa kwa x-forwarded-for).
- Ukaguzi wa input: hakuna tena kufungwa kwa maandishi marefu; SQL/XSS patterns zimeboreshwa; IP inafungwa baada ya majaribio 3 ndani ya dakika 10; `javascript:` URL zinakataliwa.
- Login lock ni kwa IP+email (mtu hawezi kumfungia mwingine); sessions zinaisha baada ya siku 30; `?token=` inakubaliwa kwa GET tu.
- Uploads: admin anathibitishwa kabla ya file kupokelewa; files za muda zinafutwa; upload ya Supabase kwa stream.
- AI: kikomo cha maombi (10/dakika, 150/siku kwa IP) kwenye /api/ai/chat, /health, /recommendations.
- Tournaments: wateja wanaona idadi tu (majina/simu ni kwa admin); session token haihifadhiwi tena.
- Malipo ya mechi: mshindi lazima awe mchezaji wa mechi; hakuna commission bila mshindi.
- /api/admin/users haitoi password hashes. writeJson ni atomic na upserts za Supabase zinaenda kwa mpangilio.
- `checkout.html` sasa inatuma `coupon` na `shipping`; kuponi inahitaji login.
- Kosa lililorekebishwa: `admin.html#tab-...` ilirudishwa kwenye Dashboard na msimbo wa mwanzo; sasa tab ya link inafunguka (pages 24 za admin zinaonyesha tab yake pekee).

## V18 — Admin: upload, coupons za gaming, Web Content, Wallet, AI ya game
- **Upload ya file la game** (zip, rar, 7z, iso, cso, apk, xapk, obb, exe, msi, pkg…) na **picha ya game kwa Link AU Upload** — `POST /api/admin/upload/game|image` (admin/staff). Kikomo cha file la game: `UPLOAD_MAX_MB` (default 1024). Picha: PNG/JPG/WEBP/GIF hadi 8MB.
  - Tahadhari: Supabase Storage ya bure ina kikomo cha ~50MB kwa file; files kubwa zinahitaji plan ya juu, au tumia links. Bila Supabase, files za `/uploads` zinapotea Render ikiwashwa upya.
- **Coupons za punguzo la gaming**: aina (% au kiasi cha TZS), inatumika kwa bidhaa zote / platform (PSP, PS2, PC…) / games ulizochagua, tarehe ya mwisho, kiwango cha chini cha manunuzi, idadi ya matumizi. Punguzo linahesabiwa na server, kwa bidhaa zinazostahili tu.
- **Web Content** (`web-content.html`, tab ya admin): banners za Home (picha kwa link/upload), tangazo la juu, WhatsApp/simu/email, mitandao ya kijamii, footer. `GET /api/site-content`, `PUT /api/admin/site-content`, `POST/DELETE /api/admin/banners`.
- **Wallet / Mpila** (`wallet.html`): salio la zawadi, historia, kuomba kutoa pesa. Admin: tab ya **Withdraw** (Nimelipa / Kataa — ukikataa salio linarudi). `MIN_WITHDRAW_TZS` (default 5000).
- **AI ya Game kwenye fomu ya Add Game**: andika jina + chagua platform → AI inachambua game itacheza kwenye simu/PC ya uwezo gani na kujaza maelezo, aina, emoji, aina ya bidhaa na specs kiotomatiki (`POST /api/admin/ai-game-analyze`). Haibadilishi ulichoandika mwenyewe. Bila AI key inatumia makadirio ya category.
- Marekebisho: links za `/uploads/...` zinakubaliwa kama links za ziada; id ya bidhaa ina suffix ya nasibu (hakuna mgongano); pages za admin zinatambuliwa kama admin kwenye sidebar.

## V19 — Habari, TV, Content, AI Chat ya admin, na download baada ya malipo
- **Sports News (halisi)** `sports-news.html`: habari za maandishi, picha au video; category, search, pinned, "pakia zaidi", ukurasa wa kusoma wenye player ya video, share WhatsApp na link ya moja kwa moja (`#p=ID`). Admin: tab **📰 Habari**.
- **AI inasaidia kuandika habari**: andika maelezo mafupi → AI inaandika kichwa, muhtasari, habari kamili, category na tags (`POST /api/admin/news/ai-assist`). Haibuni alama/majina/takwimu; inaweka onyo la kuhakiki. Kitufe "🤖 AI andika & chapisha" kinachapisha baada ya kuthibitisha. Video: upload (`/api/admin/upload/video`) au link ya YouTube/Vimeo/Dailymotion/mp4/HLS.
- **Content (halisi)** `content.html`: machapisho kwa wateja (matangazo, ofa, mafunzo…). Admin: tab **📝 Content Posts** (kinaunganishwa kutoka Web Content).
- **TV Channels (halisi)** `sports-tv.html`: channels nyingi (HLS .m3u8, YouTube hata live ya channel, Vimeo, mp4), category, search, favorites, share. Admin: tab **📺 TV Channels** (logo kwa link/upload, mpangilio, live/offline/fichwa). Embeds ni za YouTube/Vimeo/Dailymotion tu; links nyingine hufunguka kwenye tab mpya.
- **AI Chat ya admin** (tab **💬 AI Chat**, `admin-chat.html`): inajibu swali lolote na inajua mauzo, bidhaa, wateja, kuponi, withdraw, habari/TV, usalama na mipangilio (haipewi password/links za bidhaa). Haitekelezi mabadiliko — inaelekeza hatua. AI isipopatikana inaonyesha muhtasari wa data.
- **Download baada ya malipo**: sasa kila game ina jina la download kuu (mf. APK) na links za ziada zenye lebo (mf. Data (OBB)). Ukurasa wa **Success** unaonyesha download MOJA kuu na kumwambia mteja faili nyingine ziko **My Orders**; **My Orders** na **My Games** zinaorodhesha faili zote (1. APK, 2. Data). Maandishi ya uongo ya "bidhaa zinatumwa kwenye email" yameondolewa.
- Upload ya file la game inaweka lebo kiotomatiki kutoka kwenye extension (apk→APK, obb→Data (OBB), zip→Faili (ZIP)…).
