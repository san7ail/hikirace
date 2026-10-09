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

## Multiplayer

One player creates a lobby and gets a five-character code (`PWRZU`). Everyone
else joins with the code or the invite link. The host picks the start and
finish; pressing start drops every player onto the same article at once, and a
strip across the top of the race shows how many links each rival has burned.

Opponents' click counts and finishing times are live, but **their routes stay
hidden until the race is over** — broadcasting them mid-race would just hand
everyone the answer.

Once you finish, that restriction lifts for you alone: the standings start
showing which article each straggler is standing on, updating as they move.
You cannot use it to win a race you have already won, and watching someone
flail two clicks from the target is the best part. Players still racing see
nothing extra — the server builds a separate view per recipient rather than
broadcasting one shared snapshot.

A player who drops out keeps their slot and score and can reconnect; newcomers
can't join a race that has already started, and the host role moves on if the
host leaves.

## Running it

```sh
npm install
npm run dev
```

`npm run dev` runs the Worker alongside Vite, so lobbies and websockets work
locally exactly as they do in production.

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (app + Worker + lobbies) with hot reload |
| `npm run build` | Type-check app and Worker, build to `dist/` |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run cf:login` | Authenticate wrangler with Cloudflare |
| `npm run cf:tail` | Stream production Worker logs |

## How it works

Hikipedia runs MediaWiki 1.39 and answers anonymous cross-origin requests when
`origin=*` is passed, so article fetching happens straight from the browser
against `hikipedia.org/api.php` — no proxy, no API keys.

The only server-side piece is the lobby. A single Cloudflare Worker serves the
built app *and* routes `/api/lobby/*` to a Durable Object — one per lobby code —
which holds the room state and fans out websocket updates. Durable Objects are
declared as SQLite-backed, which is the flavour available on the free plan, and
sockets use hibernation so an idle lobby costs nothing.

| Concern | Where |
| --- | --- |
| API client (`parse`, `opensearch`, `random`) | `src/api/hikipedia.ts` |
| Which links are a legal move | `src/lib/titles.ts` |
| Sanitising wiki HTML, intercepting clicks | `src/components/ArticleView.tsx` |
| Blocking Backspace and the Back button | `src/hooks/useNavigationLock.ts` |
| Verified article pool for the dice | `src/data/pool.ts` |
| Lobby server (Worker + Durable Object) | `worker/index.ts` |
| Client/server message contract | `shared/protocol.ts` |
| Websocket client with reconnect | `src/net/useLobby.ts` |

Articles are injected as parsed HTML, so hikipedia's own styling comes along
with them. Scripts, iframes and inline event handlers are stripped first;
inline `style` attributes are deliberately kept, because the infoboxes are
built out of them.

## Deploying

```sh
npm run cf:login   # once, opens a browser
npm run deploy
```

That publishes to `hikirace.<your-subdomain>.workers.dev`. Everything — static
assets, lobby API and Durable Objects — ships as one Worker, so there is
nothing else to configure.
