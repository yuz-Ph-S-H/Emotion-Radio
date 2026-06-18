/**
 * 通信层 —— 纯前端版。
 * 原实现通过 Socket.IO 把文本发往 Flask 后端分析；静态部署（GitHub Pages）没有后端，
 * 这里改为直接调用浏览器内的 Analyzer（static/js/analyzer.js）本地完成分析。
 * 对外接口（connect / sendText / generateWeights / onResult / onWeights）保持不变，
 * 因此 main.js 无需改动。
 */
const Socket = (() => {
    let onResultCallback = null;
    let onWeightsCallback = null;

    function connect() {
        // 纯前端：无需建立连接。保留方法以兼容 main.js 调用。
        console.log('✅ 本地分析就绪（无需后端）');
    }

    function sendText(text) {
        if (!text) return;
        // 异步派发，保持与原来“收到服务器回包”一致的事件式时序
        Promise.resolve().then(() => {
            const result = Analyzer.analyze(text);
            if (onResultCallback) onResultCallback(result);
        });
    }

    function generateWeights(text) {
        if (!text) return;
        Promise.resolve().then(() => {
            const result = Analyzer.generateWeights(text);
            if (onWeightsCallback) onWeightsCallback(result);
        });
    }

    function onResult(cb) { onResultCallback = cb; }
    function onWeights(cb) { onWeightsCallback = cb; }

    return { connect, sendText, generateWeights, onResult, onWeights };
})();
