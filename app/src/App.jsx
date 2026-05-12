import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ErrorBar,
  ScatterChart, Scatter,
} from 'recharts';
import { Mountain, Search, Download, ArrowUpDown, ChevronDown, AlertCircle } from 'lucide-react';
import { scoreTrail } from './lexicon.js';
import { welchTest, formatP, cohenLabel, stdError } from './stats.js';

// ── Constants ─────────────────────────────────────────────────────────────────

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

// Deterministic jitter seeded by string hash
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
function jitter(name, diff) {
  const h = strHash(name + diff);
  return ((h & 0xffff) / 0xffff - 0.5) * 0.55;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [rawTrails, setRawTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [resortFilter, setResortFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Table sort
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  // Load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}trails.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setRawTrails(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Score all trails (expensive, memoized once)
  const scored = useMemo(() => {
    return rawTrails.map(t => {
      const { score, hits } = scoreTrail(t.name);
      return { ...t, score, hits, x: DIFFICULTY_X[t.difficulty] + jitter(t.name, t.difficulty) };
    });
  }, [rawTrails]);

  // Filter options
  const resorts = useMemo(() => ['All', ...Array.from(new Set(scored.map(t => t.resort))).sort()], [scored]);
  const states  = useMemo(() => ['All', ...Array.from(new Set(scored.map(t => t.state))).sort()], [scored]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = scored;
    if (stateFilter !== 'All')  list = list.filter(t => t.state === stateFilter);
    if (resortFilter !== 'All') list = list.filter(t => t.resort === resortFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [scored, stateFilter, resortFilter, search]);

  // Aggregates per tier for bar chart + stats panel
  const aggregates = useMemo(() => {
    return DIFFICULTY_ORDER.map(diff => {
      const items = filtered.filter(t => t.difficulty === diff);
      const scores = items.map(t => t.score);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const se = stdError(scores);
      return {
        difficulty: diff,
        label: DIFFICULTY_LABEL[diff],
        avg: +avg.toFixed(2),
        se: +se.toFixed(3),
        count: items.length,
        color: DIFFICULTY_COLOR[diff],
      };
    });
  }, [filtered]);

  // Statistical test: green vs black+double-black
  const statsResult = useMemo(() => {
    const greens = filtered.filter(t => t.difficulty === 'green').map(t => t.score);
    const hard   = filtered.filter(t => t.difficulty === 'black' || t.difficulty === 'double-black').map(t => t.score);
    return welchTest(greens, hard);
  }, [filtered]);

  // Sorted table
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const list = [...filtered];
    list.sort((a, b) => {
      let av, bv;
      if (sortKey === 'difficulty') { av = DIFFICULTY_X[a.difficulty]; bv = DIFFICULTY_X[b.difficulty]; }
      else if (sortKey === 'score') { av = a.score; bv = b.score; }
      else { av = String(a[sortKey] || '').toLowerCase(); bv = String(b[sortKey] || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); }
    } else {
      setSortKey(key); setSortDir('asc');
    }
  }

  // Export CSV
  const exportCSV = useCallback(() => {
    const header = 'name,resort,state,difficulty,score,hits';
    const rows = sorted.map(t => {
      const hits = t.hits.map(h => `${h.word}(${h.score})`).join(' ');
      return [t.name, t.resort, t.state, t.difficulty, t.score, hits]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = [header, ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ski-sentiment.csv';
    a.click(); URL.revokeObjectURL(url);
  }, [sorted]);

  // Reset resort filter when state changes
  useEffect(() => { setResortFilter('All'); }, [stateFilter]);

  // ── Tooltips ────────────────────────────────────────────────────────────────

  const ScatterTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={tooltipStyle}>
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{d.name}</div>
        <div style={{ color: '#6b6452', fontSize: 11, fontStyle: 'italic' }}>{d.resort} · {d.state}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ color: DIFFICULTY_COLOR[d.difficulty] }}>● </span>
          {DIFFICULTY_LABEL[d.difficulty]}
        </div>
        <div style={{ marginTop: 4, fontWeight: 'bold' }}>
          Sentiment: {d.score > 0 ? '+' : ''}{d.score}
        </div>
        {d.hits.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#6b6452' }}>
            {d.hits.map((h, i) => <span key={i}>{h.word} ({h.score > 0 ? '+' : ''}{h.score}){i < d.hits.length - 1 ? ', ' : ''}</span>)}
          </div>
        )}
      </div>
    );
  };

  const BarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={tooltipStyle}>
        <div style={{ fontWeight: 'bold' }}>{d.label}</div>
        <div>Avg: {d.avg > 0 ? '+' : ''}{d.avg}</div>
        <div style={{ fontSize: 11 }}>±{d.se} (SE) · n={d.count}</div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: '2em', color: '#666' }}>Loading trail data…</div>
  );

  if (error) return (
    <div style={{ padding: '2em' }}>
      <p style={{ color: '#b8341a' }}>Failed to load trails.json: {error}</p>
      <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>Make sure trails.json is in app/public/</p>
    </div>
  );

  const scoreMin = Math.min(-5, ...filtered.map(t => t.score));
  const scoreMax = Math.max(5, ...filtered.map(t => t.score));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <header style={{ borderBottom: '1px solid #000', paddingBottom: '1em', marginBottom: '1.5em' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1em', fontWeight: 'normal', marginBottom: '0.25em' }}>Trail Name Sentiment</h1>
            <p style={{ color: '#666' }}>
              Do the names of green ski runs sound better than the names of blacks/double blacks?
            </p>
          </div>
        </div>
      </header>

      {/* ── STICKY STATS PANEL ── */}
      <div style={statsPanelStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, flex: 1 }}>
          {aggregates.map(a => (
            <div key={a.difficulty} style={statsTileStyle()}>
              <div style={{ fontSize: 12, color: a.color }}>
                {a.label}
              </div>
              <div style={{ fontSize: 22, color: a.avg > 0 ? '#3d8b5c' : a.avg < 0 ? '#b8341a' : '#666', lineHeight: 1.2 }}>
                {a.avg > 0 ? '+' : ''}{a.avg}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>n={a.count}</div>
            </div>
          ))}
        </div>
        {statsResult && (() => {
          const sig = statsResult.p < 0.05;
          const greenHigher = statsResult.meanA > statsResult.meanB;
          const verdict = !sig ? 'inconclusive' : greenHigher ? 'yes' : 'no';
          const color = verdict === 'yes' ? '#3d8b5c' : verdict === 'no' ? '#b8341a' : '#888';
          const subtext = verdict === 'yes'
            ? 'green names score higher'
            : verdict === 'no'
            ? 'green names score lower'
            : 'no significant difference';
          return (
            <div style={{ ...statsResultStyle, position: 'relative' }} className="stats-verdict">
              <div style={{ fontSize: 13, color }}>
                {verdict === 'yes' ? '✓ yes' : verdict === 'no' ? '✗ no' : '~ inconclusive'}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{subtext}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>hover for stats</div>
              <div className="stats-detail">
                <div>{formatP(statsResult.p)}</div>
                <div>effect size: {statsResult.cohenD.toFixed(2)} ({cohenLabel(statsResult.cohenD)})</div>
                <div>green avg: {statsResult.meanA > 0 ? '+' : ''}{statsResult.meanA.toFixed(2)} · hard avg: {statsResult.meanB.toFixed(2)}</div>
                <div>Δ = {(statsResult.meanA - statsResult.meanB).toFixed(2)} pts</div>
                <div style={{ marginTop: 6, color: '#999', fontSize: 11 }}>n={statsResult.nA} green, n={statsResult.nB} black/dbl</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── CHARTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24, marginBottom: 24 }}>

        {/* Bar chart */}
        <div style={cardStyle}>
          <h2 style={chartTitleStyle}>avg sentiment by tier</h2>
          <p style={chartSubtitleStyle}>error bars = ±1 standard error of the mean</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={aggregates} margin={{ top: 20, right: 20, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#ddd" />
              <XAxis dataKey="label" tick={{ fill: '#000', fontSize: 12, fontFamily: 'ibm-plex-mono, monospace' }} axisLine={{ stroke: '#000' }} />
              <YAxis tick={{ fill: '#000', fontSize: 12, fontFamily: 'ibm-plex-mono, monospace' }} axisLine={{ stroke: '#000' }} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
              <Bar dataKey="avg" radius={[2, 2, 0, 0]}>
                {aggregates.map((a, i) => <Cell key={i} fill={a.color} />)}
                <ErrorBar dataKey="se" width={6} strokeWidth={1.5} stroke="#000" direction="y" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter chart */}
        <div style={cardStyle}>
          <h2 style={chartTitleStyle}>individual trails</h2>
          <p style={chartSubtitleStyle}>hover for details. x-axis jittered to reduce overlap.</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#ddd" />
              <XAxis
                type="number" dataKey="x" domain={[0.5, 4.5]}
                ticks={[1, 2, 3, 4]}
                tickFormatter={v => DIFFICULTY_LABEL[DIFFICULTY_ORDER[v - 1]] || ''}
                tick={{ fill: '#000', fontSize: 11, fontFamily: 'ibm-plex-mono, monospace' }}
                axisLine={{ stroke: '#000' }}
              />
              <YAxis type="number" dataKey="score" domain={[scoreMin - 1, scoreMax + 1]}
                tick={{ fill: '#000', fontSize: 12, fontFamily: 'ibm-plex-mono, monospace' }} axisLine={{ stroke: '#000' }} />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#666' }} />
              <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
              <Scatter data={filtered} shape={DotShape} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div style={cardStyle}>
        <h2 style={{ ...chartTitleStyle, marginBottom: 12 }}>all trails</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={labelStyle}>
            State
            <SelectWrap value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              {states.map(s => <option key={s}>{s}</option>)}
            </SelectWrap>
          </label>
          <label style={labelStyle}>
            Resort
            <SelectWrap value={resortFilter} onChange={e => setResortFilter(e.target.value)}>
              {resorts
                .filter(r => r === 'All' || stateFilter === 'All' || scored.some(t => t.resort === r && t.state === stateFilter))
                .map(r => <option key={r}>{r}</option>)}
            </SelectWrap>
          </label>
          <label style={{ ...labelStyle, flexGrow: 1, maxWidth: 280 }}>
            Search
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b6452' }} />
              <input
                type="text"
                placeholder="Trail name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 26, width: '100%' }}
              />
            </div>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {(stateFilter !== 'All' || resortFilter !== 'All' || search) && (
              <button onClick={() => { setStateFilter('All'); setResortFilter('All'); setSearch(''); }} style={btnSecondary}>
                Clear
              </button>
            )}
            <button onClick={exportCSV} style={btnSecondary} title="Export filtered view as CSV">
              <Download size={13} /> CSV
            </button>
            <span style={{ ...badgeStyle, fontSize: 12 }}>{filtered.length.toLocaleString()} trails</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <Th label="Trail"      sortKey="name"       active={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th label="Resort"     sortKey="resort"     active={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th label="State"      sortKey="state"      active={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th label="Difficulty" sortKey="difficulty" active={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th label="Score"      sortKey="score"      active={sortKey} dir={sortDir} onSort={toggleSort} />
                <th style={thStyle}>Triggered words</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '7px 12px' }}>{t.name}</td>
                  <td style={{ padding: '7px 12px', color: '#666', whiteSpace: 'nowrap' }}>{t.resort}</td>
                  <td style={{ padding: '7px 12px', color: '#666' }}>{t.state}</td>
                  <td style={{ padding: '7px 12px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 7px', background: DIFFICULTY_COLOR[t.difficulty], color: 'white', fontSize: 11, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {DIFFICULTY_LABEL[t.difficulty]}
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', color: t.score > 0 ? '#3d8b5c' : t.score < 0 ? '#b8341a' : '#666' }}>
                    {t.score > 0 ? '+' : ''}{t.score}
                  </td>
                  <td style={{ padding: '7px 12px', fontSize: 11 }}>
                    {t.hits.length === 0
                      ? <span style={{ color: '#aaa' }}>—</span>
                      : t.hits.map((h, j) => (
                          <span key={j} style={{ display: 'inline-block', marginRight: 5, marginBottom: 2, padding: '1px 6px', background: h.score > 0 ? 'rgba(61,139,92,0.12)' : 'rgba(184,52,26,0.12)', border: `1px solid ${h.score > 0 ? '#3d8b5c' : '#b8341a'}`, fontSize: 10 }}>
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
      </div>

      <footer style={{ marginTop: '2em', paddingTop: '1em', borderTop: '1px solid #000', fontSize: 13, color: '#666' }}>
        --<br />
        source: OpenSkiMap / OpenStreetMap · lexicon: ~190 ski-domain terms · 25 US resorts
      </footer>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DotShape(props) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill={DIFFICULTY_COLOR[payload.difficulty]} fillOpacity={0.7} stroke="none" />;
}

function SelectWrap({ value, onChange, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange} style={selectStyle}>
        {children}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#000' }} />
    </div>
  );
}

function Th({ label, sortKey, active, dir, onSort }) {
  const isActive = active === sortKey;
  return (
    <th onClick={() => onSort(sortKey)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}>
      {label}
      {isActive && <ArrowUpDown size={11} style={{ marginLeft: 4, opacity: 0.6, transform: dir === 'desc' ? 'rotate(180deg)' : 'none', display: 'inline-block' }} />}
    </th>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle = {
  background: '#f3f4f1',
  borderTop: '1px solid #000',
  padding: '20px 0 16px',
  marginBottom: 0,
};

const chartTitleStyle = {
  fontSize: 15,
  fontWeight: 'normal',
  marginBottom: 2,
};

const chartSubtitleStyle = {
  fontSize: 12,
  color: '#666',
  marginBottom: 16,
};

const tooltipStyle = {
  background: '#f3f4f1',
  border: '1px solid #000',
  padding: '8px 12px',
  fontFamily: 'ibm-plex-mono, monospace',
  fontSize: 13,
  maxWidth: 260,
};

const badgeStyle = {
  background: '#000',
  color: '#f3f4f1',
  padding: '3px 10px',
  fontSize: 13,
};

const btnSecondary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid #000',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#000',
  cursor: 'pointer',
};

const inputStyle = {
  padding: '5px 8px',
  border: '1px solid #000',
  background: '#f3f4f1',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#000',
  width: '100%',
};

const selectStyle = {
  padding: '5px 24px 5px 8px',
  border: '1px solid #000',
  background: '#f3f4f1',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#000',
  appearance: 'none',
  width: '100%',
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#666',
  minWidth: 140,
};

const thStyle = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 'normal',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const statsPanelStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: '#f3f4f1',
  borderTop: '1px solid #000',
  borderBottom: '1px solid #000',
  marginBottom: 24,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0,
};

function statsTileStyle() {
  return {
    padding: '10px 20px',
    borderRight: '1px solid #ccc',
    minWidth: 100,
    flex: '1 0 auto',
  };
}

const statsResultStyle = {
  padding: '10px 20px',
  borderLeft: '1px solid #000',
  minWidth: 220,
};
