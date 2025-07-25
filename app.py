from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def top():
    return render_template("top.html")


@app.route("/quiz")
def quiz():
    return render_template("quiz.html")


@app.route("/result")
def result():
    return render_template("result.html")


@app.route("/playlist")
def playlist():
    return render_template("playlist.html")


@app.route("/settings")
def settings():
    return render_template("settings.html")


@app.context_processor
def inject_footer_text():
    return {"footer_text": "©2025 琉球大学工学部工学科知能情報コース"}


if __name__ == "__main__":
    app.run(debug=True)
