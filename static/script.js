/* ----------------------------------------------------------
   ELEMENTS
----------------------------------------------------------- */

const boardEl = document.getElementById("board");
const cells = Array.from(document.querySelectorAll(".cell"));
const turnText = document.getElementById("turnText");
const turnBadge = document.getElementById("turnBadge");
const messageText = document.getElementById("messageText");
const resetBtn = document.getElementById("resetBtn");
const clearScoreBtn = document.getElementById("clearScoreBtn");

const scoreXEl = document.getElementById("scoreX");
const scoreOEl = document.getElementById("scoreO");
const scoreDrawEl = document.getElementById("scoreDraw");
const themeToggleBtn = document.getElementById("themeToggle");

const modePvpBtn = document.getElementById("mode-pvp");
const modePvcBtn = document.getElementById("mode-pvc");

const levelRow = document.getElementById("difficultyRow");
const diffButtons = Array.from(document.querySelectorAll(".diff-btn"));

const avToggleBtn = document.getElementById("avToggle");

/* Helpers to show/hide the Level row only when we want */
function showLevelRow() {
  if (!levelRow) return;
  levelRow.style.display = "flex";
}
function hideLevelRow() {
  if (!levelRow) return;
  levelRow.style.display = "none";
}

/* ----------------------------------------------------------
   GAME STATE
----------------------------------------------------------- */

let board = Array(9).fill(null);
let current = "X";
let gameOver = false;

let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0;

let gameMode = "pvp";         // "pvp" or "pvc"
let humanPlayer = "X";
let computerPlayer = "O";
let isHumanTurn = true;

let difficulty = "easy";      // "easy" | "normal" | "hard"

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/* ----------------------------------------------------------
   AUDIO + VIBRATION + MODES
----------------------------------------------------------- */

const AV_MODES = ["sound_on", "sound_off", "vibrate"];
let avMode = localStorage.getItem("ttt_av_mode") || "sound_on";

function isSoundEnabled() {
  return avMode === "sound_on";
}
function isVibrateEnabled() {
  return avMode === "sound_on" || avMode === "vibrate";
}
function saveAvMode() {
  localStorage.setItem("ttt_av_mode", avMode);
}
function updateAvUI() {
  if (!avToggleBtn) return;
  if (avMode === "sound_on") avToggleBtn.textContent = "🔊 SOUND ON";
  else if (avMode === "sound_off") avToggleBtn.textContent = "🔕 SOUND OFF";
  else avToggleBtn.textContent = "📳 VIBRATE";
}

/* VIBRATION --------------------------------------------- */

function vibrate() {
  if (!isVibrateEnabled()) return;
  if (!navigator.vibrate) return; // iPhone Safari → silently ignore
  navigator.vibrate(25);
}

/* AUDIO ENGINE (tap beep + win sound) --------------------- */

let audioCtx = null;
function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTapBeep() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(600, now);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

function speak(text) {
  try {
    if (!isSoundEnabled()) return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1.05;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

function playWinSound() {
  if (!isSoundEnabled()) return;

  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.gain.linearRampToValueAtTime(0.0001, now + 2.1);
  master.connect(ctx.destination);

  const roarBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = roarBuf.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }

  const roar = ctx.createBufferSource();
  roar.buffer = roarBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.8, now);

  roar.connect(filter);
  filter.connect(g);
  g.connect(master);

  const delay = ctx.createDelay();
  delay.delayTime.value = 0.09;

  const fb = ctx.createGain();
  fb.gain.value = 0.35;

  g.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(master);

  roar.start(now);
  roar.stop(now + 2);
}

/* ----------------------------------------------------------
   CONFETTI + CROWN
----------------------------------------------------------- */

function launchConfetti() {
  if (typeof confetti !== "function") return;
  const end = Date.now() + 1200;
  (function frame() {
    confetti({
      particleCount: 10,
      startVelocity: 25,
      spread: 70,
      origin: { x: Math.random(), y: Math.random() - 0.2 }
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function showCrown() {
  const crownEl = document.getElementById("winCrown");
  if (!crownEl) return;
  crownEl.classList.remove("hidden");
  void crownEl.offsetWidth;
  crownEl.classList.add("active");
  setTimeout(() => {
    crownEl.classList.remove("active");
    crownEl.classList.add("hidden");
  }, 2500);
}

function clapBurst() {
  const container = document.getElementById("clapBurst");
  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("hidden");

  for (let i = 0; i < 8; i++) {
    const clap = document.createElement("div");
    clap.classList.add("clap");
    clap.textContent = "👏";
    clap.style.left = 10 + Math.random() * 80 + "%";
    clap.style.animationDelay = Math.random() * 0.3 + "s";
    container.appendChild(clap);
  }

  setTimeout(() => {
    container.classList.add("hidden");
    container.innerHTML = "";
  }, 1600);
}

/* ----------------------------------------------------------
   GAME LOGIC
----------------------------------------------------------- */

function setTurnDisplay() {
  turnBadge.textContent = current;
  turnText.classList.toggle("turn-x", current === "X");
  turnText.classList.toggle("turn-o", current === "O");
}

function clearWinningStyles() {
  cells.forEach(c => c.classList.remove("winning", "x", "o"));
}

function updateScoresDisplay() {
  scoreXEl.textContent = "X wins: " + scoreX;
  scoreOEl.textContent = "O wins: " + scoreO;
  scoreDrawEl.textContent = "Draws: " + scoreDraw;
}

function checkWinner() {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(v => v !== null)) {
    return { winner: "draw", line: [] };
  }
  return null;
}

/* MINIMAX + RANDOM BOT ----------------------------------- */

function evaluateBoard(state) {
  for (const [a, b, c] of WIN_LINES) {
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return state[a];
    }
  }
  if (state.every(v => v !== null)) return "draw";
  return null;
}

function getRandomMove() {
  const empty = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) empty.push(i);
  if (!empty.length) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

function minimax(state, player) {
  const winner = evaluateBoard(state);
  if (winner === computerPlayer) return { score: 10 };
  if (winner === humanPlayer) return { score: -10 };
  if (winner === "draw") return { score: 0 };

  const maximizing = player === computerPlayer;
  let best = { score: maximizing ? -Infinity : Infinity, index: null };

  for (let i = 0; i < 9; i++) {
    if (state[i] === null) {
      state[i] = player;
      const result = minimax(state, player === "X" ? "O" : "X");
      state[i] = null;

      if (maximizing) {
        if (result.score > best.score) best = { score: result.score, index: i };
      } else {
        if (result.score < best.score) best = { score: result.score, index: i };
      }
    }
  }

  return best;
}

function getSmartMove() {
  const result = minimax(board.slice(), computerPlayer);
  return result.index !== null ? result.index : getRandomMove();
}

/* ----------------------------------------------------------
   GAME FLOW
----------------------------------------------------------- */

function finishGame(result) {
  if (!result) return;
  gameOver = true;

  if (result.winner === "draw") {
    messageText.textContent = "It's a draw. Nobody wins.";
    scoreDraw++;
    speak("It's a draw.");
  } else {
    messageText.textContent = `Player ${result.winner} wins! 🎉`;
    result.line.forEach(i => cells[i].classList.add("winning"));
    if (result.winner === "X") scoreX++;
    if (result.winner === "O") scoreO++;

    playWinSound();
    launchConfetti();
    showCrown();
    clapBurst();
    speak(`Player ${result.winner} wins!`);
  }

  updateScoresDisplay();
}

function resetBoard() {
  board = Array(9).fill(null);
  gameOver = false;
  current = "X";
  isHumanTurn = true;

  clearWinningStyles();
  cells.forEach(c => c.textContent = "");

  setTurnDisplay();

  if (gameMode === "pvp") {
    messageText.textContent = "Two players. Player X starts.";
  } else {
    messageText.textContent = `Vs computer (${difficulty}). You are X.`;
  }
}

function clearScores() {
  scoreX = 0;
  scoreO = 0;
  scoreDraw = 0;
  updateScoresDisplay();
  resetBoard();
}

function handleClick(e) {
  const cell = e.target;
  const idx = Number(cell.getAttribute("data-idx"));

  if (gameOver || board[idx] !== null) return;

  /* PVP ---------------------------------------------------------------- */
  if (gameMode === "pvp") {
    board[idx] = current;
    cell.textContent = current;
    cell.classList.add(current.toLowerCase());

    playTapBeep();
    vibrate();

    const result = checkWinner();
    if (result) return finishGame(result);

    current = current === "X" ? "O" : "X";
    setTurnDisplay();
    messageText.textContent = `Player ${current}, your move.`;
    return;
  }

  /* PVC: HUMAN PLAY --------------------------------------------------- */

  if (!isHumanTurn) return;

  board[idx] = humanPlayer;
  cell.textContent = humanPlayer;
  cell.classList.add(humanPlayer.toLowerCase());

  playTapBeep();
  vibrate();

  let result = checkWinner();
  if (result) return finishGame(result);

  isHumanTurn = false;
  messageText.textContent = "Computer is thinking...";

  setTimeout(() => {
    computerMove();
  }, 350);
}

function computerMove() {
  if (gameOver) return;

  let move =
    difficulty === "easy"   ? (Math.random() < 0.6 ? getSmartMove() : getRandomMove()) :
    difficulty === "normal" ? (Math.random() < 0.8 ? getSmartMove() : getRandomMove()) :
                              (Math.random() < 0.9 ? getSmartMove() : getRandomMove());

  if (move == null) return;

  board[move] = computerPlayer;
  const cell = cells[move];
  cell.textContent = computerPlayer;
  cell.classList.add(computerPlayer.toLowerCase());

  playTapBeep();
  vibrate();

  let result = checkWinner();
  if (result) return finishGame(result);

  isHumanTurn = true;
  current = humanPlayer;
  setTurnDisplay();
  messageText.textContent = "Your turn!";
}

/* ----------------------------------------------------------
   MODE + DIFFICULTY SWITCH
----------------------------------------------------------- */

function setDifficulty(level) {
  difficulty = level;
  diffButtons.forEach(btn =>
    btn.classList.toggle("diff-active", btn.getAttribute("data-level") === level)
  );
}

diffButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    setDifficulty(btn.getAttribute("data-level"));
    if (gameMode === "pvc") {
      resetBoard();
      messageText.textContent = `Vs computer (${difficulty}). You are X.`;
    }
  });
});

modePvpBtn.addEventListener("click", () => {
  gameMode = "pvp";
  modePvpBtn.classList.add("mode-active");
  modePvcBtn.classList.remove("mode-active");

  hideLevelRow();   // 🔒 NEVER show Level row in 2 Players

  resetBoard();
  messageText.textContent = "Two players. Player X starts.";
});

modePvcBtn.addEventListener("click", () => {
  gameMode = "pvc";
  modePvcBtn.classList.add("mode-active");
  modePvpBtn.classList.remove("mode-active");

  showLevelRow();   // 👀 ONLY show Level row in Vs Computer
  setDifficulty(difficulty);

  resetBoard();
  messageText.textContent = `Vs computer (${difficulty}). You are X.`;
});

/* ----------------------------------------------------------
   BUTTONS
----------------------------------------------------------- */

cells.forEach(c => c.addEventListener("click", handleClick));
resetBtn.addEventListener("click", resetBoard);
clearScoreBtn.addEventListener("click", clearScores);

if (avToggleBtn) {
  avToggleBtn.addEventListener("click", () => {
    avMode = AV_MODES[(AV_MODES.indexOf(avMode) + 1) % AV_MODES.length];
    saveAvMode();
    updateAvUI();
  });
}

/* ----------------------------------------------------------
   THEME
----------------------------------------------------------- */

function applyTheme(mode) {
  if (mode === "light") {
    document.body.classList.add("light-mode");
    themeToggleBtn.textContent = "🌙 Dark";
  } else {
    document.body.classList.remove("light-mode");
    themeToggleBtn.textContent = "☀️ Light";
  }
  localStorage.setItem("ttt_theme", mode);
}

applyTheme(localStorage.getItem("ttt_theme") || "dark");

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-mode");
  applyTheme(isLight ? "dark" : "light");
});

/* ----------------------------------------------------------
   INIT
----------------------------------------------------------- */

setTurnDisplay();
updateScoresDisplay();
updateAvUI();
hideLevelRow();   // 🚫 Start with Level hidden (2 Players mode)