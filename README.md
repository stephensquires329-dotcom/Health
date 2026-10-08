# Calorie Calculator

A personal calorie/macro budget calculator with a daily food + exercise
diary and a projected weight trend, in the spirit of apps like Lose It! -
but as a single static page with no account and no backend.

## How it works

Everything runs entirely in the browser. There's no server, no API calls,
and no build step - just `index.html` / `app.js` / `style.css`. Your
profile and daily logs are saved to that browser's `localStorage` only:

- **Nothing syncs across devices or browsers.**
- **Nothing is ever sent anywhere** - there's no backend to send it to.
- Clearing site data/cookies for this page wipes your history.

## Features

- **Profile & Goals** - sex, age, height, weight (imperial or metric),
  activity level, goal (lose/maintain/gain) with a rate in lb or kg per
  week, and a macro split preset (Balanced / High protein / Low carb).
  Computes BMR (Mifflin-St Jeor equation) → TDEE (maintenance calories) →
  a daily calorie target → protein/carb/fat gram targets.
- **Daily Summary** - navigate between days (Prev/Next/Today); see food
  calories, exercise calories, net, remaining budget, and progress bars
  for calories and each macro versus your targets.
- **Food Log / Exercise Log** - manually add entries (name + calories,
  plus optional protein/carbs/fat for food). Exercise calories add back
  to your daily budget, same as Lose It!'s exercise credit. Entries are
  per-day and removable.
- **Weight Projection** - a 12-week projected trend chart with two lines:
  - **Goal** (dashed) - where your current target calories would take you
    if followed exactly, based on the deficit/surplus implied by your
    profile's rate.
  - **Actual** (solid) - where your *logged* average net calories (food
    minus exercise, over the last up to 14 days you actually logged
    something) would take you instead. Only appears once you've logged at
    least 3 days.

## The math

- **BMR** (Mifflin-St Jeor): `10 × weight(kg) + 6.25 × height(cm) - 5 × age`,
  `+5` for male, `-161` for female, `-78` (the average of the two) for
  other/prefer not to say.
- **TDEE** = BMR × activity multiplier (1.2 sedentary → 1.9 very active).
- **Daily target** = TDEE adjusted by the weekly rate you set, converting
  lb/week or kg/week to a daily calorie deficit/surplus using 3500 kcal per
  lb (or 7700 kcal per kg) of body weight.
- **Macro targets** = daily target split by your chosen preset's
  percentages, converted to grams (protein/carbs at 4 kcal/g, fat at
  9 kcal/g).
- **Weight projection** runs the same deficit/surplus math forward across
  12 weeks from your current weight.

These are standard estimation formulas for general guidance, not medical
advice - individual metabolism varies.

## Local development / hosting

No build step and no dependencies - open `index.html` directly in a
browser, or serve the folder with any static file server:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Deploys the same way as a plain static site (e.g. GitHub Pages) if you
want a stable URL instead of opening the file locally - just note that
each visitor's data stays local to their own browser, there is no shared
state between visitors.
