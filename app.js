import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";

(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyDS3wMI446kdr0AvH8UFkFnnuVSyV6d0-Q",
    authDomain: "calendar-app-3ff19.firebaseapp.com",
    projectId: "calendar-app-3ff19",
    storageBucket: "calendar-app-3ff19.appspot.com",
    messagingSenderId: "402960003673",
    appId: "1:402960003673:web:fbe2180b583f6cecbd3748",
  };

  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();

  const LEGACY_DONE_STORE = "cal2026_v2";
  const TASKS_STORE = "cal2026_tasks_v1";
  const DONE_STORE = "cal2026_done_v1";
  const MIGRATED_FLAG = "cal2026_migrated_v1";
  const HIDDEN_MONTHS_STORE = "cal2026_hiddenMonths_v1";

  const weekPctState = new Map();
  let lastOverallPct = null;

  const MONTHS_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const MONTHS_FULL = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const MONTH_NUM = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12,
  };

  const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let dayIndex = null;
  let tasks = null;
  let doneMap = null;
  let idCounter = 0;
  let appInitialized = false;

  function setAuthError(message) {
    const authError = document.getElementById("auth-error");
    if (!authError) return;
    authError.textContent = message || "";
  }

  function showAuthOnly() {
    const authScreen = document.getElementById("auth-screen");
    const tasksPage = document.getElementById("tasks-page");
    if (authScreen) authScreen.hidden = false;
    if (tasksPage) tasksPage.hidden = true;
  }

  function showTasksForUser(user) {
    const authScreen = document.getElementById("auth-screen");
    const tasksPage = document.getElementById("tasks-page");
    const sessionUser = document.getElementById("session-user");
    if (authScreen) authScreen.hidden = true;
    if (tasksPage) tasksPage.hidden = false;
    if (sessionUser) {
      sessionUser.textContent = user?.displayName || user?.email || "Signed in";
    }
  }

  async function handleProviderLogin(provider) {
    setAuthError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthError(error?.message || "Login failed. Please try again.");
    }
  }

  function setupAuthGate() {
    const googleBtn = document.getElementById("login-google-btn");
    const githubBtn = document.getElementById("login-github-btn");
    const logoutBtn = document.getElementById("logout-btn");

    googleBtn?.addEventListener("click", () => handleProviderLogin(googleProvider));
    githubBtn?.addEventListener("click", () => handleProviderLogin(githubProvider));
    logoutBtn?.addEventListener("click", async () => {
      await signOut(auth);
    });

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        showAuthOnly();
        return;
      }

      showTasksForUser(user);
      if (!appInitialized) {
        appInitialized = true;
        init();
      }
    });
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function parseIsoDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m - 1 ||
      dt.getUTCDate() !== d
    )
      return null;
    return dt;
  }

  function isoFromUTCDate(dt) {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }

  function formatShort(iso) {
    const dt = parseIsoDate(iso);
    if (!dt) return iso;
    return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function loadHiddenMonths() {
    const raw = localStorage.getItem(HIDDEN_MONTHS_STORE);
    const parsed = safeJsonParse(raw || "", []);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  }

  function saveHiddenMonths(keys) {
    localStorage.setItem(HIDDEN_MONTHS_STORE, JSON.stringify(keys));
  }

  function monthKeyFromYearMonth(year, month) {
    return `${year}-${pad2(month)}`;
  }

  function monthKeyFromMonthNameText(text) {
    if (!text) return null;
    const parts = String(text).trim().split(/\s+/);
    const monthName = parts[0];
    const year = Number(parts[1]);
    const month = MONTH_NUM[monthName];
    if (!year || !month) return null;
    return monthKeyFromYearMonth(year, month);
  }

  function getMonthKeyFromMonthSec(monthSec) {
    const labelText = monthSec
      ?.querySelector(".month-name")
      ?.textContent?.trim();
    return monthKeyFromMonthNameText(labelText);
  }

  function applyHiddenMonthsToDom() {
    const hidden = new Set(loadHiddenMonths());
    document.querySelectorAll(".month-sec").forEach((sec) => {
      const key = getMonthKeyFromMonthSec(sec);
      if (key && hidden.has(key)) sec.remove();
    });
  }

  function removeMonth(monthSec) {
    const key = monthSec?.dataset?.monthKey || getMonthKeyFromMonthSec(monthSec);
    if (!key) return;

    if (!confirm(`Remove ${key} from the calendar view? This keeps your tasks saved, but hides that month on reload.`)) {
      return;
    }

    const hidden = new Set(loadHiddenMonths());
    hidden.add(key);
    saveHiddenMonths(Array.from(hidden).sort());

    monthSec.remove();
    dayIndex = buildDayIndex();
    render();
  }

  function ensureMonthRemoveButtons() {
    document.querySelectorAll(".month-sec").forEach((sec) => {
      const key = getMonthKeyFromMonthSec(sec);
      if (!key) return;
      sec.dataset.monthKey = key;

      const label = sec.querySelector(".month-label");
      if (!label) return;

      let btn = label.querySelector(".month-remove-btn");
      if (btn) return;

      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "month-remove-btn";
      btn.textContent = "Remove month";
      btn.hidden = true;
      btn.addEventListener("click", () => removeMonth(sec));
      label.appendChild(btn);
    });
  }

  function updateMonthRemoveButtons() {
    document.querySelectorAll(".month-sec").forEach((sec) => {
      const key = sec.dataset.monthKey || getMonthKeyFromMonthSec(sec);
      const btn = sec.querySelector(".month-remove-btn");
      if (!key || !btn) return;

      const monthTasks = tasks.filter(
        (t) => typeof t.start === "string" && t.start.startsWith(key + "-"),
      );
      const total = monthTasks.length;
      const done = monthTasks.filter((t) => Boolean(doneMap[t.id])).length;
      const complete = total > 0 && done === total;

      btn.hidden = !complete;
      btn.disabled = !complete;
    });
  }

  function loadTasks() {
    const raw = localStorage.getItem(TASKS_STORE);
    const parsed = safeJsonParse(raw || "", null);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  }

  function saveTasks(nextTasks) {
    localStorage.setItem(TASKS_STORE, JSON.stringify(nextTasks));
  }

  function loadDone() {
    const raw = localStorage.getItem(DONE_STORE);
    const parsed = safeJsonParse(raw || "", {});
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function saveDone(nextDone) {
    localStorage.setItem(DONE_STORE, JSON.stringify(nextDone));
  }

  function getRowIsoDate(row) {
    const monthLabel = row
      .closest(".month-sec")
      ?.querySelector(".month-name")
      ?.textContent?.trim();
    if (!monthLabel) return null;
    const parts = monthLabel.split(/\s+/);
    const monthName = parts[0];
    const year = Number(parts[1]);
    const month = MONTH_NUM[monthName];
    const day = Number(row.querySelector(".dnum")?.textContent?.trim());
    if (!month || !year || !day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function buildDayIndex() {
    const index = new Map();
    document.querySelectorAll(".day-row").forEach((row) => {
      if (row.classList.contains("off-row")) return;
      const iso = getRowIsoDate(row);
      const tasksEl = row.querySelector(".day-tasks");
      const weekId = row.closest(".week")?.dataset?.week || null;
      if (!iso || !tasksEl) return;
      index.set(iso, { tasksEl, weekId });
    });
    return index;
  }

  function clearRenderedTasks(index) {
    for (const { tasksEl } of index.values()) {
      tasksEl.innerHTML = "";
    }
  }

  function applyLegacyDoneToDomCheckboxes() {
    const cbs = document.querySelectorAll('input[type="checkbox"]');
    cbs.forEach((cb, i) => (cb.id = "cb" + i));
    const raw = localStorage.getItem(LEGACY_DONE_STORE);
    if (!raw) return;
    const legacy = safeJsonParse(raw, {});
    cbs.forEach((cb) => {
      if (legacy?.[cb.id]) {
        cb.checked = true;
        cb.closest(".tl")?.classList.add("done");
      }
    });
  }

  function bootstrapFromDom(index) {
    const nextTasks = [];
    const nextDone = {};

    let i = 0;
    document.querySelectorAll(".day-row").forEach((row) => {
      if (row.classList.contains("off-row")) return;
      const iso = getRowIsoDate(row);
      if (!iso) return;
      row.querySelectorAll("label.tl").forEach((pill) => {
        const input = pill.querySelector('input[type="checkbox"]');
        const text = pill.querySelector(".tt")?.textContent?.trim() || "";
        const pri = input?.dataset?.pri || "m";
        const tag = pill.classList.contains("dl") ? "dl" : pri;
        const id = "t" + i++;

        nextTasks.push({ id, text, pri, tag, start: iso, end: iso });
        nextDone[id] = Boolean(input?.checked);
      });
    });

    // Only keep tasks that have a valid start day in this calendar
    const filtered = nextTasks.filter((t) => index.has(t.start));
    const filteredDone = {};
    filtered.forEach((t) => (filteredDone[t.id] = nextDone[t.id]));

    return { tasks: filtered, doneMap: filteredDone };
  }

  function createTaskPill(task, checked) {
    const label = document.createElement("label");
    label.className = `tl ${task.tag}`;
    label.dataset.taskId = task.id;
    label.title = "Right-click to reschedule";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.pri = task.pri;

    const startWeekId = dayIndex.get(task.start)?.weekId;
    if (startWeekId) input.dataset.week = startWeekId;

    if (checked) {
      input.checked = true;
      label.classList.add("done");
    }

    const cbZone = document.createElement("div");
    cbZone.className = "cb-zone";

    const cbBox = document.createElement("div");
    cbBox.className = "cb-box";

    const cbTick = document.createElement("div");
    cbTick.className = "cb-tick";

    cbBox.appendChild(cbTick);
    cbZone.appendChild(cbBox);

    const tt = document.createElement("span");
    tt.className = "tt";
    tt.textContent = task.text;

    if (task.end && task.end !== task.start) {
      const range = document.createElement("span");
      range.className = "trange";
      range.textContent = `→ ${formatShort(task.end)}`;
      tt.appendChild(range);
    }

    label.appendChild(input);
    label.appendChild(cbZone);
    label.appendChild(tt);

    input.addEventListener("change", () => {
      doneMap[task.id] = input.checked;
      label.classList.toggle("done", input.checked);
      if (input.checked) {
        label.classList.remove("just-done");
        void label.offsetWidth;
        label.classList.add("just-done");
        setTimeout(() => label.classList.remove("just-done"), 600);
      }
      saveDone(doneMap);
      updateProgress();
    });

    label.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      editSchedule(task.id);
    });

    return label;
  }

  function render() {
    clearRenderedTasks(dayIndex);
    tasks.forEach((task) => {
      const slot = dayIndex.get(task.start);
      if (!slot) return;
      const pill = createTaskPill(task, Boolean(doneMap[task.id]));
      slot.tasksEl.appendChild(pill);
    });
    updateProgress();
  }

  function updateProgress() {
    ensureMonthRemoveButtons();

    const getWeekIdForTask = (task) => dayIndex.get(task.start)?.weekId;

    document.querySelectorAll(".week").forEach((w) => {
      const wid = w.dataset.week;
      const weekTasks = tasks.filter((t) => getWeekIdForTask(t) === wid);
      const total = weekTasks.length;
      const done = weekTasks.filter((t) => Boolean(doneMap[t.id])).length;
      const pct = total ? Math.round((done / total) * 100) : 0;

      const prevPct = weekPctState.get(wid);
      weekPctState.set(wid, pct);

      const bar = document.getElementById("wb-" + wid);
      const lbl = document.getElementById("wp-" + wid);
      if (bar) bar.style.width = pct + "%";
      if (lbl) lbl.textContent = pct + "%";
      if (bar)
        bar.style.background =
          pct === 100 ? "linear-gradient(90deg,#34d399,#059669)" : "";

      if (prevPct !== undefined && prevPct < 100 && pct === 100) {
        w.classList.remove("complete-flash");
        void w.offsetWidth;
        w.classList.add("complete-flash");
      }
    });

    const total = tasks.length;
    const done = tasks.filter((t) => Boolean(doneMap[t.id])).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    document.getElementById("overall-bar").style.width = pct + "%";
    document.getElementById("overall-pct").textContent = pct + "%";
    document.getElementById("done-count").textContent =
      done + " / " + total + " tasks done";

    const hTasks = tasks.filter((t) => t.pri === "h");
    const mTasks = tasks.filter((t) => t.pri === "m");
    const lTasks = tasks.filter((t) => t.pri === "l");

    document.getElementById("high-done").textContent =
      hTasks.filter((t) => Boolean(doneMap[t.id])).length +
      "/" +
      hTasks.length +
      " High";
    document.getElementById("mod-done").textContent =
      mTasks.filter((t) => Boolean(doneMap[t.id])).length +
      "/" +
      mTasks.length +
      " Moderate";
    document.getElementById("low-done").textContent =
      lTasks.filter((t) => Boolean(doneMap[t.id])).length +
      "/" +
      lTasks.length +
      " Low";

    if (lastOverallPct !== null && lastOverallPct < 100 && pct === 100) {
      celebrate();
    }
    lastOverallPct = pct;

    updateMonthRemoveButtons();
  }

  function celebrate() {
    const b = document.getElementById("burst");
    b.classList.remove("show");
    void b.offsetWidth;
    b.classList.add("show");
    setTimeout(() => b.classList.remove("show"), 1200);
  }

  function editSchedule(taskId) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;

    const startIn = prompt("Start date (YYYY-MM-DD):", t.start);
    if (startIn === null) return;

    const start = startIn.trim();
    const startDt = parseIsoDate(start);
    if (!startDt) {
      alert("Invalid start date. Use YYYY-MM-DD.");
      return;
    }

    ensureDateVisible(start);

    if (!dayIndex.has(start)) {
      alert(
        "That start date is not visible yet. Add the next month and try again.",
      );
      return;
    }

    const endIn = prompt(
      "End date (YYYY-MM-DD). Leave blank for single-day task:",
      t.end || start,
    );
    if (endIn === null) return;

    const end = (endIn.trim() || start).trim();
    const endDt = parseIsoDate(end);
    if (!endDt) {
      alert("Invalid end date. Use YYYY-MM-DD.");
      return;
    }
    if (endDt.getTime() < startDt.getTime()) {
      alert("End date must be the same as or after the start date.");
      return;
    }

    t.start = start;
    t.end = end;
    saveTasks(tasks);
    render();
  }

  function nextTaskId() {
    idCounter += 1;
    return `u${Date.now()}_${idCounter}`;
  }

  function getLastMonthFromDom() {
    const labels = Array.from(document.querySelectorAll(".month-name"));
    if (!labels.length) return null;
    const last = labels[labels.length - 1].textContent.trim();
    const [monthName, yearStr] = last.split(/\s+/);
    const year = Number(yearStr);
    const month = MONTH_NUM[monthName];
    if (!year || !month) return null;
    return { year, month };
  }

  function getMaxWeekNumber() {
    let max = 0;
    document.querySelectorAll(".week").forEach((w) => {
      const wid = w.dataset.week || "";
      const m = wid.match(/^w(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
  }

  function getSecondSaturdayDay(year, month) {
    const saturdays = [];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (dow === 6) saturdays.push(d);
    }
    return saturdays.length >= 2 ? saturdays[1] : null;
  }

  function createDayRow({ dow, dayNum, offText }) {
    const row = document.createElement("div");
    row.className = offText ? "day-row off-row" : "day-row";

    const dayInfo = document.createElement("div");
    dayInfo.className = offText ? "day-info off-d" : "day-info";

    const dname = document.createElement("span");
    dname.className = "dname";
    dname.textContent = DOW_SHORT[dow];

    const dnum = document.createElement("span");
    dnum.className = "dnum";
    dnum.textContent = String(dayNum);

    dayInfo.appendChild(dname);
    dayInfo.appendChild(dnum);

    const dayTasks = document.createElement("div");
    dayTasks.className = offText ? "day-tasks off-t" : "day-tasks";

    if (offText) {
      const span = document.createElement("span");
      span.className = "off-text";
      span.textContent = offText;
      dayTasks.appendChild(span);
    }

    row.appendChild(dayInfo);
    row.appendChild(dayTasks);
    return row;
  }

  function addMonth(year, month) {
    const hidden = new Set(loadHiddenMonths());
    const monthKey = monthKeyFromYearMonth(year, month);
    if (hidden.has(monthKey)) return;

    const monthName = MONTHS_FULL[month - 1];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const monthSec = document.createElement("div");
    monthSec.className = "month-sec";

    const label = document.createElement("div");
    label.className = "month-label";

    const nameEl = document.createElement("div");
    nameEl.className = "month-name auto";
    nameEl.textContent = `${monthName} ${year}`;

    const line = document.createElement("div");
    line.className = "month-line";

    const tag = document.createElement("div");
    tag.className = "month-tag";
    tag.textContent = `${MONTHS_SHORT[month - 1]} 1 – ${MONTHS_SHORT[month - 1]} ${daysInMonth}`;

    label.appendChild(nameEl);
    label.appendChild(line);
    label.appendChild(tag);
    monthSec.appendChild(label);

    monthSec.dataset.monthKey = monthKey;

    const secondSaturday = getSecondSaturdayDay(year, month);

    let weekNum = getMaxWeekNumber();
    // Build weeks from 1..daysInMonth, with week segments Sun-Sat.
    let currentDay = 1;
    while (currentDay <= daysInMonth) {
      // Find the Sunday of this segment
      const firstDow = new Date(
        Date.UTC(year, month - 1, currentDay),
      ).getUTCDay();
      const segStart = new Date(Date.UTC(year, month - 1, currentDay));
      segStart.setUTCDate(currentDay - firstDow);

      const segEnd = new Date(segStart);
      segEnd.setUTCDate(segStart.getUTCDate() + 6);

      // Clamp label dates to this month
      const labelStartDay = currentDay;
      const labelEndDay = Math.min(
        daysInMonth,
        Math.max(
          currentDay,
          segEnd.getUTCMonth() === month - 1
            ? segEnd.getUTCDate()
            : daysInMonth,
        ),
      );

      weekNum += 1;
      const wid = `w${weekNum}`;

      const week = document.createElement("div");
      week.className = "week";
      week.dataset.week = wid;

      const hdr = document.createElement("div");
      hdr.className = "week-hdr";

      const left = document.createElement("div");
      left.className = "week-hdr-left";

      const title = document.createElement("span");
      title.className = "week-title";
      title.textContent = `Week ${weekNum} — ${MONTHS_SHORT[month - 1]} ${labelStartDay}–${labelEndDay}`;

      const theme = document.createElement("span");
      theme.className = "week-theme";
      theme.textContent = "Added month";

      left.appendChild(title);
      left.appendChild(theme);

      const prog = document.createElement("div");
      prog.className = "week-prog";

      const wbarOut = document.createElement("div");
      wbarOut.className = "wbar-out";

      const wbarIn = document.createElement("div");
      wbarIn.className = "wbar-in";
      wbarIn.id = `wb-${wid}`;
      wbarIn.style.width = "0%";

      wbarOut.appendChild(wbarIn);

      const wpct = document.createElement("span");
      wpct.className = "wpct";
      wpct.id = `wp-${wid}`;
      wpct.textContent = "0%";

      prog.appendChild(wbarOut);
      prog.appendChild(wpct);

      hdr.appendChild(left);
      hdr.appendChild(prog);
      week.appendChild(hdr);

      // Add the days of this segment that belong to this month
      for (let k = 0; k < 7; k++) {
        const dt = new Date(segStart);
        dt.setUTCDate(segStart.getUTCDate() + k);
        if (dt.getUTCMonth() !== month - 1) continue;

        const day = dt.getUTCDate();
        const dow = dt.getUTCDay();

        let offText = null;
        if (dow === 0) offText = "OFF — Sunday";
        if (dow === 6 && secondSaturday === day) offText = "OFF — 2nd Saturday";

        week.appendChild(createDayRow({ dow, dayNum: day, offText }));
      }

      monthSec.appendChild(week);

      // Advance to the next Sunday (or next day after this segment)
      currentDay = labelEndDay + 1;
    }

    // Insert before deadline section
    const dlSection = document.querySelector(".dl-section");
    if (!dlSection) {
      document.querySelector(".container")?.appendChild(monthSec);
    } else {
      dlSection.parentElement.insertBefore(monthSec, dlSection);
    }

    ensureMonthRemoveButtons();
    updateMonthRemoveButtons();
  }

  function addNextMonth() {
    const last = getLastMonthFromDom();
    if (!last) return;

    let year = last.year;
    let month = last.month + 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }

    addMonth(year, month);

    // Rebuild index and re-render
    dayIndex = buildDayIndex();
    render();
  }

  function ensureDateVisible(iso) {
    const dt = parseIsoDate(iso);
    if (!dt) return;

    // Add months until the date is visible
    let guard = 0;
    while (!dayIndex.has(iso) && guard < 24) {
      const last = getLastMonthFromDom();
      if (!last) return;

      // If the target is before the last month shown, we can't render backwards.
      const shownLast = new Date(Date.UTC(last.year, last.month - 1, 1));
      const targetMonthStart = new Date(
        Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1),
      );
      if (targetMonthStart.getTime() < shownLast.getTime()) return;

      addNextMonth();
      guard += 1;
    }
  }

  function addNewTaskFlow() {
    const textIn = prompt("Task name:");
    if (textIn === null) return;
    const text = textIn.trim();
    if (!text) return;

    // Default to earliest visible date
    const defaultStart = dayIndex.size
      ? Array.from(dayIndex.keys()).sort()[0]
      : "2026-04-13";

    const startIn = prompt("Start date (YYYY-MM-DD):", defaultStart);
    if (startIn === null) return;
    const start = startIn.trim();
    if (!parseIsoDate(start)) {
      alert("Invalid start date. Use YYYY-MM-DD.");
      return;
    }

    ensureDateVisible(start);

    if (!dayIndex.has(start)) {
      alert(
        "That start date isn't visible yet. Click 'Add next month' and try again.",
      );
      return;
    }

    const endIn = prompt(
      "End date (YYYY-MM-DD). Leave blank for single-day task:",
      start,
    );
    if (endIn === null) return;
    const end = (endIn.trim() || start).trim();

    const startDt = parseIsoDate(start);
    const endDt = parseIsoDate(end);
    if (!endDt) {
      alert("Invalid end date. Use YYYY-MM-DD.");
      return;
    }
    if (endDt.getTime() < startDt.getTime()) {
      alert("End date must be the same as or after the start date.");
      return;
    }

    const priIn = prompt("Priority: h (high), m (moderate), l (low)", "m");
    if (priIn === null) return;
    const pri = priIn.trim().toLowerCase();
    if (!["h", "m", "l"].includes(pri)) {
      alert("Priority must be h, m, or l.");
      return;
    }

    const dlIn = prompt("Is this a DEADLINE task? (y/n)", "n");
    if (dlIn === null) return;
    const isDeadline = dlIn.trim().toLowerCase().startsWith("y");

    const id = nextTaskId();
    const tag = isDeadline ? "dl" : pri;

    tasks.push({ id, text, pri, tag, start, end });
    doneMap[id] = false;

    saveTasks(tasks);
    saveDone(doneMap);
    render();
  }

  function initButtons() {
    const monthBtn = document.getElementById("add-month-btn");
    const taskBtn = document.getElementById("add-task-btn");

    if (monthBtn) monthBtn.addEventListener("click", addNextMonth);
    if (taskBtn) taskBtn.addEventListener("click", addNewTaskFlow);
  }

  function init() {
    applyHiddenMonthsToDom();
    dayIndex = buildDayIndex();

    // Migrate checkbox state if needed
    if (
      !localStorage.getItem(MIGRATED_FLAG) &&
      !localStorage.getItem(DONE_STORE)
    ) {
      applyLegacyDoneToDomCheckboxes();
    }

    tasks = loadTasks();
    doneMap = loadDone();

    if (!tasks) {
      const boot = bootstrapFromDom(dayIndex);
      tasks = boot.tasks;
      if (!Object.keys(doneMap).length) doneMap = boot.doneMap;
      saveTasks(tasks);
      saveDone(doneMap);
      localStorage.setItem(MIGRATED_FLAG, "1");
    }

    render();
    initButtons();

    // Expose reset
    window.resetAll = function () {
      if (!confirm("Reset all checkboxes? Your progress will be cleared."))
        return;
      Object.keys(doneMap).forEach((k) => (doneMap[k] = false));
      saveDone(doneMap);
      render();
    };
  }

  setupAuthGate();
})();
