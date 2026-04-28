const SHEET_PUBHTML_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vReJHEOWjdrgx6vz1rU_X9SyEKgZCJ-uf19O5NA3PEk5xcKymXIMs1ZVP0rNbGGhftlu2qmx1xBJcAx/pubhtml";
const SHEET_CSV_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vReJHEOWjdrgx6vz1rU_X9SyEKgZCJ-uf19O5NA3PEk5xcKymXIMs1ZVP0rNbGGhftlu2qmx1xBJcAx/pub?output=csv";
const SHEET_NAMES = ["3roSoc", "3roNat", "3roEco"];
const REQUIRED_COLUMNS = ["Alumno", "Grupo", "PuntosFQ", "PuntosMate"];
const TEAM_COLORS = [
  "#38bdf8",
  "#f97316",
  "#22c55e",
  "#eab308",
  "#a78bfa",
  "#f43f5e",
  "#14b8a6",
  "#fb7185",
];
const TEAM_COLOR_STORAGE_KEY = "scoreboard-team-colors-v1";
const DEFAULT_EMPTY_MESSAGE = "No hay datos disponibles para esta hoja.";

const welcomeView = document.getElementById("welcomeView");
const scoreboardView = document.getElementById("scoreboardView");
const enterBtn = document.getElementById("enterBtn");
const sheetSelect = document.getElementById("sheetSelect");
const boardTitle = document.getElementById("boardTitle");
const membersBtn = document.getElementById("membersBtn");
const membersOverlay = document.getElementById("membersOverlay");
const membersPanel = document.getElementById("membersPanel");
const closeMembersBtn = document.getElementById("closeMembersBtn");
const membersPanelContent = document.getElementById("membersPanelContent");
const statusBadge = document.getElementById("statusBadge");
const updatedAt = document.getElementById("updatedAt");
const summaryText = document.getElementById("summaryText");
const scoreboardList = document.getElementById("scoreboardList");
const emptyState = document.getElementById("emptyState");

const sheetMap = new Map();
const teamColorByGroup = loadTeamColorMap();
let currentMembersByTeam = [];

enterBtn.addEventListener("click", () => {
  welcomeView.classList.add("hidden");
  scoreboardView.classList.remove("hidden");
  loadScoreboard();
});

sheetSelect.addEventListener("change", () => {
  loadScoreboard();
});

membersBtn.addEventListener("click", () => {
  openMembersPanel();
});

closeMembersBtn.addEventListener("click", () => {
  closeMembersPanel();
});

membersOverlay.addEventListener("click", () => {
  closeMembersPanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMembersPanel();
  }
});

async function init() {
  await loadSheetMap();
}

async function loadSheetMap() {
  try {
    const response = await fetch(SHEET_PUBHTML_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const html = await response.text();
    const tabs = parseTabsFromPubhtml(html);
    const normalizedTarget = new Set(SHEET_NAMES.map((name) => normalize(name)));

    tabs
      .filter((tab) => normalizedTarget.has(normalize(tab.name)))
      .forEach((tab) => {
        sheetMap.set(normalize(tab.name), tab.gid);
      });
  } catch (error) {
    console.error(error);
  }
}

async function loadScoreboard() {
  setStatus("Cargando...", "loading");
  updateBoardTitle();
  closeMembersPanel();
  membersBtn.disabled = true;
  renderLoadingSkeleton();

  const selectedSheetName = sheetSelect.value;
  const gid = sheetMap.get(normalize(selectedSheetName)) || null;
  const csvUrl = buildCsvUrl(gid);

  try {
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    if (rows.length < 2) {
      renderEmpty();
      setStatus("Sin datos", "loading");
      return;
    }

    const headers = rows[0];
    const bodyRows = rows.slice(1);
    validateHeaders(headers);

    const groupedData = groupScoresByTeam(headers, bodyRows);
    if (groupedData.length === 0) {
      currentMembersByTeam = [];
      renderMembersPanel(currentMembersByTeam);
      renderEmpty();
      setStatus("Sin datos", "loading");
      return;
    }

    currentMembersByTeam = buildMembersByTeam(headers, bodyRows, groupedData);
    renderMembersPanel(currentMembersByTeam);
    membersBtn.disabled = currentMembersByTeam.length === 0;

    renderScoreboard(groupedData);
    updatedAt.textContent = `Actualizado: ${new Date().toLocaleString("es-ES")}`;
    summaryText.textContent = `${groupedData.length} grupos en competencia`;
    setStatus("Actualizado", "ok");
  } catch (error) {
    console.error(error);
    renderError(error.message);
    setStatus("Error al cargar", "error");
  }
}

function renderScoreboard(groupedData) {
  scoreboardList.innerHTML = "";
  scoreboardList.classList.remove("is-loading");
  emptyState.classList.add("hidden");

  const maxPoints = Math.max(...groupedData.map((item) => item.totalPoints), 1);

  groupedData.forEach((item, index) => {
    const color = getTeamColor(item.group);
    const ratio = Math.max(item.totalPoints / maxPoints, 0.03);

    const row = document.createElement("article");
    row.className = "team-row team-row-enter";
    row.style.setProperty("--team-color", color);
    row.style.animationDelay = `${index * 45}ms`;

    row.innerHTML = `
      <div class="team-main">
        <span class="rank">#${index + 1}</span>
        <div>
          <h4>${escapeHtml(item.group)}</h4>
          <p>${item.studentCount} estudiantes</p>
        </div>
      </div>
      <div class="team-score">
        <strong>${formatNumber(item.totalPoints)}</strong>
        <span>pts</span>
      </div>
      <div class="meter">
        <span style="width:${(ratio * 100).toFixed(2)}%"></span>
      </div>
    `;

    scoreboardList.appendChild(row);
  });
}

function renderEmpty() {
  scoreboardList.classList.remove("is-loading");
  scoreboardList.innerHTML = "";
  emptyState.classList.remove("hidden");
  emptyState.textContent = DEFAULT_EMPTY_MESSAGE;
  summaryText.textContent = "";
}

function renderError(message) {
  scoreboardList.classList.remove("is-loading");
  currentMembersByTeam = [];
  renderMembersPanel(currentMembersByTeam);
  membersBtn.disabled = true;
  renderEmpty();
  emptyState.textContent = `No se pudo cargar el scoreboard. ${message}`;
}

function renderLoadingSkeleton() {
  scoreboardList.classList.add("is-loading");
  scoreboardList.innerHTML = "";
  emptyState.classList.add("hidden");
  summaryText.textContent = "Actualizando ranking...";

  for (let index = 0; index < 5; index += 1) {
    const row = document.createElement("article");
    row.className = "team-row skeleton-row";
    row.style.setProperty("--team-color", "#334155");
    row.innerHTML = `
      <div class="team-main">
        <span class="rank skeleton-block"></span>
        <div>
          <div class="skeleton-line skeleton-line-lg"></div>
          <div class="skeleton-line skeleton-line-sm"></div>
        </div>
      </div>
      <div class="team-score">
        <span class="skeleton-line skeleton-score"></span>
      </div>
      <div class="meter skeleton-meter-wrap">
        <span class="skeleton-meter"></span>
      </div>
    `;
    scoreboardList.appendChild(row);
  }
}

function buildMembersByTeam(headers, rows, groupedData) {
  const columnIndex = getColumnIndexes(headers);
  const membersByGroup = new Map();

  rows.forEach((row) => {
    const group = String(row[columnIndex.Grupo] || "").trim();
    const student = String(row[columnIndex.Alumno] || "").trim();
    if (!group || !student) {
      return;
    }

    if (!membersByGroup.has(group)) {
      membersByGroup.set(group, new Set());
    }
    membersByGroup.get(group).add(student);
  });

  return groupedData.map((item) => {
    const membersSet = membersByGroup.get(item.group) || new Set();
    const members = Array.from(membersSet).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );

    return {
      group: item.group,
      members,
    };
  });
}

function renderMembersPanel(membersByTeam) {
  membersPanelContent.innerHTML = "";

  if (!membersByTeam || membersByTeam.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No hay integrantes disponibles para mostrar.";
    membersPanelContent.appendChild(empty);
    return;
  }

  membersByTeam.forEach((team, index) => {
    const card = document.createElement("section");
    card.className = "members-team-card";
    card.style.setProperty("--team-color", getTeamColor(team.group));

    const listItems =
      team.members.length > 0
        ? team.members.map((member) => `<li>${escapeHtml(member)}</li>`).join("")
        : '<li class="muted">Sin integrantes cargados</li>';

    card.innerHTML = `
      <div class="members-team-head">
        <span class="members-team-rank">#${index + 1}</span>
        <h5>${escapeHtml(team.group)}</h5>
      </div>
      <ul class="members-list">${listItems}</ul>
    `;

    membersPanelContent.appendChild(card);
  });
}

function openMembersPanel() {
  if (membersBtn.disabled) {
    return;
  }

  membersOverlay.classList.add("is-open");
  membersPanel.classList.add("is-open");
  membersOverlay.setAttribute("aria-hidden", "false");
  membersPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeMembersPanel() {
  membersOverlay.classList.remove("is-open");
  membersPanel.classList.remove("is-open");
  membersOverlay.setAttribute("aria-hidden", "true");
  membersPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

function updateBoardTitle() {
  const selectedSheetName = sheetSelect.value || "";
  boardTitle.textContent = selectedSheetName
    ? `Puntos ${selectedSheetName}`
    : "Puntos";
}

function groupScoresByTeam(headers, rows) {
  const columnIndex = getColumnIndexes(headers);
  const grouped = new Map();

  rows.forEach((row) => {
    const group = String(row[columnIndex.Grupo] || "").trim();
    if (!group) {
      return;
    }

    const puntosFq = toNumber(row[columnIndex.PuntosFQ]);
    const puntosMate = toNumber(row[columnIndex.PuntosMate]);
    const total = puntosFq + puntosMate;

    if (!grouped.has(group)) {
      grouped.set(group, {
        group,
        totalPoints: 0,
        studentCount: 0,
      });
    }

    const target = grouped.get(group);
    target.totalPoints += total;
    target.studentCount += 1;
  });

  return Array.from(grouped.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}

function getColumnIndexes(headers) {
  const indexes = {};
  REQUIRED_COLUMNS.forEach((name) => {
    indexes[name] = headers.findIndex((header) => normalize(header) === normalize(name));
  });
  return indexes;
}

function validateHeaders(headers) {
  const missing = REQUIRED_COLUMNS.filter(
    (name) => !headers.some((header) => normalize(header) === normalize(name))
  );
  if (missing.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missing.join(", ")}`);
  }
}

function buildCsvUrl(gid) {
  const url = new URL(SHEET_CSV_BASE_URL);
  if (gid) {
    url.searchParams.set("gid", gid);
  }
  return url.toString();
}

function parseTabsFromPubhtml(html) {
  const tabs = [];
  const seen = new Set();
  const regex = /items\.push\(\{name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g;
  let match = regex.exec(html);
  while (match) {
    const name = match[1].trim();
    const gid = match[2];
    if (!seen.has(gid)) {
      tabs.push({ gid, name });
      seen.add(gid);
    }
    match = regex.exec(html);
  }

  if (tabs.length > 0) {
    return tabs;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = Array.from(doc.querySelectorAll("a"));
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.includes("gid=")) {
      return;
    }

    let gid = null;
    try {
      const url = new URL(href, SHEET_PUBHTML_URL);
      gid = url.searchParams.get("gid");
    } catch {
      return;
    }

    if (!gid || seen.has(gid)) {
      return;
    }

    const name = (link.textContent || "").trim();
    tabs.push({ gid, name: name || `Hoja ${tabs.length + 1}` });
    seen.add(gid);
  });

  return tabs;
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (currentRow.length > 0 || currentValue.length > 0) {
        currentRow.push(currentValue.trim());
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    currentValue += char;
  }

  if (currentRow.length > 0 || currentValue.length > 0) {
    currentRow.push(currentValue.trim());
    rows.push(currentRow);
  }

  return rows;
}

function toNumber(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const numberValue = Number(normalized);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatNumber(value) {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getTeamColor(groupName) {
  const normalizedGroup = normalize(groupName);
  if (!normalizedGroup) {
    return TEAM_COLORS[0];
  }

  const existingColor = teamColorByGroup.get(normalizedGroup);
  if (existingColor) {
    return existingColor;
  }

  const usedColors = new Set(teamColorByGroup.values());
  const availableColor = TEAM_COLORS.find((color) => !usedColors.has(color));
  const assignedColor = availableColor || TEAM_COLORS[hashString(normalizedGroup) % TEAM_COLORS.length];

  teamColorByGroup.set(normalizedGroup, assignedColor);
  saveTeamColorMap(teamColorByGroup);
  return assignedColor;
}

function loadTeamColorMap() {
  try {
    const raw = localStorage.getItem(TEAM_COLOR_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return new Map();
    }

    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveTeamColorMap(mapValue) {
  const asObject = Object.fromEntries(mapValue.entries());
  localStorage.setItem(TEAM_COLOR_STORAGE_KEY, JSON.stringify(asObject));
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(text, type) {
  statusBadge.textContent = text;
  statusBadge.className = "badge";

  if (type === "ok") {
    statusBadge.classList.add("badge-ok");
    return;
  }

  if (type === "error") {
    statusBadge.classList.add("badge-error");
    return;
  }

  statusBadge.classList.add("badge-loading");
}

init();
