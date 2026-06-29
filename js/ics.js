// ─── ICS Calendar Export ───
function generateICS(tasks) {
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//OT Task Manager//Rev23//KO\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  for (const t of tasks) {
    if (!t.scheduledDate) continue;
    const dateStr = t.scheduledDate.replace(/-/g, '');
    const dur = t.duration || 1;
    const durH = Math.floor(dur);
    const durM = Math.round((dur - durH) * 60);

    let dtStart, dtEnd;
    if (t.scheduledTime) {
      const timeStr = t.scheduledTime.replace(':', '') + '00';
      dtStart = dateStr + 'T' + timeStr;
      // Calculate end time
      const [sh, sm] = t.scheduledTime.split(':').map(Number);
      const endMin = sh * 60 + sm + dur * 60;
      const eh = Math.floor(endMin / 60);
      const em = Math.round(endMin % 60);
      dtEnd = dateStr + 'T' + String(eh).padStart(2, '0') + String(em).padStart(2, '0') + '00';
    } else {
      dtStart = dateStr + 'T080000';
      dtEnd = dateStr + 'T' + String(8 + durH).padStart(2, '0') + String(durM).padStart(2, '0') + '00';
    }

    ics += 'BEGIN:VEVENT\r\n';
    ics += 'UID:' + t.id + '@ot-task-manager\r\n';
    ics += 'DTSTART:' + dtStart + '\r\n';
    ics += 'DTEND:' + dtEnd + '\r\n';
    ics += 'SUMMARY:' + (t.name || '').replace(/[,;\\]/g, ' ') + '\r\n';
    if (t.description) ics += 'DESCRIPTION:' + t.description.replace(/\n/g, '\\n').replace(/[,;\\]/g, ' ') + '\r\n';
    if (t.priority === 'high') ics += 'PRIORITY:1\r\n';
    else if (t.priority === 'low') ics += 'PRIORITY:9\r\n';
    else ics += 'PRIORITY:5\r\n';
    if (t.done) ics += 'STATUS:COMPLETED\r\n';
    ics += 'END:VEVENT\r\n';
  }
  ics += 'END:VCALENDAR\r\n';
  return ics;
}

function exportAllICS() {
  const tasks = loadTasks().filter(t => t.scheduledDate);
  if (tasks.length === 0) { alert('내보낼 Task가 없습니다. (배정일이 있는 Task만 내보냅니다)'); return; }
  const ics = generateICS(tasks);
  downloadFile(ics, '일정관리_' + todayStr() + '.ics', 'text/calendar');
}

function exportTaskICS(taskId) {
  const task = loadTasks().find(t => t.id === taskId);
  if (!task) return;
  if (!task.scheduledDate) {
    alert('배정일이 없는 Task는 내보낼 수 없습니다.');
    return;
  }
  const ics = generateICS([task]);
  downloadFile(ics, (task.name || 'task') + '.ics', 'text/calendar');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openGoogleCalendar(taskId) {
  const task = loadTasks().find(t => t.id === taskId);
  if (!task || !task.scheduledDate) { alert('배정일이 없는 Task는 연동할 수 없습니다.'); return; }

  const dateStr = task.scheduledDate.replace(/-/g, '');
  const dur = task.duration || 1;
  let startTime, endTime;

  if (task.scheduledTime) {
    startTime = dateStr + 'T' + task.scheduledTime.replace(':', '') + '00';
    const [sh, sm] = task.scheduledTime.split(':').map(Number);
    const endMin = sh * 60 + sm + dur * 60;
    const eh = Math.floor(endMin / 60);
    const em = Math.round(endMin % 60);
    endTime = dateStr + 'T' + String(eh).padStart(2, '0') + String(em).padStart(2, '0') + '00';
  } else {
    startTime = dateStr + 'T080000';
    const durH = Math.floor(dur);
    const durM = Math.round((dur - durH) * 60);
    endTime = dateStr + 'T' + String(8 + durH).padStart(2, '0') + String(durM).padStart(2, '0') + '00';
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.name || '',
    dates: startTime + '/' + endTime,
    details: task.description || '',
  });

  window.open('https://calendar.google.com/calendar/render?' + params.toString(), '_blank');
}

function openOutlookCalendar(taskId) {
  const task = loadTasks().find(t => t.id === taskId);
  if (!task || !task.scheduledDate) { alert('배정일이 없는 Task는 연동할 수 없습니다.'); return; }

  const dur = task.duration || 1;
  let startISO, endISO;

  if (task.scheduledTime) {
    startISO = task.scheduledDate + 'T' + task.scheduledTime + ':00';
    const [sh, sm] = task.scheduledTime.split(':').map(Number);
    const endMin = sh * 60 + sm + dur * 60;
    const eh = Math.floor(endMin / 60);
    const em = Math.round(endMin % 60);
    endISO = task.scheduledDate + 'T' + String(eh).padStart(2, '0') + ':' + String(em).padStart(2, '0') + ':00';
  } else {
    startISO = task.scheduledDate + 'T08:00:00';
    const durH = Math.floor(dur);
    const durM = Math.round((dur - durH) * 60);
    endISO = task.scheduledDate + 'T' + String(8 + durH).padStart(2, '0') + ':' + String(durM).padStart(2, '0') + ':00';
  }

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: task.name || '',
    startdt: startISO,
    enddt: endISO,
    body: task.description || '',
  });

  window.open('https://outlook.live.com/calendar/0/deeplink/compose?' + params.toString(), '_blank');
}

// ─── ICS Calendar Import (Teams/Outlook .ics 가져오기) ───
function importICS(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const icsContent = e.target.result;
      const events = parseICS(icsContent);

      if (events.length === 0) {
        alert('.ics 파일에서 일정을 찾을 수 없습니다.');
        return;
      }

      const msg = events.length + '개의 일정을 가져오시겠습니까?\n\n' +
        events.slice(0, 5).map((ev, i) => (i + 1) + '. ' + ev.summary + ' (' + ev.dateStr + ')').join('\n') +
        (events.length > 5 ? '\n... 외 ' + (events.length - 5) + '개' : '');

      if (!confirm(msg)) return;

      const tasks = loadTasks();
      let imported = 0;

      for (const ev of events) {
        // 중복 체크 (같은 이름 + 같은 날짜)
        const exists = tasks.some(t =>
          t.name === ev.summary && t.scheduledDate === ev.dateStr
        );
        if (exists) continue;

        tasks.push({
          id: generateId(),
          name: ev.summary,
          description: ev.description || '',
          priority: 'medium',
          duration: ev.duration,
          category1: '',
          category2: '',
          category3: '',
          dueDate: ev.dateStr,
          dueTime: '',
          scheduledDate: ev.dateStr,
          scheduledTime: ev.timeStr || '',
          done: false,
          order: tasks.length,
          createdAt: new Date().toISOString(),
          source: 'ics-import'
        });
        imported++;
      }

      saveTasks(tasks);
      renderAll();
      alert(imported + '개의 일정을 가져왔습니다.' +
        (events.length - imported > 0 ? ' (' + (events.length - imported) + '개 중복 건너뜀)' : ''));
    } catch (err) {
      alert('.ics 파일을 읽는 중 오류가 발생했습니다.\n' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function parseICS(icsText) {
  const events = [];
  const lines = unfoldICSLines(icsText);

  let inEvent = false;
  let current = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (current.dtstart) {
        const parsed = parseICSDateTime(current.dtstart);
        if (parsed) {
          let duration = 1; // 기본 1시간
          if (current.dtend) {
            const endParsed = parseICSDateTime(current.dtend);
            if (endParsed && parsed.date === endParsed.date && endParsed.totalMinutes > parsed.totalMinutes) {
              duration = (endParsed.totalMinutes - parsed.totalMinutes) / 60;
            } else if (endParsed && endParsed.date !== parsed.date) {
              // 여러 날에 걸친 이벤트: 하루 업무시간으로 계산
              duration = 8;
            }
          } else if (current.duration) {
            duration = parseICSDuration(current.duration);
          }

          // 최소 5분, 최대 12시간
          duration = Math.max(0.0833, Math.min(12, duration));
          // 5분 단위로 반올림
          duration = Math.round(duration * 12) / 12;

          events.push({
            summary: unescapeICSText(current.summary || '(제목 없음)'),
            description: unescapeICSText(current.description || ''),
            dateStr: parsed.date,
            timeStr: parsed.time || '',
            duration: duration,
          });
        }
      }
      continue;
    }

    if (!inEvent) continue;

    // 속성 파싱 (DTSTART;TZID=...:값 또는 DTSTART:값)
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const propPart = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1).trim();
    const propName = propPart.split(';')[0].toUpperCase();

    if (propName === 'DTSTART') current.dtstart = value;
    else if (propName === 'DTEND') current.dtend = value;
    else if (propName === 'SUMMARY') current.summary = value;
    else if (propName === 'DESCRIPTION') current.description = value;
    else if (propName === 'DURATION') current.duration = value;
  }

  return events;
}

// ICS 긴 줄 펼치기 (RFC 5545: 줄 접기 해제)
function unfoldICSLines(text) {
  // CRLF + space/tab -> 연결
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return unfolded.split(/\r?\n/);
}

// ICS 날짜/시간 파싱
function parseICSDateTime(value) {
  // 형식: 20260315T090000, 20260315T090000Z, 20260315
  const cleaned = value.replace('Z', '').trim();

  if (cleaned.length >= 8) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    const date = year + '-' + month + '-' + day;

    let time = '';
    let totalMinutes = 0;

    if (cleaned.length >= 15 && cleaned.charAt(8) === 'T') {
      const hh = parseInt(cleaned.substring(9, 11));
      const mm = parseInt(cleaned.substring(11, 13));
      time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      totalMinutes = hh * 60 + mm;
    }

    return { date, time, totalMinutes };
  }

  return null;
}

// ICS DURATION 파싱 (PT1H30M 등)
function parseICSDuration(dur) {
  let hours = 0;
  const hMatch = dur.match(/(\d+)H/i);
  const mMatch = dur.match(/(\d+)M/i);
  const dMatch = dur.match(/(\d+)D/i);

  if (dMatch) hours += parseInt(dMatch[1]) * 8; // 하루 = 8시간
  if (hMatch) hours += parseInt(hMatch[1]);
  if (mMatch) hours += parseInt(mMatch[1]) / 60;

  return hours || 1;
}

// ICS 텍스트 이스케이프 해제
function unescapeICSText(text) {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
