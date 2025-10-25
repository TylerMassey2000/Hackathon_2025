document.addEventListener("DOMContentLoaded", () => {
    const scanForm = document.getElementById("scanForm");
    const runScanBtn = document.getElementById("runScanBtn");
    const spinner = document.getElementById("loadingSpinner");
    const errorBox = document.getElementById("errorBox");

    // result elements
    const resultsCompany = document.getElementById("resultsCompany");
    const resultsSeverity = document.getElementById("resultsSeverity");
    const scoreNumber = document.getElementById("scoreNumber");
    const scoreFill = document.getElementById("scoreFill");
    const summaryText = document.getElementById("summaryText");
    const findingsList = document.getElementById("findingsList");

    // ✅ Your deployed Firebase Cloud Function URL
    const FUNCTION_URL =
        "https://us-central1-hackathon-2025-39b06.cloudfunctions.net/analyzeEULA";

    // --- UI Helpers ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            runScanBtn.disabled = true;
            spinner.classList.remove("hidden");
            runScanBtn.querySelector(".ai-button-text").textContent = "Scanning...";
        } else {
            runScanBtn.disabled = false;
            spinner.classList.add("hidden");
            runScanBtn.querySelector(".ai-button-text").textContent = "Run Scan";
        }
    }

    function setError(message) {
        if (!message) {
            errorBox.classList.add("hidden");
            errorBox.textContent = "";
            return;
        }
        errorBox.textContent = message;
        errorBox.classList.remove("hidden");
    }

    function renderSeverityBadge(sev) {
        const sevClassMap = {
            high: "ai-sev-high",
            medium: "ai-sev-medium",
            low: "ai-sev-low"
        };

        if (!sev) {
            resultsSeverity.className = "ai-severity-badge hidden";
            resultsSeverity.textContent = "";
            return;
        }

        resultsSeverity.className = `ai-severity-badge ${sevClassMap[sev] || ""}`;
        resultsSeverity.textContent = sev.toUpperCase() + " RISK";
    }

    function escapeHTML(str) {
        if (typeof str !== "string") return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderFindings(findings) {
        if (!findings || findings.length === 0) {
            findingsList.innerHTML = `<div class="ai-muted ai-small">No obvious scary clauses found.</div>`;
            return;
        }

        findingsList.innerHTML = findings.map(f => {
            const riskClass =
                f.riskLevel === "high" ? "ai-risk-high" :
                f.riskLevel === "medium" ? "ai-risk-medium" :
                "ai-risk-low";

            return `
                <div class="ai-finding-card">
                    <div class="ai-finding-head">
                        <p class="ai-finding-title">${escapeHTML(f.category)}</p>
                        <span class="ai-finding-risk ${riskClass}">
                            ${escapeHTML(f.riskLevel || "")}
                        </span>
                    </div>
                    <p class="ai-finding-desc">
                        ${escapeHTML(f.description || "")}
                    </p>
                </div>
            `;
        }).join("");
    }

    // --- Main Scan Function ---
    async function runScan(formData) {
        setLoadingState(true);
        setError("");

        try {
            const res = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: formData.company,
                    policyUrl: formData.policyUrl,
                    policyText: formData.policyText
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Scan failed.");
            }

            const data = await res.json();

            // --- Update UI ---
            resultsCompany.textContent = "Report for " + data.company;
            renderSeverityBadge(data.severity?.toLowerCase());

            // Score
            scoreNumber.textContent = (data.severityScore ?? 0) + "/100";
            const scorePct = Math.min(Math.max(data.severityScore ?? 0, 0), 100);
            scoreFill.style.width = scorePct + "%";

            // Summary
            summaryText.textContent = data.summary || "No summary provided.";

            // Findings
            renderFindings(data.findings || []);

            // Success feedback
            runScanBtn.querySelector(".ai-button-text").textContent = "✅ Scan Complete!";
            setTimeout(() => {
                runScanBtn.querySelector(".ai-button-text").textContent = "Run Scan";
            }, 3000);

        } catch (err) {
            console.error("SCAN ERROR:", err);
            setError(err.message || "Something went wrong.");
        } finally {
            setLoadingState(false);
        }
    }

    // --- Form Submit Handler ---
    scanForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const company = document.getElementById("company").value.trim();
        const policyUrl = document.getElementById("policyUrl").value.trim();
        const policyText = document.getElementById("policyText").value.trim();

        if (!company) {
            setError("Please enter a company / product name.");
            return;
        }
        if (!policyUrl && !policyText) {
            setError("Please provide either a policy URL or paste the policy text.");
            return;
        }

        runScan({
            company,
            policyUrl: policyUrl || null,
            policyText: policyText || null
        });
    });
});
