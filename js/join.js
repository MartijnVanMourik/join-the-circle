let sessionId = null;
let sessionRef = null;
let participantId = null;
let sessionData = null;
let lastSeenStatementIndex = -2;
let hasAnsweredThisStatement = false;
let countdownTimer = null;

const joinScreen = document.getElementById("join-screen");
const waitingScreen = document.getElementById("waiting-screen");
const statementScreen = document.getElementById("statement-screen");
const finishedScreen = document.getElementById("finished-screen");

const sessionCodeInput = document.getElementById("session-code-input");
const nameInput = document.getElementById("name-input");
const codeInput = document.getElementById("code-input");
const teamSelect = document.getElementById("team-select");
const joinError = document.getElementById("join-error");
const joinBtn = document.getElementById("join-btn");

let sessionRequireCode = true;
const codeHint = document.getElementById("code-hint");

const waitingName = document.getElementById("waiting-name");
const waitingCode = document.getElementById("waiting-code");
const waitingCodeLine = document.getElementById("waiting-code-line");

// Codes staan alleen op het digibord als beide aan staan -- zelfde voorwaarde als
// noCodeMode in js/display.js, zodat deze regel nooit iets belooft dat niet klopt.
function codesShownOnDisplay(session) {
  return session.requireCode !== false && session.showCodes !== false;
}

const statementProgress = document.getElementById("statement-progress");
const statementText = document.getElementById("statement-text");
const timeBarFill = document.getElementById("time-bar-fill");
const timeLeftEl = document.getElementById("time-left");
const agreeBtn = document.getElementById("agree-btn");
const disagreeBtn = document.getElementById("disagree-btn");
const answeredMsg = document.getElementById("answered-msg");

const CONNECTION_TIMEOUT_MS = 6000;
const CONNECTION_TIMEOUT_MSG =
  "Kan geen verbinding maken. Controleer de sessiecode of probeer het zo opnieuw.";

function withTimeout(promise, ms = CONNECTION_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("connection-timeout")), ms)),
  ]);
}

function showScreen(el) {
  [joinScreen, waitingScreen, statementScreen, finishedScreen].forEach((s) =>
    s.classList.add("hidden")
  );
  el.classList.remove("hidden");
}

const params = new URLSearchParams(location.search);
const prefillCode = params.get("s");
if (prefillCode) {
  sessionCodeInput.value = prefillCode.toUpperCase();
  sessionCodeInput.readOnly = true; // via QR/link binnengekomen -- niet per ongeluk aan te passen
}

sessionCodeInput.addEventListener("input", () => {
  sessionCodeInput.value = sessionCodeInput.value.toUpperCase();
  tryLoadTeams();
});
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase();
});

let lastCheckedTeamsCode = null;
let teamsRequestId = 0;

function populateTeamSelect(teams) {
  teamSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Kies je sectie";
  placeholder.disabled = true;
  placeholder.selected = true;
  teamSelect.appendChild(placeholder);

  teams.forEach((team, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = team.name;
    teamSelect.appendChild(opt);
  });
}

// Sessiecodes zijn altijd exact 4 tekens (zie generateSessionCode in shared.js) -- pas
// vanaf dan opzoeken voorkomt dat een te-vroege (per definitie onbekende) 3-tekenscheck
// een net-op-tijd binnengekomen juiste 4-tekenscheck overschrijft.
async function tryLoadTeams() {
  const code = sessionCodeInput.value.trim().toUpperCase();
  if (code.length < 4 || code === lastCheckedTeamsCode) return;
  lastCheckedTeamsCode = code;
  const requestId = ++teamsRequestId;

  try {
    const snap = await withTimeout(db.ref(`sessions/${code}`).once("value"));
    if (requestId !== teamsRequestId) return; // een nieuwere check loopt al/is al klaar
    const session = snap.val();
    if (sessionCodeInput.value.trim().toUpperCase() !== code) return; // code intussen gewijzigd
    if (session && session.teams) {
      populateTeamSelect(session.teams);
      sessionRequireCode = session.requireCode !== false;
      codeHint.textContent = sessionRequireCode
        ? "Gebruik je eigen, bestaande docentencode."
        : "Gebruik je eigen, bestaande docentencode, of laat leeg.";
    } else {
      teamSelect.innerHTML = '<option value="" disabled selected>Onbekende sessiecode</option>';
    }
  } catch {
    lastCheckedTeamsCode = null; // opnieuw proberen toestaan
  }
}

function loadStoredSession() {
  try {
    return JSON.parse(localStorage.getItem("stapindecirkel_deelnemer"));
  } catch {
    return null;
  }
}

async function tryAutoRejoin() {
  const stored = loadStoredSession();
  if (!stored) return false;
  if (prefillCode && prefillCode.toUpperCase() !== stored.sessionId) return false;

  try {
    const sessionSnap = await withTimeout(db.ref(`sessions/${stored.sessionId}`).once("value"));
    const session = sessionSnap.val();
    if (!session) {
      localStorage.removeItem("stapindecirkel_deelnemer");
      return false;
    }
    const participantSnap = await withTimeout(
      db.ref(`sessions/${stored.sessionId}/participants/${stored.participantId}`).once("value")
    );
    if (!participantSnap.val()) {
      localStorage.removeItem("stapindecirkel_deelnemer");
      return false;
    }

    sessionId = stored.sessionId;
    participantId = stored.participantId;
    sessionRef = db.ref(`sessions/${sessionId}`);

    waitingName.textContent = stored.name;
    waitingCode.textContent = stored.code;
    waitingCodeLine.classList.toggle("hidden", !codesShownOnDisplay(session));

    showScreen(waitingScreen);
    listenForSessionUpdates();
    return true;
  } catch {
    joinError.textContent = CONNECTION_TIMEOUT_MSG;
    joinError.classList.remove("hidden");
    return false;
  }
}

(async () => {
  const rejoined = await tryAutoRejoin();
  if (!rejoined && prefillCode) tryLoadTeams();
})();

joinBtn.addEventListener("click", async () => {
  const code = sessionCodeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  const teacherCode = codeInput.value.trim().toUpperCase();

  if (code.length < 3) {
    joinError.textContent = "Vul een geldige sessiecode in.";
    joinError.classList.remove("hidden");
    return;
  }
  if (!name) {
    joinError.textContent = "Vul je naam in.";
    joinError.classList.remove("hidden");
    return;
  }
  if (sessionRequireCode && !teacherCode) {
    joinError.textContent = "Vul je docentencode in.";
    joinError.classList.remove("hidden");
    return;
  }
  if (!teamSelect.value) {
    joinError.textContent = "Kies eerst je sectie/team.";
    joinError.classList.remove("hidden");
    return;
  }

  joinBtn.disabled = true;
  joinError.classList.add("hidden");

  try {
    const snap = await withTimeout(db.ref(`sessions/${code}`).once("value"));
    const session = snap.val();
    if (!session) {
      joinError.textContent = "Deze sessiecode bestaat niet.";
      joinError.classList.remove("hidden");
      return;
    }
    if (session.status === "finished") {
      joinError.textContent = "Deze sessie is al afgelopen.";
      joinError.classList.remove("hidden");
      return;
    }
    if (session.requireCode !== false && !teacherCode) {
      joinError.textContent = "Vul je docentencode in.";
      joinError.classList.remove("hidden");
      return;
    }

    const existingParticipants = session.participants || {};
    const codeTaken =
      teacherCode !== "" &&
      Object.values(existingParticipants).some((p) => (p.code || "").toUpperCase() === teacherCode);
    if (codeTaken) {
      joinError.textContent = "Deze docentencode doet al mee in deze sessie — controleer je code.";
      joinError.classList.remove("hidden");
      return;
    }

    const teamId = parseInt(teamSelect.value, 10);

    sessionId = code;
    sessionRef = db.ref(`sessions/${sessionId}`);

    const newParticipantRef = sessionRef.child("participants").push();
    participantId = newParticipantRef.key;
    await withTimeout(
      newParticipantRef.set({
        name,
        code: teacherCode,
        teamId,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
      })
    );

    localStorage.setItem(
      "stapindecirkel_deelnemer",
      JSON.stringify({ sessionId, participantId, name, code: teacherCode })
    );

    waitingName.textContent = name;
    waitingCode.textContent = teacherCode;
    waitingCodeLine.classList.toggle("hidden", !codesShownOnDisplay(session));

    showScreen(waitingScreen);
    listenForSessionUpdates();
  } catch {
    joinError.textContent = CONNECTION_TIMEOUT_MSG;
    joinError.classList.remove("hidden");
  } finally {
    joinBtn.disabled = false;
  }
});

function listenForSessionUpdates() {
  sessionRef.on("value", (snap) => {
    sessionData = snap.val();
    if (!sessionData) return;

    if (sessionData.status === "lobby") {
      waitingCodeLine.classList.toggle("hidden", !codesShownOnDisplay(sessionData));
      showScreen(waitingScreen);
      stopCountdown();
    } else if (sessionData.status === "active") {
      if (sessionData.currentStatementIndex !== lastSeenStatementIndex) {
        lastSeenStatementIndex = sessionData.currentStatementIndex;
        hasAnsweredThisStatement = false;
        showStatement();
      }
    } else if (sessionData.status === "finished") {
      stopCountdown();
      showScreen(finishedScreen);
    }
  });
}

function showStatement() {
  const idx = sessionData.currentStatementIndex;
  const statements = sessionData.statements || [];
  const statement = statements[idx];
  if (!statement) return;

  statementText.textContent = statement.text;
  statementProgress.textContent = `Stelling ${idx + 1} van ${statements.length}`;
  answeredMsg.classList.add("hidden");
  agreeBtn.disabled = false;
  disagreeBtn.disabled = false;

  db.ref(`sessions/${sessionId}/responses/${idx}/${participantId}`)
    .once("value")
    .then((snap) => {
      if (snap.exists()) {
        hasAnsweredThisStatement = true;
        agreeBtn.disabled = true;
        disagreeBtn.disabled = true;
        answeredMsg.classList.remove("hidden");
      }
    });

  showScreen(statementScreen);
  startCountdown(statement.durationSec || 30);
}

async function submitAnswer(value) {
  if (hasAnsweredThisStatement) return;
  hasAnsweredThisStatement = true;

  agreeBtn.disabled = true;
  disagreeBtn.disabled = true;
  answeredMsg.classList.remove("hidden");

  const idx = sessionData.currentStatementIndex;
  await sessionRef.child(`responses/${idx}/${participantId}`).set({
    value,
    ts: firebase.database.ServerValue.TIMESTAMP,
  });
}

agreeBtn.addEventListener("click", () => submitAnswer(1));
disagreeBtn.addEventListener("click", () => submitAnswer(0));

function startCountdown(durationSec) {
  stopCountdown();
  const openedAt = sessionData.statementOpenedAt || Date.now();

  function tick() {
    const elapsed = (Date.now() - openedAt) / 1000;
    const remaining = Math.max(0, durationSec - elapsed);
    timeLeftEl.textContent = Math.ceil(remaining) + "s";
    timeBarFill.style.width = `${(remaining / durationSec) * 100}%`;
    if (remaining <= 0) stopCountdown();
  }

  tick();
  countdownTimer = setInterval(tick, 250);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}
