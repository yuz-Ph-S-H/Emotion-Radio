import jieba
from snownlp import SnowNLP
from .imagery_dict import IMAGERY_DICT, EMOTION_KEYWORDS
from .emotion_model import compute_arousal, compute_music_params, compute_visual_params

class LocalAnalyzer:
    """本地文本情绪分析器（jieba + SnowNLP + 词典）"""

    # 意象效价融合参数（见数学推导说明 §3）
    SNOW_WEIGHT = 0.4          # SnowNLP 整体判断的权重
    IMAGERY_VALENCE_GAIN = 3.5 # 意象 valence_adj 放大系数

    def __init__(self):
        for word in IMAGERY_DICT:
            jieba.add_word(word)
        for word in EMOTION_KEYWORDS:
            jieba.add_word(word)
        print(f"📚 词典已加载: 意象词 {len(IMAGERY_DICT)} 条, 情绪词 {len(EMOTION_KEYWORDS)} 条")

    def analyze(self, text: str) -> dict:
        # 1. SnowNLP情感分析 → 效价valence
        snow = SnowNLP(text)
        valence = snow.sentiments

        # 2. jieba分词
        words = list(jieba.cut(text))

        # 3. 意象词典匹配：全文扫描，优先保留更长词，避免“星空”再重复命中“星”
        matched = self._match_imageries(text)
        weights = self._weight_imageries(matched)
        weight_map = {item["word"]: item["weight"] for item in weights}
        for img in matched:
            img["weight"] = weight_map.get(img["word"], 0)

        # 4. 意象效价先验：把词典 valence_adj 按权重加权放大，与 SnowNLP 融合。
        #    SnowNLP 对中文常整体偏高，意象是更可靠的具体情感信号，故以意象为主。
        valence = self._blend_imagery_valence(valence, matched)

        # 5. 情绪关键词修正：在融合之后施加，保留"孤独/悲伤/喜悦"等强情感词的完整力度
        for w in words:
            if w in EMOTION_KEYWORDS:
                valence = max(0, min(1, valence + EMOTION_KEYWORDS[w]))

        # 6. 计算唤醒度
        arousal = compute_arousal(text, words, matched)

        # 6~7. 生成音乐/视觉参数
        music = compute_music_params(valence, arousal, matched)
        visual = compute_visual_params(valence, arousal, matched)

        return {
            "text": text,
            "valence": round(valence, 3),
            "arousal": round(arousal, 3),
            "imageries": [m["word"] for m in matched],
            "weights": weights,
            "music": music,
            "visual": visual,
        }

    def _blend_imagery_valence(self, valence: float, matched: list) -> float:
        """用意象效价先验修正 SnowNLP 效价，使音乐更贴合场景情感。"""
        if not matched:
            return max(0.0, min(1.0, valence))
        wsum = sum(img.get("weight", 0) for img in matched)
        if wsum > 0:
            adj = sum(img.get("weight", 0) * img.get("valence_adj", 0) for img in matched) / wsum
        else:
            adj = sum(img.get("valence_adj", 0) for img in matched) / len(matched)
        v_img = max(0.0, min(1.0, 0.5 + self.IMAGERY_VALENCE_GAIN * adj))
        v = self.SNOW_WEIGHT * valence + (1 - self.SNOW_WEIGHT) * v_img
        return max(0.0, min(1.0, v))

    def _match_imageries(self, text: str) -> list:
        spans = []
        for word in sorted(IMAGERY_DICT, key=len, reverse=True):
            start = text.find(word)
            while start != -1:
                end = start + len(word)
                if not any(start < s["end"] and end > s["start"] for s in spans):
                    spans.append({
                        "start": start,
                        "end": end,
                        "word": word,
                        **IMAGERY_DICT[word],
                    })
                start = text.find(word, start + 1)
        spans.sort(key=lambda item: item["start"])
        return [{k: v for k, v in item.items() if k not in ("start", "end")} for item in spans]

    def generate_weights(self, text: str) -> dict:
        matched = self._match_imageries(text)
        return {
            "text": text,
            "weights": self._weight_imageries(matched),
        }

    def _weight_imageries(self, imageries: list) -> list:
        if not imageries:
            return []
        raw = []
        for idx, img in enumerate(imageries):
            score = img.get("arousal", 0.5) + max(0, 12 - idx) * 0.02
            raw.append((img["word"], score))
        total = sum(score for _, score in raw) or 1
        return [
            {"word": word, "weight": round(score / total, 3)}
            for word, score in raw
        ]
