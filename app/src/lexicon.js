// Ski-domain-adjusted sentiment lexicon.
// Scores reflect skiing context, not generic English sentiment.

export const LEXICON = {
  // DANGER / MORTALITY
  widow: -4, widowmaker: -4, killer: -4, death: -4, dead: -3, kill: -3,
  suicide: -4, grave: -3, coffin: -4, hell: -3, devil: -3, doom: -3,
  terror: -3, nightmare: -3, hangman: -3, gallows: -3, executioner: -4,
  massacre: -4, slaughter: -4, last: -1, final: -1, dying: -3,

  // PREDATORS / VENOMOUS
  grizzly: -2, wolverine: -2, rattlesnake: -2, viper: -2, cobra: -2,
  hornet: -2, scorpion: -2, shark: -2, jaws: -2, fang: -2, claw: -2,
  wolf: -2, bear: -1, panther: -2, cougar: -2, lynx: -1, hawk: -1,
  vulture: -2, raven: -1,

  // HARSH TERRAIN
  cliff: -3, cliffs: -3, headwall: -3, couloir: -3, chute: -2, chutes: -2,
  cornice: -2, gully: -2, spine: -2, drop: -2, ledge: -2, crag: -2,
  gnar: -2, gnarly: -2, mogul: -1, moguls: -1, bumps: -1, rock: -1,
  rocks: -1, boulder: -1, face: -1, wall: -2, abyss: -3, void: -3,
  precipice: -3, bowl: -1, woods: -1, trees: -1, tree: -1, saddle: -1, line: -1,

  // HARSH ADJECTIVES
  steep: -2, narrow: -1, tight: -1, sharp: -1, broken: -2, twisted: -1,
  crooked: -1, plunge: -2, fall: -1, ice: -1, icy: -1, frozen: -1,
  dark: -1, shadow: -1, shadowy: -2, lost: -2, lonely: -1, ghost: -2,
  haunted: -2, wild: -1, savage: -2, brutal: -3, vicious: -2,
  ruthless: -2, danger: -3, hazard: -2, warning: -2, beware: -2,
  never: -1, screaming: -2, screamer: -2, mean: -1, nasty: -2,
  fearsome: -2, dread: -3, perilous: -3, treacherous: -3, thunder: -1,

  // BUNNY HILL DICTION
  bunny: 3, lullaby: 3, easy: 3, gentle: 3, sweet: 3, sunny: 3,
  sunshine: 3, sunnyside: 3, smile: 3, happy: 3, joy: 3, dream: 3,
  pleasant: 3, lovely: 3, paradise: 3, heaven: 3, heavenly: 3,
  friendly: 3, cozy: 3, kindergarten: 3, family: 2,

  // PASTORAL / SCENIC
  meadow: 2, meadows: 2, grove: 2, pasture: 2, garden: 2, blossom: 2,
  flower: 2, daisy: 2, rose: 2, lily: 2, butterfly: 2, songbird: 2,
  harmony: 2, peaceful: 2, calm: 2, quiet: 2, serene: 2, tranquil: 2,
  leisure: 2, scenic: 2, panorama: 2, vista: 2, alpine: 1, aspen: 1,
  fern: 1, willow: 1, birch: 1, magic: 2, magical: 2, wonderland: 2,
  creek: 1, forest: 1,

  // MILD POSITIVE
  glade: 1, glades: 1, powder: 1, fluff: 1, cloud: 1, breeze: 1,
  ridge: 1, summit: 1, soar: 1, glide: 1, cruise: 1, cruiser: 1,
  way: 0, road: 0, lane: 1, path: 1, view: 1, sunset: 1, sunrise: 1,
  gold: 1, golden: 1, silver: 1, crystal: 1, jewel: 1, gem: 1,
  rainbow: 2, star: 1, christmas: 1, holiday: 1,
  loop: 1, little: 1, catwalk: 1,
};

export const NAMED_OVERRIDES = [
  { match: 'corbet', score: -4, note: "legendary expert-only couloir" },
  { match: 'rendezvous', score: -2, note: "Jackson Hole expert peak" },
  { match: 'tuckerman', score: -3, note: "Mt Washington headwall" },
  { match: 'kt-22', score: -2, note: "Palisades expert terrain" },
  { match: 'kt 22', score: -2, note: "Palisades expert terrain" },
  { match: 'the big one', score: -2, note: "expert connotation" },
  { match: 'the nose', score: -2, note: "expert connotation" },
  { match: 's&s', score: -3, note: "Steep & Stupid couloir" },
  { match: 'exhibition', score: 0, note: "neutral" },
];

export function scoreTrail(name) {
  const lower = name.toLowerCase();

  for (const ov of NAMED_OVERRIDES) {
    if (lower.includes(ov.match)) {
      return { score: ov.score, hits: [{ word: ov.match, score: ov.score, note: ov.note }] };
    }
  }

  const tokens = lower
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.replace(/'s$/, ''));

  const hits = [];
  let total = 0;
  for (const token of tokens) {
    if (LEXICON[token] !== undefined) {
      total += LEXICON[token];
      hits.push({ word: token, score: LEXICON[token] });
    }
  }
  return { score: total, hits };
}
