document.addEventListener('DOMContentLoaded', () => {
    VisualEngine.init();
    MusicEngine.init();
    Socket.connect();

    Socket.onResult(handleEmotionResult);

    const input = document.getElementById('text-input');
    const sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', sendText);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendText(); }
    });

    document.getElementById('playback-btn')
            .addEventListener('click', () => Timeline.toggleReplay());

    // 点击任意位置启动Tone.js
    document.addEventListener('click', () => MusicEngine.ensureStarted(), { once: true });
});

let firstInput = true;

function sendText() {
    const input = document.getElementById('text-input');
    const text = input.value.trim();
    if (!text) return;

    // 首次输入：淡出标题，显示指示器和时间线
    if (firstInput) {
        firstInput = false;
        document.getElementById('title-area').classList.add('hidden');
        document.getElementById('emotion-indicator').classList.add('visible');
        document.getElementById('timeline-bar').classList.add('visible');
    }

    displayText(text);
    Socket.sendText(text);
    input.value = '';
    input.focus();
}

function handleEmotionResult(data) {
    MusicEngine.updateParams(data.music);
    VisualEngine.updateParams(data.visual);
    updateIndicators(data);
    updateImageryTags(data.imageries);
    updateNowStatus(data);
    Timeline.addEntry(data.text, data);
}

function updateNowStatus(data) {
    const el = document.getElementById('now-status');
    if (!el) return;
    el.classList.add('live');
    const mood = data.valence > 0.6 ? '明亮' : data.valence < 0.35 ? '深沉' : '柔和';
    const energy = data.arousal > 0.6 ? '· 涌动' : data.arousal < 0.35 ? '· 静谧' : '';
    el.textContent = `播放中 · ${mood} ${energy}`.trim();
}

function displayText(text) {
    const display = document.getElementById('text-display');

    // 旧文字淡出
    const existing = display.querySelectorAll('.text-line');
    existing.forEach(el => {
        el.style.animation = 'textFadeOut 2s ease forwards';
    });

    // 保留最近3条
    while (display.children.length > 3) {
        display.removeChild(display.firstChild);
    }

    const line = document.createElement('div');
    line.className = 'text-line';
    line.textContent = text;
    display.appendChild(line);
}

function updateIndicators(data) {
    const vBar = document.getElementById('valence-bar');
    const vText = document.getElementById('valence-text');
    vBar.style.width = (data.valence * 100) + '%';
    vText.textContent = data.valence.toFixed(2);

    const aBar = document.getElementById('arousal-bar');
    const aText = document.getElementById('arousal-text');
    aBar.style.width = (data.arousal * 100) + '%';
    aText.textContent = data.arousal.toFixed(2);
}

function updateImageryTags(imageries) {
    const container = document.getElementById('imagery-tags');
    container.innerHTML = '';
    for (const word of imageries) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = word;
        container.appendChild(tag);
    }
}
