document.addEventListener('DOMContentLoaded', () => {
    // UI要素を取得
    const mainVolumeSlider = document.getElementById('main-volume');
    const mainVolumeValue = document.getElementById('main-volume-value');
    const seEnabledToggle = document.getElementById('se-enabled');
    const seVolumeSlider = document.getElementById('se-volume');
    const seVolumeValue = document.getElementById('se-volume-value');

    // ページ読み込み時にローカルストレージから設定を読み込む
    function loadSettings() {
        // ?? は、左辺がnullかundefinedの場合に右辺の値を返す演算子
        const mainVolume = localStorage.getItem('mainVolume') ?? '50';
        const seEnabled = JSON.parse(localStorage.getItem('seEnabled') ?? 'true');
        const seVolume = localStorage.getItem('seVolume') ?? '50';

        // UIに値を反映
        mainVolumeSlider.value = mainVolume;
        mainVolumeValue.textContent = mainVolume;
        seEnabledToggle.checked = seEnabled;
        seVolumeSlider.value = seVolume;
        seVolumeValue.textContent = seVolume;

        // SEが無効なら音量スライダーも無効化
        seVolumeSlider.disabled = !seEnabled;
    }

    // イントロ音量のスライダーが動かされたとき
    mainVolumeSlider.addEventListener('input', () => {
        const volume = mainVolumeSlider.value;
        mainVolumeValue.textContent = volume;
        localStorage.setItem('mainVolume', volume);
    });

    // SE有効/無効のトグルが切り替わったとき
    seEnabledToggle.addEventListener('change', () => {
        const isEnabled = seEnabledToggle.checked;
        localStorage.setItem('seEnabled', isEnabled);
        // SEが無効なら音量スライダーも無効化
        seVolumeSlider.disabled = !isEnabled;
    });

    // SE音量のスライダーが動かされたとき
    seVolumeSlider.addEventListener('input', () => {
        const volume = seVolumeSlider.value;
        seVolumeValue.textContent = volume;
        localStorage.setItem('seVolume', volume);
    });

    // 初期読み込みを実行
    loadSettings();
});
