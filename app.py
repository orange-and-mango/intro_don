from flask import Flask, render_template, jsonify, request, session
import sqlite3
import random
import secrets

app = Flask(__name__)

# セッション管理のために必須。推測されにくいランダムな文字列を設定する。
app.secret_key = secrets.token_hex(16)

# --- ページレンダリング ---

@app.route("/")
def top():
    """トップページを表示する。"""
    return render_template("top.html")


@app.route("/quiz")
def quiz():
    """クイズページを表示する。"""
    return render_template("quiz.html")


@app.route("/result")
def result():
    """
    セッションからスコアを取得し、勝敗を判定して結果ページを表示する。
    """
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


@app.route("/playlist", methods=["GET", "POST"])
def playlist():
    """
    プレイリストページを表示する。
    POSTリクエストの場合は、送られてきた曲IDリストに基づいてDBから曲情報を取得する。
    """
    songs = []
    # フロントエンドのJavaScriptからPOSTリクエストで曲IDリストが送られてきた場合の処理
    if request.method == "POST":
        song_ids_str = request.form.get("song_ids")
        if song_ids_str:
            # 安全のため、文字列を数値IDのリストに変換する
            song_ids = [int(id) for id in song_ids_str.split(',') if id.isdigit()]
            
            if song_ids:
                conn = None
                try:
                    conn = sqlite3.connect(DB_NAME)
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()

                    # SQLインジェクション対策として、IDの数だけプレースホルダ(?)を生成する
                    placeholders = ",".join(["?"] * len(song_ids))
                    query = f"SELECT music_id, title, composer, audio_file FROM music WHERE music_id IN ({placeholders})"
                    
                    cursor.execute(query, song_ids)
                    db_songs = [dict(row) for row in cursor.fetchall()]

                    # DBからの結果は順不同なため、フロントエンドのリスト順に並べ替える
                    songs_dict = {song['music_id']: song for song in db_songs}
                    songs = [songs_dict[id] for id in song_ids if id in songs_dict]

                except Exception as e:
                    print(f"Error fetching playlist songs: {e}")
                finally:
                    if conn:
                        conn.close()

    return render_template("playlist.html", songs=songs)


@app.route("/settings")
def settings():
    """設定ページを表示する。"""
    return render_template("settings.html")

# --- APIエンドポイント ---

DB_NAME = "database.db"


@app.route("/api/quiz", methods=["POST"])
def api_quiz():
    """
    クイズの問題（正解1曲、選択肢3曲）をJSON形式で提供するAPI。
    POSTリクエストで出題済みの曲IDリストを受け取り、それらを除外して問題を作成する。
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # フロントエンドから送られた出題済みの曲IDリストを取得
        exclude_ids = []
        data = request.get_json()
        if data and "exclude" in data:
            # 安全のため、リスト内の各要素が整数であることを確認
            exclude_ids = [int(id) for id in data["exclude"] if isinstance(id, int)]

        # 除外リストを考慮して、正解となる曲をランダムに1曲取得する
        base_query = "SELECT * FROM music"
        params = []
        sql_where = ""
        if exclude_ids:
            placeholders = ",".join(["?"] * len(exclude_ids))
            sql_where = f"WHERE music_id NOT IN ({placeholders})"
            params.extend(exclude_ids)

        sql_query = f"{base_query} {sql_where} ORDER BY RANDOM() LIMIT 1"
        cursor.execute(sql_query, params)
        correct_song_row = cursor.fetchone()

        # 全ての曲を出題しきった場合など、曲が取得できなければエラーを返す
        if correct_song_row is None:
            return jsonify({"error": "No available songs left."}), 404

        correct_song = dict(correct_song_row)

        # 正解とは異なる、不正解の選択肢をランダムに3曲取得
        cursor.execute(
            "SELECT * FROM music WHERE music_id != ? ORDER BY RANDOM() LIMIT 3",
            (correct_song["music_id"],),
        )
        wrong_songs = [dict(row) for row in cursor.fetchall()]

        # 正解と不正解を結合し、シャッフルして選択肢リストを作成
        choices = wrong_songs + [correct_song]
        random.shuffle(choices)

        quiz_data = {"correct_answer": correct_song, "choices": choices}
        return jsonify(quiz_data)

    except sqlite3.Error as e:
        return jsonify({"error": f"Database error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/api/submit_scores", methods=["POST"])
def submit_scores():
    """
    フロントエンドから送信されたスコアをサーバーのセッションに保存するAPI。
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is empty"}), 400

        # 受け取ったスコアをセッションに保存
        session["player1Score"] = data.get("player1Score", 0)
        session["player2Score"] = data.get("player2Score", 0)

        return jsonify({"message": "Scores saved"}), 200
    except Exception as e:
        print(f"Error submitting scores: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.context_processor
def inject_footer_text():
    """
    全てのテンプレートに共通の変数を渡すためのコンテキストプロセッサ。
    """
    return {"footer_text": "©2025 琉球大学知能情報コース（知能情報基礎演習IIグループ20）"}


if __name__ == "__main__":
    app.run(debug=True)
