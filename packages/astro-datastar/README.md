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
live in global signals).

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

For anything a plain morph can't express — patching signals, selector
targeting, append/prepend/remove modes, or streaming several updates over
one response — build SSE events and answer with `sse()` (finite) or
`sseStream()` (long-lived):

```ts
import {
  patchElements,
  patchSignals,
  removeElements,
  sse,
  sseStream,
} from '@wrux/astro-datastar/server';

// Finite batch:
return sse(
  patchElements('<li>New item</li>', { selector: '#list', mode: 'append' }),
  patchSignals({ count: 5 }),
);

// Long-running job:
return sseStream(async (stream) => {
  for (const [i, step] of steps.entries()) {
    await doWork(step);
    stream.send(patchSignals({ progress: (i + 1) / steps.length }));
    stream.send(patchElements(`<li>${step}</li>`, {
      selector: '#log',
      mode: 'append',
    }));
  }
});
```

## Re-fetching

`data-on:*` listens for any DOM event, so re-fetch is a convention rather
than a plugin: give the region `data-on:refetch="@get('/api/…')"` and
dispatch a bubbling `CustomEvent('refetch')` at it from anywhere (another
fragment, a timer, other JS). For polling use
`data-on-interval__duration.30s="@get('/api/…')"`; for refresh-on-load deep
links use `data-init`.
