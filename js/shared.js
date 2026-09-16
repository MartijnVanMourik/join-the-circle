// Gedeelde, puur afgeleide logica — niets hiervan wordt apart in de database opgeslagen,
// zodat display/admin/join altijd consistent dezelfde stand berekenen.

function countParticipants(session) {
  return session.participants ? Object.keys(session.participants).length : 0;
}

function countResponses(session, statementIndex) {
  const responses = session.responses && session.responses[statementIndex];
  return responses ? Object.keys(responses).length : 0;
}

function getStatementDuration(session, statementIndex) {
  const statement = session.statements && session.statements[statementIndex];
  return (statement && statement.durationSec) || 30;
}

// Resterende tijd in seconden. Springt naar 0 zodra iedereen heeft geantwoord,
// ook als de tijdslimiet nog niet is verstreken.
function getRemainingSeconds(session, statementIndex) {
  const duration = getStatementDuration(session, statementIndex);
  const openedAt = session.statementOpenedAt || Date.now();
  const elapsed = (Date.now() - openedAt) / 1000;
  const timeRemaining = Math.max(0, duration - elapsed);

  const participantCount = countParticipants(session);
  const responseCount = countResponses(session, statementIndex);
  if (participantCount > 0 && responseCount >= participantCount) return 0;

  return timeRemaining;
}

function isStatementClosed(session, statementIndex) {
  return getRemainingSeconds(session, statementIndex) <= 0;
}

function countAgree(session, statementIndex) {
  const responses = (session.responses && session.responses[statementIndex]) || {};
  return Object.values(responses).filter((r) => r.value === 1).length;
}

// Som van antwoordwaarden voor één deelnemer, plus hoeveel stellingen die persoon beantwoord heeft.
function computeParticipantScore(session, participantId) {
  const responses = session.responses || {};
  let score = 0;
  let answered = 0;
  Object.keys(responses).forEach((statementIndex) => {
    const r = responses[statementIndex][participantId];
    if (r) {
      answered++;
      score += r.value;
    }
  });
  return { score, answered };
}

// Tot en met welke stelling-index is er al "gesloten" (tijd om of iedereen geantwoord)?
// -1 betekent: nog geen enkele stelling gesloten.
function getClosedStatementThreshold(session) {
  if (session.status === "finished") {
    return (session.statements ? session.statements.length : 0) - 1;
  }
  const idx = session.currentStatementIndex;
  if (idx == null || idx < 0) return -1;
  return isStatementClosed(session, idx) ? idx : idx - 1;
}

// Score op basis van alleen al-gesloten stellingen, zodat posities pas verspringen
// zodra een stelling écht is afgesloten (voorkomt kuddegedrag tijdens het stemmen).
function computeParticipantVisibleScore(session, participantId) {
  const threshold = getClosedStatementThreshold(session);
  const responses = session.responses || {};
  let score = 0;
  for (let i = 0; i <= threshold; i++) {
    const r = responses[i] && responses[i][participantId];
    if (r) score += r.value;
  }
  return score;
}

// Geaggregeerde antwoorden per stelling voor één team: hoeveel teamleden hebben
// geantwoord en hoeveel daarvan "mee eens" kozen.
function computeTeamStats(session, teamId) {
  const participants = session.participants || {};
  const statements = session.statements || [];
  const responses = session.responses || {};

  const memberIds = Object.keys(participants).filter((pid) => participants[pid].teamId === teamId);

  const perStatement = statements.map((_, idx) => {
    const statementResponses = responses[idx] || {};
    let answered = 0;
    let agree = 0;
    memberIds.forEach((pid) => {
      const r = statementResponses[pid];
      if (r) {
        answered++;
        agree += r.value;
      }
    });
    return { answered, agree };
  });

  return { memberCount: memberIds.length, perStatement };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function generateSessionCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I en O weggelaten, lijken op 1/0
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}
