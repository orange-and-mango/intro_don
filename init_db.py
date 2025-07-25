import sqlite3
import os

# データベースファイル名
DB_NAME = "database.db"


# --- データベースとテーブルを作成 ---
def create_database():
    """データベースとmusicテーブルを初期化（作成）する"""

    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print(f"既存のデータベース '{DB_NAME}' を削除しました。")

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        print(f"データベース '{DB_NAME}' を作成しました。")

        # 【修正箇所】hintカラムをここに追加します
        create_table_query = """
        CREATE TABLE music (
            music_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255) NOT NULL,
            composer VARCHAR(255) NOT NULL,
            audio_file TEXT NOT NULL UNIQUE,
            difficulty TEXT NOT NULL,
            hint TEXT
        );
        """
        cursor.execute(create_table_query)
        print("テーブル 'music' を作成しました。（hintカラム有り）")
        conn.commit()

    except sqlite3.Error as e:
        print(f"データベース作成エラー: {e}")
    finally:
        if conn:
            conn.close()


def insert_data():
    """musicテーブルにデータを挿入する"""

    # 登録したい楽曲データのリスト
    # (title, composer, audio_file, difficulty, hint) の順
    songs = [
        ("2:23 AM", "しゃろう", "audio/0001.mp3", "normal", "時間"),
        ("10℃", "しゃろう", "audio/0002.mp3", "normal", "３文字"),
        ("You and Me", "しゃろう", "audio/0003.mp3", "normal", "英語"),
        ("Cassette Tape Dream", "しゃろう", "audio/0004.mp3", "normal", "英語"),
        ("極東の羊、テレキャスターと踊る", "しゃろう", "audio/0005.mp3", "normal", "長いタイトル"),
        ("サンタは中央線でやってくる", "しゃろう", "audio/0006.mp3", "normal", "乗り物"),
        ("野良猫は宇宙を目指した", "しゃろう", "audio/0007.mp3", "normal", "動物"),
    ]
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # SQL文でデータを挿入
        cursor.executemany(
            """
        INSERT INTO music (title, composer, audio_file, difficulty, hint)
        VALUES (?, ?, ?, ?, ?)
        """,
            songs,
        )

        print(f"{len(songs)} 件のデータを 'music' テーブルに挿入しました。")
        conn.commit()

    except sqlite3.Error as e:
        print(f"データ挿入エラー: {e}")
    finally:
        if conn:
            conn.close()


# --- このスクリプトが直接実行された場合に、関数を呼び出す ---
if __name__ == "__main__":
    create_database()  # データベースとテーブルを作成
    insert_data()  # サンプルデータを挿入
