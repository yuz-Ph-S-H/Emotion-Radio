const MusicEngine = (() => {
    const SCALES = {
        major:            [0, 2, 4, 5, 7, 9, 11],
        minor:            [0, 2, 3, 5, 7, 8, 10],
        pentatonic_major: [0, 2, 4, 7, 9],
        pentatonic_minor: [0, 3, 5, 7, 10],
    };

    const CHORD_TYPES = {
        major: [0, 4, 7],
        minor: [0, 3, 7],
    };

    const MAJOR_PROGS = [[0,4,5,3],[0,5,3,4],[0,3,4,5]];
    const MINOR_PROGS = [[0,5,3,4],[0,3,5,2],[0,4,3,5]];

    // ===== 旋律乐句库（按情绪性格分组，d=音阶级偏移，r=时值，rest=休止）=====
    // 每个性格有多条乐句，引擎会随机挑选并做移位/倒影/模进变形，配合句末休止，
    // 避免"简单旋律反复播放"，并让各场景旋律走向显著不同。
    const PHRASE_LIBRARY = {
        // 忧伤：缓慢、下行、留白多
        lament: [
            [{d:4,r:'2n'},{d:3,r:'4n'},{d:2,r:'2n'},{rest:1,r:'2n'}],
            [{d:2,r:'2n'},{d:1,r:'4n'},{d:0,r:'1m'},{rest:1,r:'2n'}],
            [{d:5,r:'4n'},{d:4,r:'4n'},{d:2,r:'2n'},{d:0,r:'2n'},{rest:1,r:'4n'}],
        ],
        // 平静：温和起伏、连绵
        flow: [
            [{d:0,r:'4n'},{d:2,r:'4n'},{d:4,r:'2n'},{d:2,r:'2n'},{rest:1,r:'4n'}],
            [{d:0,r:'2n'},{d:1,r:'4n'},{d:2,r:'4n'},{d:0,r:'2n'},{rest:1,r:'4n'}],
            [{d:4,r:'4n'},{d:2,r:'4n'},{d:1,r:'4n'},{d:2,r:'2n'},{rest:1,r:'2n'}],
        ],
        // 温柔：歌唱性的乐句弧线
        song: [
            [{d:0,r:'4n'},{d:2,r:'4n'},{d:1,r:'4n'},{d:3,r:'2n'},{d:2,r:'2n'},{rest:1,r:'4n'}],
            [{d:4,r:'4n'},{d:2,r:'4n'},{d:0,r:'2n'},{d:1,r:'2n'},{rest:1,r:'4n'}],
            [{d:2,r:'4n'},{d:4,r:'4n'},{d:5,r:'4n'},{d:4,r:'4n'},{d:2,r:'2n'},{rest:1,r:'4n'}],
        ],
        // 欢快：跑动音阶、琶音、活泼
        dance: [
            [{d:0,r:'8n'},{d:2,r:'8n'},{d:4,r:'8n'},{d:6,r:'8n'},{d:4,r:'4n'},{d:2,r:'4n'}],
            [{d:0,r:'8n'},{d:1,r:'8n'},{d:2,r:'8n'},{d:3,r:'8n'},{d:4,r:'8n'},{d:5,r:'8n'},{d:6,r:'4n'}],
            [{d:6,r:'8n'},{d:4,r:'8n'},{d:2,r:'8n'},{d:4,r:'8n'},{d:0,r:'4n'},{rest:1,r:'8n'}],
        ],
        // 紧张：窄音域、重复音、节奏驱动
        driving: [
            [{d:0,r:'8n'},{d:0,r:'8n'},{d:1,r:'8n'},{d:0,r:'8n'},{d:-1,r:'4n'}],
            [{d:0,r:'8n'},{d:2,r:'8n'},{d:0,r:'8n'},{d:-2,r:'8n'},{d:0,r:'4n'}],
            [{d:4,r:'8n'},{d:3,r:'8n'},{d:2,r:'8n'},{d:1,r:'8n'},{d:0,r:'4n'}],
        ],
        // 梦幻：宽广琶音、大量留白
        float: [
            [{d:0,r:'2n'},{d:4,r:'2n'},{d:7,r:'2n'},{rest:1,r:'2n'}],
            [{d:7,r:'2n'},{d:4,r:'4n'},{d:2,r:'2n'},{rest:1,r:'1m'}],
            [{d:0,r:'2n'},{d:2,r:'4n'},{d:4,r:'4n'},{d:7,r:'2n'},{rest:1,r:'2n'}],
        ],
    };

    let synths = {};
    let currentParams = null;
    let isPlaying = false;
    let melodyActive = false;
    let melodyEvents = [];
    let melodyAnchor = 7;
    let melodyTime = 0;
    let chordLoop = null, bassLoop = null, accentLoop = null, percussionLoop = null;
    let toneStarted = false;
    let currentScale = [];
    let currentChordProg = [];
    let chordIdx = 0;
    let externalTracks = [];
    let externalVolume = 0.22;
    let externalAudio = null;
    let externalTrackId = null;

    function init() {
        synths.piano = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.035, decay: 0.35, sustain: 0.18, release: 1.8 }
        });

        synths.strings = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsine', spread: 18, count: 3 },
            envelope: { attack: 0.8, decay: 0.8, sustain: 0.55, release: 3.0 }
        });

        synths.flute = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.2, decay: 0.35, sustain: 0.45, release: 1.7 }
        });

        synths.synth_pad = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsine', spread: 35, count: 4 },
            envelope: { attack: 1.4, decay: 1.2, sustain: 0.5, release: 4.0 }
        });

        synths.guitar = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.015, decay: 0.45, sustain: 0.08, release: 1.2 }
        });

        synths.celesta = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.9, sustain: 0.04, release: 2.4 }
        });

        synths.bells = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.006, decay: 1.4, sustain: 0.025, release: 3.0 }
        });

        synths.drums = new Tone.MembraneSynth({
            envelope: { attack: 0.02, decay: 0.55, sustain: 0.02, release: 0.8 }
        });

        // ===== 主输出母带链（柔化听感、防爆音）=====
        // 信号: 各声部 → delay/reverb → 低通 → EQ(压高频) → 压缩 → 限幅 → 输出
        synths.masterFilter = new Tone.Filter({ type: 'lowpass', frequency: 3200, rolloff: -24, Q: 0.4 });
        synths.masterEQ = new Tone.EQ3({ low: -1.5, mid: -1, high: -7, lowFrequency: 250, highFrequency: 3200 });
        synths.masterComp = new Tone.Compressor({ threshold: -22, ratio: 2.6, attack: 0.02, release: 0.28 });
        synths.limiter = new Tone.Limiter(-2);
        synths.masterFilter.chain(synths.masterEQ, synths.masterComp, synths.limiter, Tone.Destination);

        synths.delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.18, wet: 0.16 }).connect(synths.masterFilter);
        synths.reverb = new Tone.Reverb({ decay: 5.5, wet: 0.32 }).connect(synths.masterFilter);

        const busKeys = ['masterFilter', 'masterEQ', 'masterComp', 'limiter', 'reverb', 'delay', 'drums'];
        Object.keys(synths).forEach(k => {
            if (!busKeys.includes(k) && synths[k].connect) {
                synths[k].connect(synths.delay);
                synths[k].connect(synths.reverb);
            }
        });
        synths.drums.connect(synths.reverb);

        // 降低各合成器音量避免爆音
        Object.keys(synths).forEach(k => {
            if (busKeys.includes(k)) return;
            if (synths[k].volume) synths[k].volume.value = -15;
        });
        synths.drums.volume.value = -22;

        loadExternalPlaylist();
    }

    async function ensureStarted() {
        if (!toneStarted) {
            await Tone.start();
            toneStarted = true;
        }
    }

    async function updateParams(mp) {
        await ensureStarted();
        currentParams = mp;
        updateExternalBed(mp);
        Tone.Transport.bpm.rampTo(mp.tempo, 2);
        synths.reverb.wet.rampTo(mp.reverb, 2);
        synths.delay.wet.rampTo(0.1 + mp.reverb * 0.12, 2);

        // 情绪贴合：母带低通跟随明度，暖暗↔通透
        if (synths.masterFilter && typeof mp.filter_cutoff === 'number') {
            synths.masterFilter.frequency.rampTo(clamp(mp.filter_cutoff, 600, 9000), 2.5);
        }

        const rootMidi = noteToMidi(mp.root, mp.octave);
        const intervals = SCALES[mp.scale] || SCALES.major;
        currentScale = [];
        for (let oct = -1; oct <= 1; oct++) {
            for (const iv of intervals) currentScale.push(rootMidi + iv + oct * 12);
        }

        const isMin = mp.scale.includes('minor');
        const progs = isMin ? MINOR_PROGS : MAJOR_PROGS;
        currentChordProg = progs[Math.floor(Math.random() * progs.length)];

        if (!isPlaying) { startLoops(); isPlaying = true; }
    }

    function startLoops() {
        chordLoop = new Tone.Loop((time) => {
            if (!currentParams) return;
            const intervals = SCALES[currentParams.scale] || SCALES.major;
            const rootMidi = noteToMidi(currentParams.root, currentParams.octave - 1);
            const degree = currentChordProg[chordIdx % currentChordProg.length];
            const chordRoot = rootMidi + (intervals[degree % intervals.length] || 0);

            const isMin = currentParams.scale.includes('minor');
            const ct = isMin ?
                (degree === 0 || degree === 3 || degree === 4 ? 'minor' : 'major') :
                (degree === 1 || degree === 2 || degree === 5 ? 'minor' : 'major');

            const offsets = CHORD_TYPES[ct].slice();
            // 情绪色彩：中高效价加大七/九度，柔和增色
            if (currentParams.seventh) offsets.push(ct === 'major' ? 11 : 10);
            if (currentParams.ninth) offsets.push(14);
            const notes = offsets.map(o => Tone.Frequency(chordRoot + o, 'midi').toNote());
            const inst = getVoice('chord');
            inst.triggerAttackRelease(notes, '2n', time, currentParams.velocity * 0.3);
            chordIdx++;
        }, '1m');

        // 旋律改为乐句引擎（见 scheduleMelody / buildPhrase），不再用固定节拍随机游走

        bassLoop = new Tone.Loop((time) => {
            if (!currentParams) return;
            const intervals = SCALES[currentParams.scale] || SCALES.major;
            const rootMidi = noteToMidi(currentParams.root, 2);
            const degree = currentChordProg[chordIdx % currentChordProg.length];
            const bassNote = rootMidi + (intervals[degree % intervals.length] || 0);
            const note = Tone.Frequency(bassNote, 'midi').toNote();
            synths.synth_pad.triggerAttackRelease(note, '1m', time, currentParams.velocity * 0.18);
        }, '1m');

        accentLoop = new Tone.Loop((time) => {
            // 点缀声部仅在性格允许时出现（温柔/欢快/梦幻），其余场景保持干净
            if (!currentParams || !currentParams.accent || currentScale.length === 0) return;
            const voices = getInstrumentNames().filter(name => name !== 'drums');
            if (voices.length < 2) return;
            if (Math.random() > currentParams.density * 0.32) return;

            const instName = voices[voices.length - 1];
            const inst = synths[instName] || synths.celesta;
            const idx = clamp(melodyAnchor + 7 + Math.floor((Math.random() - 0.5) * 4), 0, currentScale.length - 1);
            const note = Tone.Frequency(currentScale[idx], 'midi').toNote();
            inst.triggerAttackRelease(note, randomChoice(['8n', '4n']), time, currentParams.velocity * 0.26);
        }, '2n');

        percussionLoop = new Tone.Loop((time) => {
            // 鼓点仅用于紧张/欢快场景
            if (!currentParams || !currentParams.use_drums) return;
            if (Math.random() > currentParams.density * 0.5) return;
            synths.drums.triggerAttackRelease('C2', '8n', time, currentParams.velocity * 0.24);
        }, '2n');

        Tone.Transport.start();
        chordLoop.start(0);
        bassLoop.start(0);
        accentLoop.start('8n');
        percussionLoop.start('4n');

        // 启动乐句引擎
        melodyActive = true;
        melodyEvents = [];
        melodyTime = Tone.Transport.seconds + 0.25;
        Tone.Transport.scheduleOnce(scheduleMelody, melodyTime);
    }

    // ===== 乐句引擎 =====
    function buildPhrase() {
        const style = (currentParams && currentParams.phrase_style) || 'song';
        const lib = PHRASE_LIBRARY[style] || PHRASE_LIBRARY.song;
        let phrase = lib[Math.floor(Math.random() * lib.length)].map(e => ({ ...e }));

        // 变形：50% 倒影（情绪走向相反时增加变化），并叠加 contour 决定的整体移位
        if (Math.random() < 0.35) phrase = phrase.map(e => (e.rest ? e : { ...e, d: -e.d }));

        // 锚点：以音域中部为基准，按 contour 上下移动，使积极偏高、消极偏低
        const center = Math.floor(currentScale.length * 0.45);
        const drift = Math.round((currentParams.contour || 0) * 3);
        const wander = Math.floor((Math.random() - 0.5) * 3);
        melodyAnchor = clamp(center + drift + wander, 1, currentScale.length - 8);

        melodyEvents = phrase;
    }

    function scheduleMelody(time) {
        // time = 精确 AudioContext 时间（用于触发音符）；melodyTime = Transport 时间轴累加器（用于排程）
        if (!melodyActive) return;
        if (!currentParams || currentScale.length === 0) {
            melodyTime += Tone.Time('4n').toSeconds();
            Tone.Transport.scheduleOnce(scheduleMelody, melodyTime);
            return;
        }
        if (melodyEvents.length === 0) buildPhrase();
        const ev = melodyEvents.shift();
        const durSec = Tone.Time(ev.r).toSeconds();

        if (!ev.rest) {
            const idx = clamp(melodyAnchor + ev.d, 0, currentScale.length - 1);
            const note = Tone.Frequency(currentScale[idx], 'midi').toNote();
            // 句首力度略强，句中渐弱，形成乐句呼吸感
            const pos = 1 - melodyEvents.length / 8;
            const vel = currentParams.velocity * (0.9 - pos * 0.18);
            getVoice('melody').triggerAttackRelease(note, ev.r, time, clamp(vel, 0.1, 0.95));
        }
        melodyTime += durSec;
        Tone.Transport.scheduleOnce(scheduleMelody, melodyTime);
    }

    function stop() {
        melodyActive = false;
        if (chordLoop) chordLoop.stop();
        if (bassLoop) bassLoop.stop();
        if (accentLoop) accentLoop.stop();
        if (percussionLoop) percussionLoop.stop();
        Tone.Transport.stop();
        stopExternalBed();
        isPlaying = false;
    }

    async function loadExternalPlaylist() {
        try {
            const res = await fetch('static/audio/playlist.json', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.enabled || !Array.isArray(data.tracks)) return;
            externalTracks = data.tracks;
            externalVolume = typeof data.defaultVolume === 'number' ? data.defaultVolume : 0.22;
            if (toneStarted && currentParams) updateExternalBed(currentParams);
        } catch (err) {
            console.warn('外部轻音乐播放列表加载失败', err);
        }
    }

    function updateExternalBed(mp) {
        if (!toneStarted || externalTracks.length === 0) return;
        const trackId = mp.audio_bed || 'calm_piano';
        if (trackId === externalTrackId && externalAudio) return;

        const track = externalTracks.find(item => item.id === trackId) || externalTracks[0];
        if (!track) return;

        const oldAudio = externalAudio;
        const nextAudio = new Audio(track.src);
        nextAudio.loop = true;
        nextAudio.preload = 'auto';
        nextAudio.volume = 0;

        nextAudio.play().then(() => {
            externalAudio = nextAudio;
            externalTrackId = track.id;
            fadeVolume(nextAudio, externalVolume, 1800);
            if (oldAudio) {
                fadeVolume(oldAudio, 0, 1200, () => {
                    oldAudio.pause();
                    oldAudio.src = '';
                });
            }
        }).catch(err => {
            console.warn('外部轻音乐启动失败', err);
        });
    }

    function stopExternalBed() {
        if (!externalAudio) return;
        const audio = externalAudio;
        fadeVolume(audio, 0, 800, () => {
            audio.pause();
            audio.src = '';
        });
        externalAudio = null;
        externalTrackId = null;
    }

    function fadeVolume(audio, target, duration, done) {
        const start = audio.volume;
        const startedAt = performance.now();
        function step(now) {
            const t = Math.min(1, (now - startedAt) / duration);
            audio.volume = start + (target - start) * t;
            if (t < 1) {
                requestAnimationFrame(step);
            } else if (done) {
                done();
            }
        }
        requestAnimationFrame(step);
    }

    function getInstrumentNames() {
        let names = Array.isArray(currentParams.instruments) && currentParams.instruments.length > 0
            ? currentParams.instruments
            : [currentParams.instrument || 'piano'];
        if (currentParams.max_voices) names = names.slice(0, currentParams.max_voices);
        const known = names.filter(name => synths[name]);
        return known.length ? known : ['piano'];
    }

    function getVoice(role) {
        const voices = getInstrumentNames().filter(name => name !== 'drums');
        if (voices.length === 0) return synths.piano;
        if (role === 'chord' && voices.length > 1) return synths[voices[1]] || synths[voices[0]];
        return synths[voices[0]] || synths.piano;
    }

    function noteToMidi(name, octave) {
        const map = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
        return (map[name] || 0) + (octave + 1) * 12;
    }

    return { init, updateParams, stop, ensureStarted };
})();
