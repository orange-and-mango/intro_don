// HTMLが完全に読み込まれてからスクリプトを実行する
document.addEventListener('DOMContentLoaded', () => {
    // --- ゲームで使う要素を取得 ---
    const audioPlayer = document.getElementById('audio-player');
    const answerButtons = document.querySelectorAll('.answer-button');
    const feedbackMessage = document.getElementById('feedback-message');
    const resultFeedback = document.querySelector('.result-feedback');
    const hintButton = document.getElementById('hint-button');
    const gameBody = document.querySelector('.game-body');
    const nextQuestionButton = document.querySelector('.next-question-button');
    const questionTitle = document.getElementById('question-title');
    const timeLimitDisplay = document.getElementById('time-limit-display');
    const addPlaylistButton = document.getElementById('add-to-playlist-button');
    const player1Button = document.getElementById('player1-button');
    const player2Button = document.getElementById('player2-button');
    const player1ScoreDisplay = document.getElementById('player1-score');
    const player2ScoreDisplay = document.getElementById('player2-score');
    const choicesContainer = document.querySelector('.choices-container');
    const playerButtonsContainer = document.querySelector('.player-buttons-container');
    const playAudioButton = document.querySelector('.play-audio-button');
    const readyCountdownDisplay = document.querySelector('.ready-countdown');

    // --- ゲームの状態を管理する変数 ---
    let round = 0; // 現在のラウンド
    let maxRounds = 10; // 最大ラウンド数
    let correctAnswer = null; // 正解の曲情報を保持
    let timeoutId = null; // タイムアウトIDを保持
    let countdownId = null; // カウントダウン用のID
    let timeLimit = 10; // タイムリミット（秒）
    let correctScore = 20 ; // 正解のスコア
    let incorrectScore = -10; // 不正解のスコア
    let player1Score = 0;
    let player2Score = 0;
    let isAnswered = false; // どちらかが回答したかを判定
    let whoAnswered = null; // どちらのプレイヤーが回答したかを記録
    let readyCountdownID = null; // 準備カウントダウン用のID

    // === 1. クイズ問題を取得してゲームを開始する関数 ===
    async function fetchQuiz() {
        // フィードバックメッセージを隠し、ボタンを有効化
        round++; // ラウンドを進める
        audioPlayer.pause(); // 音声を停止
        feedbackMessage.textContent = '';
        feedbackMessage.style.display = 'none';
        addPlaylistButton.style.display = 'none'; // お気に入り追加ボタンを隠す
        hintButton.style.display = 'none'; // ヒントボタンを表示
        hintButton.disabled = false; // 次の問題でヒントボタンを再度有効化
        nextQuestionButton.style.display = 'none'; // ボタンを隠す
        resultFeedback.style.display = 'none'; // 結果フィードバックを隠す
        isAnswered = false; // 回答状態をリセット
        whoAnswered = null; // 回答したプレイヤーをリセット
        choicesContainer.style.display = 'none'; // 選択肢を隠す
        playerButtonsContainer.style.display = 'none'; // プレイヤーボタンを隠す
        timeLimitDisplay.style.display = 'none'; // 残り時間表示を隠す
        playAudioButton.style.display = 'flex'; // 再生ボタンを表示
        gameBody.style.display = 'block'; // ゲームエリアを表示

        try {
            // バックエンドのAPIを呼び出して問題を取得
            const response = await fetch('/api/quiz');
            if (!response.ok) {
                throw new Error('クイズの取得に失敗しました。');
            }
            const quizData = await response.json();

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
            // 問題タイトルを設定
            questionTitle.textContent = `第 ${round} 問`;

        } catch (error) {
            console.error(error);
            gameBody.style.display = 'none'; // ゲームエリアを隠す
            feedbackMessage.textContent = 'エラーが発生しました。ページを再読み込みしてください。';
            feedbackMessage.style.display = 'block';
        }
    }

    // 音楽を再生するボタンのクリックイベント
    playAudioButton.addEventListener('click', () => {
        clearTimeout(timeoutId); // 前のタイムアウトをクリア
        clearInterval(readyCountdownID); // 前のカウントダウンをクリア
        playAudioButton.style.display = 'none'; // 再生ボタンを隠す
        readyCountdownDisplay.style.display = 'block'; // カウントダウン表示を表示
        let readyCountdown = 3; // 準備カウントダウンの秒数
        readyCountdownDisplay.textContent = `${readyCountdown}`;
        // 1秒ごとにカウントダウンを更新
        readyCountdownID = setInterval(() => {
            readyCountdown--;
            readyCountdownDisplay.textContent = `${readyCountdown}`;

            if (readyCountdown <= 0) {
                clearInterval(readyCountdownID); // カウントダウンを停止
                readyCountdownDisplay.textContent = ''; // カウントダウン表示をクリア
                readyCountdownDisplay.style.display = 'none'; // カウントダウン表示を隠す

                startAudio(); // 音楽を最初から再生
                startCountdown(); // カウントダウンを開始
                // 選択肢ボタンを有効化
                playerButtonsContainer.style.display = 'flex'; // プレイヤーボタンを表示
                hintButton.style.display = 'block'; // ヒントボタンを表示
                timeLimitDisplay.style.display = 'block'; // 残り時間表示を表示
                answerButtons.forEach(button => button.disabled = false);
            }
    }, 1000);
    });

    // 音楽を最初に戻して再生する関数
    function startAudio() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0; // 再生位置を最初に戻す
        audioPlayer.play(); // 再生を開始
        // 5秒後に音を停止
        timeoutId = setTimeout(() => {
            if (!audioPlayer.paused) {
                audioPlayer.pause();
            }
        }, 5000);
    }

    // カウントダウンを開始する関数
    function startCountdown() {
        let remainingTime = timeLimit;
        timeLimitDisplay.textContent = `残り${remainingTime}秒`;

        // 1秒ごとにカウントダウンを更新
        countdownId = setInterval(() => {
            remainingTime--;
            timeLimitDisplay.textContent = `残り${remainingTime}秒`;

            if (remainingTime <= 0) {
                clearInterval(countdownId); // カウントダウンを停止
                timeLimitDisplay.textContent = ''; // 残り時間表示をクリア
                handleTimeout(); // タイムアウト処理を呼び出す
            }
    }, 1000);
}

    // プレイヤー1とプレイヤー2のボタンにクリックイベントを設定
    player1Button.addEventListener('click', () => handlePlayerAnswer(1));
    player2Button.addEventListener('click', () => handlePlayerAnswer(2));

    function handlePlayerAnswer(player) {
        if (isAnswered) return; // 既に回答されていたら無視
        isAnswered = true; // 回答済みに設定
        whoAnswered = player; // 回答したプレイヤーを記録
        audioPlayer.pause(); // 音声を停止
        choicesContainer.style.display = 'flex'; // 選択肢を表示
        playerButtonsContainer.style.display = 'none'; // プレイヤーボタンを隠
    }

    function addScore() {
        if (whoAnswered === 1) {
            player1Score += correctScore; // プレイヤー1のスコアを加算
            player1ScoreDisplay.textContent = `スコア: ${player1Score}`;
        } else if (whoAnswered === 2) {
            player2Score += correctScore; // プレイヤー2のスコアを加算
            player2ScoreDisplay.textContent = `スコア: ${player2Score}`;
        }
    }

    function subtractScore() {
        if (whoAnswered === 1) {
            player1Score = Math.max(0, player1Score + incorrectScore); // プレイヤー1のスコアを減算し、0未満にならないようにする
            player1ScoreDisplay.textContent = `スコア: ${player1Score}`;
        } else if (whoAnswered === 2) {
            player2Score = Math.max(0, player2Score + incorrectScore); // プレイヤー2のスコアを減算し、0未満にならないようにする
            player2ScoreDisplay.textContent = `スコア: ${player2Score}`;
        }
    }

    // === 2. 回答ボタンの処理 ===
    answerButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // プレイヤーが選んだ答えのID
            const selectedMusicId = Number(event.target.dataset.musicId);
            audioPlayer.pause(); // 音声を一旦停止
            gameBody.style.display = 'none'; // ゲームエリアを隠す
            resultFeedback.style.display = 'block';
            // 正誤判定
            if (selectedMusicId === correctAnswer.music_id) {
                // 正解の場合
                clearInterval(countdownId); // カウントダウンを停止
                resultFeedback.innerHTML = `🎉正解！<br>「${correctAnswer.title} / ${correctAnswer.composer}」`;
                addScore(); // スコアを加算
                nextQuestionButton.style.display = 'block'; // ボタンを表示
                addPlaylistButton.style.display = 'block'; // お気に入り追加ボタンを表示
                hintButton.style.display = 'none'; // ヒントボタンを隠す
                clearTimeout(timeoutId); // タイムアウトをクリア
            } else {
                resultFeedback.textContent = `不正解`;
                subtractScore(); // スコアを減算
                setTimeout(() => {
                    // 不正解の場合の処理
                    isAnswered = false; // 回答状態をリセット
                    whoAnswered = null; // 回答したプレイヤーをリセット
                    choicesContainer.style.display = 'none'; // 選択肢を隠す
                    playerButtonsContainer.style.display = 'flex'; // プレイヤーボタンを表示
                    gameBody.style.display = 'block'; // ゲームエリアを再表示
                    resultFeedback.style.display = 'none'; // フィードバックメッセージを隠す
                    clearTimeout(timeoutId); // タイムアウトをクリア
                    startAudio(); // 音楽を最初に戻して再生
                }, 2000);
            }
        });
    });

    // 時間切れ時の処理
    function handleTimeout() {
        clearInterval(countdownId); // カウントダウンを停止
        audioPlayer.pause(); // 音声を停止
        resultFeedback.innerHTML = `時間切れ！<br>正解は「${correctAnswer.title} / ${correctAnswer.composer}」でした。`;
        resultFeedback.style.display = 'block';
        gameBody.style.display = 'none'; // ゲームエリアを隠す
        nextQuestionButton.style.display = 'block'; // 次の問題ボタンを表示
        addPlaylistButton.style.display = 'block'; // お気に入り追加ボタンを表示
        hintButton.style.display = 'none'; // ヒントボタンを隠す
    }

    // === 4. 次の問題ボタンの処理 ===
    nextQuestionButton.addEventListener('click', () => {
        if (round < maxRounds) {
            fetchQuiz(); // 新しい問題を取得
        } else {
            feedbackMessage.textContent = '終了';
            feedbackMessage.style.display = 'block';
            console.log('スコア送信開始');
            fetch('/api/submit_scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player1Score: player1Score,
                    player2Score: player2Score,
                }),
            })
            .then(response => {
                console.log('レスポンスを受信:', response);
                if (response.ok) {
                    console.log('スコア送信成功');
                    window.location.href = '/result'; // 結果画面に遷移
                } else {
                    console.error('スコア送信失敗:', response.status);
                }
            })
            .catch(error => {
                console.error('通信エラー:', error);
            });
        }
    });

    // === 3. ヒントボタンの処理 ===
    hintButton.addEventListener('click', () => {
        if (correctAnswer && correctAnswer.hint) {
            alert(`ヒント: ${correctAnswer.hint}`);
            hintButton.disabled = true; // ヒントは1回だけ
        }
    });
    // --- 最初にゲームを初期化 ---
    fetchQuiz();
});