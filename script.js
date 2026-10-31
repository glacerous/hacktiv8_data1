/* ====================================================================
   Kopi Kenangan Senja – VoC Analytics Dashboard · script.js
   Vanilla JS – no external frameworks, no console errors
   ==================================================================== */

"use strict";

/* ── State ─────────────────────────────────────────────────────────── */
let allReviews = [];   // master data
let charts = {};       // chart instances
let nextId = 100;      // id counter for user-added reviews

/* ── Sentiment Engine ───────────────────────────────────────────────
   Keyword-based NLP proxy. Returns { sentimen, kategori, rekomendasi }
   ─────────────────────────────────────────────────────────────────── */
const SENTIMENT_RULES = {
  positif: [
    'enak','lezat','nikmat','mantap','suka','suka banget','bagus','baik','ramah',
    'cepat','sigap','profesional','sempurna','terbaik','puas','puas banget',
    'worth it','keren','nyaman','fresh','creamy','harum','wangi','top','istimewa',
    'juara','recommended','rekomendasi','love','senang','senang banget','setia',
    'langganan','balik lagi','konsisten','responsif','antusias','merespons dengan baik'
  ],
  negatif: [
    'lambat','lama','lelet','kecewa','buruk','jelek','tidak enak','tidak baik',
    'mahal','mahal banget','tidak sepadan','komplain','basi','keras','berat',
    'keras','salah','error','tidak sigap','tidak ramah','mengecewakan','terrible',
    'over-extracted','tidak fresh','terlalu manis','terlalu pekat','over','antrean',
    'setengah jam','30 menit','25 menit','20 menit','tidak disapa','tidak tertib'
  ]
};

const ASPECT_RULES = [
  { kategori: 'Rasa Kopi',           keywords: ['enak','lezat','rasa','aroma','creamy','manis','pekat','floral','gayo','pahit','segar','kopi','fresh','basi','keras','over-extracted','croissant','pastry'] },
  { kategori: 'Pelayanan Barista',   keywords: ['barista','pelayanan','ramah','sigap','senyum','profesional','salah','lambat respon','disapa','antusias','tidak sigap','komplain','merespons','sopan','kasir'] },
  { kategori: 'Kecepatan Penyajian', keywords: ['lama','lambat','cepat','menit','tunggu','antrean','antri','antrian','setengah jam','efisien','sigap','proses'] },
  { kategori: 'Harga & Suasana',     keywords: ['harga','mahal','murah','worth it','sepadan','estetik','suasana','tempat','nyaman','bersih','parkir','foto','ambiance','kafe','cafe'] }
];

const RECOMMENDATIONS = {
  'Rasa Kopi': {
    'Positif':  'Pertahankan konsistensi resep dan kualitas bahan baku.',
    'Netral':   'Eksplorasi resep signature untuk meningkatkan keunikan rasa.',
    'Negatif':  'Evaluasi standar resep, cek kesegaran bahan, dan latih barista dalam teknik brewing.'
  },
  'Pelayanan Barista': {
    'Positif':  'Dokumentasikan SOP pelayanan ini sebagai standar benchmark.',
    'Netral':   'Tingkatkan training soft skill dan awareness barista terhadap pelanggan.',
    'Negatif':  'Lakukan evaluasi performa barista dan terapkan training ulang service excellence.'
  },
  'Kecepatan Penyajian': {
    'Positif':  'Jadikan waktu penyajian ini sebagai standar SOP semua shift.',
    'Netral':   'Optimalkan alur kerja dapur dan bar untuk mengurangi idle time.',
    'Negatif':  'Implementasikan sistem antrian digital dan tambah tenaga pada jam sibuk.'
  },
  'Harga & Suasana': {
    'Positif':  'Manfaatkan estetika kafe untuk konten marketing media sosial.',
    'Netral':   'Tambahkan value proposition yang lebih kuat melalui program loyalitas.',
    'Negatif':  'Tinjau strategi harga dan perkuat benefit yang dirasakan pelanggan.'
  }
};

/**
 * Classify a review text into sentimen + kategori.
 * @param {string} text - review text (lowercase-safe)
 * @param {number} rating - 1–5
 */
function classifyReview(text, rating) {
  const lower = text.toLowerCase();

  // --- sentimen ---
  let posScore = 0;
  let negScore = 0;
  SENTIMENT_RULES.positif.forEach(kw => { if (lower.includes(kw)) posScore++; });
  SENTIMENT_RULES.negatif.forEach(kw => { if (lower.includes(kw)) negScore++; });

  // Rating bias: adjust scores
  if (rating >= 4) posScore += 2;
  if (rating <= 2) negScore += 2;
  if (rating === 3) { /* neutral nudge – no change */ }

  let sentimen;
  if (posScore > negScore + 1)      sentimen = 'Positif';
  else if (negScore > posScore + 1)  sentimen = 'Negatif';
  else                               sentimen = 'Netral';

  // Override for extreme ratings
  if (rating === 5 && negScore === 0) sentimen = 'Positif';
  if (rating === 1)                   sentimen = 'Negatif';

  // --- kategori: pick highest-matched aspect ---
  let topKat = 'Rasa Kopi';
  let topCount = 0;
  ASPECT_RULES.forEach(rule => {
    let count = 0;
    rule.keywords.forEach(kw => { if (lower.includes(kw)) count++; });
    if (count > topCount) { topCount = count; topKat = rule.kategori; }
  });

  const rekomendasi = RECOMMENDATIONS[topKat][sentimen];
  return { sentimen, kategori: topKat, rekomendasi };
}

/* ── Chart helpers ──────────────────────────────────────────────────── */
Chart.defaults.color = '#a07850';
Chart.defaults.font.family = '-apple-system,"Segoe UI",system-ui,sans-serif';

function buildDonutChart(data) {
  const ctx = document.getElementById('donutChart').getContext('2d');
  const { positif, netral, negatif } = data;
  if (charts.donut) charts.donut.destroy();
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positif', 'Netral', 'Negatif'],
      datasets: [{
        data: [positif, netral, negatif],
        backgroundColor: ['rgba(74,222,128,0.85)','rgba(253,224,71,0.85)','rgba(248,113,113,0.85)'],
        borderColor:     ['#22c55e','#eab308','#ef4444'],
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#d9a86c', font: { size: 12, weight: '600' }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
              const pct = total ? ((ctx.parsed / total)*100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} ulasan (${pct}%)`;
            }
          }
        }
      },
      cutout: '62%'
    }
  });
}

function buildBarChart(data) {
  const ctx = document.getElementById('barChart').getContext('2d');
  const labels = Object.keys(data);
  const values = Object.values(data);
  if (charts.bar) charts.bar.destroy();
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Masalah',
        data: values,
        backgroundColor: [
          'rgba(251,191,36,0.75)',
          'rgba(96,165,250,0.75)',
          'rgba(167,139,250,0.75)',
          'rgba(52,211,153,0.75)'
        ],
        borderColor: ['#f59e0b','#3b82f6','#8b5cf6','#10b981'],
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x} ulasan`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#a07850', stepSize: 1 },
          grid:  { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: { color: '#d9a86c', font: { weight: '600' } },
          grid:  { display: false }
        }
      }
    }
  });
}

/* ── KPI updater ────────────────────────────────────────────────────── */
function animateCount(el, target, suffix = '') {
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  const update = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(start + (target - start) * progress);
    el.textContent = value + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function updateKPIs(reviews) {
  const total    = reviews.length;
  const positif  = reviews.filter(r => r.sentimen === 'Positif').length;
  const negatif  = reviews.filter(r => r.sentimen === 'Negatif').length;
  const nss      = total ? Math.round(((positif - negatif) / total) * 100) : 0;
  const satPct   = total ? Math.round((positif / total) * 100) : 0;
  const negPct   = total ? Math.round((negatif / total) * 100) : 0;

  animateCount(document.getElementById('kpiTotal'),        total,   '');
  animateCount(document.getElementById('kpiSatisfaction'), satPct,  '%');
  animateCount(document.getElementById('kpiComplain'),     negPct,  '%');
  animateCount(document.getElementById('kpiNSS'),          nss,     '');
}

/* ── Chart data extractor ───────────────────────────────────────────── */
function extractChartData(reviews) {
  const sentimen = { positif: 0, netral: 0, negatif: 0 };
  const kategori = {
    'Rasa Kopi': 0, 'Pelayanan Barista': 0,
    'Kecepatan Penyajian': 0, 'Harga & Suasana': 0
  };
  reviews.forEach(r => {
    if (r.sentimen === 'Positif') sentimen.positif++;
    else if (r.sentimen === 'Netral') sentimen.netral++;
    else sentimen.negatif++;
    if (kategori[r.kategori] !== undefined) kategori[r.kategori]++;
  });
  return { sentimen, kategori };
}

/* ── Escalation detector ─────────────────────────────────────────────
   Returns true if this review warrants Store Manager escalation.
   ─────────────────────────────────────────────────────────────────── */
const ESCALATION_KEYWORDS = ['basi','asam lambung','jutek','lama banget','kotor'];

function isEskalasi(review) {
  if (review.sentimen !== 'Negatif') return false;
  if (review.rating > 2)            return false;
  // rating 1–2 AND negatif is already sufficient; keywords extend detection
  const lower = (review.ulasan || '').toLowerCase();
  // Either condition met by the rating+sentimen check above, or keyword match
  const hasKeyword = ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
  return true || hasKeyword; // rating<=2 && Negatif always escalates; keep hasKeyword logic for clarity
}

/* ── Alert Banner updater ────────────────────────────────────────────── */
function updateAlertBanner(reviews) {
  const banner     = document.getElementById('alertBanner');
  const bannerText = document.getElementById('alertBannerText');

  // Count all reviews that qualify as critical escalation
  const criticalCount = reviews.filter(r => {
    const lower  = (r.ulasan || '').toLowerCase();
    const hasKw  = ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
    return (r.rating <= 2 && r.sentimen === 'Negatif') || (r.sentimen === 'Negatif' && hasKw);
  }).length;

  if (criticalCount > 0) {
    bannerText.textContent =
      `⚠️ Perhatian: Terdapat ${criticalCount} komplain pelanggan mendesak yang memerlukan tindakan langsung dari Store Manager!`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ── CSV Export ─────────────────────────────────────────────────────── */
function exportCsv() {
  if (!allReviews.length) {
    alert('Tidak ada data untuk diekspor. Muat data terlebih dahulu.');
    return;
  }

  const headers = ['ID','Tanggal','Nama','Menu','Rating','Ulasan','Sentimen','Kategori','Eskalasi','Rekomendasi'];

  const csvEscField = val => {
    const str = String(val == null ? '' : val);
    // Wrap in quotes if contains comma, quote, or newline
    if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };

  const rows = allReviews.map(r => [
    r.id,
    r.tanggal,
    r.nama,
    r.menu,
    r.rating,
    r.ulasan,
    r.sentimen,
    r.kategori,
    isEskalasi(r) ? 'YA' : 'TIDAK',
    r.rekomendasi
  ].map(csvEscField).join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'laporan_sentimen_kopi.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Table renderer ─────────────────────────────────────────────────── */
const BADGE_CLASS = { Positif:'badge-positif', Netral:'badge-netral', Negatif:'badge-negatif' };

function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function renderTable(reviews) {
  const tbody = document.getElementById('reviewTableBody');
  const count = document.getElementById('tableCount');

  if (!reviews.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-coffee-400" style="color:#6b3a0f;">Tidak ada data sesuai filter.</td></tr>`;
    count.textContent = '';
    return;
  }

  tbody.innerHTML = reviews.map((r, i) => {
    const eskalasi   = isEskalasi(r);
    const sentimenCell = eskalasi
      ? `<span class="badge ${BADGE_CLASS[r.sentimen] || ''}">${r.sentimen}</span>
         <br><span class="badge-eskalasi mt-1">ESKALASI STORE MANAGER</span>`
      : `<span class="badge ${BADGE_CLASS[r.sentimen] || ''}">${r.sentimen}</span>`;

    const rowStyle = eskalasi
      ? 'style="background:rgba(239,68,68,0.04);animation-delay:' + (i * 30) + 'ms"'
      : 'style="animation-delay:' + (i * 30) + 'ms"';

    return `
    <tr class="row-enter" ${rowStyle}>
      <td>${formatDate(r.tanggal)}</td>
      <td class="font-semibold">${esc(r.nama)}</td>
      <td>${esc(r.menu)}</td>
      <td class="text-amber-400 font-bold tracking-widest text-base" title="${r.rating} bintang">${renderStars(r.rating)}</td>
      <td>${esc(r.ulasan)}</td>
      <td class="text-center">${sentimenCell}</td>
      <td><span class="aspect-tag">${esc(r.kategori)}</span></td>
      <td class="text-xs" style="color:#c4a07a;">${esc(r.rekomendasi)}</td>
    </tr>`;
  }).join('');

  count.textContent = `Menampilkan ${reviews.length} ulasan`;
}

/* ── Date formatter ─────────────────────────────────────────────────── */
function formatDate(str) {
  if (!str) return '-';
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return str; }
}

/* ── HTML escape ────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ── Master refresh ─────────────────────────────────────────────────── */
function refreshDashboard() {
  const fSentimen = document.getElementById('filterSentimen').value;
  const fKategori = document.getElementById('filterKategori').value;

  let filtered = allReviews;
  if (fSentimen) filtered = filtered.filter(r => r.sentimen === fSentimen);
  if (fKategori) filtered = filtered.filter(r => r.kategori === fKategori);

  updateKPIs(allReviews);                                         // KPIs on full dataset
  const { sentimen, kategori } = extractChartData(allReviews);   // charts on full dataset
  buildDonutChart(sentimen);
  buildBarChart(kategori);
  renderTable(filtered);
  updateAlertBanner(allReviews);                                  // escalation check
}

/* ── Star rating widget ─────────────────────────────────────────────── */
function buildStarRating() {
  const container = document.getElementById('starRating');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star-btn';
    btn.dataset.value = i;
    btn.textContent = '★';
    btn.setAttribute('aria-label', `${i} bintang`);
    btn.addEventListener('click', () => setRating(i));
    btn.addEventListener('mouseenter', () => highlightStars(i));
    btn.addEventListener('mouseleave', () => highlightStars(getCurrentRating()));
    container.appendChild(btn);
  }
}

function getCurrentRating() {
  return parseInt(document.getElementById('inputRating').value) || 0;
}

function setRating(val) {
  document.getElementById('inputRating').value = val;
  const labels = ['','Sangat Buruk','Buruk','Cukup','Baik','Sangat Baik'];
  document.getElementById('ratingLabel').textContent = `${val} – ${labels[val]}`;
  highlightStars(val);
}

function highlightStars(val) {
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.value) <= val);
  });
}

/* ── Form submission ────────────────────────────────────────────────── */
function handleFormSubmit(e) {
  e.preventDefault();
  const err = document.getElementById('formError');
  err.classList.add('hidden');

  const nama   = document.getElementById('inputNama').value.trim();
  const menu   = document.getElementById('inputMenu').value;
  const ulasan = document.getElementById('inputUlasan').value.trim();
  const rating = getCurrentRating();

  // Validation
  const errors = [];
  if (!nama)   errors.push('Nama pelanggan wajib diisi.');
  if (!menu)   errors.push('Pilih menu terlebih dahulu.');
  if (!ulasan) errors.push('Teks ulasan wajib diisi.');
  if (!rating) errors.push('Pilih rating bintang (1–5).');

  if (errors.length) {
    err.textContent = errors.join(' ');
    err.classList.remove('hidden');
    return;
  }

  const { sentimen, kategori, rekomendasi } = classifyReview(ulasan, rating);

  const today = new Date();
  const tanggal = today.toISOString().split('T')[0];

  const newReview = { id: nextId++, tanggal, nama, menu, ulasan, rating, sentimen, kategori, rekomendasi };
  allReviews.unshift(newReview); // Add to front

  // Reset form
  document.getElementById('reviewForm').reset();
  document.getElementById('inputRating').value = '0';
  document.getElementById('ratingLabel').textContent = 'Belum dipilih';
  highlightStars(0);
  document.getElementById('filterSentimen').value = '';
  document.getElementById('filterKategori').value = '';

  refreshDashboard();

  // Flash new row feedback
  const firstRow = document.querySelector('#reviewTableBody tr');
  if (firstRow) {
    firstRow.style.outline = '2px solid #d98825';
    setTimeout(() => { firstRow.style.outline = ''; }, 1800);
  }
}

/* ── Load default data (fetch JSON) ────────────────────────────────── */
async function loadDefaultData() {
  try {
    const response = await fetch('feedback_data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Validate & normalise
    allReviews = data.map(item => ({
      id:          item.id          || nextId++,
      tanggal:     item.tanggal     || new Date().toISOString().split('T')[0],
      nama:        item.nama        || 'Anonim',
      menu:        item.menu        || '-',
      ulasan:      item.ulasan      || '',
      rating:      Number(item.rating) || 3,
      sentimen:    item.sentimen    || 'Netral',
      kategori:    item.kategori    || 'Rasa Kopi',
      rekomendasi: item.rekomendasi || ''
    }));

    nextId = Math.max(...allReviews.map(r => r.id), 99) + 1;
    document.getElementById('filterSentimen').value = '';
    document.getElementById('filterKategori').value = '';
    refreshDashboard();
  } catch (err) {
    console.error('Gagal memuat feedback_data.json:', err);
    alert('Gagal memuat data default. Pastikan file feedback_data.json tersedia di direktori yang sama.');
  }
}

/* ── Filter change handlers ─────────────────────────────────────────── */
function attachFilterListeners() {
  document.getElementById('filterSentimen').addEventListener('change', refreshDashboard);
  document.getElementById('filterKategori').addEventListener('change', refreshDashboard);
}

/* ── Init ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildStarRating();
  attachFilterListeners();
  document.getElementById('reviewForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('btnLoadDefault').addEventListener('click', loadDefaultData);
  document.getElementById('btnExportCsv').addEventListener('click', exportCsv);
  document.getElementById('btnDismissAlert').addEventListener('click', () => {
    document.getElementById('alertBanner').classList.add('hidden');
  });

  // Render empty state charts on load
  buildDonutChart({ positif: 0, netral: 0, negatif: 0 });
  buildBarChart({ 'Rasa Kopi': 0, 'Pelayanan Barista': 0, 'Kecepatan Penyajian': 0, 'Harga & Suasana': 0 });
});
