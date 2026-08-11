import {
  html,
  readSignals,
  SignalsValidationError,
} from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import PaginatedEntries from '../../components/PaginatedEntries.astro';

export const prerender = false;

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
  return html(
    await container.renderToString(PaginatedEntries, { props: { offset } }),
  );
};
