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
    document.getElementById('task-priority').value = task.priority;
    setDurationValue(task.duration || 1);
    document.getElementById('task-category1').value = task.category1 || '';
    document.getElementById('task-category2').value = task.category2 || '';
    document.getElementById('task-category3').value = task.category3 || '';
    document.getElementById('task-scheduled').value = task.scheduledDate || '';
    setTimePickerValue('tp-scheduled', task.scheduledTime || '');
    document.getElementById('task-due').value = task.dueDate || '';
    setTimePickerValue('tp-due', task.dueTime || '');

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
    btnDone.style.display = 'none';
  }

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

  const tasks = loadTasks();
  const id = document.getElementById('task-id').value;

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

function deleteTask() {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  if (!confirm('이 Task를 삭제하시겠습니까?')) return;

  const tasks = loadTasks().filter(t => t.id !== id);
  saveTasks(tasks);
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
