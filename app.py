from flask import Flask, render_template_string

app = Flask(__name__)

TTT_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tic Tac Toe 🎲</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <style>
    :root {
      --bg: #0f172a;
      --card: #020617;
      --accent-x: #22c55e;
      --accent-o: #3b82f6;
      --line: #1f2937;
      --text-main: #e5e7eb;
      --text-sub: #9ca3af;
      --danger: #f97373;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, sans-serif;
      background: radial-gradient(circle at top, #1e293b 0, #020617 60%);
      color: var(--text-main);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }

    .wrap {
      width: 100%;
      max-width: 480px;
      background: linear-gradient(145deg, #020617, #020617ee);
      border-radius: 24px;
      padding: 24px 20px 20px;
      box-shadow:
        0 20px 50px rgba(0,0,0,0.7),
        0 0 0 1px rgba(148,163,184,0.15);
    }

    .title {
      text-align: center;
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .subtitle {
      text-align: center;
      font-size: 0.9rem;
      color: var(--text-sub);
      margin-bottom: 20px;
    }

    .status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 16px;
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(148,163,184,0.2);
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .turn {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .turn span {
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
    }

    .turn-x span {
      background: rgba(34,197,94,0.15);
      border: 1px solid rgba(34,197,94,0.5);
      color: var(--accent-x);
    }

    .turn-o span {
      background: rgba(59,130,246,0.15);
      border: 1px solid rgba(59,130,246,0.5);
      color: var(--accent-o);
    }

    .message {
      font-size: 0.85rem;
      color: var(--text-sub);
    }

    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 16px;
    }

    .cell {
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: radial-gradient(circle at top, #111827, #020617);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.6rem;
      font-weight: 800;
      cursor: pointer;
      transition: transform 0.08s ease, box-shadow 0.08s ease,
                  border-color 0.15s ease, background 0.2s ease;
      user-select: none;
    }

    .cell:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(15,23,42,0.9);
      border-color: rgba(148,163,184,0.6);
    }

    .cell.x {
      color: var(--accent-x);
      text-shadow: 0 0 18px rgba(34,197,94,0.55);
    }

    .cell.o {
      color: var(--accent-o);
      text-shadow: 0 0 18px rgba(59,130,246,0.55);
    }

    .cell.winning {
      background: radial-gradient(circle, #facc15 0, #f97316 40%, #020617 100%);
      border-color: #fbbf24;
    }

    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      border-radius: 999px;
      padding: 8px 16px;
      border: none;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: transform 0.08s ease, box-shadow 0.08s ease,
                  background 0.15s ease, filter 0.15s ease;
      white-space: nowrap;
    }

    .btn span.icon {
      font-size: 1.1rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      box-shadow: 0 10px 25px rgba(34,197,94,0.55);
    }

    .btn-primary:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-sub);
      border: 1px dashed rgba(148,163,184,0.6);
    }

    .btn-ghost:hover {
      background: rgba(15,23,42,0.8);
      border-style: solid;
    }

    .scoreboard {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed rgba(148,163,184,0.4);
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: var(--text-sub);
      gap: 10px;
    }

    .score-x {
      color: var(--accent-x);
      font-weight: 600;
    }

    .score-o {
      color: var(--accent-o);
      font-weight: 600;
    }

    .score-draw {
      color: var(--danger);
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .wrap {
        border-radius: 18px;
        padding: 18px 14px 14px;
      }
      .title {
        font-size: 1.3rem;
      }
      .cell {
        border-radius: 16px;
        font-size: 2.2rem;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="title">Tic Tac Toe 🎮</div>
    <div class="subtitle">Two players · Local game · First to 3 wins? ⭐</div>

    <div class="status">
      <div class="turn" id="turnText">
        Turn: <span id="turnBadge">X</span>
      </div>
      <div class="message" id="messageText">Player X starts. Tap a square.</div>
    </div>

    <div class="board" id="board">
      <!-- 9 cells -->
      <div class="cell" data-idx="0"></div>
      <div class="cell" data-idx="1"></div>
      <div class="cell" data-idx="2"></div>
      <div class="cell" data-idx="3"></div>
      <div class="cell" data-idx="4"></div>
      <div class="cell" data-idx="5"></div>
      <div class="cell" data-idx="6"></div>
      <div class="cell" data-idx="7"></div>
      <div class="cell" data-idx="8"></div>
    </div>

    <div class="controls">
      <button class="btn btn-primary" id="resetBtn">
        <span class="icon">🔁</span>
        Reset board
      </button>
      <button class="btn btn-ghost" id="clearScoreBtn">
        <span class="icon">🧹</span>
        Clear scores
      </button>
    </div>

    <div class="scoreboard">
      <div class="score-x" id="scoreX">X wins: 0</div>
      <div class="score-o" id="scoreO">O wins: 0</div>
      <div class="score-draw" id="scoreDraw">Draws: 0</div>
    </div>
  </div>

  <script>
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

    let board = Array(9).fill(null);
    let current = "X";
    let gameOver = false;

    let scoreX = 0;
    let scoreO = 0;
    let scoreDraw = 0;

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

    function setTurnDisplay() {
      turnBadge.textContent = current;
      turnText.classList.toggle("turn-x", current === "X");
      turnText.classList.toggle("turn-o", current === "O");
    }

    function clearWinningStyles() {
      cells.forEach(c => c.classList.remove("winning"));
    }

    function updateScoresDisplay() {
      scoreXEl.textContent = "X wins: " + scoreX;
      scoreOEl.textContent = "O wins: " + scoreO;
      scoreDrawEl.textContent = "Draws: " + scoreDraw;
    }

    function handleClick(e) {
      const cell = e.target;
      const idx = Number(cell.getAttribute("data-idx"));

      if (gameOver || board[idx] !== null) {
        return;
      }

      board[idx] = current;
      cell.textContent = current;
      cell.classList.add(current.toLowerCase());

      const result = checkWinner();
      if (result) {
        gameOver = true;
        const { winner, line } = result;

        if (winner === "draw") {
          messageText.textContent = "It's a draw. Nobody wins.";
          scoreDraw++;
        } else {
          messageText.textContent = "Player " + winner + " wins! 🎉";
          line.forEach(i => cells[i].classList.add("winning"));
          if (winner === "X") scoreX++;
          if (winner === "O") scoreO++;
        }
        updateScoresDisplay();
        return;
      }

      current = current === "X" ? "O" : "X";
      setTurnDisplay();
      messageText.textContent = "Player " + current + ", your move.";
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

    function resetBoard() {
      board = Array(9).fill(null);
      gameOver = false;
      current = "X";
      setTurnDisplay();
      messageText.textContent = "New round! Player X starts.";
      cells.forEach(c => {
        c.textContent = "";
        c.classList.remove("x", "o", "winning");
      });
    }

    function clearScores() {
      scoreX = 0;
      scoreO = 0;
      scoreDraw = 0;
      updateScoresDisplay();
      resetBoard();
      messageText.textContent = "Scores cleared. Player X starts.";
    }

    cells.forEach(cell =>
      cell.addEventListener("click", handleClick)
    );
    resetBtn.addEventListener("click", resetBoard);
    clearScoreBtn.addEventListener("click", clearScores);

    // initial UI state
    setTurnDisplay();
    updateScoresDisplay();
  </script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(TTT_HTML)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5100))
    app.run(host="0.0.0.0", port=port, debug=False)