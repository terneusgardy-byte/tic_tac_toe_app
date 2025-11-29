from flask import Flask, render_template

import os

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


# Serve the service worker at the root so registration("/service-worker.js") works
@app.route("/service-worker.js")
def service_worker():
    # This looks in the /static folder
    return app.send_static_file("service-worker.js")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5100))
    app.run(host="0.0.0.0", port=port, debug=False)