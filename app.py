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


@app.route("/playlist", methods=["GET", "POST"])
def playlist():
    """
    ローカルストレージのIDを元にプレイリストページをサーバーサイドでレンダリングする。
    1. GET: まず空のページを返す。JSがローカルストレージのIDをPOSTする。
    2. POST: IDリストを受け取り、DBから曲情報を取得してページを再描画する。
    """
    songs = []
    # JSからのPOSTリクエストを処理
    if request.method == "POST":
        song_ids_str = request.form.get("song_ids")
        if song_ids_str:
            # 文字列をIDのリストに変換
            song_ids = [int(id) for id in song_ids_str.split(',') if id.isdigit()]
            
            if song_ids:
                conn = None
                try:
                    conn = sqlite3.connect(DB_NAME)
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()

                    # プレースホルダ(?,?)を動的に生成してSQLインジェクションを防ぐ
                    placeholders = ",".join(["?"] * len(song_ids))
                    # ★ audio_fileも取得するようにクエリを修正
                    query = f"SELECT music_id, title, composer, audio_file FROM music WHERE music_id IN ({placeholders})"
                    
                    cursor.execute(query, song_ids)
                    db_songs = [dict(row) for row in cursor.fetchall()]

                    # ローカルストレージの順序を維持するように並べ替え
                    songs_dict = {song['music_id']: song for song in db_songs}
                    songs = [songs_dict[id] for id in song_ids if id in songs_dict]

                except Exception as e:
                    print(f"Error fetching playlist songs: {e}")
                finally:
                    if conn:
                        conn.close()

    # GETリクエストの場合、またはPOSTでもIDが空の場合は、songsが空のままテンプレートがレンダリングされる
    return render_template("playlist.html", songs=songs)


@app.route("/settings")
def settings():
    return render_template("settings.html")


# データベースファイルのパス
DB_NAME = "database.db"


# ★ フロントエンドからのPOSTリクエストに対応
@app.route("/api/quiz", methods=["GET", "POST"])
def api_quiz():
    """クイズの問題（正解1曲、選択肢3曲）をJSONで返すAPI"""
    conn = None  # 接続変数を初期化
    try:
        # データベースに接続
        conn = sqlite3.connect(DB_NAME)
        # 辞書型で結果を受け取れるようにする
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # --- ★ フロントエンドから送られた除外リストを取得 ---
        exclude_ids = []
        if request.method == "POST":
            data = request.get_json()
            if data and "exclude" in data:
                # 安全のため、リスト内の各要素が整数であることを確認
                exclude_ids = [int(id) for id in data["exclude"] if isinstance(id, int)]

        # --- ★ 除外リストを考慮して正解の曲を1曲、ランダムに取得 ---
        base_query = "SELECT * FROM music"
        params = []

        # 除外リストがある場合、WHERE句を追加
        if exclude_ids:
            # プレースホルダ (?,?,?) を動的に生成
            placeholders = ",".join(["?"] * len(exclude_ids))
            sql_where = f"WHERE music_id NOT IN ({placeholders})"
            params.extend(exclude_ids)
        else:
            sql_where = ""

        # 完全なSQLクエリを組み立て
        sql_query = f"{base_query} {sql_where} ORDER BY RANDOM() LIMIT 1"

        cursor.execute(sql_query, params)
        correct_song_row = cursor.fetchone()

        # もし除外した結果、曲が取得できなくなったらエラーを返す
        if correct_song_row is None:
            return jsonify({"error": "No available songs left."}), 404

        correct_song = dict(correct_song_row)

        # --- 不正解の選択肢を3曲取得 ---
        # 正解の曲とはIDが異なるものをランダムに3曲取得
        cursor.execute(
            ("SELECT * FROM music " "WHERE music_id != ? " "ORDER BY RANDOM() LIMIT 3"),
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
    except Exception as e:
        # その他の予期せぬエラー
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500
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
