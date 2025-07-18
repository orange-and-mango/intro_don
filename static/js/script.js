// DOMContentLoaded: HTMLが完全に読み込まれてからスクリプトを実行する
document.addEventListener('DOMContentLoaded', () => {
    console.log('JavaScript is loaded and running!');

    // 各要素の取得（例）
    const playButton = document.getElementById('play-intro-button');
    const answerButtons = document.querySelectorAll('.answer-button');
    const volumeControl = document.getElementById('volume-control');
    const addToPlaylistButton = document.getElementById('add-to-playlist-button');
    const scoreDisplay = document.getElementById('score-display');
    const audioPlayer = document.getElementById('audio-player'); // HTMLのaudioタグを想定

    let currentScore = 0; // 現在のスコアを保持

    // --- 1. 音楽再生と停止機能 ---
    if (playButton && audioPlayer) {
        playButton.addEventListener('click', () => {
            // 例: 5秒だけ再生して停止
            audioPlayer.play();
            console.log('音楽を再生中...');

            setTimeout(() => {
                audioPlayer.pause();
                audioPlayer.currentTime = 0; // 再生位置を最初に戻す
                console.log('音楽を停止しました。');
                // 音楽停止後、選択肢を表示するなどの次の処理へ移行
                displayChoices(); // 仮の関数
            }, 5000); // 5000ミリ秒 = 5秒
        });
    }

    // --- 2. 選択肢の表示と回答処理 ---
    function displayChoices() {
        console.log('選択肢を表示します。');
        // ここで、サーバーから取得した選択肢データを元にHTML要素を生成・表示する
        // 例: 仮の選択肢データを設定
        const choicesData = ['曲A', '曲B (正解)', '曲C', '曲D'];
        const correctAnswer = '曲B (正解)'; // 正解のタイトル

        answerButtons.forEach((button, index) => {
            if (choicesData[index]) {
                button.textContent = choicesData[index];
                button.style.display = 'block'; // ボタンを表示
                button.onclick = () => handleAnswer(button.textContent, correctAnswer); // クリックイベントを設定
            } else {
                button.style.display = 'none'; // 選択肢が足りない場合は非表示
            }
        });
    }

    function handleAnswer(selectedAnswer, correctAnswer) {
        if (selectedAnswer === correctAnswer) {
            console.log('正解！');
            alert('正解！');
            currentScore += 10; // スコア加算
        } else {
            console.log('不正解...');
            alert(`不正解！正解は「${correctAnswer}」でした。`);
        }
        updateScoreDisplay(); // スコア表示を更新
        // 次の問題へ進む、または結果画面へ遷移する処理
        console.log('次の問題へ...');
        // ここで次の問題のデータをサーバーから取得するなどの処理を呼び出す
    }

    // --- 3. スコア表示（簡単な例） ---
    function updateScoreDisplay() {
        if (scoreDisplay) {
            scoreDisplay.textContent = `現在のスコア: ${currentScore}`;
        }
    }

    // --- 4. 音量調整機能 ---
    if (volumeControl && audioPlayer) {
        volumeControl.addEventListener('input', (event) => {
            const volume = event.target.value / 100; // 0-100を0-1に変換
            audioPlayer.volume = volume;
            console.log(`音量を調整しました: ${volume}`);
            // 必要であれば、SEの音量も調整するロジックを追加
        });
    }

    // --- 5. お気に入り追加機能 ---
    if (addToPlaylistButton) {
        addToPlaylistButton.addEventListener('click', () => {
            // 現在再生中の曲の情報を取得（これはサーバーサイドから取得したデータに依存）
            const currentSongTitle = '現在のイントロ曲名'; // 仮の曲名
            console.log(`${currentSongTitle} をプレイリストに追加しました！`);
            alert(`${currentSongTitle} をプレイリストに追加しました！`);

            // サーバーサイドAPIを呼び出して、データベースにお気に入りとして登録する
            // 例: fetch('/api/add_to_playlist', { method: 'POST', body: JSON.stringify({ song: currentSongTitle }) })
            //     .then(response => response.json())
            //     .then(data => console.log(data));
        });
    }

    // 初期スコア表示
    updateScoreDisplay();
});