import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { patchElements, patchSignals, sseStream } from '@wrux/astro-datastar/server';
import JobLog from '../../components/JobLog.astro';

export const prerender = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const steps = [
  'Fetching records…',
  'Validating…',
  'Transforming…',
  'Writing output…',
  'Done.',
];

export const GET: APIRoute = async () => {
  const container = await AstroContainer.create();
  return sseStream(async (stream) => {
    stream.send(patchSignals({ running: true, progress: 0 }));
    stream.send(
      patchElements(await container.renderToString(JobLog), {
        selector: '#job-log',
      }),
    );
    for (const [i, step] of steps.entries()) {
      await sleep(500);
      stream.send(
        patchSignals({ progress: Math.round(((i + 1) / steps.length) * 100) }),
      );
      stream.send(
        patchElements(
          await container.renderToString(JobLog, { props: { line: step } }),
          { selector: '#job-log', mode: 'append' },
        ),
      );
    }
    stream.send(patchSignals({ running: false }));
  });
};
