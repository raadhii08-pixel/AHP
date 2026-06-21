// =========================================
// STATE
// =========================================
const DEFAULT_KRITERIA = [
  { kode: "C1", nama: "Harga (Rp)",    jenis: "Cost" },
  { kode: "C2", nama: "RAM (GB)",      jenis: "Benefit" },
  { kode: "C3", nama: "Baterai (mAh)", jenis: "Benefit" },
  { kode: "C4", nama: "Kamera (skor)", jenis: "Benefit" },
  { kode: "C5", nama: "Berat (gram)",  jenis: "Cost" },
];

// Default pairwise comparison (skala Saaty), urutan kepentingan: Harga > RAM > Baterai > Kamera > Berat
// disimpan sebagai matriks lengkap n x n
const DEFAULT_PAIRWISE = [
  [1,   2,   3,   4,   5],
  [0.5, 1,   2,   3,   4],
  [1/3, 0.5, 1,   2,   3],
  [0.25, 1/3, 0.5, 1,   2],
  [0.2, 0.25, 1/3, 0.5, 1],
];

const DEFAULT_ALTERNATIF = [
  { nama: "S1 - Phantom X", nilai: [3500000, 6, 5000, 85, 190] },
  { nama: "S2 - Velora 5G", nilai: [4200000, 8, 4500, 90, 175] },
  { nama: "S3 - Nexora Pro", nilai: [2800000, 4, 5000, 75, 200] },
  { nama: "S4 - Astra Lite", nilai: [3100000, 6, 4000, 80, 165] },
];

// Skala Saaty yang valid untuk dropdown (1-9 dan kebalikannya)
const SAATY_OPTIONS = [
  { value: 9, label: "9 - Mutlak lebih penting" },
  { value: 8, label: "8" },
  { value: 7, label: "7 - Jauh lebih penting" },
  { value: 6, label: "6" },
  { value: 5, label: "5 - Lebih penting" },
  { value: 4, label: "4" },
  { value: 3, label: "3 - Sedikit lebih penting" },
  { value: 2, label: "2" },
  { value: 1, label: "1 - Sama penting" },
  { value: 1/2, label: "1/2" },
  { value: 1/3, label: "1/3 - Sedikit kurang penting" },
  { value: 1/4, label: "1/4" },
  { value: 1/5, label: "1/5 - Kurang penting" },
  { value: 1/6, label: "1/6" },
  { value: 1/7, label: "1/7 - Jauh kurang penting" },
  { value: 1/8, label: "1/8" },
  { value: 1/9, label: "1/9 - Mutlak kurang penting" },
];

const RI_TABLE = {1:0, 2:0, 3:0.58, 4:0.9, 5:1.12, 6:1.24, 7:1.32, 8:1.41, 9:1.45, 10:1.49, 11:1.51, 12:1.48, 13:1.56, 14:1.57, 15:1.59};

let kriteria = [];
let pairwise = [];
let alternatif = [];
let kriteriaCounter = 0;
let bobotAHP = null; // hasil hitung bobot, null kalau belum dihitung / sudah invalid
let crValue = null;

function cloneDefault() {
  kriteria = JSON.parse(JSON.stringify(DEFAULT_KRITERIA));
  pairwise = JSON.parse(JSON.stringify(DEFAULT_PAIRWISE));
  alternatif = JSON.parse(JSON.stringify(DEFAULT_ALTERNATIF));
  kriteriaCounter = kriteria.length;
  bobotAHP = null;
  crValue = null;
}

// =========================================
// RENDER: TABEL KRITERIA
// =========================================
function renderKriteria() {
  const tbody = document.getElementById("tabel-kriteria");
  tbody.innerHTML = "";
  kriteria.forEach((k, j) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${k.kode}</td>
      <td><input type="text" class="form-control form-control-sm nama-input" value="${k.nama}"
            onchange="updateKriteriaNama(${j}, this.value)"></td>
      <td>
        <select class="form-select form-select-sm" onchange="updateKriteriaJenis(${j}, this.value)">
          <option value="Benefit" ${k.jenis === "Benefit" ? "selected" : ""}>Benefit</option>
          <option value="Cost" ${k.jenis === "Cost" ? "selected" : ""}>Cost</option>
        </select>
      </td>
      <td><button class="btn btn-sm btn-outline-danger btn-hapus" onclick="hapusKriteria(${j})"
            ${kriteria.length <= 2 ? "disabled" : ""}>&times;</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateKriteriaNama(j, val) {
  kriteria[j].nama = val;
  renderPairwise(); // label kriteria di header pairwise perlu ikut update
}
function updateKriteriaJenis(j, val) {
  kriteria[j].jenis = val;
}
function hapusKriteria(j) {
  if (kriteria.length <= 2) return; // minimal 2 kriteria untuk pairwise comparison
  kriteria.splice(j, 1);
  pairwise.splice(j, 1);
  pairwise.forEach(row => row.splice(j, 1));
  alternatif.forEach(a => a.nilai.splice(j, 1));
  invalidasiBobot();
  renderKriteria();
  renderPairwise();
  renderDataAlternatif();
}
function tambahKriteria() {
  kriteriaCounter++;
  kriteria.push({ kode: "C" + kriteriaCounter, nama: "Kriteria Baru", jenis: "Benefit" });
  // tambah baris & kolom baru ke pairwise, default 1 (sama penting) terhadap semua kriteria lain
  pairwise.forEach(row => row.push(1));
  const newRow = new Array(kriteria.length).fill(1);
  newRow[kriteria.length - 1] = 1;
  pairwise.push(newRow);
  alternatif.forEach(a => a.nilai.push(0));
  invalidasiBobot();
  renderKriteria();
  renderPairwise();
  renderDataAlternatif();
}

function invalidasiBobot() {
  bobotAHP = null;
  crValue = null;
  document.getElementById("bobot-area").classList.add("d-none");
}

// =========================================
// RENDER: PAIRWISE COMPARISON MATRIX
// =========================================
function renderPairwise() {
  const m = kriteria.length;
  const head = document.getElementById("head-pairwise");
  head.innerHTML = "<th></th>" + kriteria.map(k => `<th>${k.kode}</th>`).join("");

  const tbody = document.getElementById("body-pairwise");
  tbody.innerHTML = "";

  for (let i = 0; i < m; i++) {
    const tr = document.createElement("tr");
    let row = `<td class="fw-semibold text-start table-light">${kriteria[i].kode}<br><small>${kriteria[i].nama}</small></td>`;
    for (let j = 0; j < m; j++) {
      if (i === j) {
        row += `<td class="pairwise-diag">1</td>`;
      } else if (i < j) {
        // sel yang bisa diedit langsung (upper triangle)
        const currentVal = pairwise[i][j];
        const options = SAATY_OPTIONS.map(opt =>
          `<option value="${opt.value}" ${Math.abs(opt.value - currentVal) < 0.001 ? "selected" : ""}>${opt.label}</option>`
        ).join("");
        row += `<td><select class="form-select form-select-sm" onchange="updatePairwise(${i}, ${j}, this.value)">${options}</select></td>`;
      } else {
        // lower triangle = otomatis kebalikan dari upper triangle, read-only
        const val = pairwise[i][j];
        row += `<td class="text-muted">${formatPecahan(val)}</td>`;
      }
    }
    tr.innerHTML = row;
    tbody.appendChild(tr);
  }
}

function formatPecahan(val) {
  if (val >= 1) return val.toFixed(2);
  // tampilkan sebagai pecahan 1/x untuk keterbacaan
  const inv = 1 / val;
  return `1/${inv.toFixed(0)}`;
}

function updatePairwise(i, j, val) {
  const v = parseFloat(val);
  pairwise[i][j] = v;
  pairwise[j][i] = 1 / v;
  invalidasiBobot();
  renderPairwise(); // re-render supaya nilai kebalikan di lower triangle ikut update
}

// =========================================
// HITUNG BOBOT AHP & CONSISTENCY RATIO
// =========================================
function hitungBobotAHP() {
  const m = kriteria.length;

  // 1. Jumlah tiap kolom
  const colSum = new Array(m).fill(0);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) colSum[j] += pairwise[i][j];
  }

  // 2. Normalisasi matriks (tiap elemen dibagi jumlah kolomnya)
  const norm = pairwise.map(row => row.map((v, j) => v / colSum[j]));

  // 3. Bobot = rata-rata tiap baris matriks normalisasi
  const bobot = norm.map(row => row.reduce((s, v) => s + v, 0) / m);

  // 4. Consistency check: lambda max
  // Aw = matriks asli (pairwise) dikali vektor bobot
  const Aw = pairwise.map(row => row.reduce((s, v, j) => s + v * bobot[j], 0));
  const lambdaVec = Aw.map((v, i) => v / bobot[i]);
  const lambdaMax = lambdaVec.reduce((s, v) => s + v, 0) / m;

  const CI = (lambdaMax - m) / (m - 1);
  const RI = RI_TABLE[m] !== undefined ? RI_TABLE[m] : 1.59; // fallback untuk m > 15
  const CR = RI === 0 ? 0 : CI / RI;

  bobotAHP = bobot;
  crValue = CR;

  // render hasil
  document.getElementById("head-bobot-hasil").innerHTML =
    kriteria.map(k => `<th>${k.kode}</th>`).join("");
  document.getElementById("body-bobot-hasil").innerHTML =
    "<tr>" + bobot.map(w => `<td>${w.toFixed(4)}</td>`).join("") + "</tr>";

  document.getElementById("lambda-max").textContent = lambdaMax.toFixed(4);
  document.getElementById("ci-value").textContent = CI.toFixed(4);
  document.getElementById("ri-value").textContent = RI.toFixed(2);
  document.getElementById("cr-value").textContent = CR.toFixed(4);

  const statusEl = document.getElementById("cr-status");
  if (CR <= 0.1) {
    statusEl.textContent = "✓ Konsisten (CR ≤ 0.1), bobot valid digunakan.";
    statusEl.className = "ms-2 cr-ok";
  } else {
    statusEl.textContent = "✗ Tidak konsisten (CR > 0.1). Perbaiki nilai perbandingan sebelum melanjutkan.";
    statusEl.className = "ms-2 cr-bad";
  }

  document.getElementById("bobot-area").classList.remove("d-none");
}

// =========================================
// RENDER: TABEL DATA ALTERNATIF
// =========================================
function renderDataAlternatif() {
  const head = document.getElementById("head-data-alternatif");
  head.innerHTML = "<tr><th>Alternatif</th>" +
    kriteria.map(k => `<th>${k.kode}<br><small>${k.nama}</small></th>`).join("") +
    "<th></th></tr>";

  const tbody = document.getElementById("tabel-data-alternatif");
  tbody.innerHTML = "";
  alternatif.forEach((a, i) => {
    const tr = document.createElement("tr");
    let row = `<td><input type="text" class="form-control form-control-sm nama-input" value="${a.nama}"
                  onchange="updateAlternatifNama(${i}, this.value)"></td>`;
    kriteria.forEach((k, j) => {
      row += `<td><input type="number" step="any" class="form-control form-control-sm" value="${a.nilai[j]}"
                onchange="updateAlternatifNilai(${i}, ${j}, this.value)"></td>`;
    });
    row += `<td><button class="btn btn-sm btn-outline-danger btn-hapus" onclick="hapusAlternatif(${i})"
              ${alternatif.length <= 1 ? "disabled" : ""}>&times;</button></td>`;
    tr.innerHTML = row;
    tbody.appendChild(tr);
  });
}

function updateAlternatifNama(i, val) {
  alternatif[i].nama = val;
}
function updateAlternatifNilai(i, j, val) {
  alternatif[i].nilai[j] = parseFloat(val) || 0;
}
function hapusAlternatif(i) {
  if (alternatif.length <= 1) return;
  alternatif.splice(i, 1);
  renderDataAlternatif();
}
function tambahAlternatif() {
  const nilaiBaru = kriteria.map(() => 0);
  alternatif.push({ nama: "Alternatif Baru", nilai: nilaiBaru });
  renderDataAlternatif();
}

function resetData() {
  cloneDefault();
  renderKriteria();
  renderPairwise();
  renderDataAlternatif();
  document.getElementById("error-area").classList.add("d-none");
  document.getElementById("hasil-area").classList.add("d-none");
  document.getElementById("bobot-area").classList.add("d-none");
}

// =========================================
// VALIDASI & HITUNG RANKING
// =========================================
function showError(msg) {
  const el = document.getElementById("error-area");
  el.textContent = msg;
  el.classList.remove("d-none");
  document.getElementById("hasil-area").classList.add("d-none");
}

function hitungRanking() {
  document.getElementById("error-area").classList.add("d-none");

  if (bobotAHP === null) {
    showError("Hitung bobot kriteria (Langkah 2) terlebih dahulu sebelum menghitung ranking.");
    return;
  }
  if (crValue > 0.1) {
    showError(`Consistency Ratio (CR = ${crValue.toFixed(4)}) melebihi 0.1. Perbaiki nilai perbandingan berpasangan di Langkah 2 sebelum melanjutkan.`);
    return;
  }
  if (alternatif.length < 1 || kriteria.length < 2) {
    showError("Minimal harus ada 1 alternatif dan 2 kriteria.");
    return;
  }
  for (let j = 0; j < kriteria.length; j++) {
    if (kriteria[j].jenis === "Cost") {
      for (let i = 0; i < alternatif.length; i++) {
        if (alternatif[i].nilai[j] === 0) {
          showError(`Nilai kriteria Cost (${kriteria[j].kode}) pada "${alternatif[i].nama}" tidak boleh 0.`);
          return;
        }
      }
    }
  }

  const n = alternatif.length;
  const m = kriteria.length;
  const X = alternatif.map(a => a.nilai);

  // Langkah A: Matriks keputusan
  document.getElementById("head-matriks-x").innerHTML =
    "<th>Alternatif</th>" + kriteria.map(k => `<th>${k.kode}<br><small>${k.nama}</small></th>`).join("");
  const bodyX = document.getElementById("body-matriks-x");
  bodyX.innerHTML = "";
  X.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="fw-semibold text-start">${alternatif[i].nama}</td>` +
      row.map(v => `<td>${v}</td>`).join("");
    bodyX.appendChild(tr);
  });

  // Langkah B: Normalisasi (ala SAW)
  const maxj = [], minj = [];
  for (let j = 0; j < m; j++) {
    const col = X.map(row => row[j]);
    maxj.push(Math.max(...col));
    minj.push(Math.min(...col));
  }
  const R = X.map(row => row.map((v, j) => {
    if (kriteria[j].jenis === "Benefit") return maxj[j] === 0 ? 0 : v / maxj[j];
    return v === 0 ? 0 : minj[j] / v;
  }));

  document.getElementById("head-normalisasi").innerHTML =
    "<th>Alternatif</th>" + kriteria.map(k => `<th>${k.kode}</th>`).join("");
  const bodyNorm = document.getElementById("body-normalisasi");
  bodyNorm.innerHTML = "";
  R.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="fw-semibold text-start">${alternatif[i].nama}</td>` +
      row.map(v => `<td>${v.toFixed(4)}</td>`).join("");
    bodyNorm.appendChild(tr);
  });

  // Langkah C: Nilai preferensi Vi
  document.getElementById("head-v").innerHTML = "<th>Alternatif</th>" +
    kriteria.map((k, j) => `<th>${k.kode}<br><small>(Wj=${bobotAHP[j].toFixed(4)})</small></th>`).join("") + "<th>Vi</th>";

  const bodyV = document.getElementById("body-v");
  bodyV.innerHTML = "";
  const Vi = [];
  R.forEach((row, i) => {
    const kontribusi = row.map((rij, j) => bobotAHP[j] * rij);
    const total = kontribusi.reduce((s, v) => s + v, 0);
    Vi.push(total);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="fw-semibold text-start">${alternatif[i].nama}</td>` +
      kontribusi.map(v => `<td>${v.toFixed(4)}</td>`).join("") +
      `<td class="fw-bold">${total.toFixed(4)}</td>`;
    bodyV.appendChild(tr);
  });

  // Langkah D: Ranking
  const ranking = alternatif.map((a, i) => ({ nama: a.nama, vi: Vi[i] })).sort((a, b) => b.vi - a.vi);
  const bodyRank = document.getElementById("tabel-ranking");
  bodyRank.innerHTML = "";
  ranking.forEach((item, idx) => {
    const tr = document.createElement("tr");
    if (idx === 0) tr.classList.add("best-row");
    tr.innerHTML = `<td>${idx + 1}</td><td class="text-start">${item.nama}</td><td>${item.vi.toFixed(4)}</td>`;
    bodyRank.appendChild(tr);
  });

  document.getElementById("rekomendasi-terbaik").textContent =
    `${ranking[0].nama} (Vi = ${ranking[0].vi.toFixed(4)})`;
  document.getElementById("hasil-area").classList.remove("d-none");
  document.getElementById("hasil-area").scrollIntoView({ behavior: "smooth" });

  if (window.simpanHistoryAhp) {
    window.simpanHistoryAhp({
      jumlahAlternatif: alternatif.length,
      jumlahKriteria: kriteria.length,
      cr: crValue,
      rekomendasiNama: ranking[0].nama,
      rekomendasiVi: ranking[0].vi
    });
  }
}

// init
cloneDefault();
renderKriteria();
renderPairwise();
renderDataAlternatif();
