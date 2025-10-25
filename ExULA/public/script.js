// ===============================================
//  FIREBASE SETUP
// ===============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("🔥 Firebase connected. Ready to load data.");

// ===============================================
//  HELPER – Normalize Name for Matching
// ===============================================
const normalizeName = name =>
  name?.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

// ===============================================
//  LOAD COMPANY DATA
// ===============================================
async function loadCompanyData() {
  try {
    const snap = await getDocs(collection(db, "companies"));
    console.log(`📦 Loaded ${snap.size} companies from Firestore.`);

    const allCards = Array.from(document.querySelectorAll("[data-company]"));

    snap.forEach(doc => {
      const c = doc.data();
      const card = allCards.find(
        el => normalizeName(el.dataset.company) === normalizeName(c.company_name)
      );
      if (!card) return console.warn(`⚠️ No match for ${c.company_name}`);

      // --- BASIC INFO ---
      const score = card.querySelector(".score");
      const risk = card.querySelector(".risk");
      const link = card.querySelector(".link");
      if (score) score.textContent = `Privacy Score: ${c.privacy_score ?? "N/A"}`;
      if (risk) risk.textContent = `Risk Level: ${c.risk_level ?? "N/A"}`;
      if (link)
        link.innerHTML = `<a href="${c.eula_url || "#"}" target="_blank" rel="noopener">View EULA</a>`;

      // --- DETAILS AREA ---
      const infoContent = card.closest(".info-block")?.querySelector(".info-content");
      if (!infoContent) return;
      infoContent.innerHTML = "";

      const listFields = {
        "Key Details": c.details,
        "User Rights": c.user_rights,
        "Data Collected": c.data_collected,
        "Data Shared With": c.data_shared_with,
        "Security Controls": c.security_controls,
        "Top Issues": c.top_issues,
        "Red Flags": c.red_flags
      };

      for (const [title, items] of Object.entries(listFields)) {
        if (Array.isArray(items) && items.length) {
          const section = document.createElement("div");
          section.classList.add("info-section");
          section.innerHTML = `
            <h4>${title}</h4>
            <ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>
          `;
          infoContent.appendChild(section);
        }
      }

      const extra = document.createElement("div");
      extra.classList.add("extra-details");
      extra.innerHTML = `
        <p><strong>Consent Type:</strong> ${c.consent_type ?? "N/A"}</p>
        <p><strong>Data Retention:</strong> ${c.data_retention_policy ?? "N/A"}</p>
        <p><strong>Verdict:</strong> ${c.verdict ?? "N/A"}</p>
      `;
      infoContent.appendChild(extra);
    });

    console.log("✅ All company cards updated.");
  } catch (e) {
    console.error("❌ Firestore load error:", e);
  }
}

// ===============================================
//  DROPDOWN LOGIC
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  if (!window.location.pathname.includes("library.html")) return;

  document.querySelectorAll(".info-header").forEach(header =>
    header.addEventListener("click", () =>
      header.closest(".info-block").classList.toggle("active")
    )
  );

  loadCompanyData();
});
