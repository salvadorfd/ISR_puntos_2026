const SHEET_PUBHTML_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vReJHEOWjdrgx6vz1rU_X9SyEKgZCJ-uf19O5NA3PEk5xcKymXIMs1ZVP0rNbGGhftlu2qmx1xBJcAx/pubhtml";
const SHEET_CSV_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vReJHEOWjdrgx6vz1rU_X9SyEKgZCJ-uf19O5NA3PEk5xcKymXIMs1ZVP0rNbGGhftlu2qmx1xBJcAx/pub?output=csv";
const MANUAL_TAB_NAMES = ["3roSoc", "3roNat", "3roEco"];
const EXPECTED_COLUMNS = ["Alumno", "Grupo", "PuntosFQ", "PuntosMate"];
const PREFERRED_METRICS = ["PuntosFQ", "PuntosMate"];

const refreshBtn = document.getElementById("refreshBtn");
const sourceUrl = document.getElementById("sourceUrl");
const sheetSelect = document.getElementById("sheetSelect");
const sheetHint = document.getElementById("sheetHint");
const statusBadge = document.getElementById("statusBadge");
const updatedAt = document.getElementById("updatedAt");
const dataTable = document.getElementById("dataTable");
const rowCount = document.getElementById("rowCount");
const metricSelect = document.getElementById("metricSelect");
const chartCanvas = document.getElementById("chartCanvas");
const chartHint = document.getElementById("chartHint");

sourceUrl.textContent = SHEET_CSV_BASE_URL;

refreshBtn.addEventListener("click", () => {
  loadData(getSelectedGid());
});

sheetSelect.addEventListener("change", () => {
  loadData(getSelectedGid());
});

metricSelect.addEventListener("change", () => {
  drawChart();
});

async function loadData(gid) {
  setStatus("Cargando...", "loading");
  try {
    const csvUrl = buildCsvUrl(gid);
    sourceUrl.textContent = csvUrl;
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);

    if (rows.length === 0) {
      throw new Error("No hay filas para mostrar");
    }

    const headers = rows[0];
    const bodyRows = rows.slice(1);
    const missingColumns = getMissingExpectedColumns(headers, EXPECTED_COLUMNS);

    if (missingColumns.length > 0) {
      throw new Error(
        "Faltan columnas requeridas: " + missingColumns.join(", ")
      );
    }

    renderTable(headers, bodyRows);
    updateMetricOptions(headers, bodyRows);
    drawChart();

    rowCount.textContent = `${bodyRows.length} filas`;
    updatedAt.textContent = new Date().toLocaleString("es-ES");
    setStatus("Actualizado", "ok");
  } catch (error) {
    console.error(error);
    setStatus("Error al cargar", "error");
    chartHint.textContent =
      "No se pudieron cargar los datos. Verifica que la hoja esté publicada.";
  }
}

function buildCsvUrl(gid) {
  const url = new URL(SHEET_CSV_BASE_URL);
  if (gid) {
    url.searchParams.set("gid", gid);
  }
  return url.toString();
}

function getSelectedGid() {
  return sheetSelect.value || null;
}

async function loadSheetTabs() {
  try {
    const response = await fetch(SHEET_PUBHTML_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const html = await response.text();
    const tabs = parseTabsFromPubhtml(html);

    const filteredTabs = filterTabsByNames(tabs, MANUAL_TAB_NAMES);
    if (filteredTabs.length === 0) {
      filteredTabs.push({ gid: null, name: "Principal" });
    }

    renderSheetOptions(filteredTabs);
    setMissingTabsHint(filteredTabs, MANUAL_TAB_NAMES);
  } catch (error) {
    console.error(error);
    const fallbackTabs = fallbackTabsFromNames(MANUAL_TAB_NAMES);
    renderSheetOptions(fallbackTabs);
    setMissingTabsHint(fallbackTabs, MANUAL_TAB_NAMES);
  }
}

function renderSheetOptions(tabs) {
  sheetSelect.innerHTML = "";
  tabs.forEach((tab) => {
    const option = document.createElement("option");
    option.value = tab.gid ?? "";
    option.textContent = tab.name;
    sheetSelect.appendChild(option);
  });
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
    const name = link.textContent.trim() || `Hoja ${tabs.length + 1}`;
    tabs.push({ gid, name });
    seen.add(gid);
  });

  return tabs;
}

function filterTabsByNames(tabs, names) {
  if (!names || names.length === 0) {
    return tabs;
  }
  const normalize = (value) => value.toLowerCase().trim();
  const lowerNames = names.map((name) => normalize(name));
  return tabs
    .filter((tab) => lowerNames.includes(normalize(tab.name)))
    .sort(
      (a, b) =>
        lowerNames.indexOf(normalize(a.name)) -
        lowerNames.indexOf(normalize(b.name))
    );
}

function fallbackTabsFromNames(names) {
  if (!names || names.length === 0) {
    return [{ gid: null, name: "Principal" }];
  }
  return names.map((name) => ({ gid: null, name }));
}

function getMissingExpectedColumns(headers, expectedColumns) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const normalizedHeaders = new Set(headers.map((header) => normalize(header)));
  return expectedColumns.filter(
    (columnName) => !normalizedHeaders.has(normalize(columnName))
  );
}

function setMissingTabsHint(tabs, names) {
  if (!names || names.length === 0) {
    sheetHint.textContent = "";
    return;
  }
  const missing = tabs.filter((tab) => !tab.gid).map((tab) => tab.name);
  if (missing.length === 0) {
    sheetHint.textContent = "";
    return;
  }
  sheetHint.textContent =
    "Faltan gid para: " +
    missing.join(", ") +
    ". Necesitas publicarlas o pasar sus gid.";
}

function setStatus(label, type) {
  statusBadge.textContent = label;
  statusBadge.className = "badge";
  if (type === "ok") {
    statusBadge.style.background = "rgba(34,197,94,0.2)";
    statusBadge.style.color = "#22c55e";
  } else if (type === "error") {
    statusBadge.style.background = "rgba(248,113,113,0.2)";
    statusBadge.style.color = "#f87171";
  } else {
    statusBadge.style.background = "rgba(56,189,248,0.2)";
    statusBadge.style.color = "#38bdf8";
  }
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i += 1;
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
      if (currentValue.length > 0 || currentRow.length > 0) {
        currentRow.push(currentValue.trim());
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    rows.push(currentRow);
  }

  return rows;
}

function renderTable(headers, bodyRows) {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header || "(sin título)";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  bodyRows.forEach((row) => {
    const tr = document.createElement("tr");
    headers.forEach((_, index) => {
      const td = document.createElement("td");
      td.textContent = row[index] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  dataTable.innerHTML = "";
  dataTable.appendChild(thead);
  dataTable.appendChild(tbody);
}

function updateMetricOptions(headers, bodyRows) {
  const numericIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => isNumericColumn(bodyRows, index));

  metricSelect.innerHTML = "";

  if (numericIndexes.length === 0) {
    metricSelect.disabled = true;
    chartHint.textContent =
      "No se detectaron columnas numéricas para el gráfico.";
    return;
  }

  metricSelect.disabled = false;
  numericIndexes.forEach(({ header, index }) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = header || `Columna ${index + 1}`;
    metricSelect.appendChild(option);
  });

  const preferredIndex = numericIndexes.find(({ header }) =>
    PREFERRED_METRICS.includes((header || "").trim())
  );
  if (preferredIndex) {
    metricSelect.value = String(preferredIndex.index);
  }

  chartHint.textContent =
    "Selecciona una columna numérica para ver el gráfico.";
}

function isNumericColumn(rows, index) {
  let numericCount = 0;
  let nonEmptyCount = 0;

  rows.forEach((row) => {
    const value = row[index];
    if (value === undefined || value === "") {
      return;
    }
    nonEmptyCount += 1;
    const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
    const numberValue = Number(cleaned);
    if (!Number.isNaN(numberValue)) {
      numericCount += 1;
    }
  });

  return nonEmptyCount > 0 && numericCount / nonEmptyCount > 0.7;
}

function drawChart() {
  const ctx = chartCanvas.getContext("2d");
  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  const headerRow = dataTable.querySelectorAll("thead th");
  const bodyRows = Array.from(dataTable.querySelectorAll("tbody tr"));
  if (headerRow.length === 0 || bodyRows.length === 0) {
    return;
  }

  const metricIndex = Number(metricSelect.value);
  if (Number.isNaN(metricIndex)) {
    return;
  }

  const labels = bodyRows.map((row) => row.children[0]?.textContent || "");
  const values = bodyRows.map((row) => {
    const raw = row.children[metricIndex]?.textContent ?? "";
    const normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    const numberValue = Number(normalized);
    return Number.isNaN(numberValue) ? 0 : numberValue;
  });

  const maxValue = Math.max(...values, 1);
  const chartHeight = chartCanvas.height - 60;
  const chartWidth = chartCanvas.width - 80;
  const originX = 50;
  const originY = chartCanvas.height - 30;
  const barGap = 10;
  const barWidth = Math.max(
    16,
    (chartWidth - barGap * (values.length - 1)) / values.length
  );

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(
    headerRow[metricIndex]?.textContent || "Métrica",
    originX,
    20
  );

  values.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = originX + index * (barWidth + barGap);
    const y = originY - barHeight;

    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(labels[index].slice(0, 8), x, originY + 12);
  });
}

loadSheetTabs().then(() => {
  loadData(getSelectedGid());
});
