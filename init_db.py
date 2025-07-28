import sqlite3
import os
import csv

# データベースファイル名
DB_NAME = "database.db"


# CSVファイルから曲データを読み込む
def read_songs_from_csv(file_path):
    """CSVファイルから曲データを読み込む"""
    with open(file_path, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        return [
            (
                row["title"],
                row["composer"],
                row["audio_file"],
                row["difficulty"],
                row["hint"],
            )
            for row in reader
        ]


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
    # songs is now imported from songs_data.py
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
    # CSV からデータを読み込む
    SONGS_CSV_PATH = "songs_data.csv"
    songs = read_songs_from_csv(SONGS_CSV_PATH)

    create_database()  # データベースとテーブルを作成
    insert_data()  # サンプルデータを挿入
