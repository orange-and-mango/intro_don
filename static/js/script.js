// HTMLが完全に読み込まれてからスクリプトを実行する
document.addEventListener('DOMContentLoaded', () => {

    // --- 設定値 (ゲームのルールなどをここで一元管理) ---
    const SETTINGS = {
        MAX_ROUNDS: 10,
        TIME_LIMIT: 10,
        AUDIO_PLAY_DURATION: 5000, // 音声が再生される時間 (ミリ秒)
        SE_INTRO_DELAY: 2000, // 開始音とイントロの間の待機時間 (ミリ秒)
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
            usedSongIds: [],
            timeLeft: 0, // ★ 残り時間を保持するプロパティを追加
            settings: {
                mainVolume: 0.5,
                seEnabled: true,
                seVolume: 0.5,
            },
            // 'LOADING', 'READY_TO_PLAY', 'PLAYING_SE', 'PLAYING', 'ANSWERING', 'SHOW_RESULT', 'ENDED'
            currentStatus: 'LOADING',
            timers: {
                audioTimeout: null,
                countdownInterval: null,
                temporaryMessageTimeout: null,
            },
        },
        
        sePaths: {
            correct: '/static/audio/SE_Correct.mp3',
            incorrect: '/static/audio/SE_Incorrect.mp3',
            answer: '/static/audio/SE_Answer.mp3',
            question: '/static/audio/SE_Question.mp3',
        },

        /**
         * ゲームの初期化
         */
        init() {
            this.loadSettings();
            this.bindEvents();
            this.fetchQuiz();
        },
        
        /**
         * ローカルストレージから設定を読み込み、適用する
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
         * イベントリスナーをまとめて設定
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

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') { this.quitGame(); return; }
                switch (this.state.currentStatus) {
                    case 'READY_TO_PLAY':
                        if (event.code === 'Space') { event.preventDefault(); UI.playAudioButton.click(); }
                        break;
                    case 'PLAYING':
                        if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER1) { UI.player1Button.click(); } 
                        else if (event.key.toLowerCase() === SETTINGS.PLAYER_KEYS.PLAYER2) { UI.player2Button.click(); }
                        break;
                    case 'ANSWERING':
                        const keyNumber = parseInt(event.key, 10);
                        if (keyNumber >= 1 && keyNumber <= 4) {
                            const buttonIndex = keyNumber - 1;
                            if (UI.answerButtons[buttonIndex]) { event.preventDefault(); UI.answerButtons[buttonIndex].click(); }
                        }
                        break;
                    case 'SHOW_RESULT':
                         if (event.code === 'Space' && UI.nextQuestionButton.style.display !== 'none') { event.preventDefault(); UI.nextQuestionButton.click(); }
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
            UI.addPlaylistButton.disabled = false;
            try {
                const response = await fetch(SETTINGS.API_URLS.QUIZ, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exclude: this.state.usedSongIds }),
                });
                if (!response.ok) throw new Error('クイズの取得に失敗しました。');
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
                console.error(error); this.state.currentStatus = 'ERROR';
            } finally {
                this.updateUI();
            }
        },

        /**
         * ラウンドを開始 (SE再生と「第◯問」表示)
         */
        startRound() {
            if (this.state.currentStatus !== 'READY_TO_PLAY') return;

            // ★ ラウンド開始時に残り時間をリセット
            this.state.timeLeft = SETTINGS.TIME_LIMIT; 
            
            this.state.currentStatus = 'PLAYING_SE';
            this.updateUI(); 
            
            this.playSoundEffect('question');

            setTimeout(() => {
                if (this.state.currentStatus !== 'PLAYING_SE') return;
                
                // ★ イントロとタイマーの開始を新しい関数に分離
                this.startIntroAndTimer();

            }, SETTINGS.SE_INTRO_DELAY);
        },

        /**
         * イントロ再生と時間制限タイマーを開始する
         */
        startIntroAndTimer() {
            this.state.currentStatus = 'PLAYING';
            this.updateUI();

            UI.audioPlayer.currentTime = 0;
            UI.audioPlayer.play();
            
            this.state.timers.audioTimeout = setTimeout(() => {
                if (!UI.audioPlayer.paused) { UI.audioPlayer.pause(); }
            }, SETTINGS.AUDIO_PLAY_DURATION);
            
            // ★ stateに保存された残り時間からタイマーを再開
            let timeLeft = this.state.timeLeft; 
            UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
            this.clearTimers('countdownInterval');
            this.state.timers.countdownInterval = setInterval(() => {
                timeLeft--;
                this.state.timeLeft = timeLeft; // ★ 毎秒、残り時間をstateに保存
                UI.timeLimitDisplay.textContent = `残り${timeLeft}秒`;
                if (timeLeft <= 0) { this.handleTimeout(); }
            }, 1000);
        },

        /**
         * プレイヤーの早押し回答を処理
         */
        handlePlayerAnswer(player) {
            if (this.state.currentStatus !== 'PLAYING') return;
            
            // ★ カウントダウンタイマーとイントロ停止タイマーのみを停止
            this.clearTimers('countdownInterval');
            this.clearTimers('audioTimeout');

            this.playSoundEffect('answer');
            this.state.whoAnswered = player;
            this.state.currentStatus = 'ANSWERING';
            UI.audioPlayer.pause();
            this.updateUI();
        },
        
        /**
         * 選択肢の正誤を判定
         */
        checkAnswer(selectedMusicId) {
            if (this.state.currentStatus !== 'ANSWERING') return;

            const isCorrect = selectedMusicId === this.state.correctAnswer.music_id;
            if (isCorrect) {
                this.playSoundEffect('correct');
                this.updateScore(true);
                this.showResult(true);
            } else {
                this.playSoundEffect('incorrect');
                this.updateScore(false);
                
                this.state.currentStatus = 'SHOW_RESULT';
                UI.resultFeedback.textContent = '不正解！';
                this.updateUI();

                setTimeout(() => {
                    if (this.state.currentStatus === 'SHOW_RESULT') {
                        this.state.whoAnswered = null;
                        // ★ イントロとタイマーを残り時間から再開する
                        this.startIntroAndTimer();
                    }
                }, 2000);
            }
        },

        /**
         * 時間切れの処理
         */
        handleTimeout() {
            this.clearTimers();
            this.playSoundEffect('incorrect'); // ★ 時間切れでも不正解音を鳴らす
            this.showResult(false, true);
        },

        /**
         * 結果を表示
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
         * スコアを更新
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

        updateScoreDisplay() {
            UI.player1ScoreDisplay.textContent = `スコア: ${this.state.player1Score}`;
            UI.player2ScoreDisplay.textContent = `スコア: ${this.state.player2Score}`;
        },

        /**
         * 次のラウンドへ
         */
        nextRound() {
            if (this.state.round < SETTINGS.MAX_ROUNDS) { this.fetchQuiz(); } 
            else { this.endGame(); }
        },

        /**
         * ゲーム終了処理
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
                if (response.ok) { window.location.href = SETTINGS.RESULT_PAGE_URL; } 
                else { throw new Error('スコアの送信に失敗しました。'); }
            } catch (error) {
                console.error('通信エラー:', error); this.state.currentStatus = 'ERROR'; this.updateUI();
            }
        },

        quitGame() { window.location.href = SETTINGS.QUIT_URL; },
        showHint() {
            if (this.state.correctAnswer && this.state.correctAnswer.hint) {
                this.showTemporaryMessage(`ヒント: ${this.state.correctAnswer.hint}`);
                UI.hintButton.disabled = true;
            }
        },
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
         * 一時的なメッセージを表示
         */
        showTemporaryMessage(message, duration = 3000) {
            const messageEl = UI.feedbackMessage;
            if (this.state.timers.temporaryMessageTimeout) { clearTimeout(this.state.timers.temporaryMessageTimeout); }
            messageEl.textContent = message;
            messageEl.style.display = 'block';
            this.state.timers.temporaryMessageTimeout = setTimeout(() => {
                if (messageEl.textContent === message) { messageEl.textContent = ''; messageEl.style.display = 'none'; }
                this.state.timers.temporaryMessageTimeout = null;
            }, duration);
        },

        /**
         * 効果音を再生する（より安全な方法）
         */
        playSoundEffect(type) {
            if (!this.state.settings.seEnabled) return;
            const path = this.sePaths[type];
            if (path) {
                const audio = new Audio(path);
                audio.volume = this.state.settings.seVolume;
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error(`Error playing sound '${type}':`, error);
                    });
                }
            }
        },

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

        updateUI() {
            const status = this.state.currentStatus;
            const allContainers = [ UI.feedbackMessage, UI.resultFeedback, UI.gameBody, UI.playAudioButton, UI.playerButtonsContainer, UI.choicesContainer, UI.nextQuestionButton, UI.addPlaylistButton, UI.hintButton, UI.timeLimitDisplay, UI.readyCountdownDisplay ];
            allContainers.forEach(el => { if(el) el.style.display = 'none' });

            UI.questionTitle.textContent = `第 ${this.state.round} 問`;
            this.updateScoreDisplay();
            switch (status) {
                case 'LOADING': UI.feedbackMessage.textContent = '問題を取得中...'; UI.feedbackMessage.style.display = 'block'; break;
                case 'READY_TO_PLAY': UI.gameBody.style.display = 'block'; UI.playAudioButton.style.display = 'flex'; break;
                
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
                    UI.gameBody.style.display = 'block'; UI.playerButtonsContainer.style.display = 'flex'; UI.timeLimitDisplay.style.display = 'block'; UI.hintButton.style.display = 'block';
                    UI.hintButton.disabled = false; UI.answerButtons.forEach(b => b.disabled = true);
                    break;
                case 'ANSWERING':
                    UI.gameBody.style.display = 'block'; UI.choicesContainer.style.display = 'flex'; 
                    // ★ 解答中もタイマーを表示
                    UI.timeLimitDisplay.style.display = 'block';
                    UI.hintButton.style.display = 'block';
                    UI.answerButtons.forEach(b => b.disabled = false);
                    if (this.state.whoAnswered) { UI.feedbackMessage.textContent = `プレイヤー${this.state.whoAnswered}が回答中...`; UI.feedbackMessage.style.display = 'block'; }
                    break;
                case 'SHOW_RESULT':
                    UI.resultFeedback.style.display = 'block';
                    // 「不正解！」というメッセージだけの時は「次へ」ボタンを表示しない
                    if (UI.resultFeedback.innerHTML.includes('<br>')) {
                        // 正解 or 時間切れの時（<br>タグが含まれる）だけボタンを表示
                        UI.nextQuestionButton.style.display = 'block';
                        UI.addPlaylistButton.style.display = 'block';
                    }
                    break;
                case 'ENDED': UI.feedbackMessage.textContent = 'ゲーム終了！結果を送信中...'; UI.feedbackMessage.style.display = 'block'; break;
                case 'ERROR': UI.feedbackMessage.textContent = 'エラーが発生しました。ページを再読み込みしてください。'; UI.feedbackMessage.style.display = 'block'; break;
            }
        },
    };

    game.init();
});
