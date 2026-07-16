(() => {
  "use strict";

  // ---------- backend config ----------
  // Paste your Apps Script Web App URL here after deploying Code.gs
  const CONFIG = {
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw9Deq162Tz6ldex5vFUuRiZ67CvpI4MDKR1jlCpZVaxz4WviOWE44P0DeaKXzvH7d1/exec",
    POLL_MS: 60000, // re-check the sheet every 60s so the public page stays live
  };
  const ADMIN_KEY_STORAGE = "gic-calendar-admin-key";

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
  let activities = [];
  let activeFilters = new Set(); // empty = show all
  let currentView = "calendar";
  let editingId = null;
  let adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
  let isAdmin = false;
  let syncing = false;
  let hasSyncedOnce = false;

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
  const leaderBtn = document.getElementById("leaderBtn");
  const leaderDropdown = document.getElementById("leaderDropdown");
  const viewKeyBtn = document.getElementById("viewKeyBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const syncStatus = document.getElementById("syncStatus");
  const formCard = document.getElementById("formCard");
  const leaderModalOverlay = document.getElementById("leaderModalOverlay");
  const leaderKeyInput = document.getElementById("leaderKeyInput");
  const leaderModalError = document.getElementById("leaderModalError");
  const leaderModalCancel = document.getElementById("leaderModalCancel");
  const leaderModalSubmit = document.getElementById("leaderModalSubmit");
  const changeKeyBtn = document.getElementById("changeKeyBtn");
  const changeKeyModalOverlay = document.getElementById("changeKeyModalOverlay");
  const newKeyInput = document.getElementById("newKeyInput");
  const confirmKeyInput = document.getElementById("confirmKeyInput");
  const changeKeyModalError = document.getElementById("changeKeyModalError");
  const changeKeyModalCancel = document.getElementById("changeKeyModalCancel");
  const changeKeyModalSubmit = document.getElementById("changeKeyModalSubmit");
  const viewKeyModalOverlay = document.getElementById("viewKeyModalOverlay");
  const viewKeyValue = document.getElementById("viewKeyValue");
  const viewKeyToggle = document.getElementById("viewKeyToggle");
  const viewKeyCopy = document.getElementById("viewKeyCopy");
  const viewKeyModalError = document.getElementById("viewKeyModalError");
  const viewKeyModalClose = document.getElementById("viewKeyModalClose");
  const viewKeyChangeInstead = document.getElementById("viewKeyChangeInstead");
  const toastStack = document.getElementById("toastStack");
  const nextUpBanner = document.getElementById("nextUpBanner");
  const skeletonState = document.getElementById("skeletonState");

  // ---------- backend sync ----------
  function backendReady() {
    return CONFIG.SCRIPT_URL && !CONFIG.SCRIPT_URL.startsWith("PASTE_");
  }

  async function fetchActivities() {
    if (!backendReady()) {
      setSyncStatus("Backend not connected yet — see setup instructions.", true);
      return;
    }
    syncing = true;
    if (!hasSyncedOnce) skeletonState.hidden = false;
    setSyncStatus("Syncing…");
    try {
      const res = await fetch(`${CONFIG.SCRIPT_URL}?action=list`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sync failed");
      activities = data.activities || [];
      hasSyncedOnce = true;
      skeletonState.hidden = true;
      renderAll();
      setSyncStatus(`Synced ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.warn("Sync failed", err);
      skeletonState.hidden = true;
      setSyncStatus("Couldn't reach the live calendar. Showing last-loaded data.", true);
    } finally {
      syncing = false;
    }
  }

  // ---------- toasts (replaces alert()) ----------
  function toast(message, opts) {
    const isError = !!(opts && opts.error);
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.setAttribute("role", "status");
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
        isError
          ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          : '<path d="M20 6 9 17l-5-5"/>'
      }</svg>
      <span></span>
    `;
    el.querySelector("span").textContent = message;
    toastStack.appendChild(el);
    const life = (opts && opts.duration) || 4200;
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 200);
    }, life);
  }

  async function postToBackend(payload) {
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight; Apps Script still parses it as JSON server-side
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, adminKey }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function setSyncStatus(text, isWarning) {
    if (!syncStatus) return;
    syncStatus.textContent = text;
    syncStatus.classList.toggle("warn", !!isWarning);
  }

  // ---------- leader access ----------
  function setAdminUi(on) {
    isAdmin = on;
    formCard.hidden = !on;
    leaderBtn.textContent = on ? "Leader mode: on" : "Leader access";
    leaderBtn.classList.toggle("active", on);
    leaderBtn.setAttribute("aria-haspopup", "true");
    if (!on) closeLeaderDropdown();
    renderAll();
  }

  function openLeaderDropdown() {
    leaderDropdown.hidden = false;
    leaderBtn.setAttribute("aria-expanded", "true");
  }
  function closeLeaderDropdown() {
    leaderDropdown.hidden = true;
    leaderBtn.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", (e) => {
    if (!leaderDropdown.hidden && !e.target.closest(".leader-menu-wrap")) closeLeaderDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !leaderDropdown.hidden) closeLeaderDropdown();
  });

  async function tryLogin(key) {
    if (!backendReady()) {
      toast("Connect the backend first (see setup instructions in script.js).", { error: true });
      return false;
    }
    try {
      const res = await fetch(`${CONFIG.SCRIPT_URL}?action=verify&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.ok) {
        adminKey = key;
        sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
        setAdminUi(true);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  function openLeaderModal() {
    leaderModalError.hidden = true;
    leaderKeyInput.value = "";
    leaderModalOverlay.hidden = false;
    leaderKeyInput.focus();
  }

  function closeLeaderModal() {
    leaderModalOverlay.hidden = true;
  }

  async function submitLeaderModal() {
    const key = leaderKeyInput.value.trim();
    if (!key) return;
    leaderModalSubmit.disabled = true;
    leaderModalSubmit.textContent = "Checking…";
    const ok = await tryLogin(key);
    leaderModalSubmit.disabled = false;
    leaderModalSubmit.textContent = "Unlock";
    if (ok) {
      closeLeaderModal();
    } else {
      leaderModalError.hidden = false;
      leaderKeyInput.select();
    }
  }

  leaderBtn.addEventListener("click", (e) => {
    if (isAdmin) {
      e.stopPropagation();
      leaderDropdown.hidden ? openLeaderDropdown() : closeLeaderDropdown();
      return;
    }
    openLeaderModal();
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    adminKey = "";
    closeLeaderDropdown();
    setAdminUi(false);
    toast("Logged out of leader mode.");
  });

  leaderModalCancel.addEventListener("click", closeLeaderModal);
  leaderModalOverlay.addEventListener("click", (e) => {
    if (e.target === leaderModalOverlay) closeLeaderModal();
  });
  leaderModalSubmit.addEventListener("click", submitLeaderModal);
  leaderKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitLeaderModal();
    if (e.key === "Escape") closeLeaderModal();
  });

  // ---------- password reveal toggles (login + change-key inputs) ----------
  document.querySelectorAll(".input-toggle-btn[data-toggle-for]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggleFor);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", showing ? "Show key" : "Hide key");
      btn.title = showing ? "Show key" : "Hide key";
    });
  });

  // ---------- view / copy current key ----------
  let revealedKey = "";
  function openViewKeyModal() {
    closeLeaderDropdown();
    revealedKey = "";
    viewKeyValue.textContent = "••••••••";
    viewKeyModalError.hidden = true;
    viewKeyModalOverlay.hidden = false;
    loadCurrentKey();
  }
  function closeViewKeyModal() {
    viewKeyModalOverlay.hidden = true;
  }
  async function loadCurrentKey() {
    try {
      const res = await fetch(`${CONFIG.SCRIPT_URL}?action=getkey&key=${encodeURIComponent(adminKey)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unauthorized");
      revealedKey = data.key || "";
      viewKeyValue.textContent = "•".repeat(Math.max(revealedKey.length, 8));
    } catch (err) {
      viewKeyModalError.textContent = "Couldn't load the current key: " + err.message;
      viewKeyModalError.hidden = false;
    }
  }
  viewKeyBtn.addEventListener("click", openViewKeyModal);
  viewKeyModalClose.addEventListener("click", closeViewKeyModal);
  viewKeyModalOverlay.addEventListener("click", (e) => {
    if (e.target === viewKeyModalOverlay) closeViewKeyModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !viewKeyModalOverlay.hidden) closeViewKeyModal();
  });
  viewKeyToggle.addEventListener("click", () => {
    if (!revealedKey) return;
    const isMasked = viewKeyValue.textContent.startsWith("•");
    viewKeyValue.textContent = isMasked ? revealedKey : "•".repeat(Math.max(revealedKey.length, 8));
  });
  viewKeyCopy.addEventListener("click", async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      viewKeyCopy.classList.add("copied");
      toast("Access key copied to clipboard.");
      setTimeout(() => viewKeyCopy.classList.remove("copied"), 1200);
    } catch (err) {
      toast("Couldn't copy automatically — select and copy manually.", { error: true });
    }
  });
  viewKeyChangeInstead.addEventListener("click", () => {
    closeViewKeyModal();
    openChangeKeyModal();
  });

  refreshBtn.addEventListener("click", fetchActivities);

  function openChangeKeyModal() {
    changeKeyModalError.hidden = true;
    newKeyInput.value = "";
    confirmKeyInput.value = "";
    changeKeyModalOverlay.hidden = false;
    newKeyInput.focus();
  }

  function closeChangeKeyModal() {
    changeKeyModalOverlay.hidden = true;
  }

  async function submitChangeKeyModal() {
    const newKey = newKeyInput.value.trim();
    const confirmKey = confirmKeyInput.value.trim();
    if (newKey.length < 4 || newKey !== confirmKey) {
      changeKeyModalError.hidden = false;
      return;
    }
    changeKeyModalSubmit.disabled = true;
    changeKeyModalSubmit.textContent = "Saving…";
    try {
      await postToBackend({ action: "setKey", newKey });
      adminKey = newKey;
      sessionStorage.setItem(ADMIN_KEY_STORAGE, newKey);
      closeChangeKeyModal();
      toast("Access key updated. Share the new key with your leadership team.");
    } catch (err) {
      changeKeyModalError.hidden = false;
      changeKeyModalError.textContent = "Couldn't save the new key: " + err.message;
    } finally {
      changeKeyModalSubmit.disabled = false;
      changeKeyModalSubmit.textContent = "Save new key";
    }
  }

  changeKeyBtn.addEventListener("click", () => {
    closeLeaderDropdown();
    openChangeKeyModal();
  });
  changeKeyModalCancel.addEventListener("click", closeChangeKeyModal);
  changeKeyModalOverlay.addEventListener("click", (e) => {
    if (e.target === changeKeyModalOverlay) closeChangeKeyModal();
  });
  changeKeyModalSubmit.addEventListener("click", submitChangeKeyModal);
  [newKeyInput, confirmKeyInput].forEach(input => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitChangeKeyModal();
      if (e.key === "Escape") closeChangeKeyModal();
    });
  });

  // ---------- form behavior ----------
  form.addEventListener("submit", async (e) => {
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

    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? "Saving…" : "Adding…";
    const wasEditing = !!editingId;
    try {
      await postToBackend({ action: editingId ? "update" : "add", activity: record });
      resetForm();
      await fetchActivities();
      toast(wasEditing ? "Activity updated." : "Activity added to the calendar.");
    } catch (err) {
      toast("Couldn't save that activity: " + err.message, { error: true });
      submitBtn.disabled = false;
      submitBtn.textContent = editingId ? "Save Changes" : "Add to Calendar";
    }
  });

  cancelEditBtn.addEventListener("click", resetForm);

  function resetForm() {
    form.reset();
    idInput.value = "";
    editingId = null;
    submitBtn.disabled = false;
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
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteActivity(id) {
    const a = activities.find(x => x.id === id);
    const label = a ? `"${a.name}"` : "this activity";
    if (!confirm(`Remove ${label} from the calendar?`)) return;
    try {
      await postToBackend({ action: "delete", id });
      if (editingId === id) resetForm();
      await fetchActivities();
      toast(`Removed ${label} from the calendar.`);
    } catch (err) {
      toast("Couldn't delete that activity: " + err.message, { error: true });
    }
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
    const uid = `${a.id}@merida-ysa-newsroom`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Merida YSA Newsroom//Activity Calendar//EN",
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
          ${isAdmin ? `
          <button class="icon-btn" title="Edit" data-action="edit" data-id="${a.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn" title="Delete" data-action="delete" data-id="${a.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>` : ""}
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
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let day = 1; day <= daysInMonth; day++) {
          const cell = document.createElement("div");
          cell.className = "cal-cell" + (isCurrentMonth && today.getDate() === day ? " is-today" : "");
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
        footer.textContent = `${MONTH_NAMES[month]} ${year} · Merida YSA Newsroom`;
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
    renderNextUp();
    updatePrintRange();
    emptyState.hidden = !hasSyncedOnce || activities.length > 0;
  }

  // ---------- next up banner ----------
  function renderNextUp() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = activities
      .filter(a => parseLocalDate(a.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!upcoming) {
      nextUpBanner.hidden = true;
      return;
    }
    const d = parseLocalDate(upcoming.date);
    const cd = countdownLabel(upcoming.date);
    nextUpBanner.hidden = false;
    nextUpBanner.innerHTML = `
      <div class="next-up-date">
        <div class="dom">${String(d.getDate()).padStart(2, "0")}</div>
        <div class="mon">${MONTH_NAMES[d.getMonth()].slice(0, 3)}</div>
      </div>
      <div class="next-up-body">
        <p class="next-up-eyebrow">Next up &middot; ${cd.text}</p>
        <p class="next-up-name">${escapeHtml(upcoming.name)}</p>
        ${upcoming.venue ? `<p class="next-up-meta">${escapeHtml(upcoming.venue)}</p>` : ""}
      </div>
      <span class="next-up-badge">${escapeHtml(upcoming.type)}</span>
    `;
  }

  setView("calendar");
  renderAll();

  // ---------- go live ----------
  if (adminKey) tryLogin(adminKey);
  fetchActivities();
  setInterval(fetchActivities, CONFIG.POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchActivities();
  });
})();
