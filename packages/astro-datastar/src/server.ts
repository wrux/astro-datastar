/**
 * Server-side helpers for answering Datastar `@get`/`@post` requests from
 * Astro endpoints. Implements the Datastar SDK specification
 * (https://github.com/starfederation/datastar/blob/develop/sdk/ADR.md):
 * `ServerSentEventGenerator` with `patchElements`, `patchSignals`,
 * `executeScript` and `readSignals`, plus Astro-flavoured sugar (`html()`,
 * `sse()`, `sseStream()` and Standard Schema validation) on top.
 *
 * With Datastar 1.0 the common case needs no SSE at all: a plain `text/html`
 * response is morphed into the DOM by id, so a fragment is just a rendered
 * partial page. Reach for SSE events when you need to patch signals, target
 * a selector, use a non-morph patch mode, or stream several updates.
 */

// ---------------------------------------------------------------------------
// Constants (mirrors sdk/datastar-sdk-config-v1.json)
// ---------------------------------------------------------------------------

/** Query-string key (`@get`) and request header namespace used by Datastar. */
export const DATASTAR_KEY = 'datastar';

/** SSE retry duration the browser uses by default; omitted from output. */
export const DEFAULT_SSE_RETRY_DURATION = 1000;

/** The two SSE event types Datastar understands. */
export const EVENT_TYPES = [
  'datastar-patch-elements',
  'datastar-patch-signals',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** How elements are patched into the DOM. */
export const ELEMENT_PATCH_MODES = [
  'outer',
  'inner',
  'remove',
  'replace',
  'prepend',
  'append',
  'before',
  'after',
] as const;
export type ElementPatchMode = (typeof ELEMENT_PATCH_MODES)[number];
export const DEFAULT_ELEMENT_PATCH_MODE: ElementPatchMode = 'outer';

/** Namespace in which new elements are created. */
export const ELEMENT_NAMESPACES = ['html', 'svg', 'mathml'] as const;
export type ElementNamespace = (typeof ELEMENT_NAMESPACES)[number];
export const DEFAULT_ELEMENT_NAMESPACE: ElementNamespace = 'html';

/** Response headers every SSE response carries (per the SDK spec). */
export const SSE_HEADERS = {
  'cache-control': 'no-cache',
  'content-type': 'text/event-stream',
  connection: 'keep-alive',
} as const;

// ---------------------------------------------------------------------------
// Reading signals
// ---------------------------------------------------------------------------

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

/** Thrown by `readSignals` when the payload is not valid JSON. */
export class SignalsParseError extends Error {
  constructor(cause: unknown) {
    super(
      `Invalid Datastar signals: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'SignalsParseError';
    this.cause = cause;
  }

  /** Convenience 400 response for endpoints that want to bail directly. */
  response(): Response {
    return Response.json({ error: 'invalid signals' }, { status: 400 });
  }
}

/**
 * Read the client's payload from a Datastar request: `@get` encodes signals
 * as the `datastar` query param; other verbs send a JSON body, or form data
 * when the action used `{contentType: 'form'}` (preferred for personal data,
 * which should not live in global signals). Invalid JSON throws
 * `SignalsParseError`.
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new SignalsParseError(err);
  }
}

async function readRawSignals(request: Request): Promise<unknown> {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const raw = url.searchParams.get(DATASTAR_KEY);
    return raw ? parseJson(raw) : {};
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
  return parseJson(await request.text());
}

/** Whether the request was made by Datastar (`datastar-request: true`). */
export function isDatastarRequest(request: Request): boolean {
  return request.headers.get('datastar-request') === 'true';
}

// ---------------------------------------------------------------------------
// Plain HTML responses
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SSE event builders
// ---------------------------------------------------------------------------

/** Options shared by every event. */
export type EventOptions = {
  /** SSE `id:` line, for replay after reconnects. */
  eventId?: string;
  /** SSE `retry:` line in ms; omitted when it equals the default (1000). */
  retryDuration?: number;
};

export type PatchElementsOptions = EventOptions & {
  /** CSS selector of the target; defaults to matching top-level ids. */
  selector?: string;
  /** How elements are patched in. Default 'outer' (morph by id). */
  mode?: ElementPatchMode;
  /** Wrap the patch in a View Transition. */
  useViewTransition?: boolean;
  /** Namespace to create new elements in. Default 'html'. */
  namespace?: ElementNamespace;
};

export type RemoveElementsOptions = EventOptions & {
  /** Wrap the removal in a View Transition. */
  useViewTransition?: boolean;
};

export type PatchSignalsOptions = EventOptions & {
  /** Only set signals that don't exist yet. */
  onlyIfMissing?: boolean;
};

export type ExecuteScriptOptions = EventOptions & {
  /** Remove the `<script>` tag after it runs. Default true. */
  autoRemove?: boolean;
  /** Attributes for the `<script>` tag, as an object or raw `name="value"` strings. */
  attributes?: Record<string, string> | string[];
};

/** A signals patch: an object (JSON-serialised for you) or a JSON string. */
export type SignalsPatch = Record<string, unknown> | string;

/**
 * Serialise one SSE event exactly as the spec orders it: `event:`, `id:`
 * (if given), `retry:` (unless default), one `data:` line per data line,
 * then the blank line that terminates the event. Every builder and the
 * generator's `send()` go through here.
 */
export function formatEvent(
  eventType: EventType,
  dataLines: string[],
  options: EventOptions = {},
): string {
  const lines = [`event: ${eventType}`];
  if (options.eventId) lines.push(`id: ${options.eventId}`);
  if (
    options.retryDuration !== undefined &&
    options.retryDuration !== DEFAULT_SSE_RETRY_DURATION
  ) {
    lines.push(`retry: ${options.retryDuration}`);
  }
  for (const line of dataLines) lines.push(`data: ${line}`);
  return `${lines.join('\n')}\n\n`;
}

const dataLines = (field: string, value: string): string[] =>
  value.split('\n').map((line) => `${field} ${line}`);

function assertOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Invalid ${label} "${value}"; expected one of ${allowed.join(', ')}`,
    );
  }
}

/**
 * `datastar-patch-elements` event: patch complete HTML elements into the
 * page. Without a selector every top-level element needs an id; with mode
 * `remove` and a selector, `elements` may be empty.
 */
export function patchElements(
  elements: string,
  options: PatchElementsOptions = {},
): string {
  const { selector, mode, useViewTransition, namespace, ...eventOptions } =
    options;
  if (mode !== undefined) assertOneOf(mode, ELEMENT_PATCH_MODES, 'patch mode');
  if (namespace !== undefined) {
    assertOneOf(namespace, ELEMENT_NAMESPACES, 'namespace');
  }
  const removingBySelector = mode === 'remove' && !!selector;
  if (!removingBySelector && !elements.trim()) {
    throw new Error(
      'patchElements requires elements unless removing by selector',
    );
  }

  const lines: string[] = [];
  if (selector) lines.push(`selector ${selector}`);
  if (mode && mode !== DEFAULT_ELEMENT_PATCH_MODE) lines.push(`mode ${mode}`);
  if (useViewTransition) lines.push('useViewTransition true');
  if (namespace && namespace !== DEFAULT_ELEMENT_NAMESPACE) {
    lines.push(`namespace ${namespace}`);
  }
  if (elements) lines.push(...dataLines('elements', elements));
  return formatEvent('datastar-patch-elements', lines, eventOptions);
}

/**
 * `datastar-patch-elements` event with mode `remove`: remove every element
 * matching `selector`. To remove elements by id instead, send their tags
 * with `patchElements('<div id="a"></div>', { mode: 'remove' })`.
 */
export function removeElements(
  selector: string,
  options: RemoveElementsOptions = {},
): string {
  if (!selector.trim()) throw new Error('removeElements requires a selector');
  return patchElements('', { ...options, mode: 'remove', selector });
}

/**
 * `datastar-patch-signals` event: merge-patch the signal tree (RFC 7386,
 * so `null` removes a key). Pass an object or an already-serialised JSON
 * string.
 */
export function patchSignals(
  signals: SignalsPatch,
  options: PatchSignalsOptions = {},
): string {
  const { onlyIfMissing, ...eventOptions } = options;
  const json = typeof signals === 'string' ? signals : JSON.stringify(signals);
  if (!json.trim()) throw new Error('patchSignals requires signals');
  const lines: string[] = [];
  if (onlyIfMissing) lines.push('onlyIfMissing true');
  lines.push(...dataLines('signals', json));
  return formatEvent('datastar-patch-signals', lines, eventOptions);
}

/**
 * `datastar-patch-signals` event that removes signals by setting them to
 * `null`. Dotted paths address nested signals: `'user.email'`.
 */
export function removeSignals(
  paths: string | string[],
  options: EventOptions = {},
): string {
  const list = Array.isArray(paths) ? paths : [paths];
  if (list.length === 0) throw new Error('removeSignals requires a path');
  const patch: Record<string, unknown> = {};
  for (const path of list) {
    const keys = path.split('.');
    const last = keys.pop() as string;
    let node = patch;
    for (const key of keys) {
      node[key] ??= {};
      node = node[key] as Record<string, unknown>;
    }
    node[last] = null;
  }
  return patchSignals(patch, options);
}

/**
 * Run JavaScript in the browser by appending a `<script>` tag to `<body>`
 * (a `datastar-patch-elements` event). By default the tag removes itself
 * after executing.
 */
export function executeScript(
  script: string,
  options: ExecuteScriptOptions = {},
): string {
  const { autoRemove = true, attributes = {}, ...eventOptions } = options;
  const attrs = Array.isArray(attributes)
    ? attributes.map((a) => ` ${a}`)
    : Object.entries(attributes).map(([k, v]) => ` ${k}="${v}"`);
  if (autoRemove) attrs.push(' data-effect="el.remove()"');
  return patchElements(`<script${attrs.join('')}>${script}</script>`, {
    ...eventOptions,
    selector: 'body',
    mode: 'append',
  });
}

// ---------------------------------------------------------------------------
// ServerSentEventGenerator
// ---------------------------------------------------------------------------

export type StreamOptions = {
  /**
   * Keep the response open after `run` resolves; you then end it with
   * `stream.close()`. Default false: the stream closes when `run` returns.
   */
  keepalive?: boolean;
  /** Called if `run` throws. Default: rethrow (Astro answers 500). */
  onError?: (error: unknown) => void;
};

/**
 * Datastar SDK `ServerSentEventGenerator` for web-standard runtimes: owns an
 * SSE `Response` and writes events into its body as they are sent. Astro
 * endpoints return the response rather than being handed one, so create it
 * with `ServerSentEventGenerator.stream()` (alias: `sseStream()`), which
 * sets the spec headers (`Cache-Control: no-cache`,
 * `Content-Type: text/event-stream`, `Connection: keep-alive`) and flushes
 * each event immediately.
 *
 * ```ts
 * return ServerSentEventGenerator.stream(async (stream) => {
 *   stream.patchSignals({ progress: 0 });
 *   stream.patchElements('<li id="log">Started</li>');
 * });
 * ```
 */
export class ServerSentEventGenerator {
  /** Resolves when the stream ends, whether by `close()` or the client leaving. */
  readonly closed: Promise<void>;
  #controller: ReadableStreamDefaultController<Uint8Array>;
  #encoder = new TextEncoder();
  #open = true;
  #resolveClosed!: () => void;

  /** Read the client's payload; see `readSignals()`. */
  static readSignals = readSignals;

  /** Headers every SSE response carries. */
  static headers(): Record<string, string> {
    return { ...SSE_HEADERS };
  }

  /**
   * Create an SSE response and run `run` with a generator bound to it. The
   * response stays open until `run` resolves (or the client disconnects, or
   * `keepalive` is set and you call `close()`).
   */
  static stream(
    run: (stream: ServerSentEventGenerator) => Promise<void> | void,
    options: StreamOptions = {},
  ): Response {
    let generator!: ServerSentEventGenerator;
    const body = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        generator = new ServerSentEventGenerator(controller);
        try {
          await run(generator);
        } catch (error) {
          if (!options.onError) {
            generator.close();
            throw error;
          }
          options.onError(error);
        }
        if (!options.keepalive) generator.close();
      },
      cancel: () => generator?.close(),
    });
    return new Response(body, { headers: ServerSentEventGenerator.headers() });
  }

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.#controller = controller;
    this.closed = new Promise<void>((resolve) => {
      this.#resolveClosed = resolve;
    });
  }

  /** Whether events can still be sent. */
  get isOpen(): boolean {
    return this.#open;
  }

  /** End the response. Safe to call more than once. */
  close(): void {
    if (!this.#open) return;
    this.#open = false;
    try {
      this.#controller.close();
    } catch {
      // already closed by the client
    }
    this.#resolveClosed();
  }

  /**
   * Send one event. Either an event already serialised by a builder
   * (`stream.send(patchSignals({ n: 1 }))`) or, per the SDK spec, an event
   * type plus its data lines and options. Events sent after the client has
   * disconnected are dropped.
   */
  send(event: string): void;
  send(eventType: EventType, dataLines: string[], options?: EventOptions): void;
  send(
    eventOrType: string,
    dataLines?: string[],
    options?: EventOptions,
  ): void {
    const text = dataLines
      ? formatEvent(eventOrType as EventType, dataLines, options)
      : eventOrType;
    if (!this.#open) return;
    try {
      this.#controller.enqueue(this.#encoder.encode(text));
    } catch {
      this.close();
    }
  }

  /** See `patchElements()`. */
  patchElements(elements: string, options?: PatchElementsOptions): void {
    this.send(patchElements(elements, options));
  }

  /** See `removeElements()`. */
  removeElements(selector: string, options?: RemoveElementsOptions): void {
    this.send(removeElements(selector, options));
  }

  /** See `patchSignals()`. */
  patchSignals(signals: SignalsPatch, options?: PatchSignalsOptions): void {
    this.send(patchSignals(signals, options));
  }

  /** See `removeSignals()`. */
  removeSignals(paths: string | string[], options?: EventOptions): void {
    this.send(removeSignals(paths, options));
  }

  /** See `executeScript()`. */
  executeScript(script: string, options?: ExecuteScriptOptions): void {
    this.send(executeScript(script, options));
  }
}

/** @deprecated Use `ServerSentEventGenerator`. */
export type SSEStream = ServerSentEventGenerator;

/** Answer with a finite batch of SSE events, then close. */
export function sse(...events: string[]): Response {
  return new Response(events.join(''), {
    headers: ServerSentEventGenerator.headers(),
  });
}

/**
 * Long-lived SSE response: `run` receives a `ServerSentEventGenerator` and
 * the response stays open until `run` resolves (or the client leaves).
 *
 * ```ts
 * return sseStream(async (stream) => {
 *   for (const chunk of chunks) {
 *     stream.patchElements(chunk);
 *     await sleep(300);
 *   }
 * });
 * ```
 */
export function sseStream(
  run: (stream: ServerSentEventGenerator) => Promise<void> | void,
  options?: StreamOptions,
): Response {
  return ServerSentEventGenerator.stream(run, options);
}
