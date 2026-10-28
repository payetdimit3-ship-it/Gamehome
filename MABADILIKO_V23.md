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

## V20 — Marekebisho ya malipo (ClickPesa Auto + Manual) na kuondoa demo
**Tatizo lililoripotiwa:** mteja alilipa kwa Auto, link haikufunguka, na admin akaona "Inasubiri auto" bila njia ya kuitatua.
**Sababu zilizopatikana:** (1) order ya Auto iliyokwama haikuwa na kitufe chochote kwenye admin; (2) ukurasa wa checkout ulisubiri dakika 3 tu kisha kumwacha mteja; (3) uthibitisho ulitegemea sana webhook (na uthibitisho wangu wa V17 haukuzingatia hali `SETTLED`, wala majaribio mengi ya malipo).

**Marekebisho (kulingana na nyaraka rasmi za ClickPesa):**
- Tabaka 3 za uthibitisho: (1) webhook yenye **checksum** sahihi (`CLICKPESA_CHECKSUM_KEY`, njia ya "canonical" HMAC-SHA256) inaaminiwa mara moja; (2) vinginevyo mfumo **unauliza ClickPesa** (`GET /payments/{orderReference}`) — inatambua `SUCCESS`/`SETTLED`, inaelewa orodha ya majaribio (jaribio lililoshindwa likifuatwa na lililofanikiwa = SUCCESS), na haiweki "failed" hadi majaribio YOTE yameshindwa; (3) admin anaweza kuthibitisha kwa mkono.
- **Reconciler**: kila sekunde 30 mfumo unakagua orders za Auto zinazosubiri (kila sekunde 40 kwa saa 2 za kwanza) — hata mteja akifunga ukurasa au webhook isifike. My Orders na Success pia zinaulizia ClickPesa zenyewe.
- Checkout: inasubiri hadi dakika 10 na ujumbe wazi ("USILIPE TENA…"), kitufe cha "Angalia hali sasa", kiungo cha My Orders; order inahifadhiwa mara moja; onyo ukirudi kwenye checkout ukiwa na malipo yanayosubiri; server inazuia malipo ya pili ndani ya dakika 2.
- Admin → **Payment Center** sasa ni uchunguzi halisi wa ClickPesa (credentials, token, webhook iliyowahi kufika, jaribio la kuuliza hali, idadi ya order zilizokwama) pamoja na webhook URL ya kunakili. Maandishi ya AzamPay ya zamani yameondolewa.
- Admin → **Mauzo**: order ya Auto inayosubiri ina vitufe **🔄 Angalia ClickPesa** (inaonyesha ClickPesa inasema nini) na **✅ Thibitisha kwa mkono**; inaonyesha umri wa order na hali ya ClickPesa. Order za manual zinaonyesha Tx Ref, mtandao, simu, na **kiasi anachodai mteja dhidi ya kinachotakiwa**. Kukataa kunaomba sababu (mteja anaiona) na order haifutwi tena.
- **Manual**: namba za kupokea pesa sasa zinawekwa na admin kwenye **Web Content → Namba za malipo manual** (jina la mfano lililokuwa limewekwa kwenye checkout limeondolewa — hakuna namba = manual imezimwa). Mteja anajaza Tx Ref (imehakikiwa muundo), kiasi (lazima ≥ jumla), mtandao, simu, na kuthibitisha.
- **Bidhaa za demo zimeondolewa kabisa** (orodha ya bidhaa 12 za mfano iliyoungwa kwenye kila ukurasa), bei ya zamani ya bandia + "punguzo" na beji ya "Best Seller" kwenye ukurasa wa game, orodha ya vipengele/developer/tarehe za kubuni, na mashindano mawili ya demo.

**Mipangilio ya lazima (Render + ClickPesa):**
1. ClickPesa Dashboard → Settings → Developers → Application Webhooks: weka URL inayoonekana kwenye Payment Center kwa events `PAYMENT RECEIVED` na `PAYMENT FAILED`.
2. (Hiari) ukiwasha Checksum kwenye ClickPesa, weka `CLICKPESA_CHECKSUM_KEY` kwenye Render.
3. Web Content → Namba za malipo manual: weka namba yako halisi.
4. Order iliyokwama sasa hivi: admin → Mauzo → **🔄 Angalia ClickPesa**, na ikiwa umeshapokea pesa, **✅ Thibitisha kwa mkono**.

## V21 — Cloud Gaming ya kununua + AI inajaza Overview / Features / System Requirements
- **Cloud Gaming ni category ya kawaida** (platform mpya `cloud`): bidhaa za kununua zinazoongezwa kutoka Admin → Bidhaa (platform: Cloud Gaming) zinaonekana kwenye `cloudgaming.html` na `shop.html?cat=cloud`, na kwenye kadi ya Home. **Kukodi muda kumeondolewa** (`rental.html` inapeleka Cloud Gaming; maandishi ya kodisha kwenye Home/FAQ/Terms/Refund/AI yamebadilishwa). Order za zamani za rental bado zinaonekana kwenye My Orders/My Games.
- Ukurasa wa Cloud Gaming: maelezo ya jinsi inavyofanya kazi (Chagua → Lipia → Cheza), mahitaji (internet 15 Mbps+), tafuta/panga, na **AI Advisor** yenye chaguo la kasi ya internet.
- **Fomu ya bidhaa (admin)** sasa ina sehemu 3 za kupanga maelezo: ① Overview (aya), ② Features (kimoja kwa mstari), ③ System Requirements (Minimum na Recommended). Ukiandika jina la game + kuchagua platform, **AI inajaza zote kiotomatiki** (haibadilishi ulichoandika mwenyewe). Kwa Cloud inajaza internet (Mbps), latency, huduma na kifaa.
- **Ukurasa wa bidhaa** unapanga: **Overview** (aya + kiungo cha vipengele) → **Features** (orodha) → **System Requirements** (kadi mbili: Minimum | Recommended). Tabs tupu zinafichwa; maelezo ya kubuni (trailer ya bandia, tarehe/developer) yameondolewa.
- AI haibuni: game isiyojulikana inapewa "uhakika mdogo", requirements zisizojulikana zinaachwa wazi, na `recommended` inajazwa tu ikijulikana.

## V22 — Upload ya files kubwa (GB) bila kikomo cha Supabase
**Tatizo:** Supabase Storage ya bure inakubali ~50MB tu kwa file (si kosa la code), na upload ya GB 1 kupitia Render ilikuwa inapita server (disk/RAM/muda mdogo).
**Suluhisho:** upload **moja kwa moja kutoka browser kwenda hifadhi ya S3-compatible** (Cloudflare R2 inapendekezwa — GB 10 bure, hakuna ada ya download), kwa presigned URL (`s3sign.js`, imethibitishwa dhidi ya vipimo rasmi vya AWS Signature V4).
- Files za game ni **za faragha**: zinahifadhiwa kama `s3:games/…`; wateja waliolipa (au games za FREE) wanapewa **link ya muda mfupi (masaa 6)** kwenye Success / My Orders — link ikiisha, mteja anafungua My Orders kupata mpya. Link haiwezi kushirikiwa milele.
- Hadi **5GB** kwa file (`UPLOAD_MAX_MB_S3`), progress bar, **kujaribu tena kiotomatiki** mara 3 mtandao ukikatika au ukikwama (sekunde 60 bila maendeleo), na ujumbe wazi (CORS, funguo, ukubwa).
- Picha/video za habari: zinaenda moja kwa moja pia ukiweka `S3_PUBLIC_BASE_URL`; vinginevyo zinaendelea kupitia server.
- Admin → Bidhaa inaonyesha hali ya hifadhi (S3 / Supabase / server) na onyo kabla ya kupakia file kubwa kuliko 50MB kwenye Supabase ya bure.

### Jinsi ya kuweka Cloudflare R2 (dakika ~10)
1. Cloudflare Dashboard → **R2** → Create bucket (mf. `gamefiles`). Iache **private**.
2. R2 → **Manage API tokens** → Create API token → ruhusa **Object Read & Write** kwa bucket hiyo → nakili **Access Key ID** na **Secret Access Key**. Endpoint ni `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. Bucket → **Settings → CORS policy**:
```json
[{ "AllowedOrigins": ["https://TOVUTI-YAKO.onrender.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
```
4. Render → Environment, weka:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_BUCKET` = `gamefiles`
   - `S3_ACCESS_KEY_ID` na `S3_SECRET_ACCESS_KEY`
   - `S3_REGION` = `auto`
   - (hiari) `S3_PUBLIC_BASE_URL` = URL ya public ya bucket/domain kwa picha na video
   - (hiari) `UPLOAD_MAX_MB_S3` = `5120`
5. Deploy upya. Admin → Bidhaa itaonyesha "☁️ Hifadhi kubwa (S3/R2) imewashwa". Pakia file la game — linapakiwa moja kwa moja.
**Kumbuka:** `s3sign.js` ni faili jipya linalohitajika pamoja na `server.js`. Files zilizopakiwa kupitia njia ya zamani (`/uploads` au Supabase) zinaendelea kufanya kazi.

## V23 — Uchunguzi wa hifadhi (kwa nini upload bado haifanyi kazi?)
Admin → Bidhaa → kitufe **🔍 Chunguza hifadhi**. Kinajaribu (kwa server): mipangilio ya Render, S3_ENDPOINT, funguo + bucket (kuandika/kusoma/kufuta file la majaribio), na **CORS** (preflight kutoka anwani yako ya admin) — kisha kinakuambia kinachokosekana pamoja na marekebisho.

Ujumbe wa kawaida na maana yake:
- **"Haipo: S3_…"** → vigezo havijawekwa, au hukubonyeza *Manual Deploy* baada ya kuviweka (Render haisomi vigezo vipya bila kuwasha upya).
- **InvalidAccessKeyId** → `S3_ACCESS_KEY_ID` si sahihi (nakili *Access Key ID* ya token, siyo Account ID).
- **SignatureDoesNotMatch** → `S3_SECRET_ACCESS_KEY` si sahihi, au region si `auto`.
- **NoSuchBucket** → jina la `S3_BUCKET` si sahihi.
- **AccessDenied** → token haina *Object Read & Write* kwa bucket hiyo.
- **CORS: hakuna CORS policy / origin haifanani** → weka CORS kwenye bucket; origin iwe sawa kabisa na anwani ya admin (bila `/` mwishoni). Hii ndiyo sababu ya kawaida ya "Upload imeshindwa — mtandao umekatika".
- **Faili la s3sign.js halipo** → pakia `s3sign.js` kwenye folda moja na `server.js`.
Website haizimiki tena ukisahau `s3sign.js`; hifadhi kubwa tu ndiyo inazimwa.
