// Section 3: One Correction at a Time (gradient boosting)
// Objective: explain how boosting adds one small correction per round, and use validation error
// to choose when to stop.
import { $, esc, fmt, signed, lineChart, legend, scale, niceTicks, tickText, sliderRow } from "./util.js";

const ROUNDS_SHOWN = [0, 1, 2, 3, 5, 10, 25, 50, 100, 200, 500];

function corrChart(corr, zoom, round, u) {
  const w = 720, h = 230, ml = 62, mr = 18, mt = 14, mb = 44;
  const vals = corr.slice(0, zoom);
  const m = Math.max(...vals.map(Math.abs)) * 1.1 || 1;
  const X = scale(0, zoom, ml, w - mr), Y = scale(-m, m, h - mb, mt);
  const bw = Math.max(((w - mr - ml) / zoom) * 0.75, 1.2);
  let s = "";
  for (const t of niceTicks(-m, m, 4)) s += `<line class="grid" x1="${ml}" x2="${w - mr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="m" x="${ml - 6}" y="${Y(t) + 4}" text-anchor="end">${tickText(t)}</text>`;
  for (const t of niceTicks(0, zoom, 6)) s += `<text class="m" x="${X(t)}" y="${h - mb + 17}" text-anchor="middle">${tickText(t)}</text>`;
  vals.forEach((v, i) => {
    const x = X(i + 1) - bw / 2, y0 = Y(0), y1 = Y(v), sel = i + 1 === round;
    s += `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(Math.abs(y1 - y0), 0.8)}" style="fill:${v >= 0 ? "var(--up)" : "var(--down)"};opacity:${sel ? 1 : 0.55}"/>`;
  });
  if (round >= 1 && round <= zoom) s += `<line x1="${X(round)}" x2="${X(round)}" y1="${mt}" y2="${h - mb}" style="stroke:var(--fg);stroke-width:1.5" stroke-dasharray="4 3"/>`;
  s += `<line class="axis" x1="${ml}" x2="${w - mr}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--fg)"/>`;
  s += `<text class="m" x="${(ml + w - mr) / 2}" y="${h - 6}" text-anchor="middle">Round (tree number)</text>`;
  s += `<text class="m" transform="translate(14 ${(mt + h - mb) / 2}) rotate(-90)" text-anchor="middle">Correction added (${esc(u)})</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="The correction this person receives from each round"><title>Correction added by each round</title>${s}</svg>`;
}

function residualScatter(b, snap, idx, u) {
  const rs = b.boosting.residual_snapshots, rounds = rs.rounds;
  const allPred = rounds.flatMap((r) => rs.predictions[String(r)]);
  const allRes = rounds.flatMap((r) => rs.predictions[String(r)].map((p, i) => rs.observed[i] - p));
  const xLo = Math.min(...allPred), xHi = Math.max(...allPred), yM = Math.max(...allRes.map(Math.abs)) * 1.05;
  const w = 720, h = 300, ml = 62, mr = 18, mt = 14, mb = 46;
  const X = scale(xLo - (xHi - xLo) * 0.03, xHi + (xHi - xLo) * 0.03, ml, w - mr), Y = scale(-yM, yM, h - mb, mt);
  const r = rounds[idx], pred = rs.predictions[String(r)];
  let s = "";
  for (const t of niceTicks(-yM, yM, 5)) s += `<line class="grid" x1="${ml}" x2="${w - mr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="m" x="${ml - 6}" y="${Y(t) + 4}" text-anchor="end">${tickText(t)}</text>`;
  for (const t of niceTicks(xLo, xHi, 6)) s += `<text class="m" x="${X(t)}" y="${h - mb + 17}" text-anchor="middle">${tickText(t)}</text>`;
  s += `<line x1="${ml}" x2="${w - mr}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--fg);stroke-width:1.5"/>`;
  pred.forEach((p, i) => { s += `<circle cx="${X(p)}" cy="${Y(rs.observed[i] - p)}" r="3.4" style="fill:var(--accent);opacity:.55"/>`; });
  s += `<text x="${w - mr - 4}" y="${Y(0) - 6}" text-anchor="end" style="font-weight:600">no leftover error</text>`;
  s += `<text class="m" x="${(ml + w - mr) / 2}" y="${h - 6}" text-anchor="middle">Prediction after round ${r} (${esc(u)})</text>`;
  s += `<text class="m" transform="translate(14 ${(mt + h - mb) / 2}) rotate(-90)" text-anchor="middle">Leftover error: measured − prediction (${esc(u)})</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Leftover error of 200 training people after round ${r}"><title>Residuals after round ${r}</title>${s}</svg>`;
}

export function renderBoosting(ctx) {
  const { b, person, state } = ctx;
  const u = b.units, gb = b.boosting, p = gb.people[person.id], M = p.corrections.length, cmp = gb.comparison_learning_rate_0_02;
  const target = b.target_label.replace(/\s*\(.*$/, "");
  if (!state.zoom) state.zoom = 100;
  const zoom = state.zoom;
  const round = Math.min(state.round ?? 1, zoom);
  const lr = state.lr || "0.1";
  const model = lr === "0.1" ? { rmse: gb.rmse, best: gb.best_validation_round, bestRmse: gb.best_validation_rmse, staged: p.staged }
    : { rmse: cmp.rmse, best: cmp.best_validation_round, bestRmse: cmp.best_validation_rmse, staged: cmp.people[person.id].staged };
  const stop0 = Math.min(state.stop ?? model.best, zoom);
  const snaps = gb.residual_snapshots.rounds;
  const snapIdx = Math.min(state.snap ?? 1, snaps.length - 1);

  $("section").innerHTML = `
    <h2>One Correction at a Time: how does each new tree improve the model, and when should it stop?</h2>
    <div class="card goal"><strong>After this section you can</strong> explain how gradient boosting builds a prediction from many small corrections, one per round,
      and use <em>validation error</em> to pick the round at which to stop.</div>

    <div class="card recipe">
      <strong>The recipe</strong>
      <ol>
        <li><strong>Round 0:</strong> everyone gets the same prediction, the average outcome of the training people: <strong>${fmt(gb.init)} ${esc(u)}</strong>.</li>
        <li><strong>Each round:</strong>
          (a) for every <em>training</em> person, work out the <strong>leftover error</strong> (also called the residual): measured value − current prediction;
          (b) fit one small tree (at most ${gb.settings.max_depth} questions deep) whose job is to predict those leftover errors;
          (c) add that tree's output, <strong>scaled down by the learning rate ${gb.learning_rate}</strong>, to every prediction.</li>
        <li><strong>Repeat</strong> ${M} times. The final prediction is the starting average plus all ${M} small corrections.</li>
      </ol>
      <p class="note">The corrections shown below already include the learning rate. Scaling them down means no single tree can overreact; many small steps get there more safely.</p>
    </div>

    <div class="controls"><label>Rounds shown in the charts
      <select id="gb-zoom"><option value="30">first 30 rounds</option><option value="100">first 100 rounds</option><option value="500">all 500 rounds</option></select></label></div>

    <h3>1. Watch one prediction change, round by round</h3>
    <p>${esc(person.label)} (${esc(person.description)}), measured <strong>${fmt(person.observed)} ${esc(u)}</strong>. This person was left out of training, so the trees never saw this measured value;
      each correction was learned from the <em>training</em> people's leftover errors and is then applied to this person.</p>
    ${sliderRow({ id: "gb-round", label: "Round:", min: 0, max: zoom, value: round, valueId: "gb-round-val" })}
    <div id="gb-step"></div>
    <details><summary>Check yourself: add one correction by hand</summary><div id="gb-check"></div></details>

    <h3>2. What each new tree is fitted to: the leftover errors</h3>
    <p>Each dot is one of 200 training people. The vertical position is their <strong>leftover error</strong> after the chosen round (measured − prediction). The next tree is fitted to exactly these gaps,
      so its correction pushes predictions where the dots sit above the line up, and where they sit below it down. Slide through the rounds and watch the gaps shrink.</p>
    ${sliderRow({ id: "gb-snap", label: "After round:", min: 0, max: snaps.length - 1, value: snapIdx, valueId: "gb-snap-val" })}
    <div id="gb-resid"></div>

    <h3>3. When to stop: use validation error, not training error</h3>
    <p><strong>Training error</strong> measures the miss on the people the trees learned from, so it can keep falling by memorising quirks. <strong>Validation error</strong> measures the miss on held-out people
      (${b.n_validation} of them) that were not used to fit any tree. RMSE is the typical size of the miss, in ${esc(u)}.</p>
    <div class="btns"><span>Learning rate:</span>
      <button id="gb-lr-0.1" class="${lr === "0.1" ? "on" : ""}">0.1 (main model)</button>
      <button id="gb-lr-0.02" class="${lr === "0.02" ? "on" : ""}">0.02 (smaller steps)</button></div>
    ${sliderRow({ id: "gb-stop", label: "Stop after round:", min: 0, max: zoom, value: stop0, valueId: "gb-stop-val" })}
    <div id="gb-stopper"></div>
    <p class="note">The best round is chosen using the validation data, so the validation error at that round is slightly flattering. It is a validation-based choice, not an independent test result.
      These are associations in a survey sample, not causes.</p>`;

  $("gb-zoom").value = String(zoom);
  $("gb-zoom").onchange = (e) => {
    state.zoom = Number(e.target.value); ctx.rerender();
  };

  // ---- step 1 ----
  const step = (k) => {
    state.round = k;
    $("gb-round-val").textContent = `${k}`;
    const before = k === 0 ? null : p.staged[k - 1], after = p.staged[k], c = k === 0 ? null : p.corrections[k - 1];
    $("gb-step").innerHTML = `
      <table>
        ${k === 0
          ? `<tr class="total"><td>Round 0: the training average, the same for everyone</td><td class="num">${fmt(gb.init)} ${esc(u)}</td></tr>`
          : `<tr><td>Prediction after round ${k - 1}${k === 1 ? " (the training average)" : ""}</td><td class="num">${fmt(before)} ${esc(u)}</td></tr>
             <tr><td>Correction added by tree ${k}</td><td class="num"><strong class="${c >= 0 ? "up" : "down"}">${signed(c, 2)} ${esc(u)}</strong></td></tr>
             <tr class="total"><td>Prediction after round ${k}</td><td class="num">${fmt(after)} ${esc(u)}</td></tr>`}
        <tr><td>Measured value for this person</td><td class="num">${fmt(person.observed)} ${esc(u)}</td></tr>
        <tr><td>Gap still left (measured − prediction)</td><td class="num">${signed(person.observed - after)} ${esc(u)}</td></tr>
      </table>
      ${lineChart({ xDomain: [0, zoom], yDomain: (() => { const v = [...p.staged.slice(0, zoom + 1), person.observed]; const a = Math.min(...v), z = Math.max(...v), pd = (z - a) * 0.1 || 1; return [a - pd, z + pd]; })(),
        xLabel: "Round", yLabel: `Prediction (${u})`, title: "Prediction for this person after each round",
        series: [{ values: p.staged.slice(0, zoom + 1), color: "var(--accent)" }],
        hlines: [{ y: person.observed, color: "var(--obs)", label: `measured: ${fmt(person.observed)} ${u}` }],
        vlines: [{ x: k, color: "var(--fg)" }],
        points: [{ x: k, y: after, label: `${fmt(after)}`, dx: k > zoom * 0.7 ? -8 : 8, anchor: k > zoom * 0.7 ? "end" : "start", dy: -10 }] })}
      ${legend([{ color: "var(--accent)", text: "prediction after each round" }, { color: "var(--obs)", text: "measured value" }])}
      <p>Each round's correction (bars below: orange raises the prediction, blue lowers it). Early corrections are larger; later ones are small and can point either way as the trees chase what is left.</p>
      ${corrChart(p.corrections, zoom, k, u)}
      <table><tr><th>Round</th>${ROUNDS_SHOWN.map((r) => `<th class="num">${r}</th>`).join("")}</tr>
        <tr><td>Prediction (${esc(u)})</td>${ROUNDS_SHOWN.map((r) => `<td class="num">${fmt(p.staged[r])}</td>`).join("")}</tr></table>`;
  };
  $("gb-round").oninput = (e) => step(Number(e.target.value));

  // ---- check yourself ----
  {
    const r = 3, a = p.staged[r - 1], c = p.corrections[r - 1];
    $("gb-check").innerHTML = `<p>For ${esc(person.label)}, the prediction after round ${r - 1} is ${fmt(a)} ${esc(u)} and tree ${r} adds a correction of ${signed(c, 2)} ${esc(u)}. <strong>What is the prediction after round ${r}?</strong></p>
      <details><summary>Show the answer</summary><p class="eq">${fmt(a)} ${c >= 0 ? "+" : "−"} ${Math.abs(c).toFixed(2)} = ${fmt(p.staged[r])} ${esc(u)}</p>
      <p>No extra scaling is needed: the correction already includes the learning rate. Move the round slider to ${r} to see the same numbers.</p></details>`;
  }

  // ---- step 2 ----
  const resid = (i) => {
    state.snap = i;
    const r = snaps[i];
    $("gb-snap-val").textContent = `${r}`;
    $("gb-resid").innerHTML = `${residualScatter(b, gb.residual_snapshots, i, u)}
      <p>After round ${r}: training RMSE <strong>${fmt(gb.rmse.train[r])} ${esc(u)}</strong>${r === 0 ? " (everyone predicted with the same average, so the dots sit in one vertical column)" : ""}.
        ${r < M ? `Tree ${r + 1} will be fitted to these leftover errors.` : "This is after the last tree."}</p>`;
  };
  $("gb-snap").oninput = (e) => resid(Number(e.target.value));

  // ---- step 3 ----
  const stopper = (k) => {
    state.stop = k;
    $("gb-stop-val").textContent = `${k}`;
    const { rmse, best, bestRmse, staged } = model;
    const tr = rmse.train, va = rmse.validation;
    const win = (a) => a.slice(0, zoom + 1);
    const lo = Math.min(...win(tr), ...win(va)), hi = Math.max(...win(tr), ...win(va)), pd = (hi - lo) * 0.06 || 1;
    let verdict;
    if (k < best) verdict = `<div class="callout"><strong>Too early.</strong> Validation error is still falling here. Stopping at round ${k} leaves it at ${fmt(va[k])} ${esc(u)}, higher than the ${fmt(bestRmse)} ${esc(u)} it reaches at round ${best}.</div>`;
    else if (k === best) verdict = `<div class="callout good"><strong>Lowest validation error: ${fmt(bestRmse)} ${esc(u)} at round ${best}.</strong> This is the stopping point the validation data picks.</div>`;
    else verdict = `<div class="callout"><strong>Too late.</strong> Validation error at round ${k} is ${fmt(va[k])} ${esc(u)}, <strong>${fmt(va[k] - bestRmse)} ${esc(u)} above</strong> its lowest (${fmt(bestRmse)} ${esc(u)} at round ${best}),
      while training error keeps ${tr[k] < tr[best] ? "falling" : "changing"} (${fmt(tr[best])} → ${fmt(tr[k])} ${esc(u)}). The extra trees are fitting quirks of the training people that do not carry over to new people.</div>`;
    $("gb-stopper").innerHTML = `
      ${lineChart({ xDomain: [0, zoom], yDomain: [lo - pd, hi + pd], xLabel: "Round (number of trees added)", yLabel: `RMSE: typical miss (${u})`, title: `Training and validation error by round, learning rate ${lr}`,
        series: [{ values: win(tr), color: "var(--muted)" }, { values: win(va), color: "var(--accent)", width: 2.5 }],
        vlines: [{ x: k, color: "var(--fg)", label: `stop at ${k}`, right: k < zoom * 0.8 }],
        points: best <= zoom ? [{ x: best, y: bestRmse, color: "var(--good)", r: 6, label: `lowest validation: ${fmt(bestRmse)} at round ${best}`, dx: best > zoom * 0.6 ? -10 : 10, anchor: best > zoom * 0.6 ? "end" : "start", dy: -12 }] : [] })}
      ${legend([{ color: "var(--muted)", text: "training error (people the trees learned from)" }, { color: "var(--accent)", text: "validation error (held-out people)" }, { color: "var(--good)", text: "lowest validation error" }])}
      <table>
        <tr><th></th><th class="num">Training RMSE</th><th class="num">Validation RMSE</th></tr>
        <tr><td>If you stop after round ${k}</td><td class="num">${fmt(tr[k])} ${esc(u)}</td><td class="num"><strong>${fmt(va[k])} ${esc(u)}</strong></td></tr>
        <tr><td>Lowest validation error (round ${best})</td><td class="num">${fmt(tr[best])} ${esc(u)}</td><td class="num">${fmt(bestRmse)} ${esc(u)}</td></tr>
        <tr><td>After all ${M} rounds</td><td class="num">${fmt(tr[M])} ${esc(u)}</td><td class="num">${fmt(va[M])} ${esc(u)}</td></tr>
      </table>
      ${verdict}
      <p>${esc(person.label)}'s prediction if you stop after round ${k}: <strong>${fmt(staged[k])} ${esc(u)}</strong> (measured ${fmt(person.observed)} ${esc(u)}).</p>
      ${lr === "0.02" ? `<p class="note">With learning rate 0.02 each correction is smaller, so it takes more rounds to get as far (this is a separately fitted model, not the 0.1 model rescaled). Its best round is ${best}.</p>` : ""}`;
  };
  $("gb-stop").oninput = (e) => stopper(Number(e.target.value));
  for (const v of ["0.1", "0.02"]) $(`gb-lr-${v}`).onclick = () => {
    state.lr = v;
    const best = v === "0.1" ? gb.best_validation_round : cmp.best_validation_round;
    state.stop = best; if (best > state.zoom) state.zoom = 500;
    ctx.rerender();
  };

  step(round); resid(snapIdx); stopper(stop0);
}
