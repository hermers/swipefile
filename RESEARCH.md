# Saved Inspo: research notes (2026-11-11)

Goal: design screenshots saved on Instagram and X end up in one place I actually open, without going back to either app.

## What the platforms allow

| | Instagram | X |
|---|---|---|
| Official API for *my saves* | **None.** Personal-account API (Basic Display) was shut down 4 Dec 2024. Graph API is business/creator only and has no "saved by me" list. | **Yes.** `GET /2/users/{id}/bookmarks` returns my bookmarks (media should come through the API's media expansions; still to confirm). |
| Cost | n/a | Pay-per-use since Feb 2026. "Owned reads" (own bookmarks) quoted at about $0.001 each by third-party tables. Check the Developer Console for the real rate. |
| Automatic "save in the app, it shows up elsewhere" | Only through tools that use my logged-in browser session (Dewey, Chrome extensions) or `instaloader` with my login. All unofficial; logging in from a script carries ban risk. | Yes, through the API on a schedule (e.g. every hour), or through Dewey. |
| Manual one-tap capture | Share sheet gives a **link only**, not the image. A screenshot shared to my app always works. | Share sheet gives a link. Images can be saved to Photos natively. |
| Bulk backfill | "Download your information" export: `saved_posts.json` has **links only**, no images. | The API reportedly only reaches the **~800 most recent** bookmarks (Dewey says it avoids this cap by not using the API). Older bookmarks need Dewey or a similar non-API route. |

## Ready-made apps (no build)

- **Cosmos** (cosmos.so): built for designers, iOS + Android share extension, saves from Instagram, X, Pinterest, any site. Free; premium around $8/mo.
- **mymind**: share-sheet saving, AI auto-tagging and visual search. Paid.
- **Savee**: moodboard boards, saves from Instagram and the web. Mixed reviews.
- **Dewey**: syncs X bookmarks and Instagram saved posts (and collections) through its browser extension. Instagram saves come in when you next open the browser, not in real time. Exports to Notion etc.

## Build-it-yourself shape

1. **Capture**: an iOS Shortcut (or Android share target / PWA) in the share sheet that sends the link or screenshot to my own endpoint.
2. **Extract**:
   - X: official API to fetch the tweet's images (unofficial fxtwitter-style APIs exist; not verified).
   - Instagram: the fragile part. Options: a screenshot (always works), a self-hosted cobalt or yt-dlp instance (unofficial, can break whenever Instagram changes things), or store the link plus a thumbnail.
3. **Store and view**: a small web app/PWA gallery with tags and search (optionally AI tags per image), or just a cloud folder.
4. **Auto-sync**: an hourly job pulling new X bookmarks through the API (fine from now on; older ones are past the ~800 cap). Instagram has no safe equivalent: the habit has to be one tap on Share (or a screenshot, then Share).

## The real problem: getting back to them

Saving in a new place without anything that brings items back just makes a third pile. Each option resurfaces things differently:

- **mymind**: AI auto-tags and visual search ("blue onboarding screen"). Pull only: you have to go and look.
- **Cosmos**: boards and visual search, discovery feed. Mostly pull.
- **Dewey**: search and folders, export to Notion. Pull only.
- **Own build**: can *push*. Ideas: a random "today's 5" on open, a weekly digest notification or email, AI tags by pattern (onboarding, pricing, cards, typography), "unreviewed" inbox you clear like email. If I build, resurfacing is a core feature, not an extra.

## Recommendation (ranked)

1. **Try first, build nothing:** use Cosmos or mymind through the share sheet for a week. Cheap test of the real question: does the one-tap share become a habit?
2. **If I still want to build:** smallest useful version is a share-sheet Shortcut, my own gallery with AI tags, a daily/weekly resurfacing nudge, and an hourly X bookmark sync. Backfill old X bookmarks once with Dewey.
3. **Avoid:** scripted Instagram login (instaloader) for auto-sync; it risks my account.

## Open questions

- ~~iPhone or Android?~~ **iPhone.** Capture goes through the iOS share sheet: Cosmos and mymind have share extensions; a custom build uses an Apple Shortcut (receives link or screenshot, posts it to my endpoint). A Home Screen web app (PWA) can be the gallery.
- Use an existing app, or build my own as the experiment?
- Videos (reels) too, or mainly still images? (Reels have the same limits as Instagram images: link only, downloading needs an unofficial scraper.)

## Sources

- [n8n community: no API for Instagram saved posts](https://community.n8n.io/t/is-there-a-way-to-trigger-and-access-saved-content-on-instagram-for-your-personal-business-account/15710)
- [Phyllo: Instagram API guide 2026](https://www.getphyllo.com/post/instagram-api-guide)
- [Spotlight: Basic Display API ending](https://spotlightwp.com/instagram-basic-display-api-is-ending/)
- [X docs: pricing](https://docs.x.com/x-api/getting-started/pricing.md)
- [bundle.social: X API pricing 2026](https://bundle.social/blog/x-api-pricing-2026-costs-limits)
- [TechCrunch: X pay-per-use](https://techcrunch.com/2025/10/21/x-is-testing-a-pay-per-use-pricing-model-for-its-api/)
- [Cosmos llms.txt](https://www.cosmos.so/llms.txt)
- [Creative Boom on mymind](https://creativeboom.com/resources/why-mymind-is-the-visual-inspiration-tool-designers-have-been-crying-out-for)
- [Savee on Google Play](https://play.google.com/store/apps/details?id=it.savee.app)
- [Dewey: X bookmarks](https://getdewey.co/blog/unlocking-potential-of-twitter-and-bluesky-bookmarks)
- [Dewey: Instagram saved posts sync](https://getdewey.co/how-to-use/sync-instagram-saved-posts/)
- [ContextBolt: Instagram saved posts export](https://contextbolt.com/blog/instagram-saved-posts/)
- [Apple: Shortcuts share sheet input](https://support.apple.com/guide/shortcuts/apd163eb9f95)
- [Instaloader basic usage](https://instaloader.github.io/basic-usage.html)
- [subzeroid: instagrapi vs instaloader (ban risk)](https://subzeroid.github.io/blog/instagrapi-vs-instaloader/)
