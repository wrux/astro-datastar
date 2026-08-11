export type NavItem = { href: string; label: string; description?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const nav: NavGroup[] = [
  {
    label: 'Datastar',
    items: [
      {
        href: '/docs/installation',
        label: 'Installation',
        description: 'Add the integration and get Datastar on every page.',
      },
      {
        href: '/docs/options',
        label: 'Integration Options',
        description:
          'Opt out of global injection, or load your own plugin set.',
      },
    ],
  },
  {
    label: 'Usage',
    items: [
      {
        href: '/docs/reading-signals',
        label: 'Reading Signals',
        description: 'Read the client payload in endpoints, and guard them.',
      },
      {
        href: '/docs/server-responses',
        label: 'Server Responses',
        description: 'HTML morphs, SSE events, and open streams.',
      },
      {
        href: '/docs/validation',
        label: 'Validation',
        description: 'Validate signals with Zod (or any Standard Schema).',
      },
      {
        href: '/docs/loading-states',
        label: 'Loading States',
        description: 'Indicators and busy fades while requests are in flight.',
      },
      {
        href: '/docs/writing-plugins',
        label: 'Writing Plugins',
        description: 'Build custom data-* attributes on the engine export.',
      },
    ],
  },
  {
    label: 'Examples',
    items: [
      {
        href: '/examples/signals',
        label: 'Signals & Bindings',
        description: 'Counters, two-way binding, show/hide — no endpoint.',
      },
      {
        href: '/examples/active-search',
        label: 'Active Search',
        description: 'Debounced search re-rendering one shared component.',
      },
      {
        href: '/examples/pagination',
        label: 'Pagination',
        description: 'Server-rendered pages with shareable ?page= URLs.',
      },
      {
        href: '/examples/load-more',
        label: 'Load More',
        description: 'Append batches with SSE patches; button removes itself.',
      },
      {
        href: '/examples/filters',
        label: 'Filters',
        description:
          'Dependent selects patching controls and results together.',
      },
      {
        href: '/examples/form',
        label: 'Form Validation',
        description: 'Zod-validated form with server-rendered field errors.',
      },
      {
        href: '/examples/polling',
        label: 'Polling',
        description: 'Fetch on load, re-fetch on an interval or custom event.',
      },
      {
        href: '/examples/stream',
        label: 'SSE Streaming',
        description: 'One request, many updates over an open stream.',
      },
    ],
  },
  {
    label: 'Plugin Examples',
    items: [
      {
        href: '/examples/plugins/collapse',
        label: 'Collapse',
        description: 'Animated height plugin, plus an accordion.',
      },
      {
        href: '/examples/plugins/cloak',
        label: 'Cloak',
        description: 'No flash of pre-hydration state.',
      },
      {
        href: '/examples/plugins/combobox',
        label: 'Combobox',
        description: 'APG combobox with server-rendered options.',
      },
    ],
  },
];

const sectionLabels: Record<string, string> = {
  docs: 'Docs',
  examples: 'Examples',
  plugins: 'Plugins',
};

const itemLabels = new Map(
  nav.flatMap((group) => group.items.map((i) => [i.href, i.label] as const)),
);

/** Home / Section / … / Page for the given pathname. */
/** Look up a nav group by label; throws at build time if it was renamed. */
export function navGroup(label: string): NavGroup {
  const group = nav.find((g) => g.label === label);
  if (!group) throw new Error(`Unknown nav group: ${label}`);
  return group;
}

export function breadcrumb(pathname: string): NavItem[] {
  const path = pathname.replace(/\/$/, '') || '/';
  const crumbs: NavItem[] = [{ href: '/', label: 'Home' }];
  const segments = path.split('/').filter(Boolean);
  segments.forEach((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join('/')}`;
    const label = itemLabels.get(href) ?? sectionLabels[segment] ?? segment;
    crumbs.push({ href, label });
  });
  return crumbs;
}
