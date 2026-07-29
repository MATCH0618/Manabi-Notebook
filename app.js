const CATEGORIES = {
  infection: { name: "感染対策", icon: "🫧", color: "#dceee4" },
  discharge: { name: "退院・地域連携", icon: "🏡", color: "#fde6d2" },
  guidance: { name: "健康支援", icon: "🍎", color: "#f8d8d6" },
  mental: { name: "メンタルヘルス", icon: "🌙", color: "#e8e1f2" },
  teamwork: { name: "多職種連携", icon: "🤝", color: "#f8e7ad" },
  system: { name: "制度・社会資源", icon: "📚", color: "#dbeaf3" }
};

const CARDS = [
  { id: "standard", category: "infection", title: "標準予防策" },
  { id: "route", category: "infection", title: "感染経路別予防策" },
  { id: "exposure", category: "infection", title: "針刺し・曝露時対応" },
  { id: "vaccination", category: "infection", title: "予防接種と感染管理" },
  { id: "discharge-plan", category: "discharge", title: "退院支援の流れ" },
  { id: "home-care", category: "discharge", title: "在宅療養への移行" },
  { id: "community", category: "discharge", title: "地域資源とのつなぎ方" },
  { id: "lifestyle", category: "guidance", title: "生活習慣への支援" },
  { id: "interview", category: "guidance", title: "保健面談の進め方" },
  { id: "health-literacy", category: "guidance", title: "ヘルスリテラシー" },
  { id: "stress", category: "mental", title: "ストレスへの気づき" },
  { id: "return-work", category: "mental", title: "復職・就労支援" },
  { id: "crisis", category: "mental", title: "危機介入の基本" },
  { id: "conference", category: "teamwork", title: "多職種カンファレンス" },
  { id: "coordination", category: "teamwork", title: "院内外の連携調整" },
  { id: "nursing-care", category: "system", title: "介護保険の基本" },
  { id: "welfare", category: "system", title: "使える社会資源" },
  { id: "privacy", category: "system", title: "個人情報と記録" }
];

const MASTERY_LABELS = ["未着手", "触れてみた", "だいたい分かった", "説明できそう", "仕事で活かせそう"];
const STORAGE_KEY = "manabi-partner-v1";

const defaultState = {
  cards: {},
  sessions: [],
  xp: 0,
  recommendations: ["standard", "discharge-plan", "interview"]
};

let state = loadState();
let currentCard = null;
let selectedMinutes = 10;
let timerId = null;
let timerSeconds = 0;
let activeFilter = "all";
let calendarCursor = new Date();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState, ...saved, cards: saved?.cards || {}, sessions: saved?.sessions || [] };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cardProgress(id) {
  return state.cards[id] || { mastery: 0, minutes: 0, sessions: 0, lastStudied: null };
}

function getLevel() {
  return Math.floor(state.xp / 100) + 1;
}

function getStreak() {
  const learned = new Set(state.sessions.map((session) => session.date.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  if (!learned.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (learned.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatShortDate(iso) {
  if (!iso) return "まだ学んでいません";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderAll() {
  renderHeader();
  renderHome();
  renderFilters();
  renderCards();
  renderSkills();
  renderJournal();
  renderPet();
}

function renderHeader() {
  const now = new Date();
  $("#today-label").textContent = `${now.getMonth() + 1}月${now.getDate()}日 ${["日", "月", "火", "水", "木", "金", "土"][now.getDay()]}曜日`;
  $("#header-level").textContent = getLevel();
}

function renderHome() {
  const hour = new Date().getHours();
  $("#hero-greeting").textContent = hour < 11 ? "おはようございます" : hour < 18 ? "おつかれさまです" : "おかえりなさい";
  $("#streak-count").textContent = getStreak();
  $("#total-minutes").textContent = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  $("#week-count").textContent = sessionsThisWeek().length;

  const list = $("#recommendation-list");
  list.innerHTML = state.recommendations.map((id) => {
    const card = CARDS.find((item) => item.id === id);
    const category = CATEGORIES[card.category];
    const progress = cardProgress(id);
    const sub = progress.mastery ? `${MASTERY_LABELS[progress.mastery]}・累計${progress.minutes}分` : "はじめてのカード";
    return `
      <article class="recommendation">
        <span class="card-icon" style="background:${category.color}">${category.icon}</span>
        <div><h3>${card.title}</h3><p>${category.name} · ${sub}</p></div>
        <button class="start-button" data-study="${card.id}">はじめる</button>
      </article>`;
  }).join("");

  const days = startOfWeekDates();
  const learned = new Set(state.sessions.map((session) => session.date.slice(0, 10)));
  $("#week-dots").innerHTML = days.map((date) => {
    const key = localDateKey(date);
    const classes = [learned.has(key) ? "done" : "", key === localDateKey() ? "today" : ""].join(" ");
    return `<span class="day-dot ${classes}"><i>${learned.has(key) ? "✓" : "·"}</i>${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}</span>`;
  }).join("");
}

function renderFilters() {
  const filters = [{ id: "all", name: "すべて" }, ...Object.entries(CATEGORIES).map(([id, item]) => ({ id, name: item.name }))];
  $("#category-filters").innerHTML = filters.map((filter) =>
    `<button class="filter-chip ${activeFilter === filter.id ? "active" : ""}" data-filter="${filter.id}">${filter.name}</button>`
  ).join("");
}

function renderCards() {
  const cards = activeFilter === "all" ? CARDS : CARDS.filter((card) => card.category === activeFilter);
  $("#knowledge-card-grid").innerHTML = cards.map((card) => {
    const category = CATEGORIES[card.category];
    const progress = cardProgress(card.id);
    return `
      <button class="knowledge-card" data-study="${card.id}" style="--card-color:${category.color}">
        <span class="card-icon" style="background:${category.color}">${category.icon}</span>
        <span class="category">${category.name}</span>
        <h3>${card.title}</h3>
        <span class="mastery-row" aria-label="習熟度 ${progress.mastery}/4">
          ${[1, 2, 3, 4].map((level) => `<i class="${progress.mastery >= level ? "filled" : ""}"></i>`).join("")}
        </span>
        <span class="card-meta"><span>${MASTERY_LABELS[progress.mastery]}</span><span>${progress.minutes}分</span></span>
      </button>`;
  }).join("");
}

function renderSkills() {
  const scores = Object.keys(CATEGORIES).map((categoryId) => {
    const cards = CARDS.filter((card) => card.category === categoryId);
    const points = cards.reduce((sum, card) => sum + cardProgress(card.id).mastery, 0);
    return { categoryId, cards, points, percent: Math.round((points / (cards.length * 4)) * 100) };
  });
  const total = scores.reduce((sum, score) => sum + score.points, 0);
  const overall = Math.round((total / (CARDS.length * 4)) * 100);
  $("#overall-percent").textContent = `${overall}%`;
  $("#overall-progress").style.width = `${overall}%`;
  $("#skill-list").innerHTML = scores.map((score) => {
    const category = CATEGORIES[score.categoryId];
    const level = score.percent === 100 ? 5 : Math.floor(score.percent / 25) + 1;
    const learned = score.cards.filter((card) => cardProgress(card.id).mastery > 0).length;
    return `
      <article class="skill-item" style="--skill-color:${category.color}">
        <div class="skill-top">
          <span class="card-icon" style="background:${category.color}">${category.icon}</span>
          <div><h3>${category.name}</h3><p>${learned}/${score.cards.length}カードにふれました</p></div>
          <span class="skill-level">Lv.${level}</span>
        </div>
        <div class="skill-progress"><span style="width:${score.percent}%"></span></div>
      </article>`;
  }).join("");
}

function renderJournal() {
  const totalMinutes = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  $("#journal-minutes").textContent = `${totalMinutes}分`;
  renderCalendar();

  const recent = [...state.sessions].reverse().slice(0, 6);
  $("#history-list").innerHTML = recent.length ? recent.map((session) => {
    const card = CARDS.find((item) => item.id === session.cardId);
    const category = CATEGORIES[card.category];
    return `
      <article class="history-item">
        <span class="card-icon" style="background:${category.color};width:36px;height:36px">${category.icon}</span>
        <div><h3>${card.title}</h3><p>${category.name} · ${MASTERY_LABELS[session.mastery]}</p></div>
        <time>${formatShortDate(session.date)}<br>${session.minutes}分</time>
      </article>`;
  }).join("") : `<p class="history-empty">最初のカードを学ぶと、ここに自動で記録されます。</p>`;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  $("#calendar-title").textContent = `${year}年 ${month + 1}月`;
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const learned = new Set(state.sessions.map((session) => session.date.slice(0, 10)));
  const today = localDateKey();
  let monthCount = 0;
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = localDateKey(date);
    const currentMonth = date.getMonth() === month;
    if (currentMonth && learned.has(key)) monthCount += state.sessions.filter((session) => session.date.slice(0, 10) === key).length;
    const classes = [currentMonth ? "" : "muted", learned.has(key) ? "learned" : "", key === today ? "today" : ""].join(" ");
    cells.push(`<span class="calendar-day ${classes}">${date.getDate()}</span>`);
  }
  $("#calendar-grid").innerHTML = cells.join("");
  $("#month-sessions").textContent = `${monthCount}回`;
}

function renderPet() {
  const level = getLevel();
  const currentXp = state.xp % 100;
  $("#room-level").textContent = level;
  $("#xp-label").textContent = `${currentXp} / 100 XP`;
  $("#xp-progress").style.width = `${currentXp}%`;
  const messages = state.sessions.length
    ? ["今日の積み重ね、ちゃんと残ってるよ。", "いっしょに育ってきたね！", "次はどのカードにする？"]
    : ["最初の一歩、いっしょに始めよう。"];
  $("#room-message").textContent = messages[state.sessions.length % messages.length];
}

function startOfWeekDates() {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function sessionsThisWeek() {
  const start = startOfWeekDates()[0];
  start.setHours(0, 0, 0, 0);
  return state.sessions.filter((session) => new Date(session.date) >= start);
}

function switchPage(target) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.dataset.page === target));
  $$(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.target === target));
  const titles = { home: "きょうの手帳", cards: "知識カード", skills: "スキルガーデン", journal: "まなび手帳", pet: "相棒の部屋" };
  $("#page-title").textContent = titles[target];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openStudy(cardId) {
  currentCard = CARDS.find((card) => card.id === cardId);
  const category = CATEGORIES[currentCard.category];
  $("#dialog-icon").textContent = category.icon;
  $("#dialog-icon").style.background = category.color;
  $("#dialog-category").textContent = category.name;
  $("#dialog-title").textContent = currentCard.title;
  $("#study-setup").hidden = false;
  $("#study-timer").hidden = true;
  $("#study-result").hidden = true;
  $("#study-dialog").showModal();
}

function beginTimer(minutes) {
  selectedMinutes = minutes;
  timerSeconds = minutes * 60;
  $("#study-setup").hidden = true;
  $("#study-timer").hidden = false;
  $("#timer-card-title").textContent = currentCard.title;
  updateTimerDisplay();
  clearInterval(timerId);
  timerId = setInterval(() => {
    timerSeconds -= 1;
    updateTimerDisplay();
    if (timerSeconds <= 0) showResult();
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  $("#timer-display").textContent = `${minutes}:${seconds}`;
}

function showResult() {
  clearInterval(timerId);
  $("#study-timer").hidden = true;
  $("#study-result").hidden = false;
}

function completeStudy(mastery) {
  const existing = cardProgress(currentCard.id);
  state.cards[currentCard.id] = {
    mastery: Math.max(existing.mastery, mastery),
    minutes: existing.minutes + selectedMinutes,
    sessions: existing.sessions + 1,
    lastStudied: new Date().toISOString()
  };
  state.sessions.push({ cardId: currentCard.id, minutes: selectedMinutes, mastery, date: new Date().toISOString() });
  state.xp += selectedMinutes + mastery * 5;
  saveState();
  $("#study-dialog").close();
  renderAll();
  showToast(`こむぎが喜んでいます！ +${selectedMinutes + mastery * 5} XP`);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-target]");
  if (nav) switchPage(nav.dataset.target);

  const study = event.target.closest("[data-study]");
  if (study) openStudy(study.dataset.study);

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    activeFilter = filter.dataset.filter;
    renderFilters();
    renderCards();
  }

  const duration = event.target.closest("[data-minutes]");
  if (duration) beginTimer(Number(duration.dataset.minutes));

  const mastery = event.target.closest("[data-mastery]");
  if (mastery) completeStudy(Number(mastery.dataset.mastery));
});

$("#pet-shortcut").addEventListener("click", () => switchPage("pet"));
$("#finish-now").addEventListener("click", showResult);
$("#shuffle-recommendations").addEventListener("click", () => {
  const shuffled = [...CARDS].sort(() => Math.random() - .5).slice(0, 3).map((card) => card.id);
  state.recommendations = shuffled;
  saveState();
  renderHome();
  showToast("おすすめを入れ替えました");
});
$("#prev-month").addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendar();
});
$("#next-month").addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendar();
});
$("#study-dialog").addEventListener("close", () => clearInterval(timerId));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

renderAll();
