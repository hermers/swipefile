# Swipefile

Saved design references from Instagram and X, in one place you actually come back to.

- **Save:** tap Share on a post in X or Instagram, then **Swipefile**, using an iPhone Shortcut. Screenshots work through **Swipefile image**.
- **Today:** each day, 5 old saves come back for a second look. The ones you've seen least come first.
- **Library:** every save in a grid, searchable by AI tags ("onboarding", "pricing", "dark mode"), text and @names.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| `supabase/functions/inspo` | Supabase Edge Function | The one API. Takes shares, pulls images from X posts, stores them, asks Claude for tags |
| `supabase/migrations` | Supabase Postgres | `items` table + private `media` bucket. RLS on, no policies: only the function can read or write |
| `web/` | GitHub Pages | The gallery (Vite + React). Installable to the Home Screen |

Every request needs the `x-swipefile-key` header. The key lives in `.env.local` (gitignored) and in your Shortcut.

## Where images come from

- **X:** X's public embed endpoint, with `api.fxtwitter.com` as a fallback. Neither needs an API key, and both are unofficial, so they can break if X changes them.
- **Instagram:** Instagram gives no way to fetch a post's images, so a shared Instagram link is saved as a card that waits for a screenshot. A screenshot shared within 10 minutes is added to that card automatically.
- **Other links:** the page's share image (`og:image`).

## Common commands

```bash
supabase functions deploy inspo --use-api
```

```bash
supabase secrets set ANTHROPIC_API_KEY=...
```

```bash
npm --prefix web run dev
```

## Not built yet

- Automatic X bookmark sync. It needs an X developer account with pay-per-use credits and OAuth 2.0 user login.
- A one-tap installable Shortcut file. For now, the steps are in the app under Settings.
