// Section 2: Wisdom of the Forest (random forest)
// Objective: explain how varied trees combine by averaging, and tell disagreement between trees
// apart from real uncertainty about a prediction.
import * as m10 from "./m10.js";
import { $, esc, fmt, signed, featureOf, featureName, hbars, legend, lineChart, percentile, mean, scale, niceTicks, tickText, jitter, sliderRow } from "./util.js";

const thr = (t) => (Math.abs(t) >= 100 ? t.toFixed(0) : String(+t.toFixed(2)));

function question(b, st) {
  const f = featureOf(b, st.feature), name = featureName(b, st.feature);
  if (f.binary) return { q: `${name}?`, yes: st.goes === ">" };
  return { q: `${name} ≤ ${thr(st.threshold)} ${f.units}?`, yes: st.goes === "≤" };
}

function treeCard(b, t, i, u) {
  const steps = t.steps.map((s) => question(b, s));
  const li = (x) => `<li>${esc(x.q)} <span class="${x.yes ? "yes" : "no"}">${x.yes ? "yes" : "no"}</span></li>`;
  const head = steps.slice(0, 4), rest = steps.slice(4);
  return `<div class="tree"><strong>Tree ${i + 1}</strong> asks, for this person:
    <ol>${head.map(li).join("")}</ol>
    ${rest.length ? `<details><summary>… and ${rest.length} more questions</summary><ol start="5">${rest.map(li).join("")}</ol></details>` : ""}
    <div class="leaf">Leaf reached → Tree ${i + 1} guesses ${fmt(t.leaf_value)} ${esc(u)}</div></div>`;
}

// Dot plot: one dot per tree. Dots for the trees being averaged are filled; the rest are faint.
function strip(b, person, trees, k, observed) {
  const u = b.units, N = trees.length, w = 720, h = 250, ml = 20, mr = 20, mt = 62, mb = 44;
  const all = [...trees, observed];
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const X = scale(lo, hi, ml, w - mr), cy = mt + (h - mt - mb) / 2, amp = (h - mt - mb) / 2 - 8;
  const partial = m10.runningAverage(trees, k), whole = m10.runningAverage(trees, N);
  let s = "";
  for (const t of niceTicks(lo, hi, 7)) s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${mt - 8}" y2="${h - mb}"/><text class="m" x="${X(t)}" y="${h - mb + 15}" text-anchor="middle">${tickText(t)}</text>`;
  s += `<line class="axis" x1="${ml}" x2="${w - mr}" y1="${h - mb}" y2="${h - mb}"/>`;
  // faint dots first, then the included ones on top
  trees.forEach((v, i) => { if (i >= k) s += `<circle cx="${X(v)}" cy="${cy + jitter(i) * amp}" r="4" style="fill:var(--muted);opacity:.28"/>`; });
  trees.forEach((v, i) => { if (i < k) s += `<circle cx="${X(v)}" cy="${cy + jitter(i) * amp}" r="4.6" style="fill:var(--accent);opacity:.8;stroke:var(--bg);stroke-width:1"/>`; });
  s += `<circle cx="${X(trees[0])}" cy="${cy + jitter(0) * amp}" r="8.5" style="fill:none;stroke:var(--fg);stroke-width:2"/>`;
  // reference lines with labels stacked so they cannot overlap
  s += `<line x1="${X(observed)}" x2="${X(observed)}" y1="${mt - 8}" y2="${h - mb}" style="stroke:var(--obs);stroke-width:2" stroke-dasharray="5 4"/>`;
  s += `<line x1="${X(whole)}" x2="${X(whole)}" y1="${mt - 8}" y2="${h - mb}" style="stroke:var(--fg);stroke-width:1.5" stroke-dasharray="2 3"/>`;
  s += `<line x1="${X(partial)}" x2="${X(partial)}" y1="${mt - 8}" y2="${h - mb}" style="stroke:var(--accent);stroke-width:3"/>`;
  const lab = (x, y, text, col, weight = 600) => `<text x="${Math.min(Math.max(x, 150), w - 150)}" y="${y}" text-anchor="middle" style="fill:${col};font-weight:${weight}">${esc(text)}</text>`;
  s += lab(X(partial), 14, `${k < N ? `Partial forest (first ${k} tree${k === 1 ? "" : "s"})` : `Whole forest (all ${N} trees)`}: ${fmt(partial)} ${u}`, "var(--accent)", 700);
  if (k < N) s += lab(X(whole), 30, `Whole forest (all ${N} trees): ${fmt(whole)} ${u}`, "var(--fg)");
  s += lab(X(observed), k < N ? 46 : 30, `Measured for this person: ${fmt(observed)} ${u}`, "var(--obs)");
  s += `<text x="${X(trees[0])}" y="${cy + jitter(0) * amp - 13}" text-anchor="middle" style="font-weight:700">Tree 1</text>`;
  s += `<text class="m" x="${w / 2}" y="${h - 5}" text-anchor="middle">Each dot is one tree's guess for this person (${esc(u)})</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="One dot per tree guess, with the average of the included trees marked"><title>Tree guesses and their average</title>${s}</svg>`;
}

// Middle-80% band of the tree guesses per example person versus the measured value.
function bands(b, people, selected) {
  const u = b.units, rf = b.forest, w = 720, rowH = 36, ml = 190, mr = 20, mt = 10, mb = 44, h = mt + people.length * rowH + mb;
  const info = people.map((p) => {
    const t = rf.people[p.id].tree_predictions;
    return { p, lo: percentile(t, 0.1), hi: percentile(t, 0.9), pred: rf.people[p.id].prediction, obs: p.observed };
  });
  const vals = info.flatMap((i) => [i.lo, i.hi, i.obs, i.pred]);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.05; lo -= pad; hi += pad;
  const X = scale(lo, hi, ml, w - mr);
  let s = "";
  for (const t of niceTicks(lo, hi, 6)) s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${h - mb}"/><text class="m" x="${X(t)}" y="${h - mb + 15}" text-anchor="middle">${tickText(t)}</text>`;
  info.forEach((i, r) => {
    const y = mt + r * rowH + rowH / 2;
    s += `<text x="${ml - 8}" y="${y + 4}" text-anchor="end" style="font-weight:${i.p.id === selected ? 700 : 400}">${esc(i.p.label)}</text>`;
    s += `<rect x="${X(i.lo)}" y="${y - 7}" width="${Math.max(X(i.hi) - X(i.lo), 2)}" height="14" rx="3" style="fill:var(--accent);opacity:.35"/>`;
    s += `<line x1="${X(i.pred)}" x2="${X(i.pred)}" y1="${y - 11}" y2="${y + 11}" style="stroke:var(--accent);stroke-width:3"/>`;
    s += `<circle cx="${X(i.obs)}" cy="${y}" r="6" style="fill:var(--obs);stroke:var(--bg);stroke-width:1.5"/>`;
  });
  s += `<text class="m" x="${(ml + w - mr) / 2}" y="${h - 4}" text-anchor="middle">${esc(b.target_label.replace(/\s*\(.*$/, ""))} (${esc(u)})</text>`;
  return { info, svg: `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="For each example person: the band holding the middle 80% of tree guesses, the forest prediction, and the measured value"><title>Tree disagreement band versus the measured value</title>${s}</svg>` };
}

export function renderForest(ctx) {
  const { b, person, state } = ctx;
  const u = b.units, rf = b.forest, N = rf.n_trees;
  const trees = rf.people[person.id].tree_predictions;
  const whole = rf.people[person.id].prediction;
  const uniquePct = Math.round((100 * mean(rf.bootstrap_unique_training_rows)) / rf.n_training_rows);
  const k0 = Math.min(Math.max(state.nTrees || 10, 1), N);
  const rootCounts = {};
  rf.root_split.forEach((r) => { rootCounts[r.feature] = (rootCounts[r.feature] || 0) + 1; });
  const rmseK = rf.validation_rmse_by_trees;
  const bd = bands(b, b.people, person.id);
  const insideN = bd.info.filter((i) => i.obs >= i.lo && i.obs <= i.hi).length;

  $("section").innerHTML = `
    <h2>Wisdom of the Forest: how do many different trees combine into one prediction?</h2>
    <div class="card goal"><strong>After this section you can</strong> explain how ${N} deliberately <em>different</em> trees are combined by <em>averaging</em>,
      and say why <em>disagreement between trees</em> is not the same thing as <em>real uncertainty</em> about the prediction.</div>

    <h3>1. One tree is a chain of yes/no questions</h3>
    <p>A <strong>decision tree</strong> sorts a person by asking yes/no questions about their values, one after another, until it reaches a <strong>leaf</strong>: a final box holding one number
      (the average outcome of the training people who ended up there). That number is the tree's guess.
      Here are the first five of the ${N} trees, each asked about <strong>${esc(person.label)}</strong> (${esc(person.description)}).</p>
    <div class="trees">${rf.people[person.id].traced_trees.map((t, i) => treeCard(b, t, i, u)).join("")}</div>
    <p>Same person, different questions, different guesses (${rf.people[person.id].traced_trees.map((t) => fmt(t.leaf_value)).join(", ")} ${esc(u)}).
      That is on purpose. A forest makes its trees differ in two ways:</p>
    <ul>
      <li><strong>Different training people.</strong> Each tree learns from its own random draw of the ${rf.n_training_rows} training people, drawn <em>with repeats</em> (a bootstrap sample).
        A typical tree sees about <strong>${uniquePct}%</strong> of the distinct people; some appear twice or more.</li>
      <li><strong>Different questions allowed.</strong> At every split a tree may only choose among <strong>${rf.features_tried_per_split} of the ${rf.n_features}</strong> features, picked at random each time.
        So trees do not all open with the same question: here are the first question asked by each of the ${N} trees.</li>
    </ul>
    ${hbars({ items: Object.entries(rootCounts).sort((a, c) => c[1] - a[1]).map(([f, c]) => ({ label: featureName(b, f), value: c })),
      units: "trees", digits: 0, showSign: false, color: () => "var(--accent)", labelW: 250, xLabel: `Number of the ${N} trees whose first question uses this feature`, title: "First question of each tree, by feature" })}

    <h3>2. The forest's prediction is the average of all ${N} guesses</h3>
    <p>No tree is trusted on its own. Slide to average more trees and watch the dots' average settle. If fewer than all ${N} trees are averaged, the result is a <strong>partial forest</strong>.</p>
    ${sliderRow({ id: "rf-k", label: "Trees averaged:", min: 1, max: N, value: k0, valueId: "rf-k-val" })}
    <div id="rf-results"></div>
    <details><summary>Check yourself: average three trees by hand</summary>
      <p>For ${esc(person.label)}, trees 1, 2 and 3 guess ${trees.slice(0, 3).map((t) => fmt(t)).join(", ")} ${esc(u)}. <strong>What does a partial forest of these three trees predict?</strong></p>
      <details><summary>Show the answer</summary><p class="eq">(${trees.slice(0, 3).map((t) => fmt(t)).join(" + ")}) ÷ 3 = ${fmt(m10.runningAverage(trees, 3))} ${esc(u)}</p>
      <p>Move the slider to 3 trees to see the same number above. With all ${N}, the average is ${fmt(whole)} ${esc(u)}.</p></details></details>

    <h3>3. Why averaging helps</h3>
    <p>Each tree is a little jumpy, because it was trained on a different slice of people. Averaging many jumpy-but-different trees cancels out much of that jumpiness.
      The line below shows the typical miss (RMSE, in ${esc(u)}) for <em>people the model never saw</em> (validation people) as more trees are averaged:
      one tree misses by about <strong>${fmt(rmseK[0])} ${esc(u)}</strong>; averaging all ${N} cuts that to <strong>${fmt(rmseK[N - 1])} ${esc(u)}</strong>.</p>
    <div id="rf-rmse"></div>

    <h3>4. Disagreement is not uncertainty</h3>
    <div class="callout key"><p><strong>Disagreement</strong> = how much the ${N} trees' guesses differ for one person.
      It describes the trees, and only the trees. It is <em>not</em> a confidence interval or a prediction interval.</p>
      <p><strong>Real uncertainty</strong> = how far a prediction can be from what is actually true. The forest cannot see the truth for a new person; we can only
      check it on people whose measured value we know but who were left out of training. For this forest, that typical miss (validation RMSE) is <strong>${fmt(rf.rmse.validation)} ${esc(u)}</strong>.</p></div>
    <p>Below, each row is one example person. The shaded band holds the <strong>middle 80% of the tree guesses</strong> (the disagreement), the bar is the forest's average, and the dot is the value actually measured.</p>
    ${legend([{ color: "rgba(47,111,222,.45)", text: "middle 80% of the trees' guesses" }, { color: "var(--accent)", text: "forest prediction (average of all trees)" }, { color: "var(--obs)", text: "measured value" }])}
    ${bd.svg}
    <table>
      <tr><th>Person</th><th class="num">Forest prediction</th><th class="num">Trees' middle 80%</th><th class="num">Measured</th><th class="num">Miss (measured − prediction)</th><th>Measured value inside the band?</th></tr>
      ${bd.info.map((i) => `<tr class="${i.p.id === person.id ? "sel" : ""}"><td>${esc(i.p.label)} <span class="pill">${esc(i.p.why_chosen)}</span></td>
        <td class="num">${fmt(i.pred)} ${esc(u)}</td><td class="num">${fmt(i.lo)} to ${fmt(i.hi)} ${esc(u)}</td><td class="num">${fmt(i.obs)} ${esc(u)}</td>
        <td class="num">${signed(i.obs - i.pred)} ${esc(u)}</td><td>${i.obs >= i.lo && i.obs <= i.hi ? "yes" : "no"}</td></tr>`).join("")}
    </table>
    <p>The measured value is inside the trees' band for <strong>${insideN} of ${bd.info.length}</strong> people. Narrow band, wide band: the band tells you how much the trees <em>disagree</em>,
      not where the truth lies. Trees can all lean the same wrong way because they learn from the same training people, and some outcomes simply are not predictable from these features.
      To judge how far off a prediction might be, look at errors on held-out people (the validation RMSE above), not at the spread of tree guesses.</p>
    <p class="note">A forest also cannot predict outside the range of outcomes it saw in training (here ${fmt(rf.training_target_range[0], 0)} to ${fmt(rf.training_target_range[1], 0)} ${esc(u)}),
      because an average of leaf values stays inside that range. These are associations in a survey sample, not causes.</p>`;

  // ---- the part redrawn while the slider moves ----
  const running = trees.map((_, i) => m10.runningAverage(trees, i + 1));
  const update = (k) => {
    state.nTrees = k;
    $("rf-k-val").textContent = `${k} of ${N}`;
    const avg = running[k - 1];
    $("rf-results").innerHTML = `
      ${strip(b, person, trees, k, person.observed)}
      ${legend([{ color: "var(--accent)", text: "trees being averaged" }, { color: "rgba(120,120,128,.4)", text: "trees not yet included" }])}
      <table>
        <tr><td>Tree 1 alone</td><td class="num">${fmt(trees[0])} ${esc(u)}</td></tr>
        <tr><td>${k < N ? `<strong>Partial forest</strong>: average of the first ${k} of ${N} trees` : `Average of all ${N} trees`}</td><td class="num"><strong>${fmt(avg)} ${esc(u)}</strong></td></tr>
        <tr class="total"><td>Forest prediction (average of all ${N} trees)</td><td class="num">${fmt(whole)} ${esc(u)}</td></tr>
      </table>
      ${lineChart({ xDomain: [1, N], yDomain: [Math.min(...running, person.observed) - 3, Math.max(...running, person.observed) + 3].map((v, i) => v), w: 720, h: 230,
        xLabel: "Number of trees averaged", yLabel: `Average of those trees (${u})`, title: "Running average of tree guesses",
        series: [{ values: running, x0: 1, color: "var(--accent)" }],
        hlines: [{ y: whole, color: "var(--fg)", dash: "2 3", label: `all ${N} trees: ${fmt(whole)}` }, { y: person.observed, color: "var(--obs)", label: `measured: ${fmt(person.observed)}` }],
        points: [{ x: k, y: avg, label: `${fmt(avg)}`, dy: -10 }] })}`;
    $("rf-rmse").innerHTML = lineChart({ xDomain: [1, N], yDomain: [Math.min(...rmseK) - (Math.max(...rmseK) - Math.min(...rmseK)) * 0.1, Math.max(...rmseK) + (Math.max(...rmseK) - Math.min(...rmseK)) * 0.1], w: 720, h: 240,
      xLabel: "Number of trees averaged (partial forest)", yLabel: `Validation RMSE (${u})`, title: "Validation RMSE as more trees are averaged",
      series: [{ values: rmseK, x0: 1, color: "var(--accent)" }],
      points: [{ x: k, y: rmseK[k - 1], label: `${k} tree${k === 1 ? "" : "s"}: ${fmt(rmseK[k - 1])} ${u}`, dx: k > N * 0.6 ? -8 : 8, dy: -10, anchor: k > N * 0.6 ? "end" : "start" }] });
  };
  $("rf-k").oninput = (e) => update(Number(e.target.value));
  update(k0);
}
