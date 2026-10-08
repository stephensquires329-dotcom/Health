(function () {
  "use strict";

  const PROFILE_KEY = "calorieCalc_profile_v1";
  const LOGS_KEY = "calorieCalc_logs_v1";
  const KCAL_PER_LB = 3500;
  const KCAL_PER_KG = 7700;
  const LB_PER_KG = 2.2046226218;

  const MACRO_PRESETS = {
    balanced: { protein: 0.30, carbs: 0.40, fat: 0.30 },
    "high-protein": { protein: 0.35, carbs: 0.35, fat: 0.30 },
    "low-carb": { protein: 0.30, carbs: 0.20, fat: 0.50 }
  };

  const state = {
    profile: null,
    logs: {},
    selectedDate: todayStr(),
    profileExpanded: true
  };

  let els = {};

  document.addEventListener("DOMContentLoaded", init);

  // ---------- date helpers (local calendar day, not UTC) ----------

  function todayStr() {
    return dateToStr(new Date());
  }

  function dateToStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function strToDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDaysToStr(s, n) {
    const d = strToDate(s);
    d.setDate(d.getDate() + n);
    return dateToStr(d);
  }

  function formatDayLabel(s) {
    const d = strToDate(s);
    const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return s === todayStr() ? label + " (Today)" : label;
  }

  // ---------- unit helpers ----------

  function lbToKg(lb) { return lb / LB_PER_KG; }
  function kgToLb(kg) { return kg * LB_PER_KG; }
  function ftInToCm(ft, inch) { return ((ft || 0) * 12 + (inch || 0)) * 2.54; }
  function cmToFtIn(cm) {
    const totalIn = cm / 2.54;
    let ft = Math.floor(totalIn / 12);
    let inch = Math.round(totalIn - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return { ft, inch };
  }

  // ---------- persistence ----------

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) - profile just won't persist
    }
  }

  function loadLogs() {
    try {
      const raw = localStorage.getItem(LOGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLogs(logs) {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      // see saveProfile()
    }
  }

  function getDayLog(dateStr) {
    const day = state.logs[dateStr];
    return {
      food: (day && day.food) || [],
      exercise: (day && day.exercise) || []
    };
  }

  function ensureDayLog(dateStr) {
    if (!state.logs[dateStr]) state.logs[dateStr] = { food: [], exercise: [] };
    return state.logs[dateStr];
  }

  // ---------- calorie / macro math ----------

  function computeBMR(profile) {
    const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
    if (profile.sex === "male") return base + 5;
    if (profile.sex === "female") return base - 161;
    return base - 78; // average of the male/female constants
  }

  function computeTargets(profile) {
    const bmr = computeBMR(profile);
    const tdee = bmr * profile.activityMultiplier;
    const kcalPerUnit = profile.units === "imperial" ? KCAL_PER_LB : KCAL_PER_KG;
    let deficitPerDay = 0;
    if (profile.goal === "lose") deficitPerDay = -(profile.rate * kcalPerUnit) / 7;
    else if (profile.goal === "gain") deficitPerDay = (profile.rate * kcalPerUnit) / 7;
    const dailyTarget = Math.max(tdee + deficitPerDay, 0);
    return { bmr, tdee, dailyTarget, deficitPerDay };
  }

  function computeMacroGrams(dailyTarget, presetKey) {
    const preset = MACRO_PRESETS[presetKey] || MACRO_PRESETS.balanced;
    return {
      protein: (dailyTarget * preset.protein) / 4,
      carbs: (dailyTarget * preset.carbs) / 4,
      fat: (dailyTarget * preset.fat) / 9
    };
  }

  function round(n, places) {
    const f = Math.pow(10, places || 0);
    return Math.round(n * f) / f;
  }

  // ---------- init ----------

  function init() {
    els = {
      profileToggle: document.getElementById("profile-toggle"),
      profileCollapse: document.getElementById("profile-collapse"),
      profileBody: document.getElementById("profile-body"),
      profileForm: document.getElementById("profile-form"),
      profileSummary: document.getElementById("profile-summary"),
      units: document.getElementById("f-units"),
      sex: document.getElementById("f-sex"),
      age: document.getElementById("f-age"),
      heightFt: document.getElementById("f-height-ft"),
      heightIn: document.getElementById("f-height-in"),
      heightCm: document.getElementById("f-height-cm"),
      heightImperialWrap: document.getElementById("f-height-imperial-wrap"),
      heightMetricWrap: document.getElementById("f-height-metric-wrap"),
      weightLb: document.getElementById("f-weight-lb"),
      weightKg: document.getElementById("f-weight-kg"),
      weightImperialWrap: document.getElementById("f-weight-imperial-wrap"),
      weightMetricWrap: document.getElementById("f-weight-metric-wrap"),
      activity: document.getElementById("f-activity"),
      goal: document.getElementById("f-goal"),
      rate: document.getElementById("f-rate"),
      rateLabel: document.getElementById("f-rate-label"),
      rateWrap: document.getElementById("f-rate-wrap"),
      macroPreset: document.getElementById("f-macro-preset"),
      dayPrev: document.getElementById("day-prev"),
      dayNext: document.getElementById("day-next"),
      dayToday: document.getElementById("day-today"),
      dayLabel: document.getElementById("day-label"),
      summaryRoot: document.getElementById("summary-root"),
      foodForm: document.getElementById("food-form"),
      foodList: document.getElementById("food-list"),
      exerciseForm: document.getElementById("exercise-form"),
      exerciseList: document.getElementById("exercise-list"),
      projectionRoot: document.getElementById("projection-root")
    };

    state.profile = loadProfile();
    state.logs = loadLogs();
    state.profileExpanded = !state.profile;

    wireControls();
    populateFormFromProfile();
    updateUnitVisibility();
    updateRateVisibility();
    applyProfileExpanded();
    renderAll();
  }

  function wireControls() {
    els.profileToggle.addEventListener("click", () => {
      state.profileExpanded = !state.profileExpanded;
      applyProfileExpanded();
    });
    els.profileCollapse.addEventListener("click", () => {
      state.profileExpanded = !state.profileExpanded;
      applyProfileExpanded();
    });
    els.units.addEventListener("change", () => {
      convertDisplayedUnits();
      updateUnitVisibility();
      updateRateVisibility();
    });
    els.goal.addEventListener("change", updateRateVisibility);

    els.profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveProfileFromForm();
    });

    els.dayPrev.addEventListener("click", () => {
      state.selectedDate = addDaysToStr(state.selectedDate, -1);
      renderDay();
    });
    els.dayNext.addEventListener("click", () => {
      state.selectedDate = addDaysToStr(state.selectedDate, 1);
      renderDay();
    });
    els.dayToday.addEventListener("click", () => {
      state.selectedDate = todayStr();
      renderDay();
    });

    els.foodForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("food-name").value.trim();
      const calories = Number(document.getElementById("food-calories").value);
      if (!name || !Number.isFinite(calories)) return;
      const entry = {
        id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
        name,
        calories,
        protein: Number(document.getElementById("food-protein").value) || 0,
        carbs: Number(document.getElementById("food-carbs").value) || 0,
        fat: Number(document.getElementById("food-fat").value) || 0
      };
      ensureDayLog(state.selectedDate).food.push(entry);
      saveLogs(state.logs);
      els.foodForm.reset();
      renderDay();
      renderProjection();
    });

    els.exerciseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("exercise-name").value.trim();
      const calories = Number(document.getElementById("exercise-calories").value);
      if (!name || !Number.isFinite(calories)) return;
      const entry = { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), name, calories };
      ensureDayLog(state.selectedDate).exercise.push(entry);
      saveLogs(state.logs);
      els.exerciseForm.reset();
      renderDay();
      renderProjection();
    });

    els.foodList.addEventListener("click", (e) => {
      const btn = e.target.closest(".entry-remove-btn");
      if (!btn) return;
      const day = ensureDayLog(state.selectedDate);
      day.food = day.food.filter((f) => f.id !== btn.dataset.id);
      saveLogs(state.logs);
      renderDay();
      renderProjection();
    });

    els.exerciseList.addEventListener("click", (e) => {
      const btn = e.target.closest(".entry-remove-btn");
      if (!btn) return;
      const day = ensureDayLog(state.selectedDate);
      day.exercise = day.exercise.filter((x) => x.id !== btn.dataset.id);
      saveLogs(state.logs);
      renderDay();
      renderProjection();
    });
  }

  function applyProfileExpanded() {
    els.profileBody.classList.toggle("collapsed", !state.profileExpanded);
    els.profileCollapse.textContent = state.profileExpanded ? "Hide" : "Show";
    els.profileCollapse.setAttribute("aria-expanded", String(state.profileExpanded));
  }

  // ---------- profile form <-> state ----------

  function populateFormFromProfile() {
    const p = state.profile;
    const units = (p && p.units) || "imperial";
    els.units.value = units;
    els.sex.value = (p && p.sex) || "male";
    els.age.value = p ? p.age : "";
    els.activity.value = p ? String(p.activityMultiplier) : "1.55";
    els.goal.value = (p && p.goal) || "lose";
    els.rate.value = p ? p.rate : 1;
    els.macroPreset.value = (p && p.macroPreset) || "balanced";

    if (p) {
      if (units === "imperial") {
        const { ft, inch } = cmToFtIn(p.heightCm);
        els.heightFt.value = ft;
        els.heightIn.value = inch;
        els.weightLb.value = round(kgToLb(p.weightKg), 1);
      } else {
        els.heightCm.value = round(p.heightCm, 1);
        els.weightKg.value = round(p.weightKg, 1);
      }
    }
  }

  // When the units toggle changes, convert whatever is currently typed in the
  // form instead of clearing it, so switching units doesn't lose input.
  function convertDisplayedUnits() {
    const toMetric = els.units.value === "metric";
    if (toMetric) {
      const ft = Number(els.heightFt.value);
      const inch = Number(els.heightIn.value);
      if (els.heightFt.value || els.heightIn.value) {
        els.heightCm.value = round(ftInToCm(ft, inch), 1);
      }
      if (els.weightLb.value) {
        els.weightKg.value = round(lbToKg(Number(els.weightLb.value)), 1);
      }
    } else {
      if (els.heightCm.value) {
        const { ft, inch } = cmToFtIn(Number(els.heightCm.value));
        els.heightFt.value = ft;
        els.heightIn.value = inch;
      }
      if (els.weightKg.value) {
        els.weightLb.value = round(kgToLb(Number(els.weightKg.value)), 1);
      }
    }
  }

  function updateUnitVisibility() {
    const imperial = els.units.value === "imperial";
    els.heightImperialWrap.hidden = !imperial;
    els.heightMetricWrap.hidden = imperial;
    els.weightImperialWrap.hidden = !imperial;
    els.weightMetricWrap.hidden = imperial;
    els.rateLabel.textContent = "Rate (" + (imperial ? "lb" : "kg") + "/week)";
  }

  function updateRateVisibility() {
    els.rateWrap.style.display = els.goal.value === "maintain" ? "none" : "";
  }

  function saveProfileFromForm() {
    const units = els.units.value;
    const heightCm = units === "imperial"
      ? ftInToCm(Number(els.heightFt.value), Number(els.heightIn.value))
      : Number(els.heightCm.value);
    const weightKg = units === "imperial"
      ? lbToKg(Number(els.weightLb.value))
      : Number(els.weightKg.value);

    if (!heightCm || !weightKg || !els.age.value) {
      els.profileSummary.textContent = "Please fill in age, height, and weight.";
      return;
    }

    state.profile = {
      units,
      sex: els.sex.value,
      age: Number(els.age.value),
      heightCm,
      weightKg,
      activityMultiplier: Number(els.activity.value),
      goal: els.goal.value,
      rate: els.goal.value === "maintain" ? 0 : Number(els.rate.value) || 0,
      macroPreset: els.macroPreset.value
    };
    saveProfile(state.profile);
    state.profileExpanded = false;
    applyProfileExpanded();
    renderAll();
  }

  // ---------- rendering ----------

  function renderAll() {
    renderProfileSummary();
    renderDay();
    renderProjection();
  }

  function renderProfileSummary() {
    const p = state.profile;
    if (!p) {
      els.profileSummary.textContent = "Fill in your profile and save to see your daily calorie and macro targets.";
      return;
    }
    const { bmr, tdee, dailyTarget } = computeTargets(p);
    const macros = computeMacroGrams(dailyTarget, p.macroPreset);
    const goalWord = p.goal === "lose" ? "losing" : p.goal === "gain" ? "gaining" : "maintaining";
    const rateText = p.goal === "maintain" ? "" : " at " + p.rate + " " + (p.units === "imperial" ? "lb" : "kg") + "/week";

    els.profileSummary.innerHTML =
      "<div>Maintenance (TDEE): <strong>" + Math.round(tdee) + " kcal/day</strong>. " +
      "Goal: " + goalWord + rateText + " &rarr; daily target <strong>" + Math.round(dailyTarget) + " kcal/day</strong>.</div>" +
      "<div class='summary-grid'>" +
      "<div class='summary-stat'><strong>" + Math.round(bmr) + "</strong>BMR (kcal)</div>" +
      "<div class='summary-stat'><strong>" + Math.round(tdee) + "</strong>Maintenance (kcal)</div>" +
      "<div class='summary-stat'><strong>" + Math.round(dailyTarget) + "</strong>Daily target (kcal)</div>" +
      "<div class='summary-stat'><strong>" + Math.round(macros.protein) + "g</strong>Protein target</div>" +
      "<div class='summary-stat'><strong>" + Math.round(macros.carbs) + "g</strong>Carbs target</div>" +
      "<div class='summary-stat'><strong>" + Math.round(macros.fat) + "g</strong>Fat target</div>" +
      "</div>";
  }

  function renderDay() {
    els.dayLabel.textContent = formatDayLabel(state.selectedDate);
    renderSummaryCards();
    renderEntryList(els.foodList, getDayLog(state.selectedDate).food, (f) =>
      [f.calories + " kcal", f.protein ? f.protein + "g P" : "", f.carbs ? f.carbs + "g C" : "", f.fat ? f.fat + "g F" : ""]
        .filter(Boolean).join(" • ")
    );
    renderEntryList(els.exerciseList, getDayLog(state.selectedDate).exercise, (x) => x.calories + " kcal burned");
  }

  function renderEntryList(container, entries, detailFn) {
    if (!entries.length) {
      container.innerHTML = "<p class='status-message'>No entries yet.</p>";
      return;
    }
    container.innerHTML = entries
      .map(
        (e) =>
          "<div class='entry-row'><div><span class='entry-name'>" + escapeHtml(e.name) +
          "</span><div class='entry-detail'>" + escapeHtml(detailFn(e)) + "</div></div>" +
          "<button type='button' class='entry-remove-btn' data-id='" + escapeAttr(e.id) + "' title='Remove'>&#10005;</button></div>"
      )
      .join("");
  }

  function renderSummaryCards() {
    const day = getDayLog(state.selectedDate);
    const foodCals = day.food.reduce((s, f) => s + f.calories, 0);
    const exerciseCals = day.exercise.reduce((s, x) => s + x.calories, 0);
    const netCals = foodCals - exerciseCals;
    const protein = day.food.reduce((s, f) => s + (f.protein || 0), 0);
    const carbs = day.food.reduce((s, f) => s + (f.carbs || 0), 0);
    const fat = day.food.reduce((s, f) => s + (f.fat || 0), 0);

    const p = state.profile;
    const dailyTarget = p ? computeTargets(p).dailyTarget : null;
    const remaining = dailyTarget !== null ? dailyTarget - netCals : null;
    const macroTargets = p ? computeMacroGrams(dailyTarget, p.macroPreset) : null;

    let html = "<div class='summary-cards'>" +
      "<div class='summary-card'><div class='label'>Food</div><div class='value'>" + Math.round(foodCals) + "</div></div>" +
      "<div class='summary-card'><div class='label'>Exercise</div><div class='value'>" + Math.round(exerciseCals) + "</div></div>" +
      "<div class='summary-card'><div class='label'>Net</div><div class='value'>" + Math.round(netCals) + "</div></div>";

    if (dailyTarget !== null) {
      html += "<div class='summary-card'><div class='label'>Budget</div><div class='value'>" + Math.round(dailyTarget) + "</div></div>" +
        "<div class='summary-card " + (remaining >= 0 ? "remaining-good" : "remaining-over") + "'><div class='label'>Remaining</div><div class='value'>" + Math.round(remaining) + "</div></div>";
    }
    html += "</div>";

    if (dailyTarget !== null) {
      const pct = Math.min((netCals / dailyTarget) * 100, 100);
      html += barGroup("Calories", Math.round(netCals) + " / " + Math.round(dailyTarget) + " kcal", pct, "cal" + (netCals > dailyTarget ? " over" : ""));
      html += barGroup("Protein", round(protein, 1) + "g / " + Math.round(macroTargets.protein) + "g", Math.min((protein / macroTargets.protein) * 100, 100), "protein");
      html += barGroup("Carbs", round(carbs, 1) + "g / " + Math.round(macroTargets.carbs) + "g", Math.min((carbs / macroTargets.carbs) * 100, 100), "carbs");
      html += barGroup("Fat", round(fat, 1) + "g / " + Math.round(macroTargets.fat) + "g", Math.min((fat / macroTargets.fat) * 100, 100), "fat");
    } else {
      html += "<p class='status-message'>Set your profile above to see your budget and macro targets.</p>";
    }

    els.summaryRoot.innerHTML = html;
  }

  function barGroup(label, detail, pct, fillClass) {
    return "<div class='bar-group'><div class='bar-group-label'><span>" + label + "</span><span>" + detail + "</span></div>" +
      "<div class='bar-track'><div class='bar-fill " + fillClass + "' style='width:" + Math.max(pct, 0) + "%'></div></div></div>";
  }

  // ---------- weight projection ----------

  function renderProjection() {
    const p = state.profile;
    if (!p) {
      els.projectionRoot.innerHTML = "<p class='status-message'>Set your profile above to see a projected weight trend.</p>";
      return;
    }

    const { tdee, dailyTarget, deficitPerDay } = computeTargets(p);
    const kcalPerUnit = p.units === "imperial" ? KCAL_PER_LB : KCAL_PER_KG;
    const unitLabel = p.units === "imperial" ? "lb" : "kg";
    const startWeight = p.units === "imperial" ? kgToLb(p.weightKg) : p.weightKg;
    const goalChangePerWeek = (deficitPerDay * 7) / kcalPerUnit;

    const WEEKS = 12;
    const goalPoints = [];
    for (let w = 0; w <= WEEKS; w++) goalPoints.push(startWeight + goalChangePerWeek * w);

    // Actual-based projection from logged history (trailing up to 14 days with entries).
    const loggedDates = Object.keys(state.logs)
      .filter((d) => (state.logs[d].food && state.logs[d].food.length) || (state.logs[d].exercise && state.logs[d].exercise.length))
      .sort()
      .slice(-14);

    let actualPoints = null;
    let avgNet = null;
    if (loggedDates.length >= 3) {
      const totalNet = loggedDates.reduce((sum, d) => {
        const day = state.logs[d];
        const foodCals = (day.food || []).reduce((s, f) => s + f.calories, 0);
        const exerciseCals = (day.exercise || []).reduce((s, x) => s + x.calories, 0);
        return sum + (foodCals - exerciseCals);
      }, 0);
      avgNet = totalNet / loggedDates.length;
      const actualDeficitPerDay = avgNet - tdee;
      const actualChangePerWeek = (actualDeficitPerDay * 7) / kcalPerUnit;
      actualPoints = [];
      for (let w = 0; w <= WEEKS; w++) actualPoints.push(startWeight + actualChangePerWeek * w);
    }

    const goalEnd = goalPoints[WEEKS];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + WEEKS * 7);
    const futureDateLabel = futureDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    let summaryHtml = "<div class='projection-summary'>" +
      "Maintenance: <strong>" + Math.round(tdee) + " kcal/day</strong>. Target: <strong>" + Math.round(dailyTarget) + " kcal/day</strong> " +
      "(" + (deficitPerDay <= 0 ? "" : "+") + Math.round(deficitPerDay) + " kcal/day vs. maintenance). " +
      "At this rate, projected weight in " + WEEKS + " weeks (" + futureDateLabel + "): <strong>" + round(goalEnd, 1) + " " + unitLabel + "</strong>.";

    if (actualPoints) {
      const actualEnd = actualPoints[WEEKS];
      summaryHtml += "<br/>Based on your logged average of <strong>" + Math.round(avgNet) + " kcal/day</strong> over the last " +
        loggedDates.length + " logged day" + (loggedDates.length === 1 ? "" : "s") + ", you're trending toward <strong>" +
        round(actualEnd, 1) + " " + unitLabel + "</strong> by then.";
    } else {
      summaryHtml += "<br/>Log food/exercise on at least 3 days to see a projection based on your actual habits.";
    }
    summaryHtml += "</div>";

    const chartHtml = renderProjectionChart(goalPoints, actualPoints, unitLabel);
    els.projectionRoot.innerHTML = summaryHtml + chartHtml;
  }

  function renderProjectionChart(goalPoints, actualPoints, unitLabel) {
    const width = 640, height = 220, padL = 46, padR = 16, padT = 16, padB = 28;
    const innerW = width - padL - padR, innerH = height - padT - padB;
    const weeks = goalPoints.length - 1;

    const allValues = goalPoints.concat(actualPoints || []);
    let min = Math.min.apply(null, allValues);
    let max = Math.max.apply(null, allValues);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1 || 1;
    min -= pad; max += pad;

    const x = (w) => padL + (w / weeks) * innerW;
    const y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;

    const toPath = (points) => points.map((v, i) => x(i) + "," + y(v)).join(" ");

    let svg = "<svg class='projection-chart' viewBox='0 0 " + width + " " + height + "' width='100%' height='" + height + "' preserveAspectRatio='xMinYMin meet'>";

    // horizontal gridlines + y labels (min/mid/max)
    [min, (min + max) / 2, max].forEach((v) => {
      const yy = y(v);
      svg += "<line x1='" + padL + "' y1='" + yy + "' x2='" + (width - padR) + "' y2='" + yy + "' style='stroke:var(--border)' stroke-width='1' />";
      svg += "<text x='" + (padL - 8) + "' y='" + (yy + 4) + "' text-anchor='end' font-size='11' style='fill:var(--text-muted)'>" + round(v, 1) + "</text>";
    });

    // x-axis week labels
    [0, Math.round(weeks / 2), weeks].forEach((w) => {
      svg += "<text x='" + x(w) + "' y='" + (height - 6) + "' text-anchor='middle' font-size='11' style='fill:var(--text-muted)'>wk " + w + "</text>";
    });

    svg += "<polyline points='" + toPath(goalPoints) + "' fill='none' style='stroke:var(--accent)' stroke-width='2.5' stroke-dasharray='6,5' />";
    if (actualPoints) {
      svg += "<polyline points='" + toPath(actualPoints) + "' fill='none' style='stroke:var(--protein)' stroke-width='2.5' />";
    }
    svg += "</svg>";

    return "<div class='projection-chart-wrap'>" + svg + "</div>" +
      "<div class='projection-legend'>" +
      "<span><span class='legend-swatch goal'></span>Goal (target calories)</span>" +
      (actualPoints ? "<span><span class='legend-swatch actual'></span>Actual (logged average)</span>" : "") +
      "<span>Weight in " + unitLabel + "</span>" +
      "</div>";
  }

  // ---------- utils ----------

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
