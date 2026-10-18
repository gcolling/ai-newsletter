# Facet

A daily digest of AI, automation and integrations news for engineers. It reads ~64 sources every
morning, keeps what matters and ranks it with plain, readable rules. **No language model picks,
writes or summarises anything.**

```mermaid
flowchart LR
  A[62 feeds<br/>+ Hacker News<br/>+ HF papers] --> B[Filter<br/>AI vocabulary,<br/>deny lists]
  B --> C[Group<br/>same story,<br/>many outlets]
  C --> D[Rank<br/>weight, coverage,<br/>discussion, freshness]
  D --> E[(data branch<br/>one JSON per day)]
  E --> F[Static site<br/>GitHub Pages + Atom feed]
```

## Reading it

- **Desktop:** topics on the left, the day’s list in the middle, the story on a colored stage on the
  right with what’s up next below. <kbd>J</kbd>/<kbd>K</kbd> to move, <kbd>O</kbd> to open,
  <kbd>S</kbd> to save, <kbd>F</kbd> for focus mode, <kbd>/</kbd> to filter.
- **Phone:** the list is home. Tap a story to read it full screen, then swipe up for the next.
  Add it to your home screen and it works offline.
- **This week:** `/week/` ranks every story of the last seven days, with the most mentioned terms
  and how they moved since the week before.
- **Make it yours:** pin or mute topics, save stories for later (`/saved/`, exports to Markdown),
  pick a light, dark or automatic theme. All of it stays in your browser.
- **Feeds:** `/feed.xml` has one entry per day; `/feeds/top.xml` and `/feeds/<topic>.xml` have one
  entry per story, ready for a feed reader or an n8n, Zapier or Slack RSS trigger.
- **JSON:** `/api/latest.json` and `/api/issues/YYYY-MM-DD.json`.

Every card says _why it’s here_: the rules that ranked it (coverage, points, matched terms). The
_How it works_ page lists every source and signal, and flags sources that stopped answering.

## Run it locally

Needs Node 24 (it runs TypeScript directly, there is no build step for the code).

```bash
npm install
npm run collect   # fetch today's issue into data/issues/
npm run dev       # preview on http://localhost:4321, rebuilds on save
```

`npm run dev` falls back to the fixtures in `test/fixtures/` until you have collected an issue.

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run collect`   | Fetch, filter, group and rank. Writes one JSON. |
| `npm run build`     | Render every issue into `dist/`.                |
| `npm run dev`       | Build, serve and watch.                         |
| `npm run check`     | Privacy check, typecheck, lint and test.        |

## Keeping personal data out

This repository is public, so `npm run privacy` fails on email addresses, home-folder paths,
private keys, API tokens, or any commit identity that isn't a GitHub noreply address. CI runs it on
every push and pull request. Turn it on as a pre-commit hook once per clone:

```bash
git config core.hooksPath .githooks
```

Nothing the reader does (saved stories, read marks, pinned topics, theme) leaves the browser.

## Publishing

Hosting is GitHub Pages, so there are no accounts, keys or secrets involved.

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Run the **Publish** workflow once from the **Actions** tab (it also runs daily at 05:17 UTC and
   on every push to `main`).

The workflow collects the issue, commits it to the `data` branch (so `main` only holds code),
builds the site and deploys it.

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. If the digest
> stops, re-enable **Publish** in the Actions tab.

## Changing what you get

- **Sources:** `src/sources.ts`. Each one has a weight (1–3), a section and optional filters.
- **Topics and their colors:** `src/topics.ts`.
- **Name, schedule-independent settings:** `src/config.ts`.
- **Ranking rules:** `src/collect/rank.ts`.

## Project layout

```
src/
  collect/   fetch → parse → filter → classify → cluster → rank → data/issues/<date>.json
  site/      static renderer: pages, Atom feed, CSS and a small script
  dev/       local preview server
test/        node:test suites and fixture issues
```

## License

[MIT](LICENSE)
