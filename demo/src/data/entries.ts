export type Entry = {
  id: number;
  title: string;
  blurb: string;
};

const walks = [
  'Canal towpath loop',
  'Castle mound circuit',
  'Old orchard trail',
  'River meadow walk',
  'Ironstone ridge path',
  'Beacon hill climb',
  'Mill pond circuit',
  'Drovers lane ramble',
  'Spinney and stiles loop',
  'Hollow way track',
  'Church fields round',
  'Wharf to lock stroll',
  'Bluebell copse walk',
  'Windmill rise loop',
  'Ford and footbridge trail',
  'Sheepwash lane circuit',
  'Quarry edge path',
  'Water meadow wander',
  'Green lane loop',
  'Tithe barn round',
  'Packhorse bridge trail',
  'Furze common circuit',
  'Elm avenue stroll',
];

export const entries: Entry[] = walks.map((title, i) => ({
  id: i + 1,
  title,
  blurb: `A ${3 + ((i * 7) % 9)} km route, roughly ${45 + ((i * 13) % 90)} minutes at an easy pace.`,
}));
