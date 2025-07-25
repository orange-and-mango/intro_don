import sqlite3
import os

# データベースファイル名
DB_NAME = "database.db"


# --- データベースとテーブルを作成 ---
def create_database():
    """データベースとmusicテーブルを初期化（作成）する"""

    # 既にデータベースファイルが存在する場合は、一度削除する
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print(f"既存のデータベース '{DB_NAME}' を削除しました。")

    try:
        # データベースに接続（ファイルがなければ新規作成される）
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        print(f"データベース '{DB_NAME}' を作成しました。")

        # musicテーブルを作成するSQL文
        # 設計書通りにカラム名、データ型、制約を設定します
        # AUTOINCREMENTの代わりに、INTEGER PRIMARY KEY を使うのが一般的です
        create_table_query = """
        CREATE TABLE music (
            music_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255) NOT NULL,
            composer VARCHAR(255) NOT NULL,
            audio_file TEXT NOT NULL UNIQUE,
            difficulty TEXT NOT NULL
        );
        """

        # SQLを実行してテーブルを作成
        cursor.execute(create_table_query)
        print("テーブル 'music' を作成しました。")

        # 変更をコミット（保存）
        conn.commit()

    except sqlite3.Error as e:
        print(f"データベースエラー: {e}")
    finally:
        # 接続を閉じる
        if conn:
            conn.close()
            print("データベース接続を閉じました。")


def insert_sample_data():
    """musicテーブルにデータを挿入する"""

    # 登録したい楽曲データのリスト
    # (title, composer, audio_file, difficulty) の順
    sample_songs = [
        ("2:23 AM", "しゃろう", "audio/0001.mp3", "normal"),
        ("10℃", "しゃろう", "audio/0002.mp3", "normal"),
        ("You and Me", "しゃろう", "audio/0003.mp3", "normal"),
        ("Cassette Tape Dream", "しゃろう", "audio/0004.mp3", "normal"),
        ("極東の羊、テレキャスターと踊る", "しゃろう", "audio/0005.mp3", "normal"),
        ("サンタは中央線でやってくる", "しゃろう", "audio/0006.mp3", "normal"),
        ("野良猫は宇宙を目指した", "しゃろう", "audio/0007.mp3", "normal"),
    ]

    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # SQL文でデータを挿入
        cursor.executemany(
            """
        INSERT INTO music (title, composer, audio_file, difficulty)
        VALUES (?, ?, ?, ?)
        """,
            sample_songs,
        )

        print(
            f"{len(sample_songs)} 件のサンプルデータを 'music' テーブルに挿入しました。"
        )
        conn.commit()

    except sqlite3.Error as e:
        print(f"データ挿入エラー: {e}")
    finally:
        if conn:
            conn.close()


# --- このスクリプトが直接実行された場合に、関数を呼び出す ---
if __name__ == "__main__":
    create_database()  # データベースとテーブルを作成
    insert_sample_data()  # サンプルデータを挿入
