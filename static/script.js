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

const difficultyRow = document.getElementById("difficultyRow");
const diffButtons = Array.from(document.querySelectorAll(".diff-btn"));

let board = Array(9).fill(null);
let current = "X";
let gameOver = false;

let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0;

// game mode: "pvp" = 2 players, "pvc" = vs computer
let gameMode = "pvp";
let humanPlayer = "X";
let computerPlayer = "O";
let isHumanTurn = true;

// difficulty: "easy" | "normal" | "hard"
let difficulty = "easy";

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

/* ---------- AUDIO + VIBRATION ---------- */

function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate([25]);
  }
}

// Shared AudioContext for all custom sounds
let audioCtx = null;
let audioPrimed = false;

function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  if (!audioCtx) {
    audioCtx = new AC();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// One-time tiny silent sound to "unlock" audio on stricter browsers (Render)
function primeAudio() {
  if (audioPrimed) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  audioPrimed = true;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  gain.gain.setValueAtTime(0.0001, ctx.currentTime); // effectively silent
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.02);
}

// Speech helper
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1.05;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

/**
 * Stadium crowd mix:
 * - Wide "roar" noise with light echo
 * - Random clap bursts on top
 * - Around 2s total
 */
function playWinSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain to control global volume + fade out
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.95, now);
  masterGain.gain.linearRampToValueAtTime(0.0001, now + 2.1);
  masterGain.connect(ctx.destination);

  /* --- 1) CROWD ROAR (background) --- */
  const roarDuration = 2.0;
  const roarBufferSize = Math.floor(ctx.sampleRate * roarDuration);
  const roarBuffer = ctx.createBuffer(1, roarBufferSize, ctx.sampleRate);
  const roarData = roarBuffer.getChannelData(0);

  for (let i = 0; i < roarBufferSize; i++) {
    // Smoothish noise for "roar"
    roarData[i] = (Math.random() * 2 - 1) * 0.5;
  }

  const roarSource = ctx.createBufferSource();
  roarSource.buffer = roarBuffer;

  const roarFilter = ctx.createBiquadFilter();
  roarFilter.type = "bandpass";
  roarFilter.frequency.value = 700; // mid crowd band
  roarFilter.Q.value = 0.9;

  const roarGain = ctx.createGain();
  roarGain.gain.setValueAtTime(0.8, now);

  // Simple echo / reverb with feedback
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.09; // 90 ms "stadium slap"

  const feedback = ctx.createGain();
  feedback.gain.value = 0.35; // how strong the echo bounces

  roarSource.connect(roarFilter);
  roarFilter.connect(roarGain);

  // Dry
  roarGain.connect(masterGain);
  // Wet (echo)
  roarGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(masterGain);

  roarSource.start(now);
  roarSource.stop(now + roarDuration);

  /* --- 2) CLAP BURSTS (foreground pops) --- */
  const hits = 14;
  for (let i = 0; i < hits; i++) {
    const t = now + 0.2 + Math.random() * 1.0; // spread over ~1.2s

    const clapDuration = 0.2;
    const clapBufferSize = Math.floor(ctx.sampleRate * clapDuration);
    const clapBuffer = ctx.createBuffer(1, clapBufferSize, ctx.sampleRate);
    const clapData = clapBuffer.getChannelData(0);

    for (let j = 0; j < clapBufferSize; j++) {
      // Sharper noise for clap transient
      clapData[j] = (Math.random() * 2 - 1);
    }

    const clapSource = ctx.createBufferSource();
    clapSource.buffer = clapBuffer;

    const clapFilter = ctx.createBiquadFilter();
    clapFilter.type = "bandpass";
    clapFilter.frequency.value = 1500 + Math.random() * 1000; // bright
    clapFilter.Q.value = 2.0;

    const clapGain = ctx.createGain();
    clapGain.gain.setValueAtTime(0.7, t);
    clapGain.gain.exponentialRampToValueAtTime(0.001, t + clapDuration);

    clapSource.connect(clapFilter);
    clapFilter.connect(clapGain);
    clapGain.connect(masterGain);

    clapSource.start(t);
    clapSource.stop(t + clapDuration + 0.05);
  }
}

// Confetti
function launchConfetti() {
  if (typeof confetti !== "function") return;

  const duration = 1200;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 10,
      startVelocity: 25,
      spread: 70,
      origin: { x: Math.random(), y: Math.random() - 0.2 },
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

/* ---------- CORE HELPERS ---------- */

function setTurnDisplay() {
  turnBadge.textContent = current;
  turnText.classList.toggle("turn-x", current === "X");
  turnText.classList.toggle("turn-o", current === "O");
}

function clearWinningStyles() {
  cells.forEach((c) => c.classList.remove("winning", "x", "o"));
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
  if (board.every((v) => v !== null)) {
    return { winner: "draw", line: [] };
  }
  return null;
}

// For AI: evaluate an arbitrary board state
function evaluateBoard(state) {
  for (const [a, b, c] of WIN_LINES) {
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return state[a]; // 'X' or 'O'
    }
  }
  if (state.every((v) => v !== null)) return "draw";
  return null;
}

function getRandomMove() {
  const empty = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) empty.push(i);
  }
  if (!empty.length) return null;
  const idx = Math.floor(Math.random() * empty.length);
  return empty[idx];
}

// Minimax for HARD / smart move
function minimax(state, player) {
  const winner = evaluateBoard(state);
  if (winner === computerPlayer) return { score: 10 };
  if (winner === humanPlayer) return { score: -10 };
  if (winner === "draw") return { score: 0 };

  const isMaximizing = player === computerPlayer;
  let best = { score: isMaximizing ? -Infinity : Infinity, index: null };

  for (let i = 0; i < 9; i++) {
    if (state[i] === null) {
      state[i] = player;
      const result = minimax(state, player === "X" ? "O" : "X");
      state[i] = null;

      if (isMaximizing) {
        if (result.score > best.score) {
          best = { score: result.score, index: i };
        }
      } else {
        if (result.score < best.score) {
          best = { score: result.score, index: i };
        }
      }
    }
  }
  return best;
}

function getSmartMove() {
  const copy = board.slice();
  const result = minimax(copy, computerPlayer);
  if (result && result.index !== null && result.index !== undefined) {
    return result.index;
  }
  return getRandomMove();
}

/* ---------- GAME FLOW ---------- */

function finishGame(result) {
  if (!result) return;
  gameOver = true;

  const { winner, line } = result;

  if (winner === "draw") {
    messageText.textContent = "It's a draw. Nobody wins.";
    scoreDraw++;
    speak("It's a draw. Nobody wins.");
  } else {
    messageText.textContent = `Player ${winner} wins! 🎉`;
    line.forEach((i) => cells[i].classList.add("winning"));
    if (winner === "X") scoreX++;
    if (winner === "O") scoreO++;

    // 🔊 Only big stadium crowd
    playWinSound();          // stadium crowd roar + claps
    launchConfetti();        // confetti
    showCrown();             // 👑 crown animation
    clapBurst();             // 👏 emojis falling
    speak(`Congratulations! Player ${winner} wins!`);
  }

  updateScoresDisplay();
}

function showCrown() {
  const crownEl = document.getElementById("winCrown");
  if (!crownEl) return;

  crownEl.classList.remove("hidden");
  void crownEl.offsetWidth; // Reset animation
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

  const count = 8;
  for (let i = 0; i < count; i++) {
    const clap = document.createElement("div");
    clap.classList.add("clap");
    clap.textContent = "👏";

    const left = 10 + Math.random() * 80;
    clap.style.left = left + "%";
    clap.style.animationDelay = (Math.random() * 0.3) + "s";

    container.appendChild(clap);
  }

  setTimeout(() => {
    container.classList.add("hidden");
    container.innerHTML = "";
  }, 1600);
}

function resetBoard() {
  board = Array(9).fill(null);
  gameOver = false;
  current = "X";
  isHumanTurn = true;

  clearWinningStyles();
  cells.forEach((c) => (c.textContent = ""));

  setTurnDisplay();

  if (gameMode === "pvp") {
    messageText.textContent = "New round! Player X starts.";
  } else {
    messageText.textContent = "Vs computer. You are X, tap a square.";
  }
}

function clearScores() {
  scoreX = 0;
  scoreO = 0;
  scoreDraw = 0;
  updateScoresDisplay();
  resetBoard();
  messageText.textContent = "Scores cleared. Player X starts.";
}

function handleClick(e) {
  const cell = e.target;
  const idx = Number(cell.getAttribute("data-idx"));

  if (gameOver || board[idx] !== null) return;

  // First real tap unlocks audio for Render / strict browsers
  primeAudio();

  /* ---------- PVP ---------- */
  if (gameMode === "pvp") {
    board[idx] = current;
    cell.textContent = current;
    cell.classList.add(current.toLowerCase());

    vibrate();

    const result = checkWinner();
    if (result) return finishGame(result);

    current = current === "X" ? "O" : "X";
    setTurnDisplay();
    messageText.textContent = `Player ${current}, your move.`;
    return;
  }

  /* ---------- PVC: HUMAN PLAYS X ---------- */
  if (!isHumanTurn) return;

  board[idx] = humanPlayer;
  cell.textContent = humanPlayer;
  cell.classList.add(humanPlayer.toLowerCase());

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

  let moveIndex = null;

  if (difficulty === "easy") {
    // 40% smart, 60% random
    const useSmart = Math.random() < 0.4;
    moveIndex = useSmart ? getSmartMove() : getRandomMove();
  } else if (difficulty === "normal") {
    // 80% smart, 20% random
    const useSmart = Math.random() < 0.8;
    moveIndex = useSmart ? getSmartMove() : getRandomMove();
  } else {
    // HARD: 90% smart, 10% random
    const useSmart = Math.random() < 0.9;
    moveIndex = useSmart ? getSmartMove() : getRandomMove();
  }

  if (moveIndex === null || moveIndex === undefined) return;

  board[moveIndex] = computerPlayer;

  const cell = cells[moveIndex];
  cell.textContent = computerPlayer;
  cell.classList.add(computerPlayer.toLowerCase());

  let result = checkWinner();
  if (result) return finishGame(result);

  isHumanTurn = true;
  current = humanPlayer;
  setTurnDisplay();
  messageText.textContent = "Your turn!";
}

/* ---------- MODE + DIFFICULTY SWITCH ---------- */

function setDifficulty(level) {
  difficulty = level;
  diffButtons.forEach((btn) => {
    if (btn.getAttribute("data-level") === level) {
      btn.classList.add("diff-active");
    } else {
      btn.classList.remove("diff-active");
    }
  });
}

diffButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const level = btn.getAttribute("data-level");
    setDifficulty(level);
    if (gameMode === "pvc") {
      resetBoard();
      messageText.textContent = `Vs computer (${level} mode). You are X.`;
    }
  });
});

modePvpBtn.addEventListener("click", () => {
  gameMode = "pvp";
  modePvpBtn.classList.add("mode-active");
  modePvcBtn.classList.remove("mode-active");

  difficultyRow.classList.add("hidden");

  resetBoard();
  messageText.textContent = "Two players. Player X starts.";
});

modePvcBtn.addEventListener("click", () => {
  gameMode = "pvc";
  modePvcBtn.classList.add("mode-active");
  modePvpBtn.classList.remove("mode-active");

  difficultyRow.classList.remove("hidden");
  setDifficulty(difficulty || "easy");

  resetBoard();
  messageText.textContent = "Vs computer. You are X.";
});

/* ---------- BUTTONS ---------- */

cells.forEach((cell) => cell.addEventListener("click", handleClick));
resetBtn.addEventListener("click", resetBoard);
clearScoreBtn.addEventListener("click", clearScores);

/* ---------- THEME ---------- */

function applyTheme(mode) {
  const body = document.body;
  if (mode === "light") {
    body.classList.add("light-mode");
    themeToggleBtn.textContent = "🌙 Dark";
  } else {
    body.classList.remove("light-mode");
    themeToggleBtn.textContent = "☀️ Light";
  }
  localStorage.setItem("ttt_theme", mode);
}

const storedTheme = localStorage.getItem("ttt_theme") || "dark";
applyTheme(storedTheme);

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-mode");
  applyTheme(isLight ? "dark" : "light");
});

/* ---------- INIT ---------- */
setTurnDisplay();
updateScoresDisplay();