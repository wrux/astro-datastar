/**
 * Server-side helpers for answering Datastar `@get`/`@post` requests from
 * Astro partial pages. With Datastar 1.0 the response is plain `text/html`
 * (top-level elements are morphed into the DOM by id), so a fragment is just
 * a rendered partial page; no SSE framing or endpoint wrappers needed.
 */

/**
 * Minimal Standard Schema v1 interface (https://standardschema.dev) so
 * `readSignals` can validate with Zod (>=3.24, incl. `astro/zod`), Valibot,
 * ArkType, etc. without this package depending on any of them.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) =>
      | StandardSchemaV1.Result<Output>
      | Promise<StandardSchemaV1.Result<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
}

export namespace StandardSchemaV1 {
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
  }
  export type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue> };
}

/** Thrown by `readSignals` when the payload fails schema validation. */
export class SignalsValidationError extends Error {
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super(
      `Invalid Datastar signals: ${issues.map((i) => i.message).join('; ')}`,
    );
    this.name = 'SignalsValidationError';
    this.issues = issues;
  }

  /** Convenience 422 response for endpoints that want to bail directly. */
  response(): Response {
    return Response.json(
      { error: 'invalid signals', issues: this.issues },
      { status: 422 },
    );
  }
}

/**
 * Read the client's payload from a Datastar request: `@get` encodes signals
 * as the `datastar` query param; other verbs send a JSON body, or form data
 * when the action used `{contentType: 'form'}` (preferred for personal data,
 * which should not live in global signals).
 *
 * Pass a Standard Schema (e.g. a Zod schema — Astro ships one as
 * `astro/zod`) to validate at runtime and infer the return type from it;
 * failures throw `SignalsValidationError`:
 *
 * ```ts
 * const schema = z.object({ q: z.string().default('') });
 * try {
 *   const { q } = await readSignals(request, schema);
 * } catch (err) {
 *   if (err instanceof SignalsValidationError) return err.response();
 *   throw err;
 * }
 * ```
 */
export async function readSignals<Schema extends StandardSchemaV1>(
  request: Request,
  schema: Schema,
): Promise<
  Schema extends StandardSchemaV1<unknown, infer Output> ? Output : never
>;
export async function readSignals<T = Record<string, unknown>>(
  request: Request,
): Promise<T>;
export async function readSignals(
  request: Request,
  schema?: StandardSchemaV1,
): Promise<unknown> {
  const raw = await readRawSignals(request);
  if (!schema) return raw;
  const result = await schema['~standard'].validate(raw);
  if (result.issues) throw new SignalsValidationError(result.issues);
  return result.value;
}

async function readRawSignals(request: Request): Promise<unknown> {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const raw = url.searchParams.get('datastar');
    return raw ? JSON.parse(raw) : {};
  }
  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }
  return await request.json();
}

export function isDatastarRequest(request: Request): boolean {
  return request.headers.get('datastar-request') === 'true';
}

/**
 * Shortcut for the common case: answer a Datastar request with plain HTML.
 * Every top-level element in `html` is morphed into the page by id.
 */
export function html(html: string, init: ResponseInit = {}): Response {
  return new Response(html, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...init.headers,
    },
  });
}

/**
 * SSE events for everything a plain HTML response can't express: patching
 * signals, targeting a selector, append/prepend/remove modes, or streaming
 * several updates over one response. Compose with `sse()` (finite list) or
 * `sseStream()` (long-lived; send events as they happen).
 */

export type PatchElementsOptions = {
  /** CSS selector of the target; defaults to matching top-level ids. */
  selector?: string;
  /** How elements are patched in. Default 'outer' (morph by id). */
  mode?:
    | 'outer'
    | 'inner'
    | 'replace'
    | 'prepend'
    | 'append'
    | 'before'
    | 'after'
    | 'remove';
  /** Wrap the patch in a View Transition. */
  useViewTransition?: boolean;
};

export type PatchSignalsOptions = {
  /** Only set signals that don't exist yet. */
  onlyIfMissing?: boolean;
};

const dataLines = (field: string, value: string): string =>
  value
    .split('\n')
    .map((line) => `data: ${field} ${line}`)
    .join('\n');

/** `datastar-patch-elements` event: morph/patch HTML into the page. */
export function patchElements(
  elements: string,
  options: PatchElementsOptions = {},
): string {
  const lines = ['event: datastar-patch-elements'];
  if (options.mode && options.mode !== 'outer') {
    lines.push(`data: mode ${options.mode}`);
  }
  if (options.selector) lines.push(`data: selector ${options.selector}`);
  if (options.useViewTransition) lines.push('data: useViewTransition true');
  if (elements) lines.push(dataLines('elements', elements));
  return lines.join('\n');
}

/** `datastar-patch-elements` event with mode `remove`. */
export function removeElements(selector: string): string {
  return patchElements('', { mode: 'remove', selector });
}

/** `datastar-patch-signals` event: merge-patch the signal tree. */
export function patchSignals(
  signals: Record<string, unknown>,
  options: PatchSignalsOptions = {},
): string {
  const lines = ['event: datastar-patch-signals'];
  if (options.onlyIfMissing) lines.push('data: onlyIfMissing true');
  lines.push(dataLines('signals', JSON.stringify(signals)));
  return lines.join('\n');
}

const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache',
} as const;

/** Answer with a finite batch of SSE events, then close. */
export function sse(...events: string[]): Response {
  return new Response(events.map((e) => `${e}\n\n`).join(''), {
    headers: SSE_HEADERS,
  });
}

export type SSEStream = {
  /** Send one event (build it with patchElements/patchSignals/…). */
  send(event: string): void;
  /** Resolves when the client disconnects. */
  closed: Promise<void>;
};

/**
 * Long-lived SSE response: `run` receives a stream to send events through
 * and the response stays open until `run` resolves (or the client leaves).
 *
 * ```ts
 * return sseStream(async (stream) => {
 *   for (const chunk of chunks) {
 *     stream.send(patchElements(chunk));
 *     await sleep(300);
 *   }
 * });
 * ```
 */
export function sseStream(
  run: (stream: SSEStream) => Promise<void> | void,
): Response {
  let onClose!: () => void;
  const closed = new Promise<void>((resolve) => (onClose = resolve));
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const stream: SSEStream = {
        send(event) {
          try {
            controller.enqueue(encoder.encode(`${event}\n\n`));
          } catch {
            onClose();
          }
        },
        closed,
      };
      try {
        await run(stream);
      } finally {
        onClose();
        try {
          controller.close();
        } catch {
          // already closed by cancel()
        }
      }
    },
    cancel() {
      onClose();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}
