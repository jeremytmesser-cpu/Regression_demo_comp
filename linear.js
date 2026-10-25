// Section 1: Push & Pull (linear regression)
// Objective: rebuild a prediction from a starting point and one signed push per feature,
// and tell a coefficient (same for everyone) apart from one person's push.
import * as m10 from "./m10.js";
import { $, esc, fmt, signed, sig, signedSig, featureName, hbars, legend, sliderRow, scale, niceTicks, tickText } from "./util.js";

const STEP = { age: 1, hba1c: 0.1, bmi: 0.1, waist_cm: 0.1, income_poverty_ratio: 0.05 };
let timer = null;

// One row per thing that pushes: each numeric feature, and each category (sex, ethnicity) as a single row.
function buildRows(b) {
  const rows = [], seen = new Set(), colToGroup = {};
  for (const g of b.categorical_groups) for (const lv of g.levels) if (lv.column) colToGroup[lv.column] = g;
  for (const f of b.features) {
    const g = colToGroup[f.name];
    if (g) { if (!seen.has(g.name)) { seen.add(g.name); rows.push({ kind: "group", key: g.name, g }); } }
    else rows.push({ kind: "num", key: f.name, f });
  }
  return rows;
}
const per = (unit) => (unit === "years" ? "year" : `1 ${unit}`);
const niceVal = (v) => (Number.isInteger(v) ? String(v) : fmt(v, 1));

function rowInfo(b, row, values, ex) {
  const lin = b.linear, u = b.units;
  if (row.kind === "num") {
    const f = row.f, coef = lin.coefficients[f.name], ref = lin.reference[f.name], v = values[f.name];
    return {
      name: featureName(b, f.name), person: `${niceVal(v)} ${f.units}`, avg: `${fmt(ref, 1)} ${f.units}`,
      coefText: `${signedSig(coef)} ${u} per ${per(f.units)}`, formula: `${signedSig(coef)} × (${niceVal(v)} − ${fmt(ref, 1)})`,
      push: ex.groupedPushes[row.key],
    };
  }
  const g = row.g, cols = g.levels.filter((lv) => lv.column), cat = m10.categoryOf(b, g.name, values);
  if (cols.length === 1) {
    const lv = cols[0], coef = lin.coefficients[lv.column], ref = lin.reference[lv.column], v = values[lv.column];
    return {
      name: g.label, person: cat, avg: `${Math.round(ref * 100)}% ${lv.label.toLowerCase()}`,
      coefText: `${signedSig(coef)} ${u} for ${lv.label} vs ${g.reference}`, formula: `${signedSig(coef)} × (${v} − ${fmt(ref, 2)})`,
      push: ex.groupedPushes[row.key],
    };
  }
  return {
    name: g.label, person: cat, avg: "the training mix of groups",
    coefText: `one per group, each vs ${g.reference}`, formula: `sum of ${cols.length} group terms`,
    push: ex.groupedPushes[row.key],
  };
}

function waterfall(b, infos, baseline, k, observed) {
  const u = b.units, n = infos.length;
  const run = [baseline];
  infos.forEach((i) => run.push(run[run.length - 1] + i.push));
  const all = [...run, ...(observed != null ? [observed] : [])];
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const w = 720, labelW = 250, mr = 90, rowH = 30, mt = 26, mb = 44;
  const rowsN = n + 2, h = mt + rowsN * rowH + mb;
  const X = scale(lo, hi, labelW, w - mr);
  let s = "";
  for (const t of niceTicks(lo, hi, 6)) s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${h - mb}"/><text class="m" x="${X(t)}" y="${h - mb + 15}" text-anchor="middle">${tickText(t)}</text>`;
  if (observed != null) s += `<line x1="${X(observed)}" x2="${X(observed)}" y1="${mt - 6}" y2="${h - mb}" style="stroke:var(--obs);stroke-width:2" stroke-dasharray="5 4"/><text x="${X(observed)}" y="${mt - 10}" text-anchor="middle" style="fill:var(--obs);font-weight:600">Measured: ${fmt(observed)} ${u}</text>`;
  // Start row
  let y = mt;
  s += `<text x="${labelW - 8}" y="${y + 19}" text-anchor="end" style="font-weight:600">Starting point</text><circle cx="${X(baseline)}" cy="${y + 15}" r="6" style="fill:var(--fg)"/><text x="${X(baseline) + 10}" y="${y + 19}" style="font-weight:700">${fmt(baseline)}</text>`;
  infos.forEach((info, i) => {
    y = mt + (i + 1) * rowH;
    const shown = i < k;
    s += `<text x="${labelW - 8}" y="${y + 19}" text-anchor="end" style="opacity:${shown ? 1 : 0.4}">${esc(info.name)}</text>`;
    if (shown) {
      const a = X(run[i]), c = X(run[i + 1]), col = info.push >= 0 ? "var(--up)" : "var(--down)";
      s += `<line x1="${a}" x2="${a}" y1="${y - rowH + 15}" y2="${y + 15}" style="stroke:var(--line)"/>`;
      s += `<rect x="${Math.min(a, c)}" y="${y + 6}" width="${Math.max(Math.abs(c - a), 2)}" height="18" rx="2" style="fill:${col}"/>`;
      const right = info.push >= 0;
      s += `<text x="${right ? c + 6 : c - 6}" y="${y + 19}" text-anchor="${right ? "start" : "end"}" style="font-weight:600">${signed(info.push)}</text>`;
    }
  });
  y = mt + (n + 1) * rowH;
  const cur = run[k];
  s += `<line x1="${X(run[k])}" x2="${X(run[k])}" y1="${y - rowH + 15}" y2="${y + 15}" style="stroke:var(--line)"/>`;
  s += `<text x="${labelW - 8}" y="${y + 19}" text-anchor="end" style="font-weight:700">${k === n ? "Prediction" : `Prediction so far (${k} of ${n} pushes)`}</text><circle cx="${X(cur)}" cy="${y + 15}" r="7" style="fill:var(--accent)"/><text x="${X(cur) + 11}" y="${y + 19}" style="font-weight:700">${fmt(cur)} ${u}</text>`;
  s += `<text class="m" x="${(labelW + w - mr) / 2}" y="${h - 5}" text-anchor="middle">Predicted ${esc(b.target_label.replace(/\s*\(.*$/, "").toLowerCase())} (${esc(u)})</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Waterfall: the starting point, then each feature's push, ending at the prediction"><title>Starting point plus one push per feature equals the prediction</title>${s}</svg>`;
}

export function renderLinear(ctx) {
  const { b, person, state } = ctx;
  const u = b.units, lin = b.linear;
  const rows = buildRows(b);
  const n = rows.length;
  if (!state.values) state.values = { ...person.values };
  if (!state.lin || state.lin.key !== state.key + state.person) state.lin = { key: state.key + state.person, k: n, feature: null };
  clearInterval(timer);

  const numeric = rows.filter((r) => r.kind === "num");
  const target = b.target_label.replace(/\s*\(.*$/, "");

  $("section").innerHTML = `
    <h2>Push &amp; Pull: which features push a prediction up or down, and by how much?</h2>
    <div class="card goal"><strong>After this section you can</strong> rebuild any prediction as a <em>starting point</em> plus <em>one signed push per feature</em>,
      and say why a <em>coefficient</em> (one number for the whole model) is not the same thing as a <em>push</em> (what that coefficient does to one particular person).</div>

    <div class="card recipe">
      <strong>The whole model is this recipe:</strong>
      <p><code>prediction = starting point + push₁ + push₂ + … + pushₙ</code></p>
      <ul>
        <li><strong>Starting point</strong>: the model's prediction for a person who is exactly average (the training average) on every feature: <strong>${fmt(lin.baseline)} ${u}</strong> here.</li>
        <li><strong>A feature's coefficient</strong>: how much the prediction changes when that feature goes up by 1 unit, other features held fixed. It is learned once from the training data, so <em>everyone shares it</em>.</li>
        <li><strong>A person's push</strong> for that feature: <code>coefficient × (this person's value − the training average)</code>. Above average gives a push in the coefficient's direction; below average gives the opposite push; exactly average gives zero.</li>
      </ul>
    </div>

    <h3>1. Rebuild one person's prediction</h3>
    <p>${esc(person.label)}: <strong>${esc(person.description)}</strong>. You can edit the values below to see each push move
      (a straight-line model can be re-run for any values; the measured outcome only applies to the real person).</p>
    <div class="card"><div class="inputs" id="lin-inputs">
      ${numeric.map((r) => {
        const f = r.f, s = b.feature_stats[f.name];
        return `<label>${esc(featureName(b, f.name))} (${esc(f.units)}): <output id="out-${f.name}">${niceVal(state.values[f.name])}</output>
          <input type="range" data-f="${f.name}" min="${s.min}" max="${s.max}" step="${STEP[f.name] || 0.1}" value="${state.values[f.name]}"></label>`;
      }).join("")}
      ${b.categorical_groups.map((g) => `<label>${esc(g.label)}
        <select data-g="${g.name}">${g.levels.map((lv) => `<option ${lv.label === m10.categoryOf(b, g.name, state.values) ? "selected" : ""}>${esc(lv.label)}</option>`).join("")}</select></label>`).join("")}
    </div>
    <div class="btns"><button id="lin-reset">Reset to ${esc(person.label)}</button><span id="lin-edited" class="pill flag" hidden>edited values</span></div></div>

    ${sliderRow({ id: "lin-k", label: "Pushes added:", min: 0, max: n, value: state.lin.k, valueId: "lin-k-val" })}
    <div class="btns"><button id="lin-replay">▶ Replay from the starting point</button><span class="note">Or drag the slider: each step adds one feature's push.</span></div>
    <div id="lin-build"></div>

    <details><summary>Why does a man still get a small "sex" push, and what is the "reference group"?</summary>
      <p>Pushes are measured from the <strong>training average</strong>, and the training average is itself a mix
      (${b.categorical_groups.map((g) => { const c = g.levels.filter((l) => l.column); return c.length === 1 ? `about ${Math.round(lin.reference[c[0].column] * 100)}% ${c[0].label.toLowerCase()}` : `a mix of ${g.label.toLowerCase()} groups`; }).join("; ")}).
      So someone in the larger group sits slightly on one side of that mix and gets a small push; that is correct, not a bug.
      The <strong>reference group</strong> (${b.categorical_groups.map((g) => esc(g.reference)).join(" / ")}) is only how the yes/no columns are coded: a coefficient for, say, ${esc(b.categorical_groups[0].levels.find((l) => l.column).label)} compares that group with ${esc(b.categorical_groups[0].reference)}, holding the other features fixed.</p>
    </details>

    <details><summary>Check yourself: compute one push by hand</summary><div id="lin-check"></div></details>

    <h3>2. A coefficient is not a push</h3>
    <p>Pick a feature. The <strong>coefficient is the same for all five example people</strong>; the <strong>push differs</strong> because each person sits a different distance from the average.</p>
    <div class="controls"><label>Feature<select id="lin-feature">${rows.map((r) => `<option value="${r.key}">${esc(r.kind === "num" ? featureName(b, r.key) : r.g.label)}</option>`).join("")}</select></label></div>
    <div id="lin-compare"></div>

    <h3>3. A different question: which features matter most <em>in general</em>?</h3>
    <p>A push describes one person. To compare features across the whole dataset, use the <strong>typical effect</strong> = coefficient × one standard deviation (SD, the typical spread) of that feature.
      That puts features measured in different units on one scale (${esc(u)}). It does not depend on any one person.</p>
    ${hbars({
      items: Object.entries(lin.typical_effect_per_sd).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).map(([f, v]) => ({
        label: `${featureName(b, f)} (1 SD = ${fmt(b.feature_stats[f].train_sd, b.feature_stats[f].train_sd < 10 ? 1 : 0)} ${b.features.find((x) => x.name === f).units})`, value: v })),
      units: u, xLabel: `Typical effect of 1 SD of the feature on the prediction (${u})`, title: "Typical effect per standard deviation of each numeric feature", labelW: 300 })}
    <p class="note">${b.categorical_groups.length ? `${b.categorical_groups.map((g) => g.label).join(" and ")} ${b.categorical_groups.length > 1 ? "are categories, so they have" : "is a category, so it has"} their own push per person (above) rather than a per-SD effect.` : ""}
      These describe how the model uses each feature: associations in this survey sample, not causes.</p>

    <h3>4. Where one straight line goes wrong</h3>
    <div id="lin-fit"></div>`;

  // ---- results region (the only part redrawn while a slider moves) ----
  const update = () => {
    const ex = m10.linearExplain(b, state.values);
    const infos = rows.map((r) => rowInfo(b, r, state.values, ex));
    const k = state.lin.k;
    const edited = Object.keys(person.values).some((f) => Math.abs(person.values[f] - state.values[f]) > 1e-9);
    $("lin-edited").hidden = !edited;
    const biggest = infos.reduce((a, c) => (Math.abs(c.push) > Math.abs(a.push) ? c : a));
    $("lin-build").innerHTML = `
      ${waterfall(b, infos, ex.baseline, k, edited ? null : person.observed)}
      ${legend([{ color: "var(--up)", text: "push up (+)" }, { color: "var(--down)", text: "push down (−)" }, { color: "var(--obs)", text: "measured value of the real person" }])}
      <table>
        <tr><th>Feature</th><th>This person</th><th>Training average</th><th>Coefficient (same for everyone)</th><th class="num">Push = coefficient × (person − average)</th></tr>
        ${infos.map((i, idx) => `<tr class="${idx < k ? "" : "dim"}"><td>${esc(i.name)}</td><td>${esc(i.person)}</td><td>${esc(i.avg)}</td><td>${esc(i.coefText)}</td>
          <td class="num">${esc(i.formula)} = <strong class="${i.push >= 0 ? "up" : "down"}">${signed(i.push)} ${u}</strong></td></tr>`).join("")}
        <tr class="total"><td colspan="4">Starting point ${fmt(ex.baseline)} ${u} + ${k === n ? "all" : `the first ${k}`} push${k === 1 ? "" : "es"} (${signed(infos.slice(0, k).reduce((a, c) => a + c.push, 0))})</td>
          <td class="num">${k === n ? "Prediction" : "Prediction so far"}: ${fmt(ex.baseline + infos.slice(0, k).reduce((a, c) => a + c.push, 0))} ${u}</td></tr>
      </table>
      <p class="note">Biggest push for this person: <strong>${esc(biggest.name)}</strong> (${signed(biggest.push)} ${u}).
        That is the biggest push <em>for this person</em>; it is not necessarily the feature that matters most in general (see section 3).</p>`;
    // fit section
    const miss = person.observed - ex.prediction;
    const rmse = lin.rmse.validation;
    $("lin-fit").innerHTML = edited
      ? `<p class="note">You have edited the values, so the measured outcome no longer applies. Reset to ${esc(person.label)} to compare the line's prediction with the real measurement.</p>`
      : `<div class="callout ${Math.abs(miss) > 1.5 * rmse ? "" : "good"}">
          <p>${esc(person.label)}: measured <strong>${fmt(person.observed)} ${u}</strong>; the line predicts <strong>${fmt(ex.prediction)} ${u}</strong>; miss (measured − predicted) <strong>${signed(miss)} ${u}</strong>.
          For comparison, on people the model never saw, a typical miss (RMSE, the typical size of the error) is ${fmt(rmse)} ${u}.</p>
          ${Math.abs(miss) > 1.5 * rmse ? `<p><strong>This is a large miss, and it is the model, not a bug.</strong> ${b.id === "fev1" || state.key === "fev1"
            ? "Lungs grow through childhood and shrink in later life, a curve. One straight line in age can only slope one way, so for a child it can land far from the truth."
            : "A straight line adds up each feature separately and cannot bend or let one feature change another's effect. Some people simply don't follow a straight-line pattern."}</p>` : ""}
        </div>`;
  };

  // ---- the "coefficient vs push" table ----
  const compare = () => {
    const key = $("lin-feature").value, row = rows.find((r) => r.key === key);
    state.lin.feature = key;
    let html = "";
    if (row.kind === "num") {
      const f = row.f, coef = lin.coefficients[key], ref = lin.reference[key];
      html = `<div class="callout key"><strong>Coefficient for ${esc(featureName(b, key))}: ${signedSig(coef)} ${u} per ${esc(per(f.units))}.</strong> One number, learned once, shared by everyone.
        The training average is ${fmt(ref, 1)} ${esc(f.units)}.</div>
        <table><tr><th>Person</th><th class="num">Value</th><th class="num">Difference from average</th><th class="num">Push = ${signedSig(coef)} × difference</th></tr>
        ${b.people.map((p) => {
          const push = lin.people[p.id].grouped_pushes[key], d = p.values[key] - ref;
          return `<tr class="${p.id === person.id ? "sel" : ""}"><td>${esc(p.label)} (${esc(p.description)})</td><td class="num">${niceVal(p.values[key])} ${esc(f.units)}</td>
            <td class="num">${signed(d, 1)} ${esc(f.units)}</td><td class="num"><strong class="${push >= 0 ? "up" : "down"}">${signed(push)} ${u}</strong></td></tr>`;
        }).join("")}</table>
        <p class="note">Same coefficient in every row; different pushes. A person right at the average would get a push of 0, whatever the coefficient is.</p>`;
    } else {
      const g = row.g, cols = g.levels.filter((l) => l.column);
      html = `<div class="callout key"><strong>Coefficient${cols.length > 1 ? "s" : ""} for ${esc(g.label)}</strong> (each compares a group with ${esc(g.reference)}, other features held fixed):
        ${cols.map((l) => `${esc(l.label)} ${signedSig(lin.coefficients[l.column])} ${u}`).join("; ")}. Learned once, shared by everyone.</div>
        <table><tr><th>Person</th><th>${esc(g.label)}</th><th class="num">One push for ${esc(g.label.toLowerCase())} (measured from the training mix)</th></tr>
        ${b.people.map((p) => {
          const push = lin.people[p.id].grouped_pushes[key];
          return `<tr class="${p.id === person.id ? "sel" : ""}"><td>${esc(p.label)} (${esc(p.description)})</td><td>${esc(m10.categoryOf(b, g.name, p.values))}</td>
            <td class="num"><strong class="${push >= 0 ? "up" : "down"}">${signed(push)} ${u}</strong></td></tr>`;
        }).join("")}</table>
        <p class="note">The coefficients stay fixed; the push depends on which category the person is in and on the training mix.</p>`;
    }
    $("lin-compare").innerHTML = html;
  };

  // ---- "check yourself" uses the supplied person (not edited values) ----
  {
    const exP = m10.linearExplain(b, person.values);
    const cand = numeric.map((r) => ({ r, push: exP.groupedPushes[r.key] })).sort((a, c) => Math.abs(c.push) - Math.abs(a.push))[0];
    const f = cand.r.f, coef = lin.coefficients[f.name], ref = lin.reference[f.name], v = person.values[f.name];
    $("lin-check").innerHTML = `<p>${esc(person.label)} has ${esc(featureName(b, f.name).toLowerCase())} = ${niceVal(v)} ${esc(f.units)}. The training average is ${fmt(ref, 1)} ${esc(f.units)}
      and the coefficient is ${signedSig(coef)} ${esc(u)} per ${esc(per(f.units))}. <strong>What is this person's push for ${esc(featureName(b, f.name).toLowerCase())}?</strong></p>
      <details><summary>Show the answer</summary><p class="eq">${signedSig(coef)} × (${niceVal(v)} − ${fmt(ref, 1)}) = ${signed(cand.push)} ${esc(u)}</p>
      <p>Add it to the other pushes and the starting point (${fmt(lin.baseline)} ${esc(u)}) and you get the prediction ${fmt(exP.prediction)} ${esc(u)}.</p></details>`;
  }

  // ---- wiring ----
  const stop = () => { clearInterval(timer); };
  $("lin-k").oninput = (e) => { stop(); state.lin.k = Number(e.target.value); $("lin-k-val").textContent = `${state.lin.k} of ${n}`; update(); };
  $("lin-k-val").textContent = `${state.lin.k} of ${n}`;
  $("lin-replay").onclick = () => {
    stop(); state.lin.k = 0; $("lin-k").value = 0; $("lin-k-val").textContent = `0 of ${n}`; update();
    timer = setInterval(() => {
      if (state.lin.k >= n) return stop();
      state.lin.k += 1; $("lin-k").value = state.lin.k; $("lin-k-val").textContent = `${state.lin.k} of ${n}`; update();
    }, 900);
  };
  document.querySelectorAll("#lin-inputs [data-f]").forEach((el) => (el.oninput = () => {
    state.values[el.dataset.f] = Number(el.value); $("out-" + el.dataset.f).textContent = niceVal(Number(el.value)); update();
  }));
  document.querySelectorAll("#lin-inputs [data-g]").forEach((el) => (el.onchange = () => {
    Object.assign(state.values, m10.categoryInputs(b, el.dataset.g, el.value)); update();
  }));
  $("lin-reset").onclick = () => { state.values = { ...person.values }; ctx.rerender(); };
  $("lin-feature").onchange = compare;
  const first = numeric.map((r) => ({ key: r.key, p: Math.abs(m10.linearExplain(b, person.values).groupedPushes[r.key]) })).sort((a, c) => c.p - a.p)[0].key;
  $("lin-feature").value = rows.some((r) => r.key === state.lin.feature) ? state.lin.feature : first;
  compare();
  update();
}
