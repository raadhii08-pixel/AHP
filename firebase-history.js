// =========================================
// FIREBASE SETUP — Riwayat Perhitungan AHP
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCU0PNvKtyypou7YNx4wN2b5FvFsYALJrk",
  authDomain: "spk-kuliah.firebaseapp.com",
  projectId: "spk-kuliah",
  storageBucket: "spk-kuliah.firebasestorage.app",
  messagingSenderId: "827274149887",
  appId: "1:827274149887:web:af91e421064d91cad5f1ca"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const HISTORY_COLLECTION = "ahp_history";

async function simpanHistory(data) {
  try {
    await addDoc(collection(db, HISTORY_COLLECTION), {
      ...data,
      createdAt: serverTimestamp()
    });
    muatHistory();
  } catch (err) {
    console.error("Gagal menyimpan history:", err);
  }
}

async function muatHistory() {
  const loadingEl = document.getElementById("history-loading");
  const tableWrap = document.getElementById("tabel-history-wrap");
  const emptyEl = document.getElementById("history-empty");
  const tbody = document.getElementById("tabel-history");

  loadingEl.classList.remove("d-none");
  tableWrap.classList.add("d-none");
  emptyEl.classList.add("d-none");

  try {
    const q = query(collection(db, HISTORY_COLLECTION), orderBy("createdAt", "desc"), limit(20));
    const snap = await getDocs(q);

    loadingEl.classList.add("d-none");

    if (snap.empty) {
      emptyEl.classList.remove("d-none");
      return;
    }

    tbody.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const waktu = d.createdAt ? d.createdAt.toDate().toLocaleString("id-ID") : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${waktu}</td>
        <td class="text-center">${d.jumlahAlternatif ?? "-"}</td>
        <td class="text-center">${d.jumlahKriteria ?? "-"}</td>
        <td class="text-center">${d.cr != null ? d.cr.toFixed(4) : "-"}</td>
        <td>${d.rekomendasiNama ?? "-"}</td>
        <td class="text-center">${d.rekomendasiVi != null ? d.rekomendasiVi.toFixed(4) : "-"}</td>
      `;
      tbody.appendChild(tr);
    });
    tableWrap.classList.remove("d-none");
  } catch (err) {
    loadingEl.textContent = "Gagal memuat riwayat. Cek koneksi atau konfigurasi Firebase.";
    console.error("Gagal memuat history:", err);
  }
}

window.simpanHistoryAhp = simpanHistory;
window.muatHistory = muatHistory;

muatHistory();
