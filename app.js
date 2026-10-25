// Explain the Model: three sections, one per regression model, on three NHANES datasets.
// Every number shown comes from outputs/*.json (precomputed and checked) or the helpers in m10.js.
import * as m10 from "./m10.js";
import { $, esc, fmt } from "./util.js";
import { renderLinear } from "./linear.js";
import { renderForest } from "./forest.js";
import { renderBoosting } from "./boosting.js";

const LABELS = { glucose: "Fasting glucose (from HbA1c, age, body size)", sbp: "Blood pressure (systolic)", fev1: "Lung function (FEV₁)" };
const state = { key: "glucose", person: "P1", values: null };

const section = () => {
  const s = location.hash.slice(1);
  return ["linear", "forest", "boosting"].includes(s) ? s : "linear";
};

async function setup() {
  $("dataset").innerHTML = m10.DATASETS.map((k) => `<option value="${k}">${LABELS[k]}</option>`).join("");
  $("dataset").onchange = async (e) => { state.key = e.target.value; state.person = "P1"; resetPerson(); await loadPeople(); render(); };
  $("person").onchange = (e) => { state.person = e.target.value; resetPerson(); render(); };
  window.onhashchange = () => { window.scrollTo(0, 0); render(); };
  await loadPeople();
  render();
}

// Anything tied to one person is reset when the person or dataset changes.
function resetPerson() { state.values = null; state.round = undefined; state.stop = undefined; state.lin = null; state.lr = undefined; }

async function loadPeople() {
  const b = await m10.loadBundle(state.key);
  $("person").innerHTML = b.people.map((p) => `<option value="${p.id}">${p.label}: ${esc(p.description)}</option>`).join("");
  $("person").value = state.person;
}

async function render() {
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.hash === "#" + section()));
  const b = await m10.loadBundle(state.key);
  const person = b.people.find((p) => p.id === state.person);
  $("dataline").innerHTML = `Predicting <strong>${esc(b.target_label)}</strong> (${esc(b.units)}) for people in a real national health survey (NHANES) from
    ${b.features.filter((f) => !f.name.startsWith("eth_")).map((f) => esc(f.label.replace(/\s*\(.*$/, "").toLowerCase())).join(", ")}${b.categorical_groups.some((g) => g.name === "ethnicity") ? ", race/ethnicity" : ""}.
    ${b.n_train.toLocaleString()} people train the models; ${b.n_validation.toLocaleString()} different people check them. The example people come from that second group, so no model has seen them.`;
  $("footer").innerHTML = `Data: ${esc(b.citation)} A survey sample, not the whole population; everything shown describes associations in these data, never causes.
    Models: scikit-learn ${esc(b.versions["scikit-learn"])}, fitted once on the training people; this page only displays the saved results.`;
  const ctx = { b, person, state, rerender: render };
  ({ linear: renderLinear, forest: renderForest, boosting: renderBoosting }[section()])(ctx);
}

setup();
