import { attribute } from '@wrux/astro-datastar/engine';

/**
 * `data-cloak` hides an element until Datastar has initialised, preventing a
 * flash of pre-hydration state (e.g. content that `data-show` will hide).
 *
 * Pair with a `[data-cloak] { display: none !important; }` rule in the
 * global stylesheet.
 * The attribute is removed when the engine applies plugins to the element.
 */
attribute({
  name: 'cloak',
  requirement: { key: 'denied', value: 'denied' },
  apply({ el }) {
    el.removeAttribute('data-cloak');
  },
});
