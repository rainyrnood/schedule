// ─── Dashboard Rendering ───
function renderDashboard() {
  const tasks = loadTasks();
  const today = todayStr();
  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  // 완료된 항목도 오늘 업무에 포함하여 시간 계산
  const todayAllTasks = tasks.filter(t => t.scheduledDate === today);
  const todayActiveTasks = active.filter(t => t.scheduledDate === today);
  const overdue = active.filter(t => t.dueDate && t.dueDate < today);

  document.getElementById('stat-total').textContent = tasks.length;
  document.getElementById('stat-today').textContent = todayAllTasks.length;
  const todayTotalHrs = todayAllTasks.reduce((s, t) => s + (t.duration || 1), 0);
  document.getElementById('stat-today-hours').textContent = todayAllTasks.length
    ? '총 ' + formatDecimal(todayTotalHrs) + '시간'
    : '';
  document.getElementById('stat-overdue').textContent = overdue.length;
  document.getElementById('stat-done').textContent = done.length;

  const schedule = computeDaySchedule(today);
  const totalH = schedule.totalHours;
  document.getElementById('stat-work-hours').textContent = formatDecimal(totalH) + 'h / ' + MAX_HOURS + 'h';
  if (totalH > 0 && schedule.slots.length > 0) {
    const startTime = formatHour(WORK_START_HOUR);
    const lastSlot = schedule.slots[schedule.slots.length - 1];
    const endTime = formatHour(lastSlot.endHour);
    document.getElementById('stat-work-range').textContent = startTime + ' ~ ' + endTime + ' (점심 제외)';
  } else if (totalH > 0) {
    document.getElementById('stat-work-range').textContent = '시간 미지정 업무 ' + schedule.untimedTasks.length + '건';
  } else {
    document.getElementById('stat-work-range').textContent = '배정된 업무 없음';
  }

  renderTimeline(today);
  renderTaskList('today-tasks', todayAllTasks.length ? todayAllTasks : null, '오늘 배정된 Task가 없습니다.', false);

  const urgent = active
    .filter(t => t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);
  renderTaskList('urgent-tasks', urgent.length ? urgent : null, '기한 관련 Task가 없습니다.', false);
}

function renderTimeline(dateStr) {
  const container = document.getElementById('today-timeline');
  const summary = document.getElementById('today-summary');
  const schedule = computeDaySchedule(dateStr);

  if (schedule.slots.length === 0 && schedule.untimedTasks.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px"><p>오늘 배정된 업무가 없습니다.</p></div>';
    summary.textContent = '';
    return;
  }

  const totalH = schedule.totalHours;
  const lunchDur = schedule.lunchDuration;
  const pct = Math.min(100, (totalH / MAX_HOURS) * 100);
  const barColor = totalH >= MAX_HOURS ? 'var(--danger)' : totalH >= 6 ? 'var(--warning)' : 'var(--primary)';

  summary.textContent = formatDecimal(totalH) + ' / ' + MAX_HOURS + ' 시간 배정됨';

  let html = '';
  html += '<div class="timeline-header"><span>' + formatHour(WORK_START_HOUR) + '</span><span>' + formatHour(WORK_START_HOUR + MAX_HOURS + lunchDur) + ' (점심 ' + formatDecimal(lunchDur) + 'h 제외)</span></div>';
  html += '<div class="timeline-bar-bg"><div class="timeline-bar-fill" style="width:' + formatDecimal(pct) + '%;background:' + barColor + '">' + formatDecimal(totalH) + 'h / ' + MAX_HOURS + 'h</div></div>';

  // Build combined slot list with lunch break inserted chronologically
  const allSlots = [];
  for (const slot of schedule.slots) {
    allSlots.push({ type: 'task', ...slot });
  }
  // Insert lunch break only if there are timed tasks
  if (schedule.slots.length > 0) {
    allSlots.push({
      type: 'lunch',
      startHour: schedule.lunchStartH,
      endHour: schedule.lunchEndH,
      startTime: formatHour(schedule.lunchStartH),
      endTime: formatHour(schedule.lunchEndH),
      duration: lunchDur,
      name: '점심시간'
    });
  }
  // Sort by start time
  allSlots.sort((a, b) => a.startHour - b.startHour);

  html += '<div class="timeline-slots">';
  for (const slot of allSlots) {
    if (slot.type === 'lunch') {
      const widthPct = (slot.duration / MAX_HOURS) * 100;
      html += `
        <div class="timeline-slot timeline-lunch-slot">
          <div class="timeline-slot-time">${slot.startTime} ~ ${slot.endTime}</div>
          <div class="timeline-slot-bar" style="width:${Math.max(widthPct, 15)}%">${slot.name}</div>
          <div class="timeline-slot-dur">${formatDecimal(slot.duration)}h</div>
        </div>`;
    } else {
      const color = priorityColor(slot.priority);
      const widthPct = ((slot.duration || 1) / MAX_HOURS) * 100;
      const doneLabel = slot.done ? ' (완료)' : '';
      html += `
        <div class="timeline-slot">
          <div class="timeline-slot-time">${slot.startTime} ~ ${slot.endTime}</div>
          <div class="timeline-slot-bar" style="background:${color};width:${Math.max(widthPct, 20)}%;${slot.done ? 'opacity:0.5;text-decoration:line-through;' : ''}">${escapeHtml(slot.name)}${doneLabel}</div>
          <div class="timeline-slot-dur">${formatDurationLabel(slot.duration || 1)}</div>
        </div>`;
    }
  }

  // 시간 미지정 Task를 아래쪽에 표시 (시간 표시 없이)
  if (schedule.untimedTasks.length > 0) {
    html += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);">';
    html += '<div style="font-size:12px;color:var(--text-light);font-weight:600;margin-bottom:6px;">시간 미지정 업무</div>';
    for (const t of schedule.untimedTasks) {
      const color = priorityColor(t.priority);
      const widthPct = ((t.duration || 1) / MAX_HOURS) * 100;
      const doneLabel = t.done ? ' (완료)' : '';
      html += `
        <div class="timeline-slot">
          <div class="timeline-slot-time" style="color:var(--text-light);font-style:italic;">시간 미지정</div>
          <div class="timeline-slot-bar" style="background:${color};width:${Math.max(widthPct, 20)}%;${t.done ? 'opacity:0.5;text-decoration:line-through;' : ''}">${escapeHtml(t.name)}${doneLabel}</div>
          <div class="timeline-slot-dur">${formatDurationLabel(t.duration || 1)}</div>
        </div>`;
    }
    html += '</div>';
  }

  html += '</div>';

  container.innerHTML = html;
}
