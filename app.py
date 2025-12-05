from flask import Flask, render_template, jsonify, request
import os
import random
import string
import time

app = Flask(__name__)

# -----------------------------------------
# In-memory room storage (simple for now)
# -----------------------------------------
rooms = {}  # room_id -> room_state

ROOM_EXPIRE_SECONDS = 6 * 60 * 60  # 6 hours


def generate_room_id(length=6):
    """Generate a simple 6-char room code like 'A7F9K2'."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def cleanup_rooms():
    """Remove old rooms to avoid memory growing forever."""
    now = time.time()
    old_keys = [
        rid for rid, r in rooms.items()
        if now - r.get("created_at", now) > ROOM_EXPIRE_SECONDS
    ]
    for rid in old_keys:
        rooms.pop(rid, None)


WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
]


def check_winner(board):
    """Return 'X', 'O', 'draw', or None."""
    for a, b, c in WIN_LINES:
        if board[a] and board[a] == board[b] and board[a] == board[c]:
            return board[a]
    if all(v is not None for v in board):
        return "draw"
    return None


# -----------------------------------------
# EXISTING ROUTES (unchanged behavior)
# -----------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# Serve the service worker at the root so registration("/service-worker.js") works
@app.route("/service-worker.js")
def service_worker():
    # This looks in the /static folder
    return app.send_static_file("service-worker.js")


# -----------------------------------------
# NEW: Online multiplayer API
# -----------------------------------------

@app.route("/api/create_room", methods=["POST"])
def create_room():
    """
    Create a new room.
    Client gets:
      { room_id: "ABC123", you_are: "X", status: "waiting" }
    """
    cleanup_rooms()

    # Make sure we don't accidentally reuse an existing ID
    room_id = generate_room_id()
    while room_id in rooms:
        room_id = generate_room_id()

    rooms[room_id] = {
        "room_id": room_id,
        "board": [None] * 9,
        "current_turn": "X",
        "players": {
            "X": "host",   # creator
            "O": None,     # will be 'guest' when someone joins
        },
        "status": "waiting",   # 'waiting' -> 'in_progress' -> 'finished'
        "winner": None,
        "last_move_by": None,
        "created_at": time.time(),
    }

    return jsonify(
        room_id=room_id,
        you_are="X",
        status="waiting",
    ), 201


@app.route("/api/join_room", methods=["POST"])
def join_room():
    """
    Join an existing room as 'O'.
    Body: { "room_id": "ABC123" }
    Response:
      - success: { room_id, you_are: "O", status }
      - errors:  400/404 with { error: "..." }
    """
    cleanup_rooms()

    data = request.get_json(silent=True) or {}
    room_id = data.get("room_id")

    if not room_id:
        return jsonify(error="room_id is required"), 400

    room = rooms.get(room_id)
    if not room:
        return jsonify(error="Room not found"), 404

    if room["status"] == "finished":
        return jsonify(error="Game already finished"), 400

    if room["players"]["O"] is not None:
        return jsonify(error="Room already has two players"), 400

    # Mark that an opponent joined
    room["players"]["O"] = "guest"
    room["status"] = "in_progress"

    return jsonify(
        room_id=room_id,
        you_are="O",
        status=room["status"],
    )


@app.route("/api/room_state/<room_id>", methods=["GET"])
def room_state(room_id):
    """
    Get the current state of a room.
    Response:
      { room_id, board, current_turn, status, winner, last_move_by }
    """
    cleanup_rooms()

    room = rooms.get(room_id)
    if not room:
        return jsonify(error="Room not found"), 404

    # We don't send the 'players' map yet, can add later if needed
    return jsonify(
        room_id=room["room_id"],
        board=room["board"],
        current_turn=room["current_turn"],
        status=room["status"],
        winner=room["winner"],
        last_move_by=room["last_move_by"],
    )


@app.route("/api/make_move", methods=["POST"])
def make_move():
    """
    Make a move in a room.
    Body:
      { "room_id": "ABC123", "player": "X" or "O", "index": 0-8 }

    Response:
      - success: { ok: true, board, current_turn, status, winner }
      - error:   { ok: false, error: "..." }
    """
    cleanup_rooms()

    data = request.get_json(silent=True) or {}
    room_id = data.get("room_id")
    player = data.get("player")
    index = data.get("index")

    # Basic validation
    if not room_id or player not in ("X", "O") or not isinstance(index, int):
        return jsonify(ok=False, error="Invalid payload"), 400

    if index < 0 or index > 8:
        return jsonify(ok=False, error="index must be between 0 and 8"), 400

    room = rooms.get(room_id)
    if not room:
        return jsonify(ok=False, error="Room not found"), 404

    # Ensure both players are present
    if room["players"]["X"] is None or room["players"]["O"] is None:
        return jsonify(ok=False, error="Waiting for opponent"), 400

    if room["status"] == "finished":
        return jsonify(ok=False, error="Game already finished"), 400

    board = room["board"]

    if board[index] is not None:
        return jsonify(ok=False, error="Cell already taken"), 400

    if room["current_turn"] != player:
        return jsonify(ok=False, error="Not your turn"), 400

    # Apply move
    board[index] = player
    room["last_move_by"] = player

    winner = check_winner(board)

    if winner is None:
        room["current_turn"] = "O" if player == "X" else "X"
        room["status"] = "in_progress"
    else:
        room["winner"] = winner
        room["status"] = "finished"

    return jsonify(
        ok=True,
        board=room["board"],
        current_turn=room["current_turn"],
        status=room["status"],
        winner=room["winner"],
        last_move_by=room["last_move_by"],
    )

@app.route("/api/reset_room", methods=["POST"])
def reset_room():
    data = request.get_json(force=True)
    room_id = (data.get("room_id") or "").upper()
    start_player = data.get("start_player") or "X"

    room = rooms.get(room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    # Clear the board and set starting player
    room["board"] = [None] * 9
    room["current_turn"] = start_player
    room["status"] = "in_progress"  # don't stay in 'waiting'
    room["winner"] = None
    room["last_move_by"] = None

    return jsonify({
        "ok": True,
        "room_id": room_id,
        "current_turn": room["current_turn"],
        "board": room["board"],
        "status": room["status"],
    })

# -----------------------------------------
# MAIN ENTRY
# -----------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5100))
    app.run(host="0.0.0.0", port=port, debug=False)