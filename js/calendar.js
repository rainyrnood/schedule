// ─── Calendar ───
let calendar = null;
let realtimeInterval = null;

// ─── 주 접기/열기 상태 ───
const collapsedWeeks = new Set();

// ─── 접기/열기 버튼 클릭 시 dateClick 억제 플래그 ───
let suppressDateClick = false;

function renderCalendar() {
  const calEl = document.getElementById('calendar');
  if (calendar) calendar.destroy();

  const tasks = loadTasks();
  const dayHours = getDayHoursMap();

  const events = [];
  const scheduledDates = new Set();

  // 완료된 항목도 포함하여 모든 배정된 Task를 수집
  tasks.filter(t => t.scheduledDate).forEach(t => {
    scheduledDates.add(t.scheduledDate);
  });

  scheduledDates.forEach(dateStr => {
    const schedule = computeDaySchedule(dateStr);
    // 시간 지정된 Task는 시간 정보와 함께 표시
    for (const slot of schedule.slots) {
      const donePrefix = slot.done ? '\u2713 ' : '';
      events.push({
        id: slot.id,
        title: formatHourShort(slot.startHour) + '~' + formatHourShort(slot.endHour) + ' ' + donePrefix + slot.name + ' (' + formatDurationLabel(slot.duration || 1) + ')',
        start: dateStr,
        backgroundColor: slot.done ? '#94a3b8' : priorityColor(slot.priority),
        borderColor: slot.done ? '#94a3b8' : priorityColor(slot.priority),
        textColor: slot.done ? '#ffffff' : priorityTextColor(slot.priority),
        extendedProps: { task: slot, startTime: slot.startTime, endTime: slot.endTime, timeLabel: formatHourShort(slot.startHour) + '~' + formatHourShort(slot.endHour) },
      });
    }
    // 시간 미지정 Task는 시간 표시 없이, 아래쪽에 배치 (우선순위 순으로 정렬)
    for (const t of schedule.untimedTasks) {
      const donePrefix = t.done ? '\u2713 ' : '';
      events.push({
        id: t.id,
        title: donePrefix + t.name + ' (' + formatDurationLabel(t.duration || 1) + ')',
        start: dateStr,
        backgroundColor: t.done ? '#94a3b8' : priorityColor(t.priority),
        borderColor: t.done ? '#94a3b8' : priorityColor(t.priority),
        textColor: t.done ? '#ffffff' : priorityTextColor(t.priority),
        extendedProps: { task: t },
        order: 10000 - priorityWeight(t.priority), // 우선순위 높은 것이 위에
      });
    }
  });

  tasks.filter(t => t.scheduledDate && t.scheduledDate !== t.dueDate && !t.done).forEach(t => {
    events.push({
      id: t.id + '-due',
      title: '\u23F0 ' + t.name + ' (마감)',
      start: t.dueDate,
      backgroundColor: 'transparent',
      borderColor: priorityMarkerColor(t.priority),
      textColor: priorityMarkerColor(t.priority),
      extendedProps: { isDueMarker: true, taskId: t.id },
    });
  });

  calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    locale: 'ko',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    editable: true,
    droppable: true,
    dragRevertDuration: 0,
    events,
    // 이벤트 칩에서 시간 부분만 작게 표시 (시간 폰트 축소)
    eventDidMount(arg) {
      const ep = arg.event.extendedProps || {};
      if (!ep.timeLabel) return;
      const titleEl = arg.el.querySelector('.fc-event-title');
      if (!titleEl) return;
      const full = titleEl.textContent;
      if (!full.startsWith(ep.timeLabel)) return;
      const rest = full.slice(ep.timeLabel.length);
      titleEl.textContent = '';
      const timeEl = document.createElement('span');
      timeEl.className = 'fc-ev-time';
      timeEl.textContent = ep.timeLabel;
      titleEl.appendChild(timeEl);
      titleEl.appendChild(document.createTextNode(rest));
    },
    eventDrop(info) {
      const tasks = loadTasks();
      if (info.event.extendedProps.isDueMarker) {
        // 마감일 마커를 드래그한 경우: 해당 Task의 마감일 변경
        const taskId = info.event.extendedProps.taskId;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          task.dueDate = toLocalDateStr(info.event.start);
          saveTasks(tasks);
          renderDashboard();
          renderAllTasks();
          setTimeout(() => renderCalendar(), 100);
        }
        return;
      }
      const task = tasks.find(t => t.id === info.event.id);
      if (task) {
        task.scheduledDate = toLocalDateStr(info.event.start);
        // 반복 인스턴스는 마감일도 함께 이동 (마감 마커가 원래 날짜에 남지 않도록)
        if (task.recurringId) task.dueDate = task.scheduledDate;
        saveTasks(tasks);
        renderDashboard();
        renderAllTasks();
        setTimeout(() => renderCalendar(), 100);
      }
    },
    // 캘린더 이벤트를 메모 패널로 드래그할 때 감지
    eventDragStop(info) {
      const memoPanel = document.getElementById('memo-task-list');
      if (!memoPanel) return;
      const rect = memoPanel.getBoundingClientRect();
      const x = info.jsEvent.clientX;
      const y = info.jsEvent.clientY;
      // 메모 패널 영역에 드롭되었는지 확인
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const eventId = info.event.extendedProps.isDueMarker
          ? info.event.extendedProps.taskId
          : info.event.id;
        const tasks = loadTasks();
        const task = tasks.find(t => t.id === eventId);
        if (task) {
          task.scheduledDate = '';
          task.scheduledTime = '';
          task.isMemo = true;
          saveTasks(tasks);
          renderDashboard();
          renderAllTasks();
          renderMemoTasks();
          setTimeout(() => renderCalendar(), 100);
        }
      }
    },
    // 외부 메모 Task 드롭 처리
    eventReceive(info) {
      const taskId = info.event.id;
      const newDate = toLocalDateStr(info.event.start);
      const tasks = loadTasks();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.scheduledDate = newDate;
        if (!task.dueDate) task.dueDate = newDate;
        task.isMemo = false;
        saveTasks(tasks);
        renderDashboard();
        renderAllTasks();
        renderMemoTasks();
        setTimeout(() => renderCalendar(), 100);
      }
    },
    eventClick(info) {
      const id = info.event.extendedProps.isDueMarker
        ? info.event.extendedProps.taskId
        : info.event.id;
      openModal(id);
    },
    dateClick(info) {
      // 접기/열기 버튼 클릭 시 Task 생성 억제
      if (suppressDateClick) {
        suppressDateClick = false;
        return;
      }
      // 클릭한 날짜를 배정일과 마감일 모두에 기본값으로 설정
      openModal(null, { scheduledDate: info.dateStr, dueDate: info.dateStr });
    },
    dayCellDidMount(arg) {
      const dateStr = toLocalDateStr(arg.date);
      const hours = dayHours[dateStr];
      if (hours) {
        const label = document.createElement('span');
        label.className = 'fc-day-hours' + (hours >= MAX_HOURS ? ' full' : '');
        label.textContent = formatDecimal(hours) + '/' + MAX_HOURS + 'h';
        label.style.position = 'absolute';
        label.style.bottom = '2px';
        label.style.right = '2px';
        arg.el.style.position = 'relative';
        arg.el.appendChild(label);
      }
    },
    // 월 뷰 렌더링 완료 후 모든 주에 접기 버튼 추가
    datesSet(arg) {
      setTimeout(() => { addWeekFoldButtons(); updateFoldAllButtonText(); }, 50);
      // 보이는 범위의 반복 인스턴스 보충 생성 (새로 생긴 게 있을 때만 한 번 다시 그림)
      const rangeStart = toLocalDateStr(arg.start);
      const rangeEnd = toLocalDateStr(new Date(arg.end.getTime() - 86400000)); // arg.end는 미포함
      if (ensureRecurringInstances(rangeStart, rangeEnd) > 0) {
        setTimeout(() => renderCalendar(), 0);
      }
    },
  });

  calendar.render();

  // 메모 Task 드래그 초기화 (커스텀 고속 드래그)
  initMemoCustomDrag();
  // 실시간 상태 업데이트
  renderRealtimeStatus();
}

// ─── 모든 주에 접기/열기 버튼 추가 ───
function addWeekFoldButtons() {
  const calEl = document.getElementById('calendar');
  if (!calEl) return;

  // 기존 토글 버튼 제거
  calEl.querySelectorAll('.week-fold-btn').forEach(b => b.remove());

  const view = calendar.view;
  if (view.type !== 'dayGridMonth') return;

  const rows = calEl.querySelectorAll('.fc-daygrid-body tr[role="row"]');

  rows.forEach((row) => {
    // 해당 행의 날짜 셀 가져오기
    const dayCells = row.querySelectorAll('.fc-daygrid-day');
    if (dayCells.length === 0) return;

    // 해당 주의 첫 번째 날짜 확인
    const firstCellDate = dayCells[0].getAttribute('data-date');
    if (!firstCellDate) return;

    // 해당 행의 weekKey
    const weekKey = firstCellDate;

    // 이미 접혀 있으면 접기 상태 복원
    const isCollapsed = collapsedWeeks.has(weekKey);

    // 토글 버튼 생성
    const btn = document.createElement('button');
    btn.className = 'week-fold-btn';
    btn.title = isCollapsed ? '주간 펼치기' : '주간 접기';
    btn.innerHTML = isCollapsed ? '&#9650;' : '&#9660;'; // ▲ : ▼
    btn.dataset.weekKey = weekKey;

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      suppressDateClick = true;
      toggleWeekFold(weekKey, row);
    });

    // 행의 첫 번째 셀에 버튼 추가
    const firstCell = dayCells[0];
    firstCell.style.position = 'relative';
    firstCell.appendChild(btn);

    // 접힌 상태면 행 숨기기
    if (isCollapsed) {
      applyWeekCollapse(row, true);
    }
  });
}

function toggleWeekFold(weekKey, row) {
  if (collapsedWeeks.has(weekKey)) {
    collapsedWeeks.delete(weekKey);
    applyWeekCollapse(row, false);
  } else {
    collapsedWeeks.add(weekKey);
    applyWeekCollapse(row, true);
  }

  // 버튼 아이콘 업데이트
  const btn = row.querySelector('.week-fold-btn[data-week-key="' + weekKey + '"]');
  if (btn) {
    const isCollapsed = collapsedWeeks.has(weekKey);
    btn.innerHTML = isCollapsed ? '&#9650;' : '&#9660;'; // ▲ : ▼
    btn.title = isCollapsed ? '주간 펼치기' : '주간 접기';
  }

  // 상단 토글 버튼 텍스트 업데이트
  updateFoldAllButtonText();
}

function applyWeekCollapse(row, collapse) {
  // 날짜 셀의 내용 영역 접기/열기
  const dayCells = row.querySelectorAll('.fc-daygrid-day');
  dayCells.forEach(cell => {
    const frame = cell.querySelector('.fc-daygrid-day-frame');
    if (frame) {
      // 이벤트 영역 숨기기
      const events = frame.querySelector('.fc-daygrid-day-events');
      if (events) {
        events.style.display = collapse ? 'none' : '';
      }
      const bottom = frame.querySelector('.fc-daygrid-day-bg');
      if (bottom) {
        bottom.style.display = collapse ? 'none' : '';
      }
    }
    // 행 높이 축소
    if (collapse) {
      cell.classList.add('week-collapsed');
    } else {
      cell.classList.remove('week-collapsed');
    }
  });

  // 같은 위치의 이벤트 행도 접기
  const tbody = row.closest('tbody');
  if (tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const rowIndex = Array.from(allRows).indexOf(row);
  }
}

// ─── 이번 주 제외 모두 접기/열기 ───
function toggleFoldAllExceptThisWeek() {
  const calEl = document.getElementById('calendar');
  if (!calEl || !calendar || calendar.view.type !== 'dayGridMonth') return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = calEl.querySelectorAll('.fc-daygrid-body tr[role="row"]');

  // 이번 주가 아닌 행들의 weekKey 수집
  const otherWeekKeys = [];
  rows.forEach((row) => {
    const dayCells = row.querySelectorAll('.fc-daygrid-day');
    if (dayCells.length === 0) return;
    const firstCellDate = dayCells[0].getAttribute('data-date');
    if (!firstCellDate) return;
    // 행의 시작일(주 시작 요일)부터 7일 범위로 이번 주 판정
    const rowStart = new Date(firstCellDate);
    rowStart.setHours(0, 0, 0, 0);
    const rowEnd = new Date(rowStart.getTime() + 7 * 86400000);
    // 오늘이 포함된 주(이번 주) 행은 건너뛰기
    if (today >= rowStart && today < rowEnd) return;
    otherWeekKeys.push({ weekKey: firstCellDate, row });
  });

  if (otherWeekKeys.length === 0) return;

  // 모든 비이번주 행이 이미 접혀있는지 확인
  const allCollapsed = otherWeekKeys.every(item => collapsedWeeks.has(item.weekKey));

  // 토글: 모두 접혀있으면 열기, 아니면 접기
  otherWeekKeys.forEach(item => {
    if (allCollapsed) {
      collapsedWeeks.delete(item.weekKey);
      applyWeekCollapse(item.row, false);
    } else {
      collapsedWeeks.add(item.weekKey);
      applyWeekCollapse(item.row, true);
    }
    // 버튼 아이콘 업데이트
    const btn = item.row.querySelector('.week-fold-btn[data-week-key="' + item.weekKey + '"]');
    if (btn) {
      const isCollapsed = collapsedWeeks.has(item.weekKey);
      btn.innerHTML = isCollapsed ? '&#9650;' : '&#9660;';
      btn.title = isCollapsed ? '주간 펼치기' : '주간 접기';
    }
  });

  // 상단 버튼 텍스트 업데이트
  updateFoldAllButtonText();
}

function updateFoldAllButtonText() {
  const btn = document.getElementById('btn-fold-all');
  if (!btn) return;

  const calEl = document.getElementById('calendar');
  if (!calEl || !calendar || calendar.view.type !== 'dayGridMonth') return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = calEl.querySelectorAll('.fc-daygrid-body tr[role="row"]');
  let otherCount = 0;
  let collapsedCount = 0;

  rows.forEach((row) => {
    const dayCells = row.querySelectorAll('.fc-daygrid-day');
    if (dayCells.length === 0) return;
    const firstCellDate = dayCells[0].getAttribute('data-date');
    if (!firstCellDate) return;
    // 행의 시작일부터 7일 범위로 이번 주 판정 (toggle과 동일 기준)
    const rowStart = new Date(firstCellDate);
    rowStart.setHours(0, 0, 0, 0);
    const rowEnd = new Date(rowStart.getTime() + 7 * 86400000);
    if (today >= rowStart && today < rowEnd) return;
    otherCount++;
    if (collapsedWeeks.has(firstCellDate)) collapsedCount++;
  });

  if (otherCount > 0 && collapsedCount === otherCount) {
    btn.textContent = '이번 주 제외 모두 열기';
  } else {
    btn.textContent = '이번 주 제외 모두 접기';
  }
}

// ─── 실시간 남은 시간 표시 ───
function renderRealtimeStatus() {
  const container = document.getElementById('calendar-realtime-status');
  if (!container) return;

  const now = new Date();
  const today = todayStr();
  const currentH = now.getHours() + now.getMinutes() / 60;

  const tasks = loadTasks();
  const todayTasks = tasks.filter(t => t.scheduledDate === today);
  const todayIncompleteTasks = todayTasks.filter(t => !t.done);
  const todayCompletedTasks = todayTasks.filter(t => t.done);

  const totalHours = todayTasks.reduce((s, t) => s + (t.duration || 1), 0);
  const remainingHours = todayIncompleteTasks.reduce((s, t) => s + (t.duration || 1), 0);
  const completedHours = todayCompletedTasks.reduce((s, t) => s + (t.duration || 1), 0);

  if (todayTasks.length === 0) {
    container.innerHTML = '<div class="realtime-status-empty">오늘 배정된 업무가 없습니다.</div>';
    return;
  }

  // 현재 시간부터 남은 업무를 처리하는데 걸리는 예상 시간 계산
  const lunch = getLunchConfig();
  const lunchStart = parseTimeToDecimal(lunch.start);
  const lunchEnd = parseTimeToDecimal(lunch.end);
  const lunchDur = lunchEnd - lunchStart;

  // 현재 시간부터 남은 업무 예상 종료 시간 계산
  let estimatedEnd = Math.max(currentH, WORK_START_HOUR);
  let hoursToAdd = remainingHours;

  // 점심시간이 현재~종료 사이에 있으면 추가
  if (estimatedEnd < lunchStart && (estimatedEnd + hoursToAdd) > lunchStart) {
    hoursToAdd += lunchDur;
  }
  estimatedEnd += hoursToAdd;

  const workEnd = WORK_START_HOUR + MAX_HOURS + lunchDur; // 예: 17:00 (8h + 12:30~13:30 점심)
  const overtime = estimatedEnd - workEnd;

  const currentTimeStr = formatHour(currentH);
  const estimatedEndStr = formatHour(Math.min(estimatedEnd, 24));

  let html = '<div class="realtime-status-grid">';
  html += '<div class="realtime-item"><span class="realtime-label">현재 시간</span><span class="realtime-value">' + currentTimeStr + '</span></div>';
  html += '<div class="realtime-item"><span class="realtime-label">남은 Task</span><span class="realtime-value">' + todayIncompleteTasks.length + '개 (' + formatDecimal(remainingHours) + 'h)</span></div>';
  html += '<div class="realtime-item"><span class="realtime-label">완료된 Task</span><span class="realtime-value">' + todayCompletedTasks.length + '개 (' + formatDecimal(completedHours) + 'h)</span></div>';
  html += '<div class="realtime-item"><span class="realtime-label">예상 종료</span><span class="realtime-value' + (overtime > 0 ? ' overtime' : '') + '">' + estimatedEndStr + '</span></div>';

  if (overtime > 0) {
    html += '<div class="realtime-item realtime-overtime"><span class="realtime-label">초과 시간</span><span class="realtime-value overtime">+' + formatDecimal(overtime) + 'h 초과</span></div>';
  } else if (remainingHours > 0) {
    const remaining = workEnd - estimatedEnd;
    html += '<div class="realtime-item"><span class="realtime-label">여유 시간</span><span class="realtime-value ok">' + formatDecimal(remaining) + 'h 여유</span></div>';
  } else {
    html += '<div class="realtime-item"><span class="realtime-label">상태</span><span class="realtime-value ok">모든 업무 완료!</span></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function startRealtimeUpdates() {
  if (realtimeInterval) clearInterval(realtimeInterval);
  realtimeInterval = setInterval(() => {
    if (document.getElementById('view-calendar').classList.contains('active')) {
      renderRealtimeStatus();
    }
  }, 60000); // 1분마다 업데이트
}

// ─── 메모 Task 패널 ───
function renderMemoTasks() {
  const container = document.getElementById('memo-task-list');
  if (!container) return;

  const tasks = loadTasks().filter(t => !t.scheduledDate);
  // memoOrder로 정렬
  tasks.sort((a, b) => (a.memoOrder || 0) - (b.memoOrder || 0));

  if (tasks.length === 0) {
    container.innerHTML = '<div class="memo-empty">메모가 없습니다.<br>위 입력칸에서 빠르게 추가하세요.</div>';
    return;
  }

  container.innerHTML = tasks.map((t, idx) => {
    const doneClass = t.done ? ' memo-done' : '';
    return `<div class="memo-task-item${doneClass}" data-id="${t.id}" data-title="${escapeHtml(t.name)}" data-duration="${t.duration || 1}" data-memo-index="${idx}">
      <div class="memo-task-priority priority-${t.priority}"></div>
      <div class="memo-task-info">
        <div class="memo-task-name">${escapeHtml(t.name)}</div>
        <div class="memo-task-meta">${priorityLabel(t.priority)} | ${formatDurationLabel(t.duration || 1)}${t.dueDate ? ' | 마감: ' + formatDate(t.dueDate) : ''}</div>
      </div>
      <div class="memo-task-actions">
        <button class="btn btn-ghost btn-sm memo-move-btn" onclick="moveMemoTask('${t.id}', 'up', event)" title="위로">&#9650;</button>
        <button class="btn btn-ghost btn-sm memo-move-btn" onclick="moveMemoTask('${t.id}', 'down', event)" title="아래로">&#9660;</button>
        <button class="btn btn-ghost btn-sm" onclick="openModal('${t.id}')" title="수정">&#9998;</button>
      </div>
    </div>`;
  }).join('');

  // 커스텀 고속 드래그 초기화
  initMemoCustomDrag();
}

// ─── 메모 Task 순서 이동 ───
function moveMemoTask(taskId, direction, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const tasks = loadTasks();
  const memoTasks = tasks.filter(t => !t.scheduledDate).sort((a, b) => (a.memoOrder || 0) - (b.memoOrder || 0));

  const idx = memoTasks.findIndex(t => t.id === taskId);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    // 위로 이동
    [memoTasks[idx], memoTasks[idx - 1]] = [memoTasks[idx - 1], memoTasks[idx]];
  } else if (direction === 'down' && idx < memoTasks.length - 1) {
    // 아래로 이동
    [memoTasks[idx], memoTasks[idx + 1]] = [memoTasks[idx + 1], memoTasks[idx]];
  } else if (direction === 'top') {
    const [task] = memoTasks.splice(idx, 1);
    memoTasks.unshift(task);
  } else if (direction === 'bottom') {
    const [task] = memoTasks.splice(idx, 1);
    memoTasks.push(task);
  } else {
    return;
  }

  // memoOrder 재설정
  memoTasks.forEach((t, i) => {
    const original = tasks.find(x => x.id === t.id);
    if (original) original.memoOrder = i;
  });

  saveTasks(tasks);
  renderMemoTasks();
}

// ─── 메모 드래그로 순서 변경 ───
function reorderMemoByDrag(draggedId, targetY) {
  const tasks = loadTasks();
  const memoTasks = tasks.filter(t => !t.scheduledDate).sort((a, b) => (a.memoOrder || 0) - (b.memoOrder || 0));

  const dragIdx = memoTasks.findIndex(t => t.id === draggedId);
  if (dragIdx < 0) return;

  // 현재 메모 아이템들의 위치 기반으로 드롭 위치 결정
  const container = document.getElementById('memo-task-list');
  const items = container.querySelectorAll('.memo-task-item');
  let targetIdx = memoTasks.length;

  items.forEach((item, i) => {
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (targetY < mid && targetIdx === memoTasks.length) {
      targetIdx = i;
    }
  });

  // 이동
  const [task] = memoTasks.splice(dragIdx, 1);
  if (targetIdx > dragIdx) targetIdx--;
  memoTasks.splice(targetIdx, 0, task);

  // memoOrder 재설정
  memoTasks.forEach((t, i) => {
    const original = tasks.find(x => x.id === t.id);
    if (original) original.memoOrder = i;
  });

  saveTasks(tasks);
  renderMemoTasks();
}

// ─── 커스텀 고속 드래그 (마우스 포인터 실시간 추적) ───
let memoDragState = null;

function initMemoCustomDrag() {
  const containerEl = document.getElementById('memo-task-list');
  if (!containerEl) return;

  const items = containerEl.querySelectorAll('.memo-task-item');
  items.forEach(item => {
    // HTML5 네이티브 드래그 비활성화 (FullCalendar Draggable 고스트 방지)
    item.setAttribute('draggable', 'false');
    // 기존 리스너 중복 방지
    item.removeEventListener('mousedown', handleMemoDragStart);
    item.addEventListener('mousedown', handleMemoDragStart);
  });

  // 메모 패널 드롭 영역 하이라이트
  initMemoDropZone();
}

function handleMemoDragStart(e) {
  // 버튼 클릭은 무시
  if (e.target.closest('button')) return;
  e.preventDefault();

  const item = e.currentTarget;
  const id = item.dataset.id;
  const title = item.dataset.title;
  const rect = item.getBoundingClientRect();

  // 드래그 고스트 생성
  const ghost = item.cloneNode(true);
  ghost.className = 'memo-drag-ghost';
  ghost.style.width = rect.width + 'px';
  ghost.style.left = e.clientX - rect.width / 2 + 'px';
  ghost.style.top = e.clientY - 20 + 'px';
  document.body.appendChild(ghost);

  // 원본 반투명
  item.style.opacity = '0.3';

  memoDragState = {
    id,
    title,
    duration: parseFloat(item.dataset.duration) || 1,
    ghost,
    ghostWidth: rect.width,
    originItem: item,
    startX: e.clientX,
    startY: e.clientY,
  };

  document.addEventListener('mousemove', handleMemoDragMove);
  document.addEventListener('mouseup', handleMemoDragEnd);
}

function handleMemoDragMove(e) {
  if (!memoDragState) return;

  // requestAnimationFrame으로 부드럽게 이동
  requestAnimationFrame(() => {
    if (!memoDragState) return;
    const ghost = memoDragState.ghost;
    ghost.style.left = e.clientX - memoDragState.ghostWidth / 2 + 'px';
    ghost.style.top = e.clientY - 20 + 'px';
  });

  // 캘린더 날짜 셀 하이라이트
  highlightCalendarCell(e.clientX, e.clientY);

  // 메모 리스트 내 드롭 위치 표시
  highlightMemoDropPosition(e.clientY);
}

function handleMemoDragEnd(e) {
  if (!memoDragState) return;

  document.removeEventListener('mousemove', handleMemoDragMove);
  document.removeEventListener('mouseup', handleMemoDragEnd);

  // 고스트 제거
  if (memoDragState.ghost && memoDragState.ghost.parentNode) {
    memoDragState.ghost.parentNode.removeChild(memoDragState.ghost);
  }

  // 원본 복원
  if (memoDragState.originItem) {
    memoDragState.originItem.style.opacity = '';
  }

  // 하이라이트 제거
  clearCalendarHighlight();
  clearMemoDropHighlight();

  // 드롭 위치 확인 - 메모 리스트 내인지 먼저 체크
  const memoList = document.getElementById('memo-task-list');
  if (memoList) {
    const memoRect = memoList.getBoundingClientRect();
    if (e.clientX >= memoRect.left && e.clientX <= memoRect.right &&
        e.clientY >= memoRect.top && e.clientY <= memoRect.bottom) {
      // 메모 리스트 내에서 순서 변경
      reorderMemoByDrag(memoDragState.id, e.clientY);
      memoDragState = null;
      return;
    }
  }

  // 드롭 위치 확인 - 캘린더 날짜 셀 위인지 체크
  const dropDate = getCalendarDateAtPoint(e.clientX, e.clientY);
  if (dropDate) {
    // 캘린더에 드롭
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === memoDragState.id);
    if (task) {
      task.scheduledDate = dropDate;
      if (!task.dueDate) task.dueDate = dropDate;
      task.isMemo = false;
      saveTasks(tasks);
      renderDashboard();
      renderAllTasks();
      renderMemoTasks();
      setTimeout(() => renderCalendar(), 100);
    }
  }

  memoDragState = null;
}

function highlightMemoDropPosition(y) {
  clearMemoDropHighlight();
  const memoList = document.getElementById('memo-task-list');
  if (!memoList) return;

  const memoRect = memoList.getBoundingClientRect();
  if (y < memoRect.top || y > memoRect.bottom) return;

  const items = memoList.querySelectorAll('.memo-task-item');
  items.forEach(item => {
    if (item.dataset.id === memoDragState.id) return;
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (y < mid) {
      item.classList.add('memo-drop-above');
    } else {
      item.classList.remove('memo-drop-above');
    }
  });
}

function clearMemoDropHighlight() {
  document.querySelectorAll('.memo-task-item.memo-drop-above').forEach(el => {
    el.classList.remove('memo-drop-above');
  });
}

function highlightCalendarCell(x, y) {
  // 기존 하이라이트 제거
  document.querySelectorAll('.fc-daygrid-day.memo-drag-hover').forEach(el => {
    el.classList.remove('memo-drag-hover');
  });

  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const dayCell = el.closest('.fc-daygrid-day');
  if (dayCell) {
    dayCell.classList.add('memo-drag-hover');
  }
}

function clearCalendarHighlight() {
  document.querySelectorAll('.fc-daygrid-day.memo-drag-hover').forEach(el => {
    el.classList.remove('memo-drag-hover');
  });
}

function getCalendarDateAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  const dayCell = el.closest('.fc-daygrid-day');
  if (dayCell) {
    return dayCell.getAttribute('data-date');
  }
  return null;
}

function initMemoDropZone() {
  const memoPanel = document.querySelector('.memo-panel');
  if (!memoPanel) return;

  memoPanel.addEventListener('dragover', function(e) {
    e.preventDefault();
    memoPanel.classList.add('memo-drop-active');
  });

  memoPanel.addEventListener('dragleave', function(e) {
    if (!memoPanel.contains(e.relatedTarget)) {
      memoPanel.classList.remove('memo-drop-active');
    }
  });

  memoPanel.addEventListener('drop', function() {
    memoPanel.classList.remove('memo-drop-active');
  });
}

// ─── 캘린더 통합 내보내기 ───
function exportCalendarICS() {
  exportAllICS();
}
