"""将原始情感分析结果转化为音乐/视觉引擎可用的参数"""


def compute_arousal(text: str, words: list, imageries: list) -> float:
    arousal = 0.5
    arousal += text.count("！") * 0.08 + text.count("!") * 0.08
    arousal += text.count("？") * 0.05 + text.count("?") * 0.05
    arousal -= text.count("…") * 0.05 + text.count("...") * 0.05

    if imageries:
        weight_total = sum(img.get("weight", 0) for img in imageries)
        if weight_total > 0:
            avg = sum(img.get("arousal", 0.5) * img.get("weight", 0) for img in imageries) / weight_total
        else:
            avg = sum(img.get("arousal", 0.5) for img in imageries) / len(imageries)
        arousal = arousal * 0.4 + avg * 0.6

    if len(text) < 6:
        arousal += 0.1

    return max(0.0, min(1.0, arousal))


def _clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


# 每种情绪对应一套"音乐性格"，用于拉开各场景听感对比（见数学推导说明 §23）
MOOD_PROFILES = {
    # mood:        旋律句式      声部上限 鼓点   点缀   速度系数  力度系数
    "tense":     {"phrase": "driving", "voices": 3, "drums": True,  "accent": False, "tempo_k": 1.12, "vel_k": 1.15},
    "melancholy":{"phrase": "lament",  "voices": 2, "drums": False, "accent": False, "tempo_k": 0.86, "vel_k": 0.82},
    "calm":      {"phrase": "flow",    "voices": 2, "drums": False, "accent": False, "tempo_k": 0.90, "vel_k": 0.85},
    "tender":    {"phrase": "song",    "voices": 2, "drums": False, "accent": True,  "tempo_k": 1.00, "vel_k": 1.00},
    "joyful":    {"phrase": "dance",   "voices": 3, "drums": True,  "accent": True,  "tempo_k": 1.10, "vel_k": 1.08},
    "dreamy":    {"phrase": "float",   "voices": 3, "drums": False, "accent": True,  "tempo_k": 0.84, "vel_k": 0.80},
}

_SPACIOUS = {"星空", "星星", "银河", "宇宙", "太空", "苍穹", "天空", "大海", "海",
             "远方", "旷野", "极光", "梦境", "梦", "月", "月光", "深渊", "苍穹"}


def _classify_mood(valence: float, arousal: float, imageries: list) -> str:
    words = {img.get("word") for img in imageries}
    spacious = bool(words & _SPACIOUS)
    if valence < 0.42 and arousal > 0.55:
        return "tense"
    if valence < 0.46:
        return "melancholy"
    if spacious and valence >= 0.55 and arousal < 0.6:
        return "dreamy"
    if arousal < 0.40 and valence < 0.66:
        return "calm"
    if valence >= 0.62 and arousal >= 0.48:
        return "joyful"
    return "tender"


def compute_music_params(valence: float, arousal: float, imageries: list) -> dict:
    # 调式
    if valence > 0.65:
        scale, root = "pentatonic_major", "C"
    elif valence > 0.45:
        scale, root = "major", "F"
    elif valence > 0.3:
        scale, root = "pentatonic_minor", "A"
    else:
        scale, root = "minor", "D"

    # 情绪性格：决定句式、声部数量、是否用鼓、速度与力度修正，拉开场景对比
    mood = _classify_mood(valence, arousal, imageries)
    profile = MOOD_PROFILES[mood]

    # 速度：基础映射再乘以性格系数（忧伤更慢、紧张/欢快更快）
    tempo = int((56 + arousal * 64) * profile["tempo_k"])

    # 乐器：按性格限制声部数量，避免"所有场景都用全部乐器"
    instruments = _instruments(imageries)[: profile["voices"]]
    instrument = instruments[0]

    # 混响
    reverb = 0.3
    spacious = {"星空", "大海", "宇宙", "远方", "天空", "旷野", "沙漠", "深渊", "月", "海", "太空", "银河", "苍穹"}
    for img in imageries:
        if img.get("word") in spacious:
            reverb = 0.8
            break

    velocity = _clip((0.24 + arousal * 0.46) * profile["vel_k"], 0.12, 0.9)
    octave = 5 if arousal > 0.7 else (3 if arousal < 0.3 else 4)
    density = 0.16 + arousal * 0.38

    # ===== 情绪贴合优化（连续映射，见数学推导说明 §16~§19）=====
    # 1. 明度（brightness）：效价主导、唤醒度辅助的连续量，统一驱动音色亮度
    brightness = _clip(0.18 + 0.62 * valence + 0.20 * arousal)

    # 2. 主低通截止频率（Hz）：用指数感知映射，消极/低能量→暖暗，积极/高能量→通透
    #    cutoff = 500 * 2^(1 + 3*brightness) → 约 1000Hz(暗) ~ 8000Hz(亮)
    filter_cutoff = int(round(500 * (2 ** (1.0 + 3.0 * brightness))))

    # 3. 和弦色彩：中高效价加大七/九度增色，低效价保持朴素三和弦
    seventh = 0.34 < valence < 0.82 or arousal < 0.32
    ninth = valence > 0.6

    # 4. 旋律走向偏置 contour∈[-1,1]：积极情绪倾向上行，消极倾向下行
    contour = round(_clip((valence - 0.5) * 2.0, -1.0, 1.0), 3)

    # 5. 旋律步幅：低唤醒度走得更平稳（小步进），高唤醒度允许更大跳进
    step_size = round(1.0 + arousal * 2.0, 2)

    # 6. 包络音头：低唤醒度更柔（长 attack），高唤醒度更清晰（短 attack）
    attack = round(0.5 - arousal * 0.42, 3)

    return {
        "scale": scale, "root": root, "tempo": tempo,
        "instrument": instrument, "instruments": instruments,
        "audio_bed": _audio_bed(valence, arousal, imageries),
        "reverb": round(reverb, 2),
        "velocity": round(velocity, 2), "octave": octave,
        "density": round(density, 2),
        "brightness": round(brightness, 3),
        "filter_cutoff": filter_cutoff,
        "seventh": bool(seventh), "ninth": bool(ninth),
        "contour": contour, "step_size": step_size, "attack": attack,
        "mood": mood,
        "phrase_style": profile["phrase"],
        "use_drums": profile["drums"],
        "accent": profile["accent"],
        "max_voices": profile["voices"],
    }


def compute_visual_params(valence: float, arousal: float, imageries: list) -> dict:
    # 背景HSL
    if valence > 0.6:
        h = 30 + valence * 30
    elif valence > 0.4:
        h = 260 - valence * 60
    else:
        h = 210 + (1 - valence) * 30
    s = 30 + arousal * 40
    l = 6 + valence * 12

    # 粒子效果：按权重降序，最多保留 2 种，避免画面杂乱（主效果 + 次效果）
    effects = []
    for img in sorted(imageries, key=lambda item: item.get("weight", 0), reverse=True):
        eff = img.get("effect")
        if eff and eff not in effects:
            effects.append(eff)
    effects = effects[:2]
    if not effects:
        if valence > 0.6 and arousal > 0.5:
            effects = ["sparkle"]
        elif valence > 0.6:
            effects = ["float"]
        elif valence < 0.4 and arousal > 0.5:
            effects = ["storm"]
        else:
            effects = ["drift"]

    # 收敛运动强度与数量，画面更克制干净
    speed = 0.28 + arousal * 0.92
    count = int(20 + arousal * 80)
    palette = _palette(valence, arousal, imageries)
    glow = 0.2 + arousal * 0.5
    transition = 3.2 - arousal * 1.8

    return {
        "background": {"h": round(h), "s": round(s), "l": round(l)},
        "particle_effects": effects,
        "particle_speed": round(speed, 2),
        "particle_count": count,
        "color_palette": palette,
        "glow_intensity": round(glow, 2),
        "transition_duration": round(transition, 1),
    }


def _palette(valence, arousal, imageries):
    from_img = [img["color"] for img in imageries if "color" in img]
    if len(from_img) >= 3:
        return from_img[:3]
    if valence > 0.7:
        base = ["#FFD700", "#FFA07A", "#FFFACD"]
    elif valence > 0.5:
        base = ["#87CEEB", "#98FB98", "#DDA0DD"]
    elif valence > 0.3:
        base = ["#6A5ACD", "#708090", "#B0C4DE"]
    else:
        base = ["#2F4F4F", "#483D8B", "#191970"]
    for i, c in enumerate(from_img):
        if i < 3:
            base[i] = c
    return base


def _instruments(imageries):
    weighted = []
    for idx, img in enumerate(imageries):
        inst = img.get("instrument")
        if not inst:
            continue
        score = img.get("arousal", 0.5) + img.get("weight", 0) * 0.7 + max(0, 12 - idx) * 0.01
        weighted.append((score, idx, inst))

    if not weighted:
        return ["piano"]

    best = {}
    for score, idx, inst in weighted:
        if inst not in best or score > best[inst][0]:
            best[inst] = (score, idx)

    ordered = sorted(best.items(), key=lambda item: (-item[1][0], item[1][1]))
    instruments = [inst for inst, _ in ordered[:4]]
    return instruments or ["piano"]


def _audio_bed(valence, arousal, imageries):
    words = {img.get("word") for img in imageries}
    if words & {"夜", "夜晚", "深夜", "星空", "星星", "月", "月光", "梦", "梦境", "极光"}:
        return "night_pad"
    if words & {"雨", "小雨", "细雨", "湖", "湖面", "小溪", "薄雾", "晨雾", "回忆"}:
        return "calm_piano"
    if valence > 0.58:
        return "warm_guitar"
    if arousal < 0.35:
        return "calm_piano"
    return "night_pad"
