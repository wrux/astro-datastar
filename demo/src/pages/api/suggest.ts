import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import {
  html,
  readSignals,
  SignalsValidationError,
} from '@wrux/astro-datastar/server';
import SuggestionOptions from '../../components/SuggestionOptions.astro';
import { towns } from '../../data/towns';

export const prerender = false;

const signals = z.object({
  term: z.string().max(100).catch(''),
});

export const GET: APIRoute = async ({ request }) => {
  let term: string;
  try {
    ({ term } = await readSignals(request, signals));
  } catch (err) {
    if (err instanceof SignalsValidationError) return err.response();
    throw err;
  }

  const matches = term
    ? towns.filter((t) => t.toLowerCase().startsWith(term.toLowerCase()))
    : [];

  const container = await AstroContainer.create();
  return html(
    await container.renderToString(SuggestionOptions, { props: { matches } }),
  );
};
