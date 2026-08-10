import { attribute } from '@wrux/astro-datastar/engine';

/**
 * `data-combobox` wires a text input to a suggestions listbox following the
 * APG combobox pattern (list autocomplete). The option list is expected to
 * be server-rendered and swapped via Datastar fragment merges, so options
 * are looked up live rather than captured once. Expected structure:
 *
 * ```html
 * <div data-combobox>
 *   <form>
 *     <input data-part="input" data-bind:q data-on:input="@get(...)" />
 *   </form>
 *   <div data-part="popup" hidden>
 *     <div id="my-suggestions">
 *       <a data-part="option" href="...">Suggestion</a>
 *       <button data-part="option" data-on:click="...">Suggestion</button>
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * Behavior: typing opens the popup (it stays hidden while the option list
 * is empty); ArrowUp/ArrowDown move the active option (managed via
 * `aria-activedescendant`, focus stays in the input); Enter activates the
 * active option by clicking it (so anchors navigate and `data-on:click`
 * expressions run); Escape, click-outside, focus-out, option activation,
 * and submitting the surrounding form all close the popup. Active options
 * get a `data-active` attribute for styling.
 */
attribute({
  name: 'combobox',
  requirement: { key: 'denied', value: 'denied' },
  apply({ el }) {
    const root = el as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('[data-part="input"]');
    const popup = root.querySelector<HTMLElement>('[data-part="popup"]');
    if (!input || !popup) return;

    const listboxId =
      popup.id || `combobox-listbox-${Math.random().toString(36).slice(2, 8)}`;
    popup.id = listboxId;
    popup.setAttribute('role', 'listbox');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', listboxId);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');

    let open = false;
    let activeIndex = -1;

    const options = () =>
      Array.from(popup.querySelectorAll<HTMLElement>('[data-part="option"]'));

    const setActive = (index: number) => {
      const opts = options();
      activeIndex = opts.length === 0 ? -1 : index;
      let activeId = '';
      opts.forEach((option, i) => {
        if (!option.id) option.id = `${listboxId}-option-${i}`;
        option.setAttribute('role', 'option');
        const isActive = i === activeIndex;
        option.setAttribute('aria-selected', String(isActive));
        if (isActive) {
          option.setAttribute('data-active', '');
          activeId = option.id;
        } else {
          option.removeAttribute('data-active');
        }
      });
      if (activeId) {
        input.setAttribute('aria-activedescendant', activeId);
        opts[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    };

    /** The popup is only ever visible while it has options to show. */
    const sync = () => {
      const show = open && options().length > 0;
      popup.hidden = !show;
      input.setAttribute('aria-expanded', String(show));
      if (!show && activeIndex !== -1) setActive(-1);
    };

    const close = () => {
      open = false;
      sync();
    };

    // Fragment merges replace the option list under the popup; reset the
    // active option and re-evaluate visibility whenever that happens.
    const observer = new MutationObserver(() => {
      setActive(-1);
      sync();
    });
    observer.observe(popup, { childList: true, subtree: true });

    const onInput = () => {
      open = true;
      sync();
    };

    const onKeydown = (event: KeyboardEvent) => {
      const opts = options();
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (popup.hidden && opts.length > 0) {
            open = true;
            sync();
          }
          if (popup.hidden) return;
          event.preventDefault();
          const down = event.key === 'ArrowDown';
          const count = options().length;
          setActive(
            activeIndex === -1
              ? down
                ? 0
                : count - 1
              : (activeIndex + (down ? 1 : -1) + count) % count,
          );
          break;
        }
        case 'Enter': {
          if (popup.hidden || activeIndex === -1) return;
          event.preventDefault();
          options()[activeIndex]?.click();
          close();
          break;
        }
        case 'Escape': {
          if (popup.hidden) return;
          event.preventDefault();
          close();
          break;
        }
        case 'Tab':
          close();
          break;
      }
    };

    // Runs after the option's own handlers (anchor navigation, Datastar
    // `data-on:click`) since it listens on the bubbling popup.
    const onPopupClick = (event: MouseEvent) => {
      const option = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-part="option"]',
      );
      if (option) close();
    };

    const onOutsidePointer = (event: PointerEvent) => {
      if (open && !root.contains(event.target as Node)) close();
    };

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (open && (!next || !root.contains(next))) close();
    };

    const form = input.closest('form') ?? root.querySelector('form');
    const onSubmit = () => close();

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);
    popup.addEventListener('click', onPopupClick);
    root.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onOutsidePointer);
    form?.addEventListener('submit', onSubmit);

    return () => {
      observer.disconnect();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeydown);
      popup.removeEventListener('click', onPopupClick);
      root.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onOutsidePointer);
      form?.removeEventListener('submit', onSubmit);
    };
  },
});
