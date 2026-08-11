import type { AstroIntegration } from 'astro';

export type DatastarIntegrationOptions = {
  /**
   * Module specifier of the client entrypoint to load. Defaults to this
   * package's entrypoint (vendored Datastar 1.0 full bundle + our custom
   * plugins). Point it at an app-local module to change the plugin set:
   *
   * ```ts
   * import { attribute } from '@wrux/astro-datastar/client';
   * attribute({ name: 'my-plugin', apply({ el }) { ... } });
   * ```
   */
  entrypoint?: string;
  /**
   * When true (default), the entrypoint is injected into every page. Set to
   * false to keep pages JS-free by default and opt in per page with
   * `import '@wrux/astro-datastar/client'` inside a `<script>` tag.
   */
  inject?: boolean;
};

export default function datastar(
  options: DatastarIntegrationOptions = {},
): AstroIntegration {
  const { entrypoint = '@wrux/astro-datastar/client', inject = true } = options;

  return {
    name: '@wrux/astro-datastar',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        if (inject) {
          injectScript('page', `import ${JSON.stringify(entrypoint)};`);
        }
      },
    },
  };
}
