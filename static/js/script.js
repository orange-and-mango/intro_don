// HTMLが完全に読み込まれてからスクリプトを実行する
document.addEventListener('DOMContentLoaded', () => {
    // --- ゲームで使う要素を取得 ---
    const audioPlayer = document.getElementById('audio-player');
    const playButton = document.getElementById('play-intro-button');
    const answerButtons = document.querySelectorAll('.answer-button');
    const scoreDisplay = document.querySelector('#score-display span');
    const feedbackMessage = document.getElementById('feedback-message');

    // --- ゲームの状態を管理する変数 ---
    let score = 0;
    let correctAnswer = null; // 正解の曲情報を保持

    // === 1. クイズ問題を取得してゲームを開始する関数 ===
    async function fetchQuiz() {
        // フィードバックメッセージを隠し、ボタンを有効化
        feedbackMessage.textContent = '';
        feedbackMessage.style.display = 'none';
        playButton.disabled = false;

        try {
            // バックエンドのAPIを呼び出して問題を取得
            const response = await fetch('/api/quiz');
            if (!response.ok) {
                throw new Error('クイズの取得に失敗しました。');
            }
            const quizData = await response.json();

            // 取得したデータをコンソールに表示して確認
            console.log('取得したクイズデータ:', quizData);

            // 正解の曲情報を保存
            correctAnswer = quizData.correct_answer;

            // 音声プレイヤーに音源を設定
            audioPlayer.src = `static/${correctAnswer.audio_file}`;

            // 選択肢ボタンに曲名を設定
            quizData.choices.forEach((choice, index) => {
                answerButtons[index].textContent = choice.title;
                // 各ボタンに、どの曲IDかをデータとして埋め込む
                answerButtons[index].dataset.musicId = choice.music_id;
                answerButtons[index].disabled = true; // 最初は押せないように
            });

        } catch (error) {
            console.error(error);
            feedbackMessage.textContent = 'エラーが発生しました。ページを再読み込みしてください。';
            feedbackMessage.style.display = 'block';
        }
    }

    // === 2. イントロ再生ボタンの処理 ===
    playButton.addEventListener('click', () => {
        audioPlayer.play();
        playButton.disabled = true; // 再生中はボタンを無効化

        // 選択肢ボタンを有効化
        answerButtons.forEach(button => button.disabled = false);

        // 5秒後に音を停止
        setTimeout(() => {
            if (!audioPlayer.paused) {
                audioPlayer.pause();
            }
        }, 5000);
    });

    // === 3. 回答ボタンの処理 ===
    answerButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // プレイヤーが選んだ答えのID
            const selectedMusicId = Number(event.target.dataset.musicId);

            // 正誤判定
            if (selectedMusicId === correctAnswer.music_id) {
                feedbackMessage.textContent = '正解！ 🎉';
                score += 10; // スコアを加算
                scoreDisplay.textContent = score;
            } else {
                feedbackMessage.textContent = `不正解... 正解は「${correctAnswer.title}」でした`;
            }

            feedbackMessage.style.display = 'block';
            // 全てのボタンを一旦無効化
            answerButtons.forEach(btn => btn.disabled = true);

            // 2秒後に次の問題へ
            setTimeout(fetchQuiz, 2000);
        });
    });

    // --- 最初にゲームを初期化 ---
    fetchQuiz();
});