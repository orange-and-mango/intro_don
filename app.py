from flask import Flask, render_template, jsonify, request, session
import sqlite3
import random
import secrets

app = Flask(__name__)

# セッション用のシークレットキーを設定
app.secret_key = secrets.token_hex(16)


@app.route("/")
def top():
    return render_template("top.html")


@app.route("/quiz")
def quiz():
    return render_template("quiz.html")


@app.route("/result")
def result():
    player1_score = session.get("player1Score", 0)
    player2_score = session.get("player2Score", 0)

    if player1_score > player2_score:
        winner = "プレイヤー1の勝ち！"
    elif player1_score < player2_score:
        winner = "プレイヤー2の勝ち！"
    else:
        winner = "引き分け！"
    return render_template(
        "result.html",
        player1_score=player1_score,
        player2_score=player2_score,
        winner=winner,
    )


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


@app.route("/api/submit_scores", methods=["POST"])
def submit_scores():
    try:
        print("スコア送信リクエストを受信")
        data = request.get_json()
        print(f"受信したデータ: {data}")

        if not data:
            print("リクエストボディが空です")
            return jsonify({"error": "リクエストボディが空です"}), 400

        session["player1Score"] = data.get("player1Score", 0)
        session["player2Score"] = data.get("player2Score", 0)

        print("スコアをセッションに保存しました")
        return jsonify({"message": "スコアを保存しました"}), 200
    except Exception as e:
        print(f"エラー: {e}")
        return jsonify({"error": "サーバーエラーが発生しました"}), 500


@app.context_processor
def inject_footer_text():
    return {"footer_text": "©2025 琉球大学工学部工学科知能情報コース"}


if __name__ == "__main__":
    app.run(debug=True)
