"""
全局配置 —— 通过修改此文件切换NLP方案
"""

import os

# ========== NLP方案选择 ==========
# "local"  → 方案A：jieba + SnowNLP + 词典（免费离线）
# "api"    → 方案B：大语言模型API（更精准）
NLP_MODE = "local"

# ========== 方案B：API配置（仅当 NLP_MODE="api" 时生效）==========
# 支持任何兼容OpenAI接口格式的API（通义千问/DeepSeek/Moonshot/GLM等）
API_PROVIDER = "deepseek"       # 当前使用的API提供商名称（仅用于日志标识）

# --- DeepSeek（推荐，注册送500万token免费额度）---
API_BASE_URL = "https://api.deepseek.com/v1/chat/completions"
# 切勿把真实密钥提交到 Git！优先用环境变量 EMOTION_RADIO_API_KEY，
# 未设置时回退到占位符（本地方案 NLP_MODE="local" 不需要密钥）。
API_KEY = os.environ.get("EMOTION_RADIO_API_KEY", "sk-你的密钥")  # https://platform.deepseek.com 获取
API_MODEL = "deepseek-chat"

# --- 通义千问（阿里，有免费额度）---
# API_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
# API_KEY = "sk-你的密钥"        # https://dashscope.console.aliyun.com 获取
# API_MODEL = "qwen-turbo"

# --- Moonshot / Kimi（月之暗面，有免费额度）---
# API_BASE_URL = "https://api.moonshot.cn/v1/chat/completions"
# API_KEY = "sk-你的密钥"        # https://platform.moonshot.cn 获取
# API_MODEL = "moonshot-v1-8k"

# --- 智谱GLM（智谱AI，有免费额度）---
# API_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
# API_KEY = "你的密钥"           # https://open.bigmodel.cn 获取
# API_MODEL = "glm-4-flash"     # flash版本免费

# ========== Flask配置 ==========
HOST = "0.0.0.0"
PORT = 5000
DEBUG = True

# ========== 外部轻音乐配置 ==========
# 使用 static/audio/playlist.json 中的原创/免版权轻音乐文件作为低音量背景床。
EXTERNAL_MUSIC_ENABLED = True
