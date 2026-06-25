const tenderText = document.querySelector("#tenderText");
const fileInput = document.querySelector("#fileInput");
const fileList = document.querySelector("#fileList");
const analyzeBtn = document.querySelector("#analyzeBtn");
const clearBtn = document.querySelector("#clearBtn");
const loadExample = document.querySelector("#loadExample");
const downloadReport = document.querySelector("#downloadReport");
const copyQuote = document.querySelector("#copyQuote");

const output = {
  summary: document.querySelector("#summary"),
  dates: document.querySelector("#dates"),
  systems: document.querySelector("#systems"),
  risks: document.querySelector("#risks"),
  rfis: document.querySelector("#rfis"),
  checklist: document.querySelector("#checklist"),
  quotation: document.querySelector("#quotation")
};

const percentInputs = {
  labor: document.querySelector("#laborPct"),
  overhead: document.querySelector("#overheadPct"),
  profit: document.querySelector("#profitPct"),
  contingency: document.querySelector("#contingencyPct")
};

const state = {
  files: [],
  fileText: "",
  lastReport: null
};

const systemPatterns = [
  { name: "HVAC installation", keys: ["hvac", "ahu", "fcu", "chiller", "duct", "ventilation", "fresh air", "extract fan", "vrf"] },
  { name: "Electrical distribution", keys: ["electrical", "lv", "mdb", "smdb", "db", "cable", "tray", "lighting", "power", "earthing", "load schedule"] },
  { name: "Plumbing works", keys: ["plumbing", "water supply", "drainage", "sanitary", "pump", "ppr", "hdpe", "piping"] },
  { name: "Fire fighting", keys: ["fire fighting", "sprinkler", "fire pump", "hose reel", "hydrant", "fm200"] },
  { name: "Fire alarm", keys: ["fire alarm", "detector", "mcp", "sounder", "addressable panel"] },
  { name: "ELV systems", keys: ["elv", "cctv", "access control", "structured cabling", "data", "bms", "public address"] },
  { name: "Testing & commissioning", keys: ["testing", "commissioning", "t&c", "balancing", "handover", "as-built"] }
];

const requirementPatterns = [
  "authority approvals",
  "method statement",
  "material submittals",
  "shop drawings",
  "as-built drawings",
  "warranty",
  "testing and commissioning",
  "operation and maintenance manuals",
  "third party inspection"
];

const missingInfoRules = [
  {
    label: "No cable schedule provided",
    keys: ["electrical", "cable", "lv"],
    expected: ["cable schedule", "cable sizing", "cable route"],
    rfi: "Please provide the electrical cable schedule, cable sizes, and route details."
  },
  {
    label: "Electrical load schedule missing",
    keys: ["electrical", "mdb", "smdb", "db", "power"],
    expected: ["load schedule", "connected load", "demand load"],
    rfi: "Please provide the electrical load schedule and diversity criteria."
  },
  {
    label: "Pump specifications missing",
    keys: ["pump", "plumbing", "fire fighting"],
    expected: ["flow rate", "head", "pump schedule", "duty point"],
    rfi: "Please confirm pump flow rates, head, duty/standby arrangement, and control requirements."
  },
  {
    label: "AHU or FCU capacities not stated",
    keys: ["hvac", "ahu", "fcu", "ventilation"],
    expected: ["capacity", "cfm", "tr", "kw cooling"],
    rfi: "Please confirm AHU/FCU capacities, airflow rates, and external static pressure."
  },
  {
    label: "BOQ quantities need confirmation",
    keys: ["boq", "quantity", "schedule"],
    expected: ["qty", "quantity", "unit"],
    rfi: "Please confirm whether BOQ quantities are firm or subject to remeasurement."
  },
  {
    label: "Drawing revision status unclear",
    keys: ["drawing", "layout", "plan"],
    expected: ["revision", "rev.", "issued for tender", "ift"],
    rfi: "Please confirm latest drawing revisions issued for tender pricing."
  },
  {
    label: "Submission deadline not clearly stated",
    keys: ["tender", "submission", "closing"],
    expected: ["closing date", "submission deadline", "tender closing", "due date"],
    rfi: "Please confirm tender submission deadline, time, and delivery method."
  }
];

const exampleText = `Project: Al Noor Clinic Fit-Out - MEP Works
Client: Horizon Developments
Tender closing: 15 Dec 2026 at 3:00 PM
Scope of Work:
Supply, installation, testing and commissioning of HVAC installation, electrical distribution, lighting, plumbing works, drainage, fire alarm and ELV systems for clinic fit-out.
Technical requirements include shop drawings, material submittals, authority approvals, testing and commissioning, O&M manuals and warranty.
BOQ attached for HVAC ducting, cable trays, DBs, lighting fixtures, water supply piping and sanitary fixtures.
Drawings include MEP layouts. AHU schedule is referenced but not included. Pump schedule not provided. Electrical load schedule and cable schedule are not included.`;

fileInput.addEventListener("change", async (event) => {
  state.files = Array.from(event.target.files);
  await collectFileText(state.files);
  renderFiles();
});

analyzeBtn.addEventListener("click", () => {
  state.lastReport = analyzeTender();
  renderReport(state.lastReport);
});

clearBtn.addEventListener("click", () => {
  tenderText.value = "";
  fileInput.value = "";
  state.files = [];
  state.fileText = "";
  state.lastReport = null;
  renderFiles();
  clearOutputs();
});

loadExample.addEventListener("click", () => {
  tenderText.value = exampleText;
  state.lastReport = analyzeTender();
  renderReport(state.lastReport);
});

Object.values(percentInputs).forEach((input) => {
  input.addEventListener("input", () => {
    if (!state.lastReport) return;
    state.lastReport = analyzeTender();
    renderReport(state.lastReport);
  });
});

document.addEventListener("click", (event) => {
  const copyTarget = event.target.closest("[data-copy]");
  if (!copyTarget) return;
  const key = copyTarget.dataset.copy;
  copyElementText(output[key], copyTarget);
});

copyQuote.addEventListener("click", () => copyElementText(output.quotation, copyQuote));
downloadReport.addEventListener("click", () => {
  if (!state.lastReport) return;
  const reportText = reportToText(state.lastReport);
  const blob = new Blob([reportText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tender-estimation-report.txt";
  link.click();
  URL.revokeObjectURL(url);
});

async function collectFileText(files) {
  const readableTypes = [".txt", ".csv", ".rtf"];
  const chunks = [];

  for (const file of files) {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (readableTypes.includes(extension) || file.type.startsWith("text/")) {
      try {
        chunks.push(await file.text());
      } catch {
        chunks.push("");
      }
    }
  }

  state.fileText = chunks.join("\n\n");
}

function renderFiles() {
  fileList.innerHTML = "";
  if (!state.files.length) return;

  state.files.forEach((file) => {
    const item = document.createElement("li");
    const size = file.size > 1048576
      ? `${(file.size / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    item.innerHTML = `<span>${escapeHtml(file.name)}</span><span>${size}</span>`;
    fileList.append(item);
  });
}

function analyzeTender() {
  const text = `${tenderText.value}\n${state.fileText}\n${state.files.map((file) => file.name).join("\n")}`.trim();
  const normalized = text.toLowerCase();
  const projectName = extractProjectName(text) || inferProjectFromFiles() || "Project name not identified";
  const scopeItems = extractScope(text, normalized);
  const systems = detectSystems(normalized);
  const dates = extractDates(text);
  const requirements = requirementPatterns.filter((item) => normalized.includes(item));
  const risks = detectRisks(normalized, systems);
  const rfis = risks.map((risk) => risk.rfi);
  const checklist = buildChecklist(systems, requirements, risks);
  const quotation = buildQuotation(systems);

  return {
    projectName,
    scopeItems,
    systems,
    dates,
    requirements,
    risks,
    rfis,
    checklist,
    quotation,
    documentNote: buildDocumentNote()
  };
}

function extractProjectName(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const projectLine = lines.find((line) => /^(project|project name|tender|job)\s*[:\-]/i.test(line));
  if (!projectLine) return "";
  return projectLine.replace(/^(project|project name|tender|job)\s*[:\-]\s*/i, "").trim();
}

function inferProjectFromFiles() {
  const firstUsefulFile = state.files.find((file) => !/boq|spec|drawing|layout/i.test(file.name));
  if (!firstUsefulFile) return "";
  return firstUsefulFile.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

function extractScope(text, normalized) {
  const scope = [];
  const scopeMatch = text.match(/scope(?: of work)?\s*[:\-]([\s\S]{0,500})/i);

  if (scopeMatch) {
    const candidates = scopeMatch[1]
      .split(/\n|;|,/)
      .map((item) => item.trim().replace(/^\W+/, ""))
      .filter((item) => item.length > 4)
      .slice(0, 8);
    scope.push(...candidates);
  }

  detectSystems(normalized).forEach((system) => {
    if (!scope.some((item) => item.toLowerCase().includes(system.toLowerCase().split(" ")[0]))) {
      scope.push(system);
    }
  });

  return [...new Set(scope)].slice(0, 8);
}

function detectSystems(normalized) {
  return systemPatterns
    .filter((system) => system.keys.some((key) => normalized.includes(key)))
    .map((system) => system.name);
}

function extractDates(text) {
  const results = [];
  const dateRegex = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  let match;

  while ((match = dateRegex.exec(text)) !== null) {
    const context = text.slice(Math.max(0, match.index - 60), Math.min(text.length, match.index + 80));
    const label = /closing|submission|deadline|due/i.test(context) ? "Tender closing" : "Important date";
    results.push(`${label}: ${match[0]}`);
  }

  return [...new Set(results)].slice(0, 6);
}

function detectRisks(normalized, systems) {
  const detected = missingInfoRules.filter((rule) => {
    const relevant = rule.keys.some((key) => normalized.includes(key)) || systems.some((system) => rule.keys.some((key) => system.toLowerCase().includes(key)));
    const explicitMissing = rule.expected.some((key) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`${escaped}.{0,40}(not included|not provided|missing|unavailable)|(?:not included|not provided|missing|unavailable).{0,40}${escaped}`, "i").test(normalized);
    });
    const hasExpectedInfo = rule.expected.some((key) => normalized.includes(key));
    if (explicitMissing) return relevant;
    return relevant && !hasExpectedInfo;
  });

  if (!normalized) {
    return [{ label: "No tender content entered", rfi: "Please provide tender documents, BOQ, drawings, and specifications for review." }];
  }

  if (!detected.length && !extractDates(normalized).length) {
    detected.push(missingInfoRules[6]);
  }

  return detected;
}

function buildChecklist(systems, requirements, risks) {
  const checklist = [
    "Confirm tender closing date, submission format, and commercial exclusions",
    "Review drawings, BOQ, specifications, addenda, and contract conditions",
    "Check quantity take-off against BOQ and drawing revisions",
    "Request supplier quotations for major equipment and long-lead materials",
    "Include testing, commissioning, authority approvals, O&M manuals, and warranty",
    "Prepare exclusions, qualifications, and assumptions for quotation"
  ];

  systems.forEach((system) => checklist.push(`Price ${system} materials, labor, testing, and handover requirements`));
  requirements.forEach((requirement) => checklist.push(`Allow for ${requirement}`));
  risks.forEach((risk) => checklist.push(`Resolve risk before final offer: ${risk.label}`));

  return [...new Set(checklist)];
}

function buildQuotation(systems) {
  const baseRates = {
    "HVAC installation": 185000,
    "Electrical distribution": 160000,
    "Plumbing works": 95000,
    "Fire fighting": 90000,
    "Fire alarm": 42000,
    "ELV systems": 56000,
    "Testing & commissioning": 28000
  };

  const detectedSystems = systems.length ? systems : ["MEP works"];
  const materialTotal = detectedSystems.reduce((sum, system) => sum + (baseRates[system] || 120000), 0);
  const labor = materialTotal * pct("labor");
  const overhead = (materialTotal + labor) * pct("overhead");
  const contingency = (materialTotal + labor + overhead) * pct("contingency");
  const profit = (materialTotal + labor + overhead + contingency) * pct("profit");

  return [
    { label: "Materials", amount: materialTotal },
    { label: "Labor", amount: labor },
    { label: "Overheads", amount: overhead },
    { label: "Contingency", amount: contingency },
    { label: "Profit margin", amount: profit }
  ];
}

function pct(key) {
  return Math.max(0, Number(percentInputs[key].value || 0)) / 100;
}

function buildDocumentNote() {
  const binaryFiles = state.files.filter((file) => !/\.(txt|csv|rtf)$/i.test(file.name));
  if (!binaryFiles.length) return "";
  return "Note: PDF, Word, Excel, drawing, and image files are listed for context in this browser-only version. Paste extracted document text for deeper analysis.";
}

function renderReport(report) {
  renderSummary(report);
  renderDates(report);
  renderSystems(report);
  renderRisks(report);
  renderRfis(report);
  renderChecklist(report);
  renderQuotation(report);
}

function renderSummary(report) {
  output.summary.className = "result-box";
  output.summary.innerHTML = `
    <div class="summary-grid">
      <div class="summary-metric"><strong>Project</strong>${escapeHtml(report.projectName)}</div>
      <div class="summary-metric"><strong>Systems</strong>${report.systems.length || "Not identified"}</div>
      <div class="summary-metric"><strong>Risks</strong>${report.risks.length}</div>
      <div class="summary-metric"><strong>Files</strong>${state.files.length}</div>
    </div>
    <ul class="summary-list">
      ${listItems(report.scopeItems.length ? report.scopeItems : ["Scope of work not clearly identified."])}
    </ul>
    ${report.documentNote ? `<p class="note">${escapeHtml(report.documentNote)}</p>` : ""}
  `;
}

function renderDates(report) {
  output.dates.className = report.dates.length ? "result-box" : "result-box empty";
  output.dates.innerHTML = report.dates.length
    ? `<ul class="result-list">${listItems(report.dates)}</ul>`
    : "No tender dates found. Add the invitation letter or tender instructions.";
}

function renderSystems(report) {
  output.systems.className = report.systems.length ? "pill-list" : "pill-list empty";
  output.systems.innerHTML = report.systems.length
    ? report.systems.map((system) => `<span class="pill">${escapeHtml(system)}</span>`).join("")
    : "No MEP systems identified yet.";
}

function renderRisks(report) {
  output.risks.className = report.risks.length ? "result-box" : "result-box empty";
  output.risks.innerHTML = report.risks.length
    ? report.risks.map((risk) => `<div class="risk">${escapeHtml(risk.label)}</div>`).join("")
    : "No major missing information detected.";
}

function renderRfis(report) {
  output.rfis.className = report.rfis.length ? "result-box" : "result-box empty";
  output.rfis.innerHTML = report.rfis.length
    ? report.rfis.map((rfi, index) => `<div class="rfi"><strong>RFI ${index + 1}:</strong> ${escapeHtml(rfi)}</div>`).join("")
    : "No RFIs generated.";
}

function renderChecklist(report) {
  output.checklist.className = report.checklist.length ? "checklist" : "checklist empty";
  output.checklist.innerHTML = "";

  if (!report.checklist.length) {
    output.checklist.textContent = "No checklist generated yet.";
    return;
  }

  const template = document.querySelector("#checkItemTemplate");
  report.checklist.forEach((item) => {
    const clone = template.content.cloneNode(true);
    clone.querySelector("span").textContent = item;
    output.checklist.append(clone);
  });
}

function renderQuotation(report) {
  output.quotation.className = "quote-box";
  const total = report.quotation.reduce((sum, item) => sum + item.amount, 0);
  output.quotation.innerHTML = `
    <table class="quote-table">
      <thead><tr><th>Cost head</th><th>Draft amount</th></tr></thead>
      <tbody>
        ${report.quotation.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${formatMoney(item.amount)}</td></tr>`).join("")}
        <tr><th>Total Draft Offer</th><th>${formatMoney(total)}</th></tr>
      </tbody>
    </table>
    <p class="note">Draft values are placeholders for structuring the quotation. Replace them with measured BOQ quantities and supplier quotations.</p>
  `;
}

function clearOutputs() {
  output.summary.className = "result-box empty";
  output.summary.textContent = "Run analysis to generate the project summary.";
  output.dates.className = "result-box empty";
  output.dates.textContent = "No dates extracted yet.";
  output.systems.className = "pill-list empty";
  output.systems.textContent = "No systems identified yet.";
  output.risks.className = "result-box empty";
  output.risks.textContent = "No risks generated yet.";
  output.rfis.className = "result-box empty";
  output.rfis.textContent = "No RFIs generated yet.";
  output.checklist.className = "checklist empty";
  output.checklist.textContent = "No checklist generated yet.";
  output.quotation.className = "quote-box empty";
  output.quotation.textContent = "No quotation draft generated yet.";
}

function listItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0
  }).format(value);
}

function reportToText(report) {
  const total = report.quotation.reduce((sum, item) => sum + item.amount, 0);
  return [
    "Tender & Estimation Assistant Report",
    "",
    `Project: ${report.projectName}`,
    "",
    "Project Summary",
    ...report.scopeItems.map((item) => `- ${item}`),
    "",
    "Important Dates",
    ...(report.dates.length ? report.dates : ["No dates extracted."]).map((item) => `- ${item}`),
    "",
    "MEP Systems",
    ...(report.systems.length ? report.systems : ["No systems identified."]).map((item) => `- ${item}`),
    "",
    "Risks",
    ...(report.risks.length ? report.risks.map((risk) => risk.label) : ["No risks detected."]).map((item) => `- ${item}`),
    "",
    "Suggested RFIs",
    ...(report.rfis.length ? report.rfis : ["No RFIs generated."]).map((item) => `- ${item}`),
    "",
    "Estimation Checklist",
    ...report.checklist.map((item) => `- [ ] ${item}`),
    "",
    "Quotation Draft",
    ...report.quotation.map((item) => `${item.label}: ${formatMoney(item.amount)}`),
    `Total Draft Offer: ${formatMoney(total)}`
  ].join("\n");
}

async function copyElementText(element, button) {
  const text = element.innerText.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  const previous = button.textContent;
  button.textContent = "✓";
  window.setTimeout(() => {
    button.textContent = previous;
  }, 900);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
