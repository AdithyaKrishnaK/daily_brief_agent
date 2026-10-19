# The Morning Paper

A personal morning dashboard built with React, Cloudflare Workers, and Pi Durable.

The default brief checks Hacker News, TechCrunch, Anthropic, and OpenAI. Collection starts at 05:30 IST for a 06:00 IST edition.
The dashboard groups related stories, links to evidence, and adapts through feedback.

Pi runs in a separate Cloudflare Worker without provider secrets or write authority. A private credential Worker pins writes to one configured Notion database and Todoist project. See [credential setup](docs/deployment.md#credential-isolation).

Save articles to Notion with a button. Describe Todoist work in natural language, edit the proposed tasks, and confirm them before creation.
For example, “read this article and reproduce the work” produces separate reading and reproduction tasks.

## Local use

Use Node 22 or later.

```sh
npm ci
npm run brief:today -- --open
```

Set credentials and destination IDs in `.env`. To open an existing edition with Notion and Todoist actions, run `npm run brief:view -- --open`. Use `npm run brief:render` to update its saved HTML without regenerating the brief. Local storage and HTTP adapters reuse the shared application services. The native local process has access to `.env`; runtime credential isolation requires the separate Cloudflare Workers.

For UI development, `npm run dev` serves a sample edition at `http://127.0.0.1:5173/?demo=1`. Sample text is illustrative and cannot create external actions. The Vite server forwards `/api` to port 8787, where the Cloudflare host requires a valid Access assertion.

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The React view uses JSX. Domain services, API contracts, and the Cloudflare host use TypeScript.
Unit and service tests use real SQLite with Node's `node:sqlite` module. Node may show its experimental-module warning.
Browser tests use Playwright and need a permitted local server and a Chromium installation.

## Deployment

See [deployment instructions](docs/deployment.md) for Google sign-in, sessions, model selection, and integrations.
Install Cloudflare tooling separately:

```sh
npm install --prefix cloudflare
npm run typecheck:worker
npm run deploy:check
```

Commit the generated `cloudflare/package-lock.json` after resolving the SDK dependencies. The root package has its own lockfile.
The two packages let core development proceed when Cloudflare packages are unavailable.

## Current validation status

Core tests, TypeScript service checking, and the frontend build run locally.
This development session cannot reach the npm registry or start local servers or Chromium.
Cloudflare SDK installation, host type checking, Wrangler packaging, browser interaction tests, and live integrations remain unverified here.
The host must pass those checks before production deployment. No Cloudflare application or external task has been published by this implementation.

## Layout

- `src/shared`: validated domain contracts.
- `src/worker`: source collection, run state, preferences, task drafts, and integration adapters.
- `src/web`: dashboard, settings, and task composer.
- `cloudflare/src`: authenticated application, separate Pi Durable host, and private credential entrypoints.
- `tests`: source, service, provider contract, and browser checks.

## Behavior under failure

The last published brief remains readable during refresh or failure. Partial source coverage is visible.
Task confirmation checks the preview version. Successful tasks are not resent when neighboring tasks fail.
If a provider may have accepted a write, the action becomes uncertain. Notion can reconcile by its URL property.
Todoist uncertainty requires checking the destination manually. The application never blindly resends an uncertain task.
