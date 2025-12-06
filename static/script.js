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

const modePvpBtn    = document.getElementById("mode-pvp");
const modePvcBtn    = document.getElementById("mode-pvc");
const modeOnlineBtn = document.getElementById("mode-online");

const levelRow     = document.getElementById("difficultyRow");
const diffButtons  = Array.from(document.querySelectorAll(".diff-btn"));

const avToggleBtn    = document.getElementById("avToggle");
const onlineControls = document.getElementById("onlineControls");
const onlineHostBtn  = document.getElementById("onlineHostBtn");
const onlineJoinBtn  = document.getElementById("onlineJoinBtn");
const onlineStatusEl = document.getElementById("onlineStatus");

/* Helpers to show/hide the Level row only when we want */
function showLevelRow() {
  if (!levelRow) return;
  levelRow.style.display = "flex";
}
function hideLevelRow() {
  if (!levelRow) return;
  levelRow.style.display = "none";
}

/* Online UI helpers */
function showOnlineControls(show) {
  if (!onlineControls) return;
  onlineControls.classList.toggle("hidden", !show);
}
function setOnlineStatus(html) {
  if (!onlineStatusEl) return;
  if (!html) {
    onlineStatusEl.innerHTML = "";
    onlineStatusEl.classList.add("hidden");
  } else {
    onlineStatusEl.innerHTML = html;
    onlineStatusEl.classList.remove("hidden");
  }
}

function lockModeButtonsForOnline(isLocked) {
  [modePvpBtn, modePvcBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = isLocked;
  });
}

/* ----------------------------------------------------------
   GAME STATE
----------------------------------------------------------- */

let board   = Array(9).fill(null);
let current = "X";
let gameOver = false;

let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0;

let gameMode = "pvp";   // "pvp" | "pvc" | "online"
let humanPlayer    = "X";
let computerPlayer = "O";
let isHumanTurn    = true;

// Who won the last completed game? "X", "O" or "draw"
let lastWinnerMarker = null;

let difficulty = "easy";      // "easy" | "normal" | "hard"

/* Online mode backend state */
let onlineRoomId    = null;   // e.g. "ABC123"
let onlinePlayer    = null;   // "X" or "O"
let onlinePollTimer = null;

/* Rematch state: controls label of green button */
let isRematchAvailable = false;

const WIN_LINES = [
  [0, 1, 2],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [3, 4, 5],
  [6, 7, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/* ----------------------------------------------------------
   RESET / REMATCH BUTTON LABEL
----------------------------------------------------------- */

function setResetButtonLabel(isRematch) {
  if (!resetBtn) return;
  if (isRematch) {
    resetBtn.innerHTML = `<span class="icon">🔁</span> Rematch`;
  } else {
    resetBtn.innerHTML = `<span class="icon">🔁</span> Reset board`;
  }
}

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

function vibrateWin() {
  if (!isVibrateEnabled()) return;
  if (!navigator.vibrate) return;
  navigator.vibrate([80, 40, 80]);
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
  // Only remove the orange win glow; keep X/O color classes
  cells.forEach(c => c.classList.remove("winning"));
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
  if (winner === humanPlayer)    return { score: -10 };
  if (winner === "draw")         return { score: 0 };

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

function computerMove() {
  if (gameMode !== "pvc" || gameOver) return;

  let smartChance = 0;

  if (difficulty === "easy") {
    smartChance = 0.60; // 60% smart, 40% random
  } else if (difficulty === "normal") {
    smartChance = 0.80; // 80/20
  } else {
    smartChance = 0.90; // 90/10
  }

  let moveIndex;

  // Decide smart vs random
  if (Math.random() < smartChance) {
    moveIndex = getSmartMove();
  } else {
    moveIndex = getRandomMove();
  }

  if (moveIndex === null) return; // no moves left

  board[moveIndex] = computerPlayer;
  const cell = cells[moveIndex];
  cell.textContent = computerPlayer;
  cell.classList.add(computerPlayer.toLowerCase());

  playTapBeep();
  vibrate();

  const result = checkWinner();
  if (result) {
    finishGame(result);
    return;
  }

  // hand turn back to human
  current = humanPlayer;
  isHumanTurn = true;
  setTurnDisplay();
  if (messageText) {
    messageText.textContent = `Vs computer (${difficulty}). Your turn!`;
  }
}

/* ----------------------------------------------------------
   ONLINE HELPERS – SYNC WITH SERVER
----------------------------------------------------------- */

function applyServerBoard(serverBoard) {
  board = serverBoard.slice();
  // ❌ do NOT clearWinningStyles here, so winning glow can stay

  for (let i = 0; i < 9; i++) {
    const cell = cells[i];
    const val = board[i];
    cell.textContent = val ? val : "";
    cell.classList.remove("x", "o");
    if (val === "X") cell.classList.add("x");
    if (val === "O") cell.classList.add("o");
  }
}

/* Poll room state once (used by polling + join + reset) */
async function fetchRoomStateOnce() {
  if (!onlineRoomId || gameMode !== "online") return;

  try {
    const res  = await fetch(`/api/room_state/${onlineRoomId}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      console.error("room_state error:", data);
      // If the room vanished, auto-exit to local mode
      if (res.status === 404 || (data && data.error === "Room not found")) {
        leaveOnlineMode("Opponent left the match. Back to local 2 players.");
      }
      return;
    }

    // 1) Apply board from server
    applyServerBoard(data.board || []);
    current = data.current_turn || "X";
    setTurnDisplay();

    const result = checkWinner();

    // 2) If there is a winner/draw AND server says game is finished → finalize
    const serverFinished =
      data.status === "finished" || data.winner || (result && result.winner);

    if (serverFinished && !gameOver && result) {
      finishGame(result);
      return;
    }

    // 3) If NO winner on the board → force "active" state on this client.
    //    This covers the loser after the winner hits Rematch.
    if (!result) {
      gameOver = false;
      isRematchAvailable = false;
      setResetButtonLabel(false);
      clearWinningStyles();
    }

    // 4) Normal status text when game is in progress
    if (!gameOver && messageText) {
      messageText.textContent = `Online. Player ${current}, your move.`;
    }

    // 5) If game is finished and opponent pressed "Ready", tell this player.
    if (
      gameMode === "online" &&
      onlineRoomId &&
      onlinePlayer &&
      data.status === "finished" &&
      gameOver
    ) {
      const opponentReady =
        onlinePlayer === "X" ? !!data.ready_O : !!data.ready_X;

      if (opponentReady && messageText) {
        messageText.textContent = "Opponent is ready.";
      }
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

function startOnlinePolling() {
  if (onlinePollTimer) return;
  onlinePollTimer = setInterval(fetchRoomStateOnce, 800); // ~0.8s
}

function stopOnlinePolling() {
  if (onlinePollTimer) {
    clearInterval(onlinePollTimer);
    onlinePollTimer = null;
  }
}

/* Leave Online mode on THIS device (used by Stop or room closed) */
function leaveOnlineMode(msg) {
  // Stop talking to the server
  stopOnlinePolling();
  onlineRoomId = null;
  onlinePlayer = null;
  gameMode = "pvp";

  // Unlock mode buttons
  lockModeButtonsForOnline(false);

  // Hide online controls + status line
  showOnlineControls(false);
  setOnlineStatus("");

  // Visually go back to 2 Players mode
  if (modePvpBtn) modePvpBtn.classList.add("mode-active");
  if (modePvcBtn) modePvcBtn.classList.remove("mode-active");
  if (modeOnlineBtn) {
    modeOnlineBtn.classList.remove("mode-active");
    modeOnlineBtn.textContent = "Online";
  }

  // Reset local board / state
  board = Array(9).fill(null);
  gameOver = false;
  isRematchAvailable = false;
  setResetButtonLabel(false);
  clearWinningStyles();
  cells.forEach(c => { c.textContent = ""; });
  current = "X";
  setTurnDisplay();

  if (messageText) {
    messageText.textContent = msg || "Online game stopped. Back to local 2 players.";
  }
}

/* Join helper (used by Online button + auto-join link) */
async function joinRoomByCode(roomIdRaw) {
  const roomIdToJoin = (roomIdRaw || "").trim().toUpperCase();
  if (!roomIdToJoin) return false;

  try {
    const res = await fetch("/api/join_room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomIdToJoin })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Join room error:", data);
      alert(data.error || "Failed to join room");
      return false;
    }

    onlineRoomId = data.room_id;
    onlinePlayer = data.you_are; // "O"

    console.log("Joined online room:", onlineRoomId, "You are:", onlinePlayer);

    lockModeButtonsForOnline(true);
    if (modeOnlineBtn) modeOnlineBtn.textContent = "Stop";

    setOnlineStatus(
      `Joined room: <strong>${onlineRoomId}</strong> · You are ${onlinePlayer}.`
    );

    if (messageText) {
      messageText.textContent =
        `Joined room: ${onlineRoomId}. You are ${onlinePlayer}. ` +
        `Wait for Player X to move.`;
    }

    startOnlinePolling();
    await fetchRoomStateOnce();
    return true;
  } catch (err) {
    console.error("Network error joining room:", err);
    alert("Network error while joining room");
    return false;
  }
}

/* Build invite link for this room */
function buildJoinLink() {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?room=${onlineRoomId}`;
}

/* Offer to share or copy link */
async function offerShareLink() {
  if (!onlineRoomId) return;
  const joinLink = buildJoinLink();

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Tic Tac Toe Arena",
        text: "Join my Tic Tac Toe room!",
        url: joinLink,
      });
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(joinLink);
      alert("Invite link copied! Send it to your friend:\n" + joinLink);
    } else {
      window.prompt("Copy this link and send it to your friend:", joinLink);
    }
  } catch (e) {
    console.error("Share/copy error:", e);
    alert("Here is your invite link:\n" + joinLink);
  }
}

/* ----------------------------------------------------------
   GAME FLOW
----------------------------------------------------------- */

function finishGame(result) {
  if (!result) return;
  gameOver = true;

  // Enable Rematch button
  isRematchAvailable = true;
  setResetButtonLabel(true);

  if (result.winner === "draw") {
    lastWinnerMarker = "draw";
    if (messageText) messageText.textContent = "It's a draw. Nobody wins.";
    scoreDraw++;
    speak("It's a draw.");

    setResetButtonLabel(true);
    resetBtn.disabled = false;
  } else {
    lastWinnerMarker = result.winner;

    if (messageText) {
      messageText.textContent = `Player ${result.winner} wins! 🎉`;
    }
    result.line.forEach(i => cells[i].classList.add("winning"));
    if (result.winner === "X") scoreX++;
    if (result.winner === "O") scoreO++;

    playWinSound();
    vibrateWin();    // strong vibration for win
    launchConfetti();
    showCrown();
    clapBurst();
    speak(`Player ${result.winner} wins!`);

    // Online: winner gets "Rematch", loser gets "Ready"
    if (gameMode === "online" && onlineRoomId && onlinePlayer) {
      if (onlinePlayer === lastWinnerMarker) {
        // I AM the winner → I control the rematch
        setResetButtonLabel(true);   // "Rematch"
        resetBtn.disabled = false;
      } else {
        // I AM the loser → I only say I'm ready
        resetBtn.disabled = false;
        resetBtn.innerHTML = `<span class="icon">✅</span> Ready`;
      }
    } else {
      // Local modes (2 players / vs computer)
      setResetButtonLabel(true);
      resetBtn.disabled = false;
    }
  }

  updateScoresDisplay();
}

/* Wipe only the local board (used by loser Ready) */
function clearLocalBoardOnly() {
  board = Array(9).fill(null);
  clearWinningStyles();
  cells.forEach(c => {
    c.textContent = "";
  });
}

async function resetBoard() {
  // ONLINE REMATCH: only winner (or any player on draw) can restart
  if (gameMode === "online" && onlineRoomId) {
    // Only treat this as rematch if the game actually ended
    if (!gameOver) {
      if (messageText) {
        messageText.textContent = "Finish this game first before starting a rematch.";
      }
      return;
    }

    // If there was a winner, only that player can trigger the reset
    if (lastWinnerMarker === "X" || lastWinnerMarker === "O") {
      if (onlinePlayer !== lastWinnerMarker) {
        if (messageText) {
          messageText.textContent =
            `Waiting for Player ${lastWinnerMarker} to start the rematch...`;
        }
        return;
      }
    }
    // If it's a draw, either player can reset

    try {
      const res = await fetch("/api/reset_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: onlineRoomId,
          // Winner starts next game; on draw, X starts
          start_player:
            lastWinnerMarker === "X" || lastWinnerMarker === "O"
              ? lastWinnerMarker
              : "X",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("reset_room error:", data);

        // Room destroyed or vanished
        if (res.status === 404 || (data && data.error === "Room not found")) {
          leaveOnlineMode("Opponent left the match. Back to local 2 players.");
        }
        return;
      }

      // If the room is closed, auto-exit
      if (data.status === "closed") {
        leaveOnlineMode("Opponent left the match. Back to local 2 players.");
        return;
      }

      // Backend cleared the board – sync local view
      board = Array(9).fill(null);
      gameOver = false;
      isRematchAvailable = false;
      setResetButtonLabel(false);

      clearWinningStyles();
      cells.forEach(c => (c.textContent = ""));

      current = data.current_turn || "X";
      setTurnDisplay();

      if (messageText) {
        messageText.textContent = `Online rematch. Player ${current} starts.`;
      }

      startOnlinePolling();
      await fetchRoomStateOnce();
      return;
    } catch (err) {
      console.error("Network error in reset_room:", err);
      alert("Network error while resetting online room");
      return;
    }
  }

  // ----- LOCAL MODES (PVP / PVC) -----

  isRematchAvailable = false;
  setResetButtonLabel(false);

  board = Array(9).fill(null);
  gameOver = false;

  clearWinningStyles();
  cells.forEach(c => (c.textContent = ""));

  // 2-player local
  if (gameMode === "pvp") {
    if (lastWinnerMarker === "X" || lastWinnerMarker === "O") {
      current = lastWinnerMarker;
      if (messageText) {
        messageText.textContent = `Rematch. Player ${current} starts.`;
      }
    } else {
      current = "X";
      if (messageText) {
        messageText.textContent = "Two players. Player X starts.";
      }
    }
    isHumanTurn = true;
    setTurnDisplay();
    return;
  }

  // Vs Computer (PVC)
  if (lastWinnerMarker === computerPlayer) {
    current = computerPlayer;
    isHumanTurn = false;
    setTurnDisplay();
    if (messageText) {
      messageText.textContent = `Vs computer (${difficulty}). Computer starts...`;
    }

    setTimeout(() => {
      if (!gameOver) {
        computerMove();
      }
    }, 450);
  } else {
    current = humanPlayer;
    isHumanTurn = true;
    setTurnDisplay();
    if (messageText) {
      messageText.textContent = `Vs computer (${difficulty}). You are ${humanPlayer}. Your turn!`;
    }
  }
}

function clearScores() {
  // In ONLINE mode, when the game is finished:
  // only the WINNER can use Clear scores (which also triggers resetBoard()).
  if (gameMode === "online" && gameOver) {
    if (lastWinnerMarker === "X" || lastWinnerMarker === "O") {
      if (onlinePlayer && onlinePlayer !== lastWinnerMarker) {
        if (messageText) {
          messageText.textContent =
            `Wait for Player ${lastWinnerMarker} to start the next match.`;
        }
        return; // do nothing
      }
    }
    // If it was a draw, both players are allowed to clear scores.
  }

  // Normal behavior (local modes, or allowed online winner)
  scoreX = 0;
  scoreO = 0;
  scoreDraw = 0;
  lastWinnerMarker = null;
  updateScoresDisplay();
  resetBoard();
}

/* ----------------------------------------------------------
   CLICK HANDLER
----------------------------------------------------------- */

async function handleClick(e) {
  const cell = e.target;
  const idx = Number(cell.getAttribute("data-idx"));

  // If we THINK the game is over but the board has no winner anymore,
  // it means the other player started a rematch. Unlock this client.
  if (gameOver && gameMode === "online") {
    const result = checkWinner();
    if (!result) {
      gameOver = false;
      isRematchAvailable = false;
      setResetButtonLabel(false);
      clearWinningStyles();
    } else {
      // still a finished game with a winner/draw
      return;
    }
  }

  if (gameOver || board[idx] !== null) return;

  /* ONLINE – backend mode */
  if (gameMode === "online") {
    if (!onlineRoomId || !onlinePlayer) {
      alert("You are not connected to an online room.");
      return;
    }

    if (current !== onlinePlayer) {
      if (messageText) {
        messageText.textContent = `Online. Wait for Player ${current} to move.`;
      }
      return;
    }

    try {
      const res = await fetch("/api/make_move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: onlineRoomId,
          player: onlinePlayer,
          index: idx,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        console.error("make_move error:", data);
        alert(data.error || "Failed to make move");
        return;
      }

      applyServerBoard(data.board || []);
      current = data.current_turn || "X";
      setTurnDisplay();

      playTapBeep();
      vibrate();

      const result = checkWinner();

      if (data.status === "finished" && result) {
        finishGame(result);
      } else if (!gameOver && messageText) {
        messageText.textContent = `Online. Player ${current}, your move.`;
      }
    } catch (err) {
      console.error("Network error in make_move:", err);
      alert("Network error while making move");
    }

    return;
  }

  /* PVP ---------------------------------------------------------------- */
  if (gameMode === "pvp") {
    board[idx] = current;
    cell.textContent = current;
    cell.classList.add(current.toLowerCase());

    playTapBeep();
    vibrate();

    const result = checkWinner();
    if (result) {
      finishGame(result);
      return;
    }

    current = current === "X" ? "O" : "X";
    setTurnDisplay();
    if (messageText) {
      messageText.textContent = `Player ${current}, your move.`;
    }
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
  if (result) {
    finishGame(result);
    return;
  }

  isHumanTurn = false;
  if (messageText) {
    messageText.textContent = "Computer is thinking...";
  }

  setTimeout(() => {
    computerMove();
  }, 350);
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
      if (messageText) {
        messageText.textContent = `Vs computer (${difficulty}). You are X.`;
      }
    }
  });
});

modePvpBtn.addEventListener("click", () => {
  gameMode = "pvp";
  stopOnlinePolling();
  onlineRoomId = null;
  onlinePlayer = null;

  showOnlineControls(false);
  setOnlineStatus("");

  lastWinnerMarker = null;
  isRematchAvailable = false;
  setResetButtonLabel(false);

  modePvpBtn.classList.add("mode-active");
  modePvcBtn.classList.remove("mode-active");
  if (modeOnlineBtn) modeOnlineBtn.classList.remove("mode-active");

  hideLevelRow();
  resetBoard();
  if (messageText) {
    messageText.textContent = "Two players. Player X starts.";
  }
});

modePvcBtn.addEventListener("click", () => {
  gameMode = "pvc";
  stopOnlinePolling();
  onlineRoomId = null;
  onlinePlayer = null;

  showOnlineControls(false);
  setOnlineStatus("");

  lastWinnerMarker = null;
  isRematchAvailable = false;
  setResetButtonLabel(false);

  modePvcBtn.classList.add("mode-active");
  modePvpBtn.classList.remove("mode-active");
  if (modeOnlineBtn) modeOnlineBtn.classList.remove("mode-active");

  showLevelRow();
  setDifficulty(difficulty);
  resetBoard();
});

/* ONLINE MODE BUTTON – Online <-> Stop */
if (modeOnlineBtn) {
  modeOnlineBtn.addEventListener("click", async () => {
    // If already in an active online room → treat click as STOP
    if (gameMode === "online" && onlineRoomId) {
      try {
        await fetch("/api/leave_room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: onlineRoomId,
            player: onlinePlayer || "X",
          }),
        });
      } catch (err) {
        console.error("leave_room error:", err);
      }

      leaveOnlineMode("Online game stopped. Back to local 2 players.");
      return;
    }

    // Normal: go into Online setup (no room yet)
    gameMode = "online";
    stopOnlinePolling();
    onlineRoomId = null;
    onlinePlayer = null;

    lastWinnerMarker = null;
    isRematchAvailable = false;
    setResetButtonLabel(false);

    modeOnlineBtn.classList.add("mode-active");
    modePvpBtn.classList.remove("mode-active");
    modePvcBtn.classList.remove("mode-active");
    modeOnlineBtn.textContent = "Online";   // still "Online" at setup stage

    hideLevelRow();
    showOnlineControls(true);
    setOnlineStatus("");

    resetBoard();
    if (messageText) {
      messageText.textContent = "Online mode. Tap Start match or Join with code.";
    }
  });
}

/* ONLINE HOST / JOIN BUTTONS */
if (onlineHostBtn) {
  onlineHostBtn.addEventListener("click", async () => {
    if (gameMode !== "online") gameMode = "online";

    try {
      const res = await fetch("/api/create_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Create room error:", data);
        alert(data.error || "Failed to create online room");
        return;
      }

      onlineRoomId = data.room_id;
      onlinePlayer = data.you_are; // "X"

      console.log("Online room created:", onlineRoomId, "You are:", onlinePlayer);

      lockModeButtonsForOnline(true);
      if (modeOnlineBtn) modeOnlineBtn.textContent = "Stop";
      setOnlineStatus(
        `Online room: <strong>${onlineRoomId}</strong> · You are ${onlinePlayer}. ` +
        `<button id="shareLinkBtn" class="btn btn-link small-btn">Share</button>`
      );

      if (messageText) {
        messageText.textContent =
          `Online room: ${onlineRoomId}. You are ${onlinePlayer}. ` +
          `Share the link with your friend to join.`;
      }

      const shareBtn = document.getElementById("shareLinkBtn");
      if (shareBtn) {
        shareBtn.addEventListener("click", () => {
          offerShareLink();
        });
      }

      showOnlineControls(false);

      startOnlinePolling();
      await fetchRoomStateOnce();

      // Auto-open share for convenience
      await offerShareLink();
    } catch (err) {
      console.error("Network error creating room:", err);
      alert("Network error while creating room");
    }
  });
}

if (onlineJoinBtn) {
  onlineJoinBtn.addEventListener("click", async () => {
    if (gameMode !== "online") gameMode = "online";

    const roomCode = window.prompt("Enter the room code you received:");
    if (!roomCode) return;

    const ok = await joinRoomByCode(roomCode);
    if (ok) {
      showOnlineControls(false);
    }
  });
}

/* ----------------------------------------------------------
   BUTTONS
----------------------------------------------------------- */

cells.forEach(c => c.addEventListener("click", handleClick));

resetBtn.addEventListener("click", async () => {
  // Special case: ONLINE + game finished + I am the LOSER
  if (
    gameMode === "online" &&
    onlineRoomId &&
    onlinePlayer &&
    lastWinnerMarker !== "draw" &&
    lastWinnerMarker &&
    onlinePlayer !== lastWinnerMarker &&
    gameOver
  ) {
    // I am the loser: this button is "Ready"
    clearLocalBoardOnly();
    resetBtn.disabled = true;  // I can't spam it

    try {
      await fetch("/api/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: onlineRoomId,
          player: onlinePlayer,
        }),
      });
    } catch (err) {
      console.error("Error sending ready state:", err);
    }

    if (messageText) {
      messageText.textContent = "Ready. Waiting for opponent to start a new match.";
    }
    return;
  }

  // Everyone else → normal reset logic (winner, local modes, etc.)
  resetBoard();
});

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
   AUTO-JOIN FROM ?room= PARAM
----------------------------------------------------------- */

(async function autoJoinFromUrl() {
  try {
    const params      = new URLSearchParams(window.location.search);
    const prefillRoom = params.get("room");
    if (!prefillRoom) return;

    // Switch UI to online mode
    gameMode = "online";
    lastWinnerMarker = null;
    isRematchAvailable = false;
    setResetButtonLabel(false);

    modeOnlineBtn?.classList.add("mode-active");
    modePvpBtn?.classList.remove("mode-active");
    modePvcBtn?.classList.remove("mode-active");

    hideLevelRow();
    showOnlineControls(false);  // friend doesn't need Start/Join row

    resetBoard();

    const ok = await joinRoomByCode(prefillRoom);
    if (ok) {
      // polling + status already handled in joinRoomByCode
    }
  } catch (e) {
    console.error("Auto-join error:", e);
  }
})();

/* ----------------------------------------------------------
   INIT
----------------------------------------------------------- */

setTurnDisplay();
updateScoresDisplay();
updateAvUI();
hideLevelRow();
showOnlineControls(false);
setOnlineStatus("");
setResetButtonLabel(false);