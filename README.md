# Astro Datastar Integration

An [Astro](https://astro.build) integration for [Datastar](https://data-star.dev) — build reactive, server-driven UIs with signals in your HTML and fragments from your endpoints, without shipping a framework island.

**Live demo & docs: [astro-datastar.wrux-6a1.workers.dev](https://astro-datastar.wrux-6a1.workers.dev)**

Feel free to fork this project or take code as you please. Contributions are very welcome.

## What's in the box

- `@wrux/astro-datastar` — the integration ([packages/astro-datastar](packages/astro-datastar)). Vendored Datastar v1 bundle (no CDN request), injected site-wide by default, with:
  - A [Datastar SDK](https://github.com/starfederation/datastar/blob/develop/sdk/ADR.md) implementation for Astro endpoints — `ServerSentEventGenerator` (`patchElements`, `patchSignals`, `removeElements`, `removeSignals`, `executeScript`) and `readSignals()` — validated against the official SDK test suite
  - Astro sugar on top: `html()`, `sse()`, `sseStream()`, string event builders, and [Standard Schema](https://standardschema.dev) validation for signals (Zod, Valibot, ArkType…)
  - A `data-replace-url` attribute plugin, and an `engine` export for writing your own plugins
  - `loading.css` helpers for request indicators and busy fades
- `demo/` — the docs site with live examples (active search, pagination, SSE streaming, Zod-validated forms, custom plugins…), deployed to [Cloudflare Workers](https://workers.cloudflare.com)

## Quick start

```sh
npm install @wrux/astro-datastar
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import datastar from "@wrux/astro-datastar";

export default defineConfig({
  integrations: [datastar()],
});
```

```html
<section data-signals="{count: 0}">
  <button data-on:click="$count++">+</button>
  <strong data-text="$count">0</strong>
</section>
```

See the [demo site](https://astro-datastar.wrux-6a1.workers.dev) for the full docs and examples.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Installs dependencies for the whole workspace |
| `npm run dev`     | Starts the demo site at `localhost:4321`      |
| `npm run build`   | Builds the demo site to `demo/dist/`          |
| `npm run preview` | Previews the production build locally         |
| `npm test`        | Runs the package unit tests                   |
| `npm run test:sdk`| Runs the official Datastar SDK conformance suite (needs Go) |

The demo deploys automatically to Cloudflare Workers via Workers Builds on every push to `main` (build: `npm run build`, deploy: `cd demo && npx wrangler deploy`).

## License

[MIT](LICENSE) — do what you like, contributions welcome.

The vendored [Datastar](https://data-star.dev) bundle (`packages/astro-datastar/vendor/`) is © the [Datastar authors](https://github.com/starfederation/datastar), also MIT licensed.
