# API 权重与外部轻音乐说明

## 外部轻音乐机制

项目现在支持外部轻音乐背景床。音频文件位于：

```text
static/audio/
```

当前内置三条本地原创轻音乐循环（32 kHz 立体声，暖色谐波合成 + 低通 + 混响 + 无缝循环）：

- `calm_piano.wav`：平静、雨、雾、水面、回忆场景。
- `warm_guitar.wav`：明亮、阳光、花园、积极场景。
- `night_pad.wav`：夜晚、星空、梦境、极光场景。

这些床由 `tools/generate_audio_assets.py` 生成，针对原始版本"逐拍爆音、循环点不连续、音色刺耳"的问题做了优化：升余弦音头消除咔哒声、一阶低通与 Schroeder 混响柔化音色、首尾交叉淡化保证无缝循环。如需重新生成（Windows）：

```powershell
.\venv\Scripts\python.exe -X utf8 tools\generate_audio_assets.py
```

其合成与情绪贴合的数学细节见 `数学推导说明.md` 第 16~22 节。

播放列表配置文件：

```text
static/audio/playlist.json
```

可替换为免版权或自制轻音乐文件，格式示例：

```json
{
  "enabled": true,
  "defaultVolume": 0.22,
  "tracks": [
    {
      "id": "calm_piano",
      "title": "Calm Piano Bed",
      "src": "/static/audio/calm_piano.wav"
    }
  ]
}
```

注意：不要直接放入热门歌曲、商用配乐或未经授权的音频片段。建议使用自制音频、课堂自录音、明确免版权授权音乐，或保留当前生成式原创音频。

## 后端音频选择字段

后端 `music` 参数现在会返回：

```json
{
  "audio_bed": "calm_piano",
  "instrument": "bells",
  "instruments": ["bells", "guitar", "piano"]
}
```

前端 `MusicEngine` 会根据 `audio_bed` 选择外部轻音乐，并在其上叠加实时生成旋律。

## API 权重生成目标

混合场景输入中，不同意象应占据不同权重。例如：

```text
雨停以后出现彩虹，阳光照进花园。
```

可生成：

```json
[
  {"word": "雨", "weight": 0.2},
  {"word": "彩虹", "weight": 0.35},
  {"word": "阳光", "weight": 0.25},
  {"word": "花园", "weight": 0.2}
]
```

权重会影响：

- 唤醒度加权计算。
- 主音色与辅助音色排序。
- 多个粒子效果的优先级。
- 混合场景的听觉和视觉主次关系。

## API 返回格式

API 模式的系统提示词已扩展，建议模型返回：

```json
{
  "valence": 0.78,
  "arousal": 0.52,
  "imageries": ["雨", "彩虹", "阳光", "花园"],
  "imagery_weights": [
    {
      "word": "雨",
      "weight": 0.2,
      "instrument": "piano",
      "effect": "rain"
    },
    {
      "word": "彩虹",
      "weight": 0.35,
      "instrument": "bells",
      "effect": "rainbow"
    }
  ],
  "dominant_emotion": "希望",
  "suggested_instrument": "bells",
  "suggested_effects": ["rain", "rainbow", "sunlight", "petals"]
}
```

系统会自动归一化权重，使总和接近 `1.0`。

## Python 调用方法

在 API 模式下：

```python
from nlp.api_analyzer import ApiAnalyzer

analyzer = ApiAnalyzer()
result = analyzer.generate_weights("雨停以后出现彩虹，阳光照进花园。")
print(result["weights"])
```

本地模式也有同名方法：

```python
from nlp.analyzer import LocalAnalyzer

analyzer = LocalAnalyzer()
result = analyzer.generate_weights("雨停以后出现彩虹，阳光照进花园。")
print(result["weights"])
```

## Socket.IO 调用方法

前端可直接调用：

```javascript
Socket.onWeights((data) => {
    console.log(data.weights);
});

Socket.generateWeights('雨停以后出现彩虹，阳光照进花园。');
```

对应服务端事件：

- 请求事件：`generate_weights`
- 返回事件：`weight_result`

该方法只返回权重，不会触发音乐和视觉更新，适合调试权重分配或做单独展示。
