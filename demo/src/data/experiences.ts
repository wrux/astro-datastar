export type Experience = {
  title: string;
  type: string;
  region: string;
  destination: string;
};

export const types = ['Food', 'Culture', 'Outdoors', 'Market'] as const;

export const regions: Record<string, string[]> = {
  Scotland: ['Edinburgh', 'Glasgow', 'Highlands'],
  Wales: ['Cardiff', 'Pembrokeshire', 'Snowdonia'],
  'Northern England': ['Lake District', 'Manchester', 'York'],
  'Southern England': ['Brighton', 'Cornwall', 'London'],
  'Northern Ireland': ['Belfast', 'Causeway Coast'],
};

export const experiences: Experience[] = [
  { title: 'Old Town ghost walk', type: 'Culture', region: 'Scotland', destination: 'Edinburgh' },
  { title: 'Festival fringe crawl', type: 'Culture', region: 'Scotland', destination: 'Edinburgh' },
  { title: 'West End food tour', type: 'Food', region: 'Scotland', destination: 'Glasgow' },
  { title: 'Barras weekend market', type: 'Market', region: 'Scotland', destination: 'Glasgow' },
  { title: 'Munro bagging weekend', type: 'Outdoors', region: 'Scotland', destination: 'Highlands' },
  { title: 'Loch kayak safari', type: 'Outdoors', region: 'Scotland', destination: 'Highlands' },
  { title: 'Castle arcades browse', type: 'Market', region: 'Wales', destination: 'Cardiff' },
  { title: 'Welsh cakes masterclass', type: 'Food', region: 'Wales', destination: 'Cardiff' },
  { title: 'Coast path hike', type: 'Outdoors', region: 'Wales', destination: 'Pembrokeshire' },
  { title: 'Summit railway ascent', type: 'Outdoors', region: 'Wales', destination: 'Snowdonia' },
  { title: 'Fell-walking weekend', type: 'Outdoors', region: 'Northern England', destination: 'Lake District' },
  { title: 'Northern quarter street food', type: 'Food', region: 'Northern England', destination: 'Manchester' },
  { title: 'Music heritage tour', type: 'Culture', region: 'Northern England', destination: 'Manchester' },
  { title: 'Shambles market wander', type: 'Market', region: 'Northern England', destination: 'York' },
  { title: 'City walls circuit', type: 'Culture', region: 'Northern England', destination: 'York' },
  { title: 'Lanes vintage hunt', type: 'Market', region: 'Southern England', destination: 'Brighton' },
  { title: 'Coastal foraging day', type: 'Food', region: 'Southern England', destination: 'Cornwall' },
  { title: 'Surf school session', type: 'Outdoors', region: 'Southern England', destination: 'Cornwall' },
  { title: 'Borough market tasting', type: 'Food', region: 'Southern England', destination: 'London' },
  { title: 'Museum mile walk', type: 'Culture', region: 'Southern England', destination: 'London' },
  { title: 'Cathedral quarter tour', type: 'Culture', region: 'Northern Ireland', destination: 'Belfast' },
  { title: "St George's market morning", type: 'Market', region: 'Northern Ireland', destination: 'Belfast' },
  { title: 'Clifftop causeway hike', type: 'Outdoors', region: 'Northern Ireland', destination: 'Causeway Coast' },
];
