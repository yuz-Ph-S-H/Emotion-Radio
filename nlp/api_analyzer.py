"""
API增强方案 —— 使用大语言模型进行更精准的情绪与意象分析
兼容所有OpenAI格式接口：DeepSeek / 通义千问 / Moonshot / GLM 等
"""

import json
import requests
from config import API_BASE_URL, API_KEY, API_MODEL
from .emotion_model import compute_music_params, compute_visual_params

SYSTEM_PROMPT = """你是一个文本情绪分析引擎。给定一段中文文字，你需要输出严格的JSON格式分析结果，不要输出任何其他内容。

JSON格式要求：
{
    "valence": 0.0到1.0之间的浮点数, // 情感效价：0=极消极, 0.5=中性, 1=极积极
    "arousal": 0.0到1.0之间的浮点数, // 唤醒度/情感强度：0=极平静, 1=极激动
    "imageries": ["意象1", "意象2"], // 文字中包含的自然意象/场景关键词
    "imagery_weights": [
        {
            "word": "意象1",
            "weight": 0.0到1.0之间的浮点数,
            "instrument": "piano/strings/flute/guitar/synth_pad/celesta/bells/drums",
            "effect": "rain/snow/fire/stars/petals/leaves/wave/moonlight/sunlight/storm/sparkle/drift/fog/rainbow/wind/ripple/glow/aurora/smoke"
        }
    ], // 各意象权重，所有weight之和应接近1
    "dominant_emotion": "情绪标签",   // 主导情绪：喜悦/悲伤/愤怒/恐惧/平静/思念/孤独/温暖/希望/绝望
    "suggested_instrument": "乐器",   // 最适合的乐器：piano/strings/flute/guitar/synth_pad/celesta/bells
    "suggested_effects": ["效果1"]    // 建议的视觉效果：rain/snow/fire/stars/petals/leaves/wave/moonlight/sunlight/storm/sparkle/drift/fog/rainbow/wind/ripple/glow/aurora/smoke
}

注意：
- imageries只提取具体的自然/场景意象词（如雨、月、花、海），不要提取抽象情绪词
- imagery_weights要体现混合场景占比，例如“雨后彩虹和花园”可给雨0.25、彩虹0.35、花园0.40
- 仅输出JSON，不要加markdown代码块标记，不要加任何解释文字"""


class ApiAnalyzer:
    """基于大语言模型API的文本分析器"""

    def __init__(self):
        print(f"🌐 API分析器已初始化: {API_MODEL} @ {API_BASE_URL}")

    def analyze(self, text: str) -> dict:
        try:
            ai_result = self._call_api(text)
        except Exception as e:
            print(f"⚠️ API调用失败，回退到基础分析: {e}")
            ai_result = self._fallback_analyze(text)

        valence = ai_result.get("valence", 0.5)
        arousal = ai_result.get("arousal", 0.5)
        imageries = ai_result.get("imageries", [])
        if not imageries and isinstance(ai_result.get("imagery_weights"), list):
            imageries = [
                item.get("word")
                for item in ai_result.get("imagery_weights", [])
                if isinstance(item, dict) and item.get("word")
            ]
        weights = self._normalize_weights(ai_result, imageries)

        # 构造意象数据（用于compute_music/visual_params）
        matched = []
        for idx, img in enumerate(imageries):
            weighted = weights[idx] if idx < len(weights) else {"word": img, "weight": 0}
            effects = ai_result.get("suggested_effects", [])
            matched.append({
                "word": img,
                "weight": weighted.get("weight", 0),
                "instrument": weighted.get("instrument") or ai_result.get("suggested_instrument", "piano"),
                "effect": weighted.get("effect") or (effects[idx % len(effects)] if effects else "drift"),
                "arousal": arousal,
            })

        # 如果API返回了建议的视觉效果，直接使用
        suggested_effects = ai_result.get("suggested_effects", [])

        music = compute_music_params(valence, arousal, matched)
        visual = compute_visual_params(valence, arousal, matched)

        # 用API建议的效果覆盖默认效果
        if suggested_effects:
            visual["particle_effects"] = suggested_effects[:3]

        # 用API建议的乐器覆盖
        if ai_result.get("suggested_instrument"):
            music["instrument"] = ai_result["suggested_instrument"]
            music["instruments"] = [ai_result["suggested_instrument"]]

        return {
            "text": text,
            "valence": round(valence, 3),
            "arousal": round(arousal, 3),
            "imageries": imageries,
            "weights": weights,
            "music": music,
            "visual": visual,
        }

    def generate_weights(self, text: str) -> dict:
        try:
            ai_result = self._call_api(text)
        except Exception as e:
            print(f"⚠️ API权重生成失败: {e}")
            ai_result = self._fallback_analyze(text)
        imageries = ai_result.get("imageries", [])
        return {
            "text": text,
            "weights": self._normalize_weights(ai_result, imageries),
        }

    def _call_api(self, text: str) -> dict:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        }
        payload = {
            "model": API_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.3,
            "max_tokens": 300,
        }

        resp = requests.post(API_BASE_URL, headers=headers, json=payload, timeout=10)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()

        # 清理可能的markdown代码块标记
        content = content.replace("```json", "").replace("```", "").strip()

        return json.loads(content)

    def _fallback_analyze(self, text: str) -> dict:
        """API失败时的简单回退"""
        return {
            "valence": 0.5,
            "arousal": 0.5,
            "imageries": [],
            "dominant_emotion": "平静",
            "suggested_instrument": "piano",
            "suggested_effects": ["drift"],
        }

    def _normalize_weights(self, ai_result: dict, imageries: list) -> list:
        raw = ai_result.get("imagery_weights", [])
        items = []
        if isinstance(raw, dict):
            raw = [{"word": k, "weight": v} for k, v in raw.items()]

        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, str):
                    items.append({"word": item, "weight": 1})
                elif isinstance(item, dict) and item.get("word"):
                    items.append({
                        "word": item.get("word"),
                        "weight": float(item.get("weight", 0) or 0),
                        "instrument": item.get("instrument"),
                        "effect": item.get("effect"),
                    })

        if not items:
            base = imageries or []
            if not base:
                return []
            weight = 1 / len(base)
            return [{"word": word, "weight": round(weight, 3)} for word in base]

        order = {word: idx for idx, word in enumerate(imageries)}
        items.sort(key=lambda item: order.get(item["word"], 999))
        total = sum(max(0, item["weight"]) for item in items) or len(items)
        normalized = []
        for item in items:
            normalized.append({
                "word": item["word"],
                "weight": round(max(0, item["weight"]) / total, 3),
                "instrument": item.get("instrument"),
                "effect": item.get("effect"),
            })
        return normalized
