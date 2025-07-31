// HTMLドキュメントの構造（DOM）が完全に読み込まれ、解析が完了した時点でスクリプトを実行する。
document.addEventListener('DOMContentLoaded', () => {

    // --- ゲーム設定 (定数) ---
    // ゲームのルールや動作に関わる固定値を定義する。
    // これらを一箇所にまとめることで、後からルールの変更が容易になる。
    const SETTINGS = {
        MAX_ROUNDS: 10,                      // 最大ラウンド数
        TIME_LIMIT: 10,                      // 1ラウンドあたりの制限時間 (秒)
        AUDIO_PLAY_DURATION: 5000,           // イントロが再生される最大時間 (ミリ秒)
        SE_INTRO_DELAY: 2000,                // ラウンド開始SEとイントロ再生の間の待機時間 (ミリ秒)
        SCORE: {
            CORRECT: 20,                     // 正解時の加算スコア
            INCORRECT: -10,                  // 不正解時の減算スコア
        },
        PLAYER_KEYS: {
            PLAYER1: 'f',                    // プレイヤー1の早押しキー
            PLAYER2: 'j',                    // プレイヤー2の早押しキー
        },
        API_URLS: {
            QUIZ: '/api/quiz',               // クイズデータを取得するAPIのエンドポイント
            SUBMIT_SCORES: '/api/submit_scores', // スコアを送信するAPIのエンドポイント
        },
        RESULT_PAGE_URL: '/result',          // 結果表示ページのURL
        QUIT_URL: '/',                       // ゲームを中断して戻るページのURL
    };

    // --- UI要素の取得 ---
    // HTML上の操作対象となる要素をあらかじめ取得し、オブジェクトにまとめておく。
    // これにより、コードの各所で都度 `document.getElementById` を呼び出す必要がなくなり、処理の効率と可読性が向上する。
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
    // ゲーム全体のロジックと状態をまとめて管理する。
    const game = {
        // --- ゲームの状態管理 ---
        state: {
            round: 0,
            player1Score: 0,
            player2Score: 0,
            correctAnswer: null,
            whoAnswered: null,               // 回答権を得たプレイヤー (1 or 2)
            usedSongIds: [],                 // 出題済みの曲IDリスト (重複出題を防ぐため)
            timeLeft: 0,
            settings: {
                mainVolume: 0.5,
                seEnabled: true,
                seVolume: 0.5,
            },
            // ゲームの進行状況を示すステータス。この値に応じてUIの表示や操作を切り替える。
            // 'LOADING':       APIからクイズデータを読み込み中
            // 'READY_TO_PLAY': イントロ再生待機中
            // 'PLAYING_SE':    ラウンド開始SEの再生中
            // 'PLAYING':       イントロ再生中・早押し待機中
            // 'ANSWERING':     プレイヤーが回答権を得て、選択肢を選んでいる最中
            // 'SHOW_RESULT':   正解・不正解・時間切れの結果を表示中
            // 'ENDED':         全ラウンド終了し、結果画面への遷移待ち
            currentStatus: 'LOADING',
            // タイマー処理のIDを保持し、必要なタイミングで停止できるようにする。
            timers: {
                audioTimeout: null,
                countdownInterval: null,
                temporaryMessageTimeout: null,
            },
        },
        
        // --- 効果音(SE)のファイルパス ---
        sePaths: {
            correct: '/static/audio/SE_Correct.mp3',
            incorrect: '/static/audio/SE_Incorrect.mp3',
            answer: '/static/audio/SE_Answer.mp3',
            question: '/static/audio/SE_Question.mp3',
        },

        /**
         * ゲーム全体の初期化処理。
         */
        init() {
            this.loadSettings();
            this.bindEvents();
            this.fetchQuiz();
        },
        
        /**
         * ローカルストレージからユーザー設定を読み込む。
         * 保存された設定がない場合は、定義済みのデフォルト値を使用する。
         */
        loadSettings() {
            const mainVolume = localStorage.getItem('mainVolume') ?? '50';
            const seEnabled = JSON.parse(localStorage.getItem('seEnabled') ?? 'true');
            const seVolume = localStorage.getItem('seVolume') ?? '50';

            this.state.settings.mainVolume = parseInt(mainVolume, 10) / 100;
            this.state.settings.seEnabled = seEnabled;
            this.state.settings.seVolume = parseInt(seVolume, 10) / 100;
            
            UI.audioPlayer.volume = this.state.settings.mainVolume;
        },

        /**
         * イベントリスナーを登録する。
         * ゲームの状態(currentStatus)に応じて、特定のキー操作のみを受け付ける。
         */
        bindEvents() {
            UI.playAudioButton.addEventListener('click', () => this.startRound());
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

            // キーボードショートカット
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') { this.quitGame(); return; }
                switch (this.state.currentStatus) {
                    case 'READY_TO_PLAY': // イントロ再生待ち
                        if (event.code === 'Space') { event.preventDefault(); UI.playAudioButton.click(); }
                        break;
                    case 'PLAYING': // 早押し受付中
                        if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER1) { UI.player1Button.click(); } 
                        else if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER2) { UI.player2Button.click(); }
                        break;
                    case 'ANSWERING': // 回答選択中
                        const keyNumber = parseInt(event.key, 10);
                        if (keyNumber >= 1 && keyNumber <= 4) {
                            const buttonIndex = keyNumber - 1;
                            if (UI.answerButtons[buttonIndex]) { event.preventDefault(); UI.answerButtons[buttonIndex].click(); }
                        }
                        break;
                    case 'SHOW_RESULT': // 結果表示中
                         if (event.code === 'Space' && UI.nextQuestionButton.style.display !== 'none') { event.preventDefault(); UI.nextQuestionButton.click(); }
                        break;
                }
            });
        },

        /**
         * APIサーバーからクイズデータを非同期で取得する。
         */
        async fetchQuiz() {
            this.state.currentStatus = 'LOADING';
            this.updateUI();
            this.state.round++;
            UI.addPlaylistButton.disabled = false;
            try {
                // 既に出題した曲のIDリストをサーバーに送り、重複を避ける
                const response = await fetch(SETTINGS.API_URLS.QUIZ, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exclude: this.state.usedSongIds }),
                });
                if (!response.ok) throw new Error('クイズの取得に失敗した。');
                
                const quizData = await response.json();
                this.state.correctAnswer = quizData.correct_answer;
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
                this.updateUI(); // 成功・失敗に関わらずUIを更新
            }
        },

        /**
         * 新しいラウンドを開始する。
         */
        startRound() {
            if (this.state.currentStatus !== 'READY_TO_PLAY') return;

            this.state.timeLeft = SETTINGS.TIME_LIMIT;
            this.state.currentStatus = 'PLAYING_SE';
            this.updateUI(); 
            this.playSoundEffect('question');

            setTimeout(() => {
                if (this.state.currentStatus !== 'PLAYING_SE') return;
                this.startIntroAndTimer();
            }, SETTINGS.SE_INTRO_DELAY);
        },

        /**
         * イントロの再生と制限時間タイマーを開始する。
         * 不正解後に処理を再開する際にもこの関数が呼ばれる。
         */
        startIntroAndTimer() {
            this.state.currentStatus = 'PLAYING';
            this.updateUI();

            UI.audioPlayer.currentTime = 0;
            UI.audioPlayer.play();
            
            // 一定時間後にイントロを自動停止させるタイマー
            this.state.timers.audioTimeout = setTimeout(() => {
                if (!UI.audioPlayer.paused) { UI.audioPlayer.pause(); }
            }, SETTINGS.AUDIO_PLAY_DURATION);
            
            // 1秒ごとに残り時間を減らすタイマー
            let timeLeft = this.state.timeLeft; 
            UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
            this.clearTimers('countdownInterval'); // 古いタイマーが残っている場合を考慮してクリア
            this.state.timers.countdownInterval = setInterval(() => {
                timeLeft--;
                this.state.timeLeft = timeLeft;
                UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
                if (timeLeft <= 0) { 
                    this.handleTimeout();
                }
            }, 1000);
        },

        /**
         * プレイヤーが早押しボタンを押したときの処理。
         */
        handlePlayerAnswer(player) {
            if (this.state.currentStatus !== 'PLAYING') return;
            
            // カウントダウンとイントロ自動停止のタイマーを両方停止
            this.clearTimers('countdownInterval');
            this.clearTimers('audioTimeout');

            this.playSoundEffect('answer');
            this.state.whoAnswered = player;
            this.state.currentStatus = 'ANSWERING';
            UI.audioPlayer.pause();
            this.updateUI();
        },
        
        /**
         * プレイヤーが選択した回答の正誤を判定する。
         */
        checkAnswer(selectedMusicId) {
            if (this.state.currentStatus !== 'ANSWERING') return;

            const isCorrect = selectedMusicId === this.state.correctAnswer.music_id;
            if (isCorrect) {
                // 正解の処理
                this.playSoundEffect('correct');
                this.updateScore(true);
                this.showResult(true);
            } else {
                // 不正解の処理
                this.playSoundEffect('incorrect');
                this.updateScore(false);
                
                this.state.currentStatus = 'SHOW_RESULT';
                UI.resultFeedback.textContent = '不正解！';
                this.updateUI();

                // 2秒後に、もう一方のプレイヤーに回答権が渡る（イントロ再生が再開される）
                setTimeout(() => {
                    if (this.state.currentStatus === 'SHOW_RESULT') {
                        this.state.whoAnswered = null;
                        this.startIntroAndTimer();
                    }
                }, 2000);
            }
        },

        /**
         * 制限時間内に誰も回答しなかった場合の処理。
         */
        handleTimeout() {
            this.clearTimers();
            this.playSoundEffect('incorrect'); // 時間切れは不正解扱い
            this.showResult(false, true); // 時間切れ専用の結果表示
        },

        /**
         * ラウンドの結果（正解、時間切れなど）を画面に表示する。
         * @param {boolean} isCorrect - 正解したかどうか
         * @param {boolean} [isTimeout=false] - 時間切れかどうか
         */
        showResult(isCorrect, isTimeout = false) {
            this.state.currentStatus = 'SHOW_RESULT';
            this.clearTimers();
            if (isTimeout) {
                UI.resultFeedback.innerHTML = `時間切れ！<br>正解は「${this.state.correctAnswer.title} / ${this.state.correctAnswer.composer}」でした。`;
            } else if (isCorrect) {
                UI.resultFeedback.innerHTML = `🎉正解！<br>「${this.state.correctAnswer.title} / ${this.state.correctAnswer.composer}」`;
            }
            this.updateUI();
        },

        /**
         * 正解・不正解に応じてプレイヤーのスコアを更新する。
         * @param {boolean} isCorrect - 正解したかどうか
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
         * スコア表示エリアを現在のスコアで更新する。
         */
        updateScoreDisplay() {
            UI.player1ScoreDisplay.textContent = `スコア: ${this.state.player1Score}`;
            UI.player2ScoreDisplay.textContent = `スコア: ${this.state.player2Score}`;
        },

        /**
         * 次のラウンドに進むか、ゲームを終了するかを判断する。
         */
        nextRound() {
            if (this.state.round < SETTINGS.MAX_ROUNDS) {
                this.fetchQuiz();
            } else {
                this.endGame();
            }
        },

        /**
         * ゲームの最終処理。スコアをサーバーに送信し、結果ページへ遷移する。
         */
        async endGame() {
            this.state.currentStatus = 'ENDED';
            this.updateUI();
            try {
                const response = await fetch(SETTINGS.API_URLS.SUBMIT_SCORES, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player1Score: this.state.player1Score, player2Score: this.state.player2Score }),
                });
                if (response.ok) {
                    window.location.href = SETTINGS.RESULT_PAGE_URL;
                } else {
                    throw new Error('スコアの送信に失敗した。');
                }
            } catch (error) {
                console.error('通信エラー:', error);
                this.state.currentStatus = 'ERROR';
                this.updateUI();
            }
        },

        /**
         * ゲームを中断し、指定されたURLに遷移する。
         */
        quitGame() {
            window.location.href = SETTINGS.QUIT_URL;
        },

        /**
         * ヒントを表示する。ヒントは1ラウンドに1回のみ使用可能。
         */
        showHint() {
            if (this.state.correctAnswer && this.state.correctAnswer.hint) {
                this.showTemporaryMessage(`ヒント: ${this.state.correctAnswer.hint}`);
                UI.hintButton.disabled = true;
            }
        },

        /**
         * 正解した曲をローカルストレージのプレイリストに追加する。
         */
        addToPlaylist() {
            const songId = this.state.correctAnswer.music_id;
            const songTitle = this.state.correctAnswer.title;
            let playlist = JSON.parse(localStorage.getItem('musicPlaylist')) || [];
            
            if (playlist.includes(songId)) {
                this.showTemporaryMessage(`「${songTitle}」は既に追加されています。`);
            } else {
                playlist.push(songId);
                localStorage.setItem('musicPlaylist', JSON.stringify(playlist));
                this.showTemporaryMessage(`「${songTitle}」をプレイリストに追加しました。`);
            }
            UI.addPlaylistButton.disabled = true;
        },

        /**
         * 画面下部に一時的なフィードバックメッセージを表示する。
         * @param {string} message - 表示するメッセージ内容
         * @param {number} [duration=3000] - 表示時間 (ミリ秒)
         */
        showTemporaryMessage(message, duration = 3000) {
            const messageEl = UI.feedbackMessage;
            // 既にメッセージ表示タイマーが動いている場合は、それをクリアして新しいメッセージで上書きする
            if (this.state.timers.temporaryMessageTimeout) {
                clearTimeout(this.state.timers.temporaryMessageTimeout);
            }
            messageEl.textContent = message;
            messageEl.style.display = 'block';
            this.state.timers.temporaryMessageTimeout = setTimeout(() => {
                // メッセージが書き換わっていない場合のみ非表示にする
                if (messageEl.textContent === message) {
                    messageEl.textContent = '';
                    messageEl.style.display = 'none';
                }
                this.state.timers.temporaryMessageTimeout = null;
            }, duration);
        },

        /**
         * 指定された種類の効果音(SE)を再生する。
         * @param {string} type - 再生するSEの種類 ('correct', 'incorrect', 'answer', 'question')
         */
        playSoundEffect(type) {
            if (!this.state.settings.seEnabled) return;
            
            const path = this.sePaths[type];
            if (path) {
                const audio = new Audio(path);
                audio.volume = this.state.settings.seVolume;
                // audio.play() は Promise を返すため、エラーハンドリングを行う
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // ユーザーの操作なしに再生しようとした場合などのエラーをコンソールに出力
                        console.error(`Error playing sound '${type}':`, error);
                    });
                }
            }
        },

        /**
         * 登録されているタイマーをクリア（停止）する。
         * @param {string|null} specificTimer - 特定のタイマー名。nullの場合は全てのタイマーを停止。
         */
        clearTimers(specificTimer = null) {
            if (specificTimer) {
                if (this.state.timers[specificTimer]) {
                    clearInterval(this.state.timers[specificTimer]);
                    clearTimeout(this.state.timers[specificTimer]);
                    this.state.timers[specificTimer] = null;
                }
            } else {
                Object.keys(this.state.timers).forEach(key => {
                    if (this.state.timers[key]) {
                        clearInterval(this.state.timers[key]);
                        clearTimeout(this.state.timers[key]);
                        this.state.timers[key] = null;
                    }
                });
            }
        },

        /**
         * 現在のゲーム状態(currentStatus)に応じて、UI要素の表示/非表示をまとめて切り替える。
         */
        updateUI() {
            const status = this.state.currentStatus;
            
            // 一旦、関連するUI要素をすべて非表示にする
            const allContainers = [ UI.feedbackMessage, UI.resultFeedback, UI.gameBody, UI.playAudioButton, UI.playerButtonsContainer, UI.choicesContainer, UI.nextQuestionButton, UI.addPlaylistButton, UI.hintButton, UI.timeLimitDisplay, UI.readyCountdownDisplay ];
            allContainers.forEach(el => { if(el) el.style.display = 'none' });

            // 常に表示する要素
            UI.questionTitle.textContent = `第 ${this.state.round} 問`;
            this.updateScoreDisplay();

            // statusに応じて必要な要素だけを表示する
            switch (status) {
                case 'LOADING':
                    UI.feedbackMessage.textContent = '問題を取得中...';
                    UI.feedbackMessage.style.display = 'block';
                    break;
                case 'READY_TO_PLAY':
                    UI.gameBody.style.display = 'block';
                    UI.playAudioButton.style.display = 'flex';
                    break;
                case 'PLAYING_SE':
                    UI.gameBody.style.display = 'block';
                    if (UI.readyCountdownDisplay) {
                        UI.readyCountdownDisplay.textContent = `第 ${this.state.round} 問`;
                        UI.readyCountdownDisplay.style.display = 'flex';
                        UI.readyCountdownDisplay.style.alignItems = 'center';
                        UI.readyCountdownDisplay.style.justifyContent = 'center';
                        UI.readyCountdownDisplay.style.fontSize = '5rem';
                        UI.readyCountdownDisplay.style.fontWeight = 'bold';
                    }
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
                    if (this.state.whoAnswered) {
                        UI.feedbackMessage.textContent = `プレイヤー${this.state.whoAnswered}が回答中...`;
                        UI.feedbackMessage.style.display = 'block';
                    }
                    break;
                case 'SHOW_RESULT':
                    UI.resultFeedback.style.display = 'block';
                    // 正解発表（曲名表示）がある場合のみ「次へ」ボタンなどを表示する
                    if (UI.resultFeedback.innerHTML.includes('<br>')) {
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

    game.init();
});
