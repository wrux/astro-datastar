import { attribute, effect } from '@wrux/astro-datastar/engine';

const TRANSITION = 'height 200ms ease';

/**
 * `data-collapse="<expression>"` animates an element open (auto height) when
 * the expression is truthy and collapsed (height 0, hidden) when falsy.
 *
 * ```html
 * <button data-on:click="$open = !$open" aria-expanded="false">Hours</button>
 * <div data-collapse="$open">…</div>
 * ```
 *
 * The element animates height between 0 and its scroll height, sets
 * `aria-hidden` while collapsed, and lands on `height: auto` when open so
 * content can reflow. First render applies the state without animating.
 */
attribute({
  name: 'collapse',
  requirement: { key: 'denied', value: 'must' },
  returnsValue: true,
  apply({ el, rx }) {
    const element = el as HTMLElement;
    let first = true;

    element.style.overflow = 'hidden';

    const settle = (event: TransitionEvent) => {
      if (event.propertyName !== 'height') return;
      if (element.getAttribute('aria-hidden') !== 'true') {
        element.style.height = 'auto';
      }
    };
    element.addEventListener('transitionend', settle);

    const setState = (open: boolean, animate: boolean) => {
      // Respect the user's reduced-motion preference (checked per toggle so
      // OS-level changes apply without a reload).
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animate = false;
      }
      element.style.transition = animate ? TRANSITION : 'none';
      if (open) {
        element.removeAttribute('aria-hidden');
        if (animate) {
          element.style.height = `${element.scrollHeight}px`;
        } else {
          element.style.height = 'auto';
        }
      } else {
        element.setAttribute('aria-hidden', 'true');
        if (animate) {
          // Fix the current height so the transition has a starting value.
          element.style.height = `${element.scrollHeight}px`;
          requestAnimationFrame(() => {
            element.style.transition = TRANSITION;
            element.style.height = '0px';
          });
        } else {
          element.style.height = '0px';
        }
      }
    };

    const cleanup = effect(() => {
      const open = !!rx();
      setState(open, !first);
      first = false;
    });

    return () => {
      element.removeEventListener('transitionend', settle);
      cleanup();
    };
  },
});
