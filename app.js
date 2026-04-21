const STORAGE_KEY = "nutriflow-data-v2";

const QUICK_TEMPLATES = [
  { mealType: "Dorucak", name: "Jaja i tost" },
  { mealType: "Rucak", name: "Piletina i riza" },
  { mealType: "Vecera", name: "Juha i salata" },
  { mealType: "Snack", name: "Jogurt i voce" },
];

const elements = {
  mealForm: document.querySelector("#mealForm"),
  selectedDate: document.querySelector("#selectedDate"),
  previousWeekButton: document.querySelector("#previousWeekButton"),
  nextWeekButton: document.querySelector("#nextWeekButton"),
  weeklyStrip: document.querySelector("#weeklyStrip"),
  weekRangeLabel: document.querySelector("#weekRangeLabel"),
  weeklyBoard: document.querySelector("#weeklyBoard"),
  entriesList: document.querySelector("#entriesList"),
  entriesCount: document.querySelector("#entriesCount"),
  emptyState: document.querySelector("#emptyState"),
  insightList: document.querySelector("#insightList"),
  templateRow: document.querySelector("#templateRow"),
  summaryEntries: document.querySelector("#summaryEntries"),
  summaryLastMeal: document.querySelector("#summaryLastMeal"),
  summaryScreenshot: document.querySelector("#summaryScreenshot"),
  mealType: document.querySelector("#mealType"),
  mealName: document.querySelector("#mealName"),
  mealTime: document.querySelector("#mealTime"),
  mealNote: document.querySelector("#mealNote"),
};

const today = new Date().toISOString().slice(0, 10);

let state = loadState();

boot();

function boot() {
  elements.selectedDate.value = state.selectedDate || today;
  renderTemplateButtons();
  bindEvents();
  render();
}

function bindEvents() {
  elements.mealForm.addEventListener("submit", handleMealSubmit);
  elements.selectedDate.addEventListener("change", handleDateChange);
  elements.previousWeekButton.addEventListener("click", () => shiftWeek(-7));
  elements.nextWeekButton.addEventListener("click", () => shiftWeek(7));
  elements.entriesList.addEventListener("click", handleEntryDelete);
  elements.weeklyStrip.addEventListener("click", handleWeeklyDaySelect);
}

function loadState() {
  const fallback = {
    selectedDate: today,
    entriesByDate: {},
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      selectedDate: parsed.selectedDate || today,
      entriesByDate: parsed.entriesByDate || {},
    };
  } catch (error) {
    console.warn("Greska pri ucitavanju podataka:", error);
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function handleMealSubmit(event) {
  event.preventDefault();

  const dateKey = getSelectedDate();
  const entry = {
    id: createId(),
    mealType: elements.mealType.value,
    name: elements.mealName.value.trim(),
    mealTime: elements.mealTime.value,
    note: elements.mealNote.value.trim(),
    createdAt: new Date().toISOString(),
  };

  if (!entry.name) {
    return;
  }

  state.entriesByDate[dateKey] = [...getEntriesForDate(dateKey), entry];
  elements.mealForm.reset();
  persistAndRender();
}

function handleDateChange() {
  state.selectedDate = elements.selectedDate.value || today;
  persistAndRender();
}

function handleWeeklyDaySelect(event) {
  const trigger = event.target.closest("[data-date]");
  if (!trigger) {
    return;
  }

  const nextDate = trigger.getAttribute("data-date") || today;
  elements.selectedDate.value = nextDate;
  state.selectedDate = nextDate;
  persistAndRender();
}

function handleEntryDelete(event) {
  const trigger = event.target.closest("[data-delete-id]");
  if (!trigger) {
    return;
  }

  const entryId = trigger.getAttribute("data-delete-id");
  const dateKey = getSelectedDate();
  state.entriesByDate[dateKey] = getEntriesForDate(dateKey).filter((entry) => entry.id !== entryId);
  persistAndRender();
}

function shiftWeek(days) {
  const baseDate = parseDateInput(getSelectedDate());
  baseDate.setDate(baseDate.getDate() + days);
  const nextDate = toDateInputValue(baseDate);
  elements.selectedDate.value = nextDate;
  state.selectedDate = nextDate;
  persistAndRender();
}

function render() {
  const dateKey = getSelectedDate();
  const entries = getEntriesForDate(dateKey);

  renderWeeklyStrip();
  renderWeeklyBoard();
  renderSummary(entries);
  renderInsights(entries);
  renderEntries(entries);
}

function renderWeeklyStrip() {
  const weekDays = buildWeekDays(parseDateInput(getSelectedDate()));
  elements.weekRangeLabel.textContent = `${formatShortDate(weekDays[0])} - ${formatShortDate(weekDays[6])}`;
  elements.weeklyStrip.innerHTML = weekDays
    .map((date) => {
      const dateKey = toDateInputValue(date);
      const entries = getEntriesForDate(dateKey);
      const mealLabels = entries.slice(0, 2).map((entry) => formatMealType(entry.mealType)).join(", ");
      const activeClass = dateKey === getSelectedDate() ? "active-day" : "";
      const todayClass = dateKey === today ? "today-day" : "";

      return `
        <button class="day-card ${activeClass} ${todayClass}" type="button" data-date="${dateKey}">
          <strong>${formatWeekday(date)}</strong>
          <span>${formatShortDate(date)}</span>
          <span>${entries.length} ${entries.length === 1 ? "obrok" : "obroka"}</span>
          <span>${mealLabels || "Jos nema upisa"}</span>
        </button>
      `;
    })
    .join("");
}

function renderSummary(entries) {
  const lastEntry = entries[0];
  elements.summaryEntries.textContent = String(entries.length);
  elements.summaryLastMeal.textContent = lastEntry ? formatMealType(lastEntry.mealType) : "-";
  elements.summaryScreenshot.textContent = entries.length > 0 ? "Spremno" : "Prazno";
}

function renderWeeklyBoard() {
  const mealTypes = ["Dorucak", "Rucak", "Vecera", "Snack"];
  const weekDays = buildWeekDays(parseDateInput(getSelectedDate()));

  elements.weeklyBoard.innerHTML = weekDays
    .map((date) => {
      const dateKey = toDateInputValue(date);
      const grouped = groupByMealType(getEntriesForDate(dateKey));

      const slots = mealTypes
        .map((mealType) => {
          const mealEntries = grouped[mealType] || [];
          const content = mealEntries.length
            ? mealEntries
                .map((entry) => {
                  const time = entry.mealTime ? `${escapeHtml(entry.mealTime)} ` : "";
                  const note = entry.note ? ` (${escapeHtml(entry.note)})` : "";
                  return `${time}${escapeHtml(entry.name)}${note}`;
                })
                .join("<br />")
            : '<span class="week-board-empty">-</span>';

          return `
            <div class="week-board-slot">
              <strong>${formatMealType(mealType)}</strong>
              <p>${content}</p>
            </div>
          `;
        })
        .join("");

      return `
        <article class="week-board-day">
          <h3>${formatWeekday(date)}</h3>
          <p class="week-board-date">${formatShortDate(date)}</p>
          <div class="week-board-meals">${slots}</div>
        </article>
      `;
    })
    .join("");
}

function renderInsights(entries) {
  const grouped = groupByMealType(entries);
  const mealTypes = ["Dorucak", "Rucak", "Vecera", "Snack"];
  const cards = mealTypes.map((mealType) => {
    const mealEntries = grouped[mealType] || [];
    const preview = mealEntries.length
      ? mealEntries.map((entry) => escapeHtml(entry.name)).join(", ")
      : "Nema unosa za ovaj obrok.";

    return `
      <article class="insight-card">
        <strong>${formatMealType(mealType)}</strong>
        <p>${preview}</p>
      </article>
    `;
  });

  elements.insightList.innerHTML = cards.join("");
}

function renderEntries(entries) {
  elements.entriesCount.textContent = `${entries.length} ${entries.length === 1 ? "unos" : "unosa"}`;
  elements.emptyState.hidden = entries.length > 0;
  elements.entriesList.innerHTML = entries
    .map(
      (entry) => `
        <article class="entry-item entry-simple">
          <div>
            <div class="entry-topline">
              <span class="entry-badge">${formatMealType(entry.mealType)}</span>
              <strong>${escapeHtml(entry.name)}</strong>
              ${entry.mealTime ? `<span>${escapeHtml(entry.mealTime)}</span>` : ""}
            </div>
            ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ""}
          </div>
          <button class="delete-button" type="button" data-delete-id="${entry.id}">Obrisi</button>
        </article>
      `,
    )
    .join("");
}

function renderTemplateButtons() {
  elements.templateRow.innerHTML = QUICK_TEMPLATES.map(
    (template, index) => `
      <button class="template-chip" type="button" data-template-index="${index}">
        ${template.name}
      </button>
    `,
  ).join("");

  elements.templateRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-template-index]");
    if (!button) {
      return;
    }

    const template = QUICK_TEMPLATES[Number(button.getAttribute("data-template-index"))];
    elements.mealType.value = template.mealType;
    elements.mealName.value = template.name;
  });
}

function groupByMealType(entries) {
  return entries.reduce((accumulator, entry) => {
    accumulator[entry.mealType] = accumulator[entry.mealType] || [];
    accumulator[entry.mealType].push(entry);
    return accumulator;
  }, {});
}

function buildWeekDays(referenceDate) {
  const monday = startOfWeek(referenceDate);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

function getSelectedDate() {
  return elements.selectedDate.value || today;
}

function getEntriesForDate(dateKey) {
  return [...(state.entriesByDate[dateKey] || [])].sort((left, right) => {
    const leftValue = left.mealTime || left.createdAt;
    const rightValue = right.mealTime || right.createdAt;
    return String(rightValue).localeCompare(String(leftValue));
  });
}

function persistAndRender() {
  state.selectedDate = getSelectedDate();
  saveState();
  render();
}

function startOfWeek(date) {
  const output = new Date(date);
  const weekday = output.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  output.setDate(output.getDate() + offset);
  output.setHours(0, 0, 0, 0);
  return output;
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekday(date) {
  return date.toLocaleDateString("hr-HR", { weekday: "short" });
}

function formatShortDate(date) {
  return date.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit" });
}

function formatMealType(type) {
  const labels = {
    Dorucak: "Dorucak",
    Rucak: "Rucak",
    Vecera: "Vecera",
    Snack: "Snack",
  };

  return labels[type] || type;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
