// HTMLが完全に読み込まれてからスクリプトを実行する
document.addEventListener('DOMContentLoaded', () => {

    // --- 設定値 (ゲームのルールなどをここで一元管理) ---
    const SETTINGS = {
        MAX_ROUNDS: 10,
        TIME_LIMIT: 10,
        AUDIO_PLAY_DURATION: 5000, // 音声が再生される時間 (ミリ秒)
        READY_COUNTDOWN_SECONDS: 3,
        SCORE: {
            CORRECT: 20,
            INCORRECT: -10,
        },
        PLAYER_KEYS: {
            PLAYER1: 'f',
            PLAYER2: 'j',
        },
        API_URLS: {
            QUIZ: '/api/quiz',
            SUBMIT_SCORES: '/api/submit_scores',
        },
        RESULT_PAGE_URL: '/result',
        QUIT_URL: '/', // ゲームをやめるボタンの遷移先URL
    };

    // --- UI要素 (DOM要素をまとめて取得) ---
    const UI = {
        audioPlayer: document.getElementById('audio-player'),
        answerButtons: document.querySelectorAll('.answer-button'),
        feedbackMessage: document.getElementById('feedback-message'),
        resultFeedback: document.querySelector('.result-feedback'),
        hintButton: document.getElementById('hint-button'),
        gameBody: document.querySelector('.game-body'),
        nextQuestionButton: document.querySelector('.next-question-button'),
        questionTitle: document.getElementById('question-title'),
        timeLimitDisplay: document.getElementById('time-limit-display'),
        addPlaylistButton: document.getElementById('add-to-playlist-button'),
        player1Button: document.getElementById('player1-button'),
        player2Button: document.getElementById('player2-button'),
        player1ScoreDisplay: document.getElementById('player1-score'),
        player2ScoreDisplay: document.getElementById('player2-score'),
        choicesContainer: document.querySelector('.choices-container'),
        playerButtonsContainer: document.querySelector('.player-buttons-container'),
        playAudioButton: document.querySelector('.play-audio-button'),
        readyCountdownDisplay: document.querySelector('.ready-countdown'),
        quitGameButton: document.getElementById('quit-game-button'),
    };

    // --- ゲーム管理オブジェクト ---
    const game = {
        // --- 状態管理 ---
        state: {
            round: 0,
            player1Score: 0,
            player2Score: 0,
            correctAnswer: null,
            whoAnswered: null, // 1 or 2
            usedSongIds: [], // 既出の曲IDを記録する配列
            // ゲームの進行状況を管理するステータス
            // 'LOADING', 'READY_TO_PLAY', 'COUNTDOWN', 'PLAYING', 'ANSWERING', 'SHOW_RESULT', 'ENDED'
            currentStatus: 'LOADING',
            timers: {
                audioTimeout: null,
                countdownInterval: null,
                readyCountdownInterval: null,
                temporaryMessageTimeout: null, // 一時メッセージ用のタイマー
            },
        },

        /**
         * ゲームの初期化
         */
        init() {
            this.bindEvents();
            this.fetchQuiz();
        },

        /**
         * イベントリスナーをまとめて設定
         */
        bindEvents() {
            UI.playAudioButton.addEventListener('click', () => this.startReadyCountdown());
            UI.player1Button.addEventListener('click', () => this.handlePlayerAnswer(1));
            UI.player2Button.addEventListener('click', () => this.handlePlayerAnswer(2));
            UI.hintButton.addEventListener('click', () => this.showHint());
            UI.nextQuestionButton.addEventListener('click', () => this.nextRound());
            UI.addPlaylistButton.addEventListener('click', () => this.addToPlaylist());
            if (UI.quitGameButton) {
                UI.quitGameButton.addEventListener('click', () => this.quitGame());
            }

            UI.answerButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                    const selectedMusicId = Number(event.target.dataset.musicId);
                    this.checkAnswer(selectedMusicId);
                });
            });

            document.addEventListener('keydown', (event) => {
                // --- グローバルキー ---
                // Escapeキーはいつでもゲームを終了
                if (event.key === 'Escape') {
                    this.quitGame();
                    return;
                }

                // --- ステータス別キー ---
                switch (this.state.currentStatus) {
                    case 'READY_TO_PLAY':
                        if (event.code === 'Space') {
                            event.preventDefault(); // ページのスクロールを防止
                            UI.playAudioButton.click();
                        }
                        break;

                    case 'PLAYING':
                        if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER1) {
                            UI.player1Button.click();
                        } else if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER2) {
                            UI.player2Button.click();
                        }
                        break;

                    case 'ANSWERING':
                        const keyNumber = parseInt(event.key, 10);
                        if (keyNumber >= 1 && keyNumber <= 4) {
                            const buttonIndex = keyNumber - 1;
                            if (UI.answerButtons[buttonIndex]) {
                                event.preventDefault(); // 数字キーのデフォルト動作を防止
                                UI.answerButtons[buttonIndex].click();
                            }
                        }
                        break;
                    
                    case 'SHOW_RESULT':
                         if (event.code === 'Space' && UI.nextQuestionButton.style.display !== 'none') {
                            event.preventDefault(); // ページのスクロールを防止
                            UI.nextQuestionButton.click();
                        }
                        break;
                }
            });
        },

        /**
         * クイズデータをAPIから取得
         */
        async fetchQuiz() {
            this.state.currentStatus = 'LOADING';
            this.updateUI();
            this.state.round++;

            // 次のラウンドのためにボタンの状態をリセット
            UI.addPlaylistButton.disabled = false;

            try {
                const response = await fetch(SETTINGS.API_URLS.QUIZ, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        exclude: this.state.usedSongIds
                    }),
                });

                if (!response.ok) throw new Error('クイズの取得に失敗しました。');
                
                const quizData = await response.json();

                this.state.correctAnswer = quizData.correct_answer;
                
                // 新しい正解の曲IDを既出リストに追加
                this.state.usedSongIds.push(this.state.correctAnswer.music_id);

                UI.audioPlayer.src = `static/${this.state.correctAnswer.audio_file}`;

                quizData.choices.forEach((choice, index) => {
                    UI.answerButtons[index].textContent = choice.title;
                    UI.answerButtons[index].dataset.musicId = choice.music_id;
                });

                this.state.currentStatus = 'READY_TO_PLAY';
            } catch (error) {
                console.error(error);
                this.state.currentStatus = 'ERROR';
            } finally {
                this.updateUI();
            }
        },

        /**
         * 再生前の準備カウントダウンを開始
         */
        startReadyCountdown() {
            this.state.currentStatus = 'COUNTDOWN';
            this.updateUI();
            let count = SETTINGS.READY_COUNTDOWN_SECONDS;
            UI.readyCountdownDisplay.textContent = count;

            this.clearTimers();
            this.state.timers.readyCountdownInterval = setInterval(() => {
                count--;
                UI.readyCountdownDisplay.textContent = count;
                if (count <= 0) {
                    clearInterval(this.state.timers.readyCountdownInterval);
                    this.startRound();
                }
            }, 1000);
        },

        /**
         * ラウンドを開始 (音声再生と時間制限カウントダウン)
         */
        startRound() {
            this.state.currentStatus = 'PLAYING';
            this.updateUI();

            UI.audioPlayer.currentTime = 0;
            UI.audioPlayer.play();

            // 一定時間後に音声を停止
            this.state.timers.audioTimeout = setTimeout(() => {
                if (!UI.audioPlayer.paused) {
                    UI.audioPlayer.pause();
                }
            }, SETTINGS.AUDIO_PLAY_DURATION);

            // 制限時間のカウントダウンを開始
            let timeLeft = SETTINGS.TIME_LIMIT;
            UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
            this.state.timers.countdownInterval = setInterval(() => {
                timeLeft--;
                UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
                if (timeLeft <= 0) {
                    this.handleTimeout();
                }
            }, 1000);
        },

        /**
         * プレイヤーの早押し回答を処理
         * @param {number} player - プレイヤー番号 (1 or 2)
         */
        handlePlayerAnswer(player) {
            if (this.state.currentStatus !== 'PLAYING') return;
            this.state.whoAnswered = player;
            this.state.currentStatus = 'ANSWERING';
            UI.audioPlayer.pause();
            this.updateUI(); // ★ UI更新でメッセージを表示
        },
        
        /**
         * 選択肢の正誤を判定
         * @param {number} selectedMusicId - 選択された曲のID
         */
        checkAnswer(selectedMusicId) {
            if (this.state.currentStatus !== 'ANSWERING') return;
            this.clearTimers();

            const isCorrect = selectedMusicId === this.state.correctAnswer.music_id;

            if (isCorrect) {
                this.updateScore(true);
                this.showResult(true);
            } else {
                this.updateScore(false);
                UI.resultFeedback.textContent = '不正解！';
                this.state.currentStatus = 'SHOW_RESULT';
                this.updateUI();

                // 少し待ってから、もう一度回答のチャンスを与える
                setTimeout(() => {
                    this.state.whoAnswered = null;
                    // 音声を途中から再開
                    this.startRound(); 
                }, 2000);
            }
        },

        /**
         * 時間切れの処理
         */
        handleTimeout() {
            this.clearTimers();
            this.showResult(false, true); // isCorrect: false, isTimeout: true
        },

        /**
         * 正解/不正解/時間切れの結果を表示
         * @param {boolean} isCorrect - 正解したか
         * @param {boolean} isTimeout - 時間切れか
         */
        showResult(isCorrect, isTimeout = false) {
            this.state.currentStatus = 'SHOW_RESULT';
            this.clearTimers();

            if (isTimeout) {
                UI.resultFeedback.innerHTML = `時間切れ！<br>正解は「${this.state.correctAnswer.title} / ${this.state.correctAnswer.composer}」でした。`;
            } else if (isCorrect) {
                UI.resultFeedback.innerHTML = `🎉正解！<br>「${this.state.correctAnswer.title} / ${this.state.correctAnswer.composer}」`;
            }
            // 不正解の場合は checkAnswer 内でメッセージを設定済み

            this.updateUI();
        },

        /**
         * スコアを更新
         * @param {boolean} isCorrect - 正解したか
         */
        updateScore(isCorrect) {
            const scoreChange = isCorrect ? SETTINGS.SCORE.CORRECT : SETTINGS.SCORE.INCORRECT;
            if (this.state.whoAnswered === 1) {
                this.state.player1Score = Math.max(0, this.state.player1Score + scoreChange);
            } else if (this.state.whoAnswered === 2) {
                this.state.player2Score = Math.max(0, this.state.player2Score + scoreChange);
            }
            this.updateScoreDisplay();
        },

        /**
         * スコア表示を更新
         */
        updateScoreDisplay() {
            UI.player1ScoreDisplay.textContent = `スコア: ${this.state.player1Score}`;
            UI.player2ScoreDisplay.textContent = `スコア: ${this.state.player2Score}`;
        },

        /**
         * 次のラウンドに進むか、ゲームを終了する
         */
        nextRound() {
            if (this.state.round < SETTINGS.MAX_ROUNDS) {
                this.fetchQuiz();
            } else {
                this.endGame();
            }
        },

        /**
         * ゲームを終了し、スコアをサーバーに送信
         */
        async endGame() {
            this.state.currentStatus = 'ENDED';
            this.updateUI();
            try {
                const response = await fetch(SETTINGS.API_URLS.SUBMIT_SCORES, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        player1Score: this.state.player1Score,
                        player2Score: this.state.player2Score,
                    }),
                });
                if (response.ok) {
                    window.location.href = SETTINGS.RESULT_PAGE_URL;
                } else {
                    throw new Error('スコアの送信に失敗しました。');
                }
            } catch (error) {
                console.error('通信エラー:', error);
                this.state.currentStatus = 'ERROR';
                this.updateUI();
            }
        },

        /**
         * ゲームを中断して指定されたURLに移動
         */
        quitGame() {
            // 確認ダイアログは環境によって動作しないことがあるため、直接移動します
            window.location.href = SETTINGS.QUIT_URL;
        },

        /**
         * ヒントを表示
         */
        showHint() {
            if (this.state.correctAnswer && this.state.correctAnswer.hint) {
                this.showTemporaryMessage(`ヒント: ${this.state.correctAnswer.hint}`);
                UI.hintButton.disabled = true;
            }
        },
        
        /**
         * プレイリストに追加（機能のプレースホルダー）
         */
        addToPlaylist() {
            this.showTemporaryMessage(`「${this.state.correctAnswer.title}」をプレイリストに追加しました。（仮）`);
            // ボタンを無効化して複数回の追加を防ぐ
            UI.addPlaylistButton.disabled = true;
        },

        /**
         * 一時的なメッセージをfeedback-message要素に表示
         * @param {string} message - 表示するメッセージ
         * @param {number} duration - 表示時間 (ミリ秒)
         */
        showTemporaryMessage(message, duration = 3000) {
            const messageEl = UI.feedbackMessage;

            // 既存のメッセージタイマーがあればクリア
            if (this.state.timers.temporaryMessageTimeout) {
                clearTimeout(this.state.timers.temporaryMessageTimeout);
            }

            // メッセージを設定して表示
            messageEl.textContent = message;
            messageEl.style.display = 'block';

            // 指定時間後にメッセージを消して非表示にするタイマーを設定
            this.state.timers.temporaryMessageTimeout = setTimeout(() => {
                // メッセージが上書きされていない場合のみクリア
                if (messageEl.textContent === message) {
                    messageEl.textContent = '';
                    messageEl.style.display = 'none';
                }
                this.state.timers.temporaryMessageTimeout = null;
            }, duration);
        },

        /**
         * すべてのタイマーをクリアし、IDをリセット
         */
        clearTimers() {
            Object.keys(this.state.timers).forEach(key => {
                if (this.state.timers[key]) {
                    clearTimeout(this.state.timers[key]);
                    clearInterval(this.state.timers[key]);
                    this.state.timers[key] = null;
                }
            });
        },

        /**
         * ゲームのステータスに基づいてUIの表示/非表示を更新
         */
        updateUI() {
            const status = this.state.currentStatus;

            // デフォルトですべての主要コンテナを非表示にする
            const allContainers = [
                UI.feedbackMessage, UI.resultFeedback, UI.gameBody, UI.playAudioButton,
                UI.readyCountdownDisplay, UI.playerButtonsContainer, UI.choicesContainer,
                UI.nextQuestionButton, UI.addPlaylistButton, UI.hintButton, UI.timeLimitDisplay
            ];
            allContainers.forEach(el => el.style.display = 'none');
            
            // 問題タイトルとスコアは常に表示
            UI.questionTitle.textContent = `第 ${this.state.round} 問`;
            this.updateScoreDisplay();

            // ステータスに応じて表示を切り替え
            switch (status) {
                case 'LOADING':
                    UI.feedbackMessage.textContent = '問題を取得中...';
                    UI.feedbackMessage.style.display = 'block';
                    break;

                case 'READY_TO_PLAY':
                    UI.gameBody.style.display = 'block';
                    UI.playAudioButton.style.display = 'flex';
                    break;

                case 'COUNTDOWN':
                    UI.gameBody.style.display = 'block';
                    UI.readyCountdownDisplay.style.display = 'block';
                    break;

                case 'PLAYING':
                    UI.gameBody.style.display = 'block';
                    UI.playerButtonsContainer.style.display = 'flex';
                    UI.timeLimitDisplay.style.display = 'block';
                    UI.hintButton.style.display = 'block';
                    UI.hintButton.disabled = false;
                    UI.answerButtons.forEach(b => b.disabled = true);
                    break;

                case 'ANSWERING':
                    UI.gameBody.style.display = 'block';
                    UI.choicesContainer.style.display = 'flex';
                    UI.timeLimitDisplay.style.display = 'block';
                    UI.hintButton.style.display = 'block';
                    UI.answerButtons.forEach(b => b.disabled = false);
                    // ★ 誰が回答中かを表示
                    if (this.state.whoAnswered) {
                        UI.feedbackMessage.textContent = `プレイヤー${this.state.whoAnswered}が回答中...`;
                        UI.feedbackMessage.style.display = 'block';
                    }
                    break;

                case 'SHOW_RESULT':
                    UI.resultFeedback.style.display = 'block';
                    // 不正解で回答権が残っている場合以外は「次へ」ボタンを表示
                    if (UI.resultFeedback.textContent !== '不正解！') {
                        UI.nextQuestionButton.style.display = 'block';
                        UI.addPlaylistButton.style.display = 'block';
                    }
                    break;

                case 'ENDED':
                    UI.feedbackMessage.textContent = 'ゲーム終了！結果を送信中...';
                    UI.feedbackMessage.style.display = 'block';
                    break;
                
                case 'ERROR':
                    UI.feedbackMessage.textContent = 'エラーが発生しました。ページを再読み込みしてください。';
                    UI.feedbackMessage.style.display = 'block';
                    break;
            }
        },
    };

    // --- ゲーム開始 ---
    game.init();
});
