from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from config import NLP_MODE, HOST, PORT

# 根据配置加载不同的分析器
if NLP_MODE == "api":
    from nlp.api_analyzer import ApiAnalyzer as Analyzer
    print("🌐 NLP模式: API增强方案")
else:
    from nlp.analyzer import LocalAnalyzer as Analyzer
    print("💻 NLP模式: 本地方案 (jieba + SnowNLP)")

app = Flask(__name__)
app.config["SECRET_KEY"] = "emotion-radio-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

analyzer = Analyzer()


@app.route("/")
def index():
    return render_template("index.html")


@socketio.on("analyze_text")
def handle_text(data):
    text = data.get("text", "").strip()
    if not text:
        return
    result = analyzer.analyze(text)
    emit("emotion_result", result)


@socketio.on("generate_weights")
def handle_weights(data):
    text = data.get("text", "").strip()
    if not text:
        return
    result = analyzer.generate_weights(text)
    emit("weight_result", result)


@socketio.on("connect")
def handle_connect():
    print("✅ 客户端已连接")


if __name__ == "__main__":
    socketio.run(
        app,
        host=HOST,
        port=PORT,
        debug=False,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
