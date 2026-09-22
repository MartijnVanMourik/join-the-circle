// Terugvalkleuren voor deelnemers zonder (geldig) team — komt normaal niet voor.
const FALLBACK_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

// Deelnemers staan rondom een volledige cirkel (het stelling-paneel staat ernaast,
// niet meer onderin, dus er hoeft geen stuk boog vrijgehouden te worden).

const params = new URLSearchParams(location.search);
const sessionId = params.get("s");
const isAdminMode = params.get("admin") === "1";

let sessionData = null;
let frozenOrder = null;
let tickTimer = null;
let legendRendered = false;
const dotElements = {};

const arena = document.getElementById("arena");
const participantsLayer = document.getElementById("participants-layer");
const centerWordEl = document.getElementById("center-word");
const sessionCodeHint = document.getElementById("session-code-hint");

const panelLobby = document.getElementById("panel-lobby");
const panelStatement = document.getElementById("panel-statement");
const panelFinished = document.getElementById("panel-finished");
const lobbyCode = document.getElementById("lobby-code");
const lobbyCount = document.getElementById("lobby-count");

const panelProgress = document.getElementById("panel-progress");
const panelStatementText = document.getElementById("panel-statement-text");
const panelTimeFill = document.getElementById("panel-time-fill");
const panelTally = document.getElementById("panel-tally");
const panelTallyAgree = document.getElementById("panel-tally-agree");
const panelTallyDisagree = document.getElementById("panel-tally-disagree");
const panelNextBtn = document.getElementById("panel-next-btn");
const legendEl = document.getElementById("legend");

if (!sessionId) {
  document.body.innerHTML =
    '<p style="color:white;text-align:center;margin-top:40px;">Geen sessiecode meegegeven. Open deze pagina via de link/QR uit het organisatorscherm.</p>';
  throw new Error("no session id");
}

if (isAdminMode) {
  panelNextBtn.classList.remove("hidden");
  panelNextBtn.addEventListener("click", goToNextStatement);
}

const sessionRef = db.ref(`sessions/${sessionId}`);

sessionRef.on("value", (snap) => {
  sessionData = snap.val();
  if (!sessionData) return;
  render();
});

function showPanel(el) {
  [panelLobby, panelStatement, panelFinished].forEach((p) => p.classList.add("hidden"));
  el.classList.remove("hidden");
}

function render() {
  centerWordEl.textContent = sessionData.centerWord || "";
  sessionCodeHint.textContent = sessionId;

  renderLegend();
  renderArena();

  if (sessionData.status === "lobby") {
    lobbyCode.textContent = sessionId;
    lobbyCount.textContent = countParticipants(sessionData);
    showPanel(panelLobby);
    stopTicking();
  } else if (sessionData.status === "active") {
    showPanel(panelStatement);
    startTicking();
    tick();
  } else if (sessionData.status === "finished") {
    showPanel(panelFinished);
    stopTicking();
  }
}

// ---------- Deelnemers-cirkel ----------

function renderLegend() {
  if (legendRendered) return;
  const teams = sessionData.teams;
  if (!teams || !teams.length) return;
  legendEl.innerHTML = teams
    .map(
      (t) =>
        `<div class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${escapeHtml(t.name)}</div>`
    )
    .join("");
  legendRendered = true;
}

// Groepeert deelnemer-ids per team (in de volgorde waarin teams zijn ingesteld),
// zodat sectiegenoten bij elkaar op de boog komen te staan.
function groupByTeam(ids, participants, teams) {
  const groups = (teams || []).map(() => []);
  const noTeam = [];
  ids.forEach((id) => {
    const teamId = participants[id] && participants[id].teamId;
    if (teamId != null && groups[teamId]) {
      groups[teamId].push(id);
    } else {
      noTeam.push(id);
    }
  });
  return [].concat(...groups, noTeam);
}

function currentOrder() {
  const participants = (sessionData && sessionData.participants) || {};
  const ids = Object.keys(participants);
  const teams = sessionData.teams || [];

  if (sessionData.status === "lobby") {
    return groupByTeam(ids, participants, teams); // nog niet bevroren, volgt live het aanmelden
  }

  if (!frozenOrder) frozenOrder = groupByTeam(ids, participants, teams);
  ids.forEach((id) => {
    // laatkomers achteraan toevoegen zonder de rest te herschikken (mogelijk niet
    // naast hun sectiegenoten -- zie plan voor de afweging)
    if (!frozenOrder.includes(id)) frozenOrder.push(id);
  });
  return frozenOrder;
}

function renderArena() {
  const order = currentOrder();
  const participants = sessionData.participants || {};
  const totalStatements = (sessionData.statements || []).length || 1;

  const size = arena.clientWidth;
  const center = size / 2;
  const outerR = size * 0.48;
  const innerR = size * 0.19;

  // Puntgrootte schaalt mee met het aantal deelnemers, zodat de cirkel niet
  // dichtslibt bij grote groepen: elke stip krijgt hooguit de ruimte die er
  // (bij de buitenrand, het krapste punt) gemiddeld per deelnemer beschikbaar is.
  const circumferencePx = outerR * 2 * Math.PI;
  const idealSpacing = circumferencePx / Math.max(order.length, 1);
  const dotSize = Math.max(16, Math.min(54, idealSpacing * 0.82));
  const showFullCode = dotSize >= 30;
  const showInitial = !showFullCode && dotSize >= 20;
  const fontSize = Math.max(7, dotSize * (showFullCode ? 0.32 : 0.45));

  const seen = new Set();

  order.forEach((id, i) => {
    const participant = participants[id];
    if (!participant) return;
    seen.add(id);

    const angleDeg = (360 * i) / Math.max(order.length, 1);
    const angleRad = (angleDeg * Math.PI) / 180;

    const score = computeParticipantVisibleScore(sessionData, id);
    const fraction = Math.min(1, score / totalStatements);
    const radius = outerR - (outerR - innerR) * fraction;

    const x = center + radius * Math.sin(angleRad);
    const y = center - radius * Math.cos(angleRad);

    let dot = dotElements[id];
    if (!dot) {
      dot = document.createElement("div");
      dot.className = "participant-dot";
      const team = (sessionData.teams || [])[participant.teamId];
      dot.style.background = team ? team.color : FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
      dot.title = `${participant.name} (${participant.code})`;
      participantsLayer.appendChild(dot);
      dotElements[id] = dot;
    }
    const noCodeMode = sessionData.requireCode === false || sessionData.showCodes === false;
    dot.textContent = noCodeMode ? "" : showFullCode ? participant.code : showInitial ? participant.code[0] : "";
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    dot.style.marginLeft = `${-dotSize / 2}px`;
    dot.style.marginTop = `${-dotSize / 2}px`;
    dot.style.fontSize = `${fontSize}px`;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  });

  Object.keys(dotElements).forEach((id) => {
    if (!seen.has(id)) {
      dotElements[id].remove();
      delete dotElements[id];
    }
  });
}

// ---------- Stelling-paneel ----------

function startTicking() {
  stopTicking();
  tickTimer = setInterval(tick, 250);
}

function stopTicking() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function tick() {
  if (!sessionData || sessionData.status !== "active") return;
  const idx = sessionData.currentStatementIndex;
  const statements = sessionData.statements || [];
  const statement = statements[idx];
  if (!statement) return;

  panelProgress.textContent = `Stelling ${idx + 1} van ${statements.length}`;
  panelStatementText.textContent = statement.text;

  const duration = getStatementDuration(sessionData, idx);
  const remaining = getRemainingSeconds(sessionData, idx);
  panelTimeFill.style.width = `${(remaining / duration) * 100}%`;

  const closed = isStatementClosed(sessionData, idx);
  if (closed) {
    const responseCount = countResponses(sessionData, idx);
    const agree = countAgree(sessionData, idx);
    panelTallyAgree.textContent = agree;
    panelTallyDisagree.textContent = responseCount - agree;
    panelTally.classList.remove("hidden");
    if (isAdminMode) panelNextBtn.disabled = false;

    renderArena(); // posities kunnen net zijn "vrijgegeven" doordat de stelling sluit
  } else {
    panelTally.classList.add("hidden");
    if (isAdminMode) panelNextBtn.disabled = true;
  }
}

async function goToNextStatement() {
  const idx = sessionData.currentStatementIndex;
  const statements = sessionData.statements || [];
  panelNextBtn.disabled = true;
  if (idx + 1 >= statements.length) {
    await sessionRef.update({ status: "finished" });
  } else {
    await sessionRef.update({
      currentStatementIndex: idx + 1,
      statementOpenedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }
}

window.addEventListener("resize", () => {
  if (sessionData) renderArena();
});
