import { describe, expect, it, vi } from 'vitest';
import datastar from '../src/index';

function runSetupHook(integration: ReturnType<typeof datastar>) {
  const injectScript = vi.fn();
  const setup = integration.hooks['astro:config:setup'];
  // The hook only uses injectScript, so a partial context is enough.
  (setup as (ctx: { injectScript: typeof injectScript }) => void)({
    injectScript,
  });
  return injectScript;
}

describe('datastar integration', () => {
  it('injects the default client entrypoint on every page', () => {
    const integration = datastar();
    expect(integration.name).toBe('@wrux/astro-datastar');
    const injectScript = runSetupHook(integration);
    expect(injectScript).toHaveBeenCalledExactlyOnceWith(
      'page',
      `import "@wrux/astro-datastar/client";`,
    );
  });

  it('injects a custom entrypoint when provided', () => {
    const injectScript = runSetupHook(
      datastar({ entrypoint: './src/datastar/client.ts' }),
    );
    expect(injectScript).toHaveBeenCalledExactlyOnceWith(
      'page',
      `import "./src/datastar/client.ts";`,
    );
  });

  it('injects nothing when inject is false', () => {
    const injectScript = runSetupHook(datastar({ inject: false }));
    expect(injectScript).not.toHaveBeenCalled();
  });
});
