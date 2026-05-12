import { mean, variance, standardDeviation, errorFunction } from 'simple-statistics';

// Proper normal CDF using erf — no table truncation at z~4
function normalCDF(z) {
  return 0.5 * (1 + errorFunction(z / Math.SQRT2));
}

// Welch's t-test comparing two groups.
// Returns { t, df, p, cohenD, meanA, meanB, nA, nB } or null if insufficient data.
export function welchTest(groupA, groupB) {
  if (groupA.length < 2 || groupB.length < 2) return null;

  const meanA = mean(groupA);
  const meanB = mean(groupB);
  const varA  = variance(groupA);
  const varB  = variance(groupB);
  const nA = groupA.length;
  const nB = groupB.length;

  const se2A = varA / nA;
  const se2B = varB / nB;
  const se   = Math.sqrt(se2A + se2B);
  if (se === 0) return null;

  const t = (meanA - meanB) / se;

  // Welch–Satterthwaite degrees of freedom
  const df = Math.pow(se2A + se2B, 2) /
    (Math.pow(se2A, 2) / (nA - 1) + Math.pow(se2B, 2) / (nB - 1));

  // Two-tailed p-value.  For df > 30 the normal approx is tight; at
  // df > 100 (our typical case) the error is < 0.001.
  const p = 2 * (1 - normalCDF(Math.abs(t)));

  // Cohen's d with pooled SD
  const pooledSD = Math.sqrt(((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2));
  const cohenD   = pooledSD > 0 ? (meanA - meanB) / pooledSD : 0;

  return { t, df, p, cohenD, meanA, meanB, nA, nB };
}

export function formatP(p) {
  if (p === null || p === undefined || isNaN(p)) return 'n/a';
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

export function cohenLabel(d) {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}

export function stdError(values) {
  if (values.length < 2) return 0;
  return standardDeviation(values) / Math.sqrt(values.length);
}
