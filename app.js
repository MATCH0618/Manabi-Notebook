const CATEGORIES = {
  metabolic: { name: "血圧・代謝", icon: "🫀", color: "#f8d8d6" },
  lipidLiver: { name: "脂質・肝臓", icon: "🧪", color: "#f8e7ad" },
  womensHealth: { name: "女性の健康", icon: "🎗️", color: "#fde6d2" },
  upperGi: { name: "胃・十二指腸", icon: "🍵", color: "#dceee4" },
  colon: { name: "大腸", icon: "🔎", color: "#dbeaf3" },
  renalBlood: { name: "腎臓・血液", icon: "🩸", color: "#e8e1f2" },
  habits: { name: "生活習慣", icon: "🌿", color: "#e4efd6" }
};

const CARDS = [
  { id: "hypertension", category: "metabolic", title: "高血圧｜判定・受診勧奨・生活指導" },
  { id: "diabetes", category: "metabolic", title: "糖尿病｜血糖・HbA1cの見方" },
  { id: "uric-acid", category: "metabolic", title: "尿酸値｜高値・痛風予防" },
  { id: "lifestyle-risk", category: "metabolic", title: "生活習慣病｜リスクの重なりと面談" },
  { id: "high-ldl", category: "lipidLiver", title: "LDLコレステロール高値" },
  { id: "low-hdl", category: "lipidLiver", title: "HDLコレステロール低値" },
  { id: "low-total-cholesterol", category: "lipidLiver", title: "総コレステロール低値" },
  { id: "high-triglycerides", category: "lipidLiver", title: "中性脂肪高値" },
  { id: "low-triglycerides", category: "lipidLiver", title: "中性脂肪低値" },
  { id: "fatty-liver", category: "lipidLiver", title: "脂肪肝｜原因と生活改善" },
  { id: "osteoporosis", category: "womensHealth", title: "骨粗鬆症｜リスクと予防" },
  { id: "cervical-cancer", category: "womensHealth", title: "子宮頸がん検診｜結果と精密検査" },
  { id: "breast-cancer", category: "womensHealth", title: "乳がん検診｜結果と精密検査" },
  { id: "gastric-polyp", category: "upperGi", title: "胃・十二指腸ポリープ" },
  { id: "peptic-ulcer", category: "upperGi", title: "胃・十二指腸潰瘍" },
  { id: "reflux", category: "upperGi", title: "逆流性食道炎" },
  { id: "h-pylori", category: "upperGi", title: "ピロリ菌｜検査・除菌・フォロー" },
  { id: "fecal-occult-blood", category: "colon", title: "便潜血陽性｜精密検査へのつなぎ方" },
  { id: "kidney-stone", category: "renalBlood", title: "腎結石｜症状・再発予防" },
  { id: "renal-cyst", category: "renalBlood", title: "腎嚢胞｜所見と経過観察" },
  { id: "urinary-lesion", category: "renalBlood", title: "腎・尿路のポリープ・腫瘤所見" },
  { id: "anemia", category: "renalBlood", title: "貧血｜数値・原因・受診の目安" },
  { id: "smoking", category: "habits", title: "喫煙習慣｜禁煙支援の進め方" },
  { id: "alcohol", category: "habits", title: "飲酒習慣｜リスク評価と節酒支援" }
];

const MASTERY_LABELS = ["未着手", "触れてみた", "だいたい分かった", "説明できそう", "仕事で活かせそう"];
const STORAGE_KEY = "manabi-partner-v1";

const defaultState = {
  cards: {},
  sessions: [],
  xp: 0,
  recommendations: ["hypertension", "high-ldl", "smoking"]
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
    const validIds = new Set(CARDS.map((card) => card.id));
    const cards = Object.fromEntries(
      Object.entries(saved?.cards || {}).filter(([id]) => validIds.has(id))
    );
    const sessions = (saved?.sessions || []).filter((session) => validIds.has(session.cardId));
    const recommendations = (saved?.recommendations || []).filter((id) => validIds.has(id));

    return {
      ...defaultState,
      ...saved,
      cards,
      sessions,
      recommendations: recommendations.length === 3
        ? recommendations
        : [...defaultState.recommendations]
    };
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
  $("#ai-prompt-text").value = buildAiPrompt();
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

function buildAiPrompt() {
  const category = CATEGORIES[currentCard.category];
  return `あなたは、人間ドック後の健康相談を担当する保健師向けの学習コーチです。

【今回のテーマ】
${currentCard.title}
【分野】${category.name}
【学習時間】${selectedMinutes}分

日本の成人健診・人間ドック後の健康相談を想定し、次の順で実務的に教えてください。
1. 検査結果・所見の基本的な見方
2. 主な原因、危険因子、関連する病気
3. 健康相談で確認する質問
4. 本人へ伝わりやすい説明例
5. 生活改善の支援ポイント
6. 受診・精密検査を勧める際の考え方と見逃せない症状
7. 相談場面を想定したケース問題1問
8. 最後に理解確認クイズ3問

指定時間に収まる分量にし、専門用語には短い説明を付けてください。
判定値や対応がガイドライン・年齢・性別・施設基準で異なる場合は、単一の数値で断定せず違いを明示してください。
個人の診断や治療指示は行わず、最新の公的ガイドラインと勤務先の手順を確認すべき点も示してください。
追加質問はせず、今すぐ学習を開始してください。`; 
}

async function copyAiPrompt() {
  const field = $("#ai-prompt-text");
  const prompt = field.value || buildAiPrompt();
  field.value = prompt;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
    } else {
      field.focus();
      field.select();
      if (!document.execCommand("copy")) throw new Error("copy failed");
    }
    showToast("AI学習プロンプトをコピーしました");
  } catch {
    field.focus();
    field.select();
    showToast("本文を長押ししてコピーしてください");
  }
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
$("#copy-ai-prompt").addEventListener("click", copyAiPrompt);
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
