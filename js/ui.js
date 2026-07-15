// ─── Lunch Break Config ───
const LUNCH_START_KEY = 'ot-lunch-start';
const LUNCH_END_KEY = 'ot-lunch-end';
const DEFAULT_LUNCH_START = '12:30';
const DEFAULT_LUNCH_END = '13:30';

function getLunchConfig() {
  return {
    start: localStorage.getItem(LUNCH_START_KEY) || DEFAULT_LUNCH_START,
    end: localStorage.getItem(LUNCH_END_KEY) || DEFAULT_LUNCH_END
  };
}

function saveLunchConfig(start, end) {
  localStorage.setItem(LUNCH_START_KEY, start);
  localStorage.setItem(LUNCH_END_KEY, end);
}

function parseTimeToDecimal(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

function initLunchSettings() {
  const startSel = document.getElementById('lunch-start');
  const endSel = document.getElementById('lunch-end');
  const lunch = getLunchConfig();

  // Generate time options for start (11:00 ~ 14:00, 30-minute intervals)
  const startTimes = [];
  for (let h = 11; h <= 14; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 14 && m > 0) break;
      const val = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      const label = (h < 12 ? '오전 ' : '오후 ') + (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0');
      startTimes.push({ val, label });
    }
  }

  // Generate time options for end (12:00 ~ 15:00, 30-minute intervals)
  const endTimes = [];
  for (let h = 12; h <= 15; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 15 && m > 0) break;
      const val = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      const label = (h < 12 ? '오전 ' : '오후 ') + (h > 12 ? h - 12 : h === 12 ? 12 : h) + ':' + String(m).padStart(2, '0');
      endTimes.push({ val, label });
    }
  }

  startSel.innerHTML = startTimes.map(t =>
    '<option value="' + t.val + '"' + (t.val === lunch.start ? ' selected' : '') + '>' + t.label + '</option>'
  ).join('');
  endSel.innerHTML = endTimes.map(t =>
    '<option value="' + t.val + '"' + (t.val === lunch.end ? ' selected' : '') + '>' + t.label + '</option>'
  ).join('');

  startSel.addEventListener('change', function() {
    const s = this.value;
    const e = endSel.value;
    if (s >= e) {
      // Auto-adjust end to 1 hour after start
      const sH = parseTimeToDecimal(s);
      const newEnd = String(Math.floor(sH + 1)).padStart(2, '0') + ':' + String(Math.round(((sH + 1) % 1) * 60)).padStart(2, '0');
      if (endSel.querySelector('option[value="' + newEnd + '"]')) {
        endSel.value = newEnd;
      }
    }
    saveLunchConfig(startSel.value, endSel.value);
    renderAll();
  });

  endSel.addEventListener('change', function() {
    const s = startSel.value;
    const e = this.value;
    if (e <= s) {
      alert('점심 종료 시간은 시작 시간보다 뒤여야 합니다.');
      const lunch = getLunchConfig();
      this.value = lunch.end;
      return;
    }
    saveLunchConfig(startSel.value, endSel.value);
    renderAll();
  });
}

// ─── Time Picker (오전/오후, 시각, 분 각각 스크롤) ───
function initTimePickers() {
  document.querySelectorAll('.time-picker').forEach(picker => {
    const periodSel = picker.querySelector('.tp-period');
    const hourSel = picker.querySelector('.tp-hour');
    const minuteSel = picker.querySelector('.tp-minute');
    const clearBtn = picker.querySelector('.tp-clear');

    // 오전/오후 (오전이 위)
    periodSel.innerHTML = '<option value="">-</option><option value="AM">오전</option><option value="PM">오후</option>';

    // 시각: 12, 1, 2, ..., 11
    let hourHtml = '<option value="">-</option>';
    hourHtml += '<option value="12">12</option>';
    for (let h = 1; h <= 11; h++) {
      hourHtml += '<option value="' + h + '">' + h + '</option>';
    }
    hourSel.innerHTML = hourHtml;

    // 분: 00, 05, 10, ..., 55
    let minHtml = '<option value="">-</option>';
    for (let m = 0; m < 60; m += 5) {
      const mm = String(m).padStart(2, '0');
      minHtml += '<option value="' + mm + '">' + mm + '</option>';
    }
    minuteSel.innerHTML = minHtml;

    // 오전/오후 선택 시 시각/분 자동 기본값 설정
    periodSel.addEventListener('change', function() {
      if (this.value && !hourSel.value) hourSel.value = '12';
      if (this.value && !minuteSel.value) minuteSel.value = '00';
    });
    hourSel.addEventListener('change', function() {
      if (this.value && !periodSel.value) periodSel.value = 'AM';
      if (this.value && !minuteSel.value) minuteSel.value = '00';
    });
    minuteSel.addEventListener('change', function() {
      if (this.value && !periodSel.value) periodSel.value = 'AM';
      if (this.value && !hourSel.value) hourSel.value = '12';
    });

    // Clear button
    clearBtn.addEventListener('click', function() {
      periodSel.value = '';
      hourSel.value = '';
      minuteSel.value = '';
    });
  });
}

// Read HH:MM from a time picker
function getTimePickerValue(pickerId) {
  const picker = document.getElementById(pickerId);
  const period = picker.querySelector('.tp-period').value;
  const hour = picker.querySelector('.tp-hour').value;
  const minute = picker.querySelector('.tp-minute').value;

  if (!period || hour === '' || minute === '') return '';

  let h = parseInt(hour);
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return String(h).padStart(2, '0') + ':' + minute;
}

// Set HH:MM into a time picker
function setTimePickerValue(pickerId, value) {
  const picker = document.getElementById(pickerId);
  const periodSel = picker.querySelector('.tp-period');
  const hourSel = picker.querySelector('.tp-hour');
  const minuteSel = picker.querySelector('.tp-minute');

  if (!value) {
    periodSel.value = '';
    hourSel.value = '';
    minuteSel.value = '';
    return;
  }

  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr);
  const m = mStr || '00';

  if (h < 12) {
    periodSel.value = 'AM';
    hourSel.value = h === 0 ? '12' : String(h);
  } else {
    periodSel.value = 'PM';
    hourSel.value = h === 12 ? '12' : String(h - 12);
  }
  // Round to nearest 5
  let mInt = parseInt(m);
  mInt = Math.round(mInt / 5) * 5;
  if (mInt >= 60) mInt = 55;
  minuteSel.value = String(mInt).padStart(2, '0');
}

// ─── Duration Picker (시간/분 각각 5분 단위) ───
function initDurationPicker() {
  const hourSel = document.getElementById('task-duration-hour');
  const minSel = document.getElementById('task-duration-min');
  let hourHtml = '';
  for (let h = 0; h <= 12; h++) {
    hourHtml += '<option value="' + h + '">' + h + '</option>';
  }
  hourSel.innerHTML = hourHtml;
  let minHtml = '';
  for (let m = 0; m < 60; m += 5) {
    minHtml += '<option value="' + m + '">' + String(m).padStart(2, '0') + '</option>';
  }
  minSel.innerHTML = minHtml;
  // Default: 1시간 0분
  hourSel.value = '1';
  minSel.value = '0';
}

function getDurationValue() {
  const h = parseInt(document.getElementById('task-duration-hour').value) || 0;
  const m = parseInt(document.getElementById('task-duration-min').value) || 0;
  const total = h + m / 60;
  return total > 0 ? total : 0.0833; // minimum ~5min
}

function setDurationValue(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  // Round to nearest 5 min
  const roundedMin = Math.round(m / 5) * 5;
  document.getElementById('task-duration-hour').value = String(h);
  document.getElementById('task-duration-min').value = String(roundedMin >= 60 ? 55 : roundedMin);
}

// ─── Description Checklist ───
// '[ ] 항목' / '[x] 항목' 형식의 줄만 체크리스트로 인식 (GitHub 방식)
const DESC_CHECK_RE = /^(\s*)\[( |x|X)\]\s?(.*)$/;

function descHasChecklist(text) {
  return (text || '').split('\n').some(line => DESC_CHECK_RE.test(line));
}

// mode: 'edit'(textarea) | 'check'(체크리스트 뷰)
function setDescMode(mode) {
  const ta = document.getElementById('task-desc');
  const list = document.getElementById('desc-checklist');
  const btn = document.getElementById('btn-desc-mode');
  if (mode === 'check') {
    renderDescChecklist();
    ta.style.display = 'none';
    list.style.display = 'block';
    btn.textContent = '편집';
  } else {
    ta.style.display = '';
    list.style.display = 'none';
    btn.textContent = '체크리스트';
  }
  btn.dataset.mode = mode;
}

function toggleDescMode() {
  const btn = document.getElementById('btn-desc-mode');
  setDescMode(btn.dataset.mode === 'check' ? 'edit' : 'check');
}

function renderDescChecklist() {
  const ta = document.getElementById('task-desc');
  const list = document.getElementById('desc-checklist');
  if (!ta.value.trim()) {
    list.innerHTML = '<div class="desc-check-empty">내용이 없습니다. 편집 모드에서 \'[ ] 항목\' 형식으로 입력하면 체크리스트가 됩니다.</div>';
    return;
  }
  list.innerHTML = ta.value.split('\n').map((line, i) => {
    const m = line.match(DESC_CHECK_RE);
    if (m) {
      const checked = m[2].toLowerCase() === 'x';
      return '<div class="desc-check-item' + (checked ? ' checked' : '') + '" data-line="' + i + '">' +
        '<input type="checkbox"' + (checked ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(m[3]) + '</span></div>';
    }
    return '<div class="desc-check-text">' + (escapeHtml(line) || '&nbsp;') + '</div>';
  }).join('');
}

// 체크 토글: textarea 값의 해당 줄에서 [ ] ↔ [x] 교체 (저장 버튼으로 확정)
function toggleDescLine(lineIdx) {
  const ta = document.getElementById('task-desc');
  const lines = ta.value.split('\n');
  const m = (lines[lineIdx] || '').match(DESC_CHECK_RE);
  if (!m) return;
  const checked = m[2].toLowerCase() === 'x';
  lines[lineIdx] = m[1] + '[' + (checked ? ' ' : 'x') + '] ' + m[3];
  ta.value = lines.join('\n');
  renderDescChecklist();
}

document.getElementById('desc-checklist').addEventListener('click', function(e) {
  const item = e.target.closest('.desc-check-item');
  if (item) toggleDescLine(parseInt(item.dataset.line));
});

// ─── 반복 섹션 (모달) ───
function getSelectedRecurringDays() {
  return [...document.querySelectorAll('#recurring-days input:checked')].map(cb => parseInt(cb.value));
}

function setRecurringDays(days) {
  document.querySelectorAll('#recurring-days input').forEach(cb => {
    cb.checked = days.includes(parseInt(cb.value));
  });
  updateRecurringEndVisibility();
}

function setRecurringPreset(preset) {
  if (preset === 'weekday') setRecurringDays([1, 2, 3, 4, 5]);
  else if (preset === 'daily') setRecurringDays([0, 1, 2, 3, 4, 5, 6]);
  else setRecurringDays([]);
}

function updateRecurringEndVisibility() {
  const any = getSelectedRecurringDays().length > 0;
  document.getElementById('recurring-end-row').style.display = any ? 'flex' : 'none';
  document.getElementById('recurring-hint').style.display = any ? 'block' : 'none';
}

document.querySelectorAll('#recurring-days input').forEach(cb => {
  cb.addEventListener('change', updateRecurringEndVisibility);
});

// 모달의 반복 관련 요소 상태 설정
// mode: 'new'(요일 선택 가능) | 'task'(숨김) | 'instance'(안내 표시) | 'rule'(요일 선택 + 마감일 숨김)
function setModalRecurringState(mode) {
  const group = document.getElementById('recurring-group');
  const note = document.getElementById('recurring-instance-note');
  const dueGroup = document.getElementById('due-group');
  const schedLabel = document.getElementById('label-scheduled');

  group.style.display = (mode === 'new' || mode === 'rule') ? '' : 'none';
  note.style.display = mode === 'instance' ? 'flex' : 'none';
  dueGroup.style.display = mode === 'rule' ? 'none' : '';
  schedLabel.textContent = mode === 'rule' ? '반복 시작일' : '배정일 (Scheduled)';
  if (mode === 'new') {
    setRecurringDays([]);
    document.getElementById('recurring-end').value = '';
  }
  if (mode !== 'rule') document.getElementById('rule-id').value = '';
}

// ─── Modal ───
// defaults: { scheduledDate, dueDate } - optional overrides for new task creation
function openModal(taskId, defaults) {
  const modal = document.getElementById('task-modal');
  const isEdit = !!taskId;

  document.getElementById('modal-title').textContent = isEdit ? 'Task 수정' : '새 Task 만들기';
  document.getElementById('btn-delete').style.display = isEdit ? 'inline-flex' : 'none';

  const btnDone = document.getElementById('btn-toggle-done');

  refreshCategoryDatalists();

  if (isEdit) {
    const task = loadTasks().find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-name').value = task.name;
    document.getElementById('task-desc').value = task.description || '';
    setDescMode(descHasChecklist(task.description) ? 'check' : 'edit');
    document.getElementById('task-priority').value = task.priority;
    setDurationValue(task.duration || 1);
    document.getElementById('task-category1').value = task.category1 || '';
    document.getElementById('task-category2').value = task.category2 || '';
    document.getElementById('task-category3').value = task.category3 || '';
    document.getElementById('task-scheduled').value = task.scheduledDate || '';
    setTimePickerValue('tp-scheduled', task.scheduledTime || '');
    document.getElementById('task-due').value = task.dueDate || '';
    setTimePickerValue('tp-due', task.dueTime || '');
    setModalRecurringState(task.recurringId ? 'instance' : 'task');

    btnDone.style.display = 'inline-flex';
    if (task.done) {
      btnDone.textContent = '완료 해제';
      btnDone.className = 'btn btn-warning';
    } else {
      btnDone.textContent = '완료';
      btnDone.className = 'btn btn-success';
    }
  } else {
    document.getElementById('task-id').value = '';
    document.getElementById('task-name').value = '';
    document.getElementById('task-desc').value = '';
    setDescMode('edit');
    document.getElementById('task-priority').value = 'medium';
    setDurationValue(1);
    document.getElementById('task-category1').value = '';
    document.getElementById('task-category2').value = '';
    document.getElementById('task-category3').value = '';
    // defaults 파라미터로 전달된 날짜 사용 (캘린더 날짜 클릭 시)
    const schedDate = (defaults && defaults.scheduledDate) || todayStr();
    const dueDate = (defaults && defaults.dueDate) || todayStr();
    document.getElementById('task-scheduled').value = schedDate;
    setTimePickerValue('tp-scheduled', '');
    document.getElementById('task-due').value = dueDate;
    setTimePickerValue('tp-due', '');
    setModalRecurringState('new');
    btnDone.style.display = 'none';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('task-name').focus(), 100);
}

// ─── 반복 규칙 수정 (Task 모달 재사용) ───
function openRuleModal(ruleId) {
  const rule = loadRecurringRules().find(r => r.id === ruleId);
  if (!rule) return;
  const modal = document.getElementById('task-modal');

  document.getElementById('modal-title').textContent = '반복 일정 수정';
  document.getElementById('btn-delete').style.display = 'inline-flex';
  document.getElementById('btn-toggle-done').style.display = 'none';
  refreshCategoryDatalists();

  document.getElementById('task-id').value = '';
  document.getElementById('rule-id').value = rule.id;
  document.getElementById('task-name').value = rule.name;
  document.getElementById('task-desc').value = rule.description || '';
  setDescMode(descHasChecklist(rule.description) ? 'check' : 'edit');
  document.getElementById('task-priority').value = rule.priority || 'medium';
  setDurationValue(rule.duration || 1);
  document.getElementById('task-category1').value = rule.category1 || '';
  document.getElementById('task-category2').value = rule.category2 || '';
  document.getElementById('task-category3').value = rule.category3 || '';
  document.getElementById('task-scheduled').value = rule.startDate || todayStr();
  setTimePickerValue('tp-scheduled', rule.time || '');
  document.getElementById('task-due').value = '';
  setTimePickerValue('tp-due', '');

  setModalRecurringState('rule');
  setRecurringDays(rule.days || []);
  document.getElementById('recurring-end').value = rule.endDate || '';

  modal.classList.add('active');
  setTimeout(() => document.getElementById('task-name').focus(), 100);
}

function closeModal() {
  document.getElementById('task-modal').classList.remove('active');
}

function toggleDoneFromModal() {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveTasks(tasks);
    closeModal();
    renderAll();
  }
}

function saveTask() {
  const name = document.getElementById('task-name').value.trim();
  const due = document.getElementById('task-due').value;
  if (!name) { alert('제목을 입력하세요.'); return; }

  const id = document.getElementById('task-id').value;
  const ruleId = document.getElementById('rule-id').value;
  const recurringDays = getSelectedRecurringDays();

  // 반복 규칙 저장: 규칙 수정 모드이거나, 신규 생성에서 반복 요일을 선택한 경우
  if (ruleId || (!id && recurringDays.length > 0)) {
    saveRecurringFromModal(ruleId, recurringDays, name);
    return;
  }

  const tasks = loadTasks();

  const cat1 = document.getElementById('task-category1').value.trim();
  const cat2 = document.getElementById('task-category2').value.trim();
  const cat3 = document.getElementById('task-category3').value.trim();

  const data = {
    name,
    description: document.getElementById('task-desc').value.trim(),
    priority: document.getElementById('task-priority').value,
    duration: getDurationValue(),
    category1: cat1,
    category2: cat2,
    category3: cat3,
    dueDate: due,
    dueTime: getTimePickerValue('tp-due'),
    scheduledDate: document.getElementById('task-scheduled').value || due,
    scheduledTime: getTimePickerValue('tp-scheduled'),
  };

  if (id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx >= 0) Object.assign(tasks[idx], data);
  } else {
    tasks.push({ id: generateId(), ...data, done: false, order: tasks.length, createdAt: new Date().toISOString() });
  }

  updateCategoryMap(cat1, cat2, cat3);

  saveTasks(tasks);
  closeModal();
  renderAll();
}

// 모달 내용으로 반복 규칙 생성·수정. 수정 시 오늘 이후 미완료 인스턴스를 새 규칙으로 재생성한다.
function saveRecurringFromModal(ruleId, days, name) {
  if (days.length === 0) { alert('반복 요일을 선택하세요.'); return; }
  const startDate = document.getElementById('task-scheduled').value || todayStr();
  const endDate = document.getElementById('recurring-end').value || '';
  if (endDate && endDate < startDate) { alert('반복 종료일은 시작일보다 뒤여야 합니다.'); return; }

  const cat1 = document.getElementById('task-category1').value.trim();
  const cat2 = document.getElementById('task-category2').value.trim();
  const cat3 = document.getElementById('task-category3').value.trim();

  const prev = ruleId ? loadRecurringRules().find(r => r.id === ruleId) : null;
  const rule = {
    id: ruleId || generateId(),
    name,
    description: document.getElementById('task-desc').value.trim(),
    priority: document.getElementById('task-priority').value,
    duration: getDurationValue(),
    category1: cat1,
    category2: cat2,
    category3: cat3,
    time: getTimePickerValue('tp-scheduled'),
    days,
    startDate,
    endDate,
    exceptions: prev ? (prev.exceptions || []) : [],
    createdAt: prev ? prev.createdAt : new Date().toISOString(),
  };

  upsertRecurringRule(rule);
  removeFutureUndoneInstances(rule.id);
  ensureRecurringDefaultHorizon();
  updateCategoryMap(cat1, cat2, cat3);
  closeModal();
  renderAll();
}

function deleteTask() {
  const id = document.getElementById('task-id').value;
  const ruleId = document.getElementById('rule-id').value;

  // 반복 규칙 수정 모드에서의 삭제 = 규칙 자체 삭제
  if (!id && ruleId) {
    const rule = loadRecurringRules().find(r => r.id === ruleId);
    if (!rule) return;
    if (!confirm('반복 일정 "' + rule.name + '"을(를) 삭제하시겠습니까?\n오늘 이후의 완료되지 않은 항목이 함께 삭제됩니다. (지난 기록은 보존)')) return;
    deleteRecurringRule(ruleId);
    closeModal();
    renderAll();
    return;
  }

  if (!id) return;
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === id);
  const isInstance = task && task.recurringId;
  const msg = isInstance
    ? '반복 일정의 이 날짜 항목만 삭제됩니다. (반복 규칙은 유지)\n삭제하시겠습니까?'
    : '이 Task를 삭제하시겠습니까?';
  if (!confirm(msg)) return;
  if (isInstance) addRecurringException(task.recurringId, task.recurringDate);

  saveTasks(tasks.filter(t => t.id !== id));
  selectedIds.delete(id);
  closeModal();
  renderAll();
}

// ─── Memo Task Quick Add ───
function addMemoTask() {
  const input = document.getElementById('memo-task-input');
  const name = input.value.trim();
  if (!name) return;

  const tasks = loadTasks();
  // memoOrder: 기존 메모 중 가장 큰 memoOrder + 1
  const memoTasks = tasks.filter(t => !t.scheduledDate);
  const maxMemoOrder = memoTasks.reduce((max, t) => Math.max(max, t.memoOrder || 0), 0);

  tasks.push({
    id: generateId(),
    name,
    description: '',
    priority: 'medium',
    duration: 1,
    category1: '',
    category2: '',
    category3: '',
    dueDate: '',
    dueTime: '',
    scheduledDate: '',
    scheduledTime: '',
    done: false,
    order: tasks.length,
    memoOrder: maxMemoOrder + 1,
    createdAt: new Date().toISOString(),
    isMemo: true
  });
  saveTasks(tasks);
  input.value = '';
  renderAll();
}

// ─── Extra Tabs (일정관리·Task 목록·차트 접기/펼치기) ───
function toggleExtraTabs() {
  const tabs = document.getElementById('tabs');
  const btn = document.getElementById('btn-tab-more');
  const collapsed = tabs.classList.toggle('collapsed');
  btn.innerHTML = collapsed ? '더보기 &#9656;' : '접기 &#9666;';
  if (collapsed) {
    // 숨김 탭 화면을 보던 중 접으면 캘린더로 전환
    const active = document.querySelector('.tab.active');
    if (active && active.classList.contains('tab-extra')) switchView('calendar');
  }
}

// ─── Views ───
function switchView(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active', p.id === 'view-' + name));
  if (name === 'calendar') renderCalendar();
  if (name === 'chart') renderChart();
  if (name === 'weekly') renderWeeklySummary();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});
