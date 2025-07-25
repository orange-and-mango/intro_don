from flask import Flask, render_template, jsonify
import sqlite3
import random

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


# データベースファイルのパス
DB_NAME = "database.db"


@app.route("/api/quiz")
def api_quiz():
    """クイズの問題（正解1曲、選択肢3曲）をJSONで返すAPI"""
    try:
        # データベースに接続
        conn = sqlite3.connect(DB_NAME)
        # 辞書型で結果を受け取れるようにする
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # --- 正解の曲を1曲、ランダムに取得 ---
        # OFFSETを使ってランダムな1行を取得するテクニック
        cursor.execute("SELECT * FROM music ORDER BY RANDOM() LIMIT 1")
        correct_song = dict(cursor.fetchone())

        # --- 不正解の選択肢を3曲取得 ---
        # 正解の曲とはIDが異なるものをランダムに3曲取得
        cursor.execute(
            (
                "SELECT * FROM music "
                "WHERE music_id != ? "
                "ORDER BY RANDOM() LIMIT 3"
            ),
            (correct_song["music_id"],),
        )
        wrong_songs = [dict(row) for row in cursor.fetchall()]

        # 選択肢リストを作成
        choices = wrong_songs + [correct_song]
        random.shuffle(choices)  # 選択肢をシャッフル

        # フロントエンドに返すデータを作成
        quiz_data = {"correct_answer": correct_song, "choices": choices}

        return jsonify(quiz_data)

    except sqlite3.Error as e:
        # エラーが発生した場合は、エラーメッセージを返す
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        # 接続を閉じる
        if conn:
            conn.close()


@app.context_processor
def inject_footer_text():
    return {"footer_text": "©2025 琉球大学工学部工学科知能情報コース"}


if __name__ == "__main__":
    app.run(debug=True)
