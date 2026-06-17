const Socket = (() => {
    let socket = null;
    let onResultCallback = null;
    let onWeightsCallback = null;

    function connect() {
        socket = io();
        socket.on('connect', () => console.log('✅ 已连接'));
        socket.on('disconnect', () => console.log('❌ 断开'));
        socket.on('emotion_result', (data) => {
            if (onResultCallback) onResultCallback(data);
        });
        socket.on('weight_result', (data) => {
            if (onWeightsCallback) onWeightsCallback(data);
        });
    }

    function sendText(text) {
        if (socket && socket.connected) {
            socket.emit('analyze_text', { text });
        }
    }

    function generateWeights(text) {
        if (socket && socket.connected) {
            socket.emit('generate_weights', { text });
        }
    }

    function onResult(cb) { onResultCallback = cb; }
    function onWeights(cb) { onWeightsCallback = cb; }

    return { connect, sendText, generateWeights, onResult, onWeights };
})();
