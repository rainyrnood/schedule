// ─── Helpers (timezone-safe local date) ───
function toLocalDateStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayStr() {
  return toLocalDateStr(new Date());
}

function priorityLabel(p) {
  return { high: '높음', medium: '보통', low: '낮음', none: '없음' }[p] || p;
}

function priorityWeight(p) {
  return { high: 3, medium: 2, low: 1, none: 0 }[p] || 0;
}

// 낮음은 하늘색 — 완료 회색·성공 초록·테마 에메랄드와 구분되도록 초록 계열 사용 금지
function priorityColor(p) {
  return { high: '#f87171', medium: '#fdba74', low: '#38bdf8', none: '#cbd5e1' }[p] || '#94a3b8';
}

// 칩 배경 위에 올라가는 글씨 색 (밝은 배경인 보통·낮음·없음은 진한 글씨로 가독성 확보)
function priorityTextColor(p) {
  return { high: '#ffffff', medium: '#7c2d12', low: '#0c4a6e', none: '#334155' }[p] || '#ffffff';
}

// 마감 마커(외곽선·투명 배경) — 흰 셀 위에서도 읽히도록 진한 색 사용
function priorityMarkerColor(p) {
  return { high: '#dc2626', medium: '#b45309', low: '#0369a1', none: '#475569' }[p] || '#475569';
}

// ─── Decimal Formatting (최대 소수점 둘째자리) ───
function formatDecimal(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  // Round to 2 decimal places
  const rounded = Math.round(n * 100) / 100;
  // Remove trailing zeros
  if (rounded === Math.floor(rounded)) return String(Math.floor(rounded));
  const s = rounded.toFixed(2);
  // Remove trailing zero after decimal point (e.g. "1.50" → "1.5")
  return s.replace(/0$/, '');
}

function dueBadge(dateStr) {
  if (!dateStr) return '';
  const today = todayStr();
  if (dateStr < today) {
    const diff = Math.ceil((new Date(today) - new Date(dateStr)) / 86400000);
    return '<span class="task-badge badge-overdue">기한 초과 ' + diff + '일</span>';
  }
  if (dateStr === today) return '<span class="task-badge badge-today">오늘 마감</span>';
  const diff = Math.ceil((new Date(dateStr) - new Date(today)) / 86400000);
  if (diff <= 3) return '<span class="task-badge badge-upcoming">' + diff + '일 남음</span>';
  return '';
}

function formatDate(d) {
  if (!d) return '-';
  const parts = d.split('-');
  return parseInt(parts[1]) + '/' + parseInt(parts[2]);
}

// ─── Time Slot Calculation ───
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const MAX_HOURS = 8;

function computeDaySchedule(dateStr) {
  const lunch = getLunchConfig();
  const lunchStartH = parseTimeToDecimal(lunch.start);
  const lunchEndH = parseTimeToDecimal(lunch.end);
  const lunchDuration = lunchEndH - lunchStartH;

  const tasks = loadTasks();
  // 완료된 항목도 시간 계산에 포함
  const dayTasks = tasks
    .filter(t => t.scheduledDate === dateStr)
    .sort((a, b) => {
      if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;
      // 시간 미지정 Task는 우선순위 순으로 정렬
      const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (pw !== 0) return pw;
      return (a.order || 0) - (b.order || 0);
    });

  // 시간 지정된 Task와 미지정 Task 분리
  const timedTasks = dayTasks.filter(t => t.scheduledTime);
  const untimedTasks = dayTasks.filter(t => !t.scheduledTime);

  let currentHour = WORK_START_HOUR;
  const slots = [];

  for (const t of timedTasks) {
    const dur = t.duration || 1;
    const [hh, mm] = t.scheduledTime.split(':').map(Number);
    const startH = hh + mm / 60;
    const endH = startH + dur;
    slots.push({
      ...t,
      startHour: startH,
      endHour: endH,
      startTime: formatHour(startH),
      endTime: formatHour(endH),
    });
    currentHour = Math.max(currentHour, endH);
  }

  const totalHours = dayTasks.reduce((s, t) => s + (t.duration || 1), 0);
  const timedHours = timedTasks.reduce((s, t) => s + (t.duration || 1), 0);
  const untimedHours = untimedTasks.reduce((s, t) => s + (t.duration || 1), 0);
  return { slots, untimedTasks, totalHours, timedHours, untimedHours, lunchStartH, lunchEndH, lunchDuration };
}

function formatHour(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const period = hours < 12 ? '오전' : '오후';
  const displayH = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return period + ' ' + displayH + ':' + String(mins).padStart(2, '0');
}

function formatHourShort(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function getDayHoursMap() {
  // 완료된 항목도 시간 계산에 포함
  const tasks = loadTasks();
  const map = {};
  for (const t of tasks) {
    const d = t.scheduledDate;
    if (d) map[d] = (map[d] || 0) + (t.duration || 1);
  }
  return map;
}

function formatDurationLabel(dur) {
  const h = Math.floor(dur);
  const m = Math.round((dur - h) * 60);
  if (h > 0 && m > 0) return h + 'h' + m + 'm';
  if (h > 0) return h + 'h';
  return m + 'm';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── 요일 이름 ───
function getDayName(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}
