import { describe, expect, it } from 'vitest';
import {
  html,
  isDatastarRequest,
  patchElements,
  patchSignals,
  readSignals,
  removeElements,
  SignalsValidationError,
  type StandardSchemaV1,
  sse,
  sseStream,
} from '../src/server';

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

describe('patchElements', () => {
  it('emits a minimal event with defaults', () => {
    expect(patchElements('<div id="a">hi</div>')).toBe(
      [
        'event: datastar-patch-elements',
        'data: elements <div id="a">hi</div>',
      ].join('\n'),
    );
  });

  it('splits multiline elements into one data line each', () => {
    expect(patchElements('<div>\n  <span>x</span>\n</div>')).toBe(
      [
        'event: datastar-patch-elements',
        'data: elements <div>',
        'data: elements   <span>x</span>',
        'data: elements </div>',
      ].join('\n'),
    );
  });

  it('includes mode, selector and view transition options', () => {
    expect(
      patchElements('<li>x</li>', {
        mode: 'append',
        selector: '#list',
        useViewTransition: true,
      }),
    ).toBe(
      [
        'event: datastar-patch-elements',
        'data: mode append',
        'data: selector #list',
        'data: useViewTransition true',
        'data: elements <li>x</li>',
      ].join('\n'),
    );
  });

  it('omits the default outer mode', () => {
    expect(patchElements('<div></div>', { mode: 'outer' })).not.toContain(
      'data: mode',
    );
  });
});

describe('removeElements', () => {
  it('emits a remove patch for the selector with no elements payload', () => {
    expect(removeElements('#toast')).toBe(
      [
        'event: datastar-patch-elements',
        'data: mode remove',
        'data: selector #toast',
      ].join('\n'),
    );
  });
});

describe('patchSignals', () => {
  it('serializes the signal patch as JSON', () => {
    expect(patchSignals({ open: true, count: 2 })).toBe(
      [
        'event: datastar-patch-signals',
        'data: signals {"open":true,"count":2}',
      ].join('\n'),
    );
  });

  it('includes onlyIfMissing when set', () => {
    expect(patchSignals({ a: 1 }, { onlyIfMissing: true })).toBe(
      [
        'event: datastar-patch-signals',
        'data: onlyIfMissing true',
        'data: signals {"a":1}',
      ].join('\n'),
    );
  });
});

describe('sse', () => {
  it('joins events with blank lines and sets SSE headers', async () => {
    const response = sse(patchSignals({ a: 1 }), removeElements('#x'));
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8',
    );
    expect(response.headers.get('cache-control')).toBe('no-cache');
    await expect(response.text()).resolves.toBe(
      'event: datastar-patch-signals\ndata: signals {"a":1}\n\n' +
        'event: datastar-patch-elements\ndata: mode remove\ndata: selector #x\n\n',
    );
  });
});

describe('sseStream', () => {
  it('streams events sent by run and closes when run resolves', async () => {
    const response = sseStream((stream) => {
      stream.send(patchSignals({ n: 1 }));
      stream.send(patchSignals({ n: 2 }));
    });
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8',
    );
    await expect(response.text()).resolves.toBe(
      'event: datastar-patch-signals\ndata: signals {"n":1}\n\n' +
        'event: datastar-patch-signals\ndata: signals {"n":2}\n\n',
    );
  });

  it('resolves closed when the client cancels the stream', async () => {
    let sawClose = false;
    const response = sseStream(async (stream) => {
      stream.send(patchSignals({ tick: 0 }));
      await stream.closed;
      sawClose = true;
    });
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sawClose).toBe(true);
  });
});
