/**
 * Test server for the official Datastar SDK conformance suite
 * (https://github.com/starfederation/datastar/tree/develop/sdk/tests).
 * Serves `/test` on port 7331 from the built package, translating each event
 * in the request's `events` array into a ServerSentEventGenerator call.
 *
 *   npm run build && node sdk-tests/server.mjs
 *   go run github.com/starfederation/datastar/sdk/tests/cmd/datastar-sdk-tests@latest
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { ServerSentEventGenerator } from '../dist/server.js';

const port = Number(process.env.PORT ?? 7331);

/** @param {Request} request */
async function handle(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/test') {
    return new Response('not found', { status: 404 });
  }

  let signals;
  try {
    signals = await ServerSentEventGenerator.readSignals(request);
  } catch (error) {
    return new Response(String(error), { status: 400 });
  }

  return ServerSentEventGenerator.stream((stream) => {
    for (const event of signals.events ?? []) {
      const { eventId, retryDuration } = event;
      switch (event.type) {
        case 'patchElements':
          stream.patchElements(event.elements ?? '', {
            selector: event.selector,
            mode: event.mode,
            useViewTransition: event.useViewTransition,
            namespace: event.namespace,
            eventId,
            retryDuration,
          });
          break;
        case 'patchSignals':
          stream.patchSignals(event['signals-raw'] ?? event.signals, {
            onlyIfMissing: event.onlyIfMissing,
            eventId,
            retryDuration,
          });
          break;
        case 'executeScript':
          stream.executeScript(event.script, {
            autoRemove: event.autoRemove,
            attributes: event.attributes,
            eventId,
            retryDuration,
          });
          break;
        default:
          throw new Error(`Unknown event type: ${event.type}`);
      }
    }
  });
}

const server = createServer(async (req, res) => {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    for await (const chunk of response.body) res.write(chunk);
  }
  res.end();
});

server.listen(port, () => {
  console.log(`Datastar SDK test server listening on http://localhost:${port}`);
});
