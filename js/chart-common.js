// ─── Chart Common: State, Data, Helpers ───
let currentChartMode = 'interactive';

function switchChartMode(mode) {
  currentChartMode = mode;
  document.querySelectorAll('.chart-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.chartMode === mode);
  });
  renderChart();
}

// ─── Collapsed State for interactive chart ───
const collapsedL1 = new Set();
const collapsedL2 = new Set();
const collapsedL3 = new Set();

// ─── Collapsed State for mermaid flowchart ───
const mCollapsedL1 = new Set();
const mCollapsedL2 = new Set();
const mCollapsedL3 = new Set();

// ─── Mermaid Init ───
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (!mermaidInitialized && typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      securityLevel: 'loose'
    });
    mermaidInitialized = true;
  }
}

// ─── Build Chart Data (shared by both modes) ───
function buildChartTree() {
  const statusFilter = document.getElementById('chart-status-filter').value;
  let tasks = loadTasks();
  if (statusFilter === 'active') tasks = tasks.filter(t => !t.done);
  else if (statusFilter === 'done') tasks = tasks.filter(t => t.done);

  const totalCount = tasks.length;
  const totalHours = tasks.reduce((sum, t) => sum + (t.duration || 1), 0);

  const tree = {};
  let hasCategory = false;

  for (const t of tasks) {
    const c1 = t.category1 || '미분류';
    const c2 = t.category2 || '미분류';
    const c3 = t.category3 || '미분류';
    if (t.category1 || t.category2 || t.category3) hasCategory = true;
    if (!tree[c1]) tree[c1] = {};
    if (!tree[c1][c2]) tree[c1][c2] = {};
    if (!tree[c1][c2][c3]) tree[c1][c2][c3] = [];
    tree[c1][c2][c3].push(t);
  }

  return { tasks, tree, totalCount, totalHours, hasCategory };
}

function sumHoursArr(taskArr) {
  return taskArr.reduce((s, t) => s + (t.duration || 1), 0);
}

function collectTasksL1(tree, c1) {
  const arr = [];
  for (const c2 of Object.keys(tree[c1])) {
    for (const c3 of Object.keys(tree[c1][c2])) {
      arr.push(...tree[c1][c2][c3]);
    }
  }
  return arr;
}

function collectTasksL2(tree, c1, c2) {
  const arr = [];
  for (const c3 of Object.keys(tree[c1][c2])) {
    arr.push(...tree[c1][c2][c3]);
  }
  return arr;
}

// ─── Render Chart (dispatch) ───
function renderChart() {
  if (currentChartMode === 'mermaid') {
    renderMermaidChart();
  } else {
    renderInteractiveChart();
  }
}

// ─── Parallel Group Helpers ───
function groupTasksParallel(sortedTasks) {
  const groupMap = {};
  sortedTasks.forEach((t, idx) => {
    const g = (t.chartGroup !== undefined && t.chartGroup !== null) ? t.chartGroup : idx;
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(t);
  });

  const orderedKeys = Object.keys(groupMap).sort((a, b) => Number(a) - Number(b));
  return orderedKeys.map(key => groupMap[key]);
}

function normalizeChartGroups(tasks, c1, c2, c3) {
  const chainTasks = tasks.filter(t =>
    (t.category1 || '미분류') === c1 &&
    (t.category2 || '미분류') === c2 &&
    (t.category3 || '미분류') === c3
  ).sort((a, b) => (a.chartGroup ?? a.chartOrder ?? 0) - (b.chartGroup ?? b.chartOrder ?? 0));

  const seen = new Map();
  let nextGroup = 0;
  chainTasks.forEach(t => {
    const g = (t.chartGroup !== undefined && t.chartGroup !== null) ? t.chartGroup : (t.chartOrder ?? 0);
    if (!seen.has(g)) {
      seen.set(g, nextGroup++);
    }
    t.chartGroup = seen.get(g);
  });
}

function toggleParallelGroup(encodedGroupKey, gIdx, event) {
  event.stopPropagation();
  event.preventDefault();

  const groupKey = decodeURIComponent(encodedGroupKey);
  const [c1, c2, c3] = groupKey.split('|');
  const tasks = loadTasks();

  const chainTasks = tasks.filter(t =>
    (t.category1 || '미분류') === c1 &&
    (t.category2 || '미분류') === c2 &&
    (t.category3 || '미분류') === c3
  ).sort((a, b) => (a.chartGroup ?? a.chartOrder ?? 0) - (b.chartGroup ?? b.chartOrder ?? 0));

  const parallelGroups = groupTasksParallel(chainTasks);

  if (gIdx >= parallelGroups.length - 1) return;

  const currentGroup = parallelGroups[gIdx];
  const nextGroupTasks = parallelGroups[gIdx + 1];
  const currentGroupValue = currentGroup[0].chartGroup ?? 0;

  const targetGroup = currentGroupValue;
  nextGroupTasks.forEach(t => {
    t.chartGroup = targetGroup;
  });

  normalizeChartGroups(tasks, c1, c2, c3);
  saveTasks(tasks);
  renderChart();
}

function splitFromParallelGroup(taskId, event) {
  event.stopPropagation();
  event.preventDefault();

  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const c1 = task.category1 || '미분류';
  const c2 = task.category2 || '미분류';
  const c3 = task.category3 || '미분류';

  const chainTasks = tasks.filter(t =>
    (t.category1 || '미분류') === c1 &&
    (t.category2 || '미분류') === c2 &&
    (t.category3 || '미분류') === c3
  ).sort((a, b) => (a.chartGroup ?? a.chartOrder ?? 0) - (b.chartGroup ?? b.chartOrder ?? 0));

  const myGroup = task.chartGroup ?? 0;
  const sameGroupTasks = chainTasks.filter(t => (t.chartGroup ?? 0) === myGroup);

  if (sameGroupTasks.length <= 1) return;

  const maxGroup = Math.max(...chainTasks.map(t => t.chartGroup ?? 0));
  task.chartGroup = myGroup + 0.5;

  normalizeChartGroups(tasks, c1, c2, c3);
  saveTasks(tasks);
  renderChart();
}

// ─── Chart Task Detail Popup ───
let chartPopupTaskId = null;

function openChartTaskPopup(taskId, event) {
  if (event && event.defaultPrevented) return;

  event.stopPropagation();

  const task = loadTasks().find(t => t.id === taskId);
  if (!task) return;

  chartPopupTaskId = taskId;
  const popup = document.getElementById('chart-task-popup');
  const titleEl = document.getElementById('chart-popup-title');
  const bodyEl = document.getElementById('chart-popup-body');
  const actionsEl = document.getElementById('chart-popup-actions');

  titleEl.textContent = task.name;

  let bodyHtml = '';

  bodyHtml += '<div class="chart-task-popup-row">';
  bodyHtml += '<span class="chart-task-popup-label">우선순위</span>';
  bodyHtml += '<span class="chart-task-popup-value"><span class="task-priority priority-' + task.priority + '" style="display:inline-block;width:4px;height:16px;border-radius:2px;vertical-align:middle;margin-right:6px"></span>' + priorityLabel(task.priority) + '</span>';
  bodyHtml += '</div>';

  bodyHtml += '<div class="chart-task-popup-row">';
  bodyHtml += '<span class="chart-task-popup-label">예상 시간</span>';
  bodyHtml += '<span class="chart-task-popup-value">' + formatDecimal(task.duration || 1) + '시간</span>';
  bodyHtml += '</div>';

  if (task.category1 || task.category2 || task.category3) {
    bodyHtml += '<div class="chart-task-popup-row">';
    bodyHtml += '<span class="chart-task-popup-label">분류</span>';
    bodyHtml += '<span class="chart-task-popup-value">';
    if (task.category1) bodyHtml += '<span class="badge-category">' + escapeHtml(task.category1) + '</span> ';
    if (task.category2) bodyHtml += '<span class="badge-category">' + escapeHtml(task.category2) + '</span> ';
    if (task.category3) bodyHtml += '<span class="badge-category">' + escapeHtml(task.category3) + '</span> ';
    bodyHtml += '</span>';
    bodyHtml += '</div>';
  }

  if (task.scheduledDate) {
    bodyHtml += '<div class="chart-task-popup-row">';
    bodyHtml += '<span class="chart-task-popup-label">배정일</span>';
    bodyHtml += '<span class="chart-task-popup-value">' + task.scheduledDate + (task.scheduledTime ? ' ' + task.scheduledTime : '') + '</span>';
    bodyHtml += '</div>';
  }

  if (task.dueDate) {
    bodyHtml += '<div class="chart-task-popup-row">';
    bodyHtml += '<span class="chart-task-popup-label">마감일</span>';
    bodyHtml += '<span class="chart-task-popup-value">' + task.dueDate + (task.dueTime ? ' ' + task.dueTime : '') + ' ' + dueBadge(task.done ? null : task.dueDate) + '</span>';
    bodyHtml += '</div>';
  }

  bodyHtml += '<div class="chart-task-popup-row">';
  bodyHtml += '<span class="chart-task-popup-label">상태</span>';
  bodyHtml += '<span class="chart-task-popup-value">' + (task.done ? '<span class="task-badge badge-done">완료</span>' : '<span class="task-badge badge-upcoming">진행 중</span>') + '</span>';
  bodyHtml += '</div>';

  if (task.description) {
    bodyHtml += '<div class="chart-task-popup-desc">' + escapeHtml(task.description) + '</div>';
  }

  const c1 = task.category1 || '미분류';
  const c2 = task.category2 || '미분류';
  const c3 = task.category3 || '미분류';
  const allTasks = loadTasks();
  const sameChainTasks = allTasks.filter(t =>
    (t.category1 || '미분류') === c1 &&
    (t.category2 || '미분류') === c2 &&
    (t.category3 || '미분류') === c3
  );
  const myGroup = task.chartGroup ?? 0;
  const sameGroupTasks = sameChainTasks.filter(t => (t.chartGroup ?? 0) === myGroup);
  const isInParallelGroup = sameGroupTasks.length > 1;

  bodyEl.innerHTML = bodyHtml;

  let actHtml = '';
  if (task.done) {
    actHtml += '<button class="btn btn-warning btn-sm" onclick="chartPopupToggleDone()">완료 해제</button>';
  } else {
    actHtml += '<button class="btn btn-success btn-sm" onclick="chartPopupToggleDone()">완료</button>';
  }
  actHtml += '<button class="btn btn-primary btn-sm" onclick="chartPopupEdit()">수정</button>';
  actHtml += '<button class="btn btn-danger btn-sm" onclick="chartPopupDelete()">삭제</button>';
  if (isInParallelGroup) {
    actHtml += '<button class="btn btn-ghost btn-sm" onclick="splitFromParallelGroup(\'' + taskId + '\', event)" title="이 Task를 병렬 그룹에서 분리합니다">병렬 분리</button>';
  }
  if (task.scheduledDate) {
    actHtml += '<div style="display:flex;gap:4px;margin-top:6px;width:100%;border-top:1px solid var(--border);padding-top:8px;">';
    actHtml += '<button class="btn btn-ghost btn-sm" onclick="exportTaskICS(\'' + taskId + '\')" title="ICS 파일 내보내기">.ics</button>';
    actHtml += '<button class="btn btn-ghost btn-sm" onclick="openGoogleCalendar(\'' + taskId + '\')" title="Google Calendar에 추가">Google</button>';
    actHtml += '<button class="btn btn-ghost btn-sm" onclick="openOutlookCalendar(\'' + taskId + '\')" title="Outlook에 추가">Outlook</button>';
    actHtml += '</div>';
  }
  actionsEl.innerHTML = actHtml;

  const rect = event.currentTarget.getBoundingClientRect();
  const popupWidth = 340;
  const popupHeight = 400;

  let left = rect.right + 8;
  let top = rect.top;

  if (left + popupWidth > window.innerWidth) {
    left = rect.left - popupWidth - 8;
  }
  if (top + popupHeight > window.innerHeight) {
    top = Math.max(8, window.innerHeight - popupHeight - 8);
  }
  if (left < 8) {
    left = 8;
  }

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('visible');
}

function closeChartPopup() {
  const popup = document.getElementById('chart-task-popup');
  popup.classList.remove('visible');
  chartPopupTaskId = null;
}

function chartPopupToggleDone() {
  if (!chartPopupTaskId) return;
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === chartPopupTaskId);
  if (task) {
    task.done = !task.done;
    saveTasks(tasks);
    closeChartPopup();
    renderAll();
  }
}

function chartPopupEdit() {
  if (!chartPopupTaskId) return;
  closeChartPopup();
  openModal(chartPopupTaskId);
}

function chartPopupDelete() {
  if (!chartPopupTaskId) return;
  if (!confirm('이 Task를 삭제하시겠습니까?')) return;
  const tasks = loadTasks().filter(t => t.id !== chartPopupTaskId);
  saveTasks(tasks);
  selectedIds.delete(chartPopupTaskId);
  closeChartPopup();
  renderAll();
}

// Close popup on outside click
document.addEventListener('click', function(e) {
  const popup = document.getElementById('chart-task-popup');
  if (popup.classList.contains('visible') &&
      !popup.contains(e.target) &&
      !e.target.closest('.ichart-task-node') &&
      !e.target.closest('.mflow-task-node')) {
    closeChartPopup();
  }
});

document.getElementById('chart-status-filter').addEventListener('change', renderChart);
