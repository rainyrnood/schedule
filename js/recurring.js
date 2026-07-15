// ─── Recurring Rules (반복 일정: 매주 요일 반복) ───
// 규칙은 별도 키(ot-recurring)에 저장하고, 화면이 보는 날짜 범위만큼 실제 Task 인스턴스를 생성한다.
// 인스턴스는 recurringId(규칙)·recurringDate(발생일)를 가진 일반 Task라서
// 캘린더·시간 배지·주간 요약·완료 체크·드래그 등 기존 기능이 수정 없이 그대로 동작한다.
const RECURRING_KEY = 'ot-recurring';
const RECURRING_HORIZON_DAYS = 62; // 앱 시작 시 오늘부터 미리 생성해 둘 범위

function loadRecurringRules() {
  try { return JSON.parse(localStorage.getItem(RECURRING_KEY)) || []; }
  catch { return []; }
}

function saveRecurringRules(rules) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(rules));
}

// 'YYYY-MM-DD' → 로컬 자정 Date (new Date('YYYY-MM-DD')는 UTC 해석이라 하루 밀릴 수 있음)
function dateStrToLocalDate(s) {
  const parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDaysToDateStr(dateStr, n) {
  const d = dateStrToLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}

// 요일 배열(0=일~6=토) → 표시 라벨
function recurringDaysLabel(days) {
  if (!days || days.length === 0) return '-';
  if (days.length === 7) return '매일';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return '평일';
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => names[d]).join('·');
}

// [rangeStart, rangeEnd] 구간(양끝 포함)에 규칙 인스턴스를 멱등 생성. 생성된 개수 반환.
// 규칙 id + 발생일(recurringDate) 조합으로 중복을 막으므로 몇 번을 불러도 안전하다.
function ensureRecurringInstances(rangeStartStr, rangeEndStr) {
  const rules = loadRecurringRules();
  if (rules.length === 0) return 0;

  const tasks = loadTasks();
  const existing = new Set();
  for (const t of tasks) {
    if (t.recurringId && t.recurringDate) existing.add(t.recurringId + '|' + t.recurringDate);
  }

  let created = 0;
  for (const rule of rules) {
    if (!rule.days || rule.days.length === 0) continue;
    const startStr = rule.startDate && rule.startDate > rangeStartStr ? rule.startDate : rangeStartStr;
    const endStr = rule.endDate && rule.endDate < rangeEndStr ? rule.endDate : rangeEndStr;
    if (startStr > endStr) continue;
    const exceptions = new Set(rule.exceptions || []);
    const cur = dateStrToLocalDate(startStr);
    const end = dateStrToLocalDate(endStr);
    while (cur <= end) {
      const ds = toLocalDateStr(cur);
      if (rule.days.includes(cur.getDay()) && !exceptions.has(ds) && !existing.has(rule.id + '|' + ds)) {
        tasks.push({
          id: generateId(),
          name: rule.name,
          description: rule.description || '',
          priority: rule.priority || 'medium',
          duration: rule.duration || 1,
          category1: rule.category1 || '',
          category2: rule.category2 || '',
          category3: rule.category3 || '',
          dueDate: ds,
          dueTime: '',
          scheduledDate: ds,
          scheduledTime: rule.time || '',
          done: false,
          order: tasks.length,
          createdAt: new Date().toISOString(),
          recurringId: rule.id,
          recurringDate: ds,
        });
        existing.add(rule.id + '|' + ds);
        created++;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  if (created > 0) saveTasks(tasks);
  return created;
}

function ensureRecurringDefaultHorizon() {
  return ensureRecurringInstances(todayStr(), addDaysToDateStr(todayStr(), RECURRING_HORIZON_DAYS));
}

function upsertRecurringRule(rule) {
  const rules = loadRecurringRules();
  const idx = rules.findIndex(r => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule; else rules.push(rule);
  saveRecurringRules(rules);
}

// 오늘 이후(오늘 포함)의 미완료 인스턴스 제거 — 규칙 수정·삭제 시 사용.
// 지난 기록과 완료된 항목은 보존한다.
function removeFutureUndoneInstances(ruleId) {
  const today = todayStr();
  const tasks = loadTasks().filter(t =>
    !(t.recurringId === ruleId && !t.done && (t.recurringDate || t.scheduledDate || today) >= today)
  );
  saveTasks(tasks);
}

function deleteRecurringRule(ruleId) {
  removeFutureUndoneInstances(ruleId);
  saveRecurringRules(loadRecurringRules().filter(r => r.id !== ruleId));
}

// 개별 인스턴스 삭제 시 해당 발생일을 예외로 기록해 재생성을 막는다.
function addRecurringException(ruleId, dateStr) {
  if (!dateStr) return;
  const rules = loadRecurringRules();
  const rule = rules.find(r => r.id === ruleId);
  if (!rule) return;
  if (!rule.exceptions) rule.exceptions = [];
  if (!rule.exceptions.includes(dateStr)) {
    rule.exceptions.push(dateStr);
    saveRecurringRules(rules);
  }
}

// ─── 반복 일정 관리 모달 ───
function openRecurringModal() {
  renderRecurringRuleList();
  document.getElementById('recurring-modal').classList.add('active');
}

function closeRecurringModal() {
  document.getElementById('recurring-modal').classList.remove('active');
}

function renderRecurringRuleList() {
  const container = document.getElementById('recurring-rule-list');
  const rules = loadRecurringRules();
  if (rules.length === 0) {
    container.innerHTML = '<div class="rule-empty">등록된 반복 일정이 없습니다.</div>';
    return;
  }
  container.innerHTML = rules.map(r => {
    const timeStr = r.time
      ? formatHourShort(parseTimeToDecimal(r.time)) + '~' + formatHourShort(parseTimeToDecimal(r.time) + (r.duration || 1))
      : '시간 미지정';
    const period = (r.startDate || '') + ' ~ ' + (r.endDate || '계속');
    const exceptStr = (r.exceptions && r.exceptions.length) ? ' | 제외 ' + r.exceptions.length + '일' : '';
    return '<div class="rule-item">' +
      '<div class="rule-priority priority-' + (r.priority || 'medium') + '"></div>' +
      '<div class="rule-info">' +
        '<div class="rule-name">' + escapeHtml(r.name) + '</div>' +
        '<div class="rule-meta">' + recurringDaysLabel(r.days) + ' | ' + timeStr + ' | ' + formatDurationLabel(r.duration || 1) + ' | ' + period + exceptStr + '</div>' +
      '</div>' +
      '<div class="rule-actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="editRecurringRule(\'' + r.id + '\')">수정</button>' +
        '<button class="btn btn-danger btn-sm" onclick="removeRecurringRuleFromList(\'' + r.id + '\')">삭제</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function editRecurringRule(ruleId) {
  closeRecurringModal();
  openRuleModal(ruleId);
}

function removeRecurringRuleFromList(ruleId) {
  const rule = loadRecurringRules().find(r => r.id === ruleId);
  if (!rule) return;
  if (!confirm('반복 일정 "' + rule.name + '"을(를) 삭제하시겠습니까?\n오늘 이후의 완료되지 않은 항목이 함께 삭제됩니다. (지난 기록은 보존)')) return;
  deleteRecurringRule(ruleId);
  renderRecurringRuleList();
  renderAll();
}
