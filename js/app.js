// ─── Backup / Restore / Reset ───
function exportBackup() {
  const tasks = loadTasks();
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '일정관리_백업_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        alert('올바른 백업 파일이 아닙니다.');
        return;
      }
      if (!confirm('현재 데이터를 백업 파일의 데이터로 교체하시겠습니까?\n(기존 데이터는 사라집니다)')) return;
      saveTasks(data);
      renderAll();
      alert('데이터를 불러왔습니다. (' + data.length + '개 Task)');
    } catch {
      alert('파일을 읽는 중 오류가 발생했습니다. JSON 형식의 백업 파일을 선택해주세요.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function resetAll() {
  const tasks = loadTasks();
  if (tasks.length === 0) {
    alert('초기화할 데이터가 없습니다.');
    return;
  }
  if (!confirm('모든 Task 데이터(' + tasks.length + '개)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  if (!confirm('정말 초기화하시겠습니까? 백업을 먼저 해두는 것을 권장합니다.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CATEGORY_MAP_KEY);
  selectedIds.clear();
  updateBatchBar();
  renderAll();
  alert('모든 데이터가 초기화되었습니다.');
}

// ─── Auto-Schedule Algorithm ───
function autoSchedule() {
  let tasks = loadTasks().filter(t => !t.done);
  if (tasks.length === 0) { alert('배치할 Task가 없습니다.'); return; }

  tasks.sort((a, b) => {
    const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (pw !== 0) return pw;
    const da = a.dueDate || '9999-12-31';
    const db = b.dueDate || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return (b.duration || 1) - (a.duration || 1);
  });

  const today = new Date();
  const MAX_HOURS_PER_DAY = 8;
  const dayLoads = {};

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function nextWorkday(date) {
    let d = new Date(date);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d = addDays(d, 1);
    }
    return d;
  }

  const allTasks = loadTasks();

  for (const task of tasks) {
    const dur = task.duration || 1;
    const deadline = task.dueDate || toLocalDateStr(addDays(today, 30));

    let candidate = nextWorkday(today);
    let placed = false;

    for (let i = 0; i < 60; i++) {
      const ds = toLocalDateStr(candidate);
      const used = dayLoads[ds] || 0;

      if (used + dur <= MAX_HOURS_PER_DAY) {
        const t = allTasks.find(x => x.id === task.id);
        if (t) t.scheduledDate = ds;
        dayLoads[ds] = used + dur;
        placed = true;
        break;
      }

      candidate = nextWorkday(addDays(candidate, 1));
    }

    if (!placed) {
      const t = allTasks.find(x => x.id === task.id);
      if (t) t.scheduledDate = deadline;
    }
  }

  saveTasks(allTasks);
  renderAll();
  alert('자동 배치가 완료되었습니다! 캘린더에서 확인하세요.');
  switchView('calendar');
}

// ─── Render All ───
function renderAll() {
  renderDashboard();
  renderAllTasks();
  renderMemoTasks();
  if (document.getElementById('view-calendar').classList.contains('active')) {
    renderCalendar();
  }
  if (document.getElementById('view-chart').classList.contains('active')) {
    renderChart();
  }
  if (document.getElementById('view-weekly').classList.contains('active')) {
    renderWeeklySummary();
  }
}

// ─── Keyboard Shortcut ───
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeChartPopup();
  }

  // 모달이 열려있을 때 Enter로 저장 (textarea 제외)
  const modal = document.getElementById('task-modal');
  if (modal.classList.contains('active') && e.key === 'Enter') {
    const tag = document.activeElement.tagName;
    if (tag !== 'TEXTAREA') {
      e.preventDefault();
      saveTask();
      return;
    }
  }

  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
    openModal();
  }
});

// ─── Init sort button label ───
document.querySelectorAll('.sort-btn').forEach(b => {
  const base = { priority: '우선순위', name: '이름', dueDate: '마감일', scheduledDate: '배정일' }[b.dataset.sort];
  b.textContent = base + (b.classList.contains('active') ? (b.dataset.dir === 'asc' ? ' \u2191' : ' \u2193') : '');
});

// ─── Memo input Enter key handler ───
document.getElementById('memo-task-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addMemoTask();
  }
});

// ─── 주간 요약 (수요일 ~ 다음 주 화요일) ───
let weeklyOffset = 0; // 0 = 이번 주, -1 = 지난 주, 1 = 다음 주

function getWeekRange(offset) {
  const today = new Date();
  // 이번 주 수요일 찾기
  const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 3=수
  const diffToWed = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4; // 오늘에서 이번 주 수요일까지 차이
  const thisWed = new Date(today);
  thisWed.setDate(today.getDate() - diffToWed + (offset * 7));
  thisWed.setHours(0, 0, 0, 0);

  const nextTue = new Date(thisWed);
  nextTue.setDate(thisWed.getDate() + 6);
  nextTue.setHours(23, 59, 59, 999);

  return { start: thisWed, end: nextTue };
}

function changeWeek(delta) {
  weeklyOffset += delta;
  renderWeeklySummary();
}

function renderWeeklySummary() {
  const { start, end } = getWeekRange(weeklyOffset);
  const titleEl = document.getElementById('weekly-title');
  const contentEl = document.getElementById('weekly-content');
  const rawTextEl = document.getElementById('weekly-raw-text');

  const startStr = toLocalDateStr(start);
  const endStr = toLocalDateStr(end);

  titleEl.textContent = startStr + ' (' + getDayName(start) + ') ~ ' + endStr + ' (' + getDayName(end) + ')';

  const tasks = loadTasks();

  // 해당 주간의 날짜별 Task 수집
  const dayMap = {};
  const current = new Date(start);
  while (current <= end) {
    const dateStr = toLocalDateStr(current);
    dayMap[dateStr] = [];
    current.setDate(current.getDate() + 1);
  }

  // Task를 날짜별로 분류
  tasks.forEach(t => {
    if (t.scheduledDate && dayMap[t.scheduledDate] !== undefined) {
      dayMap[t.scheduledDate].push(t);
    }
  });

  // 각 날짜의 Task를 시간순/우선순위순 정렬
  Object.keys(dayMap).forEach(dateStr => {
    dayMap[dateStr].sort((a, b) => {
      if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    });
  });

  // HTML 렌더링
  let html = '';
  let rawText = '=== 주간 업무 요약 (' + startStr + ' ' + getDayName(start) + ' ~ ' + endStr + ' ' + getDayName(end) + ') ===\n\n';
  let totalTasks = 0;
  let totalHours = 0;
  let completedTasks = 0;

  Object.keys(dayMap).sort().forEach(dateStr => {
    const dayTasks = dayMap[dateStr];
    const d = new Date(dateStr);
    const dayLabel = dateStr + ' ' + getDayName(d) + '요일';

    html += '<div class="weekly-day">';
    html += '<div class="weekly-day-header">' + dayLabel + ' <span class="weekly-day-count">' + dayTasks.length + '개 Task</span></div>';

    rawText += '[' + dayLabel + ']\n';

    if (dayTasks.length === 0) {
      html += '<div class="weekly-no-tasks">배정된 Task 없음</div>';
      rawText += '- 배정된 Task 없음\n';
    } else {
      dayTasks.forEach(t => {
        totalTasks++;
        totalHours += (t.duration || 1);
        if (t.done) completedTasks++;

        const timeStr = t.scheduledTime || '시간 미지정';
        const prioStr = priorityLabel(t.priority);
        const durStr = formatDurationLabel(t.duration || 1);
        const statusStr = t.done ? '[완료]' : '[진행중]';
        const catStr = [t.category1, t.category2, t.category3].filter(Boolean).join(' > ');

        html += '<div class="weekly-task' + (t.done ? ' done' : '') + '">';
        html += '<div class="weekly-task-priority priority-' + t.priority + '"></div>';
        html += '<div class="weekly-task-content">';
        html += '<div class="weekly-task-title">' + statusStr + ' ' + escapeHtml(t.name) + '</div>';
        html += '<div class="weekly-task-meta">';
        html += '<span>우선순위: ' + prioStr + '</span>';
        html += '<span>시간: ' + timeStr + '</span>';
        html += '<span>예상: ' + durStr + '</span>';
        if (catStr) html += '<span>분류: ' + escapeHtml(catStr) + '</span>';
        html += '</div>';
        if (t.description) {
          html += '<div class="weekly-task-desc">' + escapeHtml(t.description) + '</div>';
        }
        html += '</div>';
        html += '</div>';

        // Raw text
        rawText += '- ' + statusStr + ' [' + prioStr + '] ' + t.name + ' (' + timeStr + ', ' + durStr + ')';
        if (catStr) rawText += ' [분류: ' + catStr + ']';
        rawText += '\n';
        if (t.description) {
          rawText += '  내용: ' + t.description.replace(/\n/g, '\n  ') + '\n';
        }
      });
    }

    html += '</div>';
    rawText += '\n';
  });

  // 요약 통계
  const summaryHtml = '<div class="weekly-stats">' +
    '<span>총 Task: <strong>' + totalTasks + '개</strong></span>' +
    '<span>완료: <strong>' + completedTasks + '개</strong></span>' +
    '<span>진행중: <strong>' + (totalTasks - completedTasks) + '개</strong></span>' +
    '<span>총 시간: <strong>' + formatDecimal(totalHours) + 'h</strong></span>' +
    '</div>';

  rawText += '--- 요약 ---\n';
  rawText += '총 Task: ' + totalTasks + '개 | 완료: ' + completedTasks + '개 | 진행중: ' + (totalTasks - completedTasks) + '개 | 총 시간: ' + formatDecimal(totalHours) + 'h\n';

  contentEl.innerHTML = summaryHtml + html;
  rawTextEl.value = rawText;
}

function copyWeeklySummary() {
  const rawTextEl = document.getElementById('weekly-raw-text');
  const hintEl = document.getElementById('weekly-copy-hint');

  rawTextEl.select();
  rawTextEl.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(rawTextEl.value).then(() => {
    hintEl.textContent = '복사되었습니다!';
    hintEl.style.color = 'var(--success)';
    setTimeout(() => { hintEl.textContent = ''; }, 2000);
  }).catch(() => {
    // Fallback
    document.execCommand('copy');
    hintEl.textContent = '복사되었습니다!';
    hintEl.style.color = 'var(--success)';
    setTimeout(() => { hintEl.textContent = ''; }, 2000);
  });
}

// ─── Init ───
initTimePickers();
initDurationPicker();
initLunchSettings();
renderAll();
startRealtimeUpdates();
