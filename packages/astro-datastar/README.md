# @wrux/astro-datastar

Astro integration for [Datastar](https://data-star.dev) v1.0.2 (vendored
bundle — no CDN request), plus server helpers for answering Datastar
requests from Astro endpoints and a minimal `data-replace-url` plugin. The
entrypoint pattern follows @astrojs/alpinejs; inspired by
[pekochan069/astro-datastar](https://github.com/pekochan069/astro-datastar).

## Setup

```js
// astro.config.mjs
import datastar from '@wrux/astro-datastar';

export default defineConfig({
  integrations: [datastar()],
});
```

Options:

- `inject: false` keeps pages JS-free by default; pages that need Datastar
  opt in with `import '@wrux/astro-datastar/client'` in a `<script>`.
- `entrypoint: '/src/datastar/index.ts'` controls the plugin set with an
  app-local module:

```ts
// src/datastar/index.ts
import '@wrux/astro-datastar/client';
import './plugins/my-plugin';
```

## Plugins

The package ships one deliberately minimal extension:

- `data-replace-url="<expr>"` keeps the address bar in sync with signal
  state (upstream's ReplaceUrl moved to the paid Pro tier; ours is a
  ~10-line effect with the same attribute name).

Write your own against the `engine` export — an `attribute()` plugin whose
`apply(ctx)` receives `ctx.rx()` (the compiled attribute expression) and can
register `effect(fn)` to re-run when signals used by the expression change.
The demo app's `src/datastar/plugins/` (cloak, collapse, combobox) shows the
pattern, loaded via the `entrypoint` option.

## Loading states

Import `@wrux/astro-datastar/loading.css`, put `ds-busy-fade` on the region a
request replaces, `data-indicator="_loading"` on each trigger, and
`data-attr:aria-busy="$_loading ? 'true' : 'false'"` on the region. The
region fades and ignores pointer events while a request is in flight.

## Server helpers (Astro endpoints)

The `server` export implements the [Datastar SDK
spec](https://github.com/starfederation/datastar/blob/develop/sdk/ADR.md)
(`ServerSentEventGenerator`, `readSignals`) and passes the official
[SDK test suite](https://github.com/starfederation/datastar/tree/develop/sdk/tests).
On top of that it adds Astro-flavoured sugar: `html()`, `sse()`,
`sseStream()`, event builders that return strings, and Standard Schema
validation.

With Datastar 1.0 the common case is plain `text/html`: top-level elements
in the response are morphed into the DOM by id, so a fragment is just a
rendered partial.

```ts
import type { APIRoute } from 'astro';
import { html, readSignals } from '@wrux/astro-datastar/server';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const { q } = await readSignals<{ q: string }>(request);
  return html(`<ul id="results">${await renderResults(q)}</ul>`);
};
```

`readSignals()` understands all three client payloads: the `datastar` query
param on `@get`, JSON bodies on other verbs, and form bodies when the action
used `{contentType: 'form'}` (preferred for personal data, which should not
live in global signals). Malformed JSON throws `SignalsParseError`, which
has a `.response()` shortcut for a 400.

### Runtime validation

Pass any [Standard Schema](https://standardschema.dev) validator (Zod ≥3.24,
Valibot, ArkType…) as a second argument to validate at runtime and infer the
type from the schema — Astro already ships Zod as `astro/zod`, so this needs
no extra dependency:

```ts
import { z } from 'astro/zod';
import { readSignals, SignalsValidationError } from '@wrux/astro-datastar/server';

const signals = z.object({ q: z.string().max(100).default('') });

export const GET: APIRoute = async ({ request }) => {
  try {
    const { q } = await readSignals(request, signals); // q: string
    // …
  } catch (err) {
    if (err instanceof SignalsValidationError) return err.response(); // 422
    throw err;
  }
};
```

### SSE events

For anything a plain morph can't express — patching signals, selector
targeting, append/prepend/remove modes, running a script, or streaming
several updates over one response — use SSE events. The
`ServerSentEventGenerator` owns an SSE `Response` (spec headers:
`Cache-Control: no-cache`, `Content-Type: text/event-stream`,
`Connection: keep-alive`) and flushes each event as it is sent. Astro
endpoints *return* responses, so you create one with
`ServerSentEventGenerator.stream()`, or its alias `sseStream()`:

```ts
import { sseStream } from '@wrux/astro-datastar/server';

export const GET: APIRoute = async () => {
  return sseStream(async (stream) => {
    stream.patchSignals({ progress: 0 });
    for (const [i, step] of steps.entries()) {
      await doWork(step);
      stream.patchSignals({ progress: (i + 1) / steps.length });
      stream.patchElements(`<li>${step}</li>`, {
        selector: '#log',
        mode: 'append',
      });
    }
    stream.removeElements('#spinner');
    stream.executeScript("console.log('done')");
  });
};
```

The response closes when the callback resolves, or when the client
disconnects (`stream.closed` resolves; later sends are dropped). Pass
`{ keepalive: true }` to keep it open until you call `stream.close()`, and
`{ onError }` to handle errors thrown by the callback instead of failing
the response.

Methods, matching the spec (every one also accepts `eventId` and
`retryDuration`):

| Method | Event | Options |
| :-- | :-- | :-- |
| `patchElements(html, opts)` | `datastar-patch-elements` | `selector`, `mode` (`outer` default, `inner`, `replace`, `prepend`, `append`, `before`, `after`, `remove`), `useViewTransition`, `namespace` (`html`, `svg`, `mathml`) |
| `removeElements(selector, opts)` | `datastar-patch-elements` (mode `remove`) | `useViewTransition` |
| `patchSignals(objectOrJson, opts)` | `datastar-patch-signals` (RFC 7386 merge patch; `null` removes) | `onlyIfMissing` |
| `removeSignals(paths, opts)` | `datastar-patch-signals` with `null`s (`'user.email'` nests) | |
| `executeScript(js, opts)` | `datastar-patch-elements` appending a `<script>` to `body` | `autoRemove` (default true), `attributes` |
| `send(eventType, dataLines, opts)` | any | raw access to the unified sender |

For a finite batch you don't need a stream: the same functions exist as
plain builders that return the serialised event, and `sse()` joins them
into a response:

```ts
import {
  patchElements,
  patchSignals,
  removeElements,
  sse,
} from '@wrux/astro-datastar/server';

return sse(
  patchElements('<li>New item</li>', { selector: '#list', mode: 'append' }),
  patchSignals({ count: 5 }),
  removeElements('#load-more'),
);
```

The builders also feed a stream directly (`stream.send(patchSignals(…))`),
which is handy when events are produced elsewhere.

### Conformance tests

`npm run test:sdk` builds the package, starts `sdk-tests/server.mjs` on
port 7331 and runs the official Go suite against it (needs Go ≥1.21; the
required toolchain is downloaded on demand). CI runs it on every push.

## Re-fetching

`data-on:*` listens for any DOM event, so re-fetch is a convention rather
than a plugin: give the region `data-on:refetch="@get('/api/…')"` and
dispatch a bubbling `CustomEvent('refetch')` at it from anywhere (another
fragment, a timer, other JS). For polling use
`data-on-interval__duration.30s="@get('/api/…')"`; for refresh-on-load deep
links use `data-init`.
