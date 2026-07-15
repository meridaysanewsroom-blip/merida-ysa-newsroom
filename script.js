(() => {
  "use strict";

  const STORAGE_KEY = "gic-calendar-activities";
  const TYPE_ORDER = ["Physical", "Spiritual", "Family History"];
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DOW_NAMES_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const TYPE_ICONS = {
    "Physical": '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    "Spiritual": '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
    "Family History": '<circle cx="12" cy="9" r="5"></circle><line x1="12" y1="14" x2="12" y2="21"></line>'
  };

  /** @type {{id:string, date:string, name:string, theme:string, description:string, type:string, venue:string}[]} */
  let activities = load();
  let activeFilters = new Set(); // empty = show all
  let currentView = "list";
  let editingId = null;

  // ---------- persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Could not read saved activities", e);
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    } catch (e) {
      console.warn("Could not save activities", e);
    }
  }

  // ---------- elements ----------
  const form = document.getElementById("activityForm");
  const dateInput = document.getElementById("date");
  const typeSelect = document.getElementById("type");
  const nameInput = document.getElementById("name");
  const venueInput = document.getElementById("venue");
  const themeInput = document.getElementById("theme");
  const descInput = document.getElementById("description");
  const idInput = document.getElementById("activityId");
  const submitBtn = document.getElementById("submitBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const formTitle = document.getElementById("formTitle");
  const formTab = document.getElementById("formTab");

  const listView = document.getElementById("listView");
  const calendarView = document.getElementById("calendarView");
  const emptyState = document.getElementById("emptyState");
  const filterChips = document.getElementById("filterChips");
  const btnList = document.getElementById("btnList");
  const btnCalendar = document.getElementById("btnCalendar");
  const printBtn = document.getElementById("printBtn");
  const printDateRange = document.getElementById("printDateRange");

  // ---------- form behavior ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!dateInput.value || !typeSelect.value || !nameInput.value.trim()) {
      form.reportValidity();
      return;
    }

    const record = {
      id: editingId || String(Date.now()) + Math.random().toString(16).slice(2),
      date: dateInput.value,
      name: nameInput.value.trim(),
      venue: venueInput.value.trim(),
      theme: themeInput.value.trim(),
      description: descInput.value.trim(),
      type: typeSelect.value,
    };

    if (editingId) {
      const idx = activities.findIndex(a => a.id === editingId);
      if (idx !== -1) activities[idx] = record;
    } else {
      activities.push(record);
    }

    save();
    resetForm();
    renderAll();
  });

  cancelEditBtn.addEventListener("click", resetForm);

  function resetForm() {
    form.reset();
    idInput.value = "";
    editingId = null;
    submitBtn.textContent = "Add to Calendar";
    cancelEditBtn.hidden = true;
    formTitle.textContent = "Add an Activity";
    formTab.textContent = "New Entry";
  }

  function startEdit(id) {
    const a = activities.find(x => x.id === id);
    if (!a) return;
    editingId = id;
    idInput.value = id;
    dateInput.value = a.date;
    nameInput.value = a.name;
    venueInput.value = a.venue || "";
    themeInput.value = a.theme;
    descInput.value = a.description;
    typeSelect.value = TYPE_ORDER.includes(a.type) ? a.type : TYPE_ORDER[0];

    submitBtn.textContent = "Save Changes";
    cancelEditBtn.hidden = false;
    formTitle.textContent = "Edit Activity";
    formTab.textContent = "Editing";
    document.getElementById("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteActivity(id) {
    const a = activities.find(x => x.id === id);
    const label = a ? `"${a.name}"` : "this activity";
    if (!confirm(`Remove ${label} from the calendar?`)) return;
    activities = activities.filter(x => x.id !== id);
    save();
    if (editingId === id) resetForm();
    renderAll();
  }

  // ---------- view toggle ----------
  btnList.addEventListener("click", () => setView("list"));
  btnCalendar.addEventListener("click", () => setView("calendar"));

  function setView(view) {
    currentView = view;
    btnList.classList.toggle("active", view === "list");
    btnCalendar.classList.toggle("active", view === "calendar");
    listView.hidden = view !== "list";
    calendarView.hidden = view !== "calendar";
  }

  // ---------- filters ----------
  function renderFilterChips() {
    const typesInUse = Array.from(new Set(activities.map(a => a.type)));
    const orderedTypes = TYPE_ORDER.filter(t => typesInUse.includes(t))
      .concat(typesInUse.filter(t => !TYPE_ORDER.includes(t)));

    filterChips.innerHTML = "";
    orderedTypes.forEach(type => {
      const chip = document.createElement("button");
      chip.className = "chip" + (activeFilters.has(type) ? " active" : "");
      chip.type = "button";
      chip.dataset.type = type;
      chip.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICONS[type] || ""}</svg><span>${escapeHtml(type)}</span>`;
      chip.addEventListener("click", () => {
        activeFilters.has(type) ? activeFilters.delete(type) : activeFilters.add(type);
        renderAll();
      });
      filterChips.appendChild(chip);
    });
  }

  function visibleActivities() {
    const filtered = activeFilters.size
      ? activities.filter(a => activeFilters.has(a.type))
      : activities.slice();
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- helpers ----------
  function parseLocalDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  const WATERMARK_SVG = `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="96" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="100" cy="100" r="72" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="100" cy="100" r="48" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="100" cy="100" r="24" stroke="currentColor" stroke-width="1.4"/>
  </svg>`;

  function typeIconSvg(type) {
    return `<svg class="type-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICONS[type] || ""}</svg>`;
  }

  function countdownLabel(iso) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = parseLocalDate(iso);
    const diffDays = Math.round((d - today) / 86400000);
    if (diffDays === 0) return { text: "Today", cls: "today" };
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d ago`, cls: "past" };
    if (diffDays === 1) return { text: "Tomorrow", cls: "soon" };
    if (diffDays <= 7) return { text: `In ${diffDays}d`, cls: "soon" };
    return { text: `In ${diffDays}d`, cls: "" };
  }

  function mapsUrl(venue) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
  }

  // ---------- .ics export (add a single activity to a phone calendar) ----------
  function toIcsDate(iso) {
    return iso.replace(/-/g, "");
  }

  function downloadIcs(a) {
    const dt = toIcsDate(a.date);
    const uid = `${a.id}@gathering-in-christ`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gathering in Christ//Activity Calendar//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:${icsEscape(a.name)}`,
      a.venue ? `LOCATION:${icsEscape(a.venue)}` : null,
      (a.theme || a.description) ? `DESCRIPTION:${icsEscape([a.theme, a.description].filter(Boolean).join(" — "))}` : null,
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean);

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "activity"}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function icsEscape(str) {
    return (str || "").replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
  }

  // ---------- render: list ----------
  function renderList() {
    const items = visibleActivities();
    listView.innerHTML = "";

    if (!items.length) return;

    let currentMonthKey = null;
    let monthContainer = null;

    items.forEach(a => {
      const d = parseLocalDate(a.date);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

      if (monthKey !== currentMonthKey) {
        currentMonthKey = monthKey;
        const group = document.createElement("div");
        group.className = "month-group";
        const label = document.createElement("h3");
        label.className = "month-label";
        label.textContent = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        group.appendChild(label);
        listView.appendChild(group);
        monthContainer = group;
      }

      const cd = countdownLabel(a.date);
      const card = document.createElement("article");
      card.className = "activity-card";
      card.dataset.type = a.type;
      card.innerHTML = `
        <div class="card-date">
          <div class="dow">${DOW_NAMES[d.getDay()]}</div>
          <div class="dom">${String(d.getDate()).padStart(2, "0")}</div>
          <div class="mon">${MONTH_NAMES[d.getMonth()].slice(0,3)}</div>
          <span class="countdown ${cd.cls}">${cd.text}</span>
        </div>
        <div class="card-body">
          <h3>${typeIconSvg(a.type)}<span>${escapeHtml(a.name)}</span></h3>
          ${a.venue ? `<p class="card-venue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg><a href="${mapsUrl(a.venue)}" target="_blank" rel="noopener">${escapeHtml(a.venue)}</a></p>` : ""}
          ${a.theme ? `<p class="card-theme">&ldquo;${escapeHtml(a.theme)}&rdquo;</p>` : ""}
          ${a.description ? `<p class="card-desc">${escapeHtml(a.description)}</p>` : ""}
          <span class="type-badge">${escapeHtml(a.type)}</span>
        </div>
        <div class="card-actions no-print">
          <button class="icon-btn" title="Add to phone calendar" data-action="ics" data-id="${a.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
          </button>
          <button class="icon-btn" title="Edit" data-action="edit" data-id="${a.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn" title="Delete" data-action="delete" data-id="${a.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      monthContainer.appendChild(card);
    });

    listView.querySelectorAll('[data-action="edit"]').forEach(btn =>
      btn.addEventListener("click", () => startEdit(btn.dataset.id)));
    listView.querySelectorAll('[data-action="delete"]').forEach(btn =>
      btn.addEventListener("click", () => deleteActivity(btn.dataset.id)));
    listView.querySelectorAll('[data-action="ics"]').forEach(btn =>
      btn.addEventListener("click", () => {
        const a = activities.find(x => x.id === btn.dataset.id);
        if (a) downloadIcs(a);
      }));
  }

  // ---------- render: calendar ----------
  function renderCalendar() {
    const items = visibleActivities();
    calendarView.innerHTML = "";
    if (!items.length) return;

    const byMonth = new Map();
    items.forEach(a => {
      const d = parseLocalDate(a.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, { year: d.getFullYear(), month: d.getMonth(), items: [] });
      byMonth.get(key).items.push(a);
    });

    Array.from(byMonth.values())
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .forEach(({ year, month, items: monthItems }) => {
        const section = document.createElement("div");
        section.className = "cal-month";

        const watermark = document.createElement("div");
        watermark.className = "cal-watermark";
        watermark.innerHTML = WATERMARK_SVG;
        section.appendChild(watermark);

        const heading = document.createElement("div");
        heading.className = "cal-heading";
        heading.innerHTML = `
          <h3 class="cal-month-title"><span class="cal-month-name">${MONTH_NAMES[month]}</span><span class="cal-month-year">${year}</span></h3>
          <span class="cal-month-count">${monthItems.length} ${monthItems.length === 1 ? "activity" : "activities"}</span>
        `;
        section.appendChild(heading);

        const table = document.createElement("div");
        table.className = "cal-table";

        const dowRow = document.createElement("div");
        dowRow.className = "cal-dow-row";
        DOW_NAMES_FULL.forEach(dow => {
          const cell = document.createElement("div");
          cell.className = "cal-dow";
          cell.textContent = dow;
          dowRow.appendChild(cell);
        });
        table.appendChild(dowRow);

        const grid = document.createElement("div");
        grid.className = "cal-grid";

        const firstDow = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDow; i++) {
          const empty = document.createElement("div");
          empty.className = "cal-cell empty";
          grid.appendChild(empty);
        }

        const MAX_PILLS = 2;

        for (let day = 1; day <= daysInMonth; day++) {
          const cell = document.createElement("div");
          cell.className = "cal-cell";
          const dayItems = monthItems.filter(a => parseLocalDate(a.date).getDate() === day);

          const num = document.createElement("div");
          num.className = "cell-num";
          num.textContent = day;
          cell.appendChild(num);

          if (dayItems.length) {
            const ticks = document.createElement("div");
            ticks.className = "cell-ticks";
            dayItems.forEach(a => {
              const tick = document.createElement("div");
              tick.className = "cal-tick";
              tick.dataset.type = a.type;
              ticks.appendChild(tick);
            });
            cell.appendChild(ticks);

            const itemsWrap = document.createElement("div");
            itemsWrap.className = "cell-items";
            dayItems.slice(0, MAX_PILLS).forEach(a => {
              const pill = document.createElement("div");
              pill.className = "cal-pill";
              pill.dataset.type = a.type;
              pill.title = a.venue ? `${a.name} (${a.type}) — ${a.venue}` : `${a.name} (${a.type})`;
              pill.textContent = a.name;
              itemsWrap.appendChild(pill);
            });
            if (dayItems.length > MAX_PILLS) {
              const more = document.createElement("div");
              more.className = "cal-more";
              more.textContent = `+${dayItems.length - MAX_PILLS} more`;
              more.title = dayItems.slice(MAX_PILLS).map(a => a.name).join(", ");
              itemsWrap.appendChild(more);
            }
            cell.appendChild(itemsWrap);
          }

          grid.appendChild(cell);
        }

        table.appendChild(grid);
        section.appendChild(table);

        const footer = document.createElement("div");
        footer.className = "cal-footer";
        footer.textContent = `${MONTH_NAMES[month]} ${year} · Gathering in Christ`;
        section.appendChild(footer);

        calendarView.appendChild(section);
      });
  }

  // ---------- print header range ----------
  function updatePrintRange() {
    const items = visibleActivities();
    if (!items.length) {
      printDateRange.textContent = "";
      return;
    }
    const first = parseLocalDate(items[0].date);
    const last = parseLocalDate(items[items.length - 1].date);
    const fmt = d => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    printDateRange.textContent = items.length === 1
      ? fmt(first)
      : `${fmt(first)} — ${fmt(last)}`;
  }

  printBtn.addEventListener("click", () => window.print());

  // ---------- master render ----------
  function renderAll() {
    renderFilterChips();
    renderList();
    renderCalendar();
    updatePrintRange();
    emptyState.style.display = activities.length ? "none" : "block";
  }

  setView("calendar");
  renderAll();
})();
