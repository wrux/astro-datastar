import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { z } from 'astro/zod';
import {
  html,
  readSignals,
  SignalsValidationError,
} from '@wrux/astro-datastar/server';
import FilterResults from '../../components/FilterResults.astro';
import { filterSignals } from './filters';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  let signals: z.infer<typeof filterSignals>;
  try {
    signals = await readSignals(request, filterSignals);
  } catch (err) {
    if (err instanceof SignalsValidationError) return err.response();
    throw err;
  }

  const container = await AstroContainer.create();
  return html(
    await container.renderToString(FilterResults, { props: signals }),
  );
};
