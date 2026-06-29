// ─── Mermaid Interactive Flowchart (mflow) ───
let mflowDraggedNode = null;
let mflowDragLevel = null;
let mflowDragData = null;

async function renderMermaidChart() {
  const chartArea = document.getElementById('chart-area');
  const chartSummary = document.getElementById('chart-summary');
  const { tasks, tree, totalCount, totalHours, hasCategory } = buildChartTree();

  if (tasks.length === 0) {
    chartSummary.style.display = 'none';
    chartArea.innerHTML = '<div class="chart-empty"><div class="icon">&#128202;</div><p>표시할 Task가 없습니다.</p></div>';
    return;
  }

  if (!hasCategory) {
    chartSummary.style.display = 'none';
    chartArea.innerHTML = '<div class="chart-empty"><div class="icon">&#128202;</div><p>분류가 설정된 Task가 없습니다.<br>Task에 대분류/중분류/소분류를 설정하면 차트가 표시됩니다.</p></div>';
    return;
  }

  chartSummary.style.display = 'flex';
  chartSummary.innerHTML = '<span>총 Task: <span class="num">' + totalCount + '</span>개</span><span>총 시간: <span class="num">' + formatDecimal(totalHours) + '</span>h</span>';

  let html = '<div class="mflow" id="mflow-chart">';
  html += '<div class="mflow-hint">각 카테고리 노드를 드래그하여 다른 위치로 이동할 수 있습니다. &#9660; 접기/펼치기 | Task 클릭: 상세정보 | &#8594; 버튼: 병렬/순차 전환 | Task를 다른 Task 위/아래로 드래그: 병렬 그룹</div>';
  html += '<div class="mflow-l1-list">';

  const sortedC1 = Object.keys(tree).sort((a, b) => a.localeCompare(b, 'ko'));

  for (const c1 of sortedC1) {
    const l1Tasks = collectTasksL1(tree, c1);
    const l1Hours = sumHoursArr(l1Tasks);
    const isL1Collapsed = mCollapsedL1.has(c1);

    html += '<div class="mflow-row" data-c1="' + escapeHtml(c1) + '">';

    html += '<div class="mflow-node mflow-l1-node" draggable="true" data-level="l1" data-c1="' + escapeHtml(c1) + '">';
    html += '<div class="mflow-node-toggle' + (isL1Collapsed ? ' collapsed' : '') + '" onclick="toggleMFlowCollapse(\'l1\', \'' + escapeHtml(c1).replace(/'/g, "\\'") + '\', this, event)">&#9660;</div>';
    html += '<div class="mflow-node-content">';
    html += '<span class="mflow-tag l1">대분류</span>';
    html += '<span class="mflow-node-name">' + escapeHtml(c1) + '</span>';
    html += '<span class="mflow-node-stats">' + l1Tasks.length + '개 | ' + formatDecimal(l1Hours) + 'h</span>';
    html += '</div>';
    html += '<span class="mflow-drag-handle">&#8942;&#8942;</span>';
    html += '</div>';

    html += '<div class="mflow-connector' + (isL1Collapsed ? ' collapsed' : '') + '">&#8594;</div>';

    html += '<div class="mflow-children mflow-l2-container' + (isL1Collapsed ? ' collapsed' : '') + '" data-parent-c1="' + escapeHtml(c1) + '">';

    const sortedC2 = Object.keys(tree[c1]).sort((a, b) => a.localeCompare(b, 'ko'));

    for (const c2 of sortedC2) {
      const l2Tasks = collectTasksL2(tree, c1, c2);
      const l2Hours = sumHoursArr(l2Tasks);
      const l2Key = c1 + '|' + c2;
      const isL2Collapsed = mCollapsedL2.has(l2Key);

      html += '<div class="mflow-branch" data-c1="' + escapeHtml(c1) + '" data-c2="' + escapeHtml(c2) + '">';

      html += '<div class="mflow-node mflow-l2-node" draggable="true" data-level="l2" data-c1="' + escapeHtml(c1) + '" data-c2="' + escapeHtml(c2) + '">';
      html += '<div class="mflow-node-toggle' + (isL2Collapsed ? ' collapsed' : '') + '" onclick="toggleMFlowCollapse(\'l2\', \'' + escapeHtml(l2Key).replace(/'/g, "\\'") + '\', this, event)">&#9660;</div>';
      html += '<div class="mflow-node-content">';
      html += '<span class="mflow-tag l2">중분류</span>';
      html += '<span class="mflow-node-name">' + escapeHtml(c2) + '</span>';
      html += '<span class="mflow-node-stats">' + l2Tasks.length + '개 | ' + formatDecimal(l2Hours) + 'h</span>';
      html += '</div>';
      html += '<span class="mflow-drag-handle">&#8942;&#8942;</span>';
      html += '</div>';

      html += '<div class="mflow-connector' + (isL2Collapsed ? ' collapsed' : '') + '">&#8594;</div>';

      html += '<div class="mflow-children mflow-l3-container' + (isL2Collapsed ? ' collapsed' : '') + '" data-parent-c1="' + escapeHtml(c1) + '" data-parent-c2="' + escapeHtml(c2) + '">';

      const sortedC3 = Object.keys(tree[c1][c2]).sort((a, b) => a.localeCompare(b, 'ko'));

      for (const c3 of sortedC3) {
        const taskList = tree[c1][c2][c3];
        const l3Hours = sumHoursArr(taskList);
        const l3Key = c1 + '|' + c2 + '|' + c3;
        const isL3Collapsed = mCollapsedL3.has(l3Key);
        const sortedTasks = [...taskList].sort((a, b) => (a.chartOrder ?? a.order ?? 0) - (b.chartOrder ?? b.order ?? 0));

        html += '<div class="mflow-branch" data-c1="' + escapeHtml(c1) + '" data-c2="' + escapeHtml(c2) + '" data-c3="' + escapeHtml(c3) + '">';

        html += '<div class="mflow-node mflow-l3-node" draggable="true" data-level="l3" data-c1="' + escapeHtml(c1) + '" data-c2="' + escapeHtml(c2) + '" data-c3="' + escapeHtml(c3) + '">';
        html += '<div class="mflow-node-toggle' + (isL3Collapsed ? ' collapsed' : '') + '" onclick="toggleMFlowCollapse(\'l3\', \'' + escapeHtml(l3Key).replace(/'/g, "\\'") + '\', this, event)">&#9660;</div>';
        html += '<div class="mflow-node-content">';
        html += '<span class="mflow-tag l3">소분류</span>';
        html += '<span class="mflow-node-name">' + escapeHtml(c3) + '</span>';
        html += '<span class="mflow-node-stats">' + taskList.length + '개 | ' + l3Hours + 'h</span>';
        html += '</div>';
        html += '<span class="mflow-drag-handle">&#8942;&#8942;</span>';
        html += '</div>';

        html += '<div class="mflow-connector' + (isL3Collapsed ? ' collapsed' : '') + '">&#8594;</div>';

        const mflowGroupKey = encodeURIComponent(c1 + '|' + c2 + '|' + c3);
        html += '<div class="mflow-task-chain' + (isL3Collapsed ? ' collapsed' : '') + '" data-c1="' + escapeHtml(c1) + '" data-c2="' + escapeHtml(c2) + '" data-c3="' + escapeHtml(c3) + '">';

        const mflowParallelGroups = groupTasksParallel(sortedTasks);

        mflowParallelGroups.forEach((group, gIdx) => {
          const isMulti = group.length > 1;
          html += '<div class="mflow-parallel-group' + (isMulti ? ' multi' : '') + '" data-pgroup="' + gIdx + '">';
          group.forEach((t) => {
            const statusIcon = t.done ? '&#10003; ' : '';
            const prioClass = 'priority-' + t.priority;
            html += '<div class="mflow-task-node clickable" data-id="' + t.id + '" draggable="true" onclick="openChartTaskPopup(\'' + t.id + '\', event)">';
            html += '<div class="ichart-task-priority ' + prioClass + '"></div>';
            html += '<div class="ichart-task-content">';
            html += '<div class="ichart-task-name" title="' + escapeHtml(t.name) + '">' + statusIcon + escapeHtml(t.name) + '</div>';
            html += '<div class="ichart-task-meta">' + priorityLabel(t.priority) + ' | ' + (t.duration || 1) + 'h</div>';
            html += '</div>';
            html += '</div>';
          });
          html += '</div>';

          if (gIdx < mflowParallelGroups.length - 1) {
            html += '<button class="parallel-toggle" onclick="toggleParallelGroup(\'' + mflowGroupKey + '\', ' + gIdx + ', event)" title="클릭하여 병렬/순차 전환">&#8594;</button>';
          }
        });

        html += '</div>';
        html += '</div>';
      }

      html += '<div class="mflow-drop-zone" data-drop-level="l3" data-parent-c1="' + escapeHtml(c1) + '" data-parent-c2="' + escapeHtml(c2) + '">+ 소분류 이동</div>';

      html += '</div>';
      html += '</div>';
    }

    html += '<div class="mflow-drop-zone" data-drop-level="l2" data-parent-c1="' + escapeHtml(c1) + '">+ 중분류 이동</div>';

    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
  html += '</div>';
  chartArea.innerHTML = html;

  initMFlowDragAndDrop();
}

// ─── MFlow Collapse Toggle ───
function toggleMFlowCollapse(level, key, toggleEl, event) {
  event.stopPropagation();
  event.preventDefault();
  const sets = { l1: mCollapsedL1, l2: mCollapsedL2, l3: mCollapsedL3 };
  const set = sets[level];

  if (set.has(key)) {
    set.delete(key);
    toggleEl.classList.remove('collapsed');
  } else {
    set.add(key);
    toggleEl.classList.add('collapsed');
  }

  const node = toggleEl.closest('.mflow-node');
  let sibling = node.nextElementSibling;
  while (sibling) {
    if (sibling.classList.contains('mflow-connector') ||
        sibling.classList.contains('mflow-children') ||
        sibling.classList.contains('mflow-task-chain')) {
      sibling.classList.toggle('collapsed', set.has(key));
    }
    sibling = sibling.nextElementSibling;
  }
}

// ─── MFlow Drag & Drop ───
function initMFlowDragAndDrop() {
  const chart = document.getElementById('mflow-chart');
  if (!chart) return;

  chart.querySelectorAll('.mflow-node[draggable="true"]').forEach(node => {
    node.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      mflowDraggedNode = node;
      mflowDragLevel = node.dataset.level;
      mflowDragData = {
        c1: node.dataset.c1 || '',
        c2: node.dataset.c2 || '',
        c3: node.dataset.c3 || ''
      };
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(mflowDragData));
      chart.classList.add('dragging-' + mflowDragLevel);
    });

    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      chart.classList.remove('dragging-l1', 'dragging-l2', 'dragging-l3', 'dragging-task');
      mflowDraggedNode = null;
      mflowDragLevel = null;
      mflowDragData = null;
      chart.querySelectorAll('.drag-over, .drag-active, .drag-over-row').forEach(el => {
        el.classList.remove('drag-over', 'drag-active', 'drag-over-row');
      });
    });
  });

  // L1 row reordering
  chart.querySelectorAll('.mflow-row').forEach(row => {
    row.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'l1' && mflowDraggedNode) {
        const draggedRow = mflowDraggedNode.closest('.mflow-row');
        if (draggedRow && draggedRow !== row) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over-row');
          const rect = row.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          const parent = row.parentElement;
          if (e.clientY < mid) {
            parent.insertBefore(draggedRow, row);
          } else if (row.nextSibling) {
            parent.insertBefore(draggedRow, row.nextSibling);
          } else {
            parent.appendChild(draggedRow);
          }
        }
      }
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-row');
    });
    row.addEventListener('drop', (e) => {
      if (mflowDragLevel === 'l1') {
        e.preventDefault();
        row.classList.remove('drag-over-row');
      }
    });
  });

  // Drop on L1 node (accept L2 drop)
  chart.querySelectorAll('.mflow-l1-node').forEach(node => {
    node.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'l2' && mflowDraggedNode !== node) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        node.classList.add('drag-over');
      }
    });
    node.addEventListener('dragleave', () => { node.classList.remove('drag-over'); });
    node.addEventListener('drop', (e) => {
      if (mflowDragLevel !== 'l2') return;
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('drag-over');
      const newC1 = node.dataset.c1;
      const oldC1 = mflowDragData.c1;
      const c2 = mflowDragData.c2;
      if (oldC1 !== newC1) {
        const tasks = loadTasks();
        tasks.forEach(t => {
          if (t.category1 === oldC1 && t.category2 === c2) {
            t.category1 = newC1;
          }
        });
        saveTasks(tasks);
        renderMermaidChart();
      }
    });
  });

  // Drop on L2 node (accept L3 drop)
  chart.querySelectorAll('.mflow-l2-node').forEach(node => {
    node.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'l3' && mflowDraggedNode !== node) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        node.classList.add('drag-over');
      }
    });
    node.addEventListener('dragleave', () => { node.classList.remove('drag-over'); });
    node.addEventListener('drop', (e) => {
      if (mflowDragLevel !== 'l3') return;
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('drag-over');
      const newC1 = node.dataset.c1;
      const newC2 = node.dataset.c2;
      const oldC1 = mflowDragData.c1;
      const oldC2 = mflowDragData.c2;
      const c3 = mflowDragData.c3;
      if (oldC1 !== newC1 || oldC2 !== newC2) {
        const tasks = loadTasks();
        tasks.forEach(t => {
          if (t.category1 === oldC1 && t.category2 === oldC2 && t.category3 === c3) {
            t.category1 = newC1;
            t.category2 = newC2;
          }
        });
        saveTasks(tasks);
        renderMermaidChart();
      }
    });
  });

  // L2 branch reordering within same L1
  chart.querySelectorAll('.mflow-l2-container').forEach(container => {
    const branches = container.querySelectorAll(':scope > .mflow-branch');
    branches.forEach(branch => {
      branch.addEventListener('dragover', (e) => {
        if (mflowDragLevel === 'l2' && mflowDraggedNode) {
          const draggedBranch = mflowDraggedNode.closest('.mflow-branch');
          if (draggedBranch && draggedBranch !== branch && draggedBranch.parentElement === branch.parentElement) {
            e.preventDefault();
            e.stopPropagation();
            const rect = branch.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
              container.insertBefore(draggedBranch, branch);
            } else if (branch.nextSibling) {
              container.insertBefore(draggedBranch, branch.nextSibling);
            } else {
              container.appendChild(draggedBranch);
            }
          }
        }
      });
    });
  });

  // L3 branch reordering within same L2
  chart.querySelectorAll('.mflow-l3-container').forEach(container => {
    const branches = container.querySelectorAll(':scope > .mflow-branch');
    branches.forEach(branch => {
      branch.addEventListener('dragover', (e) => {
        if (mflowDragLevel === 'l3' && mflowDraggedNode) {
          const draggedBranch = mflowDraggedNode.closest('.mflow-branch');
          if (draggedBranch && draggedBranch !== branch && draggedBranch.parentElement === branch.parentElement) {
            e.preventDefault();
            e.stopPropagation();
            const rect = branch.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
              container.insertBefore(draggedBranch, branch);
            } else if (branch.nextSibling) {
              container.insertBefore(draggedBranch, branch.nextSibling);
            } else {
              container.appendChild(draggedBranch);
            }
          }
        }
      });
    });
  });

  // Drop zones
  chart.querySelectorAll('.mflow-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      const dropLevel = zone.dataset.dropLevel;
      if (mflowDragLevel === dropLevel) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-active');
      }
    });
    zone.addEventListener('dragleave', () => { zone.classList.remove('drag-active'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-active');
      if (!mflowDragData) return;
      const dropLevel = zone.dataset.dropLevel;
      if (mflowDragLevel !== dropLevel) return;

      const tasks = loadTasks();

      if (dropLevel === 'l2') {
        const newC1 = zone.dataset.parentC1;
        const oldC1 = mflowDragData.c1;
        const c2 = mflowDragData.c2;
        if (oldC1 !== newC1) {
          tasks.forEach(t => {
            if (t.category1 === oldC1 && t.category2 === c2) {
              t.category1 = newC1;
            }
          });
          saveTasks(tasks);
          renderMermaidChart();
        }
      } else if (dropLevel === 'l3') {
        const newC1 = zone.dataset.parentC1;
        const newC2 = zone.dataset.parentC2;
        const oldC1 = mflowDragData.c1;
        const oldC2 = mflowDragData.c2;
        const c3 = mflowDragData.c3;
        if (oldC1 !== newC1 || oldC2 !== newC2) {
          tasks.forEach(t => {
            if (t.category1 === oldC1 && t.category2 === oldC2 && t.category3 === c3) {
              t.category1 = newC1;
              t.category2 = newC2;
            }
          });
          saveTasks(tasks);
          renderMermaidChart();
        }
      }
    });
  });

  // Task node drag & drop within mflow (parallel group support)
  chart.querySelectorAll('.mflow-task-node').forEach(node => {
    node.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      mflowDraggedNode = node;
      mflowDragLevel = 'task';
      mflowDragData = { taskId: node.dataset.id };
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.dataset.id);
    });
    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      mflowDraggedNode = null;
      mflowDragLevel = null;
      mflowDragData = null;
      chart.querySelectorAll('.drag-over, .drag-active').forEach(el => {
        el.classList.remove('drag-over', 'drag-active');
      });
      saveMFlowTaskOrdersParallel();
    });
    node.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'task' && mflowDraggedNode && mflowDraggedNode !== node) {
        e.preventDefault();
        e.stopPropagation();
        const targetGroup = node.closest('.mflow-parallel-group');
        const nodeRect = node.getBoundingClientRect();
        const relY = e.clientY - nodeRect.top;

        if (targetGroup) {
          if (mflowDraggedNode.parentElement !== targetGroup) {
            targetGroup.appendChild(mflowDraggedNode);
          }
          if (relY < nodeRect.height / 2) {
            targetGroup.insertBefore(mflowDraggedNode, node);
          } else {
            targetGroup.insertBefore(mflowDraggedNode, node.nextSibling);
          }
        }
      }
    });
  });

  // Parallel groups as drop targets
  chart.querySelectorAll('.mflow-parallel-group').forEach(group => {
    group.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'task' && mflowDraggedNode && !group.contains(mflowDraggedNode)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        group.classList.add('drag-active');
      }
    });
    group.addEventListener('dragleave', (e) => {
      if (!group.contains(e.relatedTarget)) {
        group.classList.remove('drag-active');
      }
    });
    group.addEventListener('drop', (e) => {
      if (mflowDragLevel === 'task') {
        e.preventDefault();
        e.stopPropagation();
        group.classList.remove('drag-active');
        if (mflowDraggedNode && !group.contains(mflowDraggedNode)) {
          group.appendChild(mflowDraggedNode);
        }
      }
    });
  });

  // Task chains as drop targets
  chart.querySelectorAll('.mflow-task-chain').forEach(chain => {
    chain.addEventListener('dragover', (e) => {
      if (mflowDragLevel === 'task') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (mflowDraggedNode && e.target === chain) {
          const newGroup = document.createElement('div');
          newGroup.className = 'mflow-parallel-group';
          newGroup.dataset.pgroup = 'new';
          newGroup.appendChild(mflowDraggedNode);
          chain.appendChild(newGroup);
        }
      }
    });
    chain.addEventListener('drop', (e) => {
      if (mflowDragLevel === 'task') {
        e.preventDefault();
      }
    });
  });
}

function saveMFlowTaskOrders() {
  const chart = document.getElementById('mflow-chart');
  if (!chart) return;
  const tasks = loadTasks();
  chart.querySelectorAll('.mflow-task-chain').forEach(chain => {
    const c1 = chain.dataset.c1;
    const c2 = chain.dataset.c2;
    const c3 = chain.dataset.c3;
    const ids = [...chain.querySelectorAll('.mflow-task-node')].map(el => el.dataset.id);
    ids.forEach((id, index) => {
      const t = tasks.find(x => x.id === id);
      if (t) {
        t.chartOrder = index;
        if (c1) t.category1 = c1;
        if (c2) t.category2 = c2;
        if (c3) t.category3 = c3;
      }
    });
  });
  saveTasks(tasks);
}

function saveMFlowTaskOrdersParallel() {
  const chart = document.getElementById('mflow-chart');
  if (!chart) return;
  const tasks = loadTasks();
  chart.querySelectorAll('.mflow-task-chain').forEach(chain => {
    const c1 = chain.dataset.c1;
    const c2 = chain.dataset.c2;
    const c3 = chain.dataset.c3;

    chain.querySelectorAll('.mflow-parallel-group').forEach(group => {
      if (group.querySelectorAll('.mflow-task-node').length === 0) {
        group.remove();
      }
    });

    chain.querySelectorAll('.mflow-parallel-group').forEach(group => {
      const count = group.querySelectorAll('.mflow-task-node').length;
      group.classList.toggle('multi', count > 1);
    });

    const parallelGroups = chain.querySelectorAll('.mflow-parallel-group');
    parallelGroups.forEach((group, gIdx) => {
      const nodes = group.querySelectorAll('.mflow-task-node');
      nodes.forEach((node) => {
        const id = node.dataset.id;
        const t = tasks.find(x => x.id === id);
        if (t) {
          t.chartGroup = gIdx;
          t.chartOrder = gIdx;
          if (c1) t.category1 = c1;
          if (c2) t.category2 = c2;
          if (c3) t.category3 = c3;
        }
      });
    });
  });
  saveTasks(tasks);
}
