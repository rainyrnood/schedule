// ─── Batch Selection State (Task 목록 only) ───
const selectedIds = new Set();

function toggleSelect(taskId) {
  if (selectedIds.has(taskId)) {
    selectedIds.delete(taskId);
  } else {
    selectedIds.add(taskId);
  }
  updateBatchBar();
  updateCheckboxVisuals();
}

function updateBatchBar() {
  const bar = document.getElementById('batch-bar');
  const info = document.getElementById('batch-info');
  if (selectedIds.size > 0) {
    bar.classList.remove('hidden');
    info.textContent = selectedIds.size + '개 선택됨';
  } else {
    bar.classList.add('hidden');
  }
}

function updateCheckboxVisuals() {
  document.querySelectorAll('#all-tasks .task-item').forEach(item => {
    const id = item.dataset.id;
    const cb = item.querySelector('.task-checkbox');
    const isSelected = selectedIds.has(id);
    item.classList.toggle('selected', isSelected);
    if (cb) {
      const task = loadTasks().find(t => t.id === id);
      const isDone = task && task.done;
      cb.className = 'task-checkbox' + (isSelected ? (isDone ? ' done-checked' : ' checked') : (isDone ? ' done-checked' : ''));
      cb.innerHTML = (isSelected || isDone) ? '&#10003;' : '';
    }
  });
}

function batchComplete() {
  if (selectedIds.size === 0) return;
  const tasks = loadTasks();
  for (const id of selectedIds) {
    const t = tasks.find(x => x.id === id);
    if (t) t.done = true;
  }
  saveTasks(tasks);
  selectedIds.clear();
  updateBatchBar();
  renderAll();
}

function batchUncomplete() {
  if (selectedIds.size === 0) return;
  const tasks = loadTasks();
  for (const id of selectedIds) {
    const t = tasks.find(x => x.id === id);
    if (t) t.done = false;
  }
  saveTasks(tasks);
  selectedIds.clear();
  updateBatchBar();
  renderAll();
}

function batchClear() {
  selectedIds.clear();
  updateBatchBar();
  updateCheckboxVisuals();
}

// ─── Sort State ───
let currentSort = { field: 'priority', dir: 'desc' };

function setSort(btn) {
  const field = btn.dataset.sort;
  let dir = btn.dataset.dir;

  if (btn.classList.contains('active')) {
    dir = dir === 'asc' ? 'desc' : 'asc';
    btn.dataset.dir = dir;
  }

  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.sort-btn').forEach(b => {
    const base = { priority: '우선순위', name: '이름', dueDate: '마감일', scheduledDate: '배정일' }[b.dataset.sort];
    b.textContent = base + (b.classList.contains('active') ? (b.dataset.dir === 'asc' ? ' \u2191' : ' \u2193') : '');
  });

  currentSort = { field, dir };
  renderAllTasks();
}

// ─── Task List Rendering ───
function renderTaskList(containerId, tasks, emptyMsg, isBatchMode) {
  const container = document.getElementById(containerId);
  if (!tasks) {
    container.innerHTML = '<div class="empty-state"><div class="icon">&#128203;</div><p>' + emptyMsg + '</p></div>';
    return;
  }

  const slotMap = {};
  const seenDates = new Set(tasks.map(t => t.scheduledDate).filter(Boolean));
  seenDates.forEach(d => {
    const sched = computeDaySchedule(d);
    sched.slots.forEach(s => { slotMap[s.id] = s; });
  });

  container.innerHTML = tasks.map(t => {
    const slot = slotMap[t.id];
    // 시간 지정된 Task만 시간 정보 표시
    const timeInfo = (slot && t.scheduledTime) ? slot.startTime + ' ~ ' + slot.endTime : '';
    const dueDisplay = t.dueTime ? formatDate(t.dueDate) + ' ' + t.dueTime : formatDate(t.dueDate);
    const schedDisplay = t.scheduledTime ? formatDate(t.scheduledDate) + ' ' + t.scheduledTime : formatDate(t.scheduledDate);

    let categoryHtml = '';
    if (t.category1) categoryHtml += '<span class="badge-category">' + escapeHtml(t.category1) + '</span> ';
    if (t.category2) categoryHtml += '<span class="badge-category">' + escapeHtml(t.category2) + '</span> ';
    if (t.category3) categoryHtml += '<span class="badge-category">' + escapeHtml(t.category3) + '</span> ';

    const isSelected = isBatchMode && selectedIds.has(t.id);
    const cbClass = isBatchMode
      ? ('task-checkbox' + (isSelected ? (t.done ? ' done-checked' : ' checked') : (t.done ? ' done-checked' : '')))
      : ('task-checkbox' + (t.done ? ' done-checked' : ''));
    const cbContent = (isBatchMode ? isSelected : false) || t.done ? '&#10003;' : '';
    const cbAction = isBatchMode ? `toggleSelect('${t.id}')` : `openModal('${t.id}')`;
    const itemClass = 'task-item' + (isSelected ? ' selected' : '');

    return `
    <li class="${itemClass}" data-id="${t.id}" draggable="true">
      <span class="drag-handle">&#8942;&#8942;</span>
      <div class="${cbClass}" onclick="${cbAction}">
        ${cbContent}
      </div>
      <div class="task-priority priority-${t.priority}"></div>
      <div class="task-info">
        <div class="task-title" style="${t.done ? 'text-decoration:line-through;opacity:0.5' : ''}">${escapeHtml(t.name)}${t.done ? ' <span class="task-badge badge-done">완료</span>' : ''}</div>
        <div class="task-meta">
          <span>우선순위: ${priorityLabel(t.priority)}</span>
          <span>예상: ${formatDurationLabel(t.duration || 1)}</span>
          ${timeInfo ? '<span style="color:var(--primary);font-weight:600">' + timeInfo + '</span>' : ''}
          <span>배정: ${schedDisplay}</span>
          <span>마감: ${dueDisplay}</span>
          ${categoryHtml}
          ${dueBadge(t.done ? null : t.dueDate)}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-ghost btn-sm" onclick="openModal('${t.id}')">수정</button>
      </div>
    </li>`;
  }).join('');

  enableDragAndDrop(container);
}

// ─── All Tasks View ───
function renderAllTasks() {
  const tasks = loadTasks();
  const pFilter = document.getElementById('filter-priority').value;
  const sFilter = document.getElementById('filter-status').value;
  const c1Filter = document.getElementById('filter-category1').value;
  const c2Filter = document.getElementById('filter-category2').value;
  const c3Filter = document.getElementById('filter-category3').value;

  let filtered = tasks;
  if (pFilter) filtered = filtered.filter(t => t.priority === pFilter);
  if (sFilter === 'active') filtered = filtered.filter(t => !t.done);
  else if (sFilter === 'done') filtered = filtered.filter(t => t.done);
  if (c1Filter) filtered = filtered.filter(t => t.category1 === c1Filter);
  if (c2Filter) filtered = filtered.filter(t => t.category2 === c2Filter);
  if (c3Filter) filtered = filtered.filter(t => t.category3 === c3Filter);

  const { field, dir } = currentSort;
  const mul = dir === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    if (field === 'priority') {
      return mul * (priorityWeight(a.priority) - priorityWeight(b.priority));
    }
    if (field === 'name') {
      return mul * (a.name || '').localeCompare(b.name || '', 'ko');
    }
    if (field === 'dueDate') {
      const da = a.dueDate || '9999-12-31';
      const db = b.dueDate || '9999-12-31';
      return mul * da.localeCompare(db);
    }
    if (field === 'scheduledDate') {
      const da = a.scheduledDate || '9999-12-31';
      const db = b.scheduledDate || '9999-12-31';
      return mul * da.localeCompare(db);
    }
    return 0;
  });

  updateCategoryFilters();
  renderTaskList('all-tasks', filtered.length ? filtered : null, 'Task가 없습니다. 새 Task를 만들어보세요!', true);
}

document.getElementById('filter-priority').addEventListener('change', renderAllTasks);
document.getElementById('filter-status').addEventListener('change', renderAllTasks);
document.getElementById('filter-category1').addEventListener('change', renderAllTasks);
document.getElementById('filter-category2').addEventListener('change', renderAllTasks);
document.getElementById('filter-category3').addEventListener('change', renderAllTasks);

// ─── Drag and Drop for Task List ───
function enableDragAndDrop(container) {
  let draggedItem = null;

  container.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
      const ids = [...container.querySelectorAll('.task-item')].map(el => el.dataset.id);
      const tasks = loadTasks();
      ids.forEach((id, index) => {
        const t = tasks.find(x => x.id === id);
        if (t) t.order = index;
      });
      saveTasks(tasks);
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && draggedItem !== item) {
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          container.insertBefore(draggedItem, item);
        } else {
          container.insertBefore(draggedItem, item.nextSibling);
        }
      }
    });
  });
}
