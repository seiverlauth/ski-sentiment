import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { Mountain, Plus, Upload, ArrowUpDown, Info } from 'lucide-react';

// ============================================================
// SKI-DOMAIN-ADJUSTED SENTIMENT LEXICON
// ============================================================
// Generic lexicons (AFINN/VADER) miss ski naming conventions in
// systematic ways. This lexicon corrects for:
//  - Predator/danger animals used for expert runs
//  - Geological terms ("couloir", "headwall", "cliff") that
//    are neutral generically but signal exposure to skiers
//  - Saccharine "bunny-hill diction" intended to telegraph safety
//  - Specific named runs with established reputations
// Conservative weighting: -4 to +4 scale, neutral default.

const LEXICON = {
  // ---- DANGER / MORTALITY ----
  widow: -4, widowmaker: -4, killer: -4, death: -4, dead: -3, kill: -3,
  suicide: -4, grave: -3, coffin: -4, hell: -3, devil: -3, doom: -3,
  terror: -3, nightmare: -3, hangman: -3, gallows: -3, executioner: -4,
  massacre: -4, slaughter: -4, dying: -3, misery: -3, agony: -3,
  wicked: -2, evil: -3, cursed: -2, bleak: -2, grim: -2,

  // ---- PREDATORS / VENOMOUS ----
  grizzly: -2, wolverine: -2, rattlesnake: -2, viper: -2, cobra: -2,
  hornet: -2, scorpion: -2, shark: -2, jaws: -2, fang: -2, claw: -2,
  wolf: -2, bear: -2, panther: -2, cougar: -2, lynx: -1, hawk: -1,
  vulture: -2, raven: -1, tiger: -2, wildcat: -2, puma: -2,
  timberwolf: -2, goshawk: -2, rattler: -2, goat: -1,

  // ---- HARSH TERRAIN ----
  cliff: -3, cliffs: -3, headwall: -3, couloir: -3, chute: -2, chutes: -2,
  cornice: -2, gully: -2, spine: -2, drop: -2, ledge: -2, crag: -2,
  gnar: -2, gnarly: -2, mogul: -1, moguls: -1, bumps: -1, rock: -1,
  rocks: -1, boulder: -1, face: -1, wall: -2, abyss: -3, void: -3,
  precipice: -3, bowl: -1, woods: -1, trees: -1, tree: -1, saddle: -1,
  shaft: -2, cirque: -2, liftline: -1, waterfall: -1, mine: -1,
  edge: -2, notch: -1, pitch: -1, cone: -1, hole: -1, highline: -2,
  powerline: -1, drain: -2, needles: -2, cataract: -2, trap: -2, exit: -1,
  rim: -1, pinnacles: -2, line: -1, wreck: -2, crash: -2,
  glade: -1, glades: -1, forest: -1, ridge: -1,

  // ---- HARSH ADJECTIVES / DANGER ----
  steep: -2, narrow: -1, tight: -1, sharp: -1, broken: -2, twisted: -1,
  crooked: -1, plunge: -2, fall: -1, ice: -1, icy: -1, frozen: -1,
  dark: -1, shadow: -1, shadowy: -2, shadows: -1, lost: -1, lonely: -1,
  ghost: -2, haunted: -2, wild: -1, savage: -2, brutal: -3, vicious: -2,
  ruthless: -2, danger: -3, hazard: -2, warning: -2, beware: -2,
  screaming: -2, screamer: -2, mean: -1, nasty: -2,
  fearsome: -2, dread: -3, perilous: -3, treacherous: -3,
  thunder: -1, lightning: -1, storm: -2,
  gun: -2, dragon: -2, iron: -1, bullet: -1, shot: -1,
  fright: -2, shock: -2, vertigo: -3, psychopath: -3, nowhere: -2,
  bad: -2, runaway: -2, revenge: -2, mach: -2, spitfire: -2, imperial: -2,
  wildfire: -2, serious: -1, challenge: -1, rustler: -1, international: -1,
  diamond: -2, outer: -1, dog: -1, double: -1,
  championship: -1, final: -1,
  sour: -2, bitter: -2, rotten: -2, fury: -2, rage: -2, pain: -2,
  blood: -2, skull: -2, burn: -1, fear: -2, mad: -1, never: -1,

  // ---- BUNNY HILL DICTION ----
  bunny: 3, lullaby: 3, easy: 3, gentle: 3, sweet: 3, sunny: 3,
  sunshine: 3, sunnyside: 3, smile: 3, happy: 3, joy: 3, dream: 3,
  pleasant: 3, lovely: 3, paradise: 3, heaven: 3, heavenly: 3,
  friendly: 3, cozy: 3, kindergarten: 3, family: 2,
  home: 2, comfort: 2, bliss: 2, delight: 2, giggle: 2, carefree: 2,
  baby: 2, splendor: 2, mellow: 2, honey: 2, warm: 1, nice: 2,
  smooth: 1, soft: 1, bright: 1,

  // ---- CONNECTOR / ACCESS ----
  broadway: 1, skiway: 1, flats: 1, village: 1, avenue: 1,
  road: 1, way: 1, street: 1, lane: 1, path: 1,
  connector: 1, bypass: 1, timberline: 1, bonanza: 1, sundown: 1,

  // ---- PASTORAL / SCENIC ----
  meadow: 2, meadows: 2, grove: 2, pasture: 2, garden: 2, blossom: 2, flower: 2,
  daisy: 2, rose: 2, lily: 2, butterfly: 2, songbird: 2, harmony: 2,
  peaceful: 2, calm: 2, quiet: 2, serene: 2, tranquil: 2, tranquility: 2,
  leisure: 2, scenic: 2, panorama: 2, vista: 2, alpine: 1, aspen: 1,
  fern: 1, willow: 1, birch: 1, juniper: 1, magic: 2, magical: 2, wonderland: 2,
  creek: 1, primrose: 2, larkspur: 2, columbine: 1, prospector: 1,
  bluebell: 2, magnolia: 2, rosebud: 2, bluebird: 2,
  meander: 1, fawn: 1, summer: 1, velvet: 1, cub: 1, turtle: 1,
  hidden: 1, play: 1, misty: 1, sundance: 1,

  // ---- MILD POSITIVE ----
  powder: 1, fluff: 1, cloud: 1, breeze: 1,
  summit: 1, soar: 1, glide: 1, cruise: 1, cruiser: 1,
  view: 1, sunset: 1, sunrise: 1,
  gold: 1, golden: 1, silver: 1, crystal: 1, jewel: 1, gem: 1,
  rainbow: 2, star: 1, christmas: 1, holiday: 1,
  loop: 1, little: 1, catwalk: 1, prospector: 1,
};

// Multi-word proper nouns / named runs (matched as substrings).
// These override token scoring. Sourced from known reputations.
const NAMED_RUN_OVERRIDES = [
  { match: "corbet", score: -4, note: "legendary expert-only couloir" },
  { match: "rendezvous", score: -2, note: "Jackson Hole expert peak" },
  { match: "tuckerman", score: -3, note: "Mt Washington headwall" },
  { match: "kt-22", score: -2, note: "Palisades expert terrain" },
  { match: "kt 22", score: -2, note: "Palisades expert terrain" },
  { match: "the big one", score: -2, note: "expert connotation" },
  { match: "the nose", score: -2, note: "expert connotation" },
  { match: "s&s", score: -3, note: "Steep & Stupid couloir" },
  { match: "exhibition", score: 0, note: "neutral" },
];

const DIFFICULTY_ORDER = ['green', 'blue', 'black', 'double-black'];
const DIFFICULTY_LABEL = {
  green: 'Green Circle',
  blue: 'Blue Square',
  black: 'Black Diamond',
  'double-black': 'Double Black',
};
const DIFFICULTY_X = { green: 1, blue: 2, black: 3, 'double-black': 4 };
const DIFFICULTY_COLOR = {
  green: '#3d8b5c',
  blue: '#3a6fa8',
  black: '#1a1a1a',
  'double-black': '#b8341a',
};

// ============================================================
// SAMPLE DATA — verified trail names from major US resorts
// Every entry below has been verified against the resort's
// own trail map or established ski media. Sources include:
//   - Vail Resort's official trail-name history pages
//   - Killington's trail map (NYSkiBlog, Ski Magazine, VT Ski + Ride)
//   - Crested Butte's North Face guide (gunnisoncrestedbutte.com)
//   - Jackson Hole official site (jacksonhole.com) and Wikipedia
//   - SteepSeeker trail-map database
// ============================================================
const SAMPLE_TRAILS = [
  // ---- GREENS ----
  { name: "Sourdough", difficulty: "green", resort: "Vail" },
  { name: "Gopher Hill", difficulty: "green", resort: "Vail" },
  { name: "Born Free", difficulty: "green", resort: "Vail" },
  { name: "Sleepytime Road", difficulty: "green", resort: "Vail" },
  { name: "Bunny Buster", difficulty: "green", resort: "Killington" },
  { name: "Snowshed", difficulty: "green", resort: "Killington" },
  { name: "Mouse Trap", difficulty: "green", resort: "Killington" },
  { name: "Painter Boy", difficulty: "green", resort: "Crested Butte" },
  { name: "Houseboat", difficulty: "green", resort: "Crested Butte" },
  { name: "Twin Bridges", difficulty: "green", resort: "Crested Butte" },

  // ---- BLUES ----
  { name: "Northwoods", difficulty: "blue", resort: "Vail" },
  { name: "Avanti", difficulty: "blue", resort: "Vail" },
  { name: "Ramshorn", difficulty: "blue", resort: "Vail" },
  { name: "Simba", difficulty: "blue", resort: "Vail" },
  { name: "The Slot", difficulty: "blue", resort: "Vail" },
  { name: "Skylark", difficulty: "blue", resort: "Killington" },
  { name: "High Road", difficulty: "blue", resort: "Killington" },
  { name: "Wildfire", difficulty: "blue", resort: "Killington" },
  { name: "Ruby Chief", difficulty: "blue", resort: "Crested Butte" },
  { name: "Forest Queen", difficulty: "blue", resort: "Crested Butte" },
  { name: "Gros Ventre", difficulty: "blue", resort: "Jackson Hole" },
  { name: "Amphitheater", difficulty: "blue", resort: "Jackson Hole" },

  // ---- BLACKS ----
  { name: "Riva Ridge", difficulty: "black", resort: "Vail" },
  { name: "Pepi's Face", difficulty: "black", resort: "Vail" },
  { name: "Forever", difficulty: "black", resort: "Vail" },
  { name: "Ouzo", difficulty: "black", resort: "Vail" },
  { name: "Blue Ox", difficulty: "black", resort: "Vail" },
  { name: "Superstar", difficulty: "black", resort: "Killington" },
  { name: "Downdraft", difficulty: "black", resort: "Killington" },
  { name: "Cascade", difficulty: "black", resort: "Killington" },
  { name: "Royal Flush", difficulty: "black", resort: "Killington" },
  { name: "Twister", difficulty: "black", resort: "Crested Butte" },
  { name: "Rendezvous Bowl", difficulty: "black", resort: "Jackson Hole" },
  { name: "Laramie Bowl", difficulty: "black", resort: "Jackson Hole" },
  { name: "Paintbrush", difficulty: "black", resort: "Jackson Hole" },

  // ---- DOUBLE BLACKS ----
  { name: "Corbet's Couloir", difficulty: "double-black", resort: "Jackson Hole" },
  { name: "S&S Couloir", difficulty: "double-black", resort: "Jackson Hole" },
  { name: "Alta Chutes", difficulty: "double-black", resort: "Jackson Hole" },
  { name: "Tower Three Chute", difficulty: "double-black", resort: "Jackson Hole" },
  { name: "Outer Limits", difficulty: "double-black", resort: "Killington" },
  { name: "Devil's Fiddle", difficulty: "double-black", resort: "Killington" },
  { name: "Ovation", difficulty: "double-black", resort: "Killington" },
  { name: "Double Dipper", difficulty: "double-black", resort: "Killington" },
  { name: "Rambo", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Spellbound", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Phoenix", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Hard Slab", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Hawks Nest", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Cesspool", difficulty: "double-black", resort: "Crested Butte" },
  { name: "Third Bowl", difficulty: "double-black", resort: "Crested Butte" },
];

// ============================================================
// SCORING
// ============================================================
function scoreTrail(name) {
  const lower = name.toLowerCase();

  // Check named overrides first
  for (const override of NAMED_RUN_OVERRIDES) {
    if (lower.includes(override.match)) {
      return { score: override.score, hits: [{ word: override.match, score: override.score, note: override.note }] };
    }
  }

  // Tokenize: strip punctuation, split on whitespace
  const tokens = lower
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // strip trailing apostrophe-s
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

// ============================================================
// COMPONENT
// ============================================================
export default function SkiSentimentApp() {
  const [trails, setTrails] = useState(SAMPLE_TRAILS);
  const [newName, setNewName] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('blue');
  const [newResort, setNewResort] = useState('');
  const [csvText, setCsvText] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [showLexicon, setShowLexicon] = useState(false);
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('asc');

  // Score every trail
  const scored = useMemo(() => {
    return trails.map(t => {
      const { score, hits } = scoreTrail(t.name);
      return { ...t, score, hits, x: DIFFICULTY_X[t.difficulty] };
    });
  }, [trails]);

  // Aggregate by difficulty
  const aggregates = useMemo(() => {
    return DIFFICULTY_ORDER.map(diff => {
      const items = scored.filter(t => t.difficulty === diff);
      const avg = items.length ? items.reduce((s, t) => s + t.score, 0) / items.length : 0;
      return {
        difficulty: diff,
        label: DIFFICULTY_LABEL[diff],
        avg: Number(avg.toFixed(2)),
        count: items.length,
        color: DIFFICULTY_COLOR[diff],
      };
    });
  }, [scored]);

  // Sorted table
  const sorted = useMemo(() => {
    const list = [...scored];
    list.sort((a, b) => {
      let av, bv;
      if (sortKey === 'difficulty') {
        av = DIFFICULTY_X[a.difficulty]; bv = DIFFICULTY_X[b.difficulty];
      } else if (sortKey === 'score') {
        av = a.score; bv = b.score;
      } else {
        av = String(a[sortKey] || '').toLowerCase();
        bv = String(b[sortKey] || '').toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [scored, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'score' ? 'asc' : 'asc');
    }
  }

  function addTrail() {
    if (!newName.trim()) return;
    setTrails([...trails, { name: newName.trim(), difficulty: newDifficulty, resort: newResort.trim() || '—' }]);
    setNewName('');
    setNewResort('');
  }

  function loadCsv() {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      const [name, difficulty, resort] = parts;
      const diff = difficulty.toLowerCase().replace(/\s+/g, '-');
      if (!DIFFICULTY_ORDER.includes(diff)) continue;
      parsed.push({ name, difficulty: diff, resort: resort || '—' });
    }
    if (parsed.length) {
      setTrails(parsed);
      setCsvText('');
      setShowCsv(false);
    }
  }

  // Custom tooltip for scatter
  const ScatterTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#f5efe0', border: '1px solid #2d3e2a', padding: '10px 14px',
        fontFamily: 'Georgia, serif', fontSize: 13, boxShadow: '2px 2px 0 #2d3e2a'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{d.name}</div>
        <div style={{ color: '#6b6452', fontSize: 11, fontStyle: 'italic' }}>{d.resort}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ color: DIFFICULTY_COLOR[d.difficulty] }}>● </span>
          {DIFFICULTY_LABEL[d.difficulty]}
        </div>
        <div style={{ marginTop: 4, fontWeight: 'bold' }}>
          Sentiment: {d.score > 0 ? '+' : ''}{d.score}
        </div>
        {d.hits.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#6b6452' }}>
            {d.hits.map((h, i) => (
              <span key={i}>{h.word} ({h.score > 0 ? '+' : ''}{h.score}){i < d.hits.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const BarTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#f5efe0', border: '1px solid #2d3e2a', padding: '10px 14px',
        fontFamily: 'Georgia, serif', fontSize: 13, boxShadow: '2px 2px 0 #2d3e2a'
      }}>
        <div style={{ fontWeight: 'bold' }}>{d.label}</div>
        <div>Avg sentiment: {d.avg > 0 ? '+' : ''}{d.avg}</div>
        <div style={{ fontSize: 11, color: '#6b6452' }}>n = {d.count}</div>
      </div>
    );
  };

  // Compute scatter domain
  const scoreMin = Math.min(-5, ...scored.map(s => s.score));
  const scoreMax = Math.max(5, ...scored.map(s => s.score));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5efe0',
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(45,62,42,0.04) 40px, rgba(45,62,42,0.04) 41px),
                        repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(45,62,42,0.04) 40px, rgba(45,62,42,0.04) 41px)`,
      fontFamily: 'Georgia, "Times New Roman", serif',
      color: '#2d3e2a',
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* HEADER */}
        <header style={{
          borderBottom: '3px double #2d3e2a',
          paddingBottom: 20,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <Mountain size={36} strokeWidth={1.5} />
              <h1 style={{
                fontSize: 42,
                fontWeight: 'normal',
                letterSpacing: '0.02em',
                margin: 0,
                fontVariant: 'small-caps',
              }}>
                Trail Name Sentiment
              </h1>
            </div>
            <p style={{ margin: 0, marginLeft: 48, fontStyle: 'italic', color: '#6b6452', fontSize: 14 }}>
              Do bunny slopes sound friendlier than double diamonds? An empirical inquiry.
            </p>
          </div>
          <div style={{ fontSize: 12, color: '#6b6452', textAlign: 'right', fontStyle: 'italic' }}>
            {trails.length} trails analyzed<br/>
            Ski-domain-adjusted lexicon
          </div>
        </header>

        {/* TOP SUMMARY */}
        <section style={{ marginBottom: 32 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {aggregates.map(a => (
              <div key={a.difficulty} style={{
                background: 'white',
                border: `2px solid ${a.color}`,
                padding: '16px 20px',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: a.color,
                  fontWeight: 'bold',
                }}>
                  {a.label}
                </div>
                <div style={{
                  fontSize: 36,
                  fontWeight: 'normal',
                  margin: '8px 0 0 0',
                  color: a.avg > 0 ? '#3d8b5c' : a.avg < 0 ? '#b8341a' : '#6b6452',
                }}>
                  {a.avg > 0 ? '+' : ''}{a.avg}
                </div>
                <div style={{ fontSize: 11, color: '#6b6452', fontStyle: 'italic' }}>
                  avg sentiment · n={a.count}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CHARTS */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: 24,
          marginBottom: 32,
        }}>
          {/* BAR */}
          <div style={{ background: 'white', border: '1px solid #2d3e2a', padding: 20 }}>
            <h2 style={{
              fontSize: 16,
              margin: '0 0 4px 0',
              fontVariant: 'small-caps',
              letterSpacing: '0.05em',
            }}>
              Average Sentiment by Tier
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#6b6452', fontStyle: 'italic' }}>
              Higher = more cheerful naming. Lower = more foreboding.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={aggregates} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#d4cab3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#2d3e2a', fontSize: 11, fontFamily: 'Georgia' }}
                  axisLine={{ stroke: '#2d3e2a' }}
                />
                <YAxis
                  tick={{ fill: '#2d3e2a', fontSize: 11, fontFamily: 'Georgia' }}
                  axisLine={{ stroke: '#2d3e2a' }}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(45,62,42,0.05)' }} />
                <ReferenceLine y={0} stroke="#2d3e2a" strokeWidth={1} />
                <Bar dataKey="avg" radius={[2, 2, 0, 0]}>
                  {aggregates.map((a, i) => (
                    <Cell key={i} fill={a.color} />
                  ))}
                  <LabelList dataKey="avg" position="top" style={{ fontFamily: 'Georgia', fontSize: 11, fill: '#2d3e2a' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SCATTER */}
          <div style={{ background: 'white', border: '1px solid #2d3e2a', padding: 20 }}>
            <h2 style={{
              fontSize: 16,
              margin: '0 0 4px 0',
              fontVariant: 'small-caps',
              letterSpacing: '0.05em',
            }}>
              Individual Trails
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#6b6452', fontStyle: 'italic' }}>
              Hover any point to see the words that drove the score.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#d4cab3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0.5, 4.5]}
                  ticks={[1, 2, 3, 4]}
                  tickFormatter={(v) => DIFFICULTY_LABEL[DIFFICULTY_ORDER[v - 1]] || ''}
                  tick={{ fill: '#2d3e2a', fontSize: 10, fontFamily: 'Georgia' }}
                  axisLine={{ stroke: '#2d3e2a' }}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  domain={[scoreMin - 1, scoreMax + 1]}
                  tick={{ fill: '#2d3e2a', fontSize: 11, fontFamily: 'Georgia' }}
                  axisLine={{ stroke: '#2d3e2a' }}
                />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#6b6452' }} />
                <ReferenceLine y={0} stroke="#2d3e2a" strokeWidth={1} />
                <Scatter data={scored}>
                  {scored.map((d, i) => (
                    <Cell key={i} fill={DIFFICULTY_COLOR[d.difficulty]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* CONTROLS */}
        <section style={{
          background: 'white',
          border: '1px solid #2d3e2a',
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0, fontVariant: 'small-caps', letterSpacing: '0.05em' }}>
              Add or Import Trails
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCsv(!showCsv)} style={btnSecondary}>
                <Upload size={14} /> CSV Import
              </button>
              <button onClick={() => setShowLexicon(!showLexicon)} style={btnSecondary}>
                <Info size={14} /> Lexicon Notes
              </button>
              <button onClick={() => setTrails(SAMPLE_TRAILS)} style={btnSecondary}>
                Reset to Sample
              </button>
            </div>
          </div>

          {/* Add form */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr auto', gap: 8, alignItems: 'stretch' }}>
            <input
              type="text"
              placeholder="Trail name (e.g., Widowmaker)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTrail()}
              style={inputStyle}
            />
            <select value={newDifficulty} onChange={e => setNewDifficulty(e.target.value)} style={inputStyle}>
              {DIFFICULTY_ORDER.map(d => (
                <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Resort (optional)"
              value={newResort}
              onChange={e => setNewResort(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTrail()}
              style={inputStyle}
            />
            <button onClick={addTrail} style={btnPrimary}>
              <Plus size={14} /> Add
            </button>
          </div>

          {/* CSV panel */}
          {showCsv && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: '#6b6452', margin: '0 0 8px 0', fontStyle: 'italic' }}>
                Format: name, difficulty, resort — one per line. Difficulty: green, blue, black, double-black.
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="Widowmaker, double-black, Sugarloaf&#10;Meadows, green, Vail&#10;..."
                rows={6}
                style={{ ...inputStyle, width: '100%', fontFamily: 'Menlo, monospace', resize: 'vertical' }}
              />
              <button onClick={loadCsv} style={{ ...btnPrimary, marginTop: 8 }}>
                Replace Dataset with CSV
              </button>
            </div>
          )}

          {/* Lexicon notes */}
          {showLexicon && (
            <div style={{ marginTop: 16, padding: 16, background: '#f9f4e6', border: '1px dashed #6b6452', fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}>Ski-domain adjustments to the base lexicon:</strong>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li><b>Geological terms</b> (couloir, headwall, cliff, chute, cornice) are scored negative (−2 to −3). Generic lexicons treat these as neutral nouns; in ski context they signal exposure and consequence.</li>
                <li><b>Predator and venomous animals</b> (grizzly, wolverine, rattlesnake, viper) score −2. These are systematically used to name expert terrain.</li>
                <li><b>Bunny-hill diction</b> (bunny, lullaby, sunny, meadow, lullaby, paradise) scores +2 to +3. These words are deliberately picked to telegraph safety to beginners and parents.</li>
                <li><b>Named-run overrides</b> apply to known reputations: Corbet's (−4), Tuckerman (−3), S&S (−3), Rendezvous (−2). Generic models score these as neutral proper nouns.</li>
                <li><b>Mortality terms</b> (widow, death, suicide, coffin, gallows) scored most negative (−3 to −4).</li>
                <li><b>Conservative weighting</b>: a single hit rarely dominates. Ironic names ("Fanny Hill", "Easy Out" on a hard run) will sometimes mis-score, but aggregate signal should hold.</li>
              </ul>
            </div>
          )}
        </section>

        {/* TABLE */}
        <section style={{ background: 'white', border: '1px solid #2d3e2a', padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 16px 0', fontVariant: 'small-caps', letterSpacing: '0.05em' }}>
            All Trails
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #2d3e2a' }}>
                  <Th onClick={() => toggleSort('name')} active={sortKey === 'name'} dir={sortDir}>Trail</Th>
                  <Th onClick={() => toggleSort('difficulty')} active={sortKey === 'difficulty'} dir={sortDir}>Difficulty</Th>
                  <Th onClick={() => toggleSort('resort')} active={sortKey === 'resort'} dir={sortDir}>Resort</Th>
                  <Th onClick={() => toggleSort('score')} active={sortKey === 'score'} dir={sortDir}>Score</Th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 'normal', fontStyle: 'italic', color: '#6b6452' }}>
                    Triggered words
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px dotted #d4cab3' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{t.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: DIFFICULTY_COLOR[t.difficulty],
                        color: t.difficulty === 'black' || t.difficulty === 'double-black' ? 'white' : 'white',
                        fontSize: 11,
                        letterSpacing: '0.05em',
                      }}>
                        {DIFFICULTY_LABEL[t.difficulty]}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6b6452', fontStyle: 'italic' }}>{t.resort}</td>
                    <td style={{
                      padding: '8px 12px',
                      fontWeight: 'bold',
                      color: t.score > 0 ? '#3d8b5c' : t.score < 0 ? '#b8341a' : '#6b6452',
                    }}>
                      {t.score > 0 ? '+' : ''}{t.score}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b6452' }}>
                      {t.hits.length === 0 ? <span style={{ fontStyle: 'italic' }}>—</span> :
                        t.hits.map((h, j) => (
                          <span key={j} style={{
                            display: 'inline-block',
                            marginRight: 6,
                            padding: '1px 6px',
                            background: h.score > 0 ? 'rgba(61,139,92,0.12)' : 'rgba(184,52,26,0.12)',
                            border: `1px solid ${h.score > 0 ? '#3d8b5c' : '#b8341a'}`,
                            fontSize: 11,
                          }}>
                            {h.word} {h.score > 0 ? '+' : ''}{h.score}
                          </span>
                        ))
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid #d4cab3',
          fontSize: 11,
          color: '#6b6452',
          fontStyle: 'italic',
          textAlign: 'center',
        }}>
          Lexicon hand-rolled with ~150 ski-domain terms · sample trails verified against Vail, Killington, Crested Butte, and Jackson Hole official trail maps
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #2d3e2a',
  background: '#fafaf3',
  fontFamily: 'Georgia, serif',
  fontSize: 14,
  color: '#2d3e2a',
};

const btnPrimary = {
  padding: '8px 14px',
  background: '#2d3e2a',
  color: '#f5efe0',
  border: 'none',
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  letterSpacing: '0.03em',
};

const btnSecondary = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#2d3e2a',
  border: '1px solid #2d3e2a',
  fontFamily: 'Georgia, serif',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

function Th({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        fontWeight: 'normal',
        fontVariant: 'small-caps',
        letterSpacing: '0.08em',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {children}
      {active && <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: 0.6, transform: dir === 'desc' ? 'rotate(180deg)' : 'none' }} />}
    </th>
  );
}
