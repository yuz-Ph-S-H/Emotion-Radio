# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

共感电台 · Emotion Radio — a Flask + Socket.IO web app that turns a line of Chinese text into a real-time **emotion → music + visual** experience. The browser receives emotion/music/visual parameters over a WebSocket and renders them with Tone.js (procedural audio) and Canvas 2D (particles). The full emotion→audiovisual mapping is backed by formulas documented in `docs/数学推导说明.md`.

# 项目规范
- 任何情况下，所有对话、代码注释和解释都必须使用简体中文回答。
- 绝对禁止使用日文、英文或其他语言回复。

## Commands

```bash
# Setup
python -m venv venv
venv\Scripts\activate            # Windows (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt

# Run (serves http://127.0.0.1:5000)
python app.py                    # or, on Windows, double-click run.bat / run ./run.ps1

# Regenerate the procedural background audio beds (WAV + playlist.json under static/audio/)
python tools/generate_audio_assets.py
```

There is **no test suite, linter, or build step** — this is a small Flask app served directly. Validation is manual: run `python app.py`, open the page, click once (browser audio-autoplay policy), type Chinese text, and observe the emotion readout / particles / music.

## Architecture

**Data flow** (one round trip per submitted line of text):

```
Browser (static/js/main.js)
  └─ Socket.emit('analyze_text', {text})
       └─ app.py @socketio.on('analyze_text')
            └─ Analyzer.analyze(text)  →  nlp/analyzer.py (or api_analyzer.py)
                 ├─ SnowNLP + jieba + imagery_dict   → (valence, arousal, imageries, weights)
                 └─ emotion_model.compute_music_params / compute_visual_params
       └─ emit('emotion_result', result)
  └─ Socket.onResult → main.js handleEmotionResult
       ├─ MusicEngine.updateParams(result.music)   (static/js/music-engine.js — Tone.js)
       └─ VisualEngine.updateParams(result.visual) (static/js/visual-engine.js — Canvas)
```

**The NLP layer is swappable via `config.py` `NLP_MODE`** — `app.py` imports `LocalAnalyzer` (`"local"`, default, offline, no key) or `ApiAnalyzer` (`"api"`, LLM via OpenAI-compatible endpoint). Both expose the same `analyze(text)` / `generate_weights(text)` interface, so the rest of the system is mode-agnostic. The API key comes from env var `EMOTION_RADIO_API_KEY` — never hardcode a real key in `config.py`.

**`nlp/` is the brain; everything downstream just renders its output dict.** Key responsibilities:
- `analyzer.py` — three-way valence fusion: SnowNLP sentiment blended with imagery-dictionary valence priors (imagery weighted higher because SnowNLP over-scores Chinese positivity), then emotion-keyword corrections applied last to preserve strong words. Tunable constants `SNOW_WEIGHT`, `IMAGERY_VALENCE_GAIN` at the top of `LocalAnalyzer`.
- `imagery_dict.py` — `IMAGERY_DICT` (260+ nature imagery words, each carrying `valence_adj`, `arousal`, `effect`, `color`, `instrument`) and `EMOTION_KEYWORDS` (197 sentiment words). These are also injected into jieba as custom words.
- `emotion_model.py` — pure functions mapping `(valence, arousal, imageries)` → music params (scale/root, tempo, instruments, low-pass cutoff, chord color, melodic contour, envelope…) and visual params (HSL background, particle effects/count/speed, palette, glow). The 6 **mood profiles** (`MOOD_PROFILES`) and `_classify_mood` thresholds are what separate the scenes (melancholy/calm/tender/joyful/tense/dreamy); tune those to change musical "personality."

**The `nlp/` output dict is a contract.** Field names produced in `emotion_model.py` (e.g. `filter_cutoff`, `contour`, `phrase_style`, `use_drums`, `particle_effects`, `color_palette`) are consumed directly by name in the JS engines. Renaming or adding a field requires updating the corresponding `static/js/*.js` consumer.

**Frontend** (`static/js/`, plain JS modules via IIFE globals, no bundler): `main.js` orchestrates; `socket.js` wraps Socket.IO; `music-engine.js` is the Tone.js phrase engine + mastering chain; `visual-engine.js` drives the Canvas render loop using `particle.js` (particle classes/effect presets) and `effects.js` (background gradient/glow/vignette post-processing); `timeline.js` records submitted lines for replay.

**Audio beds** in `static/audio/` are procedurally generated originals (no copyrighted material) — regenerate with `tools/generate_audio_assets.py`, never commit third-party audio.

## Notes

- `academic_page/` is a static project page (with `.nojekyll` for GitHub Pages); it is separate from the running Flask app.
- Math derivation references appear throughout the code as comments like "见数学推导说明 §16~§19" pointing into `docs/数学推导说明.md` — keep them in sync when changing the corresponding formulas.
