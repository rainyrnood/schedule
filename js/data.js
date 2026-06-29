// ─── Data Layer ───
const STORAGE_KEY = 'ot-tasks';
const CATEGORY_MAP_KEY = 'ot-category-map';

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Category Mapping ───
function loadCategoryMap() {
  try { return JSON.parse(localStorage.getItem(CATEGORY_MAP_KEY)) || {}; }
  catch { return {}; }
}

function saveCategoryMap(map) {
  localStorage.setItem(CATEGORY_MAP_KEY, JSON.stringify(map));
}

function updateCategoryMap(cat1, cat2, cat3) {
  const map = loadCategoryMap();
  if (cat1 && cat2) {
    if (!map[cat1]) map[cat1] = [];
    if (!map[cat1].includes(cat2)) map[cat1].push(cat2);
  }
  if (cat2 && cat3) {
    if (!map[cat2]) map[cat2] = [];
    if (!map[cat2].includes(cat3)) map[cat2].push(cat3);
  }
  saveCategoryMap(map);
}

function getUniqueCategories(field) {
  const tasks = loadTasks();
  const set = new Set();
  for (const t of tasks) {
    if (t[field]) set.add(t[field]);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

function populateCategoryDatalist(datalistId, values) {
  const dl = document.getElementById(datalistId);
  dl.innerHTML = values.map(v => '<option value="' + escapeHtml(v) + '">').join('');
}

function refreshCategoryDatalists() {
  populateCategoryDatalist('dl-category1', getUniqueCategories('category1'));
  populateCategoryDatalist('dl-category2', getUniqueCategories('category2'));
  populateCategoryDatalist('dl-category3', getUniqueCategories('category3'));
}

// Category cascading
document.getElementById('task-category1').addEventListener('input', function() {
  const cat1 = this.value.trim();
  const map = loadCategoryMap();
  if (cat1 && map[cat1] && map[cat1].length > 0) {
    const cat2Input = document.getElementById('task-category2');
    if (!cat2Input.value.trim()) {
      cat2Input.value = map[cat1][0];
      cat2Input.dispatchEvent(new Event('input'));
    }
  }
  if (cat1 && map[cat1]) {
    populateCategoryDatalist('dl-category2', map[cat1]);
  } else {
    populateCategoryDatalist('dl-category2', getUniqueCategories('category2'));
  }
});

document.getElementById('task-category2').addEventListener('input', function() {
  const cat2 = this.value.trim();
  const map = loadCategoryMap();
  if (cat2 && map[cat2] && map[cat2].length > 0) {
    const cat3Input = document.getElementById('task-category3');
    if (!cat3Input.value.trim()) {
      cat3Input.value = map[cat2][0];
    }
  }
  if (cat2 && map[cat2]) {
    populateCategoryDatalist('dl-category3', map[cat2]);
  } else {
    populateCategoryDatalist('dl-category3', getUniqueCategories('category3'));
  }
});

// ─── Category Filter Dropdowns ───
function updateCategoryFilters() {
  const f1 = document.getElementById('filter-category1');
  const f2 = document.getElementById('filter-category2');
  const f3 = document.getElementById('filter-category3');

  const val1 = f1.value;
  const val2 = f2.value;
  const val3 = f3.value;

  const cats1 = getUniqueCategories('category1');
  const cats2 = getUniqueCategories('category2');
  const cats3 = getUniqueCategories('category3');

  f1.innerHTML = '<option value="">모든 대분류</option>' + cats1.map(c => '<option value="' + escapeHtml(c) + '"' + (c === val1 ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
  f2.innerHTML = '<option value="">모든 중분류</option>' + cats2.map(c => '<option value="' + escapeHtml(c) + '"' + (c === val2 ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
  f3.innerHTML = '<option value="">모든 소분류</option>' + cats3.map(c => '<option value="' + escapeHtml(c) + '"' + (c === val3 ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
}
