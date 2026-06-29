// ─── Interactive Chart (Hierarchical Tree) ───
let chartDraggedNode = null;
let chartDragSourceChain = null;

function renderInteractiveChart() {
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

  let html = '<div class="ichart">';

  for (const c1 of Object.keys(tree).sort((a, b) => a.localeCompare(b, 'ko'))) {
    const l1Tasks = collectTasksL1(tree, c1);
    const l1Count = l1Tasks.length;
    const l1Hours = sumHoursArr(l1Tasks);
    const isCollapsed = collapsedL1.has(c1);

    html += '<div class="ichart-l1' + (isCollapsed ? ' collapsed' : '') + '" data-l1="' + escapeHtml(c1) + '">';
    html += '<div class="ichart-l1-header" onclick="toggleL1Collapse(this)">';
    html += '<div class="ichart-level-label"><span class="ichart-level-tag l1">대분류</span><span>' + escapeHtml(c1) + '</span><span class="ichart-l1-toggle">&#9660;</span></div>';
    html += '<span class="ichart-level-stats"><span class="num">' + l1Count + '</span>개 Task | <span class="num">' + formatDecimal(l1Hours) + '</span>h</span>';
    html += '</div>';
    html += '<div class="ichart-l1-body">';

    for (const c2 of Object.keys(tree[c1]).sort((a, b) => a.localeCompare(b, 'ko'))) {
      const l2Tasks = collectTasksL2(tree, c1, c2);
      const l2Count = l2Tasks.length;
      const l2Hours = sumHoursArr(l2Tasks);

      const l2Key = c1 + '|' + c2;
      const isL2Collapsed = collapsedL2.has(l2Key);

      html += '<div class="ichart-l2' + (isL2Collapsed ? ' collapsed' : '') + '" data-l2="' + escapeHtml(l2Key) + '">';
      html += '<div class="ichart-l2-header" onclick="toggleL2Collapse(this)">';
      html += '<div class="ichart-level-label"><span class="ichart-level-tag l2">중분류</span><span>' + escapeHtml(c2) + '</span><span class="ichart-l2-toggle">&#9660;</span></div>';
      html += '<span class="ichart-level-stats"><span class="num">' + l2Count + '</span>개 | <span class="num">' + formatDecimal(l2Hours) + '</span>h</span>';
      html += '</div>';
      html += '<div class="ichart-l2-body">';

      for (const c3 of Object.keys(tree[c1][c2]).sort((a, b) => a.localeCompare(b, 'ko'))) {
        const taskList = tree[c1][c2][c3];
        const sortedTasks = [...taskList].sort((a, b) => (a.chartOrder ?? a.order ?? 0) - (b.chartOrder ?? b.order ?? 0));
        const groupKey = encodeURIComponent(c1 + '|' + c2 + '|' + c3);
        const l3Hours = sumHoursArr(taskList);

        const l3Key = c1 + '|' + c2 + '|' + c3;
        const isL3Collapsed = collapsedL3.has(l3Key);

        html += '<div class="ichart-l3' + (isL3Collapsed ? ' collapsed' : '') + '" data-l3="' + escapeHtml(l3Key) + '">';
        html += '<div class="ichart-l3-header" onclick="toggleL3Collapse(this)">';
        html += '<div class="ichart-level-label"><span class="ichart-level-tag l3">소분류</span><span>' + escapeHtml(c3) + '</span><span class="ichart-l3-toggle">&#9660;</span></div>';
        html += '<span class="ichart-level-stats"><span class="num">' + taskList.length + '</span>개 | <span class="num">' + formatDecimal(l3Hours) + '</span>h</span>';
        html += '</div>';

        html += '<div class="ichart-l3-body">';
        html += '<div class="ichart-task-chain" data-group="' + groupKey + '">';

        const parallelGroups = groupTasksParallel(sortedTasks);

        parallelGroups.forEach((group, gIdx) => {
          const isMulti = group.length > 1;
          html += '<div class="ichart-parallel-group' + (isMulti ? ' multi' : '') + '" data-pgroup="' + gIdx + '">';
          group.forEach((t) => {
            const statusIcon = t.done ? '&#10003; ' : '';
            html += '<div class="ichart-task-node clickable" data-id="' + t.id + '" draggable="true" onclick="openChartTaskPopup(\'' + t.id + '\', event)">';
            html += '<span class="ichart-task-order">' + (gIdx + 1) + '</span>';
            html += '<div class="ichart-task-priority priority-' + t.priority + '"></div>';
            html += '<div class="ichart-task-content">';
            html += '<div class="ichart-task-name" title="' + escapeHtml(t.name) + '">' + statusIcon + escapeHtml(t.name) + '</div>';
            html += '<div class="ichart-task-meta">' + priorityLabel(t.priority) + ' | ' + formatDecimal(t.duration || 1) + 'h';
            if (t.dueDate) html += ' | 마감: ' + formatDate(t.dueDate);
            html += '</div>';
            html += '</div>';
            html += '<span class="ichart-task-handle">&#8942;&#8942;</span>';
            html += '</div>';
          });
          html += '</div>';

          if (gIdx < parallelGroups.length - 1) {
            html += '<button class="parallel-toggle" onclick="toggleParallelGroup(\'' + groupKey + '\', ' + gIdx + ', event)" title="클릭하여 병렬/순차 전환">&#8594;</button>';
          }
        });

        html += '</div>';
        html += '</div>';
        html += '</div>';
      }

      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
  chartArea.innerHTML = html;

  enableCrossChainDragAndDrop(chartArea);
}

// ─── 대분류 접기/펼치기 ───
function toggleL1Collapse(headerEl) {
  const l1El = headerEl.closest('.ichart-l1');
  const c1 = l1El.dataset.l1;
  if (collapsedL1.has(c1)) {
    collapsedL1.delete(c1);
    l1El.classList.remove('collapsed');
  } else {
    collapsedL1.add(c1);
    l1El.classList.add('collapsed');
  }
}

// ─── 중분류 접기/펼치기 ───
function toggleL2Collapse(headerEl) {
  const l2El = headerEl.closest('.ichart-l2');
  const key = l2El.dataset.l2;
  if (collapsedL2.has(key)) {
    collapsedL2.delete(key);
    l2El.classList.remove('collapsed');
  } else {
    collapsedL2.add(key);
    l2El.classList.add('collapsed');
  }
}

// ─── 소분류 접기/펼치기 ───
function toggleL3Collapse(headerEl) {
  const l3El = headerEl.closest('.ichart-l3');
  const key = l3El.dataset.l3;
  if (collapsedL3.has(key)) {
    collapsedL3.delete(key);
    l3El.classList.remove('collapsed');
  } else {
    collapsedL3.add(key);
    l3El.classList.add('collapsed');
  }
}

// ─── Cross-subcategory Drag & Drop ───
function enableCrossChainDragAndDrop(chartArea) {
  const allChains = chartArea.querySelectorAll('.ichart-task-chain');

  chartArea.querySelectorAll('.ichart-task-node').forEach(node => {
    node.addEventListener('dragstart', (e) => {
      chartDraggedNode = node;
      chartDragSourceChain = node.closest('.ichart-task-chain');
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.dataset.id);
    });

    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      chartDraggedNode = null;
      chartArea.querySelectorAll('.ichart-task-node').forEach(n => n.classList.remove('drag-over'));
      chartArea.querySelectorAll('.ichart-task-chain').forEach(c => c.classList.remove('drag-target'));
      chartArea.querySelectorAll('.ichart-parallel-group').forEach(g => g.classList.remove('drag-target'));

      saveAllChainOrdersParallel(chartArea);
      chartDragSourceChain = null;
    });

    node.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (chartDraggedNode && chartDraggedNode !== node) {
        const targetGroup = node.closest('.ichart-parallel-group');
        const nodeRect = node.getBoundingClientRect();

        const relY = e.clientY - nodeRect.top;
        const relX = e.clientX - nodeRect.left;
        const isVerticalDrop = (relY < nodeRect.height * 0.25 || relY > nodeRect.height * 0.75);

        if (isVerticalDrop && targetGroup) {
          if (chartDraggedNode.parentElement !== targetGroup) {
            chartDraggedNode.parentElement && chartDraggedNode.parentElement.removeChild && null;
            targetGroup.appendChild(chartDraggedNode);
          }
          if (relY < nodeRect.height / 2) {
            targetGroup.insertBefore(chartDraggedNode, node);
          } else {
            targetGroup.insertBefore(chartDraggedNode, node.nextSibling);
          }
        } else {
          const chain = node.closest('.ichart-task-chain');
          if (chartDraggedNode.closest('.ichart-task-chain') !== chain) {
            const newGroup = document.createElement('div');
            newGroup.className = 'ichart-parallel-group';
            newGroup.dataset.pgroup = 'new';
            newGroup.appendChild(chartDraggedNode);
            const currentGroup = node.closest('.ichart-parallel-group');
            if (e.clientX < nodeRect.left + nodeRect.width / 2) {
              chain.insertBefore(newGroup, currentGroup);
            } else {
              chain.insertBefore(newGroup, currentGroup.nextSibling);
            }
          }
        }
      }
    });

    node.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (chartDraggedNode && chartDraggedNode !== node) {
        node.classList.add('drag-over');
      }
    });

    node.addEventListener('dragleave', () => {
      node.classList.remove('drag-over');
    });
  });

  chartArea.querySelectorAll('.ichart-parallel-group').forEach(group => {
    group.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (chartDraggedNode && !group.contains(chartDraggedNode)) {
        group.classList.add('drag-target');
      }
    });
    group.addEventListener('dragleave', (e) => {
      if (!group.contains(e.relatedTarget)) {
        group.classList.remove('drag-target');
      }
    });
    group.addEventListener('drop', (e) => {
      e.preventDefault();
      group.classList.remove('drag-target');
      if (chartDraggedNode && !group.contains(chartDraggedNode)) {
        group.appendChild(chartDraggedNode);
      }
    });
  });

  allChains.forEach(chain => {
    chain.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (chartDraggedNode) {
        chain.classList.add('drag-target');
        if (e.target === chain) {
          if (!chartDraggedNode.closest('.ichart-parallel-group') || chartDraggedNode.closest('.ichart-task-chain') !== chain) {
            const newGroup = document.createElement('div');
            newGroup.className = 'ichart-parallel-group';
            newGroup.dataset.pgroup = 'new';
            newGroup.appendChild(chartDraggedNode);
            chain.appendChild(newGroup);
          }
        }
      }
    });

    chain.addEventListener('dragleave', (e) => {
      if (!chain.contains(e.relatedTarget)) {
        chain.classList.remove('drag-target');
      }
    });

    chain.addEventListener('drop', (e) => {
      e.preventDefault();
      chain.classList.remove('drag-target');
    });
  });
}

function saveAllChainOrders(chartArea) {
  const tasks = loadTasks();

  chartArea.querySelectorAll('.ichart-task-chain').forEach(chain => {
    const groupKey = decodeURIComponent(chain.dataset.group);
    const [c1, c2, c3] = groupKey.split('|');
    const ids = [...chain.querySelectorAll('.ichart-task-node')].map(el => el.dataset.id);

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

function saveAllChainOrdersParallel(chartArea) {
  const tasks = loadTasks();

  chartArea.querySelectorAll('.ichart-task-chain').forEach(chain => {
    const groupKey = decodeURIComponent(chain.dataset.group);
    const [c1, c2, c3] = groupKey.split('|');

    chain.querySelectorAll('.ichart-parallel-group').forEach(group => {
      if (group.querySelectorAll('.ichart-task-node').length === 0) {
        group.remove();
      }
    });

    chain.querySelectorAll('.ichart-parallel-group').forEach(group => {
      const count = group.querySelectorAll('.ichart-task-node').length;
      group.classList.toggle('multi', count > 1);
    });

    const parallelGroups = chain.querySelectorAll('.ichart-parallel-group');
    parallelGroups.forEach((group, gIdx) => {
      const nodes = group.querySelectorAll('.ichart-task-node');
      nodes.forEach((node, nIdx) => {
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
