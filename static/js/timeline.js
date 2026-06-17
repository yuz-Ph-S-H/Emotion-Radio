const Timeline = (() => {
    let entries = [];
    let isReplaying = false;

    function addEntry(text, data) {
        entries.push({ timestamp: Date.now(), text, emotionData: data });
        const countEl = document.getElementById('entry-count');
        if (countEl) countEl.textContent = entries.length + ' 条';
        const bar = document.getElementById('timeline-progress');
        if (bar) bar.style.width = Math.min(100, entries.length / 20 * 100) + '%';
    }

    async function replay() {
        if (isReplaying || entries.length === 0) return;
        isReplaying = true;
        const btn = document.getElementById('playback-btn');
        btn.textContent = '⏹ 停止';

        for (let i = 0; i < entries.length; i++) {
            if (!isReplaying) break;
            const e = entries[i];
            displayText(e.text);
            MusicEngine.updateParams(e.emotionData.music);
            VisualEngine.updateParams(e.emotionData.visual);
            updateIndicators(e.emotionData);
            updateImageryTags(e.emotionData.imageries);
            const bar = document.getElementById('timeline-progress');
            bar.style.width = ((i+1)/entries.length*100)+'%';
            await sleep(3500);
        }
        isReplaying = false;
        btn.textContent = '▶ 回放';
    }

    function toggleReplay() {
        if (isReplaying) { isReplaying = false; }
        else { replay(); }
    }

    return { addEntry, toggleReplay };
})();
