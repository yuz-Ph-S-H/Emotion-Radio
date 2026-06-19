# 共感电台 · Emotion Radio

> 输入一段文字，**听见、看见**你的情绪。
> A text-driven, real-time **emotion → music + visual** generator.

共感电台是一个网页应用：你在输入框写下任意中文，系统实时分析其**情感效价**与**唤醒度**、识别其中的**自然意象**，
然后在浏览器里**即时生成**与情绪相符的轻音乐（Tone.js 程序化合成 + 原创背景音乐床），
并用全屏粒子画面把情绪可视化。整套情感→视听的映射有完整的数学推导支撑。

![language](https://img.shields.io/badge/Python-3.13+-blue)
![framework](https://img.shields.io/badge/Flask-SocketIO-black)
![audio](https://img.shields.io/badge/Audio-Tone.js-green)
![license](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ 核心特性

- **文字 → 情绪**：本地 `jieba + SnowNLP + 意象词典` 三级融合（无需联网、无需密钥），或可选大语言模型 API 增强。
- **情绪 → 音乐**：6 种**情绪性格**（忧伤 / 平静 / 温柔 / 欢快 / 紧张 / 梦幻），各自采用不同的旋律句式、配器、节奏、调式与音色亮度。
- **乐句引擎**：旋律以"乐句"为单位生成（取句 → 变形 → 呼吸 → 留白），告别"简单旋律反复播放"。
- **原创音乐床**：暖色谐波合成 + 升余弦音头 + 低通 + 混响 + 无缝循环，**不使用任何受版权保护的曲目**。
- **情绪 → 画面**：全屏 Canvas 粒子系统，效果（雨 / 雪 / 极光 / 烟花 / 星光…）、颜色、速度、辉光随情绪连续变化。
- **数学可解释**：色彩、调式、音色低通、和弦色彩、旋律走向、合成参数等均有公式推导（见 `docs/数学推导说明.md`）。

---

## 🗂️ 目录结构

```
art_final/
├── app.py                     # Flask + Socket.IO 入口
├── config.py                  # 全局配置（本地 / API 方案切换）
├── requirements.txt           # Python 依赖
├── run.bat / run.ps1          # Windows 一键启动脚本
├── nlp/                       # 文本情绪分析
│   ├── analyzer.py            #   本地分析器（jieba+SnowNLP+词典三级融合）
│   ├── api_analyzer.py        #   大语言模型 API 分析器（可选）
│   ├── emotion_model.py       #   情绪→音乐/视觉参数模型 + 情绪性格档
│   └── imagery_dict.py        #   意象词典(260+) 与情绪关键词(197)
├── index.html                 # 页面入口（GitHub Pages 与本地共用同一份）
├── static/
│   ├── css/style.css          #   玻璃拟态视觉样式
│   ├── js/                    #   前端运行时
│   │   ├── analyzer.js        #     纯前端情绪分析（由 nlp/ 移植，静态部署用）
│   │   ├── music-engine.js    #     Tone.js 乐句引擎 + 母带链
│   │   ├── visual-engine.js   #     Canvas 渲染调度
│   │   ├── particle.js        #     粒子类与效果预设
│   │   ├── effects.js         #     背景渐变 / 辉光 / 暗角等后处理
│   │   ├── socket.js / timeline.js / utils.js / main.js
│   └── audio/                 #   原创轻音乐背景床 (WAV) + playlist.json
├── data/custom_dict.txt       # 预留 jieba 自定义词典
├── tools/generate_audio_assets.py  # 重新生成音乐床的脚本
└── docs/                      # 详细文档（见下）
```

---

## 🌐 在线访问

👉 **https://yuz-ph-s-h.github.io/Emotion-Radio/**

---

## 🚀 本地运行（可选）

无需后端也能跑。先克隆仓库：

```bash
git clone https://github.com/yuz-Ph-S-H/Emotion-Radio.git
cd Emotion-Radio
```

然后任选一种方式在浏览器打开 `index.html`：

```bash
# 方式一：任意静态服务器（推荐，避免 file:// 下音频/资源跨域限制）
python -m http.server 8000
# 然后打开 http://127.0.0.1:8000

# 方式二：仍用 Flask（会自动加载根目录同一份 index.html）
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py                    # 打开 http://127.0.0.1:5000
```

> 方式一连 Python 都不需要装依赖；方式二适合想继续用 Flask 调试的场景。

> **Windows 用户**：可直接双击 `run.bat`（或运行 `./run.ps1`）。

### 使用
1. 进入页面后**先点击一下页面任意位置**（浏览器策略要求用户交互后才能播放音频）。
2. 在底部输入框输入文字，按回车。
3. 观察左上角情绪解析、画面粒子与音乐随情绪变化。
4. 可参考 `docs/提示词示例.md` 里的课堂演示句。

---

## ⚙️ 配置

`config.py`：

| 配置项 | 说明 |
| --- | --- |
| `NLP_MODE` | `"local"`（默认，离线免密钥）或 `"api"`（大语言模型增强） |
| `API_BASE_URL` / `API_MODEL` | 兼容 OpenAI 格式的服务（DeepSeek / 通义千问 / Moonshot / GLM 等） |
| `API_KEY` | **请用环境变量** `EMOTION_RADIO_API_KEY` 提供，切勿提交真实密钥 |
| `EXTERNAL_MUSIC_ENABLED` | 是否启用原创背景音乐床 |

切换到 API 方案（macOS/Linux 示例）：

```bash
export EMOTION_RADIO_API_KEY="sk-xxxxxx"
# 然后把 config.py 的 NLP_MODE 改为 "api"
```

---

## 🎵 重新生成音乐床（可选）

背景音乐床为本地程序化合成，可一键重新生成：

```bash
python tools/generate_audio_assets.py
```

会在 `static/audio/` 下重新生成 `calm_piano.wav` / `warm_guitar.wav` / `night_pad.wav` 及 `playlist.json`。

---

## 🧠 工作原理（简述）

```
文字 T
  │  jieba 分词 + SnowNLP + 意象词典 + 情绪关键词（三级融合）
  ▼
(效价 v, 唤醒度 a, 意象权重 W)
  │  情绪性格判定 + 连续参数映射
  ▼
音乐参数(调式/句式/配器/低通/和弦色彩…) + 视觉参数(色彩/粒子/速度…)
  │  Tone.js 乐句引擎 + 母带链   │  Canvas 粒子系统
  ▼                              ▼
       实时轻音乐                    全屏情绪可视化
```

完整数学推导（含 24 节公式）见 [`docs/数学推导说明.md`](docs/数学推导说明.md)。

---

## 📚 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/数学推导说明.md`](docs/数学推导说明.md) | 情绪变量、调式/音色/和弦/旋律/合成/粒子的完整数学推导 |
| [`docs/提示词示例.md`](docs/提示词示例.md) | 课堂展示用的提示词（含真实测得效果与讲解要点） |
| [`docs/项目实现文档.md`](docs/项目实现文档.md) | 详细实现文档 |
| [`docs/API权重与外部音乐说明.md`](docs/API权重与外部音乐说明.md) | API 权重生成与外部音乐机制说明 |
| [`docs/项目结果报告.md`](docs/项目结果报告.md) | 项目完成情况与优化记录 |

---

## 🛠️ 技术栈

- **后端**：Python · Flask · Flask-SocketIO · eventlet · jieba · SnowNLP
- **前端**：原生 JavaScript · Tone.js（程序化音乐）· Canvas 2D（粒子视觉）· Socket.IO

---

## 📄 许可证与声明

- 代码以 [MIT License](LICENSE) 开源（请在 LICENSE 中替换为你的版权署名）。
- `static/audio/` 下的音乐均由 `tools/generate_audio_assets.py` **程序化原创生成**，
  不含任何受版权保护或商用的音频片段，可自由使用。
- 若替换为自己的音频，请确保拥有相应授权。
