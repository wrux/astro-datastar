import {
  patchElements,
  patchSignals,
  readSignals,
  removeElements,
  SignalsValidationError,
  sse,
} from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import EntryBatch from '../../components/EntryBatch.astro';
import { entries } from '../../data/entries';

export const prerender = false;

const LIMIT = 5;

const signals = z.object({
  offset: z.number().int().min(0).catch(0),
});

export const GET: APIRoute = async ({ request }) => {
  let offset: number;
  try {
    ({ offset } = await readSignals(request, signals));
  } catch (err) {
    if (err instanceof SignalsValidationError) return err.response();
    throw err;
  }

  const container = await AstroContainer.create();
  const batch = await container.renderToString(EntryBatch, {
    props: { offset, limit: LIMIT },
  });

  const nextOffset = offset + LIMIT;
  const events = [
    patchElements(batch, { selector: '#entries', mode: 'append' }),
    patchSignals({ offset: nextOffset }),
  ];
  if (nextOffset >= entries.length) {
    events.push(removeElements('#load-more-button'));
  }
  return sse(...events);
};
