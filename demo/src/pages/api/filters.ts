import {
  patchElements,
  readSignals,
  SignalsValidationError,
  sse,
} from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import FilterControls from '../../components/FilterControls.astro';
import FilterResults from '../../components/FilterResults.astro';

export const prerender = false;

export const filterSignals = z.object({
  type: z.string().catch(''),
  region: z.string().catch(''),
  destination: z.string().catch(''),
  limit: z.coerce.number().int().catch(5),
});

// Region changed: destination options are stale, so re-render the controls
// and the results in one response.
export const GET: APIRoute = async ({ request }) => {
  let signals: z.infer<typeof filterSignals>;
  try {
    signals = await readSignals(request, filterSignals);
  } catch (err) {
    if (err instanceof SignalsValidationError) return err.response();
    throw err;
  }

  const container = await AstroContainer.create();
  const [controls, results] = await Promise.all([
    container.renderToString(FilterControls, {
      props: { region: signals.region },
    }),
    container.renderToString(FilterResults, { props: signals }),
  ]);

  return sse(patchElements(controls), patchElements(results));
};
