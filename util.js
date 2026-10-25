// Small helpers shared by the three sections: formatting and plain-SVG charts.
// No numbers are invented here; every number comes from outputs/*.json or m10.js.

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fmt = (v, d = 1) => Number(v).toFixed(d);
export const signed = (v, d = 1) => (Number(v) >= 0 ? "+" : "−") + Math.abs(Number(v)).toFixed(d);
// Coefficients span many magnitudes: show about 3 significant figures.
export const sig = (v) => {
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : a >= 0.1 ? v.toFixed(3) : v.toFixed(4);
};
export const signedSig = (v) => (v >= 0 ? "+" : "−") + sig(Math.abs(v));

// "HbA1c (3-month average blood sugar)" -> "HbA1c"
export const shortName = (label) => label.replace(/\s*\(.*$/, "");
export const featureOf = (b, name) => b.features.find((f) => f.name === name);
export const featureName = (b, name) => shortName((featureOf(b, name) || { label: name }).label);

export function percentile(values, p) {
  const s = [...values].sort((a, c) => a - c);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

// ---- SVG chart helpers -------------------------------------------------------
export const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

export function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}
export const tickText = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : String(+v.toPrecision(4)));

const wrapSvg = (w, h, title, inner) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${inner}</svg>`;

// General line chart. series: [{values, x0 = 0, color, width, dash}]
// vlines: [{x, color, dash, label}], hlines: [{y, color, dash, label}], points: [{x, y, color, r, label, dx, dy}]
export function lineChart({ w = 720, h = 300, ml = 62, mr = 18, mt = 18, mb = 46, xDomain, yDomain, xLabel, yLabel,
  series = [], vlines = [], hlines = [], points = [], title = "Chart" }) {
  const X = scale(xDomain[0], xDomain[1], ml, w - mr);
  const Y = scale(yDomain[0], yDomain[1], h - mb, mt);
  let s = "";
  for (const t of niceTicks(yDomain[0], yDomain[1], 5)) {
    s += `<line class="grid" x1="${ml}" x2="${w - mr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="m" x="${ml - 6}" y="${Y(t) + 4}" text-anchor="end">${tickText(t)}</text>`;
  }
  for (const t of niceTicks(xDomain[0], xDomain[1], 6)) {
    s += `<line class="axis" x1="${X(t)}" x2="${X(t)}" y1="${h - mb}" y2="${h - mb + 4}"/><text class="m" x="${X(t)}" y="${h - mb + 17}" text-anchor="middle">${tickText(t)}</text>`;
  }
  s += `<line class="axis" x1="${ml}" x2="${w - mr}" y1="${h - mb}" y2="${h - mb}"/><line class="axis" x1="${ml}" x2="${ml}" y1="${mt}" y2="${h - mb}"/>`;
  for (const hl of hlines) {
    s += `<line x1="${ml}" x2="${w - mr}" y1="${Y(hl.y)}" y2="${Y(hl.y)}" style="stroke:${hl.color || "var(--muted)"};stroke-width:1.5" stroke-dasharray="${hl.dash || "5 4"}"/>`;
    if (hl.label) s += `<text x="${w - mr - 4}" y="${Y(hl.y) - 5}" text-anchor="end" style="fill:${hl.color || "var(--muted)"}">${esc(hl.label)}</text>`;
  }
  for (const sr of series) {
    const x0 = sr.x0 || 0;
    const d = sr.values.map((v, i) => `${i ? "L" : "M"}${X(x0 + i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    s += `<path d="${d}" fill="none" style="stroke:${sr.color};stroke-width:${sr.width || 2}" ${sr.dash ? `stroke-dasharray="${sr.dash}"` : ""} stroke-linejoin="round"/>`;
  }
  for (const vl of vlines) {
    s += `<line x1="${X(vl.x)}" x2="${X(vl.x)}" y1="${mt}" y2="${h - mb}" style="stroke:${vl.color || "var(--fg)"};stroke-width:1.5" stroke-dasharray="${vl.dash || "4 3"}"/>`;
    if (vl.label) s += `<text x="${X(vl.x) + (vl.right === false ? -5 : 5)}" y="${mt + 11 + (vl.dy || 0)}" text-anchor="${vl.right === false ? "end" : "start"}" style="fill:${vl.color || "var(--fg)"}">${esc(vl.label)}</text>`;
  }
  for (const p of points) {
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 4.5}" style="fill:${p.color || "var(--accent)"};stroke:var(--bg);stroke-width:1.5"/>`;
    if (p.label) s += `<text x="${X(p.x) + (p.dx ?? 8)}" y="${Y(p.y) + (p.dy ?? -8)}" text-anchor="${p.anchor || "start"}" style="fill:${p.color || "var(--fg)"}">${esc(p.label)}</text>`;
  }
  s += `<text class="m" x="${(ml + w - mr) / 2}" y="${h - 6}" text-anchor="middle">${esc(xLabel)}</text>`;
  s += `<text class="m" transform="translate(14 ${(mt + h - mb) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  return wrapSvg(w, h, title, s);
}

// Horizontal signed bars from zero. items: [{label, value}]
export function hbars({ items, w = 720, rowH = 28, labelW = 230, units, digits = 1, xLabel, title = "Bar chart", showSign = true, color }) {
  const mt = 8, mb = 40, mr = 70;
  const h = mt + items.length * rowH + mb;
  const lo = Math.min(0, ...items.map((i) => i.value)), hi = Math.max(0, ...items.map((i) => i.value));
  const X = scale(lo, hi, labelW + (lo < 0 ? 50 : 0), w - mr);
  let s = "";
  for (const t of niceTicks(lo, hi, 5)) {
    s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${h - mb}"/><text class="m" x="${X(t)}" y="${h - mb + 15}" text-anchor="middle">${tickText(t)}</text>`;
  }
  items.forEach((it, i) => {
    const y = mt + i * rowH;
    const x0 = X(0), x1 = X(it.value);
    const col = color ? color(it) : it.value >= 0 ? "var(--up)" : "var(--down)";
    s += `<text x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(it.label)}</text>`;
    s += `<rect x="${Math.min(x0, x1)}" y="${y + 4}" width="${Math.max(Math.abs(x1 - x0), 1.5)}" height="${rowH - 8}" rx="2" style="fill:${col}"/>`;
    const txt = (showSign ? signed(it.value, digits) : fmt(it.value, digits));
    const right = it.value >= 0;
    s += `<text x="${right ? x1 + 5 : x1 - 5}" y="${y + rowH / 2 + 4}" text-anchor="${right ? "start" : "end"}" style="font-weight:600">${txt}</text>`;
  });
  s += `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="${mt}" y2="${h - mb}" style="stroke:var(--fg)"/>`;
  s += `<text class="m" x="${(labelW + w - mr) / 2}" y="${h - 4}" text-anchor="middle">${esc(xLabel || units)}</text>`;
  return wrapSvg(w, h, title, s);
}

// A deterministic wiggle in [-1, 1] so dot plots look the same on every visit.
export const jitter = (i) => Math.sin(i * 12.9898 + 4.1414) * 0.5 + Math.sin(i * 78.233) * 0.5;

export const legend = (items) =>
  `<div class="legend">${items.map((i) => `<span><span class="sw" style="background:${i.color}"></span>${i.text}</span>`).join("")}</div>`;

export function sliderRow({ id, label, min, max, value, step = 1, valueId }) {
  return `<div class="slider-row"><label class="lab" for="${id}">${label}</label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    <span class="val" id="${valueId || id + "-val"}">${value}</span></div>`;
}
