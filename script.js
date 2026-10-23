/* ============================================================
   MoneyTrack v2 — script.js
   Clean rewrite. 100% offline. No error.
   ============================================================ */
(function () {
'use strict';

/* ============================================================
   BAGIAN 1 — KONSTANTA
   ============================================================ */

var STORAGE_KEY = 'moneytrack_v1';       // tetap sama biar data lama kebaca
var STATE_VERSION = 2;
var SNAPSHOT_DATE = '2026-10-11';

var DEFAULT_ACCOUNTS = [
  { id: 'cash',      name: 'Uang Tunai', icon: '💵', type: 'cash' },
  { id: 'dana',      name: 'DANA',       icon: '💙', type: 'ewallet' },
  { id: 'gopay',     name: 'GoPay',      icon: '💚', type: 'ewallet' },
  { id: 'shopeepay', name: 'ShopeePay',  icon: '🧡', type: 'ewallet' },
  { id: 'ovo',       name: 'OVO',        icon: '💜', type: 'ewallet' },
  { id: 'bni',       name: 'Bank BNI',   icon: '🏦', type: 'bank' }
];

/* Saldo awal — SESUAIKAN kalau perlu reset ulang.
   ATURAN:
   - main = saldo bebas + uang jajan (TOTAL uang likuid)
   - snackCash/snackNonCash = BAGIAN dari main (subset)
   - Total uang = main + emergency + savings + goldFund
*/
var INITIAL_ACCOUNTS = {
  cash: 111000,
  dana: 29818,
  shopeepay: 9165
};

var INITIAL = {
  main: 88983,           // total liquid (saldo bebas + uang jajan)
  emergency: 56000,
  savings: 0,
  goldFund: 5000,
  snackCash: 0,
  snackNonCash: 35000,
  dailyBudget: 17000
};

var RECON = {
  reported: 149983,
  identified: 149983,
  diff: 0
};

var DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

var EXPENSE_CATEGORIES = [
  'Makanan','Minuman','Transportasi','Kebutuhan Sekolah','Kesehatan',
  'Hiburan','Gym / Olahraga','Kuota / Pulsa','Tagihan','Tabungan','Bayar Utang','Lainnya'
];

var INCOME_CATEGORIES = [
  'Uang Jajan','Beasiswa','Hadiah','Kerja Sampingan','Penjualan','Pinjaman Masuk','Transfer Masuk','Lainnya'
];

var INCOME_SOURCES = [
  'Orang Tua','Keluarga','Sekolah','Beasiswa','Kerja Sampingan','Hadiah','Lainnya'
];

var CAT_ICON = {
  'Makanan':'🍚','Minuman':'🥤','Transportasi':'🚌','Kebutuhan Sekolah':'📚',
  'Kesehatan':'💊','Hiburan':'🎮','Gym / Olahraga':'🏋️','Tabungan':'🎯',
  'Bayar Utang':'💳','Lainnya':'📦',
  'Uang Jajan':'💵','Beasiswa':'🎓','Hadiah':'🎁','Kerja Sampingan':'💼',
  'Penjualan':'🏷️','Pinjaman Masuk':'🤝','Transfer Masuk':'🔄'
};

var PAGES = [
  { id:'dashboard',  label:'Dashboard',        icon:'🏠' },
  { id:'income',     label:'Pemasukan',        icon:'💵' },
  { id:'expense',    label:'Pengeluaran',      icon:'💸' },
  { id:'prediction', label:'Prediksi',         icon:'🔮' },
  { id:'emergency',  label:'Dana Darurat',     icon:'🛡️' },
  { id:'savings',    label:'Tabungan Umum',    icon:'🎯' },
  { id:'gold',       label:'Tabungan Emas',    icon:'🪙' },
  { id:'snack',      label:'Sisa Uang Jajan',  icon:'🍜' },
  { id:'titipan',    label:'Uang Titipan',     icon:'📦' },
  { id:'debts',      label:'Utang & Piutang',  icon:'🤝' },
  { id:'ai',         label:'Analisis Keuangan',icon:'🤖' },
  { id:'patterns',   label:'Deteksi Pola',     icon:'🔍' },
  { id:'weekinsight',label:'Insight Mingguan', icon:'📖' },
  { id:'weeklytarget', label:'Target Mingguan',icon:'🎯' },
  { id:'history',    label:'Riwayat Transaksi',icon:'🕘' },
  { id:'calendar',   label:'Kalender',         icon:'📅' },
  { id:'stats',      label:'Statistik',        icon:'📊' },
  { id:'settings',   label:'Pengaturan',       icon:'⚙️' }
];

var BOTTOM_NAV = [
  { id:'dashboard', label:'Beranda', icon:'🏠' },
  { id:'income',    label:'Masuk',   icon:'💵' },
  { id:'expense',   label:'Keluar',  icon:'💸' },
  { id:'history',   label:'Riwayat', icon:'🕘' },
  { id:'menu',      label:'Menu',    icon:'☰' }
];

/* ============================================================
   BAGIAN 2 — UTILITAS
   ============================================================ */

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function uid() {
  return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var _nfIDR = null;
try {
  _nfIDR = new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  });
} catch (e) { _nfIDR = null; }

function rupiah(n) {
  n = Math.round(Number(n) || 0);
  if (_nfIDR) { try { return _nfIDR.format(n); } catch (e) {} }
  var s = String(Math.abs(n)), out = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s[i] + out; c++;
    if (c % 3 === 0 && i > 0) out = '.' + out;
  }
  return (n < 0 ? '-Rp' : 'Rp') + out;
}

function angka(n) {
  n = Math.round(Number(n) || 0);
  var s = String(Math.abs(n)), out = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s[i] + out; c++;
    if (c % 3 === 0 && i > 0) out = '.' + out;
  }
  return (n < 0 ? '-' : '') + out;
}

function jktParts(d) {
  d = d || new Date();
  try {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    var p = {};
    fmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    if (p.hour === '24') p.hour = '00';
    return p;
  } catch (e) {
    return {
      year: String(d.getFullYear()), month: pad2(d.getMonth() + 1), day: pad2(d.getDate()),
      hour: pad2(d.getHours()), minute: pad2(d.getMinutes()), second: pad2(d.getSeconds())
    };
  }
}

function todayISO() { var p = jktParts(); return p.year + '-' + p.month + '-' + p.day; }
function nowTime()  { var p = jktParts(); return p.hour + ':' + p.minute; }
function nowStamp() { var p = jktParts(); return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second; }

var HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function parseISO(iso) {
  if (!iso) return new Date();
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function isoOf(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function fmtTanggal(iso) {
  if (!iso) return '-';
  var d = parseISO(iso);
  return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
}
function fmtTanggalPendek(iso) {
  if (!iso) return '-';
  var d = parseISO(iso);
  return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}
function isWeekend(iso) { var g = parseISO(iso).getDay(); return g === 0 || g === 6; }
function isSchoolDay(iso) { return !isWeekend(iso); }

function weekRange(iso) {
  var d = parseISO(iso);
  var day = d.getDay();
  var diffToMon = (day === 0) ? -6 : (1 - day);
  var start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
  var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return [isoOf(start), isoOf(end)];
}
function monthKey(iso) { return String(iso).slice(0, 7); }

function dailyBudgetFor(iso) {
  var g = parseISO(iso).getDay();
  if (g === 6) return Number(state.settings.saturdayBudget) || 0;
  if (g === 0) return Number(state.settings.sundayBudget) || 0;
  return Number(state.settings.dailyBudget) || 0;
}

function toast(msg, type) {
  if (type === 'err') mtPlay('error');
  else if (type === 'warn') mtPlay('warn');
  else mtPlay('notify');

  var root = $('#toastRoot');
  if (!root) return;
  var t = document.createElement('div');
  t.className = 'toast ' + (type || 'ok');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(function () {
    t.style.transition = 'opacity .25s, transform .25s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
  }, 3000);
}

function barChart(data, height) {
  height = height || 150;
  if (!data || !data.length) return '<div class="empty"><span class="ic">📊</span><div class="s">Belum ada data</div></div>';
  var w = 340, h = height, padL = 8, padR = 8, padB = 26, padT = 10;
  var max = 1;
  data.forEach(function (d) { if (d.value > max) max = d.value; });
  var n = data.length;
  var bw = (w - padL - padR) / n;
  var out = '';
  data.forEach(function (d, i) {
    var bh = Math.max(2, (h - padT - padB) * (d.value / max));
    var x = padL + i * bw + bw * 0.16;
    var y = h - padB - bh;
    var bwid = bw * 0.68;
    out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bwid.toFixed(1) +
           '" height="' + bh.toFixed(1) + '" rx="4" fill="' + d.color + '" opacity="0.9"/>';
    out += '<text x="' + (x + bwid / 2).toFixed(1) + '" y="' + (h - padB + 15) +
           '" font-size="9.5" fill="#9BA8BD" text-anchor="middle">' + esc(d.label) + '</text>';
  });
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="chart">' + out + '</svg>';
}

function download(filename, content, mime) {
  try {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1500);
    return true;
  } catch (e) { return false; }
}

/* ============================================================
   BAGIAN 3 — STATE & PENYIMPANAN
   ============================================================ */

function defaultState() {
  return {
    version: STATE_VERSION,
    createdAt: nowStamp(),
    transactions: [],
    accounts: JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS)),
    predictions: [],
    titipan: [],
    debts: [],
    reconciliation: {
      resolved: true,
      category: 'other',
      note: 'Data awal sesuai.',
      resolvedAt: null
    },
    /* ── BARU: data awal disimpan di state ── */
    initial: {
      main: INITIAL.main,
      emergency: INITIAL.emergency,
      savings: INITIAL.savings,
      goldFund: INITIAL.goldFund,
      snackCash: INITIAL.snackCash,
      snackNonCash: INITIAL.snackNonCash
    },
    initialAccounts: JSON.parse(JSON.stringify(INITIAL_ACCOUNTS)),
    /* ─────────────────────────────────── */
    emergency: { target: 300000 },
    savings: { target: 200000, deadline: '' },
    gold: { pricePerGram: 0, priceUpdatedAt: null, priceSource: 'manual' },
    weeklyTarget: { default: 85000, overrides: {} },
    settings: {
      theme: 'dark',
      dailyBudget: INITIAL.dailyBudget,
      saturdayBudget: INITIAL.dailyBudget,
      sundayBudget: INITIAL.dailyBudget,
      reminder: true,
      audio: { clickEnabled: true, musicEnabled: false, volume: 0.5 }
    },
    ui: { page: 'dashboard' }
  };
}

var state = defaultState();
var storageOK = true;

function storageAvailable() {
  try {
    var k = '__mt_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
}

function saveState() {
  _txRev++;
  if (!storageOK) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    storageOK = false;
    var w = $('#storageWarn');
    if (w) w.classList.remove('hidden');
    toast('Gagal menyimpan data. Penyimpanan penuh atau diblokir.', 'err');
    return false;
  }
}

function loadState() {
  storageOK = storageAvailable();
  if (!storageOK) {
    var w = $('#storageWarn');
    if (w) w.classList.remove('hidden');
    toast('Penyimpanan tidak tersedia. Data hanya selama sesi ini.', 'warn');
    return;
  }
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) { saveState(); return; }
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    state = mergeState(defaultState(), parsed);

    // Pastikan field wajib ada
    if (!Array.isArray(state.transactions)) state.transactions = [];
    if (!Array.isArray(state.predictions)) state.predictions = [];
    if (!Array.isArray(state.debts)) state.debts = [];
    if (!Array.isArray(state.titipan)) state.titipan = [];
    if (!state.weeklyTarget) state.weeklyTarget = { default: 85000, overrides: {} };

    // Migrasi transaksi lama: dukung format 'main -> snack_cash' yang lama
    // sudah kompatibel karena kita pakai type 'transfer' juga.
    state.version = STATE_VERSION;
    /* ── Migrasi: pastikan data awal ada di state ── */
if (!state.initial || typeof state.initial !== 'object') {
  state.initial = {
    main: INITIAL.main,
    emergency: INITIAL.emergency,
    savings: INITIAL.savings,
    goldFund: INITIAL.goldFund,
    snackCash: INITIAL.snackCash,
    snackNonCash: INITIAL.snackNonCash
  };
}
if (!state.initialAccounts || typeof state.initialAccounts !== 'object') {
  state.initialAccounts = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
}
/* ─────────────────────────────────────────── */
  } catch (e) {
    console.error('Gagal memuat data:', e);
    try { if (raw) window.localStorage.setItem(STORAGE_KEY + '_corrupt_' + Date.now(), raw); } catch (e2) {}
    toast('Data tersimpan rusak. Salinan cadangan disimpan, memulai baru.', 'err');
    state = defaultState();
  }
}

function mergeState(base, incoming) {
  var out = base;
  Object.keys(incoming || {}).forEach(function (k) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    var v = incoming[k];
    if (v && typeof v === 'object' && !Array.isArray(v) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = mergeState(base[k], v);
    } else {
      out[k] = v;
    }
  });
  return out;
}

/* ============================================================
   BAGIAN 4 — PERHITUNGAN SALDO
   ============================================================ */

function sortTx(a, b) {
  var ka = a.date + ' ' + (a.time || '00:00');
  var kb = b.date + ' ' + (b.time || '00:00');
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
}
var _txCache = null, _txRev = 0;
function allTx() {
  var n = state.transactions.length;
  if (!_txCache || _txCache.rev !== _txRev || _txCache.n !== n || _txCache.ref !== state.transactions) {
    _txCache = { rev: _txRev, n: n, ref: state.transactions, list: state.transactions.slice().sort(sortTx) };
  }
  return _txCache.list.slice();
}

/**
 * HITUNG SEMUA SALDO DARI SATU SUMBER.
 *
 * Model:
 *   main    = TOTAL uang likuid (saldo bebas + uang jajan)
 *   snack*  = BAGIAN dari main (label saja)
 *   Saldo Bebas = main - snackTotal
 *   Total Uang = main + emergency + savings + goldFund + unidentified
 */
function computeBalances() {
  var init = (state.initial && typeof state.initial === 'object') ? state.initial : INITIAL;
  var b = {
    main: Number(init.main) || 0,
    emergency: Number(init.emergency) || 0,
    savings: Number(init.savings) || 0,
    goldFund: Number(init.goldFund) || 0,
    snackCash: Number(init.snackCash) || 0,
    snackNonCash: Number(init.snackNonCash) || 0,
    goldGrams: 0,
    unidentified: state.reconciliation.resolved ? 0 : RECON.diff,
    totalIncome: 0,
    totalExpense: 0,
    totalTransferIn: 0,
    totalTransferOut: 0
  };

  if (state.reconciliation.resolved) {
    b.main += RECON.diff;
    b.totalIncome += RECON.diff;
  }

  var list = allTx();
  for (var i = 0; i < list.length; i++) {
    var t = list[i];
    var amt = Number(t.amount) || 0;

    if (t.type === 'income') {
      b.main += amt;
      b.totalIncome += amt;
      if (t.isSnackAllowance) {
        if (t.method === 'cash') b.snackCash += amt;
        else b.snackNonCash += amt;
      }

    } else if (t.type === 'expense') {
      b.main -= amt;
      b.totalExpense += amt;
      if (t.useSnack) {
        if (t.method === 'cash') b.snackCash -= amt;
        else b.snackNonCash -= amt;
      }

    } else if (t.type === 'transfer') {
      var from = t.from, to = t.to;
      var snackFrom = (from === 'snack_cash' || from === 'snack_noncash');
      var snackTo   = (to === 'snack_cash' || to === 'snack_noncash');

      if (snackFrom || snackTo) {
        // MAIN ↔ SNACK: main TIDAK berubah. Cuma label snack yang berubah.
        if (from === 'snack_cash')       b.snackCash -= amt;
        else if (from === 'snack_noncash') b.snackNonCash -= amt;
        if (to === 'snack_cash')       b.snackCash += amt;
        else if (to === 'snack_noncash') b.snackNonCash += amt;
      } else {
        // MAIN ↔ BUCKET LAIN (DD/tabungan/eMas): main berubah
        if (from === 'main') { b.main -= amt; b.totalTransferOut += amt; }
        else if (b[from] !== undefined) { b[from] -= amt; }
        if (to === 'main') { b.main += amt; b.totalTransferIn += amt; }
        else if (b[to] !== undefined) { b[to] += amt; }
      }

      // Kompatibilitas: transfer lama dari main dengan useSnack
      if (t.useSnack && from === 'main') {
        if (t.method === 'cash') b.snackCash -= amt;
        else b.snackNonCash -= amt;
      }

    } else if (t.type === 'goldBuy') {
      var feeB = Number(t.fee) || 0;
      b.goldFund -= (amt + feeB);
      b.goldGrams += Number(t.grams) || 0;
    } else if (t.type === 'goldSell') {
      var feeS = Number(t.fee) || 0;
      b.goldGrams -= Number(t.grams) || 0;
      b.goldFund += (amt - feeS);
    }
  }

  // Clamp negatif
  if (b.snackCash < 0) { b.snackNonCash += b.snackCash; b.snackCash = 0; }
  else if (b.snackNonCash < 0) { b.snackCash += b.snackNonCash; b.snackNonCash = 0; }
  if (b.snackCash < 0) b.snackCash = 0;
  if (b.snackNonCash < 0) b.snackNonCash = 0;
  if (b.goldGrams < 0) b.goldGrams = 0;

  b.snackTotal = b.snackCash + b.snackNonCash;
  b.saldoBebas = b.main - b.snackTotal;   // dipakai di dashboard
  b.totalMoney = b.main + b.emergency + b.savings + b.goldFund + b.unidentified;
  b.identifiedNow = b.main + b.emergency + b.savings + b.goldFund;
  b.accounts = computeAccountBalances();

  return b;
}

function computeAccountBalances() {
  var acc = {};
  var initAcc = (state.initialAccounts && typeof state.initialAccounts === 'object')
    ? state.initialAccounts
    : INITIAL_ACCOUNTS;
  getAccounts().forEach(function (a) {
    acc[a.id] = Number(initAcc[a.id]) || 0;
  });

  allTx().forEach(function (t) {
    var amt = Number(t.amount) || 0;
    var a = accountOf(t);
    if (t.type === 'goldBuy' || t.type === 'goldSell') {
      var ga = (t.account && acc[t.account] !== undefined) ? t.account : 'cash';
      if (acc[ga] === undefined) acc[ga] = 0;
      acc[ga] += (t.type === 'goldBuy') ? -(amt + (Number(t.fee) || 0)) : (amt - (Number(t.fee) || 0));
      return;
    }

    if (t.type === 'income') {
      if (acc[a] === undefined) acc[a] = 0;
      acc[a] += amt;

    } else if (t.type === 'expense') {
      if (acc[a] === undefined) acc[a] = 0;
      acc[a] -= amt;

    } else if (t.type === 'transfer') {
      var from = t.from, to = t.to;
      var snackFrom = (from === 'snack_cash' || from === 'snack_noncash');
      var snackTo   = (to === 'snack_cash' || to === 'snack_noncash');

      // Pindah antar main ↔ snack: TIDAK mengubah akun fisik
      if (snackFrom || snackTo) return;

      // MAIN ↔ BUCKET LAIN: akun fisik berubah
      if (from === 'main') {
        var fromAcc = t.fromAccount || t.account;
        if (fromAcc && acc[fromAcc] !== undefined) acc[fromAcc] -= amt;
        
        // FIX: Kalau setor dari main ke tabungan/DD, tambahkan ke saldo akun tujuan (misal Dompet Simpanan)
        if (to !== 'main' && to !== 'snack_cash' && to !== 'snack_noncash') {
          var toAcc = t.toAccount || t.fromAccount; 
          if (toAcc && acc[toAcc] !== undefined) acc[toAcc] += amt;
        }
      }
      if (to === 'main') {
        var toAcc = t.toAccount || t.account;
        if (toAcc && acc[toAcc] !== undefined) acc[toAcc] += amt;

        // FIX: Kalau tarik dari tabungan/DD ke main, kurangi saldo akun asal
        if (from !== 'main' && from !== 'snack_cash' && from !== 'snack_noncash') {
          var fromAccWithdraw = t.fromAccount || t.toAccount;
          if (fromAccWithdraw && acc[fromAccWithdraw] !== undefined) acc[fromAccWithdraw] -= amt;
        }
      }
    }
  });

  return acc;
}

/* ============================================================
   BAGIAN 5 — AGREGASI
   ============================================================ */

function txOnDate(iso) { return allTx().filter(function (t) { return t.date === iso; }); }
function inRange(iso, a, b) { return iso >= a && iso <= b; }

function sumIncomeOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) { if (t.type === 'income') s += Number(t.amount) || 0; });
  return s;
}
var NEED_CATEGORIES = ['Kebutuhan Sekolah', 'Kesehatan', 'Kuota / Pulsa', 'Tagihan', 'Tabungan', 'Bayar Utang'];
function isNeedTx(t) {
  if (t.isNeed === true) return true;
  if (t.isNeed === false) return false;
  return NEED_CATEGORIES.indexOf(t.category) >= 0;
}
function sumBudgetOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) { if (t.type === 'expense' && !isNeedTx(t)) s += Number(t.amount) || 0; });
  return s;
}
function sumNeedOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) { if (t.type === 'expense' && isNeedTx(t)) s += Number(t.amount) || 0; });
  return s;
}
function needNote(iso) {
  var n = sumNeedOn(iso);
  return n > 0 ? '<span class="mt-need">🧾 Kebutuhan ' + rupiah(n) + ' tidak dihitung ke anggaran jajan.</span>' : '';
}
function sumExpenseOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) { if (t.type === 'expense') s += Number(t.amount) || 0; });
  return s;
}
function sumSnackIncomeOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) {
    if (t.type === 'income' && t.isSnackAllowance) s += Number(t.amount) || 0;
  });
  return s;
}
function sumExpenseJajanOn(iso) {
  var s = 0;
  txOnDate(iso).forEach(function (t) {
    if (t.type === 'expense' && t.useSnack) s += Number(t.amount) || 0;
  });
  return s;
}
function sumIncomeRange(a, b) {
  var s = 0;
  allTx().forEach(function (t) { if (t.type === 'income' && inRange(t.date, a, b)) s += Number(t.amount) || 0; });
  return s;
}
function sumExpenseRange(a, b) {
  var s = 0;
  allTx().forEach(function (t) { if (t.type === 'expense' && inRange(t.date, a, b)) s += Number(t.amount) || 0; });
  return s;
}
function sumSnackIncomeRange(a, b) {
  var s = 0;
  allTx().forEach(function (t) {
    if (t.type === 'income' && t.isSnackAllowance && inRange(t.date, a, b)) s += Number(t.amount) || 0;
  });
  return s;
}
function sumSnackExpenseRange(a, b) {
  var s = 0;
  allTx().forEach(function (t) {
    if (t.type === 'expense' && t.useSnack && inRange(t.date, a, b)) s += Number(t.amount) || 0;
  });
  return s;
}

function monthRange(iso) {
  var d = parseISO(iso);
  var first = new Date(d.getFullYear(), d.getMonth(), 1);
  var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [isoOf(first), isoOf(last)];
}

function expensesByCategory(a, b) {
  var map = {};
  allTx().forEach(function (t) {
    if (t.type !== 'expense') return;
    if (a && b && !inRange(t.date, a, b)) return;
    var c = t.category || 'Lainnya';
    map[c] = (map[c] || 0) + (Number(t.amount) || 0);
  });
  return map;
}

/* ============================================================
   BAGIAN 6 — NAVIGASI & RENDER
   ============================================================ */

function currentPage() { return state.ui.page || 'dashboard'; }

function navigate(pageId) {
  if (!pageId) return;
  state.ui.page = pageId;
  saveState();
  closeDrawer();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderNav() {
  var nav = $('#navList');
  if (nav) {
    nav.innerHTML = PAGES.map(function (p) {
      return '<button class="nav-item' + (currentPage() === p.id ? ' active' : '') +
             '" data-nav="' + p.id + '"><span class="ic">' + p.icon + '</span><span>' +
             esc(p.label) + '</span></button>';
    }).join('');
  }

  var bn = $('#bottomNav');
  if (bn) {
    bn.innerHTML = '<div class="bottomnav-inner">' + BOTTOM_NAV.map(function (p) {
      return '<button class="bnav-item' + (currentPage() === p.id ? ' active' : '') +
             '" data-nav="' + p.id + '"><span class="ic">' + p.icon + '</span><span>' +
             esc(p.label) + '</span></button>';
    }).join('') + '</div>';
  }
}

function renderPage() {
  var page = currentPage();
  var meta = PAGES.filter(function (p) { return p.id === page; })[0] || PAGES[0];
  var pt = $('#pageTitle');
  if (pt) pt.textContent = meta.icon + ' ' + meta.label;

  var b = computeBalances();
  var pill = $('#todayPill');
  if (pill) pill.textContent = fmtTanggalPendek(todayISO());

  var html = '';
  switch (page) {
    case 'dashboard':    html = pageDashboard(b); break;
    case 'income':       html = pageIncome(b); break;
    case 'expense':      html = pageExpense(b); break;
    case 'prediction':   html = pagePrediction(b); break;
    case 'emergency':    html = pageEmergency(b); break;
    case 'savings':      html = pageSavings(b); break;
    case 'gold':         html = pageGold(b); break;
    case 'snack':        html = pageSnack(b); break;
    case 'titipan':      html = pageTitipan(b); break;
    case 'debts':        html = pageDebts(b); break;
    case 'ai':           html = pageAI(b); break;
    case 'patterns':     html = pagePatterns(b); break;
    case 'weekinsight':  html = pageWeekInsight(b); break;
    case 'weeklytarget': html = pageWeeklyTarget(b); break;
    case 'history':      html = pageHistory(b); break;
    case 'calendar':     html = pageCalendar(b); break;
    case 'stats':        html = pageStats(b); break;
    case 'settings':     html = pageSettings(b); break;
    default:             html = pageDashboard(b);
  }

  var content = $('#content');
  if (content) content.innerHTML = html;
  renderNav();
  afterRender(page);
}

function afterRender(page) {
  if (page === 'history' || page === 'income' || page === 'expense') attachFilterListeners();
  if (page === 'settings') attachSettingsListeners();
  enhanceAnimations();
  updateThemeButton();
}

/* ============================================================
   BAGIAN 7 — KOMPONEN UI
   ============================================================ */

function statCard(label, value, icon, cls, sub) {
  if (/^-\s?Rp/.test(String(value)) && /val-(emerald|cyan|gold)/.test(cls || '')) cls = 'val-coral';
  return '<div class="stat">' +
    '<div class="lbl"><span>' + icon + '</span><span>' + esc(label) + '</span></div>' +
    '<div class="val ' + (cls || '') + '">' + value + '</div>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') +
    '</div>';
}

function emptyState(icon, title, sub) {
  return '<div class="empty"><span class="ic">' + icon + '</span>' +
    '<div class="t">' + esc(title) + '</div>' +
    '<div class="s">' + esc(sub || '') + '</div></div>';
}

function optionList(arr, selected, placeholder) {
  var out = '<option value="">' + esc(placeholder || '— Pilih —') + '</option>';
  arr.forEach(function (v) {
    out += '<option value="' + esc(v) + '"' + (selected === v ? ' selected' : '') + '>' + esc(v) + '</option>';
  });
  return out;
}

function accountOptions(selected) {
  var out = '';
  getAccounts().forEach(function (a) {
    out += '<option value="' + esc(a.id) + '"' + (selected === a.id ? ' selected' : '') + '>' +
           a.icon + ' ' + esc(a.name) + '</option>';
  });
  return out;
}

function getAccounts() {
  if (!Array.isArray(state.accounts) || state.accounts.length === 0) {
    state.accounts = DEFAULT_ACCOUNTS.slice();
  }
  return state.accounts;
}
function getAccountById(id) {
  var list = getAccounts();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function getAccountName(id) { var a = getAccountById(id); return a ? a.name : id; }
function getAccountIcon(id) { var a = getAccountById(id); return a ? a.icon : '💳'; }

function accountOf(t) {
  if (t.account) return t.account;
  return t.method === 'cash' ? 'cash' : 'dana';
}

function txRow(t) {
  var icon, amtCls, amtSign, title, meta;

  if (t.type === 'income') {
    icon = CAT_ICON[(t.category || 'Lainnya')] || '💵';
    amtCls = 'val-emerald'; amtSign = '+';
    title = t.source ? (t.source + ' • ' + (t.category || 'Lainnya')) : (t.category || 'Lainnya');
    var accIdI = t.account || (t.method === 'cash' ? 'cash' : 'dana');
    meta = fmtTanggalPendek(t.date) + ' ' + (t.time || '') + ' • ' +
           getAccountIcon(accIdI) + ' ' + getAccountName(accIdI);

  } else if (t.type === 'expense') {
    icon = CAT_ICON[(t.category || 'Lainnya')] || '💸';
    amtCls = 'val-coral'; amtSign = '−';
    title = t.description || (t.category || 'Lainnya');
    var accId = t.account || (t.method === 'cash' ? 'cash' : 'dana');
    meta = (t.category || 'Lainnya') + ' • ' + fmtTanggalPendek(t.date) + ' ' + (t.time || '') + ' • ' +
           getAccountIcon(accId) + ' ' + getAccountName(accId);
    if (t.useSnack) meta += ' • 🍜 uang jajan';

  } else if (t.type === 'transfer') {
    icon = '🔄';
    amtCls = 'val-cyan'; amtSign = '';
    var labels = {
      main: 'Saldo Bebas',
      emergency: 'Dana Darurat',
      savings: 'Tabungan Umum',
      goldFund: 'Dana eMas',
      snack_cash: 'Uang Jajan Tunai',
      snack_noncash: 'Uang Jajan Non-Tunai'
    };
    title = (labels[t.from] || t.from) + ' → ' + (labels[t.to] || t.to);
    meta = fmtTanggalPendek(t.date) + ' ' + (t.time || '');
    if (t.note) meta += ' • ' + esc(t.note);

  } else if (t.type === 'goldBuy') {
    icon = '🪙'; amtCls = 'val-gold'; amtSign = '−';
    title = 'Beli emas ' + (Number(t.grams) || 0) + ' gram';
    meta = fmtTanggalPendek(t.date) + ' • ' + rupiah(t.pricePerGram) + '/gram';

  } else if (t.type === 'goldSell') {
    icon = '🪙'; amtCls = 'val-emerald'; amtSign = '+';
    title = 'Jual emas ' + (Number(t.grams) || 0) + ' gram';
    meta = fmtTanggalPendek(t.date) + ' • ' + rupiah(t.pricePerGram) + '/gram';

  } else {
    icon = '📦'; amtCls = ''; amtSign = '';
    title = t.type; meta = t.date;
  }

  var canEdit = !t.debtId && (t.type === 'income' || t.type === 'expense' ||
                 t.type === 'goldBuy' || t.type === 'goldSell');

  return '<div class="tx">' +
    '<div class="tx-ic">' + icon + '</div>' +
    '<div class="tx-main">' +
      '<div class="tx-desc">' + esc(title) + '</div>' +
      '<div class="tx-meta">' + esc(meta) + '</div>' +
    '</div>' +
    '<div class="tx-amt ' + amtCls + '">' + amtSign + rupiah(t.amount) + '</div>' +
    (canEdit ? '<div class="tx-acts">' +
      '<button class="icon-btn" data-act="edit-tx" data-id="' + t.id + '" title="Edit">✏️</button>' +
      '<button class="icon-btn" data-act="del-tx" data-id="' + t.id + '" title="Hapus">🗑️</button>' +
    '</div>' : '') +
  '</div>';
}

/* ============================================================
   BAGIAN 8 — DASHBOARD
   ============================================================ */

function pageDashboardBase(b) {
  var today = todayISO();
  var budget = dailyBudgetFor(today);
  var spentToday = sumBudgetOn(today);
  var remainToday = budget - spentToday;
  var pctToday = budget > 0 ? Math.min(100, (spentToday / budget) * 100) : (spentToday > 0 ? 100 : 0);

  var wk = weekRange(today);
  var mR = monthRange(today);
  var incMonth = sumIncomeRange(mR[0], mR[1]);
  var expMonth = sumExpenseRange(mR[0], mR[1]);
  var incWeek = sumIncomeRange(wk[0], wk[1]);
  var expWeek = sumExpenseRange(wk[0], wk[1]);

  var reconDone = state.reconciliation.resolved;

  var html = '';

  /* ===== Stat utama ===== */
  html += '<div class="grid grid-2" style="margin-bottom:14px">' +
    statCard('Total Uang Saat Ini', rupiah(b.totalMoney), '💰', 'val-emerald',
      reconDone ? 'Semua dana teridentifikasi' : 'Termasuk ' + rupiah(RECON.diff) + ' belum teridentifikasi') +
    statCard('Saldo Bebas Digunakan', rupiah(b.saldoBebas), '✅', 'val-emerald',
      'Di luar uang jajan') +
    statCard('Dana Darurat', rupiah(b.emergency), '🛡️', 'val-cyan', 'Dana terpisah, aman') +
    statCard('Sisa Uang Jajan', rupiah(b.snackTotal), '🍜', 'val-gold',
      'Tunai ' + rupiah(b.snackCash) + ' • Non-tunai ' + rupiah(b.snackNonCash)) +
    statCard('Dana eMas', rupiah(b.goldFund), '🪙', 'val-gold',
      b.goldGrams > 0 ? (b.goldGrams + ' gram emas dimiliki') : 'Belum ada emas') +
    statCard('Tabungan Umum', rupiah(b.savings), '🎯', 'val-emerald', 'Target: ' + rupiah(state.savings.target)) +
    statCard('Pemasukan Bulan Ini', rupiah(incMonth), '💵', 'val-emerald',
      fmtTanggalPendek(mR[0]) + ' – ' + fmtTanggalPendek(mR[1])) +
    statCard('Pengeluaran Bulan Ini', rupiah(expMonth), '💸', 'val-coral',
      'Net: ' + rupiah(incMonth - expMonth)) +
  '</div>';

  /* ===== Batas jajan hari ini ===== */
  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">🍜</span> Batas Jajan Hari Ini ' +
      '<span class="card-sub">' + esc(fmtTanggal(today)) + '</span></div>' +
    '<div class="grid grid-3" style="margin-bottom:12px">' +
      statCard('Batas Anggaran', rupiah(budget), '🎯', 'val-cyan') +
      statCard('Jajan Terpakai', rupiah(spentToday), '💸', 'val-coral') +
      statCard('Sisa Anggaran', rupiah(remainToday), remainToday < 0 ? '⚠️' : '✅',
        remainToday < 0 ? 'val-coral' : 'val-emerald') +
    '</div>' +
    '<div class="progress"><i style="width:' + pctToday.toFixed(1) + '%"></i></div>' +
    '<div class="help">' +
      (remainToday < 0
        ? 'Pengeluaran melebihi batas sebesar ' + rupiah(Math.abs(remainToday)) + '.'
        : 'Sisa anggaran hari ini ' + rupiah(remainToday) + '.') + needNote(today) +
    '</div>' +
  '</div>';

  /* ===== Ringkasan mingguan ===== */
  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📆</span> Minggu Ini ' +
      '<span class="card-sub">' + fmtTanggalPendek(wk[0]) + ' – ' + fmtTanggalPendek(wk[1]) + '</span></div>' +
    '<div class="kv"><span class="k">Pemasukan</span><span class="v val-emerald">' + rupiah(incWeek) + '</span></div>' +
    '<div class="kv"><span class="k">Pengeluaran</span><span class="v val-coral">' + rupiah(expWeek) + '</span></div>' +
    '<div class="kv"><span class="k">Arus kas bersih</span><span class="v ' +
      (incWeek - expWeek >= 0 ? 'val-emerald' : 'val-coral') + '">' + rupiah(incWeek - expWeek) + '</span></div>' +
  '</div>';

  /* ===== Saldo per akun ===== */
  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">💼</span> Saldo Per Akun ' +
      '<span class="card-sub">Total: ' + rupiah(b.main) + '</span></div>';

  var accBals = b.accounts || {};
  getAccounts().forEach(function (a) {
    var bal = accBals[a.id] || 0;
    var isCash = a.id === 'cash';
    html += '<div class="account-card">' +
      '<div class="account-ic">' + a.icon + '</div>' +
      '<div class="account-main">' +
        '<div class="account-name">' + esc(a.name) + '</div>' +
        '<div class="account-sub">' +
          (isCash ? 'Uang fisik' : (a.type === 'bank' ? 'Rekening bank' : 'E-wallet')) +
        '</div>' +
      '</div>' +
      '<div class="account-val ' + (bal < 0 ? 'val-coral' : 'val-emerald') + '">' +
        rupiah(bal) + '</div>' +
    '</div>';
  });

  // Tombol pindah dana
  var mainFreeD = b.saldoBebas;
  html += '<div class="alloc-dual">' +
    (b.snackTotal > 0
      ? '<button data-act="snack-to-main"><span class="em">⬆️</span> Uang Jajan → Saldo Bebas</button>'
      : '<button disabled style="opacity:.4"><span class="em">⬆️</span> Uang Jajan → Saldo Bebas</button>') +
    (mainFreeD > 0
      ? '<button data-act="main-to-snack"><span class="em">⬇️</span> Saldo Bebas → Uang Jajan</button>'
      : '<button disabled style="opacity:.4"><span class="em">⬇️</span> Saldo Bebas → Uang Jajan</button>') +
    '</div>' +
    '<div class="btn-row" style="margin-top:10px">' +
  '<button class="btn btn-sm" data-act="open-cash-breakdown">📋 Pecahan Tunai</button>' +
  '<button class="btn btn-sm" data-act="manage-accounts">⚙️ Kelola Akun</button>' +
  '<button class="btn btn-sm btn-primary" data-act="setup-initial">⚙️ Setup Saldo Awal</button>' +
'</div>';

  html += '</div>';

  /* ===== Banner utang ===== */
  var activeDebts = (state.debts || []).filter(function (d) { return d.status === 'active'; });
  var totalDebt = 0, totalReceivable = 0;
  activeDebts.forEach(function (d) {
    if (d.type === 'owed') totalDebt += (Number(d.amount) || 0) - (Number(d.paid) || 0);
    else totalReceivable += (Number(d.amount) || 0) - (Number(d.paid) || 0);
  });
  if (totalDebt > 0 || totalReceivable > 0) {
    html += '<div class="card" style="border-color:rgba(255,107,120,.4)">' +
      '<div class="card-title"><span class="ic">🤝</span> Utang & Piutang Aktif</div>' +
      (totalDebt > 0
        ? '<div class="kv"><span class="k">Total utang kamu</span><span class="v val-coral">' +
          rupiah(totalDebt) + '</span></div>' : '') +
      (totalReceivable > 0
        ? '<div class="kv"><span class="k">Total piutang kamu</span><span class="v val-emerald">' +
          rupiah(totalReceivable) + '</span></div>' : '') +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-primary btn-sm" data-nav="debts">Lihat Detail</button>' +
      '</div>' +
    '</div>';
  }

  /* ===== Banner target mingguan ===== */
  var wkT = weekRange(today);
  var wtBanner = computeWeeklyTarget(wkT[0], wkT[1]);
  if (wtBanner.status !== 'ok' && wtBanner.target > 0) {
    var wtIcon = wtBanner.status === 'over' ? '🚨' : wtBanner.status === 'danger' ? '⚠️' : '📊';
    var wtTxt = wtBanner.status === 'over' ? 'Melebihi target' :
                wtBanner.status === 'danger' ? 'Hampir habis' : 'Setengah terpakai';
    html += '<div class="card" style="border-color:rgba(232,199,106,.4);background:linear-gradient(135deg,rgba(232,199,106,.08),rgba(255,107,120,.04))">' +
      '<div class="card-title"><span class="ic">' + wtIcon + '</span> Target Mingguan ' +
        '<span class="badge warn">' + wtTxt + '</span></div>' +
      '<div class="kv"><span class="k">Terpakai</span><span class="v val-coral">' + rupiah(wtBanner.spent) + '</span></div>' +
      '<div class="kv"><span class="k">Target</span><span class="v val-cyan">' + rupiah(wtBanner.target) + '</span></div>' +
      '<div class="kv"><span class="k">Sisa</span><span class="v ' +
        (wtBanner.sisa >= 0 ? 'val-emerald' : 'val-coral') + '">' + rupiah(wtBanner.sisa) + '</span></div>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-primary btn-sm" data-nav="weeklytarget">🎯 Lihat Detail</button>' +
      '</div>' +
    '</div>';
  }

  /* ===== Status rekonsiliasi ===== */
  if (!reconDone) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">🧾</span> Status Rekonsiliasi ' +
        '<span class="badge warn">Belum selesai</span></div>' +
      '<div class="help err">Selisih ' + rupiah(RECON.diff) + ' belum masuk saldo bebas.</div>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-primary btn-sm" data-act="open-recon">Selesaikan</button>' +
      '</div>' +
    '</div>';
  }

  /* ===== Pengingat uang jajan ===== */
  if (state.settings.reminder && isSchoolDay(today) && sumSnackIncomeOn(today) === 0) {
    html += '<div class="card" style="border-color:rgba(232,199,106,.4)">' +
      '<div class="card-title"><span class="ic">🔔</span> Pengingat Uang Jajan</div>' +
      '<p style="margin:0;font-size:13px;color:var(--muted)">Hari sekolah tapi uang jajan belum dicatat. ' +
      'Catat hanya kalau <b>benar-benar sudah diterima</b>.</p>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-primary btn-sm" data-act="quick-snack-income">Catat Rp25.000</button>' +
        '<button class="btn btn-sm" data-act="dismiss-reminder">Nanti saja</button>' +
      '</div>' +
    '</div>';
  }

  /* ===== Grafik 7 hari ===== */
  var days = [];
  var base = parseISO(today);
  for (var i = 6; i >= 0; i--) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    days.push({
      label: HARI[d.getDay()].slice(0, 3),
      value: sumExpenseOn(isoOf(d)),
      color: '#FF6B78'
    });
  }
  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📊</span> Pengeluaran 7 Hari Terakhir</div>' +
    barChart(days, 150) +
  '</div>';

  /* ===== Transaksi terakhir ===== */
  var recent = allTx().slice(-5).reverse();
  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">🕘</span> Transaksi Terakhir</div>' +
    (recent.length ? recent.map(txRow).join('')
      : emptyState('📭', 'Belum ada transaksi', 'Mulai catat pemasukan atau pengeluaran.')) +
    '<div class="btn-row" style="margin-top:6px">' +
      '<button class="btn btn-sm btn-primary" data-act="add-income">+ Pemasukan</button>' +
      '<button class="btn btn-sm btn-danger" data-act="add-expense">+ Pengeluaran</button>' +
    '</div>' +
  '</div>';

  return html;
}

function reconLabel(c) {
  if (c === 'cash') return 'Uang Tunai Tambahan';
  if (c === 'bank') return 'Saldo Rekening';
  return 'Kategori Lain';
}

/* ============================================================
   BAGIAN 9 — PEMASUKAN
   ============================================================ */

var filterIncome = { q: '', from: '', to: '', cat: '' };

function pageIncome(b) {
  var list = allTx().filter(function (t) { return t.type === 'income'; }).reverse();
  list = applyFilters(list, filterIncome);

  var total = 0;
  list.forEach(function (t) { total += Number(t.amount) || 0; });

  var today = todayISO();
  var wk = weekRange(today);
  var mR = monthRange(today);

  return '<div class="grid grid-3" style="margin-bottom:14px">' +
    statCard('Hari Ini', rupiah(sumIncomeOn(today)), '💵', 'val-emerald', fmtTanggal(today)) +
    statCard('Minggu Ini', rupiah(sumIncomeRange(wk[0], wk[1])), '📆', 'val-cyan') +
    statCard('Bulan Ini', rupiah(sumIncomeRange(mR[0], mR[1])), '🗓️', 'val-gold') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">⚡</span> Aksi Cepat</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-primary btn-sm" data-act="add-income">+ Tambah</button>' +
      '<button class="btn btn-sm" data-act="quick-snack-income">🍜 Uang Jajan 25rb</button>' +
      '<button class="btn btn-sm" data-act="export-csv">⬇️ CSV</button>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">🔍</span> Filter</div>' +
    '<div class="filters">' +
      '<input type="search" id="fIncomeQ" placeholder="Cari..." value="' + esc(filterIncome.q) + '" />' +
      '<div class="row">' +
        '<input type="date" id="fIncomeFrom" value="' + esc(filterIncome.from) + '" />' +
        '<input type="date" id="fIncomeTo" value="' + esc(filterIncome.to) + '" />' +
      '</div>' +
      '<select id="fIncomeCat">' + optionList(INCOME_CATEGORIES, filterIncome.cat, 'Semua kategori') + '</select>' +
      '<div class="btn-row">' +
        '<button class="btn btn-sm" data-act="reset-income-filter">Reset</button>' +
        '<span class="pill">' + list.length + ' • ' + rupiah(total) + '</span>' +
      '</div>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Riwayat Pemasukan</div>' +
    (list.length ? list.map(txRow).join('')
      : emptyState('📭', 'Belum ada pemasukan', 'Catat uang jajan, beasiswa, atau hadiah.')) +
  '</div>';
}

/* ============================================================
   BAGIAN 10 — PENGELUARAN
   ============================================================ */

var filterExpense = { q: '', from: '', to: '', cat: '' };

function pageExpense(b) {
  var list = allTx().filter(function (t) { return t.type === 'expense'; }).reverse();
  list = applyFilters(list, filterExpense);

  var total = 0;
  list.forEach(function (t) { total += Number(t.amount) || 0; });

  var today = todayISO();
  var budget = dailyBudgetFor(today);
  var spentToday = sumBudgetOn(today);

  return '<div class="grid grid-3" style="margin-bottom:14px">' +
    statCard('Jajan Hari Ini', rupiah(spentToday), '💸', 'val-coral', 'Batas ' + rupiah(budget) + (sumNeedOn(today) > 0 ? ' • +' + rupiah(sumNeedOn(today)) + ' kebutuhan' : '')) +
    statCard('Sisa Anggaran', rupiah(budget - spentToday), '🎯',
      budget - spentToday < 0 ? 'val-coral' : 'val-emerald') +
    statCard('Total Ditampilkan', rupiah(total), '📋', 'val-cyan', list.length + ' item') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">⚡</span> Aksi Cepat</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-danger btn-sm" data-act="add-expense">+ Pengeluaran</button>' +
      '<button class="btn btn-sm" data-act="add-prediction">🔮 Prediksi</button>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">🔍</span> Filter</div>' +
    '<div class="filters">' +
      '<input type="search" id="fExpQ" placeholder="Cari..." value="' + esc(filterExpense.q) + '" />' +
      '<div class="row">' +
        '<input type="date" id="fExpFrom" value="' + esc(filterExpense.from) + '" />' +
        '<input type="date" id="fExpTo" value="' + esc(filterExpense.to) + '" />' +
      '</div>' +
      '<select id="fExpCat">' + optionList(EXPENSE_CATEGORIES, filterExpense.cat, 'Semua kategori') + '</select>' +
      '<div class="btn-row">' +
        '<button class="btn btn-sm" data-act="reset-expense-filter">Reset</button>' +
      '</div>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Riwayat Pengeluaran</div>' +
    (list.length ? list.map(txRow).join('')
      : emptyState('📭', 'Belum ada pengeluaran', 'Catat pengeluaran aktual.')) +
  '</div>';
}

function applyFilters(list, f) {
  return list.filter(function (t) {
    if (f.q) {
      var q = f.q.toLowerCase();
      var hay = ((t.description || '') + ' ' + (t.source || '') + ' ' +
                 (t.category || '') + ' ' + (t.note || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.cat && t.category !== f.cat) return false;
    return true;
  });
}

function attachFilterListeners() {
  var page = currentPage();
  if (page === 'income') {
    var qi = $('#fIncomeQ'), fi = $('#fIncomeFrom'), ti = $('#fIncomeTo'), ci = $('#fIncomeCat');
    function upd() {
      filterIncome.q = qi ? qi.value : '';
      filterIncome.from = fi ? fi.value : '';
      filterIncome.to = ti ? ti.value : '';
      filterIncome.cat = ci ? ci.value : '';
      renderPage();
      var el = $('#fIncomeQ'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    }
    if (qi) qi.addEventListener('input', debounce(upd, 300));
    if (fi) fi.addEventListener('change', upd);
    if (ti) ti.addEventListener('change', upd);
    if (ci) ci.addEventListener('change', upd);
  }
  if (page === 'expense') {
    var qe = $('#fExpQ'), fe = $('#fExpFrom'), te = $('#fExpTo'), ce = $('#fExpCat');
    function updE() {
      filterExpense.q = qe ? qe.value : '';
      filterExpense.from = fe ? fe.value : '';
      filterExpense.to = te ? te.value : '';
      filterExpense.cat = ce ? ce.value : '';
      renderPage();
      var el = $('#fExpQ'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    }
    if (qe) qe.addEventListener('input', debounce(updE, 300));
    if (fe) fe.addEventListener('change', updE);
    if (te) te.addEventListener('change', updE);
    if (ce) ce.addEventListener('change', updE);
  }
}

function debounce(fn, ms) {
  var t = null;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}

/* ============================================================
   BAGIAN 11 — PREDIKSI
   ============================================================ */

function pagePrediction(b) {
  var preds = state.predictions.slice().sort(function (a, c) {
    return (a.date || '') < (c.date || '') ? -1 : 1;
  });

  var planned = preds.filter(function (p) { return p.status === 'planned'; });
  var totalPlanned = planned.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
  var projBalance = b.saldoBebas - totalPlanned;

  var html = '<div class="card">' +
    '<div class="card-title"><span class="ic">🔮</span> Ringkasan</div>' +
    '<div class="grid grid-3">' +
      statCard('Direncanakan', rupiah(totalPlanned), '📝', 'val-gold', planned.length + ' item') +
      statCard('Saldo Bebas', rupiah(b.saldoBebas), '✅', 'val-emerald') +
      statCard('Proyeksi', rupiah(projBalance), projBalance < 0 ? '⚠️' : '📉',
        projBalance < 0 ? 'val-coral' : 'val-cyan') +
    '</div>' +
    (projBalance < 0
      ? '<div class="help err" style="margin-top:10px">⚠ Rencana melebihi saldo bebas.</div>'
      : '<div class="help" style="margin-top:10px">Prediksi <b>tidak</b> mengurangi saldo aktual.</div>') +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="add-prediction">+ Tambah Prediksi</button>' +
    '</div>' +
  '</div>';

  var list = '';
  if (!preds.length) {
    list = emptyState('🔮', 'Belum ada prediksi', 'Rencanakan pengeluaran.');
  } else {
    preds.forEach(function (p) {
      var badge = p.status === 'realized' ? '<span class="badge ok">Realisasi</span>' :
                  p.status === 'cancelled' ? '<span class="badge err">Batal</span>' :
                  '<span class="badge warn">Rencana</span>';
      list += '<div class="tx" style="align-items:flex-start;flex-wrap:wrap">' +
        '<div class="tx-ic">' + (CAT_ICON[p.category] || '🔮') + '</div>' +
        '<div class="tx-main" style="flex:1 1 160px">' +
          '<div class="tx-desc">' + esc(p.description || p.category) + '</div>' +
          '<div class="tx-meta">' + esc(p.category) + ' • ' + fmtTanggalPendek(p.date) + '</div>' +
          '<div class="tagrow">' + badge + '</div>' +
        '</div>' +
        '<div class="tx-amt val-gold">' + rupiah(p.amount) + '</div>' +
        '<div class="tx-acts" style="flex-basis:100%;justify-content:flex-end;margin-top:6px">' +
          (p.status === 'planned'
            ? '<button class="btn btn-sm btn-primary" data-act="realize-pred" data-id="' + p.id + '">Realisasikan</button>' +
              '<button class="btn btn-sm" data-act="edit-pred" data-id="' + p.id + '">✏️</button>' +
              '<button class="btn btn-sm btn-danger" data-act="cancel-pred" data-id="' + p.id + '">Batal</button>'
            : '<button class="btn btn-sm btn-danger" data-act="del-pred" data-id="' + p.id + '">🗑️</button>') +
        '</div>' +
      '</div>';
    });
  }

  return html + '<div class="card"><div class="card-title"><span class="ic">📋</span> Daftar</div>' + list + '</div>';
}

/* ============================================================
   BAGIAN 12 — DANA DARURAT
   ============================================================ */

function pageEmergency(b) {
  var target = Number(state.emergency.target) || 0;
  var pct = target > 0 ? Math.min(100, (b.emergency / target) * 100) : 0;

  var deposits = 0, withdraws = 0;
  allTx().forEach(function (t) {
    if (t.type !== 'transfer') return;
    if (t.to === 'emergency') deposits += Number(t.amount) || 0;
    if (t.from === 'emergency') withdraws += Number(t.amount) || 0;
  });

  var hist = allTx().filter(function (t) {
    return t.type === 'transfer' && (t.to === 'emergency' || t.from === 'emergency');
  }).reverse();

  var rec = recommendEmergency(b);

  return '<div class="grid grid-3" style="margin-bottom:14px">' +
    statCard('Saldo', rupiah(b.emergency), '🛡️', 'val-cyan', 'Awal: ' + rupiah(INITIAL.emergency)) +
    statCard('Setoran', rupiah(deposits), '⬆️', 'val-emerald') +
    statCard('Penarikan', rupiah(withdraws), '⬇️', 'val-coral') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">🎯</span> Target Dana Darurat</div>' +
    '<div class="kv"><span class="k">Target</span><span class="v">' + rupiah(target) + '</span></div>' +
    '<div class="kv"><span class="k">Saldo saat ini</span><span class="v">' + rupiah(b.emergency) + '</span></div>' +
    '<div class="progress" style="margin:12px 0 8px"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
    '<div class="help">' + pct.toFixed(1) + '% tercapai.</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="deposit-emergency">+ Setor</button>' +
      '<button class="btn btn-sm" data-act="withdraw-emergency">− Tarik</button>' +
      '<button class="btn btn-sm" data-act="edit-emergency-target">Ubah Target</button>' +
    '</div>' +
  '</div>' +

  '<div class="card" style="border-color:rgba(53,211,154,.35)">' +
    '<div class="card-title"><span class="ic">🤖</span> Rekomendasi Setoran</div>' +
    '<div class="kv"><span class="k">Saran hari ini</span><span class="v val-emerald">' + rupiah(rec.amount) + '</span></div>' +
    '<div class="help">' + esc(rec.reason) + '</div>' +
    (rec.amount > 0
      ? '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-sm btn-primary" data-act="deposit-emergency-amt" data-amt="' + rec.amount + '">Setor ' + rupiah(rec.amount) + '</button></div>'
      : '') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Riwayat</div>' +
    (hist.length ? hist.map(txRow).join('')
      : emptyState('🛡️', 'Belum ada pergerakan', 'Setoran akan muncul di sini.')) +
  '</div>';
}

function recommendEmergency(b) {
  var free = b.saldoBebas;
  var today = todayISO();
  var budget = dailyBudgetFor(today);
  var spent = sumBudgetOn(today);
  var remainBudget = Math.max(0, budget - spent);

  var upcoming = state.predictions.filter(function (p) {
    return p.status === 'planned' && p.date >= today;
  }).reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);

  var debtOwed = (state.debts || []).filter(function (d) {
    return d.status === 'active' && d.type === 'owed';
  }).reduce(function (s, d) {
    return s + Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
  }, 0);

  var available = free - remainBudget - upcoming - debtOwed;

  if (available <= 0) {
    return { amount: 0, reason: 'Saldo bebas belum cukup setelah kebutuhan hari ini, prediksi, dan utang. Tidak perlu memaksakan.' };
  }
  if (available < 5000) {
    var small = Math.floor(available / 1000) * 1000;
    return { amount: small, reason: 'Uang terbatas. Sisihkan ' + rupiah(small) + ' saja.' };
  }
  var rec = Math.floor((available * 0.25) / 1000) * 1000;
  if (rec > 20000) rec = 20000;
  if (rec < 2000) rec = 2000;
  return {
    amount: rec,
    reason: 'Dihitung dari saldo bebas ' + rupiah(free) + ' − anggaran jajan ' + rupiah(remainBudget) +
            ' − prediksi ' + rupiah(upcoming) + ' − utang ' + rupiah(debtOwed) +
            '. Alokasi 25%, maksimal Rp20.000.'
  };
}

/* ============================================================
   BAGIAN 13 — TABUNGAN UMUM
   ============================================================ */

function pageSavings(b) {
  var target = Number(state.savings.target) || 0;
  var deadline = state.savings.deadline || '';
  var pct = target > 0 ? Math.min(100, (b.savings / target) * 100) : 0;

  var deposits = 0, withdraws = 0;
  allTx().forEach(function (t) {
    if (t.type !== 'transfer') return;
    if (t.to === 'savings') deposits += Number(t.amount) || 0;
    if (t.from === 'savings') withdraws += Number(t.amount) || 0;
  });

  var hist = allTx().filter(function (t) {
    return t.type === 'transfer' && (t.to === 'savings' || t.from === 'savings');
  }).reverse();

  var est = estimateSavings(b, target);
  var rec = recommendSavings(b);

  return '<div class="grid grid-3" style="margin-bottom:14px">' +
    statCard('Saldo', rupiah(b.savings), '🎯', 'val-emerald') +
    statCard('Setoran', rupiah(deposits), '⬆️', 'val-cyan') +
    statCard('Penarikan', rupiah(withdraws), '⬇️', 'val-coral') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">🎯</span> Target Tabungan</div>' +
    '<div class="kv"><span class="k">Target</span><span class="v">' + rupiah(target) + '</span></div>' +
    '<div class="kv"><span class="k">Tenggat</span><span class="v">' +
      (deadline ? esc(fmtTanggal(deadline)) : '—') + '</span></div>' +
    '<div class="kv"><span class="k">Progress</span><span class="v">' + pct.toFixed(1) + '%</span></div>' +
    '<div class="progress" style="margin:12px 0 8px"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
    '<div class="help">' + esc(est.text) + '</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="deposit-savings">+ Setor</button>' +
      '<button class="btn btn-sm" data-act="withdraw-savings">− Tarik</button>' +
      '<button class="btn btn-sm" data-act="edit-savings-target">Ubah Target</button>' +
    '</div>' +
  '</div>' +

  '<div class="card" style="border-color:rgba(53,211,154,.35)">' +
    '<div class="card-title"><span class="ic">🤖</span> Rekomendasi</div>' +
    '<div class="kv"><span class="k">Saran</span><span class="v val-emerald">' + rupiah(rec.amount) + '</span></div>' +
    '<div class="help">' + esc(rec.reason) + '</div>' +
    (rec.amount > 0
      ? '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-sm btn-primary" data-act="deposit-savings-amt" data-amt="' + rec.amount + '">Setor</button></div>'
      : '') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Riwayat</div>' +
    (hist.length ? hist.map(txRow).join('')
      : emptyState('🎯', 'Belum ada riwayat', 'Setoran akan muncul di sini.')) +
  '</div>';
}

function estimateSavings(b, target) {
  if (target <= 0) return { text: 'Tentukan target dulu.' };
  if (b.savings >= target) return { text: '🎉 Target tercapai!' };

  var deps = allTx().filter(function (t) { return t.type === 'transfer' && t.to === 'savings'; });
  if (deps.length < 2) return { text: 'Butuh minimal 2 setoran untuk estimasi.' };

  var total = 0;
  deps.forEach(function (t) { total += Number(t.amount) || 0; });
  var avg = total / deps.length;
  if (avg <= 0) return { text: 'Data belum cukup.' };

  var sisa = target - b.savings;
  var bulan = Math.ceil(sisa / (avg * 4));
  return { text: 'Rata-rata setoran ' + rupiah(avg) + '. Estimasi ' + bulan + ' bulan lagi.' };
}

function recommendSavings(b) {
  var free = b.saldoBebas;
  var today = todayISO();
  var remainBudget = Math.max(0, dailyBudgetFor(today) - sumBudgetOn(today));
  var upcoming = state.predictions.filter(function (p) {
    return p.status === 'planned' && p.date >= today;
  }).reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);

  var available = free - remainBudget - upcoming;
  if (available <= 0) return { amount: 0, reason: 'Saldo bebas belum cukup.' };
  var rec = Math.floor((available * 0.20) / 1000) * 1000;
  if (rec > 15000) rec = 15000;
  if (rec < 1000) rec = 0;
  return { amount: rec, reason: 'Alokasi 20% dari sisa aman, maksimal Rp15.000.' };
}

/* ============================================================
   BAGIAN 14 — TABUNGAN EMAS
   ============================================================ */

function pageGold(b) {
  var price = Number(state.gold.pricePerGram) || 0;
  var estValue = price > 0 ? price * b.goldGrams : 0;

  var buys = allTx().filter(function (t) { return t.type === 'goldBuy'; });
  var sells = allTx().filter(function (t) { return t.type === 'goldSell'; });
  var totalBuyCost = buys.reduce(function (s, t) { return s + (Number(t.amount) || 0) + (Number(t.fee) || 0); }, 0);
  var totalSellValue = sells.reduce(function (s, t) { return s + (Number(t.amount) || 0) - (Number(t.fee) || 0); }, 0);
  var totalFee = buys.concat(sells).reduce(function (s, t) { return s + (Number(t.fee) || 0); }, 0);

  var hist = allTx().filter(function (t) {
    return (t.type === 'transfer' && (t.to === 'goldFund' || t.from === 'goldFund')) ||
           t.type === 'goldBuy' || t.type === 'goldSell';
  }).reverse();

  var rec = recommendGold(b);

  return '<div class="grid grid-3" style="margin-bottom:14px">' +
    statCard('Dana eMas', rupiah(b.goldFund), '🪙', 'val-gold', 'Masih berupa uang') +
    statCard('Emas', b.goldGrams > 0 ? (b.goldGrams + ' gr') : '0 gram', '⚖️', 'val-cyan',
      b.goldGrams > 0 ? 'Sudah dibeli valid' : 'Belum ada emas') +
    statCard('Estimasi Nilai', price > 0 ? rupiah(estValue) : '—', '📈', 'val-emerald',
      price > 0 ? (rupiah(price) + '/gr') : 'Harga belum diisi') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">ℹ️</span> Info</div>' +
    '<div class="kv"><span class="k">Dana tunai untuk emas</span><span class="v val-gold">' + rupiah(b.goldFund) + '</span></div>' +
    '<div class="kv"><span class="k">Emas dimiliki</span><span class="v val-cyan">' + b.goldGrams + ' gram</span></div>' +
    '<div class="kv"><span class="k">Total beli</span><span class="v">' + rupiah(totalBuyCost) + '</span></div>' +
    '<div class="kv"><span class="k">Total jual</span><span class="v">' + rupiah(totalSellValue) + '</span></div>' +
    '<div class="kv"><span class="k">Total fee</span><span class="v">' + rupiah(totalFee) + '</span></div>' +
    '<div class="help" style="margin-top:10px">Dana eMas tetap berupa <b>uang</b> sampai dibelikan emas.</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="deposit-gold">+ Setor</button>' +
      '<button class="btn btn-sm" data-act="withdraw-gold">− Tarik</button>' +
      '<button class="btn btn-gold btn-sm" data-act="buy-gold">🪙 Beli Emas</button>' +
      '<button class="btn btn-sm" data-act="sell-gold">💱 Jual Emas</button>' +
      '<button class="btn btn-sm" data-act="edit-gold-price">Harga</button>' +
    '</div>' +
  '</div>' +

  '<div class="card" style="border-color:rgba(232,199,106,.4)">' +
    '<div class="card-title"><span class="ic">🤖</span> Rekomendasi</div>' +
    '<div class="kv"><span class="k">Alokasi</span><span class="v val-gold">' + rupiah(rec.amount) + '</span></div>' +
    '<div class="help">' + esc(rec.reason) + '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Riwayat</div>' +
    (hist.length ? hist.map(txRow).join('')
      : emptyState('🪙', 'Belum ada transaksi emas', 'Setoran akan muncul di sini.')) +
  '</div>';
}

function recommendGold(b) {
  var today = todayISO();
  var remainBudget = Math.max(0, dailyBudgetFor(today) - sumBudgetOn(today));
  var upcoming = state.predictions.filter(function (p) {
    return p.status === 'planned' && p.date >= today;
  }).reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);

  if (!state.reconciliation.resolved) {
    return { amount: 0, reason: 'Selesaikan rekonsiliasi dulu sebelum alokasi ke emas.' };
  }
  if (b.emergency < INITIAL.emergency) {
    return { amount: 0, reason: 'Dana darurat di bawah saldo awal. Prioritaskan DD dulu.' };
  }

  var available = b.saldoBebas - remainBudget - upcoming;
  if (available <= 3000) {
    return { amount: 0, reason: 'Saldo bebas belum cukup. Emas bukan prioritas sekarang.' };
  }
  var rec = Math.floor((available * 0.10) / 1000) * 1000;
  if (rec > 10000) rec = 10000;
  return { amount: rec, reason: 'Alokasi 10% dari sisa aman, maksimal Rp10.000. Emas untuk jangka panjang.' };
}

/* ============================================================
   BAGIAN 15 — SISA UANG JAJAN
   ============================================================ */

function pageSnack(b) {
  var today = todayISO();
  var wk = weekRange(today);

  var received = sumSnackIncomeRange(wk[0], wk[1]);
  var spent = sumSnackExpenseRange(wk[0], wk[1]);
  var sisa = b.snackTotal;

  var end = parseISO(wk[1]);
  var now = parseISO(today);
  var daysLeft = Math.max(1, Math.round((end - now) / 86400000) + 1);
  var perDay = sisa / daysLeft;

  var sat = null, sun = null;
  for (var i = 0; i < 7; i++) {
    var d = new Date(parseISO(wk[0]).getFullYear(), parseISO(wk[0]).getMonth(), parseISO(wk[0]).getDate() + i);
    if (d.getDay() === 6) sat = isoOf(d);
    if (d.getDay() === 0) sun = isoOf(d);
  }

  var satBudget = sat ? dailyBudgetFor(sat) : 0;
  var sunBudget = sun ? dailyBudgetFor(sun) : 0;
  var satSpent = sat ? sumBudgetOn(sat) : 0;
  var sunSpent = sun ? sumBudgetOn(sun) : 0;
  var weekendSpent = satSpent + sunSpent;
  var weekendBudget = satBudget + sunBudget;
  var weekendLeft = weekendBudget - weekendSpent;
  var todayBudget = dailyBudgetFor(today);

  var html = '';

  if (sisa > 20000) {
    html += '<div class="snack-alloc-banner">' +
      '<div class="snack-alloc-title">💡 Uang jajanmu cukup banyak</div>' +
      '<div class="snack-alloc-sub">Kamu punya <b>' + rupiah(sisa) + '</b> di pos uang jajan. ' +
        'Sebagian bisa dipindah ke <b>Saldo Bebas</b>.</div>' +
      '<div class="snack-alloc-quick">' +
        '<button data-act="snack-to-main-amt" data-amt="5000">+5.000</button>' +
        '<button data-act="snack-to-main-amt" data-amt="10000">+10.000</button>' +
        '<button data-act="snack-to-main-amt" data-amt="20000">+20.000</button>' +
        '<button data-act="snack-to-main-amt" data-amt="50000">+50.000</button>' +
        '<button data-act="snack-to-main" data-amt="all">📤 Pindah Nominal Lain</button>' +
      '</div>' +
    '</div>';
  }

  html += '<div class="grid grid-2" style="margin-bottom:14px">' +
    statCard('Sisa Uang Jajan', rupiah(sisa), '🍜', 'val-gold',
      'Tunai ' + rupiah(b.snackCash) + ' • Non-tunai ' + rupiah(b.snackNonCash)) +
    statCard('Diterima Minggu Ini', rupiah(received), '💵', 'val-emerald') +
    statCard('Pengeluaran Uang Jajan', rupiah(spent), '💸', 'val-coral', 'Minggu ini') +
    statCard('Sisa per Hari', rupiah(perDay), '📅', 'val-cyan', daysLeft + ' hari lagi') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">📆</span> Akhir Pekan</div>' +
    '<div class="kv"><span class="k">Anggaran Sabtu</span><span class="v val-cyan">' + rupiah(satBudget) + '</span></div>' +
    '<div class="kv"><span class="k">Realisasi Sabtu</span><span class="v val-coral">' + rupiah(satSpent) + '</span></div>' +
    '<div class="kv"><span class="k">Anggaran Minggu</span><span class="v val-cyan">' + rupiah(sunBudget) + '</span></div>' +
    '<div class="kv"><span class="k">Realisasi Minggu</span><span class="v val-coral">' + rupiah(sunSpent) + '</span></div>' +
    '<div class="kv"><span class="k">Sisa akhir pekan</span><span class="v ' +
      (weekendLeft < 0 ? 'val-coral' : 'val-emerald') + '">' + rupiah(weekendLeft) + '</span></div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">🔄</span> Pindah Dana</div>' +
    '<div class="alloc-dual">' +
      (sisa > 0
        ? '<button data-act="snack-to-main"><span class="em">⬆️</span> Uang Jajan → Saldo Bebas</button>'
        : '<button disabled style="opacity:.4"><span class="em">⬆️</span> Uang Jajan → Saldo Bebas</button>') +
      (b.saldoBebas > 0
        ? '<button data-act="main-to-snack"><span class="em">⬇️</span> Saldo Bebas → Uang Jajan</button>'
        : '<button disabled style="opacity:.4"><span class="em">⬇️</span> Saldo Bebas → Uang Jajan</button>') +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">💡</span> Simulasi Hari Ini</div>' +
    '<div class="kv"><span class="k">Batas jajan</span><span class="v val-cyan">' + rupiah(todayBudget) + '</span></div>' +
    '<div class="kv"><span class="k">Pengeluaran aktual</span><span class="v val-coral">' + rupiah(sumBudgetOn(today)) + '</span></div>' +
    '<div class="kv"><span class="k">Sisa</span><span class="v ' +
      (todayBudget - sumBudgetOn(today) < 0 ? 'val-coral' : 'val-emerald') + '">' +
      rupiah(todayBudget - sumBudgetOn(today)) + '</span></div>' +
  '</div>';

  var snackTx = allTx().filter(function (t) {
    return inRange(t.date, wk[0], wk[1]) &&
           ((t.type === 'income' && t.isSnackAllowance) || (t.type === 'expense' && t.useSnack));
  }).reverse();

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📋</span> Transaksi Uang Jajan Minggu Ini</div>' +
    (snackTx.length ? snackTx.map(txRow).join('')
      : emptyState('🍜', 'Belum ada transaksi uang jajan', 'Catat uang jajan & pengeluarannya.')) +
  '</div>';

  return html;
}

/* ============================================================
   BAGIAN 16 — UTANG & PIUTANG (BARU)
   ============================================================ */

/* ============================================================
   HALAMAN: UANG TITIPAN
   ============================================================ */

function pageTitipan(b) {
  var list = (state.titipan || []).slice();
  var active = list.filter(function (x) { return x.status === 'active'; });
  var done = list.filter(function (x) { return x.status === 'used' || x.status === 'returned'; });

  var totalActive = 0;
  active.forEach(function (x) { totalActive += Number(x.amount) || 0; });

  var html = '';

  html += '<div class="card" style="border-color:rgba(232,199,106,.4);background:linear-gradient(135deg,rgba(232,199,106,.08),rgba(255,127,168,.03))">' +
    '<div class="card-title"><span class="ic">📦</span> Uang Titipan Aktif</div>' +
    '<div class="kv"><span class="k">Total yang dititipkan</span>' +
      '<span class="v val-gold" style="font-size:18px">' + rupiah(totalActive) + '</span></div>' +
    '<div class="kv"><span class="k">Jumlah titipan</span>' +
      '<span class="v">' + active.length + ' aktif • ' + done.length + ' selesai</span></div>' +
    '<div class="help" style="margin-top:10px">' +
      'Ini uang orang lain yang <b>dititipkan ke kamu</b>. ' +
      'Bukan milikmu — catat biar nggak lupa & nggak kepakai.' +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="add-titipan">+ Catat Titipan Baru</button>' +
    '</div>' +
  '</div>';

  if (active.length) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">📌</span> Sedang Dititipkan</div>';
    active.forEach(function (x) {
      html += titipanCardHTML(x);
    });
    html += '</div>';
  }

  if (done.length) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">✅</span> Sudah Selesai</div>';
    done.forEach(function (x) {
      html += titipanCardHTML(x);
    });
    html += '</div>';
  }

  if (!list.length) {
    html += '<div class="card">' +
      emptyState('📦', 'Belum ada titipan', 'Kalau ada yang nitip uang ke kamu, catat di sini biar nggak lupa.') +
    '</div>';
  }

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">ℹ️</span> Cara Pakai</div>' +
    '<div class="help">' +
      '<b>1.</b> Klik "+ Catat Titipan Baru" — isi nama orang & nominalnya.<br>' +
      '<b>2.</b> Uang titipan <b>TIDAK</b> masuk ke total uang kamu (karena bukan milikmu).<br>' +
      '<b>3.</b> Kalau uangnya sudah dipakai / dikembalikan, klik tombol yang sesuai di kartunya.<br>' +
      '<b>4.</b> Riwayatnya tetap tersimpan, biar kamu bisa lihat kapan saja.' +
    '</div>' +
  '</div>';

  return html;
}

function titipanCardHTML(x) {
  var isActive = x.status === 'active';
  var statusBadge =
    x.status === 'active'   ? '<span class="badge warn">Aktif</span>' :
    x.status === 'used'     ? '<span class="badge info">Sudah dipakai</span>' :
                              '<span class="badge ok">Sudah dikembalikan</span>';

  return '<div class="titipan-card ' + (isActive ? 'active' : 'done') + '">' +
    '<div class="titipan-header">' +
      '<div>' +
        '<div class="titipan-from">📦 Dititipkan oleh</div>' +
        '<div class="titipan-person">' + esc(x.person || 'Tanpa nama') + '</div>' +
      '</div>' +
      '<div class="titipan-amount">' + rupiah(x.amount) + '</div>' +
    '</div>' +
    '<div class="titipan-meta">' +
      'Diterima: ' + fmtTanggalPendek(x.date) +
      (x.purpose ? ' • Untuk: ' + esc(x.purpose) : '') +
    '</div>' +
    (x.note ? '<div class="help" style="margin-top:6px">' + esc(x.note) + '</div>' : '') +
    '<div class="tagrow" style="margin-top:8px">' + statusBadge + '</div>' +
    '<div class="btn-row" style="margin-top:10px">' +
      (isActive
        ? '<button class="btn btn-sm btn-primary" data-act="use-titipan" data-id="' + x.id + '">💸 Tandai Dipakai</button>' +
          '<button class="btn btn-sm" data-act="return-titipan" data-id="' + x.id + '">↩️ Tandai Dikembalikan</button>' +
          '<button class="btn btn-sm" data-act="edit-titipan" data-id="' + x.id + '">✏️</button>'
        : '<button class="btn btn-sm btn-danger" data-act="del-titipan" data-id="' + x.id + '">🗑️ Hapus</button>') +
    '</div>' +
  '</div>';
}

function openTitipanForm(existing) {
  var isEdit = !!existing;
  var x = existing || {
    person: '', amount: '', date: todayISO(),
    purpose: '', note: '', status: 'active'
  };

  var body =
    '<div class="help" style="margin-bottom:12px">' +
      'Uang titipan <b>tidak masuk</b> ke total uang kamu — karena bukan milikmu. ' +
      'Ini cuma catatan biar nggak lupa.' +
    '</div>' +
    '<div class="field"><label>Dititipkan oleh</label>' +
      '<input type="text" id="t_person" value="' + esc(x.person || '') + '" placeholder="Contoh: Pacar, Teman, Adik" /></div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
      quickAmountButtons('t_amount') +
      '<input type="number" id="t_amount" min="1" step="1" inputmode="numeric" value="' + (x.amount || '') + '" /></div>' +
    '<div class="field"><label>Tanggal diterima</label>' +
      '<input type="date" id="t_date" value="' + esc(x.date || todayISO()) + '" /></div>' +
    '<div class="field"><label>Untuk apa (opsional)</label>' +
      '<input type="text" id="t_purpose" value="' + esc(x.purpose || '') + '" placeholder="Contoh: buat beli tiket konser" /></div>' +
    '<div class="field"><label>Catatan (opsional)</label>' +
      '<textarea id="t_note" placeholder="Info tambahan...">' + esc(x.note || '') + '</textarea></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="t_save">' + (isEdit ? 'Simpan' : 'Catat') + '</button>';

  openModal(isEdit ? '✏️ Edit Titipan' : '📦 Catat Uang Titipan', body, foot, function (root) {
    $('#t_save', root).addEventListener('click', function () {
      var person = $('#t_person', root).value.trim();
      var amount = parseInt($('#t_amount', root).value, 10);
      var date = $('#t_date', root).value;
      var purpose = $('#t_purpose', root).value.trim();
      var note = $('#t_note', root).value.trim();

      if (!person) return toast('Nama orang wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');
      if (!date) return toast('Tanggal wajib.', 'err');

      if (isEdit) {
        var idx = state.titipan.findIndex(function (a) { return a.id === existing.id; });
        if (idx >= 0) {
          state.titipan[idx] = Object.assign({}, existing, {
            person: person, amount: amount, date: date,
            purpose: purpose, note: note
          });
        }
      } else {
        state.titipan.push({
          id: uid(),
          person: person,
          amount: amount,
          date: date,
          purpose: purpose,
          note: note,
          status: 'active',
          createdAt: nowStamp()
        });
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay('success');
      toast(isEdit ? 'Titipan diperbarui.' : 'Titipan ' + rupiah(amount) + ' dari ' + person + ' tercatat.', 'ok');
    });
  });
}
  
function pageDebts(b) {
  var debts = (state.debts || []).slice();
  var active = debts.filter(function (d) { return d.status === 'active'; });
  var done = debts.filter(function (d) { return d.status === 'paid'; });

  var totalOwed = 0, totalReceivable = 0;
  active.forEach(function (d) {
    var sisa = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
    if (d.type === 'owed') totalOwed += sisa;
    else totalReceivable += sisa;
  });

  var html = '';

  html += '<div class="grid grid-2" style="margin-bottom:14px">' +
    statCard('Utang Kamu', rupiah(totalOwed), '💳', 'val-coral', active.filter(function (d) { return d.type === 'owed'; }).length + ' aktif') +
    statCard('Piutang Kamu', rupiah(totalReceivable), '🤝', 'val-emerald', active.filter(function (d) { return d.type === 'receivable'; }).length + ' aktif') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">➕</span> Aksi</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-primary btn-sm" data-act="add-debt">+ Catat Utang/Piutang</button>' +
    '</div>' +
  '</div>';

  if (active.length) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">📋</span> Utang & Piutang Aktif</div>';
    active.forEach(function (d) {
      var sisa = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
      var pct = d.amount > 0 ? Math.min(100, (d.paid / d.amount) * 100) : 0;
      var isOwed = d.type === 'owed';
      var p = esc(d.person || 'Tanpa nama');

      html += '<div class="debt-card ' + (isOwed ? 'owed' : 'receivable') + '">' +
        '<div class="debt-header">' +
          '<div>' +
            '<div class="debt-type">' + (isOwed ? '💳 Utang ke' : '🤝 Piutang dari') + '</div>' +
            '<div class="debt-person">' + p + '</div>' +
          '</div>' +
          '<div class="debt-amount">' + rupiah(sisa) + '</div>' +
        '</div>' +
        '<div class="debt-meta">' +
          'Total: ' + rupiah(d.amount) + ' • Terbayar: ' + rupiah(d.paid) + ' • ' +
          (d.dueDate ? ('Tempo: ' + fmtTanggalPendek(d.dueDate)) : 'Tanpa tempo') +
        '</div>' +
        '<div class="progress" style="margin:8px 0"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        (d.note ? '<div class="help">' + esc(d.note) + '</div>' : '') +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="btn btn-sm btn-primary" data-act="pay-debt" data-id="' + d.id + '">Bayar</button>' +
          '<button class="btn btn-sm" data-act="edit-debt" data-id="' + d.id + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del-debt" data-id="' + d.id + '">🗑️</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="card">' + emptyState('🤝', 'Belum ada utang/piutang aktif', 'Catat kalau ada pinjam-meminjam uang.') + '</div>';
  }

  if (done.length) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">✅</span> Sudah Lunas</div>';
    done.forEach(function (d) {
      var isOwed = d.type === 'owed';
      html += '<div class="tx">' +
        '<div class="tx-ic">' + (isOwed ? '💳' : '🤝') + '</div>' +
        '<div class="tx-main">' +
          '<div class="tx-desc">' + esc(d.person) + '</div>' +
          '<div class="tx-meta">' + rupiah(d.amount) + ' • Lunas' +
            (d.paidDate ? ' ' + fmtTanggalPendek(d.paidDate) : '') + '</div>' +
        '</div>' +
        '<div class="tx-acts">' +
          '<button class="icon-btn" data-act="del-debt" data-id="' + d.id + '" title="Hapus">🗑️</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  }

  return html;
}

/* ============================================================
   BAGIAN 17 — AI ADVISOR
   ============================================================ */

function pageAIClassic(b) {
  var a = analyze(b);

  var html = '<div class="card">' +
    '<div class="card-title"><span class="ic">🤖</span> Penasihat Keuangan ' +
      '<span class="badge info">Aturan Lokal</span></div>' +
    '<div class="help">Analisis berbasis aturan JavaScript offline. Tidak ada AI generatif yang terhubung.</div>' +
    '<div class="kv" style="margin-top:10px"><span class="k">Update terakhir</span><span class="v">' +
      esc(nowStamp()) + '</span></div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="refresh-ai">🔄 Perbarui</button>' +
    '</div>' +
  '</div>';

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📌</span> Fakta</div>' +
    '<div class="kv"><span class="k">Total uang</span><span class="v val-emerald">' + rupiah(b.totalMoney) + '</span></div>' +
    '<div class="kv"><span class="k">Saldo bebas</span><span class="v">' + rupiah(b.saldoBebas) + '</span></div>' +
    '<div class="kv"><span class="k">Uang jajan</span><span class="v val-gold">' + rupiah(b.snackTotal) + '</span></div>' +
    '<div class="kv"><span class="k">Dana darurat</span><span class="v val-cyan">' + rupiah(b.emergency) + '</span></div>' +
    '<div class="kv"><span class="k">Dana eMas</span><span class="v val-gold">' + rupiah(b.goldFund) + '</span></div>' +
    '<div class="kv"><span class="k">Pengeluaran hari ini</span><span class="v val-coral">' +
      rupiah(sumBudgetOn(a.today)) + '</span></div>' +
    '<div class="kv"><span class="k">Batas hari ini</span><span class="v val-cyan">' + rupiah(a.budget) + '</span></div>' +
  '</div>';

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">✅</span> Rekomendasi</div>';
  html += adviceBlock('🎯 Batas Jajan Hari Ini', a.safeLimitText);
  html += adviceBlock('💰 Menabung Hari Ini?', a.saveTodayText);
  html += adviceBlock('🛡️ Alokasi Dana Darurat', a.emergencyText);
  html += adviceBlock('🎯 Alokasi Tabungan', a.savingsText);
  html += adviceBlock('🪙 Alokasi Emas', a.goldText);
  html += adviceBlock('📊 Anggaran vs Realisasi', a.budgetCompareText);
  html += '</div>';

  if (a.warnings.length) {
    html += '<div class="card" style="border-color:rgba(255,107,120,.4)">' +
      '<div class="card-title"><span class="ic">⚠️</span> Peringatan</div>' +
      a.warnings.map(function (w) {
        return '<div class="advice" style="border-color:rgba(255,107,120,.28)"><p>' + w + '</p></div>';
      }).join('') +
    '</div>';
  }

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">🧭</span> Langkah Praktis</div>' +
    '<ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.9;color:var(--text)">' +
      a.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
    '</ol>' +
  '</div>';

  return html;
}

function adviceBlock(title, text) {
  return '<div class="advice"><div class="hd"><strong>' + title + '</strong></div><p>' + text + '</p></div>';
}

function analyze(b) {
  var today = todayISO();
  var budget = dailyBudgetFor(today);
  var spentToday = sumBudgetOn(today);
  var remainBudget = budget - spentToday;
  var free = b.saldoBebas;

  var upcoming = state.predictions.filter(function (p) {
    return p.status === 'planned' && p.date >= today;
  }).reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);

  var debtOwed = (state.debts || []).filter(function (d) {
    return d.status === 'active' && d.type === 'owed';
  }).reduce(function (s, d) {
    return s + Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
  }, 0);

  var unrec = b.unidentified;

  var d30 = new Date(parseISO(today).getFullYear(), parseISO(today).getMonth(), parseISO(today).getDate() - 29);
  var catMap = expensesByCategory(isoOf(d30), today);
  var topCat = { name: '—', value: 0 };
  Object.keys(catMap).forEach(function (k) {
    if (catMap[k] > topCat.value) topCat = { name: k, value: catMap[k] };
  });

  var warnings = [];

  var safeLimit = Math.max(0, Math.min(remainBudget, free));
  var safeLimitText;
  if (remainBudget <= 0) {
    safeLimitText = 'Anggaran hari ini sudah habis (' + rupiah(spentToday) + '/' + rupiah(budget) + '). ' +
      'Tahan jajan sampai besok.';
  } else if (free < remainBudget) {
    safeLimitText = 'Saldo bebas (' + rupiah(free) + ') lebih kecil dari sisa anggaran. ' +
      'Batas aman: <span class="num">' + rupiah(safeLimit) + '</span>.';
  } else {
    safeLimitText = 'Batas aman jajan hari ini <span class="num">' + rupiah(safeLimit) + '</span>. ' +
      'Usahakan lebih rendah kalau bisa.';
  }

  var saveTodayText;
  var availForSave = free - Math.max(0, remainBudget) - upcoming - debtOwed;
  if (unrec > 0) {
    saveTodayText = 'Tunda menabung. Selesaikan dulu rekonsiliasi ' + rupiah(unrec) + '.';
  } else if (availForSave >= 5000) {
    saveTodayText = 'Bisa menabung hari ini. Sisa aman <span class="num">' + rupiah(availForSave) + '</span>. ' +
      'Nominal wajar: ' + rupiah(Math.min(15000, Math.floor(availForSave * 0.2 / 1000) * 1000)) + '.';
  } else {
    saveTodayText = 'Belum perlu menabung hari ini. Sisa aman hanya ' + rupiah(Math.max(0, availForSave)) + '. ' +
      'Yang penting nggak berutang dan kebutuhan pokok tercukupi.';
  }

  var recE = recommendEmergency(b);
  var emergencyText = recE.amount > 0
    ? 'Alokasi DD hari ini <span class="num">' + rupiah(recE.amount) + '</span>. ' + esc(recE.reason)
    : 'Belum disarankan setor DD. ' + esc(recE.reason);

  var recS = recommendSavings(b);
  var savingsText = recS.amount > 0
    ? 'Alokasi tabungan <span class="num">' + rupiah(recS.amount) + '</span>. ' + esc(recS.reason)
    : 'Belum disarankan setor tabungan. ' + esc(recS.reason);

  var recG = recommendGold(b);
  var goldText = recG.amount > 0
    ? 'Alokasi emas <span class="num">' + rupiah(recG.amount) + '</span>. ' + esc(recG.reason)
    : 'Belum disarankan alokasi emas. ' + esc(recG.reason);

  var pct = budget > 0 ? (spentToday / budget) * 100 : 0;
  var budgetCompareText = 'Anggaran ' + rupiah(budget) + ', realisasi ' + rupiah(spentToday) +
    ' (' + pct.toFixed(1) + '%). ' +
    (pct > 100 ? 'Melebihi anggaran ' + rupiah(spentToday - budget) + '.'
     : pct > 75 ? 'Mendekati batas. Hati-hati.'
     : 'Masih aman.');

  if (unrec > 0) warnings.push('Selisih <b>' + rupiah(unrec) + '</b> belum direkonsiliasi.');
  if (b.emergency < INITIAL.emergency) warnings.push('DD di bawah saldo awal.');
  if (free < 10000 && free >= 0) warnings.push('Saldo bebas menipis: ' + rupiah(free) + '.');
  if (free < 0) warnings.push('Saldo bebas negatif.');
  if (upcoming > free) warnings.push('Prediksi melebihi saldo bebas.');
  if (debtOwed > 0) warnings.push('Ada utang aktif <b>' + rupiah(debtOwed) + '</b>. Prioritaskan bayar.');
  if (b.goldGrams === 0 && b.goldFund > 0) warnings.push('Dana eMas masih berupa uang, bukan emas.');

  var steps = [];
  if (unrec > 0) steps.push('Selesaikan rekonsiliasi ' + rupiah(unrec) + '.');
  if (debtOwed > 0) steps.push('Sisihkan uang untuk bayar utang ' + rupiah(debtOwed) + '.');
  steps.push('Batasi jajan maksimal <b>' + rupiah(Math.max(0, Math.min(remainBudget, free))) + '</b>.');
  steps.push('Pertahankan DD ' + rupiah(b.emergency) + ' sebagai dana terpisah.');
  steps.push('Catat transaksi biar analisis makin akurat.');

  return {
    today: today, budget: budget, remainBudget: remainBudget,
    upcoming: upcoming, topCat: topCat, debtOwed: debtOwed,
    safeLimitText: safeLimitText, saveTodayText: saveTodayText,
    emergencyText: emergencyText, savingsText: savingsText,
    goldText: goldText, budgetCompareText: budgetCompareText,
    warnings: warnings, steps: steps
  };
}

/* ============================================================
   BAGIAN 18 — DETEKSI POLA
   ============================================================ */

function pagePatterns(b) {
  var result = detectPatterns();

  var scoreNote =
    result.score >= 90 ? 'Keuanganmu sangat sehat. Pertahankan!' :
    result.score >= 75 ? 'Cukup disiplin. Ada yang bisa diperbaiki.' :
    result.score >= 50 ? 'Beberapa pola perlu diperhatikan.' :
    'Waspada! Ada kebiasaan yang menguras uangmu.';

  var html = '<div class="pattern-score ' + (result.level === 'good' ? '' : result.level) + '">' +
    '<div>' +
      '<div class="pattern-score-lbl">Skor Disiplin</div>' +
      '<div class="pattern-score-note">' + esc(scoreNote) + '</div>' +
    '</div>' +
    '<div style="text-align:right">' +
      '<div class="pattern-score-num">' + result.score + '</div>' +
      '<div class="pattern-score-lbl" style="text-align:right;margin-top:4px">' + esc(result.levelText) + '</div>' +
    '</div>' +
  '</div>';

  if (!result.patterns.length) {
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">✨</span> Analisis</div>' +
      emptyState('✅', 'Nggak ada pola aneh', 'Pengeluaranmu sehat!') +
    '</div>';
  } else {
    var order = { err: 0, warn: 1, info: 2, ok: 3 };
    result.patterns.sort(function (a, c) { return order[a.sev] - order[c.sev]; });
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">🔍</span> Pola Terdeteksi <span class="card-sub">' +
        result.patterns.length + ' temuan</span></div>' +
      result.patterns.map(patternCardHTML).join('') +
    '</div>';
  }

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">ℹ️</span> Cara Kerja</div>' +
    '<div class="help">Deteksi berjalan 100% offline. Menganalisis 7 hari terakhir vs 7 hari sebelumnya.</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="refresh-patterns">🔄 Perbarui</button>' +
    '</div>' +
  '</div>';

  return html;
}

function detectPatterns() {
  var today = todayISO();
  var patterns = [];

  var spentToday = sumBudgetOn(today);
  var budget = dailyBudgetFor(today);
  if (budget > 0 && spentToday > budget * 1.3) {
    patterns.push({
      sev: 'err', icon: '🔥',
      title: 'Pengeluaran hari ini jauh melebihi batas',
      desc: 'Belanja <b>' + rupiah(spentToday) + '</b>, batasnya ' + rupiah(budget) +
            '. Kelebihan <b>' + rupiah(spentToday - budget) + '</b>.',
      tags: ['Hari ini', Math.round((spentToday / budget) * 100) + '%']
    });
  } else if (budget > 0 && spentToday > budget * 0.9) {
    patterns.push({
      sev: 'warn', icon: '⚠️',
      title: 'Hampir menyentuh batas jajan',
      desc: 'Pengeluaran <b>' + rupiah(spentToday) + '</b> dari batas ' + rupiah(budget) + '.',
      tags: ['Hari ini', Math.round((spentToday / budget) * 100) + '%']
    });
  }

  var wk = weekRange(today);
  var lastWeekStart = isoOf(new Date(parseISO(wk[0]).getTime() - 7 * 86400000));
  var lastWeekEnd = isoOf(new Date(parseISO(wk[0]).getTime() - 1 * 86400000));
  var thisCat = expensesByCategory(wk[0], wk[1]);
  var lastCat = expensesByCategory(lastWeekStart, lastWeekEnd);

  Object.keys(thisCat).forEach(function (cat) {
    var now = thisCat[cat];
    var prev = lastCat[cat] || 0;
    if (prev >= 3000 && now > prev * 1.5 && now - prev >= 10000) {
      patterns.push({
        sev: 'warn', icon: '📈',
        title: 'Kategori ' + esc(cat) + ' naik tajam',
        desc: 'Minggu ini <b>' + rupiah(now) + '</b>, minggu lalu ' + rupiah(prev) + '.',
        tags: [cat, '+' + rupiah(now - prev)]
      });
    }
  });

  var last7 = isoOf(new Date(parseISO(today).getTime() - 6 * 86400000));
  var recentTx = allTx().filter(function (t) {
    return t.type === 'expense' && t.date >= last7 && t.date <= today;
  });

  var descMap = {};
  recentTx.forEach(function (t) {
    var key = String(t.description || t.category || '').toLowerCase().trim();
    if (!key) return;
    if (!descMap[key]) descMap[key] = { count: 0, total: 0, sample: t.description || t.category };
    descMap[key].count++;
    descMap[key].total += Number(t.amount) || 0;
  });

  Object.keys(descMap).forEach(function (key) {
    var d = descMap[key];
    if (d.count >= 4 && d.total >= 15000) {
      patterns.push({
        sev: 'info', icon: '🔁',
        title: 'Sering beli "' + esc(d.sample) + '"',
        desc: '<b>' + d.count + ' kali</b> dalam 7 hari, total <b>' + rupiah(d.total) + '</b>.',
        tags: [d.count + 'x', rupiah(d.total)]
      });
    }
  });

  var zeroDays = 0;
  for (var i = 0; i < 7; i++) {
    var d = isoOf(new Date(parseISO(today).getTime() - i * 86400000));
    var bud = dailyBudgetFor(d);
    if (bud > 0 && sumBudgetOn(d) >= bud * 0.95) zeroDays++;
  }
  if (zeroDays >= 4) {
    patterns.push({
      sev: 'warn', icon: '📉',
      title: zeroDays + ' dari 7 hari terakhir habis total',
      desc: 'Kamu hampir selalu belanja mentok batas. Coba sisihkan 2-3rb lebih sedikit per hari.',
      tags: [zeroDays + '/7', 'Tanpa sisa']
    });
  }

  var b = computeBalances();
  var free = b.saldoBebas;
  var avgSpend = 0;
  for (var j = 0; j < 7; j++) {
    avgSpend += sumBudgetOn(isoOf(new Date(parseISO(today).getTime() - j * 86400000)));
  }
  avgSpend /= 7;

  if (free > 0 && avgSpend > 0) {
    var daysLeft = Math.floor(free / avgSpend);
    if (daysLeft <= 3) {
      patterns.push({
        sev: 'err', icon: '💸',
        title: 'Saldo bebas menipis',
        desc: 'Saldo <b>' + rupiah(free) + '</b>. Dengan avg ' + rupiah(Math.round(avgSpend)) +
              '/hari, cukup <b>~' + daysLeft + ' hari</b>.',
        tags: ['Saldo', '~' + daysLeft + ' hari']
      });
    }
  }

  var goodDays = 0;
  for (var k = 1; k <= 7; k++) {
    var dk = isoOf(new Date(parseISO(today).getTime() - k * 86400000));
    var bk = dailyBudgetFor(dk);
    var spk = sumBudgetOn(dk);
    if (bk > 0 && spk > 0 && spk < bk * 0.6) goodDays++;
  }
  if (goodDays >= 3) {
    patterns.push({
      sev: 'ok', icon: '🏆',
      title: 'Kamu sedang hemat!',
      desc: '<b>' + goodDays + ' hari</b> terakhir di bawah 60% batas. Momentum bagus!',
      tags: [goodDays + ' hari hemat', 'Mantap!']
    });
  }

  var score = 100;
  patterns.forEach(function (p) {
    if (p.sev === 'err') score -= 20;
    else if (p.sev === 'warn') score -= 10;
    else if (p.sev === 'info') score -= 3;
    else if (p.sev === 'ok') score += 5;
  });
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  var level = score >= 75 ? 'good' : (score >= 50 ? 'medium' : 'bad');
  var levelText = score >= 90 ? 'Sangat Disiplin' :
                  score >= 75 ? 'Cukup Disiplin' :
                  score >= 50 ? 'Perlu Perhatian' : 'Waspada Boros';

  return { patterns: patterns, score: score, level: level, levelText: levelText };
}

function patternCardHTML(p) {
  var tags = (p.tags || []).map(function (t) {
    return '<span class="tag">' + esc(t) + '</span>';
  }).join('');
  return '<div class="pattern-card sev-' + p.sev + '">' +
    '<div class="pattern-ic">' + p.icon + '</div>' +
    '<div class="pattern-body">' +
      '<div class="pattern-title">' + p.title + '</div>' +
      '<div class="pattern-desc">' + p.desc + '</div>' +
      (tags ? '<div class="pattern-meta">' + tags + '</div>' : '') +
    '</div>' +
  '</div>';
}

/* ============================================================
   BAGIAN 19 — INSIGHT MINGGUAN
   ============================================================ */

function generateWeekInsight(startISO, endISO) {
  var inc = sumIncomeRange(startISO, endISO);
  var exp = sumExpenseRange(startISO, endISO);
  var net = inc - exp;

  var catMap = expensesByCategory(startISO, endISO);
  var topCat = { name: '—', value: 0 };
  Object.keys(catMap).forEach(function (k) {
    if (catMap[k] > topCat.value) topCat = { name: k, value: catMap[k] };
  });

  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(parseISO(startISO).getTime() + i * 86400000);
    var iso = isoOf(d);
    days.push({
      iso: iso,
      dow: HARI[d.getDay()].slice(0, 3),
      inc: sumIncomeOn(iso),
      exp: sumExpenseOn(iso),
      budget: dailyBudgetFor(iso)
    });
  }

  var heaviest = null, lightest = null;
  days.forEach(function (d) {
    if (d.exp === 0) return;
    if (!heaviest || d.exp > heaviest.exp) heaviest = d;
    if (!lightest || d.exp < lightest.exp) lightest = d;
  });

  return {
    start: startISO, end: endISO,
    income: inc, expense: exp, net: net,
    savingsRate: inc > 0 ? (net / inc) * 100 : 0,
    topCategory: topCat, categories: catMap,
    avgDaily: exp / 7, days: days,
    heaviest: heaviest, lightest: lightest
  };
}

function pageWeekInsight(b) {
  var today = todayISO();
  var wk = weekRange(today);
  var lastWeekStart = isoOf(new Date(parseISO(wk[0]).getTime() - 7 * 86400000));
  var lastWeekEnd = isoOf(new Date(parseISO(wk[0]).getTime() - 1 * 86400000));

  var current = generateWeekInsight(wk[0], wk[1]);
  var previous = generateWeekInsight(lastWeekStart, lastWeekEnd);

  var isDefisit = current.net < 0;

  var html = '<div class="wi-hero' + (isDefisit ? ' defisit' : '') + '">' +
    '<div class="wi-greeting">Insight Mingguan • ' + fmtTanggalPendek(wk[0]) + ' – ' + fmtTanggalPendek(wk[1]) + '</div>' +
    '<h2 class="wi-title">' + (isDefisit ? 'Minggu Defisit' : current.net > 0 ? 'Minggu Surplus' : 'Minggu Seimbang') + '</h2>' +
    '<div class="wi-big">' + (current.net >= 0 ? '+' : '') + rupiah(current.net) + '</div>' +
    '<div class="wi-big-lbl">Arus kas bersih</div>' +
    '<div class="wi-sub" style="margin-top:12px">' +
      'Masuk <b>' + rupiah(current.income) + '</b> • Keluar <b>' + rupiah(current.expense) + '</b>' +
    '</div>' +
  '</div>';

  if (previous.expense > 0) {
    var expDelta = current.expense - previous.expense;
    var expPct = (expDelta / previous.expense) * 100;
    html += '<div class="card">' +
      '<div class="card-title"><span class="ic">📊</span> Dibanding Minggu Lalu</div>' +
      '<div class="wi-compare">' +
        '<div><div class="lbl">Pemasukan</div><div class="val">' + rupiah(current.income) + '</div></div>' +
        '<div class="delta ' + (current.income - previous.income >= 0 ? '' : 'up') + '">' +
          (current.income - previous.income >= 0 ? '+' : '') + rupiah(current.income - previous.income) + '</div>' +
      '</div>' +
      '<div class="wi-compare">' +
        '<div><div class="lbl">Pengeluaran</div><div class="val">' + rupiah(current.expense) + '</div></div>' +
        '<div class="delta ' + (expDelta <= 0 ? '' : 'up') + '">' +
          (expDelta >= 0 ? '+' : '') + rupiah(expDelta) + '</div>' +
      '</div>' +
    '</div>';
  }

  var maxExp = 1;
  current.days.forEach(function (d) { if (d.exp > maxExp) maxExp = d.exp; });

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📅</span> Pengeluaran Harian</div>' +
    '<div class="wi-days">';
  current.days.forEach(function (d) {
    var isToday = d.iso === today;
    var isOver = d.budget > 0 && d.exp > d.budget;
    var isEmpty = d.exp === 0;
    var pct = (d.exp / maxExp) * 100;
    var cls = 'wi-day';
    if (isToday) cls += ' today';
    if (isOver) cls += ' over';
    if (isEmpty) cls += ' empty';
    html += '<div class="' + cls + '">' +
      '<div class="dow">' + esc(d.dow) + '</div>' +
      '<div class="bar"><i style="height:' + Math.max(2, pct) + '%"></i></div>' +
      '<div class="amt"><b>' + angka(d.exp) + '</b></div>' +
    '</div>';
  });
  html += '</div></div>';

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📌</span> Fakta</div>' +
    '<div class="wi-insight"><span class="em">💵</span><p>Masuk <b>' + rupiah(current.income) + '</b>, ' +
      'keluar <b>' + rupiah(current.expense) + '</b>.</p></div>';
  if (current.topCategory.value > 0) {
    html += '<div class="wi-insight"><span class="em">🏆</span><p>Kategori terbesar: <b>' +
      esc(current.topCategory.name) + '</b> (' + rupiah(current.topCategory.value) + ').</p></div>';
  }
  if (current.heaviest) {
    html += '<div class="wi-insight"><span class="em">🔥</span><p>Hari terboros: <b>' +
      HARI[parseISO(current.heaviest.iso).getDay()] + '</b> (' + rupiah(current.heaviest.exp) + ').</p></div>';
  }
  html += '</div>';

  return html;
}

/* ============================================================
   BAGIAN 20 — TARGET MINGGUAN
   ============================================================ */

function getWeeklyTarget(startISO) {
  if (!state.weeklyTarget) state.weeklyTarget = { default: 85000, overrides: {} };
  if (!state.weeklyTarget.overrides) state.weeklyTarget.overrides = {};
  if (startISO && state.weeklyTarget.overrides[startISO] != null) {
    return Number(state.weeklyTarget.overrides[startISO]) || 0;
  }
  return Number(state.weeklyTarget.default) || 85000;
}

function setWeeklyTarget(startISO, amount) {
  if (!state.weeklyTarget) state.weeklyTarget = { default: 85000, overrides: {} };
  if (!state.weeklyTarget.overrides) state.weeklyTarget.overrides = {};
  amount = Math.max(0, Math.round(Number(amount) || 0));
  if (startISO === 'default') state.weeklyTarget.default = amount;
  else state.weeklyTarget.overrides[startISO] = amount;
}

function computeWeeklyTarget(startISO, endISO) {
  var target = getWeeklyTarget(startISO);
  var spent = sumExpenseRange(startISO, endISO);
  var sisa = target - spent;
  var pct = target > 0 ? (spent / target) * 100 : (spent > 0 ? 100 : 0);
  var pctCapped = Math.min(100, pct);

  var today = todayISO();
  var hariTersisa = 0;
  if (endISO >= today && startISO <= today) {
    var end = parseISO(endISO);
    var now = parseISO(today);
    hariTersisa = Math.max(1, Math.round((end - now) / 86400000) + 1);
  } else if (startISO > today) {
    hariTersisa = 7;
  }

  var sisaPerHari = (hariTersisa > 0 && sisa > 0) ? (sisa / hariTersisa) : 0;

  var status = 'ok';
  if (sisa < 0) status = 'over';
  else if (pct >= 90) status = 'danger';
  else if (pct >= 70) status = 'warn';

  var statusText =
    status === 'over' ? 'Melebihi Target' :
    status === 'danger' ? 'Hampir Habis' :
    status === 'warn' ? 'Setengah Terpakai' : 'Aman';

  return {
    start: startISO, end: endISO, target: target, spent: spent,
    sisa: sisa, pct: pct, pctCapped: pctCapped,
    hariTersisa: hariTersisa, sisaPerHari: sisaPerHari,
    status: status, statusText: statusText
  };
}

function pageWeeklyTarget(b) {
  var today = todayISO();
  var wk = weekRange(today);
  var wt = computeWeeklyTarget(wk[0], wk[1]);
  var hasOverride = state.weeklyTarget && state.weeklyTarget.overrides && state.weeklyTarget.overrides[wk[0]] != null;

  var html = '<div class="wt-hero ' + (wt.status === 'ok' ? '' : wt.status) + '">' +
    '<div class="wt-hero-lbl">Target Mingguan • ' + fmtTanggalPendek(wk[0]) + ' – ' + fmtTanggalPendek(wk[1]) + '</div>' +
    '<h2 class="wt-hero-title">Sisa Anggaran Minggu Ini</h2>' +
    '<div class="wt-hero-num">' + rupiah(Math.max(0, wt.sisa)) + '</div>' +
    '<div class="wt-hero-sub">Terpakai <b>' + rupiah(wt.spent) + '</b> dari <b>' + rupiah(wt.target) + '</b>' +
      (hasOverride ? ' (custom)' : ' (default)') + '</div>' +
    '<div class="wt-progress ' + (wt.status === 'ok' ? '' : wt.status) + '">' +
      '<i style="width:' + wt.pctCapped.toFixed(1) + '%"></i></div>' +
    '<div class="wt-meta">' +
      '<span>' + wt.pct.toFixed(0) + '% terpakai</span>' +
      '<span>' + (wt.hariTersisa > 0 ? wt.hariTersisa + ' hari lagi' : 'Minggu selesai') + '</span>' +
    '</div>' +
    '<div class="wt-status">' + esc(wt.statusText) + '</div>' +
  '</div>' +

  '<div class="wt-stats">' +
    '<div class="wt-stat"><div class="lbl">Target</div><div class="val val-cyan">' + rupiah(wt.target) + '</div></div>' +
    '<div class="wt-stat"><div class="lbl">Terpakai</div><div class="val val-coral">' + rupiah(wt.spent) + '</div></div>' +
    '<div class="wt-stat"><div class="lbl">Sisa/hari</div><div class="val ' +
      (wt.sisaPerHari > 0 ? 'val-emerald' : 'val-coral') + '">' +
      (wt.hariTersisa > 0 ? rupiah(wt.sisaPerHari) : '—') + '</div>' +
      '<div class="sub">' + (wt.hariTersisa > 0 ? 'untuk ' + wt.hariTersisa + ' hari' : '') + '</div></div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">⚙️</span> Ubah Target</div>' +
    '<div class="kv"><span class="k">Minggu ini</span><span class="v">' + rupiah(wt.target) +
      (hasOverride ? ' <span class="badge info">Custom</span>' : ' <span class="badge">Default</span>') + '</span></div>' +
    '<div class="kv"><span class="k">Default</span><span class="v">' + rupiah(getWeeklyTarget(null)) + '</span></div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="edit-weekly-target">✏️ Ubah Minggu Ini</button>' +
      (hasOverride ? '<button class="btn btn-sm" data-act="reset-weekly-target">↩️ Reset</button>' : '') +
      '<button class="btn btn-sm" data-act="set-default-weekly-target">📌 Set Default</button>' +
    '</div>' +
  '</div>';

  html += '<div class="card">' +
    '<div class="card-title"><span class="ic">📚</span> Riwayat 4 Minggu</div>';

  for (var w = 0; w < 4; w++) {
    var startW = isoOf(new Date(parseISO(wk[0]).getTime() - w * 7 * 86400000));
    var endW = isoOf(new Date(parseISO(wk[1]).getTime() - w * 7 * 86400000));
    var h = computeWeeklyTarget(startW, endW);
    var isOverW = h.status === 'over';
    var lblW = w === 0 ? 'Minggu Ini' : (w === 1 ? 'Minggu Lalu' : (w + 1) + ' Minggu Lalu');

    html += '<div class="wt-hist-row' + (w === 0 ? ' now' : '') + (isOverW ? ' over' : '') + '">' +
      '<div class="wt-hist-info">' +
        '<div class="wt-hist-lbl">' + lblW + '</div>' +
        '<div class="wt-hist-date">' + fmtTanggalPendek(startW) + ' – ' + fmtTanggalPendek(endW) + '</div>' +
        '<div class="wt-hist-bar"><i style="width:' + Math.min(100, h.pct).toFixed(1) + '%"></i></div>' +
      '</div>' +
      '<div class="wt-hist-val">' +
        '<div class="pct">' + h.pct.toFixed(0) + '%</div>' +
        '<div class="sub">' + (isOverW ? 'Over' : 'Sisa ' + rupiah(h.sisa)) + '</div>' +
      '</div>' +
    '</div>';
  }

  html += '</div>';
  return html;
}

/* ============================================================
   BAGIAN 21 — RIWAYAT
   ============================================================ */

var filterHistory = { q: '', from: '', to: '', cat: '', type: '' };

function pageHistory(b) {
  var list = allTx().reverse();
  var allCats = EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES).filter(function (v, i, a) { return a.indexOf(v) === i; });

  list = list.filter(function (t) {
    if (filterHistory.type && t.type !== filterHistory.type) return false;
    if (filterHistory.q) {
      var q = filterHistory.q.toLowerCase();
      var hay = ((t.description || '') + ' ' + (t.source || '') + ' ' +
                 (t.category || '') + ' ' + (t.note || '') + ' ' + t.type).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (filterHistory.from && t.date < filterHistory.from) return false;
    if (filterHistory.to && t.date > filterHistory.to) return false;
    if (filterHistory.cat && t.category !== filterHistory.cat) return false;
    return true;
  });

  return '<div class="card">' +
    '<div class="card-title"><span class="ic">🔍</span> Filter</div>' +
    '<div class="filters">' +
      '<input type="search" id="fHistQ" placeholder="Cari..." value="' + esc(filterHistory.q) + '" />' +
      '<div class="row">' +
        '<input type="date" id="fHistFrom" value="' + esc(filterHistory.from) + '" />' +
        '<input type="date" id="fHistTo" value="' + esc(filterHistory.to) + '" />' +
      '</div>' +
      '<select id="fHistType">' +
        '<option value="">Semua jenis</option>' +
        '<option value="income"' + (filterHistory.type === 'income' ? ' selected' : '') + '>Pemasukan</option>' +
        '<option value="expense"' + (filterHistory.type === 'expense' ? ' selected' : '') + '>Pengeluaran</option>' +
        '<option value="transfer"' + (filterHistory.type === 'transfer' ? ' selected' : '') + '>Transfer</option>' +
        '<option value="goldBuy"' + (filterHistory.type === 'goldBuy' ? ' selected' : '') + '>Beli Emas</option>' +
        '<option value="goldSell"' + (filterHistory.type === 'goldSell' ? ' selected' : '') + '>Jual Emas</option>' +
      '</select>' +
      '<select id="fHistCat">' + optionList(allCats, filterHistory.cat, 'Semua kategori') + '</select>' +
      '<div class="btn-row">' +
        '<button class="btn btn-sm" data-act="reset-hist-filter">Reset</button>' +
        '<button class="btn btn-sm" data-act="export-csv">⬇️ CSV</button>' +
        '<button class="btn btn-sm" data-act="backup-json">💾 Backup</button>' +
        '<span class="pill">' + list.length + ' transaksi</span>' +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="card">' +
    '<div class="card-title"><span class="ic">🕘</span> Semua Transaksi</div>' +
    (list.length ? list.map(txRow).join('')
      : emptyState('📭', 'Tidak ada transaksi', 'Ubah filter atau catat transaksi baru.')) +
  '</div>';
}

function attachHistoryListeners() {
  var qh = $('#fHistQ'), fh = $('#fHistFrom'), th = $('#fHistTo'), ch = $('#fHistCat'), ty = $('#fHistType');
  function upd() {
    filterHistory.q = qh ? qh.value : '';
    filterHistory.from = fh ? fh.value : '';
    filterHistory.to = th ? th.value : '';
    filterHistory.cat = ch ? ch.value : '';
    filterHistory.type = ty ? ty.value : '';
    renderPage();
    var el = $('#fHistQ'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  }
  if (qh) qh.addEventListener('input', debounce(upd, 300));
  if (fh) fh.addEventListener('change', upd);
  if (th) th.addEventListener('change', upd);
  if (ch) ch.addEventListener('change', upd);
  if (ty) ty.addEventListener('change', upd);
}

/* ============================================================
   BAGIAN 22 — KALENDER
   ============================================================ */

var calCursor = null, calSel = null;
function mtShort(v) {
  v = Math.round(Number(v) || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (v >= 1000) return Math.round(v / 1000) + 'rb';
  return String(v);
}

function pageCalendar(b) {
  var today = todayISO();
  if (!calCursor) { var t0 = parseISO(today); calCursor = { y: t0.getFullYear(), m: t0.getMonth() }; }
  var y = calCursor.y, m = calCursor.m, key = y + '-' + pad2(m + 1);
  var last = new Date(y, m + 1, 0).getDate(), off = (new Date(y, m, 1).getDay() + 6) % 7;

  var map = {}, incM = 0, expM = 0;
  allTx().forEach(function (t) {
    if (monthKey(t.date) !== key) return;
    var d = map[t.date] || (map[t.date] = { inc: 0, sp: 0, need: 0, n: 0 }), a = Number(t.amount) || 0;
    d.n++;
    if (t.type === 'income') { d.inc += a; if (t.category !== 'Pinjaman Masuk') incM += a; }
    else if (t.type === 'expense') { expM += a; if (isNeedTx(t)) d.need += a; else d.sp += a; }
  });
  if (!calSel || monthKey(calSel) !== key) calSel = (monthKey(today) === key) ? today : key + '-01';

  var okDays = 0, doneDays = 0;
  var grid = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(function (d) { return '<div class="c2-dow">' + d + '</div>'; }).join('');
  for (var i = 0; i < off; i++) grid += '<div class="c2-day blank"></div>';
  for (var d = 1; d <= last; d++) {
    var iso = key + '-' + pad2(d), s = map[iso] || { inc: 0, sp: 0, need: 0, n: 0 }, bud = dailyBudgetFor(iso), lvl = 'e';
    if (iso > today) lvl = 'fut';
    else if (s.n) {
      var r = bud > 0 ? s.sp / bud : (s.sp > 0 ? 2 : 0);
      lvl = r <= 0.6 ? 'g' : r <= 1 ? 'y' : 'r';
      doneDays++; if (r <= 1) okDays++;
    }
    grid += '<div class="c2-day ' + lvl + (iso === today ? ' today' : '') + (iso === calSel ? ' sel' : '') + '" data-cal="' + iso +
      '" role="button" tabindex="0" style="--n:' + (off + d) + '"><b>' + d + '</b><small>' + (s.sp > 0 ? mtShort(s.sp) : '') + '</small>' +
      (s.inc > 0 ? '<i class="c2-in"></i>' : '') + (s.need > 0 ? '<i class="c2-nd"></i>' : '') + '</div>';
  }

  var chip = function (ic, k, v, cls) { return '<div class="mt-chip"><span class="k">' + ic + ' ' + k + '</span><span class="v ' + cls + '">' + v + '</span></div>'; };
  return '<div class="card c2-card">' +
    '<div class="c2-head"><button class="icon-btn" data-act="cal-prev" aria-label="Bulan sebelumnya">‹</button>' +
      '<div class="c2-title"><b>' + BULAN[m] + '</b><span>' + y + '</span></div>' +
      '<button class="icon-btn" data-act="cal-next" aria-label="Bulan berikutnya">›</button></div>' +
    (monthKey(today) !== key ? '<div style="text-align:center;margin:-4px 0 12px"><button class="btn btn-sm" data-act="cal-today">↩ Ke hari ini</button></div>' : '') +
    '<div class="c2-sum">' + chip('💵', 'Masuk', rupiah(incM), 'val-emerald') + chip('💸', 'Keluar', rupiah(expM), 'val-coral') +
      chip(incM >= expM ? '📈' : '📉', 'Selisih', rupiah(incM - expM), incM >= expM ? 'val-emerald' : 'val-coral') + '</div>' +
    '<div class="c2-grid">' + grid + '</div>' +
    '<div class="c2-leg"><span><i style="background:rgba(53,211,154,.55)"></i>Hemat</span><span><i style="background:rgba(232,199,106,.7)"></i>Hampir</span>' +
      '<span><i style="background:rgba(255,107,120,.7)"></i>Lewat</span><span><i style="background:var(--emerald);border-radius:50%"></i>Masuk</span>' +
      '<span><i style="background:var(--cyan);border-radius:50%"></i>Kebutuhan</span></div>' +
    (doneDays ? '<div class="c2-note">✨ <b>' + okDays + ' dari ' + doneDays + '</b> hari tercatat masih di bawah anggaran jajan.</div>' : '') +
  '</div>' +
  '<div class="card" id="calDetail">' + calDetailHTML(calSel) + '</div>';
}

function calDetailHTML(iso) {
  var list = allTx().filter(function (t) { return t.date === iso; });
  var bud = dailyBudgetFor(iso), sp = sumBudgetOn(iso), inc = sumIncomeOn(iso), left = bud - sp;
  var pct = bud > 0 ? Math.min(100, sp / bud * 100) : (sp > 0 ? 100 : 0);
  return '<div class="c2-dhead"><div><div class="mt-eyebrow">' + HARI[parseISO(iso).getDay()] + '</div>' +
      '<div class="c2-dtitle">' + esc(fmtTanggal(iso)) + '</div></div>' +
    '<div class="c2-dpill ' + (left < 0 ? 'r' : 'g') + '">' + (bud > 0 ? (left < 0 ? 'Lewat ' + rupiah(-left) : 'Sisa ' + rupiah(left)) : 'Tanpa batas') + '</div></div>' +
    '<div class="mt-bar"><i style="width:' + pct.toFixed(0) + '%;background:' + (left < 0 ? 'var(--coral)' : pct > 75 ? 'var(--gold)' : 'var(--emerald)') + '"></i></div>' +
    '<div class="c2-dstats"><span>🍜 Jajan <b>' + rupiah(sp) + '</b> / ' + rupiah(bud) + '</span><span>💵 Masuk <b>' + rupiah(inc) + '</b></span></div>' +
    needNote(iso) + '<div class="divider"></div>' +
    (list.length ? list.map(txRow).join('') : '<div class="help">Belum ada transaksi di tanggal ini.</div>') +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-sm btn-danger" data-act="add-expense">+ Pengeluaran</button>' +
    '<button class="btn btn-sm" data-act="add-income">+ Pemasukan</button></div>';
}

function showCalendarDetail(iso) {
  calSel = iso;
  var box = $('#calDetail');
  if (!box) return;
  box.innerHTML = calDetailHTML(iso);
  var cells = document.querySelectorAll('.c2-day[data-cal]');
  for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('sel', cells[i].dataset.cal === iso);
  try { if (box.animate && !mtReducedMotion()) box.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' }); } catch (e) {}
}

/* ============================================================
   BAGIAN 23 — STATISTIK
   ============================================================ */

var statsRange = '30';
var ST_COLORS = ['#35D39A', '#65D8F2', '#8B7BFF', '#E8C76A', '#FF6B78', '#7C8AA5'];

function mtDonut(items, total) {
  var r = 38, c = 2 * Math.PI * r, off = 0, segs = '';
  items.forEach(function (it) {
    var len = total > 0 ? it.value / total * c : 0, vis = Math.max(0, len - 1.6);
    segs += '<circle class="dn" cx="50" cy="50" r="38" fill="none" stroke="' + it.color + '" stroke-width="12" stroke-dasharray="' + vis.toFixed(2) + ' ' + (c - vis).toFixed(2) +
      '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 50 50)"/>';
    off += len;
  });
  return '<svg class="st-donut" viewBox="0 0 100 100" role="img" aria-label="Komposisi pengeluaran"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--glass2)" stroke-width="12"/>' + segs +
    '<text x="50" y="47" text-anchor="middle" class="dn-k">Total</text><text x="50" y="60" text-anchor="middle" class="dn-v">' + mtShort(total) + '</text></svg>';
}

function mtArea(vals, color, budgetLine) {
  var W = 300, H = 100, n = vals.length, pts = [];
  var sv = vals.slice().sort(function (x, y) { return x - y; }), p90 = sv[Math.floor(sv.length * 0.9)] || 0;
  var mx = Math.max(p90 * 1.8, (budgetLine || 0) * 1.5, 1);   /* lonjakan ekstrem dipotong supaya tren lain tetap terbaca */
  vals.forEach(function (v, i) { pts.push([n === 1 ? W / 2 : i * W / (n - 1), H - 6 - Math.min(v, mx) / mx * (H - 14)]); });
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var by = budgetLine ? H - 6 - budgetLine / mx * (H - 14) : null;
  return '<svg class="st-area" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Tren pengeluaran"><defs><linearGradient id="stg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + color + '" stop-opacity=".38"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#stg)"/>' +
    '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
    (by !== null ? '<line x1="0" x2="' + W + '" y1="' + by.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="#E8C76A" stroke-width="1.2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>' : '') + '</svg>';
}

function pageStats(b) {
  var today = todayISO(), T = parseISO(today);
  var days = statsRange === '7' ? 7 : statsRange === '90' ? 90 : 30;
  var from = isoOf(new Date(T.getFullYear(), T.getMonth(), T.getDate() - days + 1));
  var inc = 0, exp = 0, saved = 0, cat = {}, byDay = {};
  allTx().forEach(function (t) {
    if (t.date < from || t.date > today) return;
    var a = Number(t.amount) || 0;
    if (t.type === 'income') { if (t.category !== 'Pinjaman Masuk') inc += a; }
    else if (t.type === 'expense') { exp += a; byDay[t.date] = (byDay[t.date] || 0) + a; var c = t.category || 'Lainnya'; cat[c] = (cat[c] || 0) + a; }
    else if (t.type === 'transfer' && t.from === 'main' && (t.to === 'emergency' || t.to === 'savings')) saved += a;
    else if (t.type === 'goldBuy') saved += a;
  });

  var vals = [], wd = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0], peak = 0, peakIso = from;
  for (var i = 0; i < days; i++) {
    var di = isoOf(new Date(T.getFullYear(), T.getMonth(), T.getDate() - days + 1 + i)), v = byDay[di] || 0, g = parseISO(di).getDay();
    vals.push(v); wd[g] += v; wdN[g]++;
    if (v > peak) { peak = v; peakIso = di; }
  }
  var net = inc - exp, rate = inc > 0 ? Math.max(0, Math.min(999, Math.round(saved / inc * 100))) : 0;

  /* ----- donut kategori ----- */
  var keys = Object.keys(cat).sort(function (x, y) { return cat[y] - cat[x]; }), items = [];
  keys.slice(0, 5).forEach(function (k, i) { items.push({ name: k, value: cat[k], color: ST_COLORS[i] }); });
  if (keys.length > 5) items.push({ name: 'Lainnya', value: keys.slice(5).reduce(function (s, k) { return s + cat[k]; }, 0), color: ST_COLORS[5] });

  /* ----- pola hari ----- */
  var order = [1, 2, 3, 4, 5, 6, 0], names = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  var avgs = order.map(function (g) { return wdN[g] ? wd[g] / wdN[g] : 0; }), mxA = Math.max.apply(null, avgs.concat([1])), topI = avgs.indexOf(Math.max.apply(null, avgs));

  /* ----- arus kas 6 bulan ----- */
  var months = [];
  for (var k = 5; k >= 0; k--) {
    var d0 = new Date(T.getFullYear(), T.getMonth() - k, 1), a0 = d0.getFullYear() + '-' + pad2(d0.getMonth() + 1) + '-01', z0 = isoOf(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
    months.push({ label: BULAN[d0.getMonth()].slice(0, 3), inc: sumIncomeRange(a0, z0), exp: sumExpenseRange(a0, z0) });
  }
  var mxM = Math.max.apply(null, months.reduce(function (r, m) { return r.concat([m.inc, m.exp]); }, [1]));

  /* ----- distribusi dana ----- */
  var dist = [['Saldo Bebas', Math.max(0, b.saldoBebas), '#35D39A'], ['Uang Jajan', b.snackTotal, '#E8C76A'], ['Dana Darurat', b.emergency, '#65D8F2'],
              ['Tabungan', b.savings, '#8B7BFF'], ['Dana eMas', b.goldFund, '#FFB36B']];
  var dTot = dist.reduce(function (s, x) { return s + x[1]; }, 0) || 1;

  var seg = function (id, label) { return '<button class="' + (statsRange === id ? 'on' : '') + '" data-act="stats-range" data-id="' + id + '">' + label + '</button>'; };
  var html = '<div class="st-seg">' + seg('7', '7 Hari') + seg('30', '30 Hari') + seg('90', '90 Hari') + '</div>' +
    '<div class="grid grid-2" style="margin-bottom:14px">' +
      statCard('Pemasukan', rupiah(inc), '💵', 'val-emerald', 'rata-rata ' + rupiah(inc / days) + '/hari') +
      statCard('Pengeluaran', rupiah(exp), '💸', 'val-coral', 'rata-rata ' + rupiah(exp / days) + '/hari') +
      statCard('Selisih', rupiah(net), net >= 0 ? '📈' : '📉', net >= 0 ? 'val-emerald' : 'val-coral', net >= 0 ? 'Surplus' : 'Defisit') +
      statCard('Rasio Menabung', rate + '%', '🐖', rate >= 20 ? 'val-emerald' : 'val-gold', 'target ideal 20%') +
    '</div>';

  html += '<div class="card"><div class="card-title"><span class="ic">🍩</span> Ke Mana Uangmu Pergi</div>' +
    (items.length ? '<div class="st-donut-wrap">' + mtDonut(items, exp) + '<div class="st-leg">' + items.map(function (it) {
      return '<div><i style="background:' + it.color + '"></i><span>' + esc(it.name) + '</span><b>' + Math.round(it.value / exp * 100) + '%</b></div>';
    }).join('') + '</div></div>' : emptyState('🍩', 'Belum ada pengeluaran', 'Catat pengeluaran untuk lihat komposisinya.')) + '</div>';

  html += '<div class="card"><div class="card-title"><span class="ic">📈</span> Tren Harian</div>' +
    mtArea(vals, '#FF6B78', dailyBudgetFor(today)) +
    '<div class="st-cap"><span>Rata-rata <b>' + rupiah(exp / days) + '</b></span><span>Tertinggi <b>' + rupiah(peak) + '</b>' + (peak ? ' • ' + fmtTanggalPendek(peakIso) : '') + '</span></div>' +
    '<div class="st-cap" style="margin-top:2px"><span style="color:var(--gold)">- - -</span><span>garis emas = batas anggaran hari ini</span></div></div>';

  html += '<div class="card"><div class="card-title"><span class="ic">📅</span> Hari Paling Boros</div><div class="st-wd">' +
    avgs.map(function (a, i) { return '<div class="st-wd-i' + (i === topI && a > 0 ? ' top' : '') + '"><i style="--h:' + Math.max(4, a / mxA * 100).toFixed(0) + '%;animation-delay:' + (i * 50) + 'ms"></i><span>' + names[i] + '</span></div>'; }).join('') +
    '</div><div class="st-cap"><span>' + (avgs[topI] > 0 ? 'Biasanya paling boros hari <b>' + HARI[order[topI]] + '</b> (±' + rupiah(avgs[topI]) + ')' : 'Belum ada data pengeluaran.') + '</span></div></div>';

  html += '<div class="card"><div class="card-title"><span class="ic">💱</span> Arus Kas 6 Bulan <span class="badge info">hijau masuk • merah keluar</span></div><div class="st-pair">' +
    months.map(function (m, i) {
      return '<div><div class="bars"><i style="--h:' + Math.max(3, m.inc / mxM * 100).toFixed(0) + '%;background:#35D39A;animation-delay:' + (i * 60) + 'ms"></i>' +
        '<i style="--h:' + Math.max(3, m.exp / mxM * 100).toFixed(0) + '%;background:#FF6B78;animation-delay:' + (i * 60 + 30) + 'ms"></i></div><span>' + m.label + '</span></div>';
    }).join('') + '</div></div>';

  html += '<div class="card"><div class="card-title"><span class="ic">🧊</span> Peta Uangmu <span class="card-sub">' + rupiah(b.totalMoney) + '</span></div>' +
    '<div class="st-stack">' + dist.map(function (x) { return x[1] > 0 ? '<i style="width:' + (x[1] / dTot * 100).toFixed(1) + '%;background:' + x[2] + '"></i>' : ''; }).join('') + '</div>' +
    '<div class="st-leg">' + dist.map(function (x) { return '<div><i style="background:' + x[2] + '"></i><span>' + x[0] + '</span><b>' + rupiah(x[1]) + '</b></div>'; }).join('') + '</div></div>';

  html += '<div class="card"><div class="card-title"><span class="ic">📤</span> Ekspor & Backup</div><div class="btn-row">' +
    '<button class="btn btn-sm" data-act="export-csv">⬇️ CSV</button><button class="btn btn-sm" data-act="backup-json">💾 Backup</button>' +
    '<button class="btn btn-sm" data-act="restore-json">📥 Restore</button></div></div>';
  return html;
}

function distRow(label, value, pct, color) {
  return '<div style="margin-bottom:10px">' +
    '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">' +
      '<span style="color:var(--muted)">' + esc(label) + '</span>' +
      '<span style="font-weight:600">' + rupiah(value) + ' • ' + pct.toFixed(1) + '%</span>' +
    '</div>' +
    '<div class="progress"><i style="width:' + pct.toFixed(1) + '%;background:' + color + '"></i></div>' +
  '</div>';
}

/* ============================================================
   BAGIAN 24 — PENGATURAN
   ============================================================ */

function pageSettings(b) {
  var s = state.settings;
  var r = state.reconciliation;
  var audio = s.audio || { clickEnabled: true, musicEnabled: false, volume: 0.5 };

  return '<div class="card">' +
    '<div class="card-title"><span class="ic">🔊</span> Suara & Musik</div>' +
    '<div class="audio-row">' +
      '<div><div class="lbl">Suara interaktif</div>' +
      '<div class="sub">Efek suara tiap aksi</div></div>' +
      '<div class="mt-switch' + (audio.clickEnabled ? ' on' : '') + '" id="setClickToggle"></div>' +
    '</div>' +
    '<div class="audio-row">' +
      '<div><div class="lbl">Musik latar</div><div class="sub">Ambient lembut</div></div>' +
      '<div class="mt-switch' + (audio.musicEnabled ? ' on' : '') + '" id="setMusicToggle"></div>' +
    '</div>' +
    '<div style="margin-top:14px">' +
      '<div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:4px">Volume</div>' +
      '<input type="range" min="0" max="100" value="' + Math.round((audio.volume || 0.5) * 100) +
        '" class="audio-slider" id="setAudioVolume" />' +
      '<div class="audio-slider-value" id="setAudioVolumeVal">' +
        Math.round((audio.volume || 0.5) * 100) + '%</div>' +
    '</div>' +
    '<div class="audio-cat-label">Pratinjau</div>' +
    '<div class="sound-preview-grid">' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="tap"><span class="em">👆</span> Klik</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="nav"><span class="em">🧭</span> Navigasi</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="success"><span class="em">✅</span> Berhasil</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="error"><span class="em">❌</span> Gagal</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="coin"><span class="em">🪙</span> Uang Masuk</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="cash"><span class="em">💸</span> Uang Keluar</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="transfer"><span class="em">🔄</span> Transfer</button>' +
      '<button class="sound-preview" data-act="preview-sound" data-sound="del"><span class="em">🗑️</span> Hapus</button>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
  '<div class="card-title"><span class="ic">🎨</span> Tampilan</div>' +
  '<div class="field"><label>Tema</label>' +
    '<select id="setTheme">' +
  '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>🌙 Gelap</option>' +
  '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>☀️ Terang</option>' +
  '<option value="pink"' + (s.theme === 'pink' ? ' selected' : '') + '>🌸 Pink Cozy</option>' +
  '<option value="ocean"' + (s.theme === 'ocean' ? ' selected' : '') + '>🌊 Ocean Breeze</option>' +
  '<option value="sunset"' + (s.theme === 'sunset' ? ' selected' : '') + '>🌅 Sunset Glow</option>' +
  '<option value="forest"' + (s.theme === 'forest' ? ' selected' : '') + '>🌲 Forest Green</option>' +
  '<option value="cyber"' + (s.theme === 'cyber' ? ' selected' : '') + '>⚡ Cyber Neon</option>' +
  '<option value="coffee"' + (s.theme === 'coffee' ? ' selected' : '') + '>☕ Coffee Latte</option>' +
'</select>' +
  '</div>' +
'</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">💵</span> Uang Jajan & Anggaran</div>' +
    '<div class="field"><label>Uang jajan per hari sekolah</label>' +
      '<input type="number" id="setDaily" min="0" step="1000" value="' + Number(s.dailyBudget || 0) + '" />' +
      '<div class="help">Default: Rp25.000 per hari sekolah.</div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Sabtu</label>' +
        '<input type="number" id="setSat" min="0" step="1000" value="' + Number(s.saturdayBudget || 0) + '" /></div>' +
      '<div class="field"><label>Minggu</label>' +
        '<input type="number" id="setSun" min="0" step="1000" value="' + Number(s.sundayBudget || 0) + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Target mingguan (default)</label>' +
      '<input type="number" id="setWeeklyTarget" min="0" step="1000" value="' + getWeeklyTarget(null) + '" />' +
      '<div class="help">Batas pengeluaran 7 hari.</div>' +
    '</div>' +
    '<label class="check"><input type="checkbox" id="setReminder"' + (s.reminder ? ' checked' : '') +
      ' /> Pengingat catat uang jajan</label>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-act="save-settings">Simpan</button>' +
    '</div>' +
  '</div>' +

'<div class="card" style="border-color:rgba(53,211,154,.4)">' +
  '<div class="card-title"><span class="ic">⚙️</span> Setup Saldo Awal</div>' +
  '<div class="help">Ubah semua saldo awal (uang tunai, DANA, uang jajan, DD, dll) langsung dari sini. ' +
  'Perhitungan otomatis disesuaikan.</div>' +
  '<div class="btn-row" style="margin-top:12px">' +
    '<button class="btn btn-primary btn-sm" data-act="setup-initial">⚙️ Buka Setup Saldo Awal</button>' +
  '</div>' +
'</div>' +

'<div class="card">' +
  '<div class="card-title"><span class="ic">📤</span> Data</div>' +
  '<div class="btn-row">' +
    '<button class="btn btn-sm" data-act="export-csv">⬇️ CSV</button>' +
    '<button class="btn btn-sm" data-act="backup-json">💾 Backup</button>' +
    '<button class="btn btn-sm" data-act="restore-json">📥 Restore</button>' +
    '<button class="btn btn-sm btn-danger" data-act="reset-all">🗑️ Hapus Transaksi</button>' +
  '</div>' +
'</div>' +

  '<div class="card">' +
    '<div class="card-title"><span class="ic">ℹ️</span> Tentang</div>' +
    '<div class="kv"><span class="k">Versi</span><span class="v">2.0</span></div>' +
    '<div class="kv"><span class="k">Snapshot</span><span class="v">' + esc(fmtTanggal(SNAPSHOT_DATE)) + '</span></div>' +
    '<div class="kv"><span class="k">Zona waktu</span><span class="v">Asia/Jakarta</span></div>' +
    '<div class="kv"><span class="k">Storage</span><span class="v">' + (storageOK ? 'OK' : 'N/A') + '</span></div>' +
    '<div class="help" style="margin-top:10px">100% offline. Tidak ada data yang dikirim ke server.</div>' +
  '</div>';
}

function attachSettingsListeners() {
  var t = $('#setTheme');
  if (t) t.addEventListener('change', function () {
    state.settings.theme = t.value;
    applyTheme();
    saveState();
    var tLabel = t.value === 'light' ? 'Terang' : 
             t.value === 'pink' ? 'Pink Cozy' :
             t.value === 'ocean' ? 'Ocean Breeze' :
             t.value === 'sunset' ? 'Sunset Glow' :
             t.value === 'forest' ? 'Forest Green' :
             t.value === 'cyber' ? 'Cyber Neon' :
             t.value === 'coffee' ? 'Coffee Latte' : 'Gelap';
toast('Tema: ' + tLabel, 'ok');
  });

  var ct = $('#setClickToggle');
  if (ct) ct.addEventListener('click', function () {
    var cfg = mtAudioSettings();
    cfg.clickEnabled = !cfg.clickEnabled;
    ct.classList.toggle('on', cfg.clickEnabled);
    saveState();
    if (cfg.clickEnabled) mtPlay('toggleOn');
    toast(cfg.clickEnabled ? 'Suara aktif.' : 'Suara mati.', 'ok');
  });

  var mt = $('#setMusicToggle');
  if (mt) mt.addEventListener('click', function () {
    var cfg = mtAudioSettings();
    cfg.musicEnabled = !cfg.musicEnabled;
    mt.classList.toggle('on', cfg.musicEnabled);
    saveState();
    if (cfg.musicEnabled) { mtMusicStart(); mtPlay('success'); toast('Musik nyala.', 'ok'); }
    else { mtMusicStop(); mtPlay('close_modal'); toast('Musik mati.', 'ok'); }
  });

  var vs = $('#setAudioVolume');
  var vl = $('#setAudioVolumeVal');
  if (vs) {
    vs.addEventListener('input', function () {
      var cfg = mtAudioSettings();
      var v = parseInt(vs.value, 10) / 100;
      cfg.volume = v;
      if (vl) vl.textContent = Math.round(v * 100) + '%';
      mtMusicUpdateVolume();
    });
    vs.addEventListener('change', function () { saveState(); mtPlay('tap'); });
  }
}

/* ============================================================
   BAGIAN 25 — MODAL
   ============================================================ */

function openModal(title, body, foot, onMount) {
  var root = $('#modalRoot');
  if (!root) return;
  root.innerHTML =
    '<div class="modal-backdrop" data-close="1">' +
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<h3>' + title + '</h3>' +
          '<button class="icon-btn" data-close="1" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div class="modal-body">' + body + '</div>' +
        (foot ? '<div class="modal-foot">' + foot + '</div>' : '') +
      '</div>' +
    '</div>';
  root.classList.add('open');
  document.body.classList.add('modal-open');

  $$('[data-close]', root).forEach(function (el) {
    el.addEventListener('click', function (ev) {
      if (ev.target === el) closeModal();
    });
  });

  if (onMount) onMount(root);
}

function closeModal() {
  var root = $('#modalRoot');
  if (!root) return;
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function confirmDialog(title, message, onYes) {
  openModal(esc(title),
    '<p style="font-size:13.5px;color:var(--text);margin:0 0 6px">' + message + '</p>',
    '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-danger" id="cfmYes">Ya, lanjutkan</button>',
    function (root) {
      $('#cfmYes', root).addEventListener('click', function () {
        closeModal();
        onYes();
      });
    });
}

/* ============================================================
   BAGIAN 26 — FORM: PEMASUKAN
   ============================================================ */

/* ============================================================
   TOMBOL NOMINAL CEPAT
   ============================================================ */

function quickAmountButtons(targetId, amounts) {
  amounts = amounts || [5000, 10000, 15000, 20000, 25000, 50000, 100000];
  return '<div class="quick-amounts">' +
    amounts.map(function (v) {
      return '<button type="button" data-quickamt="' + v + '" data-quicktarget="' + targetId + '">Rp' + angka(v) + '</button>';
    }).join('') +
    '<button type="button" class="qa-clear" data-quickamt="0" data-quicktarget="' + targetId + '">🗑️ Hapus Nominal</button>' +
  '</div>';
}
  
function openIncomeForm(existing, preset) {
  preset = preset || {};
  var isEdit = !!existing;
  var t = existing || {
    date: todayISO(), time: nowTime(),
    source: preset.source || '',
    category: preset.category || 'Uang Jajan',
    amount: preset.amount || '',
    method: 'cash', account: 'cash', note: '',
    isSnackAllowance: !!preset.isSnackAllowance,
    breakdown: {}
  };

  var body =
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + esc(t.date) + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="f_time" value="' + esc(t.time || nowTime()) + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Sumber</label><select id="f_source">' +
      optionList(INCOME_SOURCES, t.source, '— Pilih —') + '</select></div>' +
    '<div class="field"><label>Kategori</label><select id="f_category">' +
      optionList(INCOME_CATEGORIES, t.category, '— Pilih —') + '</select></div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
  quickAmountButtons('f_amount') +
  '<input type="number" id="f_amount" min="1" step="1" inputmode="numeric" value="' + (t.amount || '') + '" placeholder="25000" /></div>' +
    '<div class="field"><label>Masuk ke akun</label>' +
      '<select id="f_account">' + accountOptions(t.account || (t.method === 'cash' ? 'cash' : 'dana')) + '</select></div>' +
    '<input type="hidden" id="f_method" value="' + (t.method || 'cash') + '" />' +
    '<label class="check"><input type="checkbox" id="f_snack"' + (t.isSnackAllowance ? ' checked' : '') +
      ' /> Ini uang jajan</label>' +
    '<div class="field"><label>Catatan</label><textarea id="f_note">' + esc(t.note || '') + '</textarea></div>' +
    '<div class="help" id="f_info"></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="f_save">' + (isEdit ? 'Simpan' : 'Tambah') + '</button>';

  openModal(isEdit ? '✏️ Edit Pemasukan' : '💵 Tambah Pemasukan', body, foot, function (root) {
    var accountSel = $('#f_account', root);
    var methodHidden = $('#f_method', root);
    function sync() {
      methodHidden.value = accountSel.value === 'cash' ? 'cash' : 'noncash';
    }
    accountSel.addEventListener('change', sync);
    sync();

    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var time = $('#f_time', root).value || nowTime();
      var source = $('#f_source', root).value;
      var category = $('#f_category', root).value;
      var amount = parseInt($('#f_amount', root).value, 10);
      var account = accountSel.value;
      var method = methodHidden.value;
      var note = $('#f_note', root).value.trim();
      var isSnack = $('#f_snack', root).checked;

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!source) return toast('Sumber wajib.', 'err');
      if (!category) return toast('Kategori wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');

      var tx = {
        id: isEdit ? existing.id : uid(),
        type: 'income',
        date: date, time: time,
        source: source, category: category,
        amount: amount, account: account, method: method,
        note: note, isSnackAllowance: isSnack,
        breakdown: {},
        createdAt: isEdit ? existing.createdAt : nowStamp()
      };

      if (isEdit) {
        var idx = state.transactions.findIndex(function (x) { return x.id === existing.id; });
        if (idx >= 0) state.transactions[idx] = tx;
      } else {
        state.transactions.push(tx);
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay('coin');
      toast(isEdit ? 'Pemasukan diperbarui.' : 'Pemasukan ' + rupiah(amount) + ' tersimpan.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 27 — FORM: PENGELUARAN
   ============================================================ */

function openExpenseForm(existing, preset) {
  preset = preset || {};
  var isEdit = !!existing;
  var t = existing || {
    date: todayISO(), time: nowTime(),
    category: preset.category || 'Makanan',
    description: preset.description || '',
    amount: preset.amount || '',
    method: 'cash', account: 'cash', note: '',
    useSnack: !!preset.useSnack,
    breakdown: {},
    predictionId: preset.predictionId || null
  };

  var b = computeBalances();

  var body =
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + esc(t.date) + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="f_time" value="' + esc(t.time || nowTime()) + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Kategori</label><select id="f_category">' +
      optionList(EXPENSE_CATEGORIES, t.category, '— Pilih —') + '</select></div>' +
    '<div class="field"><label>Deskripsi</label>' +
      '<input type="text" id="f_desc" value="' + esc(t.description || '') + '" placeholder="Contoh: nasi ayam" /></div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
  quickAmountButtons('f_amount') +
  '<input type="number" id="f_amount" min="1" step="1" inputmode="numeric" value="' + (t.amount || '') + '" /></div>' +
    '<div class="field"><label>Bayar dari akun</label>' +
      '<select id="f_account">' + accountOptions(t.account || (t.method === 'cash' ? 'cash' : 'dana')) + '</select></div>' +
    '<input type="hidden" id="f_method" value="' + (t.method || 'cash') + '" />' +
    '<label class="check"><input type="checkbox" id="f_snack"' + (t.useSnack ? ' checked' : '') +
      ' /> Dibayar dari uang jajan</label>' +
    '<label class="check"><input type="checkbox" id="f_need"' + (isNeedTx(t) ? ' checked' : '') + ' /> Kebutuhan pokok (tidak memotong anggaran jajan harian)</label>' +
    '<div class="field"><label>Catatan</label><textarea id="f_note">' + esc(t.note || '') + '</textarea></div>' +
    '<div class="help" id="f_info">Saldo bebas: ' + rupiah(b.saldoBebas) + ' • Uang jajan: ' + rupiah(b.snackTotal) + '</div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-danger" id="f_save">' + (isEdit ? 'Simpan' : 'Tambah') + '</button>';

  openModal(isEdit ? '✏️ Edit Pengeluaran' : '💸 Tambah Pengeluaran', body, foot, function (root) {
    var accountSel = $('#f_account', root);
    var methodHidden = $('#f_method', root);
    function sync() {
      methodHidden.value = accountSel.value === 'cash' ? 'cash' : 'noncash';
    }
    accountSel.addEventListener('change', sync);
    sync();
    var needBox = $('#f_need', root), catSel = $('#f_category', root);
    catSel.addEventListener('change', function () { needBox.checked = NEED_CATEGORIES.indexOf(catSel.value) >= 0; });

    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var time = $('#f_time', root).value || nowTime();
      var category = $('#f_category', root).value;
      var desc = $('#f_desc', root).value.trim();
      var amount = parseInt($('#f_amount', root).value, 10);
      var account = accountSel.value;
      var method = methodHidden.value;
      var note = $('#f_note', root).value.trim();
      var useSnack = $('#f_snack', root).checked;
      var isNeed = $('#f_need', root).checked;

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!category) return toast('Kategori wajib.', 'err');
      if (!desc) return toast('Deskripsi wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');

      var bb = computeBalances();
      var mainAvail = bb.main;
      if (isEdit) mainAvail += Number(existing.amount) || 0;
      if (amount > mainAvail) {
        return toast('Uang likuid tidak cukup. Tersedia ' + rupiah(mainAvail) + '.', 'err');
      }

      var accAvail = (bb.accounts && bb.accounts[account] !== undefined) ? bb.accounts[account] : 0;
      if (isEdit && existing.account === account) accAvail += Number(existing.amount) || 0;
      if (amount > accAvail) {
        return toast('Saldo akun ' + getAccountName(account) + ' tidak cukup (tersedia ' +
          rupiah(accAvail) + ').', 'err');
      }

      if (useSnack) {
        var snackAvail = bb.snackTotal;
        if (isEdit && existing.useSnack) snackAvail += Number(existing.amount) || 0;
        if (amount > snackAvail) {
          toast('Melebihi sisa uang jajan. Tetap dicatat.', 'warn');
        }
      }

      var tx = {
        id: isEdit ? existing.id : uid(),
        type: 'expense',
        date: date, time: time,
        category: category, description: desc,
        amount: amount, account: account, method: method,
        note: note, useSnack: useSnack, isNeed: isNeed, breakdown: {},
        predictionId: t.predictionId || null, debtId: t.debtId || null,
        createdAt: isEdit ? existing.createdAt : nowStamp()
      };

      if (isEdit) {
        var idx = state.transactions.findIndex(function (x) { return x.id === existing.id; });
        if (idx >= 0) state.transactions[idx] = tx;
      } else {
        state.transactions.push(tx);
        if (tx.predictionId) {
          var p = state.predictions.filter(function (x) { return x.id === tx.predictionId; })[0];
          if (p) { p.status = 'realized'; p.txId = tx.id; }
        }
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay('cash');
      toast(isEdit ? 'Diperbarui.' : 'Pengeluaran ' + rupiah(amount) + ' tersimpan.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 28 — FORM: TRANSFER
   ============================================================ */

function openTransferForm(opts) {
  var isWithdraw = opts.direction === 'withdraw';
  var bucket = opts.bucket;
  var bucketLabel = opts.label;

  var b = computeBalances();
  var avail = isWithdraw ? (b[bucket] || 0) : b.saldoBebas;

  var body =
    '<div class="help" style="margin-bottom:10px">' +
      (isWithdraw
        ? 'Tarik dari <b>' + esc(bucketLabel) + '</b> ke saldo bebas. Tersedia: <b>' + rupiah(avail) + '</b>.'
        : 'Setor dari saldo bebas ke <b>' + esc(bucketLabel) + '</b>. Saldo bebas: <b>' + rupiah(avail) + '</b>.') +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + todayISO() + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="f_time" value="' + nowTime() + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
      '<input type="number" id="f_amount" min="1" step="1" inputmode="numeric" value="' + (opts.amount || '') + '" /></div>' +
    
    // FIX: Selalu tampilkan Sumber Akun dan Tujuan Akun
    '<div class="field"><label>' + (isWithdraw ? 'Ambil dari Akun (Asal)' : 'Sumber Akun (Ambil dari)') + '</label>' +
      '<select id="f_fromAccount">' + accountOptions('cash') + '</select></div>' +
    '<div class="field"><label>' + (isWithdraw ? 'Terima ke Akun (Tujuan)' : 'Tujuan Akun (Simpan ke)') + '</label>' +
      '<select id="f_toAccount">' + accountOptions('bni') + '</select></div>' +

    '<div class="field"><label>Catatan</label><input type="text" id="f_note" /></div>' +
    '<div class="help">Transfer internal tidak dihitung sebagai pemasukan/pengeluaran konsumsi.</div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="f_save">' + (isWithdraw ? 'Tarik' : 'Setor') + '</button>';

  openModal((isWithdraw ? '⬇️ Tarik dari ' : '⬆️ Setor ke ') + esc(bucketLabel), body, foot, function (root) {
    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var time = $('#f_time', root).value || nowTime();
      var amount = parseInt($('#f_amount', root).value, 10);
      var note = $('#f_note', root).value.trim();

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');

      var bb = computeBalances();
      if (isWithdraw) {
        if (amount > (bb[bucket] || 0)) return toast('Saldo tidak cukup.', 'err');
      } else {
        if (amount > bb.saldoBebas) return toast('Saldo bebas tidak cukup (' + rupiah(bb.saldoBebas) + ').', 'err');
      }

      var tx = {
        id: uid(),
        type: 'transfer',
        date: date, time: time,
        amount: amount,
        from: isWithdraw ? bucket : 'main',
        to: isWithdraw ? 'main' : bucket,
        method: 'noncash', note: note,
        createdAt: nowStamp()
      };
      
      // FIX: Tangkap kedua akun
      tx.fromAccount = $('#f_fromAccount', root).value;
      tx.toAccount = $('#f_toAccount', root).value;

      state.transactions.push(tx);
      saveState();
      closeModal();
      renderPage();
      mtPlay('transfer');
      toast((isWithdraw ? 'Penarikan ' : 'Setoran ') + rupiah(amount) + ' berhasil.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 29 — PINDAH MAIN ↔ SNACK
   ============================================================ */

function openSnackToMainForm(presetAmount) {
  var b = computeBalances();
  var snackCash = b.snackCash || 0;
  var snackNonCash = b.snackNonCash || 0;
  var totalSnack = snackCash + snackNonCash;

  if (totalSnack <= 0) {
    toast('Uang jajan kosong.', 'err');
    return;
  }

  var body =
    '<div class="help" style="margin-bottom:12px">Pindah dari <b>Uang Jajan</b> ke <b>Saldo Bebas</b>. ' +
      'Total uang <b>tidak berubah</b>.</div>' +
    '<div class="grid grid-2" style="gap:8px;margin-bottom:12px">' +
      '<div class="stat" style="padding:11px 12px"><div class="lbl">Tunai</div>' +
        '<div class="val val-gold" style="font-size:15px">' + rupiah(snackCash) + '</div></div>' +
      '<div class="stat" style="padding:11px 12px"><div class="lbl">Non-Tunai</div>' +
        '<div class="val val-gold" style="font-size:15px">' + rupiah(snackNonCash) + '</div></div>' +
    '</div>' +
    '<div class="field"><label>Sumber</label>' +
      '<select id="sm_from">' +
        '<option value="cash">💵 Tunai (' + rupiah(snackCash) + ')</option>' +
        '<option value="noncash">💳 Non-Tunai (' + rupiah(snackNonCash) + ')</option>' +
        '<option value="auto">⚖️ Otomatis</option>' +
      '</select></div>' +
    '<div class="field"><label>Nominal</label>' +
      '<input type="number" id="sm_amount" min="1" step="1" inputmode="numeric" value="' +
      (presetAmount || '') + '" /></div>' +
    '<div class="field"><label>Tanggal</label>' +
      '<input type="date" id="sm_date" value="' + todayISO() + '" /></div>' +
    '<div class="field"><label>Catatan</label><input type="text" id="sm_note" /></div>' +
    '<div class="field"><label>Setelah dipindah</label>' +
      '<div class="help" id="sm_preview">—</div></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="sm_save">Pindahkan</button>';

  openModal('⬆️ Pindah Uang Jajan → Saldo Bebas', body, foot, function (root) {
    var fromSel = $('#sm_from', root);
    var amtInput = $('#sm_amount', root);
    var preview = $('#sm_preview', root);

    function updatePreview() {
      var amt = parseInt(amtInput.value, 10) || 0;
      var from = fromSel.value;
      var avail = from === 'cash' ? snackCash :
                  from === 'noncash' ? snackNonCash : totalSnack;
      if (amt <= 0) { preview.className = 'help'; preview.innerHTML = '—'; return; }
      if (amt > avail) { preview.className = 'help err'; preview.innerHTML = '⚠ Melebihi (' + rupiah(avail) + ')'; return; }
      preview.className = 'help';
      preview.innerHTML = '🍜 Uang jajan: ' + rupiah(totalSnack) + ' → <b>' + rupiah(totalSnack - amt) + '</b><br>' +
        '✅ Saldo bebas: ' + rupiah(b.saldoBebas) + ' → <b>' + rupiah(b.saldoBebas + amt) + '</b><br>' +
        '<span style="opacity:.7">Total uang tetap: ' + rupiah(b.main + b.emergency + b.savings + b.goldFund) + '</span>';
    }
    amtInput.addEventListener('input', updatePreview);
    fromSel.addEventListener('change', updatePreview);
    updatePreview();

    $('#sm_save', root).addEventListener('click', function () {
      var amt = parseInt(amtInput.value, 10);
      var from = fromSel.value;
      var date = $('#sm_date', root).value;
      var note = $('#sm_note', root).value.trim();

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!amt || amt <= 0) return toast('Nominal > 0.', 'err');

      var avail = from === 'cash' ? snackCash :
                  from === 'noncash' ? snackNonCash : totalSnack;
      if (amt > avail) return toast('Nominal melebihi ' + rupiah(avail) + '.', 'err');

      if (from === 'auto') {
        var rem = amt;
        var fc = Math.min(snackCash, rem);
        var fn = rem - fc;
        if (fc > 0) state.transactions.push({
          id: uid(), type: 'transfer', date: date, time: nowTime(),
          amount: fc, from: 'snack_cash', to: 'main', method: 'cash',
          note: note || 'Pindah uang jajan → saldo bebas',
          createdAt: nowStamp()
        });
        if (fn > 0) state.transactions.push({
          id: uid(), type: 'transfer', date: date, time: nowTime(),
          amount: fn, from: 'snack_noncash', to: 'main', method: 'noncash',
          note: note || 'Pindah uang jajan → saldo bebas',
          createdAt: nowStamp()
        });
      } else {
        state.transactions.push({
          id: uid(), type: 'transfer', date: date, time: nowTime(),
          amount: amt,
          from: from === 'cash' ? 'snack_cash' : 'snack_noncash',
          to: 'main',
          method: from === 'cash' ? 'cash' : 'noncash',
          note: note || 'Pindah uang jajan → saldo bebas',
          createdAt: nowStamp()
        });
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay('transfer');
      toast('Berhasil pindah ' + rupiah(amt) + '.', 'ok');
    });
  });
}

function openMainToSnackForm(presetAmount) {
  var b = computeBalances();
  var mainFree = b.saldoBebas;
  var snackCash = b.snackCash || 0;
  var snackNonCash = b.snackNonCash || 0;

  if (mainFree <= 0) {
    toast('Saldo bebas kosong.', 'err');
    return;
  }

  var body =
    '<div class="help" style="margin-bottom:12px">Pindah dari <b>Saldo Bebas</b> ke <b>Uang Jajan</b>. ' +
      'Total uang <b>tidak berubah</b>.</div>' +
    '<div class="grid grid-2" style="gap:8px;margin-bottom:12px">' +
      '<div class="stat" style="padding:11px 12px"><div class="lbl">Saldo Bebas</div>' +
        '<div class="val val-emerald" style="font-size:15px">' + rupiah(mainFree) + '</div></div>' +
      '<div class="stat" style="padding:11px 12px"><div class="lbl">Uang Jajan</div>' +
        '<div class="val val-gold" style="font-size:15px">' + rupiah(snackCash + snackNonCash) + '</div></div>' +
    '</div>' +
    '<div class="field"><label>Tujuan</label>' +
      '<select id="ms_to">' +
        '<option value="cash">💵 Uang Jajan Tunai</option>' +
        '<option value="noncash">💳 Uang Jajan Non-Tunai</option>' +
      '</select></div>' +
    '<div class="field"><label>Nominal</label>' +
      '<input type="number" id="ms_amount" min="1" step="1" inputmode="numeric" value="' +
      (presetAmount || '') + '" /></div>' +
    '<div class="field"><label>Tanggal</label>' +
      '<input type="date" id="ms_date" value="' + todayISO() + '" /></div>' +
    '<div class="field"><label>Catatan</label><input type="text" id="ms_note" /></div>' +
    '<div class="field"><label>Setelah dipindah</label>' +
      '<div class="help" id="ms_preview">—</div></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="ms_save">Pindahkan</button>';

  openModal('⬇️ Pindah Saldo Bebas → Uang Jajan', body, foot, function (root) {
    var toSel = $('#ms_to', root);
    var amtInput = $('#ms_amount', root);
    var preview = $('#ms_preview', root);

    function updatePreview() {
      var amt = parseInt(amtInput.value, 10) || 0;
      if (amt <= 0) { preview.className = 'help'; preview.innerHTML = '—'; return; }
      if (amt > mainFree) { preview.className = 'help err'; preview.innerHTML = '⚠ Melebihi (' + rupiah(mainFree) + ')'; return; }
      preview.className = 'help';
      preview.innerHTML = '✅ Saldo bebas: ' + rupiah(mainFree) + ' → <b>' + rupiah(mainFree - amt) + '</b><br>' +
        '🍜 Uang jajan: ' + rupiah(snackCash + snackNonCash) + ' → <b>' + rupiah(snackCash + snackNonCash + amt) + '</b><br>' +
        '<span style="opacity:.7">Total uang tetap: ' + rupiah(b.main + b.emergency + b.savings + b.goldFund) + '</span>';
    }
    amtInput.addEventListener('input', updatePreview);
    toSel.addEventListener('change', updatePreview);
    updatePreview();

    $('#ms_save', root).addEventListener('click', function () {
      var amt = parseInt(amtInput.value, 10);
      var to = toSel.value;
      var date = $('#ms_date', root).value;
      var note = $('#ms_note', root).value.trim();

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!amt || amt <= 0) return toast('Nominal > 0.', 'err');
      if (amt > mainFree) return toast('Melebihi saldo bebas (' + rupiah(mainFree) + ').', 'err');

      state.transactions.push({
        id: uid(), type: 'transfer', date: date, time: nowTime(),
        amount: amt,
        from: 'main',
        to: to === 'cash' ? 'snack_cash' : 'snack_noncash',
        method: to === 'cash' ? 'cash' : 'noncash',
        note: note || 'Pindah saldo bebas → uang jajan',
        createdAt: nowStamp()
      });

      saveState();
      closeModal();
      renderPage();
      mtPlay('transfer');
      toast('Berhasil pindah ' + rupiah(amt) + ' ke uang jajan.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 30 — FORM: PREDIKSI
   ============================================================ */

function openPredictionForm(existing) {
  var isEdit = !!existing;
  var p = existing || {
    date: todayISO(), category: 'Makanan', description: '',
    amount: '', method: 'cash', status: 'planned'
  };

  var body =
    '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + esc(p.date) + '" /></div>' +
    '<div class="field"><label>Kategori</label><select id="f_category">' +
      optionList(EXPENSE_CATEGORIES, p.category, '— Pilih —') + '</select></div>' +
    '<div class="field"><label>Deskripsi</label>' +
      '<input type="text" id="f_desc" value="' + esc(p.description || '') + '" /></div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
      '<input type="number" id="f_amount" min="1" step="1" inputmode="numeric" value="' + (p.amount || '') + '" /></div>' +
    '<div class="field"><label>Metode</label>' +
      '<select id="f_method">' +
        '<option value="cash"' + (p.method === 'cash' ? ' selected' : '') + '>Tunai</option>' +
        '<option value="noncash"' + (p.method === 'noncash' ? ' selected' : '') + '>Non-tunai</option>' +
      '</select></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="f_save">' + (isEdit ? 'Simpan' : 'Tambah') + '</button>';

  openModal(isEdit ? '✏️ Edit Prediksi' : '🔮 Tambah Prediksi', body, foot, function (root) {
    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var category = $('#f_category', root).value;
      var desc = $('#f_desc', root).value.trim();
      var amount = parseInt($('#f_amount', root).value, 10);
      var method = $('#f_method', root).value;

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!category) return toast('Kategori wajib.', 'err');
      if (!desc) return toast('Deskripsi wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');

      if (isEdit) {
        var idx = state.predictions.findIndex(function (x) { return x.id === existing.id; });
        if (idx >= 0) {
          state.predictions[idx] = Object.assign({}, existing, {
            date: date, category: category, description: desc,
            amount: amount, method: method
          });
        }
      } else {
        state.predictions.push({
          id: uid(), date: date, category: category,
          description: desc, amount: amount, method: method,
          status: 'planned', txId: null, createdAt: nowStamp()
        });
      }

      saveState();
      closeModal();
      renderPage();
      toast(isEdit ? 'Prediksi diperbarui.' : 'Prediksi tersimpan.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 31 — FORM: EMAS
   ============================================================ */

function openGoldBuyForm() {
  var b = computeBalances();

  var body =
    '<div class="help" style="margin-bottom:10px">Dana eMas: <b>' + rupiah(b.goldFund) + '</b></div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + todayISO() + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="f_time" value="' + nowTime() + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Harga per gram</label>' +
      '<input type="number" id="f_price" min="0" step="1" inputmode="numeric" value="' +
      (Number(state.gold.pricePerGram) || '') + '" /></div>' +
    '<div class="field"><label>Berat emas (gram)</label>' +
      '<input type="number" id="f_grams" min="0" step="0.0001" inputmode="decimal" /></div>' +
    '<div class="field"><label>Total bayar</label>' +
      '<input type="number" id="f_amount" min="0" step="1" inputmode="numeric" /></div>' +
    '<div class="field"><label>Biaya</label>' +
      '<input type="number" id="f_fee" min="0" step="1" inputmode="numeric" value="0" /></div>' +
    '<div class="field"><label>Catatan</label><textarea id="f_note"></textarea></div>' +
    '<div class="help" id="f_info"></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-gold" id="f_save">Beli</button>';

  openModal('🪙 Beli Emas', body, foot, function (root) {
    function calc() {
      var pr = parseFloat($('#f_price', root).value) || 0;
      var gr = parseFloat($('#f_grams', root).value) || 0;
      var amt = parseInt($('#f_amount', root).value, 10);
      if ((!amt || isNaN(amt)) && pr > 0 && gr > 0) {
        $('#f_amount', root).value = Math.round(pr * gr);
      }
      var bb = computeBalances();
      var total = (parseInt($('#f_amount', root).value, 10) || 0) +
                  (parseInt($('#f_fee', root).value, 10) || 0);
      var info = $('#f_info', root);
      info.className = 'help' + (total > bb.goldFund ? ' err' : '');
      info.textContent = 'Total keluar: ' + rupiah(total) +
        ' • Dana eMas setelah: ' + rupiah(bb.goldFund - total);
    }
    ['f_price', 'f_grams', 'f_amount', 'f_fee'].forEach(function (id) {
      var el = $('#' + id, root);
      if (el) el.addEventListener('input', calc);
    });
    calc();

    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var time = $('#f_time', root).value || nowTime();
      var price = parseFloat($('#f_price', root).value) || 0;
      var grams = parseFloat($('#f_grams', root).value) || 0;
      var amount = parseInt($('#f_amount', root).value, 10);
      var fee = parseInt($('#f_fee', root).value, 10) || 0;
      var note = $('#f_note', root).value.trim();

      if (!date) return toast('Tanggal wajib.', 'err');
      if (price <= 0) return toast('Harga > 0.', 'err');
      if (grams <= 0) return toast('Berat > 0.', 'err');
      if (!amount || amount <= 0) return toast('Total > 0.', 'err');

      var bb = computeBalances();
      if (amount + fee > bb.goldFund) {
        return toast('Dana eMas tidak cukup (' + rupiah(bb.goldFund) + ').', 'err');
      }

      state.transactions.push({
        id: uid(), type: 'goldBuy', date: date, time: time,
        amount: amount, fee: fee, grams: grams, pricePerGram: price,
        note: note, createdAt: nowStamp()
      });

      state.gold.pricePerGram = price;
      state.gold.priceUpdatedAt = nowStamp();

      saveState();
      closeModal();
      renderPage();
      mtPlay('coin');
      toast('Beli emas ' + grams + ' gr tercatat.', 'ok');
    });
  });
}

function openGoldSellForm() {
  var b = computeBalances();

  var body =
    '<div class="help" style="margin-bottom:10px">Emas: <b>' + b.goldGrams + ' gram</b></div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="f_date" value="' + todayISO() + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="f_time" value="' + nowTime() + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Harga jual/gram</label>' +
      '<input type="number" id="f_price" min="0" step="1" inputmode="numeric" value="' +
      (Number(state.gold.pricePerGram) || '') + '" /></div>' +
    '<div class="field"><label>Berat dijual</label>' +
      '<input type="number" id="f_grams" min="0" step="0.0001" inputmode="decimal" /></div>' +
    '<div class="field"><label>Total diterima</label>' +
      '<input type="number" id="f_amount" min="0" step="1" inputmode="numeric" /></div>' +
    '<div class="field"><label>Biaya</label>' +
      '<input type="number" id="f_fee" min="0" step="1" inputmode="numeric" value="0" /></div>' +
    '<div class="field"><label>Catatan</label><textarea id="f_note"></textarea></div>' +
    '<div class="help" id="f_info"></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="f_save">Jual</button>';

  openModal('💱 Jual Emas', body, foot, function (root) {
    function calc() {
      var pr = parseFloat($('#f_price', root).value) || 0;
      var gr = parseFloat($('#f_grams', root).value) || 0;
      if (pr > 0 && gr > 0) {
        var cur = parseInt($('#f_amount', root).value, 10);
        if (!cur || isNaN(cur)) $('#f_amount', root).value = Math.round(pr * gr);
      }
      var bb = computeBalances();
      var gr2 = parseFloat($('#f_grams', root).value) || 0;
      var info = $('#f_info', root);
      info.className = 'help' + (gr2 > bb.goldGrams ? ' err' : '');
      info.textContent = gr2 > bb.goldGrams
        ? 'Melebihi kepemilikan (' + bb.goldGrams + ' gr).'
        : 'Sisa emas: ' + (bb.goldGrams - gr2).toFixed(4) + ' gr';
    }
    ['f_price', 'f_grams', 'f_amount', 'f_fee'].forEach(function (id) {
      var el = $('#' + id, root);
      if (el) el.addEventListener('input', calc);
    });
    calc();

    $('#f_save', root).addEventListener('click', function () {
      var date = $('#f_date', root).value;
      var time = $('#f_time', root).value || nowTime();
      var price = parseFloat($('#f_price', root).value) || 0;
      var grams = parseFloat($('#f_grams', root).value) || 0;
      var amount = parseInt($('#f_amount', root).value, 10);
      var fee = parseInt($('#f_fee', root).value, 10) || 0;
      var note = $('#f_note', root).value.trim();

      if (!date) return toast('Tanggal wajib.', 'err');
      if (grams <= 0) return toast('Berat > 0.', 'err');
      if (price <= 0) return toast('Harga > 0.', 'err');
      if (!amount || amount <= 0) return toast('Total > 0.', 'err');

      var bb = computeBalances();
      if (grams > bb.goldGrams) return toast('Melebihi kepemilikan.', 'err');

      state.transactions.push({
        id: uid(), type: 'goldSell', date: date, time: time,
        amount: amount, fee: fee, grams: grams, pricePerGram: price,
        note: note, createdAt: nowStamp()
      });

      state.gold.pricePerGram = price;
      state.gold.priceUpdatedAt = nowStamp();

      saveState();
      closeModal();
      renderPage();
      mtPlay('success');
      toast('Jual emas tercatat.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 32 — FORM: UTANG/PIUTANG (BARU)
   ============================================================ */

function openDebtForm(existing) {
  var isEdit = !!existing;
  var d = existing || {
    type: 'owed', person: '', amount: '',
    dueDate: '', note: '', paid: 0, status: 'active'
  };

  var body =
    '<div class="field"><label>Jenis</label>' +
      '<select id="d_type">' +
        '<option value="owed"' + (d.type === 'owed' ? ' selected' : '') + '>💳 Utang (kamu pinjam)</option>' +
        '<option value="receivable"' + (d.type === 'receivable' ? ' selected' : '') + '>🤝 Piutang (kamu pinjamkan)</option>' +
      '</select></div>' +
    '<div class="field"><label>Nama orang</label>' +
      '<input type="text" id="d_person" value="' + esc(d.person || '') + '" placeholder="Contoh: Pacar, Teman" /></div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
      '<input type="number" id="d_amount" min="1" step="1" inputmode="numeric" value="' + (d.amount || '') + '" /></div>' +
    '<div class="field"><label>Tempo (opsional)</label>' +
      '<input type="date" id="d_dueDate" value="' + esc(d.dueDate || '') + '" /></div>' +
    '<div class="field"><label>Catatan</label>' +
      '<input type="text" id="d_note" value="' + esc(d.note || '') + '" placeholder="Contoh: talangan charger" /></div>' +
    (isEdit ? '<div class="field"><label>Sudah dibayar (Rp)</label>' +
      '<input type="number" id="d_paid" min="0" step="1" inputmode="numeric" value="' + (d.paid || 0) + '" /></div>' : '');

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="d_save">' + (isEdit ? 'Simpan' : 'Tambah') + '</button>';

  openModal(isEdit ? '✏️ Edit Utang' : '🤝 Catat Utang/Piutang', body, foot, function (root) {
    $('#d_save', root).addEventListener('click', function () {
      var type = $('#d_type', root).value;
      var person = $('#d_person', root).value.trim();
      var amount = parseInt($('#d_amount', root).value, 10);
      var dueDate = $('#d_dueDate', root).value;
      var note = $('#d_note', root).value.trim();
      var paid = isEdit ? (parseInt($('#d_paid', root).value, 10) || 0) : 0;

      if (!person) return toast('Nama orang wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');

      var status = paid >= amount ? 'paid' : 'active';

      if (isEdit) {
        var idx = state.debts.findIndex(function (x) { return x.id === existing.id; });
        if (idx >= 0) {
          state.debts[idx] = Object.assign({}, existing, {
            type: type, person: person, amount: amount,
            dueDate: dueDate, note: note, paid: paid, status: status
          });
        }
      } else {
        state.debts.push({
          id: uid(), type: type, person: person, amount: amount,
          dueDate: dueDate, note: note, paid: 0, status: 'active',
          createdAt: nowStamp()
        });
      }

      saveState();
      closeModal();
      renderPage();
      toast(isEdit ? 'Diperbarui.' : 'Utang/piutang tercatat.', 'ok');
    });
  });
}

function openDebtPaymentForm(debt) {
  var sisa = Math.max(0, (Number(debt.amount) || 0) - (Number(debt.paid) || 0));
  if (sisa <= 0) { toast('Sudah lunas.', 'ok'); return; }

  var isOwed = debt.type === 'owed';
  var b = computeBalances();

  var body =
    '<div class="help" style="margin-bottom:12px">' +
      (isOwed
        ? 'Bayar utang ke <b>' + esc(debt.person) + '</b>. Sisa: <b>' + rupiah(sisa) + '</b>.<br>' +
          'Saldo bebas kamu: <b>' + rupiah(b.saldoBebas) + '</b>.'
        : 'Terima bayaran dari <b>' + esc(debt.person) + '</b>. Sisa: <b>' + rupiah(sisa) + '</b>.') +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="dp_date" value="' + todayISO() + '" /></div>' +
      '<div class="field"><label>Jam</label><input type="time" id="dp_time" value="' + nowTime() + '" /></div>' +
    '</div>' +
    '<div class="field"><label>Nominal (Rp)</label>' +
      '<input type="number" id="dp_amount" min="1" step="1" inputmode="numeric" value="' + sisa + '" /></div>' +
    (isOwed ? '<div class="field"><label>Bayar dari akun</label>' +
      '<select id="dp_account">' + accountOptions('cash') + '</select></div>' : '') +
    '<div class="field"><label>Catatan</label><input type="text" id="dp_note" /></div>' +
    '<div class="help">' + (isOwed
      ? 'Catat sebagai pengeluaran kategori <b>Bayar Utang</b>.'
      : 'Catat sebagai pemasukan kategori <b>Pinjaman Masuk</b>.') + '</div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="dp_save">' + (isOwed ? 'Bayar' : 'Terima') + '</button>';

  openModal(isOwed ? '💳 Bayar Utang' : '🤝 Terima Bayaran', body, foot, function (root) {
    $('#dp_save', root).addEventListener('click', function () {
      var date = $('#dp_date', root).value;
      var time = $('#dp_time', root).value || nowTime();
      var amount = parseInt($('#dp_amount', root).value, 10);
      var note = $('#dp_note', root).value.trim();
      var account = isOwed ? $('#dp_account', root).value : 'cash';

      if (!date) return toast('Tanggal wajib.', 'err');
      if (!amount || amount <= 0) return toast('Nominal > 0.', 'err');
      if (amount > sisa) return toast('Melebihi sisa (' + rupiah(sisa) + ').', 'err');

      var tx = isOwed
        ? {
            id: uid(), type: 'expense', date: date, time: time,
            category: 'Bayar Utang', debtId: debt.id,
            description: 'Bayar utang ke ' + debt.person,
            amount: amount, account: account, method: account === 'cash' ? 'cash' : 'noncash',
            note: note, useSnack: false, breakdown: {},
            createdAt: nowStamp()
          }
        : {
            id: uid(), type: 'income', date: date, time: time,
            category: 'Pinjaman Masuk', debtId: debt.id,
            source: debt.person,
            description: 'Terima bayaran dari ' + debt.person,
            amount: amount, account: account, method: 'cash',
            note: note, isSnackAllowance: false, breakdown: {},
            createdAt: nowStamp()
          };

      if (isOwed && amount > computeBalances().saldoBebas) {
        return toast('Saldo bebas tidak cukup.', 'err');
      }

      state.transactions.push(tx);

      // Update debt
      var idx = state.debts.findIndex(function (x) { return x.id === debt.id; });
      if (idx >= 0) {
        state.debts[idx].paid = (Number(state.debts[idx].paid) || 0) + amount;
        if (state.debts[idx].paid >= state.debts[idx].amount) {
          state.debts[idx].status = 'paid';
          state.debts[idx].paidDate = date;
        }
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay(isOwed ? 'cash' : 'coin');
      toast(isOwed ? 'Bayar utang ' + rupiah(amount) + ' tercatat.' : 'Terima ' + rupiah(amount) + '.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 33 — MODAL: PECAHAN TUNAI & AKUN
   ============================================================ */

function openCashBreakdownModal() {
  var accounts = computeAccountBalances();
  var cashBal = accounts['cash'] || 0;

  var rows = '';
  DENOMS.forEach(function (d) {
    var label = d >= 1000 ? ('Rp' + angka(d)) : ('Koin ' + d);
    rows += '<div class="denom-row">' +
      '<div class="lbl">' + label + '</div>' +
      '<input type="number" min="0" step="1" inputmode="numeric" id="cb_' + d + '" value="" placeholder="0" />' +
      '<div class="sum" id="cb_sum_' + d + '">Rp0</div>' +
    '</div>';
  });

  var body =
    '<div class="help" style="margin-bottom:10px">Masukkan jumlah lembar/koin yang kamu miliki. ' +
    'Total tunai seharusnya: <b>' + rupiah(cashBal) + '</b>.</div>' +
    rows +
    '<div class="denom-summary" id="cb_summary">' +
      '<span>Total</span><span class="v" id="cb_total">Rp0</span>' +
    '</div>' +
    '<div class="help" style="margin-top:10px" id="cb_diff"></div>';

  var foot = '<button class="btn" data-close="1">Tutup</button>' +
             '<button class="btn btn-primary" id="cb_apply">Sesuaikan Saldo</button>';

  openModal('📋 Hitung Pecahan Tunai', body, foot, function (root) {
    function update() {
      var total = 0;
      DENOMS.forEach(function (d) {
        var el = document.getElementById('cb_' + d);
        var v = parseInt(el.value, 10) || 0;
        if (v < 0) v = 0;
        var sum = document.getElementById('cb_sum_' + d);
        if (sum) sum.textContent = rupiah(v * d);
        total += v * d;
      });
      var totalEl = document.getElementById('cb_total');
      if (totalEl) totalEl.textContent = rupiah(total);
      var diff = total - cashBal;
      var diffEl = document.getElementById('cb_diff');
      var summary = document.getElementById('cb_summary');
      if (diff === 0) {
        summary.classList.remove('mismatch');
        if (diffEl) diffEl.innerHTML = '✔ Cocok dengan saldo tunai.';
      } else {
        summary.classList.add('mismatch');
        if (diffEl) diffEl.innerHTML = '⚠ Selisih <b>' + rupiah(diff) + '</b>. ' +
          'Klik Sesuaikan untuk mencatat penyesuaian.';
      }
    }
    DENOMS.forEach(function (d) {
      var el = document.getElementById('cb_' + d);
      if (el) el.addEventListener('input', update);
    });
    update();

    $('#cb_apply', root).addEventListener('click', function () {
      var newTotal = 0;
      DENOMS.forEach(function (d) {
        var el = document.getElementById('cb_' + d);
        var v = parseInt(el.value, 10) || 0;
        newTotal += v * d;
      });
      var diff = newTotal - cashBal;
      if (diff === 0) { toast('Sudah cocok.', 'ok'); closeModal(); return; }
      confirmDialog('Sesuaikan Saldo Tunai?',
        'Catat penyesuaian <b>' + rupiah(diff) + '</b> ' +
        (diff > 0 ? '(penambahan)' : '(pengurangan)') + ' agar saldo tunai cocok.',
        function () {
          state.transactions.push({
            id: uid(),
            type: diff > 0 ? 'income' : 'expense',
            date: todayISO(), time: nowTime(),
            category: 'Lainnya',
            source: diff > 0 ? 'Penyesuaian Kas' : null,
            description: 'Penyesuaian Kas Fisik',
            amount: Math.abs(diff),
            account: 'cash', method: 'cash',
            note: 'Dibuat dari Hitung Pecahan Tunai',
            breakdown: {}, createdAt: nowStamp()
          });
          saveState(); closeModal(); renderPage();
          toast('Penyesuaian ' + rupiah(Math.abs(diff)) + ' tercatat.', 'ok');
        });
    });
  });
}

function openManageAccountsModal() {
  var html = '';
  getAccounts().forEach(function (a) {
    var isCash = a.id === 'cash';
    html += '<div class="account-card">' +
      '<div class="account-ic">' + a.icon + '</div>' +
      '<div class="account-main">' +
        '<div class="account-name">' + esc(a.name) + '</div>' +
        '<div class="account-sub">' + esc(a.type) + '</div>' +
      '</div>' +
      (isCash ? '<span class="badge info">Wajib</span>'
              : '<button class="icon-btn" data-act="del-account" data-id="' + esc(a.id) + '">🗑️</button>') +
    '</div>';
  });

  html += '<div class="divider"></div>' +
    '<div class="field"><label>Nama akun baru</label>' +
      '<input type="text" id="acc_name" placeholder="Contoh: OVO" /></div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Ikon</label>' +
        '<input type="text" id="acc_icon" maxlength="2" value="💳" /></div>' +
      '<div class="field"><label>Jenis</label>' +
        '<select id="acc_type">' +
          '<option value="ewallet">E-wallet</option>' +
          '<option value="bank">Bank</option>' +
          '<option value="other">Lainnya</option>' +
        '</select></div>' +
    '</div>' +
    '<div class="btn-row"><button class="btn btn-primary btn-sm" id="acc_add">+ Tambah</button></div>';

  openModal('⚙️ Kelola Akun', html, '<button class="btn" data-close="1">Tutup</button>', function (root) {
    var addBtn = $('#acc_add', root);
    if (addBtn) addBtn.addEventListener('click', function () {
      var name = $('#acc_name', root).value.trim();
      var icon = $('#acc_icon', root).value.trim() || '💳';
      var type = $('#acc_type', root).value;
      if (!name) return toast('Nama wajib.', 'err');
      var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!id) id = 'acc_' + Date.now().toString(36);
      if (getAccountById(id)) return toast('Nama sudah ada.', 'err');
      state.accounts.push({ id: id, name: name, icon: icon, type: type });
      saveState(); closeModal(); openManageAccountsModal();
      toast('Akun "' + name + '" ditambahkan.', 'ok');
    });

    $$('[data-act="del-account"]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var accId = btn.dataset.id;
        var acc = getAccountById(accId);
        if (!acc) return;
        confirmDialog('Hapus Akun?',
          'Akun <b>' + esc(acc.name) + '</b> dihapus dari daftar. Transaksi lama tetap ada.',
          function () {
            state.accounts = state.accounts.filter(function (x) { return x.id !== accId; });
            saveState(); closeModal(); openManageAccountsModal();
            toast('Dihapus.', 'ok');
          });
      });
    });
  });
}

/* ============================================================
   BAGIAN 34 — REKONSILIASI
   ============================================================ */
/* ============================================================
   SETUP SALDO AWAL — Ubah semua saldo awal dari UI
   ============================================================ */

function openSetupInitialForm() {
  var cur = state.initial || INITIAL;
  var curAcc = state.initialAccounts || INITIAL_ACCOUNTS;

  var snackCash = Number(cur.snackCash) || 0;
  var snackNonCash = Number(cur.snackNonCash) || 0;
  var snackTotal = snackCash + snackNonCash;
  var saldoBebas = (Number(cur.main) || 0) - snackTotal;

  var accList = getAccounts();

  var body =
    '<div class="help" style="margin-bottom:14px">' +
      'Atur semua saldo awalmu di sini. Perhitungan <b>otomatis disesuaikan</b> dengan angka yang kamu isi.' +
    '</div>' +

    '<div class="section-title" style="margin-top:0">💰 Berdasarkan Kategori</div>' +

    '<div class="field"><label>Saldo Bebas (Rp)</label>' +
      '<input type="number" id="si_saldoBebas" min="0" step="1" inputmode="numeric" value="' + saldoBebas + '" /></div>' +

    '<div class="field-row">' +
      '<div class="field"><label>Uang Jajan Tunai</label>' +
        '<input type="number" id="si_snackCash" min="0" step="1" inputmode="numeric" value="' + snackCash + '" /></div>' +
      '<div class="field"><label>Uang Jajan Non-Tunai</label>' +
        '<input type="number" id="si_snackNonCash" min="0" step="1" inputmode="numeric" value="' + snackNonCash + '" /></div>' +
    '</div>' +

    '<div class="field-row">' +
      '<div class="field"><label>Dana Darurat</label>' +
        '<input type="number" id="si_emergency" min="0" step="1" inputmode="numeric" value="' + (Number(cur.emergency) || 0) + '" /></div>' +
      '<div class="field"><label>Tabungan Umum</label>' +
        '<input type="number" id="si_savings" min="0" step="1" inputmode="numeric" value="' + (Number(cur.savings) || 0) + '" /></div>' +
    '</div>' +

    '<div class="field"><label>Dana eMas</label>' +
      '<input type="number" id="si_goldFund" min="0" step="1" inputmode="numeric" value="' + (Number(cur.goldFund) || 0) + '" /></div>' +

    '<div class="denom-summary" style="margin:12px 0"><span>Total Uang (Kategori)</span>' +
      '<span class="v" id="si_totalKat">Rp0</span></div>' +

    '<div class="section-title">💼 Berdasarkan Akun</div>';

  accList.forEach(function (a) {
    body += '<div class="field"><label>' + a.icon + ' ' + esc(a.name) + ' (Rp)</label>' +
      '<input type="number" id="si_acc_' + a.id + '" min="0" step="1" inputmode="numeric" value="' +
      (Number(curAcc[a.id]) || 0) + '" /></div>';
  });

  body +=
    '<div class="denom-summary" style="margin:12px 0"><span>Total Uang (Akun)</span>' +
      '<span class="v" id="si_totalAkun">Rp0</span></div>' +

    '<div class="help" id="si_diff"></div>' +

    '<div class="divider"></div>' +

    '<label class="check" style="border-color:rgba(255,107,120,.4);background:rgba(255,107,120,.05)">' +
      '<input type="checkbox" id="si_resetTx" /> ' +
      '<b style="color:var(--coral)">Hapus semua transaksi</b> (mulai dari nol dengan saldo baru ini)' +
    '</label>' +

    '<div class="help" style="margin-top:8px">Kalau dicentang, semua transaksi, prediksi, dan utang akan dihapus. ' +
    'Saldo awal jadi murni angka yang kamu isi. Cocok buat setup pertama kali.</div>';

  var foot =
    '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="si_save">Simpan</button>';

  openModal('⚙️ Setup Saldo Awal', body, foot, function (root) {
    function sumKategori() {
      var sb = parseInt($('#si_saldoBebas', root).value, 10) || 0;
      var sc = parseInt($('#si_snackCash', root).value, 10) || 0;
      var sn = parseInt($('#si_snackNonCash', root).value, 10) || 0;
      var em = parseInt($('#si_emergency', root).value, 10) || 0;
      var sv = parseInt($('#si_savings', root).value, 10) || 0;
      var gf = parseInt($('#si_goldFund', root).value, 10) || 0;
      return sb + sc + sn + em + sv + gf;
    }

    function sumAkun() {
      var t = 0;
      getAccounts().forEach(function (a) {
        var el = $('#si_acc_' + a.id, root);
        if (el) t += parseInt(el.value, 10) || 0;
      });
      return t;
    }

    function updateInfo() {
      var tk = sumKategori();
      var ta = sumAkun();
      $('#si_totalKat', root).textContent = rupiah(tk);
      $('#si_totalAkun', root).textContent = rupiah(ta);

      var diff = tk - ta;
      var diffEl = $('#si_diff', root);
      if (diff === 0 && tk > 0) {
        diffEl.className = 'help ok';
        diffEl.innerHTML = '✔ Total kategori cocok dengan total akun.';
      } else if (tk === 0 && ta === 0) {
        diffEl.className = 'help';
        diffEl.innerHTML = 'Masukkan nominal.';
      } else {
        diffEl.className = 'help err';
        diffEl.innerHTML = '⚠ Selisih <b>' + rupiah(Math.abs(diff)) + '</b> antara kategori (' +
          rupiah(tk) + ') dan akun (' + rupiah(ta) + '). Sebaiknya disamakan.';
      }
    }

    ['si_saldoBebas', 'si_snackCash', 'si_snackNonCash', 'si_emergency', 'si_savings', 'si_goldFund'].forEach(function (id) {
      var el = $('#' + id, root);
      if (el) el.addEventListener('input', updateInfo);
    });
    getAccounts().forEach(function (a) {
      var el = $('#si_acc_' + a.id, root);
      if (el) el.addEventListener('input', updateInfo);
    });
    updateInfo();

    $('#si_save', root).addEventListener('click', function () {
      var sb = Math.max(0, parseInt($('#si_saldoBebas', root).value, 10) || 0);
      var sc = Math.max(0, parseInt($('#si_snackCash', root).value, 10) || 0);
      var sn = Math.max(0, parseInt($('#si_snackNonCash', root).value, 10) || 0);
      var em = Math.max(0, parseInt($('#si_emergency', root).value, 10) || 0);
      var sv = Math.max(0, parseInt($('#si_savings', root).value, 10) || 0);
      var gf = Math.max(0, parseInt($('#si_goldFund', root).value, 10) || 0);

      state.initial = {
        main: sb + sc + sn,       // main = saldo bebas + uang jajan
        snackCash: sc,
        snackNonCash: sn,
        emergency: em,
        savings: sv,
        goldFund: gf
      };

      var newAcc = {};
      getAccounts().forEach(function (a) {
        var el = $('#si_acc_' + a.id, root);
        newAcc[a.id] = el ? Math.max(0, parseInt(el.value, 10) || 0) : 0;
      });
      state.initialAccounts = newAcc;

      if ($('#si_resetTx', root).checked) {
        state.transactions = [];
        state.predictions = [];
        state.debts = [];
        state.reconciliation = { resolved: true, category: 'other', note: 'Setup ulang.', resolvedAt: null };
      }

      saveState();
      closeModal();
      renderPage();
      mtPlay('success');

      var totalUang = (sb + sc + sn) + em + sv + gf;
      toast('Saldo awal disimpan. Total uang: ' + rupiah(totalUang), 'ok');
    });
  });
}

  
  function openReconForm() {
  var body =
    '<div class="kv"><span class="k">Total dilaporkan</span><span class="v">' + rupiah(RECON.reported) + '</span></div>' +
    '<div class="kv"><span class="k">Teridentifikasi</span><span class="v">' + rupiah(RECON.identified) + '</span></div>' +
    '<div class="kv"><span class="k">Selisih</span><span class="v val-gold">' + rupiah(RECON.diff) + '</span></div>' +
    '<div class="divider"></div>' +
    '<p style="font-size:13px;color:var(--muted)">Tentukan sumber selisih. Ditambahkan ke saldo bebas <b>sekali saja</b>.</p>' +
    '<div class="field"><label>Sumber</label>' +
      '<select id="r_cat">' +
        '<option value="cash">Uang tunai tambahan</option>' +
        '<option value="bank">Saldo rekening/e-wallet</option>' +
        '<option value="other">Lainnya</option>' +
      '</select></div>' +
    '<div class="field"><label>Catatan</label><input type="text" id="r_note" /></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="r_save">Selesaikan</button>';

  openModal('🧾 Rekonsiliasi', body, foot, function (root) {
    $('#r_save', root).addEventListener('click', function () {
      state.reconciliation.resolved = true;
      state.reconciliation.category = $('#r_cat', root).value;
      state.reconciliation.note = $('#r_note', root).value.trim();
      state.reconciliation.resolvedAt = nowStamp();
      saveState(); closeModal(); renderPage();
      mtPlay('success');
      toast('Rekonsiliasi selesai.', 'ok');
    });
  });
}

/* ============================================================
   BAGIAN 35 — EXPORT / BACKUP
   ============================================================ */

function csvEscape(v) {
  var s = String(v == null ? '' : v);
  if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCSV() {
  var rows = [];
  rows.push(['ID','Jenis','Tanggal','Jam','Kategori','Deskripsi','Nominal','Akun','Metode','UangJajan','Catatan'].join(';'));
  allTx().forEach(function (t) {
    var ket = '';
    if (t.type === 'transfer') ket = (t.from || '') + ' -> ' + (t.to || '');
    if (t.type === 'goldBuy') ket = 'beli ' + (t.grams || 0) + 'gr @ ' + (t.pricePerGram || 0);
    if (t.type === 'goldSell') ket = 'jual ' + (t.grams || 0) + 'gr @ ' + (t.pricePerGram || 0);
    rows.push([
      csvEscape(t.id), csvEscape(t.type), csvEscape(t.date), csvEscape(t.time || ''),
      csvEscape(t.category || ket), csvEscape(t.description || t.source || ket),
      csvEscape(Number(t.amount) || 0),
      csvEscape(t.account || t.method || ''),
      csvEscape(t.method || ''),
      csvEscape(t.useSnack || t.isSnackAllowance ? 'Ya' : 'Tidak'),
      csvEscape(t.note || '')
    ].join(';'));
  });

  var csv = '\uFEFF' + rows.join('\r\n');
  var name = 'moneytrack_' + todayISO() + '.csv';
  if (download(name, csv, 'text/csv;charset=utf-8')) toast('CSV diunduh: ' + name, 'ok');
  else toast('Gagal unduh. Salin manual.', 'err');
}

function backupJSON() {
  var payload = {
    app: 'MoneyTrack', version: STATE_VERSION,
    exportedAt: nowStamp(),
    snapshotDate: SNAPSHOT_DATE,
    initial: INITIAL, recon: RECON, state: state
  };
  var name = 'moneytrack_backup_' + todayISO() + '.json';
  if (download(name, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8'))
    toast('Backup: ' + name, 'ok');
  else toast('Gagal backup.', 'err');
}

function restoreJSON() {
  var body =
    '<p style="font-size:13px;color:var(--muted)">Pilih file backup JSON.</p>' +
    '<div class="field"><label>File</label><input type="file" id="r_file" accept="application/json,.json" /></div>' +
    '<div class="field"><label>Atau tempel JSON</label><textarea id="r_text"></textarea></div>' +
    '<div class="help" id="r_status"></div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="r_do">Validasi & Pulihkan</button>';

  openModal('📥 Restore JSON', body, foot, function (root) {
    $('#r_do', root).addEventListener('click', function () {
      var status = $('#r_status', root);
      var txt = $('#r_text', root).value.trim();
      var fileInput = $('#r_file', root);

      function process(raw) {
        var parsed;
        try { parsed = JSON.parse(raw); }
        catch (e) { status.className = 'help err'; status.textContent = 'JSON tidak valid.'; return; }

        var incoming = null;
        if (parsed && parsed.state && typeof parsed.state === 'object') incoming = parsed.state;
        else if (parsed && Array.isArray(parsed.transactions)) incoming = parsed;
        else { status.className = 'help err'; status.textContent = 'Struktur tidak dikenali.'; return; }

        if (!Array.isArray(incoming.transactions)) { status.className = 'help err'; status.textContent = 'transactions harus array.'; return; }

        var validTypes = { income: 1, expense: 1, transfer: 1, goldBuy: 1, goldSell: 1 };
        var bad = 0;
        var cleanTx = [];
        incoming.transactions.forEach(function (t) {
          if (!t || typeof t !== 'object') { bad++; return; }
          if (!validTypes[t.type]) { bad++; return; }
          if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) { bad++; return; }
          var amt = Number(t.amount);
          if (isNaN(amt) || amt < 0) { bad++; return; }
          cleanTx.push(t);
        });

        if (!cleanTx.length && incoming.transactions.length > 0) {
          status.className = 'help err';
          status.textContent = 'Semua transaksi tidak valid.';
          return;
        }

        confirmDialog('Pulihkan Data',
          'Ditemukan <b>' + cleanTx.length + '</b> transaksi valid' +
          (bad ? ' (' + bad + ' tidak valid di-skip)' : '') + '. Data sekarang akan <b>diganti</b>.',
          function () {
            state = mergeState(defaultState(), incoming);
            state.transactions = cleanTx;
            if (!Array.isArray(state.predictions)) state.predictions = [];
            if (!Array.isArray(state.debts)) state.debts = [];
            saveState(); applyTheme(); renderPage();
            toast('Data dipulihkan.', 'ok');
          });
      }

      if (fileInput.files && fileInput.files[0]) {
        var reader = new FileReader();
        reader.onload = function () { process(String(reader.result)); };
        reader.onerror = function () { status.className = 'help err'; status.textContent = 'Gagal baca file.'; };
        reader.readAsText(fileInput.files[0]);
      } else if (txt) {
        process(txt);
      } else {
        status.className = 'help err';
        status.textContent = 'Pilih file atau tempel JSON.';
      }
    });
  });
}

/* ============================================================
   BAGIAN 36 — HANDLE ACTION
   ============================================================ */

function handleAction(act, el) {
  var id = el ? el.dataset.id : null;

  switch (act) {
    case 'nav': navigate(el.dataset.nav); break;

    case 'add-income': openIncomeForm(null, {}); break;
    case 'quick-snack-income':
      openIncomeForm(null, {
        source: 'Orang Tua', category: 'Uang Jajan',
        amount: 25000, isSnackAllowance: true
      });
      break;
    case 'dismiss-reminder':
      state.settings.reminder = false;
      saveState(); renderPage();
      toast('Pengingat dimatikan.', 'ok');
      break;

    case 'add-expense': openExpenseForm(null, {}); break;
    case 'add-expense-snack': openExpenseForm(null, { useSnack: true, category: 'Makanan' }); break;

    case 'add-prediction': openPredictionForm(null); break;
    case 'edit-pred': {
      var pe = state.predictions.filter(function (x) { return x.id === id; })[0];
      if (pe) openPredictionForm(pe);
      break;
    }
    case 'cancel-pred': {
      var pc = state.predictions.filter(function (x) { return x.id === id; })[0];
      if (pc) confirmDialog('Batalkan Prediksi', 'Prediksi dibatalkan. Saldo aktual tidak berubah.',
        function () { pc.status = 'cancelled'; saveState(); renderPage(); toast('Dibatalkan.', 'ok'); });
      break;
    }
    case 'del-pred': {
      confirmDialog('Hapus Prediksi', 'Prediksi dihapus permanen.', function () {
        state.predictions = state.predictions.filter(function (x) { return x.id !== id; });
        saveState(); renderPage(); toast('Prediksi dihapus.', 'ok');
      });
      break;
    }
    case 'realize-pred': {
      var pr = state.predictions.filter(function (x) { return x.id === id; })[0];
      if (!pr) break;
      if (pr.status !== 'planned') { toast('Bukan planned.', 'err'); break; }
      openExpenseForm(null, {
        category: pr.category, description: pr.description,
        amount: pr.amount, useSnack: false, predictionId: pr.id
      });
      break;
    }

    case 'deposit-emergency': openTransferForm({ bucket: 'emergency', label: 'Dana Darurat', direction: 'deposit' }); break;
    case 'deposit-emergency-amt': openTransferForm({ bucket: 'emergency', label: 'Dana Darurat', direction: 'deposit', amount: el.dataset.amt }); break;
    case 'withdraw-emergency': openTransferForm({ bucket: 'emergency', label: 'Dana Darurat', direction: 'withdraw' }); break;
    case 'deposit-savings': openTransferForm({ bucket: 'savings', label: 'Tabungan Umum', direction: 'deposit' }); break;
    case 'deposit-savings-amt': openTransferForm({ bucket: 'savings', label: 'Tabungan Umum', direction: 'deposit', amount: el.dataset.amt }); break;
    case 'withdraw-savings': openTransferForm({ bucket: 'savings', label: 'Tabungan Umum', direction: 'withdraw' }); break;
    case 'deposit-gold': openTransferForm({ bucket: 'goldFund', label: 'Dana eMas', direction: 'deposit' }); break;
    case 'withdraw-gold': openTransferForm({ bucket: 'goldFund', label: 'Dana eMas', direction: 'withdraw' }); break;

    case 'snack-to-main': openSnackToMainForm(null); break;
    case 'snack-to-main-amt': openSnackToMainForm(el.dataset.amt || null); break;
    case 'main-to-snack': openMainToSnackForm(el.dataset.amt || null); break;
    case 'main-to-snack-amt': openMainToSnackForm(el.dataset.amt || null); break;

    case 'edit-emergency-target': openTargetForm('emergency'); break;
    case 'edit-savings-target': openTargetForm('savings'); break;
    case 'edit-gold-price': openGoldPriceForm(); break;

    case 'buy-gold': openGoldBuyForm(); break;
    case 'sell-gold': openGoldSellForm(); break;

    // TITIPAN
case 'add-titipan': openTitipanForm(null); break;
case 'edit-titipan': {
  var tE = state.titipan.filter(function (a) { return a.id === id; })[0];
  if (tE) openTitipanForm(tE);
  break;
}
case 'use-titipan': {
  var tU = state.titipan.filter(function (a) { return a.id === id; })[0];
  if (tU) {
    confirmDialog('Tandai Sudah Dipakai?',
      'Titipan <b>' + rupiah(tU.amount) + '</b> dari <b>' + esc(tU.person) + '</b> ' +
      'akan ditandai <b>sudah dipakai</b>.',
      function () {
        tU.status = 'used';
        tU.usedAt = nowStamp();
        saveState(); renderPage();
        toast('Titipan ditandai sudah dipakai.', 'ok');
      });
  }
  break;
}
case 'return-titipan': {
  var tR = state.titipan.filter(function (a) { return a.id === id; })[0];
  if (tR) {
    confirmDialog('Tandai Sudah Dikembalikan?',
      'Titipan <b>' + rupiah(tR.amount) + '</b> dari <b>' + esc(tR.person) + '</b> ' +
      'akan ditandai <b>sudah dikembalikan</b>.',
      function () {
        tR.status = 'returned';
        tR.returnedAt = nowStamp();
        saveState(); renderPage();
        toast('Titipan ditandai sudah dikembalikan.', 'ok');
      });
  }
  break;
}
case 'del-titipan': {
  confirmDialog('Hapus Titipan?', 'Data titipan akan dihapus permanen.',
    function () {
      state.titipan = state.titipan.filter(function (a) { return a.id !== id; });
      saveState(); renderPage();
      toast('Titipan dihapus.', 'ok');
    });
  break;
}

// UTANG
case 'add-debt': openDebtForm(null); break;
    case 'edit-debt': {
      var dE = state.debts.filter(function (x) { return x.id === id; })[0];
      if (dE) openDebtForm(dE);
      break;
    }
    case 'pay-debt': {
      var dP = state.debts.filter(function (x) { return x.id === id; })[0];
      if (dP) openDebtPaymentForm(dP);
      break;
    }
    case 'del-debt': {
      confirmDialog('Hapus Utang/Piutang?', 'Data dihapus permanen.',
        function () {
          state.debts = state.debts.filter(function (x) { return x.id !== id; });
          saveState(); renderPage(); toast('Dihapus.', 'ok');
        });
      break;
    }

    case 'setup-initial':
  openSetupInitialForm();
  break;
    
    case 'open-recon': openReconForm(); break;
    case 'reset-recon':
      confirmDialog('Batalkan Rekonsiliasi',
        'Status kembali belum selesai.',
        function () {
          state.reconciliation = { resolved: false, category: null, note: '', resolvedAt: null };
          saveState(); renderPage(); toast('Dibatalkan.', 'ok');
        });
      break;

    case 'edit-tx': {
      var tx = state.transactions.filter(function (x) { return x.id === id; })[0];
      if (!tx) break;
      if (tx.type === 'income') openIncomeForm(tx, {});
      else if (tx.type === 'expense') openExpenseForm(tx, {});
      else toast('Transaksi ini tidak dapat diedit.', 'warn');
      break;
    }
    case 'del-tx': {
      var txd = state.transactions.filter(function (x) { return x.id === id; })[0];
      if (!txd) break;
      var desc = txd.description || txd.source || txd.type;
      confirmDialog('Hapus Transaksi',
        'Transaksi <b>' + esc(desc) + '</b> sebesar <b>' + rupiah(txd.amount) + '</b> dihapus permanen.',
        function () {
          state.transactions = state.transactions.filter(function (x) { return x.id !== id; });
          if (txd.predictionId) {
            var pp = state.predictions.filter(function (x) { return x.id === txd.predictionId; })[0];
            if (pp) { pp.status = 'planned'; pp.txId = null; }
          }
          if (txd.debtId) {
            var dd = state.debts.filter(function (x) { return x.id === txd.debtId; })[0];
            if (dd) {
              dd.paid = Math.max(0, (Number(dd.paid) || 0) - (Number(txd.amount) || 0));
              dd.status = dd.paid >= (Number(dd.amount) || 0) ? 'paid' : 'active';
              if (dd.status === 'active') delete dd.paidDate;
            }
          }
          saveState(); renderPage(); mtPlay('del');
          toast('Dihapus.', 'ok');
        });
      break;
    }

    case 'reset-income-filter': filterIncome = { q:'', from:'', to:'', cat:'' }; renderPage(); break;
    case 'reset-expense-filter': filterExpense = { q:'', from:'', to:'', cat:'' }; renderPage(); break;
    case 'reset-hist-filter': filterHistory = { q:'', from:'', to:'', cat:'', type:'' }; renderPage(); break;

    case 'open-cash-breakdown': openCashBreakdownModal(); break;
    case 'manage-accounts': openManageAccountsModal(); break;

    case 'cal-today': calCursor = null; calSel = null; renderPage(); break;
    case 'stats-range': statsRange = (id === '7' || id === '90') ? id : '30'; renderPage(); break;
    case 'cal-prev':
      calCursor = { y: calCursor.m === 0 ? calCursor.y - 1 : calCursor.y, m: calCursor.m === 0 ? 11 : calCursor.m - 1 };
      renderPage(); break;
    case 'cal-next':
      calCursor = { y: calCursor.m === 11 ? calCursor.y + 1 : calCursor.y, m: calCursor.m === 11 ? 0 : calCursor.m + 1 };
      renderPage(); break;

    case 'export-csv': exportCSV(); break;
    case 'backup-json': backupJSON(); break;
    case 'restore-json': restoreJSON(); break;

    case 'refresh-ai':
    case 'refresh-patterns':
    case 'refresh-weekinsight':
      renderPage();
      toast('Diperbarui.', 'ok');
      break;

    case 'save-settings': saveSettingsFromForm(); break;

    case 'preview-sound': mtPlay(el.dataset.sound || 'tap'); break;

    // TARGET MINGGUAN
    case 'edit-weekly-target': {
      var wkE = weekRange(todayISO());
      var curT = getWeeklyTarget(wkE[0]);
      var bodyE =
        '<div class="help" style="margin-bottom:12px">Minggu: <b>' + fmtTanggalPendek(wkE[0]) + ' – ' +
          fmtTanggalPendek(wkE[1]) + '</b></div>' +
        '<div class="field"><label>Target mingguan (Rp)</label>' +
          '<input type="number" id="wt_amount" min="0" step="1000" value="' + curT + '" /></div>';
      var footE = '<button class="btn" data-close="1">Batal</button>' +
                  '<button class="btn btn-primary" id="wt_save">Simpan</button>';
      openModal('🎯 Ubah Target Mingguan', bodyE, footE, function (root) {
        $('#wt_save', root).addEventListener('click', function () {
          var v = parseInt($('#wt_amount', root).value, 10);
          if (isNaN(v) || v < 0) return toast('Tidak valid.', 'err');
          setWeeklyTarget(wkE[0], v);
          saveState(); closeModal(); renderPage();
          toast('Target: ' + rupiah(v), 'ok');
        });
      });
      break;
    }
    case 'reset-weekly-target': {
      var wkR = weekRange(todayISO());
      if (state.weeklyTarget && state.weeklyTarget.overrides) {
        delete state.weeklyTarget.overrides[wkR[0]];
      }
      saveState(); renderPage();
      toast('Target mingguan dikembalikan ke default.', 'ok');
      break;
    }
    case 'set-default-weekly-target': {
      var curD = getWeeklyTarget(null);
      var bodyD =
        '<div class="field"><label>Default target mingguan</label>' +
          '<input type="number" id="wt_default" min="0" step="1000" value="' + curD + '" /></div>' +
        '<div class="help">Rekomendasi: Rp85.000 (Rp17.000 × 5 hari).</div>';
      var footD = '<button class="btn" data-close="1">Batal</button>' +
                  '<button class="btn btn-primary" id="wt_default_save">Simpan</button>';
      openModal('📌 Set Default Target', bodyD, footD, function (root) {
        $('#wt_default_save', root).addEventListener('click', function () {
          var v = parseInt($('#wt_default', root).value, 10);
          if (isNaN(v) || v < 0) return toast('Tidak valid.', 'err');
          setWeeklyTarget('default', v);
          saveState(); closeModal(); renderPage();
          toast('Default: ' + rupiah(v), 'ok');
        });
      });
      break;
    }

    case 'reset-all':
      confirmDialog('Hapus Semua Transaksi',
        'Seluruh transaksi, prediksi, dan utang akan dihapus. Data awal tetap. Tidak bisa dibatalkan.',
        function () {
          state.transactions = [];
          state.predictions = [];
          state.debts = [];
          saveState(); renderPage();
          toast('Semua transaksi dihapus.', 'ok');
        });
      break;

    default: break;
  }
}

function openTargetForm(which) {
  var isEmerg = which === 'emergency';
  var cur = isEmerg ? state.emergency : state.savings;

  var body =
    '<div class="field"><label>Target (Rp)</label>' +
      '<input type="number" id="t_target" min="0" step="1000" value="' + (cur.target || 0) + '" /></div>' +
    (isEmerg ? '' : '<div class="field"><label>Tenggat</label>' +
      '<input type="date" id="t_deadline" value="' + esc(cur.deadline || '') + '" /></div>') +
    '<div class="help">Fleksibel. Jangan paksa kalau uang terbatas.</div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-primary" id="t_save">Simpan</button>';

  openModal('🎯 Ubah Target', body, foot, function (root) {
    $('#t_save', root).addEventListener('click', function () {
      var tv = parseInt($('#t_target', root).value, 10);
      if (isNaN(tv) || tv < 0) return toast('Tidak valid.', 'err');
      if (isEmerg) state.emergency.target = tv;
      else {
        state.savings.target = tv;
        state.savings.deadline = $('#t_deadline', root).value || '';
      }
      saveState(); closeModal(); renderPage();
      toast('Target diperbarui.', 'ok');
    });
  });
}

function openGoldPriceForm() {
  var body =
    '<div class="field"><label>Harga emas/gram (Rp)</label>' +
      '<input type="number" id="g_price" min="0" step="1" value="' + (state.gold.pricePerGram || 0) + '" /></div>' +
    '<div class="help">Manual input. Terakhir: ' + esc(state.gold.priceUpdatedAt || 'belum pernah') + '</div>';

  var foot = '<button class="btn" data-close="1">Batal</button>' +
    '<button class="btn btn-gold" id="g_save">Simpan</button>';

  openModal('🪙 Harga Emas', body, foot, function (root) {
    $('#g_save', root).addEventListener('click', function () {
      var v = parseFloat($('#g_price', root).value);
      if (isNaN(v) || v < 0) return toast('Tidak valid.', 'err');
      state.gold.pricePerGram = v;
      state.gold.priceUpdatedAt = nowStamp();
      saveState(); closeModal(); renderPage();
      toast('Harga diperbarui.', 'ok');
    });
  });
}

function saveSettingsFromForm() {
  var d = parseInt($('#setDaily', document).value, 10);
  var s = parseInt($('#setSat', document).value, 10);
  var u = parseInt($('#setSun', document).value, 10);
  var wt = parseInt($('#setWeeklyTarget', document).value, 10);
  var r = $('#setReminder', document).checked;

  if (isNaN(d) || d < 0) return toast('Uang jajan harian tidak valid.', 'err');
  if (isNaN(s) || s < 0) return toast('Batas Sabtu tidak valid.', 'err');
  if (isNaN(u) || u < 0) return toast('Batas Minggu tidak valid.', 'err');

  state.settings.dailyBudget = d;
  state.settings.saturdayBudget = s;
  state.settings.sundayBudget = u;
  state.settings.reminder = !!r;
  if (!isNaN(wt) && wt >= 0) setWeeklyTarget('default', wt);

  saveState();
  renderPage();
  toast('Pengaturan disimpan.', 'ok');
}

/* ============================================================
   BAGIAN 37 — TEMA
   ============================================================ */

function applyTheme() {
  var theme = state.settings.theme || 'dark';
  
  // Hapus class tema lama
  document.body.classList.remove('light', 'pink', 'ocean', 'sunset', 'forest', 'cyber', 'coffee');
  
  // Tambah class tema baru (kalo bukan dark)
  if (theme !== 'dark') {
    document.body.classList.add(theme);
  }
  
  updateThemeButton();
}

function updateThemeButton() {
  var btn = $('#btnTheme');
  if (!btn) return;
  var t = state.settings.theme || 'dark';
  
  // Ganti icon di pojok kanan atas sesuai tema
  if (t === 'light') btn.textContent = '☀️';
  else if (t === 'pink') btn.textContent = '🌸';
  else if (t === 'ocean') btn.textContent = '🌊';
  else if (t === 'sunset') btn.textContent = '🌅';
  else if (t === 'forest') btn.textContent = '🌲';
  else if (t === 'cyber') btn.textContent = '⚡';
  else if (t === 'coffee') btn.textContent = '☕';
  else btn.textContent = '🌙'; // Default dark
}

/* ============================================================
   BAGIAN 38 — AUDIO
   ============================================================ */

var mtPageLoadTime = Date.now();
var mtAudioCtx = null;
var mtMusicNodes = null;
var mtMusicPlaying = false;
var mtLastSoundTime = 0;

function mtGetAudioCtx() {
  if (mtAudioCtx) return mtAudioCtx;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    mtAudioCtx = new Ctx();
    return mtAudioCtx;
  } catch (e) { return null; }
}
function mtAudioResume() {
  var ctx = mtGetAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
}
function mtAudioSettings() {
  if (!state || !state.settings) return { clickEnabled: true, musicEnabled: false, volume: 0.5 };
  if (!state.settings.audio) state.settings.audio = { clickEnabled: true, musicEnabled: false, volume: 0.5 };
  return state.settings.audio;
}
function mtPulse() {
  var p = document.getElementById('mtAudioPulse');
  if (!p) return;
  p.classList.remove('fire');
  requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add('fire'); }); });
}
function mtSfxVol() { return (mtAudioSettings().volume || 0.5) * 0.22; }

function mtTone(opts) {
  var cfg = mtAudioSettings();
  if (!cfg.clickEnabled) return;
  var ctx = mtGetAudioCtx();
  if (!ctx) return;
  mtAudioResume();
  var now = Date.now();
  if (now - mtLastSoundTime < 30 && !opts.force) return;
  mtLastSoundTime = now;
  try {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(opts.freqStart || 880, t);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + (opts.dur || 0.08));
    var vol = mtSfxVol() * (opts.gain || 1);
    var dur = opts.dur || 0.09;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(mtSfxBus(ctx));
    osc.start(t); osc.stop(t + dur + 0.02);
  } catch (e) {}
}

function mtChord(freqs, dur, type, gainVal) {
  var cfg = mtAudioSettings();
  if (!cfg.clickEnabled) return;
  var ctx = mtGetAudioCtx();
  if (!ctx) return;
  mtAudioResume();
  try {
    var t = ctx.currentTime;
    dur = dur || 0.25;
    freqs.forEach(function (f, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.value = f;
      var v = mtSfxVol() * (gainVal || 1) * 0.9;
      var st = t + i * 0.04;
      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(v, st + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      osc.connect(gain); gain.connect(mtSfxBus(ctx));
      osc.start(st); osc.stop(st + dur + 0.02);
    });
  } catch (e) {}
}

var MT_SOUND = {
  tap:         function () { mtTone({ freqStart: 880, freqEnd: 1320, dur: 0.07 }); },
  nav:         function () { mtTone({ type: 'sine', freqStart: 520, freqEnd: 880, dur: 0.11 }); },
  open:        function () { mtTone({ type: 'sine', freqStart: 400, freqEnd: 780, dur: 0.14 }); },
  close:       function () { mtTone({ type: 'sine', freqStart: 780, freqEnd: 380, dur: 0.14 }); },
  success:     function () { mtChord([523.25, 659.25, 783.99], 0.35, 'triangle', 0.9); },
  error:       function () { mtChord([196, 165], 0.22, 'sawtooth', 0.7); },
  warn:        function () { mtTone({ type: 'triangle', freqStart: 660, freqEnd: 440, dur: 0.18 }); },
  coin:        function () { mtChord([1318.51, 1760], 0.22, 'sine', 1); },
  cash:        function () { mtTone({ type: 'sine', freqStart: 660, freqEnd: 220, dur: 0.16 }); },
  transfer:    function () { mtTone({ type: 'sine', freqStart: 440, freqEnd: 990, dur: 0.2 }); },
  del:         function () { mtChord([392, 311, 233], 0.28, 'sawtooth', 0.55); },
  toggleOn:    function () { mtTone({ type: 'square', freqStart: 660, freqEnd: 1180, dur: 0.07 }); },
  toggleOff:   function () { mtTone({ type: 'square', freqStart: 660, freqEnd: 330, dur: 0.07 }); },
  notify:      function () { mtChord([880, 1318.51], 0.18, 'sine', 0.9); },
  save:        function () { mtChord([659.25, 880], 0.22, 'triangle', 0.9); },
  open_modal:  function () { mtTone({ type: 'sine', freqStart: 440, freqEnd: 880, dur: 0.16 }); },
  close_modal: function () { mtTone({ type: 'sine', freqStart: 880, freqEnd: 440, dur: 0.16 }); }
};

function mtPlay(name) {
  try {
    var fn = MT_SOUND[name];
    if (!fn) return;
    clearTimeout(_mtLowT);
    if (MT_LOW[name]) {
      _mtLowT = setTimeout(function () {
        if (Date.now() - _mtBootAt < 700) return;
        fn(); mtPulse();
        if ((name === 'tap' || name === 'nav') && navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
      }, 0);
      return;
    }
    fn(); mtPulse();
  } catch (e) {}
}

function mtGlobalClickSound(e) {
  if (!e || !e.target || !e.target.closest) return;
  if (e.target.closest('[data-close]') && !e.target.closest('[data-act]')) return mtPlay('close_modal');
  var actEl = e.target.closest('[data-act]');
  if (actEl) {
    var act = actEl.dataset.act || '';
    if (act === 'preview-sound') return;
    if (act === 'add-income' || act === 'quick-snack-income') return mtPlay('income');
    if (act === 'add-expense' || act === 'add-expense-snack') return mtPlay('expense');
    if (act.indexOf('add-') === 0 || act.indexOf('quick-') === 0) return mtPlay('open');
    if (act.indexOf('del-') === 0 || act === 'reset-all') return mtPlay('del');
    if (act === 'open-recon' || act === 'open-cash-breakdown' || act === 'manage-accounts') return mtPlay('open_modal');
    if (act.indexOf('cal-') === 0) return mtPlay('nav');
    if (act.indexOf('deposit-') === 0 || act.indexOf('withdraw-') === 0 ||
        act.indexOf('snack-to-') === 0 || act.indexOf('main-to-') === 0 || act.indexOf('pay-debt') === 0) return mtPlay('transfer');
    if (act === 'buy-gold' || act === 'sell-gold') return mtPlay('coin');
    if (act === 'export-csv' || act === 'backup-json') return mtPlay('save');
    if (act === 'save-settings' || act.indexOf('edit-') === 0) return mtPlay('save');
    if (act === 'realize-pred') return mtPlay('success');
    return mtPlay('tap');
  }
  var navT = e.target.closest('[data-nav]');
  if (navT) return mtNavSound(navT.dataset.nav);
  if (e.target.closest('[data-cal]')) return mtPlay('tap');
  if (e.target.closest('.btn, .icon-btn, .mt-switch')) return mtPlay('tap');
}

function mtMusicStart() {
  if (mtMusicPlaying) return;
  var ctx = mtGetAudioCtx();
  if (!ctx) return;
  mtAudioResume();
  var cfg = mtAudioSettings();
  var master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  var chords = [
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [261.63, 329.63, 392.00],
    [196.00, 246.94, 293.66]
  ];
  var noteDur = 2.4;
  var chordIndex = 0;
  var nextTime = ctx.currentTime + 0.15;
  master.gain.linearRampToValueAtTime((cfg.volume || 0.5) * 0.08, ctx.currentTime + 1.2);

  var timer = setInterval(function () {
    if (!mtMusicPlaying) return;
    try {
      while (nextTime < ctx.currentTime + noteDur + 0.6) {
        var chord = chords[chordIndex % chords.length];
        for (var i = 0; i < chord.length; i++) {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = chord[i];
          var peak = (i === 0 ? 1 : 0.55) * 0.5;
          g.gain.setValueAtTime(0, nextTime);
          g.gain.linearRampToValueAtTime(peak, nextTime + 1.0);
          g.gain.linearRampToValueAtTime(0, nextTime + noteDur);
          osc.connect(g); g.connect(master);
          osc.start(nextTime); osc.stop(nextTime + noteDur + 0.05);
        }
        nextTime += noteDur;
        chordIndex++;
      }
    } catch (e) {}
  }, 500);

  mtMusicNodes = { master: master, timer: timer };
  mtMusicPlaying = true;
}

function mtMusicStop() {
  if (!mtMusicPlaying || !mtMusicNodes) return;
  try {
    clearInterval(mtMusicNodes.timer);
    var ctx = mtGetAudioCtx();
    if (ctx) {
      mtMusicNodes.master.gain.cancelScheduledValues(ctx.currentTime);
      mtMusicNodes.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    }
    var m = mtMusicNodes.master;
    setTimeout(function () { try { m.disconnect(); } catch (e) {} }, 800);
  } catch (e) {}
  mtMusicNodes = null;
  mtMusicPlaying = false;
}
function mtMusicUpdateVolume() {
  if (mtMusicPlaying && mtMusicNodes) {
    var ctx = mtGetAudioCtx();
    if (ctx) {
      var target = (mtAudioSettings().volume || 0.5) * 0.08;
      mtMusicNodes.master.gain.cancelScheduledValues(ctx.currentTime);
      mtMusicNodes.master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.15);
    }
  }
}
function mtAudioSetupAutoStart() {
  var cfg = mtAudioSettings();
  if (!cfg.musicEnabled) return;
  var start = function () {
    var c = mtAudioSettings();
    if (!c.musicEnabled) return;
    var wait = Math.max(0, 2500 - (Date.now() - mtPageLoadTime));
    setTimeout(function () {
      var c2 = mtAudioSettings();
      if (c2.musicEnabled) mtMusicStart();
    }, wait);
    document.removeEventListener('click', start);
    document.removeEventListener('touchstart', start);
  };
  document.addEventListener('click', start, { once: true });
  document.addEventListener('touchstart', start, { once: true });
}

/* ============================================================
   BAGIAN 39 — ANIMASI
   ============================================================ */

var _mtLastAnimPage = '__init__';

function mtReducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

function mtInitParticles() {
  if (mtReducedMotion()) return;
  if (document.querySelector('.mt-particles')) return;
  var c = document.createElement('div');
  c.className = 'mt-particles';
  c.setAttribute('aria-hidden', 'true');
  var symbols = ['💰', '💵', '🪙', '💸', '💎'];
  var count = mtLowEnd() ? 0 : (window.innerWidth < 600 ? 4 : 8);
  if (!count) return;
  for (var i = 0; i < count; i++) {
    var s = document.createElement('span');
    s.textContent = symbols[i % symbols.length];
    s.style.left = (Math.random() * 100).toFixed(2) + '%';
    s.style.fontSize = (12 + Math.random() * 10).toFixed(1) + 'px';
    s.style.animationDuration = (20 + Math.random() * 16).toFixed(1) + 's';
    s.style.animationDelay = (-Math.random() * 24).toFixed(1) + 's';
    c.appendChild(s);
  }
  document.body.appendChild(c);
}

function enhanceAnimations() {
  var content = document.getElementById('content');
  if (!content) return;
  var page = currentPage();
  if (page === _mtLastAnimPage) return;
  _mtLastAnimPage = page;
  if (mtReducedMotion()) return;

  content.classList.remove('mt-animating');
  void content.offsetWidth;
  content.classList.add('mt-animating');
  mtCountUp(content);

  setTimeout(function () {
    content.classList.remove('mt-animating');
  }, 850);
}

function mtInitRipple() {
  if (mtReducedMotion()) return;
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.btn, .icon-btn');
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.1;
    var ripple = document.createElement('span');
    ripple.className = 'mt-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    ripple.style.background = btn.classList.contains('btn-primary')
      ? 'rgba(5,20,15,.28)' : 'rgba(255,255,255,.38)';
    btn.appendChild(ripple);
    setTimeout(function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 680);
  }, true);
}

function mtInitLiquidGlass() {
  if (mtReducedMotion()) return;
  if (!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches)) return;
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  var tX = 50, tY = 50, cX = 50, cY = 50, raf = null, active = false;
  function tick() {
    var dx = tX - cX, dy = tY - cY;
    cX += dx * 0.14;
    cY += dy * 0.14;
    sidebar.style.setProperty('--mx', cX.toFixed(2) + '%');
    sidebar.style.setProperty('--my', cY.toFixed(2) + '%');
    if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15 || active) raf = requestAnimationFrame(tick);
    else raf = null;
  }
  function ensure() { if (!raf) raf = requestAnimationFrame(tick); }
  sidebar.addEventListener('pointerenter', function (e) {
    active = true; sidebar.classList.add('mt-glowing');
    var r = sidebar.getBoundingClientRect();
    tX = ((e.clientX - r.left) / r.width) * 100;
    tY = ((e.clientY - r.top) / r.height) * 100;
    cX = tX; cY = tY;
    sidebar.style.setProperty('--mx', cX.toFixed(2) + '%');
    sidebar.style.setProperty('--my', cY.toFixed(2) + '%');
    ensure();
  }, { passive: true });
  sidebar.addEventListener('pointermove', function (e) {
    var r = sidebar.getBoundingClientRect();
    tX = ((e.clientX - r.left) / r.width) * 100;
    tY = ((e.clientY - r.top) / r.height) * 100;
    ensure();
  }, { passive: true });
  sidebar.addEventListener('pointerleave', function () {
    active = false; sidebar.classList.remove('mt-glowing');
    tX = 50; tY = 50; ensure();
  }, { passive: true });
}

/* ============================================================
   BAGIAN 40 — SPLASH SCREEN
   ============================================================ */

var MT_SPLASH_KEY = 'mt_splash_last_shown';

function mtShowSplash() {
  if (mtReducedMotion()) return;
  try {
    var last = parseInt(sessionStorage.getItem(MT_SPLASH_KEY) || '0', 10);
    if (Date.now() - last < 60000) return;
    sessionStorage.setItem(MT_SPLASH_KEY, String(Date.now()));
  } catch (e) {}
  if (document.getElementById('mtSplash')) return;

  var h = new Date().getHours();
  var hi = h < 4 ? 'malam' : h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 19 ? 'sore' : 'malam';
  var word = 'MoneyTrack'.split('').map(function (ch, i) { return '<span style="--i:' + i + '">' + ch + '</span>'; }).join('');
  var splash = document.createElement('div');
  splash.id = 'mtSplash'; splash.className = 'sp2'; splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML =
    '<div class="sp-aurora"><i style="--x:-26vmin;--y:-22vmin"></i><i style="--x:28vmin;--y:8vmin"></i><i style="--x:-6vmin;--y:32vmin"></i></div>' +
    '<div class="sp-center">' +
      '<div class="sp-mark"><svg viewBox="0 0 64 64"><defs><linearGradient id="mtg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35D39A"/><stop offset="1" stop-color="#65D8F2"/></linearGradient></defs>' +
        '<rect width="64" height="64" rx="18" fill="url(#mtg3)"/><path class="sp-m" pathLength="1" d="M16 44V22l16 14 16-14v22"/>' +
        '<circle class="sp-ring" cx="48" cy="17" r="5"/><circle class="sp-coin" cx="48" cy="17" r="5" fill="#FFE9A3"/></svg></div>' +
      '<div class="sp-word">' + word + '</div>' +
      '<div class="sp-tag">Atur duit, tanpa drama.</div>' +
    '</div>' +
    '<div class="sp-hi">Selamat ' + hi + ' 👋 • ketuk untuk lanjut</div>';
  if (document.body.firstChild) document.body.insertBefore(splash, document.body.firstChild);
  else document.body.appendChild(splash);

  /* Suara disinkronkan dengan animasi (hanya kalau browser sudah mengizinkan audio) */
  var timers = [], done = false;
  try {
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) {
      _mtSplashSounded = true;
      var cue = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
      cue(380, function () { mtTone({ type: 'sine', freqStart: 220, freqEnd: 880, dur: 0.55, gain: 0.3, force: true }); });
      cue(1050, function () { mtTone({ type: 'triangle', freqStart: 1568, dur: 0.2, gain: 0.7, force: true }); });
      cue(1130, function () { mtTone({ type: 'triangle', freqStart: 2093, dur: 0.25, gain: 0.5, force: true }); });
      cue(1350, function () { mtArp([659.25, 783.99, 987.77, 1318.51], 75, 0.5, 0.75); });
    }
  } catch (e) {}

  function finish() {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    splash.classList.add('mt-hide');
    try { if (_mtSplashSounded) mtTone({ type: 'sine', freqStart: 900, freqEnd: 300, dur: 0.35, gain: 0.22, force: true }); } catch (e) {}
    setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 800);
  }
  splash.addEventListener('pointerdown', finish);
  setTimeout(finish, 2600);
}

/* ============================================================
   BAGIAN 42 — PREMIUM LAYER (v2.1)
   Suara berlapis, boot chime, SW fix, safety net, mode hemat
   ============================================================ */

var MT_LOGO_SVG = '<svg class="logo-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mtg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35D39A"/><stop offset="1" stop-color="#65D8F2"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#mtg2)"/><path d="M16 44V22l16 14 16-14v22" fill="none" stroke="#06241A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="17" r="5" fill="#FFE9A3"/></svg>';

function mtLowEnd() {
  try {
    var mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    return mem <= 3 || cores <= 4;
  } catch (e) { return false; }
}

/* Bus audio: lowpass + compressor biar suara lembut & anti-pecah */
var _mtBus = null;
function mtSfxBus(ctx) {
  if (_mtBus && _mtBus.ctx === ctx) return _mtBus.input;
  var input = ctx.createGain(), lp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor();
  lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.5;
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  input.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
  _mtBus = { ctx: ctx, input: input };
  return input;
}

function mtArp(freqs, step, dur, gain) {
  freqs.forEach(function (f, i) {
    setTimeout(function () {
      mtTone({ type: 'sine', freqStart: f, dur: dur || 0.22, gain: gain || 1, force: true });
    }, i * step);
  });
}

var _mtNavFreq = 660, _mtLowT = 0, _mtBootAt = 0;
var MT_LOW = { tap: 1, nav: 1, open: 1, close: 1, toggleOn: 1, toggleOff: 1,
               open_modal: 1, close_modal: 1, income: 1, expense: 1 };

MT_SOUND.boot    = function () { mtArp([523.25, 659.25, 783.99, 1046.5], 90, 0.35, 0.8); };
MT_SOUND.income  = function () { mtArp([659.25, 880, 1174.66], 70, 0.2, 1); };
MT_SOUND.expense = function () { mtArp([523.25, 392], 80, 0.2, 0.8); };
MT_SOUND.nav     = function () { mtTone({ type: 'sine', freqStart: _mtNavFreq * 0.85, freqEnd: _mtNavFreq, dur: 0.12, gain: 0.9 }); };

/* Tiap halaman punya nada beda (skala pentatonik) */
function mtNavSound(pageId) {
  var scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5], idx = 0;
  for (var i = 0; i < PAGES.length; i++) { if (PAGES[i].id === pageId) { idx = i; break; } }
  _mtNavFreq = scale[idx % scale.length];
  mtPlay('nav');
}

/* Anti error global: satu toast ramah, tidak spam */
var _mtErrAt = 0;
function mtErrToast() {
  var n = Date.now();
  if (n - _mtErrAt < 6000) return;
  _mtErrAt = n;
  toast('Ada kendala kecil, coba ulangi aksinya.', 'warn');
}

function mtRegisterSW() {
  if (!('serviceWorker' in navigator)) return;
  var reg = function () { navigator.serviceWorker.register('sw.js').catch(function () {}); };
  if (document.readyState === 'complete') reg();
  else window.addEventListener('load', reg, { once: true });
}

function mtPremiumInit() {
  if (mtLowEnd()) document.documentElement.classList.add('mt-lite');

  /* Hemat baterai: animasi & audio berhenti saat tab/app di background */
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('mt-paused', document.hidden);
    var ctx = mtAudioCtx;
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) {}
  });

  /* Browser melarang autoplay: chime pembuka diputar di sentuhan pertama */
  document.addEventListener('pointerdown', function () {
    if (Date.now() - mtPageLoadTime > 20000) return;
    _mtBootAt = Date.now();
    mtPlay('boot');
  }, { once: true, passive: true });

  window.addEventListener('error', function (e) { console.error(e.error || e.message); mtErrToast(); });
  window.addEventListener('unhandledrejection', function (e) { console.error(e.reason); mtErrToast(); });

  mtRegisterSW();
  try {
    var go = new URLSearchParams(location.search).get('go');
    if (go && PAGES.some(function (p) { return p.id === go; })) navigate(go);
  } catch (e) {}
}


/* ============================================================
   BAGIAN 43 — MESIN ANALISIS v3 (on-device, tanpa server)
   ============================================================ */
function mtDaysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function mtClamp(x) { return Math.max(0, Math.min(100, x)); }

function mtBrain(b) {
  var today = todayISO(), T = parseISO(today);
  var dayAt = function (n) { return isoOf(new Date(T.getFullYear(), T.getMonth(), T.getDate() - n)); };
  var d7 = dayAt(6), d28 = dayAt(27), d30 = dayAt(29), mk = monthKey(today);
  var byDay = {}, byBud = {}, cat7 = {}, catPrev = {}, incomes = [], inc30 = 0, saved30 = 0, dep28 = 0, monthSpent = 0;

  allTx().forEach(function (t) {
    var a = Number(t.amount) || 0;
    if (t.type === 'expense') {
      byDay[t.date] = (byDay[t.date] || 0) + a;
      if (!isNeedTx(t)) byBud[t.date] = (byBud[t.date] || 0) + a;
      if (monthKey(t.date) === mk) monthSpent += a;
      if (t.category !== 'Bayar Utang') {
        var c = t.category || 'Lainnya';
        if (t.date >= d7) cat7[c] = (cat7[c] || 0) + a;
        else if (t.date >= d28) catPrev[c] = (catPrev[c] || 0) + a;
      }
    } else if (t.type === 'income') {
      if (t.date >= d30 && t.category !== 'Pinjaman Masuk') inc30 += a;
      if (t.isSnackAllowance || t.category === 'Uang Jajan') incomes.push({ d: t.date, a: a });
    } else if (t.type === 'transfer' && t.from === 'main' && (t.to === 'emergency' || t.to === 'savings')) {
      if (t.date >= d30) saved30 += a;
      if (t.to === 'emergency' && t.date >= d28) dep28 += a;
    } else if (t.type === 'goldBuy' && t.date >= d30) { saved30 += a; }
  });

  var series = [];
  for (var i = 13; i >= 0; i--) { var iso = dayAt(i); series.push({ iso: iso, v: byDay[iso] || 0, bud: byBud[iso] || 0 }); }
  var vals = series.map(function (x) { return x.v; });
  var sum14 = vals.reduce(function (s, v) { return s + v; }, 0), max14 = Math.max.apply(null, vals);
  var active = vals.filter(function (v) { return v > 0; }).length;
  var burn = active >= 3 ? (sum14 - max14) / 13 : sum14 / 14;   /* buang 1 lonjakan supaya tidak bias */
  var med = vals.slice().sort(function (x, y) { return x - y; })[7] || 0;

  var wd = [0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < 28; i++) { var di = dayAt(i); wd[parseISO(di).getDay()] += byDay[di] || 0; }
  var topWd = 0; for (i = 1; i < 7; i++) if (wd[i] > wd[topWd]) topWd = i;

  /* Siklus uang jajan: tebak kapan pemasukan berikutnya */
  incomes.sort(function (x, y) { return x.d < y.d ? -1 : 1; });
  var gaps = [];
  for (i = 1; i < incomes.length; i++) gaps.push(mtDaysBetween(incomes[i - 1].d, incomes[i].d));
  gaps = gaps.filter(function (g) { return g > 0; }).sort(function (x, y) { return x - y; });
  var gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 7, left = 7;
  if (incomes.length) { left = mtDaysBetween(today, isoOf(new Date(parseISO(incomes[incomes.length - 1].d).getTime() + gap * 86400000))); if (left < 1) left = 1; if (left > 31) left = 31; }
  var horizon = isoOf(new Date(T.getFullYear(), T.getMonth(), T.getDate() + left));

  var upcoming = 0, lateP = 0;
  state.predictions.forEach(function (p) {
    if (p.status !== 'planned') return;
    if (p.date >= today && p.date <= horizon) upcoming += Number(p.amount) || 0;
    if (p.date < today) lateP++;
  });
  var dueDebt = 0, overdue = 0;
  state.debts.forEach(function (d) {
    if (d.status !== 'active' || d.type !== 'owed') return;
    var rest = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
    if (d.dueDate && d.dueDate <= horizon) dueDebt += rest;
    if (d.dueDate && d.dueDate < today) overdue++;
  });
  var safeDaily = Math.max(0, Math.floor((b.main - upcoming - dueDebt) / left / 500) * 500);
  if (dailyBudgetFor(today) > 0) safeDaily = Math.min(safeDaily, dailyBudgetFor(today));
  var runway = burn > 0 ? Math.max(0, b.main) / burn : null;
  var dim = new Date(T.getFullYear(), T.getMonth() + 1, 0).getDate();
  var proj = monthSpent + burn * Math.max(0, dim - T.getDate());

  var tgtE = Number(state.emergency.target) || 0, savedRate = inc30 > 0 ? saved30 / inc30 : 0;
  var okDays = series.filter(function (x) { return x.bud <= dailyBudgetFor(x.iso); }).length;
  var comp = {
    buffer: runway === null ? 80 : mtClamp(runway / 21 * 100),
    discipline: mtClamp(okDays / 14 * 100),
    saving: inc30 > 0 ? mtClamp(savedRate / 0.2 * 100) : (saved30 > 0 ? 70 : 30),
    emergency: tgtE > 0 ? mtClamp(b.emergency / tgtE * 100) : 60,
    debt: mtClamp(100 - overdue * 40)
  };
  var score = Math.round(comp.buffer * 0.30 + comp.discipline * 0.25 + comp.saving * 0.20 + comp.emergency * 0.15 + comp.debt * 0.10);
  if (b.unidentified > 0) score -= 8;
  if (b.main < 0) score = Math.min(score, 20);
  score = Math.max(0, Math.min(100, score));
  var level = score >= 80 ? 'Sangat Sehat' : score >= 60 ? 'Sehat' : score >= 40 ? 'Perlu Perhatian' : 'Kritis';

  var anomalies = [];
  series.filter(function (x) { return x.v >= 30000 && x.v > Math.max(med, 1) * 2.5; })
    .sort(function (x, y) { return y.v - x.v; }).slice(0, 2).forEach(function (x) {
      anomalies.push('Pengeluaran ' + fmtTanggalPendek(x.iso) + ' sebesar <b>' + rupiah(x.v) + '</b> (' + (x.v / Math.max(burn, 1)).toFixed(1) + '× rata-rata harianmu).');
    });
  Object.keys(cat7).sort(function (x, y) { return cat7[y] - cat7[x]; }).forEach(function (c) {
    if (anomalies.length >= 4) return;
    var pw = (catPrev[c] || 0) / 3;
    if (cat7[c] >= 20000 && cat7[c] > pw * 1.5) {
      anomalies.push(pw > 0 ? c + ' minggu ini <b>' + rupiah(cat7[c]) + '</b>, naik ' + Math.round((cat7[c] / pw - 1) * 100) + '% dari rata-rata mingguan.'
                            : c + ' muncul sebagai pengeluaran baru minggu ini: <b>' + rupiah(cat7[c]) + '</b>.');
    }
  });

  var acts = [];
  var add = function (pr, icon, title, text, tone) { acts.push({ pr: pr, icon: icon, title: title, text: text, tone: tone }); };
  if (b.main < 0) add(100, '🚨', 'Saldo minus', 'Total uang likuid negatif ' + rupiah(b.main) + '. Hentikan pengeluaran non-esensial dan cek transaksi yang salah catat.', 'crit');
  if (b.unidentified > 0) add(90, '🧾', 'Selesaikan rekonsiliasi', 'Ada selisih ' + rupiah(b.unidentified) + ' yang belum teridentifikasi, analisis jadi kurang akurat.', 'warn');
  if (overdue) add(85, '⏰', 'Utang lewat jatuh tempo', overdue + ' utang sudah lewat tempo. Bayar duluan sebelum menabung.', 'crit');
  if (runway !== null && runway < 7 && b.main >= 0) add(80, '⛽', 'Uang hanya cukup ±' + Math.floor(runway) + ' hari', 'Dengan pola jajan sekarang (' + rupiah(burn) + '/hari). Turunkan ke maksimal ' + rupiah(safeDaily) + '/hari sampai pemasukan berikutnya.', 'crit');
  if (spentToday() > dailyBudgetFor(today) && dailyBudgetFor(today) > 0) add(70, '📉', 'Anggaran hari ini terlampaui', 'Lebih ' + rupiah(spentToday() - dailyBudgetFor(today)) + '. Besok kompensasi dengan jajan lebih ringan.', 'warn');
  if (anomalies.length) add(60, '⚡', 'Ada lonjakan pengeluaran', anomalies[0], 'warn');
  if (lateP) add(55, '🔮', lateP + ' prediksi lewat tanggal', 'Catat sebagai pengeluaran atau batalkan supaya proyeksi tetap akurat.', 'info');
  if (inc30 > 0 && savedRate < 0.2 && b.main - upcoming - dueDebt > 20000) {
    var need = Math.max(0, Math.floor((inc30 * 0.2 - saved30) / 1000) * 1000);
    if (need >= 1000) add(50, '💰', 'Sisihkan ' + rupiah(Math.min(need, Math.floor(safeDaily * left * 0.3 / 1000) * 1000 || need)), 'Target ideal 20% dari pemasukan 30 hari. Baru tersisih ' + Math.round(savedRate * 100) + '%.', 'info');
  }
  var etaTxt = '';
  if (tgtE > b.emergency) {
    var wk = dep28 / 4;
    etaTxt = wk > 0 ? 'Dengan ritme setoran sekarang, dana darurat tercapai ±' + Math.ceil((tgtE - b.emergency) / wk) + ' minggu lagi.' : 'Belum ada setoran dana darurat 4 minggu terakhir.';
    add(40, '🛡️', 'Dana darurat ' + Math.round(b.emergency / tgtE * 100) + '%', etaTxt, 'info');
  }
  if (!acts.length) add(10, '✅', 'Keuanganmu stabil', 'Pertahankan pola ini. Hari paling boros biasanya ' + HARI[topWd] + ', jadi siapkan jatah lebih.', 'good');
  acts.sort(function (x, y) { return y.pr - x.pr; });

  var headline = b.main <= 0 ? 'Uang likuid habis. Fokus pulihkan saldo dulu.'
    : 'Aman jajan maksimal <b>' + rupiah(safeDaily) + '/hari</b> selama ±' + left + ' hari ke pemasukan berikutnya.';
  return { score: score, level: level, comp: comp, burn: burn, runway: runway, safeDaily: safeDaily, left: left, proj: proj,
           series: series, anomalies: anomalies, actions: acts.slice(0, 5), headline: headline, topWd: topWd, savedRate: savedRate };
}
function spentToday() { return sumBudgetOn(todayISO()); }

function mtScoreColor(s) { return s >= 80 ? 'var(--emerald)' : s >= 60 ? 'var(--cyan)' : s >= 40 ? 'var(--gold)' : 'var(--coral)'; }
function mtRing(score) {
  var c = 2 * Math.PI * 42;
  return '<svg class="mt-ring" viewBox="0 0 100 100" role="img" aria-label="Skor ' + score + ' dari 100"><circle cx="50" cy="50" r="42" class="trk"/>' +
    '<circle cx="50" cy="50" r="42" class="bar" transform="rotate(-90 50 50)" style="stroke:' + mtScoreColor(score) + ';stroke-dasharray:' + c.toFixed(1) +
    ';stroke-dashoffset:' + (c * (1 - score / 100)).toFixed(1) + '"/><text x="50" y="58" text-anchor="middle" class="sc">' + score + '</text></svg>';
}
function mtChip(ic, k, v) { return '<div class="mt-chip"><span class="k">' + ic + ' ' + k + '</span><span class="v">' + v + '</span></div>'; }
function mtHeroCard(b) {
  var a = mtBrain(b);
  return '<div class="card mt-hero"><div class="mt-hero-top">' + mtRing(a.score) +
    '<div><div class="mt-eyebrow">Skor kesehatan keuangan</div><div class="mt-level">' + a.level + '</div><div class="mt-sub">' + a.headline + '</div></div></div>' +
    '<div class="mt-chips">' + mtChip('🔥', 'Burn/hari', rupiah(a.burn)) + mtChip('🛟', 'Aman/hari', rupiah(a.safeDaily)) +
    mtChip('⏳', 'Bertahan', a.runway === null ? '—' : Math.floor(a.runway) + ' hari') + '</div></div>';
}
function pageDashboard(b) { return mtHeroCard(b) + pageDashboardBase(b); }

var MT_COMP_LABEL = { buffer: ['🛟', 'Bantalan uang'], discipline: ['🎯', 'Disiplin anggaran'], saving: ['💰', 'Rasio menabung'], emergency: ['🛡️', 'Dana darurat'], debt: ['🤝', 'Kesehatan utang'] };
function pageAI(b) {
  var a = mtBrain(b);
  var html = mtHeroCard(b).replace('Skor kesehatan keuangan', 'Analisis On-Device • Skor kesehatan');
  html += '<div class="grid grid-2">' +
    statCard('Proyeksi akhir bulan', rupiah(a.proj), '📈', 'val-cyan', 'pengeluaran bulan ini') +
    statCard('Hari paling boros', HARI[a.topWd], '📅', 'val-gold', '4 minggu terakhir') + '</div>';
  html += '<div class="card"><div class="card-title"><span class="ic">🧭</span> Prioritas untukmu</div>' +
    a.actions.map(function (x) { return '<div class="advice mt-act ' + x.tone + '"><div class="hd"><strong>' + x.icon + ' ' + x.title + '</strong></div><p>' + x.text + '</p></div>'; }).join('') + '</div>';
  html += '<div class="card"><div class="card-title"><span class="ic">📊</span> Pengeluaran 14 hari <span class="badge info">merah = lewat anggaran</span></div>' +
    barChart(a.series.map(function (x) { return { label: x.iso.slice(8), value: x.v, color: x.bud > dailyBudgetFor(x.iso) ? '#FF6B78' : '#35D39A' }; }), 150) + '</div>';
  html += '<div class="card"><div class="card-title"><span class="ic">🧬</span> Komponen skor</div>' +
    Object.keys(a.comp).map(function (k) {
      var v = Math.round(a.comp[k]);
      return '<div class="kv"><span class="k">' + MT_COMP_LABEL[k][0] + ' ' + MT_COMP_LABEL[k][1] + '</span><span class="v">' + v + '</span></div><div class="mt-bar"><i style="width:' + v + '%;background:' + mtScoreColor(v) + '"></i></div>';
    }).join('') + '</div>';
  if (a.anomalies.length) html += '<div class="card"><div class="card-title"><span class="ic">🔎</span> Anomali terdeteksi</div>' +
    a.anomalies.map(function (t) { return '<div class="advice"><p>' + t + '</p></div>'; }).join('') + '</div>';
  return html + pageAIClassic(b);
}

function mtCountUp(root) {
  if (mtReducedMotion() || !root.querySelectorAll) return;
  var els = root.querySelectorAll('.stat .val, .stat .v, .kv .v, .mt-chip .v'), n = 0, jobs = [];
  for (var i = 0; i < els.length && n < 24; i++) {
    var el = els[i]; if (el.children.length) continue;
    var m = /^(-?)Rp[\s\u00a0]*([\d.]+)$/.exec((el.textContent || '').trim());
    if (!m) continue;
    var target = parseInt(m[2].replace(/\./g, ''), 10); if (!target) continue;
    jobs.push({ el: el, final: el.textContent, sign: m[1] ? -1 : 1, target: target }); n++;
  }
  if (!jobs.length) return;
  var tok = (mtCountUp.tok = (mtCountUp.tok || 0) + 1), t0 = performance.now();
  function frame(now) {
    if (tok !== mtCountUp.tok) return;
    var p = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - p, 3);
    jobs.forEach(function (j) { j.el.textContent = p >= 1 ? j.final : rupiah(j.sign * Math.round(j.target * e)); });
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

var _mtSplashSounded = false;
MT_SOUND.boot = function () { mtArp([523.25, 659.25, 783.99, 1046.5, 1318.51], 70, 0.45, 0.8); };

function openDrawer() {
  document.body.classList.add('drawer-open');
  var d = $('#drawerBackdrop');
  if (d) d.classList.add('open');
}
function closeDrawer() {
  document.body.classList.remove('drawer-open');
  var d = $('#drawerBackdrop');
  if (d) d.classList.remove('open');
}

/* ============================================================
   BAGIAN 41 — INIT
   ============================================================ */

function bindGlobalEvents() {
  document.addEventListener('click', function (e) {
  mtGlobalClickSound(e);

  /* Tombol nominal cepat */
  var qaEl = e.target.closest('[data-quickamt]');
  if (qaEl) {
    var targetId = qaEl.dataset.quicktarget;
    var qaAmount = parseInt(qaEl.dataset.quickamt, 10) || 0;
    var targetEl = document.getElementById(targetId);
    if (targetEl) {
      if (qaAmount === 0) targetEl.value = '';
      else targetEl.value = qaAmount;
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  var navEl = e.target.closest('[data-nav]');
    if (navEl) {
      var pid = navEl.dataset.nav;
      if (pid === 'menu') openDrawer();
      else navigate(pid);
      return;
    }

    var calEl = e.target.closest('[data-cal]');
    if (calEl) { showCalendarDetail(calEl.dataset.cal); return; }

    var actEl = e.target.closest('[data-act]');
    if (actEl) { handleAction(actEl.dataset.act, actEl); return; }
  });

  var bm = $('#btnMenu');
  if (bm) bm.addEventListener('click', openDrawer);

  var bt = $('#btnTheme');
  if (bt) bt.addEventListener('click', function () {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(); saveState();
    toast('Tema: ' + (state.settings.theme === 'light' ? 'Terang' : 'Gelap'), 'ok');
  });

  var db = $('#drawerBackdrop');
  if (db) db.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var m = $('#modalRoot');
      if (m && m.classList.contains('open')) closeModal();
      else closeDrawer();
    }
  });
}

function init() {
  mtShowSplash();
  loadState();
  applyTheme();
  mtInitParticles();
  mtInitRipple();
  mtInitLiquidGlass();
  mtAudioSetupAutoStart();
  bindGlobalEvents();
  renderPage();

  mtPremiumInit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
