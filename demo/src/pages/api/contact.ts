import { html, readSignals } from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { z } from 'astro/zod';
import ContactForm from '../../components/ContactForm.astro';

export const prerender = false;

const contact = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please give your name (at least 2 characters).'),
  email: z.string().trim().email('That email address doesn’t look right.'),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters.')
    .max(500, 'Keep it under 500 characters.'),
});

export const POST: APIRoute = async ({ request }) => {
  // Read raw so failures re-render the form with the submitted values.
  const raw = await readSignals<Record<string, string>>(request);
  const result = contact.safeParse(raw);

  const container = await AstroContainer.create();

  if (!result.success) {
    return html(
      await container.renderToString(ContactForm, {
        props: {
          values: raw,
          errors: result.error.flatten().fieldErrors,
        },
      }),
    );
  }

  // Simulate a slow mail handoff so the indicator is visible.
  await new Promise((r) => setTimeout(r, 1_000));

  return html(
    await container.renderToString(ContactForm, {
      props: { values: result.data, success: true },
    }),
  );
};
