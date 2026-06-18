"""Generate original, warm, seamless light-music background beds for Emotion Radio.

设计目标（针对"粗糙难听"问题的工程优化）：
1. 谐波滚降合成：每个音由基频及其谐波叠加，振幅按 1/h^p 衰减，p 越大音色越柔。
2. 升余弦音头：旋律音用 raised-cosine 渐入代替硬切，消除每拍的"咔哒"爆音。
3. 微失谐合唱：每个声部叠加 2~3 个轻微失谐的振子，产生温暖的 chorus 宽度。
4. 一阶低通滤波：对整段缓冲做 RC 低通，削掉刺耳高频。
5. Schroeder 简易混响：梳状 + 全通滤波器制造空间尾音。
6. 无缝循环：渲染时多渲染一段尾巴并与开头交叉淡化，循环点不再"啪"地一跳。
7. 立体声宽度：左右声道使用不同 LFO 相位，画面更宽更耐听。

全部使用标准库（wave / math / struct），无需第三方依赖。
"""

from __future__ import annotations

import json
import math
import os
import struct
import wave


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(ROOT, "static", "audio")

SAMPLE_RATE = 32000          # 提高采样率，减少高频混叠
BODY_SECONDS = 20.0          # 主体循环长度
XFADE_SECONDS = 2.5          # 循环交叉淡化长度（尾巴与开头融合）
HARMONICS = 6                # 叠加谐波数
ROLLOFF = 1.7                # 谐波振幅滚降指数，越大越柔和


def midi_to_freq(midi: float) -> float:
    return 440.0 * (2 ** ((midi - 69) / 12))


def raised_cosine_attack(phase: float, attack: float) -> float:
    """音头升余弦渐入：phase∈[0,1) 为音内相对位置，attack 为渐入比例。"""
    if phase >= attack:
        return 1.0
    return 0.5 * (1.0 - math.cos(math.pi * phase / attack))


def harmonic_voice(freq: float, t: float, harmonics: int = HARMONICS, rolloff: float = ROLLOFF) -> float:
    """谐波滚降合成的单声部样本。"""
    s = 0.0
    for h in range(1, harmonics + 1):
        s += math.sin(2 * math.pi * freq * h * t) / (h ** rolloff)
    return s


def one_pole_lowpass(samples: list[float], cutoff: float) -> list[float]:
    """一阶 RC 低通：y[n] = y[n-1] + a*(x[n]-y[n-1])。"""
    dt = 1.0 / SAMPLE_RATE
    rc = 1.0 / (2 * math.pi * cutoff)
    a = dt / (rc + dt)
    out = [0.0] * len(samples)
    prev = 0.0
    for i, x in enumerate(samples):
        prev = prev + a * (x - prev)
        out[i] = prev
    return out


def comb(samples: list[float], delay_ms: float, gain: float) -> list[float]:
    """反馈梳状滤波器：y[n] = x[n] + g*y[n-D]。"""
    d = max(1, int(SAMPLE_RATE * delay_ms / 1000.0))
    out = list(samples)
    for i in range(d, len(out)):
        out[i] += gain * out[i - d]
    return out


def schroeder_reverb(samples: list[float], wet: float) -> list[float]:
    """几个并联梳状 + 串联全通的简化混响。"""
    combs = [(29.7, 0.62), (37.1, 0.58), (41.1, 0.55), (43.7, 0.52)]
    acc = [0.0] * len(samples)
    for delay_ms, gain in combs:
        c = comb(samples, delay_ms, gain)
        for i in range(len(acc)):
            acc[i] += c[i] / len(combs)
    # 串联两级全通（用梳状近似），柔化尾音
    acc = comb(acc, 5.0, 0.4)
    acc = comb(acc, 1.7, 0.3)
    return [(1 - wet) * dry + wet * rev for dry, rev in zip(samples, acc)]


def normalize(samples: list[float], peak: float = 0.82) -> list[float]:
    m = max((abs(s) for s in samples), default=1.0) or 1.0
    g = peak / m
    return [s * g for s in samples]


def render_channel(progression, melody, tempo, detune, lfo_phase):
    """渲染单声道浮点缓冲（含交叉淡化尾巴）。"""
    total_seconds = BODY_SECONDS + XFADE_SECONDS
    total = int(SAMPLE_RATE * total_seconds)
    beat = 60.0 / tempo
    chord_len = beat * 4
    melody_len = beat * 1.0

    buf = [0.0] * total
    for i in range(total):
        t = i / SAMPLE_RATE
        chord = progression[int(t / chord_len) % len(progression)]
        note = melody[int(t / melody_len) % len(melody)]

        # 缓慢颤音/呼吸 LFO，让长音不死板
        breath = 0.85 + 0.15 * math.sin(2 * math.pi * 0.06 * t + lfo_phase)

        sample = 0.0
        # 和声铺底：每个和弦音叠加轻微失谐合唱
        for n in chord:
            f = midi_to_freq(n)
            sample += harmonic_voice(f, t) * 0.085
            sample += harmonic_voice(f * detune, t) * 0.045
            sample += harmonic_voice(f * 2.0, t, harmonics=3) * 0.018

        # 旋律：升余弦音头 + 指数衰减，消除爆音
        phase = (t % melody_len) / melody_len
        atk = raised_cosine_attack(phase, 0.18)
        decay = math.exp(-3.0 * phase)
        mf = midi_to_freq(note)
        sample += harmonic_voice(mf, t, harmonics=5) * 0.10 * atk * decay
        sample += harmonic_voice(mf * detune, t, harmonics=3) * 0.04 * atk * decay

        # 高八度微光点缀
        shimmer = math.sin(2 * math.pi * midi_to_freq(note + 12) * t) * 0.012
        shimmer *= 0.5 + 0.5 * math.sin(2 * math.pi * 0.11 * t)

        buf[i] = (sample + shimmer) * breath

    return buf


def crossfade_loop(buf):
    """把尾巴 XFADE 段与开头交叉淡化，得到 BODY 长度的无缝循环。"""
    body = int(SAMPLE_RATE * BODY_SECONDS)
    xf = int(SAMPLE_RATE * XFADE_SECONDS)
    out = buf[:body]
    for i in range(xf):
        w = i / xf  # 0→1
        # 尾巴 buf[body+i] 淡入开头 out[i]
        out[i] = out[i] * (1 - w) + buf[body + i] * w if (body + i) < len(buf) else out[i]
    # 用平滑窗口再修一遍开头，防止细微突变
    return out


def make_track(name: str, progression, melody, tempo: float, detune: float, lp_cutoff: float, reverb_wet: float) -> None:
    left = render_channel(progression, melody, tempo, detune, lfo_phase=0.0)
    right = render_channel(progression, melody, tempo, detune * 1.0009, lfo_phase=1.3)

    left = crossfade_loop(left)
    right = crossfade_loop(right)

    left = one_pole_lowpass(left, lp_cutoff)
    right = one_pole_lowpass(right, lp_cutoff)

    left = schroeder_reverb(left, reverb_wet)
    right = schroeder_reverb(right, reverb_wet)

    left = normalize(left)
    right = normalize(right)

    path = os.path.join(AUDIO_DIR, f"{name}.wav")
    with wave.open(path, "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for l, r in zip(left, right):
            frames += struct.pack("<hh",
                                  int(max(-1.0, min(1.0, l)) * 32767),
                                  int(max(-1.0, min(1.0, r)) * 32767))
        wav.writeframes(bytes(frames))
    print(f"  ✓ {name}.wav  ({len(left)/SAMPLE_RATE:.1f}s stereo)")


def main() -> None:
    os.makedirs(AUDIO_DIR, exist_ok=True)
    print("🎵 生成轻音乐背景床（暖色谐波合成 + 低通 + 混响 + 无缝循环）...")

    # calm_piano：温柔、雨雾、水面、回忆 —— 较暗较慢
    make_track(
        "calm_piano",
        [[48, 55, 60, 64], [45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 55, 57]],
        [72, 71, 67, 69, 72, 74, 71, 67],
        tempo=60, detune=1.004, lp_cutoff=2600, reverb_wet=0.30,
    )

    # warm_guitar：明亮、阳光、花园、积极 —— 暖且稍快，大调色彩
    make_track(
        "warm_guitar",
        [[48, 55, 64, 67], [50, 57, 65, 69], [53, 60, 64, 69], [47, 55, 62, 67]],
        [72, 76, 79, 76, 74, 72, 71, 72],
        tempo=72, detune=1.005, lp_cutoff=3400, reverb_wet=0.24,
    )

    # night_pad：夜晚、星空、梦境、极光 —— 空旷、混响重、低音区
    make_track(
        "night_pad",
        [[45, 52, 57, 64], [43, 50, 55, 60], [41, 48, 55, 59], [38, 45, 52, 57]],
        [69, 72, 76, 72, 67, 69, 64, 67],
        tempo=54, detune=1.003, lp_cutoff=2200, reverb_wet=0.42,
    )

    playlist = {
        "enabled": True,
        "defaultVolume": 0.26,
        "tracks": [
            {"id": "calm_piano", "title": "Calm Piano Bed", "src": "static/audio/calm_piano.wav"},
            {"id": "warm_guitar", "title": "Warm Guitar Bed", "src": "static/audio/warm_guitar.wav"},
            {"id": "night_pad", "title": "Night Pad Bed", "src": "static/audio/night_pad.wav"},
        ],
    }
    with open(os.path.join(AUDIO_DIR, "playlist.json"), "w", encoding="utf-8") as f:
        json.dump(playlist, f, ensure_ascii=False, indent=2)
    print("✅ 完成。")


if __name__ == "__main__":
    main()
