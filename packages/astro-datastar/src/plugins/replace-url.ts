import { attribute, effect } from '../engine';

/**
 * `data-replace-url="<expression>"` keeps the address bar in sync with
 * signal state: whenever signals the expression reads change, the current
 * history entry is replaced with the evaluated URL (relative or absolute,
 * same-origin only).
 *
 * ```html
 * <div data-replace-url="'/businesses' + ($q ? '?q=' + $q : '')"></div>
 * ```
 *
 * Upstream Datastar 1.0 moved its ReplaceUrl plugin to the paid Pro
 * bundle; this is our own minimal equivalent with the same attribute name.
 */
attribute({
  name: 'replace-url',
  requirement: { key: 'denied', value: 'must' },
  returnsValue: true,
  apply({ rx }) {
    return effect(() => {
      const url = rx();
      if (typeof url !== 'string' || url === '') return;
      const resolved = new URL(url, window.location.origin);
      if (resolved.origin !== window.location.origin) return;
      history.replaceState(
        history.state,
        '',
        resolved.pathname + resolved.search + resolved.hash,
      );
    });
  },
});
