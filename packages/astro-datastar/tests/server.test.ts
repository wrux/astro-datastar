import { describe, expect, it } from 'vitest';
import {
  executeScript,
  formatEvent,
  html,
  isDatastarRequest,
  patchElements,
  patchSignals,
  readSignals,
  removeElements,
  removeSignals,
  ServerSentEventGenerator,
  SignalsParseError,
  SignalsValidationError,
  type StandardSchemaV1,
  sse,
  sseStream,
} from '../src/server';

const lines = (...lines: string[]) => `${lines.join('\n')}\n\n`;

describe('readSignals', () => {
  it('parses the datastar query param on GET', async () => {
    const request = new Request(
      `https://example.com/search?datastar=${encodeURIComponent(
        JSON.stringify({ q: 'cafe', page: 2 }),
      )}`,
    );
    await expect(readSignals(request)).resolves.toEqual({ q: 'cafe', page: 2 });
  });

  it('returns an empty object when GET has no datastar param', async () => {
    const request = new Request('https://example.com/search');
    await expect(readSignals(request)).resolves.toEqual({});
  });

  it('parses a JSON body on POST', async () => {
    const request = new Request('https://example.com/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    });
    await expect(readSignals(request)).resolves.toEqual({ name: 'Ada' });
  });

  it('throws SignalsParseError on invalid JSON', async () => {
    const get = new Request('https://example.com/?datastar=%7Bnope');
    await expect(readSignals(get)).rejects.toBeInstanceOf(SignalsParseError);

    const post = new Request('https://example.com/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{nope',
    });
    const error = await readSignals(post).catch((e) => e);
    expect(error).toBeInstanceOf(SignalsParseError);
    expect(error.response().status).toBe(400);
  });

  it('parses urlencoded form bodies', async () => {
    const request = new Request('https://example.com/action', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'ada@example.com' }),
    });
    await expect(readSignals(request)).resolves.toEqual({
      email: 'ada@example.com',
    });
  });

  it('parses multipart form bodies, skipping file entries', async () => {
    const form = new FormData();
    form.set('name', 'Ada');
    form.set('avatar', new Blob(['x']), 'avatar.png');
    const request = new Request('https://example.com/action', {
      method: 'POST',
      body: form,
    });
    await expect(readSignals(request)).resolves.toEqual({ name: 'Ada' });
  });

  it('validates with a Standard Schema and returns the transformed value', async () => {
    const schema: StandardSchemaV1<unknown, { q: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value) => {
          const q = (value as Record<string, unknown>).q;
          return typeof q === 'string'
            ? { value: { q: q.trim() } }
            : { issues: [{ message: 'q must be a string' }] };
        },
      },
    };

    const ok = new Request(
      `https://example.com/?datastar=${encodeURIComponent(
        JSON.stringify({ q: '  cafe  ' }),
      )}`,
    );
    await expect(readSignals(ok, schema)).resolves.toEqual({ q: 'cafe' });

    const bad = new Request('https://example.com/');
    const error = await readSignals(bad, schema).catch((e) => e);
    expect(error).toBeInstanceOf(SignalsValidationError);
    expect(error.issues).toEqual([{ message: 'q must be a string' }]);
    expect(error.response().status).toBe(422);
    await expect(error.response().json()).resolves.toEqual({
      error: 'invalid signals',
      issues: [{ message: 'q must be a string' }],
    });
  });

  it('is exposed as ServerSentEventGenerator.readSignals', () => {
    expect(ServerSentEventGenerator.readSignals).toBe(readSignals);
  });
});

describe('isDatastarRequest', () => {
  it('detects the datastar-request header', () => {
    const yes = new Request('https://example.com/', {
      headers: { 'datastar-request': 'true' },
    });
    expect(isDatastarRequest(yes)).toBe(true);
    expect(isDatastarRequest(new Request('https://example.com/'))).toBe(false);
  });
});

describe('html', () => {
  it('responds with text/html and the given body', async () => {
    const response = html('<div id="a">hi</div>');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    await expect(response.text()).resolves.toBe('<div id="a">hi</div>');
  });

  it('merges custom init and headers', () => {
    const response = html('<div></div>', {
      status: 201,
      headers: { 'x-custom': '1' },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-custom')).toBe('1');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
  });
});

describe('formatEvent', () => {
  it('writes event, id, retry and data lines in spec order', () => {
    expect(
      formatEvent('datastar-patch-signals', ['signals {"a":1}'], {
        eventId: 'e1',
        retryDuration: 2000,
      }),
    ).toBe(
      lines(
        'event: datastar-patch-signals',
        'id: e1',
        'retry: 2000',
        'data: signals {"a":1}',
      ),
    );
  });

  it('omits the default retry duration', () => {
    expect(
      formatEvent('datastar-patch-signals', ['signals {}'], {
        retryDuration: 1000,
      }),
    ).not.toContain('retry:');
  });
});

describe('patchElements', () => {
  it('emits a minimal event with defaults', () => {
    expect(patchElements('<div id="a">hi</div>')).toBe(
      lines(
        'event: datastar-patch-elements',
        'data: elements <div id="a">hi</div>',
      ),
    );
  });

  it('splits multiline elements into one data line each', () => {
    expect(patchElements('<div>\n  <span>x</span>\n</div>')).toBe(
      lines(
        'event: datastar-patch-elements',
        'data: elements <div>',
        'data: elements   <span>x</span>',
        'data: elements </div>',
      ),
    );
  });

  it('includes every option in spec order', () => {
    expect(
      patchElements('<circle id="c"/>', {
        eventId: 'e1',
        retryDuration: 2000,
        mode: 'append',
        selector: '#vis',
        useViewTransition: true,
        namespace: 'svg',
      }),
    ).toBe(
      lines(
        'event: datastar-patch-elements',
        'id: e1',
        'retry: 2000',
        'data: selector #vis',
        'data: mode append',
        'data: useViewTransition true',
        'data: namespace svg',
        'data: elements <circle id="c"/>',
      ),
    );
  });

  it('omits default mode, namespace and false view transition', () => {
    const event = patchElements('<div></div>', {
      mode: 'outer',
      namespace: 'html',
      useViewTransition: false,
    });
    expect(event).not.toContain('data: mode');
    expect(event).not.toContain('data: namespace');
    expect(event).not.toContain('useViewTransition');
  });

  it('rejects unknown modes and namespaces', () => {
    // @ts-expect-error invalid mode
    expect(() => patchElements('<div></div>', { mode: 'merge' })).toThrow(
      /patch mode/,
    );
    // @ts-expect-error invalid namespace
    expect(() => patchElements('<div></div>', { namespace: 'xml' })).toThrow(
      /namespace/,
    );
  });

  it('requires elements unless removing by selector', () => {
    expect(() => patchElements('')).toThrow(/elements/);
    expect(() => patchElements('  ', { mode: 'remove' })).toThrow(/elements/);
    expect(() =>
      patchElements('', { mode: 'remove', selector: '#x' }),
    ).not.toThrow();
  });
});

describe('removeElements', () => {
  it('emits a remove patch for the selector with no elements payload', () => {
    expect(removeElements('#toast')).toBe(
      lines(
        'event: datastar-patch-elements',
        'data: selector #toast',
        'data: mode remove',
      ),
    );
  });

  it('passes through event options and view transitions', () => {
    expect(
      removeElements('#toast', { eventId: 'e1', useViewTransition: true }),
    ).toBe(
      lines(
        'event: datastar-patch-elements',
        'id: e1',
        'data: selector #toast',
        'data: mode remove',
        'data: useViewTransition true',
      ),
    );
  });

  it('requires a selector', () => {
    expect(() => removeElements('')).toThrow(/selector/);
  });
});

describe('patchSignals', () => {
  it('serializes the signal patch as JSON', () => {
    expect(patchSignals({ open: true, count: 2 })).toBe(
      lines(
        'event: datastar-patch-signals',
        'data: signals {"open":true,"count":2}',
      ),
    );
  });

  it('includes onlyIfMissing and event options', () => {
    expect(
      patchSignals({ a: 1 }, { onlyIfMissing: true, retryDuration: 2000 }),
    ).toBe(
      lines(
        'event: datastar-patch-signals',
        'retry: 2000',
        'data: onlyIfMissing true',
        'data: signals {"a":1}',
      ),
    );
  });

  it('accepts a raw JSON string, one data line per line', () => {
    expect(patchSignals('{\n"one": 1,\n"two": 2}')).toBe(
      lines(
        'event: datastar-patch-signals',
        'data: signals {',
        'data: signals "one": 1,',
        'data: signals "two": 2}',
      ),
    );
  });

  it('keeps escaped newlines inside serialized strings on one line', () => {
    expect(patchSignals({ one: 'first\n signal' })).toBe(
      lines(
        'event: datastar-patch-signals',
        'data: signals {"one":"first\\n signal"}',
      ),
    );
  });

  it('rejects an empty patch', () => {
    expect(() => patchSignals('')).toThrow(/signals/);
  });
});

describe('removeSignals', () => {
  it('nulls each path, building nested objects for dotted paths', () => {
    expect(removeSignals(['one', 'two.alpha'], { eventId: 'e1' })).toBe(
      lines(
        'event: datastar-patch-signals',
        'id: e1',
        'data: signals {"one":null,"two":{"alpha":null}}',
      ),
    );
    expect(removeSignals('x')).toContain('data: signals {"x":null}');
  });

  it('requires at least one path', () => {
    expect(() => removeSignals([])).toThrow(/path/);
  });
});

describe('executeScript', () => {
  it('appends a self-removing script tag to body by default', () => {
    expect(executeScript("console.log('hi');")).toBe(
      lines(
        'event: datastar-patch-elements',
        'data: selector body',
        'data: mode append',
        'data: elements <script data-effect="el.remove()">console.log(\'hi\');</script>',
      ),
    );
  });

  it('supports attributes, autoRemove false and multiline scripts', () => {
    expect(
      executeScript('if (a) {\n  b();\n}', {
        autoRemove: false,
        attributes: { type: 'module', blocking: 'false' },
        eventId: 'e1',
        retryDuration: 2000,
      }),
    ).toBe(
      lines(
        'event: datastar-patch-elements',
        'id: e1',
        'retry: 2000',
        'data: selector body',
        'data: mode append',
        'data: elements <script type="module" blocking="false">if (a) {',
        'data: elements   b();',
        'data: elements }</script>',
      ),
    );
  });

  it('accepts attributes as raw strings', () => {
    expect(
      executeScript('x()', { attributes: ['async', 'type="module"'] }),
    ).toContain(
      '<script async type="module" data-effect="el.remove()">x()</script>',
    );
  });
});

describe('sse', () => {
  it('concatenates events and sets the spec headers', async () => {
    const response = sse(patchSignals({ a: 1 }), removeElements('#x'));
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('connection')).toBe('keep-alive');
    await expect(response.text()).resolves.toBe(
      'event: datastar-patch-signals\ndata: signals {"a":1}\n\n' +
        'event: datastar-patch-elements\ndata: selector #x\ndata: mode remove\n\n',
    );
  });
});

describe('ServerSentEventGenerator', () => {
  it('streams events sent through the generator and closes when run resolves', async () => {
    const response = ServerSentEventGenerator.stream((stream) => {
      stream.patchSignals({ n: 1 });
      stream.send(patchSignals({ n: 2 }));
      stream.send('datastar-patch-signals', ['signals {"n":3}'], {
        eventId: 'e3',
      });
      stream.patchElements('<div id="a"></div>');
      stream.removeElements('#b');
      stream.removeSignals('c');
      stream.executeScript('d()');
    });
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('connection')).toBe('keep-alive');
    await expect(response.text()).resolves.toBe(
      [
        patchSignals({ n: 1 }),
        patchSignals({ n: 2 }),
        patchSignals({ n: 3 }, { eventId: 'e3' }),
        patchElements('<div id="a"></div>'),
        removeElements('#b'),
        removeSignals('c'),
        executeScript('d()'),
      ].join(''),
    );
  });

  it('sseStream is an alias of ServerSentEventGenerator.stream', async () => {
    const response = sseStream((stream) => {
      expect(stream).toBeInstanceOf(ServerSentEventGenerator);
      stream.patchSignals({ ok: true });
    });
    await expect(response.text()).resolves.toBe(patchSignals({ ok: true }));
  });

  it('resolves closed and drops sends when the client cancels', async () => {
    let stream!: ServerSentEventGenerator;
    let sawClose = false;
    const response = sseStream(async (s) => {
      stream = s;
      s.patchSignals({ tick: 0 });
      await s.closed;
      sawClose = true;
    });
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sawClose).toBe(true);
    expect(stream.isOpen).toBe(false);
    expect(() => stream.patchSignals({ tick: 1 })).not.toThrow();
  });

  it('keeps the stream open with keepalive until close() is called', async () => {
    let stream!: ServerSentEventGenerator;
    const response = sseStream(
      (s) => {
        stream = s;
        s.patchSignals({ a: 1 });
      },
      { keepalive: true },
    );
    const reader = response.body?.getReader();
    if (!reader) throw new Error('missing body');
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe(patchSignals({ a: 1 }));
    expect(stream.isOpen).toBe(true);
    stream.patchSignals({ a: 2 });
    stream.close();
    const second = await reader.read();
    expect(decoder.decode(second.value)).toBe(patchSignals({ a: 2 }));
    await expect(reader.read()).resolves.toMatchObject({ done: true });
    await stream.closed;
  });

  it('routes errors thrown by run to onError and still closes', async () => {
    const errors: unknown[] = [];
    const response = sseStream(
      () => {
        throw new Error('boom');
      },
      { onError: (e) => errors.push(e) },
    );
    await expect(response.text()).resolves.toBe('');
    expect(errors).toHaveLength(1);
  });
});
