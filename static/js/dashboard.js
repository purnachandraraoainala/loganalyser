/* dashboard.js */

const PER_PAGE = 100;
let currentPage = 1;
let currentLevel = '';
let currentQuery = '';

/* ── Level palette ───────────────────────────────────────────── */
const COLORS = {
  ERROR:    '#f85149',
  WARNING:  '#e3b341',
  CRITICAL: '#ff7b72',
  INFO:     '#4f8ef7',
  DEBUG:    '#bc8cff',
};

/* ── Charts ──────────────────────────────────────────────────── */
function initCharts(stats) {
  const levels = Object.keys(stats.levels);
  const values = Object.values(stats.levels);
  const colors = levels.map(l => COLORS[l] || '#484f58');

  Chart.defaults.color = '#8b949e';
  Chart.defaults.borderColor = '#30363d';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

  // Doughnut
  new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels: levels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 1.5,
        hoverOffset: 5,
      }],
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, font: { size: 12 }, boxWidth: 11 },
        },
      },
    },
  });

  // Bar
  new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: levels,
      datasets: [{
        label: 'Count',
        data: values,
        backgroundColor: colors.map(c => c + '55'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(48,54,61,0.8)' } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(48,54,61,0.8)' } },
      },
    },
  });
}

/* ── Helpers ─────────────────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function badge(level) {
  const cls = { ERROR:'err', WARNING:'warn', CRITICAL:'crit', INFO:'info', DEBUG:'dbg' }[level] || 'unk';
  return `<span class="badge b-${cls}">${level}</span>`;
}

/* ── Table ───────────────────────────────────────────────────── */
function renderTable(entries) {
  const tbody = document.getElementById('logBody');
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-state">No entries match your filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = entries.map(e => `
    <tr>
      <td class="td-line">${e.lineno}</td>
      <td class="td-time">${esc(e.timestamp)}</td>
      <td>${badge(e.level)}</td>
      <td class="td-msg">${esc(e.message)}</td>
    </tr>`).join('');
}

/* ── Pagination ──────────────────────────────────────────────── */
function renderPagination(total, page) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const container = document.getElementById('pagination');
  const info = document.getElementById('pageInfo');

  const start = (page - 1) * PER_PAGE + 1;
  const end   = Math.min(page * PER_PAGE, total);
  info.textContent = `${start}–${end} of ${total} entries`;

  if (pages <= 1) { container.innerHTML = ''; return; }

  const lo = Math.max(1, page - 2);
  const hi = Math.min(pages, page + 2);
  let html = '';

  if (lo > 1) {
    html += `<button data-p="1">1</button>`;
    if (lo > 2) html += `<button disabled>…</button>`;
  }
  for (let p = lo; p <= hi; p++) {
    html += `<button class="${p === page ? 'active' : ''}" data-p="${p}">${p}</button>`;
  }
  if (hi < pages) {
    if (hi < pages - 1) html += `<button disabled>…</button>`;
    html += `<button data-p="${pages}">${pages}</button>`;
  }

  container.innerHTML = html;
  container.querySelectorAll('button[data-p]').forEach(btn =>
    btn.addEventListener('click', () => loadEntries(Number(btn.dataset.p)))
  );
}

/* ── Active filter tags ──────────────────────────────────────── */
function updateFilterTags() {
  const box = document.getElementById('activeFilters');
  const tags = [];
  if (currentQuery) tags.push(`Query: <strong>${esc(currentQuery)}</strong>`);
  if (currentLevel) tags.push(`Level: <strong>${currentLevel}</strong>`);

  if (!tags.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = tags.map((t, i) => `
    <span class="filter-tag">${t}
      <button data-i="${i}" title="Remove filter">✕</button>
    </span>`).join('');

  box.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.i === '0' && currentQuery) {
        currentQuery = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearch').classList.add('hidden');
      } else {
        currentLevel = '';
        document.getElementById('levelFilter').value = '';
      }
      updateFilterTags();
      loadEntries(1);
    });
  });
}

/* ── Fetch ───────────────────────────────────────────────────── */
function loadEntries(page) {
  currentPage = page;
  document.getElementById('logBody').innerHTML =
    `<tr><td colspan="4" class="table-state"><div class="spinner-wrap"><div class="spinner"></div><span>Loading…</span></div></td></tr>`;

  const params = new URLSearchParams({ page, per_page: PER_PAGE, level: currentLevel, q: currentQuery });

  fetch('/api/entries?' + params)
    .then(r => r.json())
    .then(data => {
      // Update count pill
      const pill = document.getElementById('entriesCount');
      pill.textContent = `${data.total} entries`;
      pill.classList.remove('hidden');

      renderTable(data.entries);
      renderPagination(data.total, page);
    });
}

/* ── Search / filter controls ────────────────────────────────── */
const searchInput = document.getElementById('searchInput');
const clearBtn    = document.getElementById('clearSearch');
const levelFilter = document.getElementById('levelFilter');

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.classList.add('hidden');
  currentQuery = '';
  updateFilterTags();
  loadEntries(1);
});
document.getElementById('searchBtn').addEventListener('click', () => {
  currentQuery = searchInput.value.trim();
  currentLevel = levelFilter.value;
  updateFilterTags();
  loadEntries(1);
});
levelFilter.addEventListener('change', () => {
  currentLevel = levelFilter.value;
  updateFilterTags();
  loadEntries(1);
});

/* ── Export ──────────────────────────────────────────────────── */
function exportUrl(fmt) {
  return `/export?fmt=${fmt}&level=${encodeURIComponent(currentLevel)}&q=${encodeURIComponent(currentQuery)}`;
}
document.getElementById('exportCsv').addEventListener('click',  () => window.location = exportUrl('csv'));
document.getElementById('exportJson').addEventListener('click', () => window.location = exportUrl('json'));

/* ── Init ────────────────────────────────────────────────────── */
initCharts(STATS);
loadEntries(1);
