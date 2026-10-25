# Explain the Model

**App:** <https://jeremytmesser-cpu.github.io/Regression_demo_comp/>

**Repository:** <https://github.com/jeremytmesser-cpu/Regression_demo_comp>

| Section | Direct link | My viewer should walk away knowing… |
|---|---|---|
| Push & Pull (linear regression) | [link](https://jeremytmesser-cpu.github.io/Regression_demo_comp/#linear) | A prediction is a starting point (the training average) plus one signed push per feature; a coefficient is the same for everyone, but a person's push is the coefficient times how far that person is from the reference. |
| Wisdom of the Forest (random forest) | [link](https://jeremytmesser-cpu.github.io/Regression_demo_comp/#forest) | A forest averages 100 different trees, each trained on a resampled set of people with random features, so the average beats any one tree; the spread of tree guesses shows disagreement, not an interval of real uncertainty. |
| One Correction at a Time (gradient boosting) | [link](https://jeremytmesser-cpu.github.io/Regression_demo_comp/#boosting) | Boosting starts from an average and adds one small, learning-rate-scaled correction per round; training error keeps falling, so validation error is used to choose when to stop. |

An app that explains three regression models to an anonymous visitor who knows about machine learning and regression, but not how these algorithms work. Datasets: NHANES fasting glucose, blood pressure and lung function. Every number comes from the supplied `outputs/` files; nothing is trained or re-estimated in the browser.

Submit the link to **this repository** on Canvas. Reviewers open the app link above.

## What's here
| File | What it is |
|---|---|
| `index.html` | Page shell, styles, navigation, dataset and person pickers |
| `app.js` | Loads data and routes to the three sections |
| `linear.js`, `forest.js`, `boosting.js` | One file per section |
| `util.js` | Formatting and SVG chart helpers |
| `m10.js` | Starter helpers (loading, linear explanation, boosting rounds) |
| `AGENT_BRIEF.md`, `SETUP.md`, `check.md` | Starter rules, publishing steps, numbers the app must show |
| `outputs/` | Reference model outputs (field guide: `outputs/SCHEMA.md`) |
| `data/` | The three datasets and the data dictionary |

## Run locally
`python -m http.server 8000`, then open <http://localhost:8000>
