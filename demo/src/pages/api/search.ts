import {
  patchElements,
  patchSignals,
  readSignals,
  SignalsValidationError,
  sse,
} from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import SearchResults from '../../components/SearchResults.astro';

export const prerender = false;

const signals = z.object({
  q: z.string().max(100).default(''),
});

export const GET: APIRoute = async ({ request }) => {
  const container = await AstroContainer.create();

  let q = '';
  let error: string | undefined;
  try {
    ({ q } = await readSignals(request, signals));
  } catch (err) {
    if (!(err instanceof SignalsValidationError)) throw err;
    error = err.issues.map((i) => i.message).join('; ');
  }

  const results = await container.renderToString(SearchResults, {
    props: { q, error },
  });

  return sse(patchElements(results), patchSignals({ _typing: false }));
};
