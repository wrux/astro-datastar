import { html } from '@wrux/astro-datastar/server';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ServerTime from '../../components/ServerTime.astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const container = await AstroContainer.create();
  return html(
    await container.renderToString(ServerTime, {
      props: { time: new Date().toLocaleTimeString('en-GB') },
    }),
  );
};
