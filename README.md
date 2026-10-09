# HikiRace

Wiki-racing on [Hikipedia](https://hikipedia.org), the Finnish satirical wiki.

Two articles are drawn — a start and a finish. You get from one to the other
using nothing but the links inside the articles. No back button, no address
bar, no search. Just links.

## Rules

| | |
| --- | --- |
| ✅ Clicking links in the article | the only legal move |
| ✅ `Ctrl+F` | searching the page you are on is fair game |
| ✅ Table-of-contents / anchor links | free, they don't count as a move |
| ❌ Backspace, `Alt+←`, browser Back | trapped |
| ❌ Middle-click / `Ctrl+click` | no escaping into a new tab |
| ❌ File pages, `Toiminnot:`, categories, external sites | shown struck through, inert |

Redirects count: landing on *Urho Kekkonen* wins a race to *Urho Kaleva Kekkonen*.

## Running it

```sh
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |

## How it works

Hikipedia runs MediaWiki 1.39 and answers anonymous cross-origin requests when
`origin=*` is passed, so the game talks to `hikipedia.org/api.php` straight from
the browser — there is no backend and no proxy, and the build is a plain static
bundle that will run from any host or subpath.

| Concern | Where |
| --- | --- |
| API client (`parse`, `opensearch`, `random`) | `src/api/hikipedia.ts` |
| Which links are a legal move | `src/lib/titles.ts` |
| Sanitising wiki HTML, intercepting clicks | `src/components/ArticleView.tsx` |
| Blocking Backspace and the Back button | `src/hooks/useNavigationLock.ts` |
| Verified article pool for the dice | `src/data/pool.ts` |

Articles are injected as parsed HTML, so hikipedia's own styling comes along
with them. Scripts, iframes and inline event handlers are stripped first;
inline `style` attributes are deliberately kept, because the infoboxes are
built out of them.

## Not done yet

Multiplayer. The home screen has the lobby controls sketched in but disabled —
shared lobbies need a server, which this doesn't have yet.
