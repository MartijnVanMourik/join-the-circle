let sessionId = null;
let sessionRef = null;
let sessionData = null;
let defaultStatementsData = null;
let controlTimer = null;
let lastRenderedStatementIndex = -2;

const setupScreen = document.getElementById("setup-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const controlScreen = document.getElementById("control-screen");
const reviewScreen = document.getElementById("review-screen");
const historyScreen = document.getElementById("history-screen");

function showScreen(el) {
  [setupScreen, lobbyScreen, controlScreen, reviewScreen, historyScreen].forEach((s) =>
    s.classList.add("hidden")
  );
  el.classList.remove("hidden");
}

// ---------- Setup: stellingen bewerken ----------

const sessionNameInput = document.getElementById("session-name-input");
const centerWordInput = document.getElementById("center-word-input");
const statementsEditor = document.getElementById("statements-editor");
const addStatementBtn = document.getElementById("add-statement-btn");
const resetStatementsBtn = document.getElementById("reset-statements-btn");
const setupError = document.getElementById("setup-error");
const createSessionBtn = document.getElementById("create-session-btn");
const historyBtn = document.getElementById("history-btn");

function addStatementRow(text = "", durationSec = 30) {
  const row = document.createElement("div");
  row.className = "statement-row";

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.placeholder = "Stellingtekst";

  const duration = document.createElement("input");
  duration.type = "number";
  duration.className = "duration-input";
  duration.min = "5";
  duration.max = "300";
  duration.value = durationSec;
  duration.title = "Tijdslimiet (sec.)";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-statement-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(textarea);
  row.appendChild(duration);
  row.appendChild(removeBtn);
  statementsEditor.appendChild(row);
}

function loadStatementsIntoEditor(data) {
  centerWordInput.value = data.centerWord;
  statementsEditor.innerHTML = "";
  data.statements.forEach((s) => addStatementRow(s.text, s.durationSec || data.statementDurationSec || 30));
}

async function loadDefaultStatements() {
  const res = await fetch(`data/statements.json?v=${CACHE_VERSION}`);
  defaultStatementsData = await res.json();
  loadStatementsIntoEditor(defaultStatementsData);
}

addStatementBtn.addEventListener("click", () => addStatementRow());
resetStatementsBtn.addEventListener("click", () => {
  if (defaultStatementsData) loadStatementsIntoEditor(defaultStatementsData);
});

function readStatementsFromEditor() {
  return Array.from(statementsEditor.querySelectorAll(".statement-row"))
    .map((row) => {
      const text = row.querySelector("textarea").value.trim();
      const durationSec = parseInt(row.querySelector(".duration-input").value, 10) || 30;
      return { text, durationSec };
    })
    .filter((s) => s.text.length > 0);
}

// ---------- Setup: teams bewerken ----------

const teamsEditor = document.getElementById("teams-editor");
const addTeamBtn = document.getElementById("add-team-btn");
const resetTeamsBtn = document.getElementById("reset-teams-btn");

let defaultTeamsData = null;

function addTeamRow(name = "", color = "#6d4aff") {
  const row = document.createElement("div");
  row.className = "team-row";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = name;
  nameInput.placeholder = "Teamnaam";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = color;
  colorInput.title = "Kleur op het digibord";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-team-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(nameInput);
  row.appendChild(colorInput);
  row.appendChild(removeBtn);
  teamsEditor.appendChild(row);
}

function loadTeamsIntoEditor(data) {
  teamsEditor.innerHTML = "";
  data.teams.forEach((t) => addTeamRow(t.name, t.color));
}

async function loadDefaultTeams() {
  const res = await fetch(`data/teams.json?v=${CACHE_VERSION}`);
  defaultTeamsData = await res.json();
  loadTeamsIntoEditor(defaultTeamsData);
}

addTeamBtn.addEventListener("click", () => addTeamRow());
resetTeamsBtn.addEventListener("click", () => {
  if (defaultTeamsData) loadTeamsIntoEditor(defaultTeamsData);
});

function readTeamsFromEditor() {
  return Array.from(teamsEditor.querySelectorAll(".team-row"))
    .map((row) => ({
      name: row.querySelector('input[type="text"]').value.trim(),
      color: row.querySelector('input[type="color"]').value,
    }))
    .filter((t) => t.name.length > 0);
}

// ---------- Configuratie opslaan (los van een sessie) ----------

const SAVED_CONFIG_KEY = "stapindecirkel_config";
const saveConfigBtn = document.getElementById("save-config-btn");
const saveConfigMsg = document.getElementById("save-config-msg");

function loadSavedConfig() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CONFIG_KEY));
  } catch {
    return null;
  }
}

// Vult de editors met de opgeslagen configuratie als die er is, anders met de standaardset.
function applySavedOrDefaultConfig() {
  const saved = loadSavedConfig();
  if (saved) {
    centerWordInput.value = saved.centerWord || centerWordInput.value;
    statementsEditor.innerHTML = "";
    (saved.statements || []).forEach((s) => addStatementRow(s.text, s.durationSec));
    teamsEditor.innerHTML = "";
    (saved.teams || []).forEach((t) => addTeamRow(t.name, t.color));
  } else {
    if (defaultStatementsData) loadStatementsIntoEditor(defaultStatementsData);
    if (defaultTeamsData) loadTeamsIntoEditor(defaultTeamsData);
  }
}

saveConfigBtn.addEventListener("click", () => {
  const config = {
    centerWord: centerWordInput.value.trim() || "Digitale geletterdheid",
    statements: readStatementsFromEditor(),
    teams: readTeamsFromEditor(),
  };
  localStorage.setItem(SAVED_CONFIG_KEY, JSON.stringify(config));

  saveConfigMsg.classList.remove("hidden");
  clearTimeout(saveConfigBtn._msgTimer);
  saveConfigBtn._msgTimer = setTimeout(() => saveConfigMsg.classList.add("hidden"), 2500);
});

createSessionBtn.addEventListener("click", async () => {
  const name = sessionNameInput.value.trim() || "Stap in de cirkel";
  const centerWord = centerWordInput.value.trim() || "Digitale geletterdheid";
  const statements = readStatementsFromEditor();
  const teams = readTeamsFromEditor();

  if (statements.length === 0) {
    setupError.textContent = "Voeg minimaal één stelling toe.";
    setupError.classList.remove("hidden");
    return;
  }
  if (teams.length === 0) {
    setupError.textContent = "Voeg minimaal één team toe.";
    setupError.classList.remove("hidden");
    return;
  }
  setupError.classList.add("hidden");
  createSessionBtn.disabled = true;

  try {
    let code;
    let attempts = 0;
    do {
      code = generateSessionCode();
      attempts++;
      const existing = await db.ref(`sessions/${code}`).once("value");
      if (!existing.exists()) break;
    } while (attempts < 10);

    sessionId = code;
    sessionRef = db.ref(`sessions/${sessionId}`);

    await sessionRef.set({
      name,
      centerWord,
      status: "lobby",
      currentStatementIndex: -1,
      statements,
      teams,
      showCodes: true,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });

    showLobby();
  } catch (err) {
    setupError.textContent = "Kon geen sessie aanmaken. Controleer je verbinding en Firebase-config.";
    setupError.classList.remove("hidden");
    console.error(err);
  } finally {
    createSessionBtn.disabled = false;
  }
});

// ---------- Lobby ----------

const sessionCodeDisplay = document.getElementById("session-code-display");
const joinUrlDisplay = document.getElementById("join-url-display");
const participantCountEl = document.getElementById("participant-count");
const lobbyParticipants = document.getElementById("lobby-participants");
const startSessionBtn = document.getElementById("start-session-btn");
const openDisplayBtn = document.getElementById("open-display-btn");

let currentDisplayUrl = null;

function baseUrl() {
  return location.href.replace(/index\.html.*$/, "").replace(/\/$/, "") + "/";
}

function renderLobbyLinks() {
  sessionCodeDisplay.textContent = sessionId;

  const joinUrl = `${baseUrl()}join.html?s=${sessionId}`;
  currentDisplayUrl = `${baseUrl()}display.html?s=${sessionId}&admin=1`;
  joinUrlDisplay.textContent = joinUrl;

  document.getElementById("join-qr").innerHTML = "";
  new QRCode(document.getElementById("join-qr"), { text: joinUrl, width: 160, height: 160 });
}

function showLobby() {
  renderLobbyLinks();
  showScreen(lobbyScreen);
  listenToSession();
}

openDisplayBtn.addEventListener("click", () => {
  if (currentDisplayUrl) window.open(currentDisplayUrl, "_blank");
});

function renderLobbyParticipants() {
  const participants = (sessionData && sessionData.participants) || {};
  const list = Object.values(participants);
  participantCountEl.textContent = list.length;
  lobbyParticipants.innerHTML = "";
  if (list.length === 0) {
    lobbyParticipants.textContent = "Nog niemand aangemeld.";
    return;
  }
  list.forEach((p) => {
    const chip = document.createElement("span");
    chip.className = "participant-chip";
    chip.textContent = `${p.name} (${p.code})`;
    lobbyParticipants.appendChild(chip);
  });
}

startSessionBtn.addEventListener("click", async () => {
  await sessionRef.update({
    status: "active",
    currentStatementIndex: 0,
    statementOpenedAt: firebase.database.ServerValue.TIMESTAMP,
  });
});

// ---------- Control (sessie live) ----------

const controlProgress = document.getElementById("control-progress");
const controlStatementText = document.getElementById("control-statement-text");
const controlResponseCount = document.getElementById("control-response-count");
const controlTimeLeft = document.getElementById("control-time-left");
const controlTally = document.getElementById("control-tally");
const tallyAgree = document.getElementById("tally-agree");
const tallyDisagree = document.getElementById("tally-disagree");
const nextStatementBtn = document.getElementById("next-statement-btn");
const showCodesToggle = document.getElementById("show-codes-toggle");

function renderControl() {
  const idx = sessionData.currentStatementIndex;
  const statements = sessionData.statements || [];
  const statement = statements[idx];
  if (!statement) return;

  controlProgress.textContent = `Stelling ${idx + 1} van ${statements.length}`;
  controlStatementText.textContent = statement.text;
  showCodesToggle.checked = sessionData.showCodes !== false;

  tickControl();
  clearInterval(controlTimer);
  controlTimer = setInterval(tickControl, 250);
}

showCodesToggle.addEventListener("change", () => {
  sessionRef.update({ showCodes: showCodesToggle.checked });
});

function tickControl() {
  const idx = sessionData.currentStatementIndex;
  const participantCount = countParticipants(sessionData);
  const responseCount = countResponses(sessionData, idx);
  controlResponseCount.textContent = `${responseCount} van ${participantCount}`;

  const remaining = getRemainingSeconds(sessionData, idx);
  controlTimeLeft.textContent = Math.ceil(remaining) + "s";

  const closed = isStatementClosed(sessionData, idx);
  nextStatementBtn.disabled = !closed;
  if (closed) {
    const agree = countAgree(sessionData, idx);
    tallyAgree.textContent = agree;
    tallyDisagree.textContent = responseCount - agree;
    controlTally.classList.remove("hidden");
  } else {
    controlTally.classList.add("hidden");
  }
}

nextStatementBtn.addEventListener("click", async () => {
  const idx = sessionData.currentStatementIndex;
  const statements = sessionData.statements || [];
  if (idx + 1 >= statements.length) {
    await sessionRef.update({ status: "finished" });
  } else {
    await sessionRef.update({
      currentStatementIndex: idx + 1,
      statementOpenedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }
});

// ---------- Review ----------

const reviewSessionName = document.getElementById("review-session-name");
const reviewTeams = document.getElementById("review-teams");
const reviewParticipants = document.getElementById("review-participants");
const reviewDetail = document.getElementById("review-detail");
const exportCsvBtn = document.getElementById("export-csv-btn");
const backToSetupBtn = document.getElementById("back-to-setup-btn");

function renderReview() {
  reviewSessionName.textContent = `${sessionData.name} — sessiecode ${sessionId}`;
  const participants = sessionData.participants || {};
  const teams = sessionData.teams || [];
  reviewTeams.innerHTML = "";
  reviewParticipants.innerHTML = "";
  reviewDetail.classList.add("hidden");

  teams.forEach((team, teamId) => {
    const memberCount = Object.values(participants).filter((p) => p.teamId === teamId).length;
    const chip = document.createElement("span");
    chip.className = "participant-chip clickable";
    chip.innerHTML = `<span class="team-chip-dot" style="background:${team.color}"></span>${escapeHtml(team.name)} (${memberCount})`;
    chip.addEventListener("click", () => renderTeamDetail(teamId, team));
    reviewTeams.appendChild(chip);
  });

  Object.entries(participants).forEach(([participantId, p]) => {
    const { score, answered } = computeParticipantScore(sessionData, participantId);
    const team = teams[p.teamId];
    const chip = document.createElement("span");
    chip.className = "participant-chip clickable";
    chip.innerHTML = `${team ? `<span class="team-chip-dot" style="background:${team.color}"></span>` : ""}${escapeHtml(p.name)} (${escapeHtml(p.code)}) — ${score}/${answered}`;
    chip.addEventListener("click", () => renderParticipantDetail(participantId, p));
    reviewParticipants.appendChild(chip);
  });

  showScreen(reviewScreen);
}

function renderParticipantDetail(participantId, participant) {
  const statements = sessionData.statements || [];
  const responses = sessionData.responses || {};

  let html = `<h3>${escapeHtml(participant.name)} (${escapeHtml(participant.code)})</h3><table><tr><th>#</th><th>Stelling</th><th>Antwoord</th></tr>`;
  statements.forEach((s, idx) => {
    const r = responses[idx] && responses[idx][participantId];
    const answerText = r ? (r.value === 1 ? "Mee eens" : "Niet mee eens") : "Geen antwoord";
    html += `<tr><td>${idx + 1}</td><td>${escapeHtml(s.text)}</td><td>${answerText}</td></tr>`;
  });
  html += "</table>";
  reviewDetail.innerHTML = html;
  reviewDetail.classList.remove("hidden");
}

function renderTeamDetail(teamId, team) {
  const statements = sessionData.statements || [];
  const stats = computeTeamStats(sessionData, teamId);

  let html = `<h3><span class="team-chip-dot" style="background:${team.color}"></span>${escapeHtml(team.name)} — ${stats.memberCount} deelnemers</h3><table><tr><th>#</th><th>Stelling</th><th>Mee eens</th></tr>`;
  statements.forEach((s, idx) => {
    const st = stats.perStatement[idx];
    const cell = st.answered > 0
      ? `${st.agree} van ${st.answered} (${Math.round((st.agree / st.answered) * 100)}%)`
      : "Geen antwoorden";
    html += `<tr><td>${idx + 1}</td><td>${escapeHtml(s.text)}</td><td>${cell}</td></tr>`;
  });
  html += "</table>";
  reviewDetail.innerHTML = html;
  reviewDetail.classList.remove("hidden");
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

exportCsvBtn.addEventListener("click", () => {
  const statements = sessionData.statements || [];
  const participants = sessionData.participants || {};
  const responses = sessionData.responses || {};
  const teams = sessionData.teams || [];

  const header = ["Naam", "Code", "Team", ...statements.map((s, i) => `Stelling ${i + 1}`), "Score"];
  const rows = [header];

  Object.entries(participants).forEach(([participantId, p]) => {
    const { score } = computeParticipantScore(sessionData, participantId);
    const team = teams[p.teamId];
    const row = [p.name, p.code, team ? team.name : ""];
    statements.forEach((s, idx) => {
      const r = responses[idx] && responses[idx][participantId];
      row.push(r ? (r.value === 1 ? "Mee eens" : "Niet mee eens") : "");
    });
    row.push(score);
    rows.push(row);
  });

  const csv = rows.map((r) => r.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stap-in-de-cirkel_${sessionId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

backToSetupBtn.addEventListener("click", () => {
  sessionRef.off();
  sessionId = null;
  sessionRef = null;
  sessionData = null;
  sessionNameInput.value = "";
  applySavedOrDefaultConfig();
  showScreen(setupScreen);
});

// ---------- Live sessie-listener ----------

function listenToSession() {
  sessionRef.on("value", (snap) => {
    sessionData = snap.val();
    if (!sessionData) return;

    if (sessionData.status === "lobby") {
      if (sessionCodeDisplay.textContent !== sessionId) renderLobbyLinks();
      showScreen(lobbyScreen);
      renderLobbyParticipants();
    } else if (sessionData.status === "active") {
      showScreen(controlScreen);
      if (sessionData.currentStatementIndex !== lastRenderedStatementIndex) {
        lastRenderedStatementIndex = sessionData.currentStatementIndex;
        renderControl();
      }
    } else if (sessionData.status === "finished") {
      clearInterval(controlTimer);
      renderReview();
    }
  });
}

// ---------- Geschiedenis ----------

const historyList = document.getElementById("history-list");
const historyBackBtn = document.getElementById("history-back-btn");

historyBtn.addEventListener("click", async () => {
  historyList.textContent = "Laden...";
  showScreen(historyScreen);
  const snap = await db.ref("sessions").once("value");
  const sessions = snap.val() || {};
  historyList.innerHTML = "";

  const entries = Object.entries(sessions).sort(
    (a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0)
  );
  if (entries.length === 0) {
    historyList.textContent = "Nog geen sessies gevonden.";
    return;
  }

  entries.forEach(([code, s]) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const date = s.createdAt ? new Date(s.createdAt).toLocaleString("nl-NL") : "";
    row.innerHTML = `<span>${escapeHtml(s.name || code)} — ${code}</span><span class="hint">${date} · ${s.status}</span>`;
    row.addEventListener("click", () => openSessionFromHistory(code));
    historyList.appendChild(row);
  });
});

historyBackBtn.addEventListener("click", () => showScreen(setupScreen));

function openSessionFromHistory(code) {
  if (sessionRef) sessionRef.off();
  sessionId = code;
  sessionRef = db.ref(`sessions/${sessionId}`);
  lastRenderedStatementIndex = -2;
  listenToSession();
}

// ---------- Init ----------

(async () => {
  await Promise.all([loadDefaultStatements(), loadDefaultTeams()]);
  applySavedOrDefaultConfig();
})();

showScreen(setupScreen);
