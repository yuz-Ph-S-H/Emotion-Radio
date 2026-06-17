/**
 * 增强版粒子类 —— 支持拖尾、发光、多形态
 */
class Particle {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.vx = config.vx + (Math.random() - 0.5) * (config.randomness || 1);
        this.vy = config.vy + (Math.random() - 0.5) * (config.randomness || 1);
        this.life = config.life || 100;
        this.maxLife = this.life;
        this.color = config.color || '#ffffff';
        this.size = config.size || 3;
        this.shape = config.shape || 'circle';
        this.gravity = config.gravity || 0;
        this.friction = config.friction || 1;
        this.opacity = 1;
        this.baseOpacity = config.opacity || 1;
        this.depth = config.depth || (0.75 + Math.random() * 0.5);
        this.size *= this.depth;
        this.vx *= this.depth;
        this.vy *= this.depth;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.trail = config.trail || false;     // 是否有拖尾
        this.glowSize = config.glowSize || 0;   // 发光半径倍数
        this.history = [];                       // 拖尾位置历史
        // 微闪烁：让星光/萤火/微粒有呼吸般的明灭，更有灵气
        this.twinkle = config.twinkle || 0;
        this.twinklePhase = Math.random() * Math.PI * 2;
        this.twinkleSpeed = 0.04 + Math.random() * 0.06;
    }

    update() {
        // 拖尾记录
        if (this.trail && this.life % 2 === 0) {
            this.history.push({ x: this.x, y: this.y });
            if (this.history.length > 8) this.history.shift();
        }

        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        const age = 1 - Math.max(0, this.life / this.maxLife);
        const fadeIn = Math.min(1, age * 5);
        const fadeOut = Math.max(0, this.life / this.maxLife);
        let twk = 1;
        if (this.twinkle) {
            this.twinklePhase += this.twinkleSpeed;
            twk = 1 - this.twinkle * (0.5 + 0.5 * Math.sin(this.twinklePhase));
        }
        this.opacity = fadeIn * fadeOut * this.baseOpacity * twk;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        if (this.shape !== 'raindrop') ctx.globalCompositeOperation = 'lighter';

        const rgb = hexToRgb(this.color);

        // 拖尾绘制
        if (this.trail && this.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let i = 1; i < this.history.length; i++) {
                ctx.lineTo(this.history[i].x, this.history[i].y);
            }
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.3})`;
            ctx.lineWidth = this.size * 0.5;
            ctx.stroke();
        }

        // 外发光
        if (this.glowSize > 0) {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.size * this.glowSize
            );
            gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.42})`);
            gradient.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.15})`);
            gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 主形态
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        switch (this.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'raindrop':
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size * 0.4, this.size * 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'snowflake':
                ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity})`;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.6})`;
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * this.size * 2.5, Math.sin(angle) * this.size * 2.5);
                    ctx.stroke();
                }
                break;

            case 'petal':
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 1.5);
                ctx.bezierCurveTo(
                    this.size * 1.2, -this.size * 0.5,
                    this.size * 1.2,  this.size * 0.5,
                    0, this.size * 1.5
                );
                ctx.bezierCurveTo(
                    -this.size * 1.2,  this.size * 0.5,
                    -this.size * 1.2, -this.size * 0.5,
                    0, -this.size * 1.5
                );
                ctx.fill();
                break;

            case 'leaf':
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 2);
                ctx.bezierCurveTo(
                    this.size * 1.5, -this.size,
                    this.size * 1.5,  this.size,
                    0, this.size * 2
                );
                ctx.bezierCurveTo(
                    -this.size * 1.5,  this.size,
                    -this.size * 1.5, -this.size,
                    0, -this.size * 2
                );
                ctx.fill();
                // 叶脉
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.3})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 1.8);
                ctx.lineTo(0, this.size * 1.8);
                ctx.stroke();
                break;

            case 'star':
                this._drawStar(ctx, 5, this.size, this.size * 0.4);
                break;

            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 1.5);
                ctx.lineTo(this.size, 0);
                ctx.lineTo(0, this.size * 1.5);
                ctx.lineTo(-this.size, 0);
                ctx.closePath();
                ctx.fill();
                break;

            case 'spark':
                // 核心点
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                // 十字光芒
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${this.opacity * 0.5})`;
                ctx.lineWidth = this.size * 0.3;
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 2);
                ctx.lineTo(0, this.size * 2);
                ctx.moveTo(-this.size * 2, 0);
                ctx.lineTo(this.size * 2, 0);
                ctx.stroke();
                break;

            default:
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
        }

        ctx.restore();
    }

    _drawStar(ctx, spikes, outerR, innerR) {
        let rot = -Math.PI / 2;
        const step = Math.PI / spikes;
        ctx.beginPath();
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(Math.cos(rot) * outerR, Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(Math.cos(rot) * innerR, Math.sin(rot) * innerR);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();
    }

    isDead() { return this.life <= 0; }
}


/* ========== 粒子效果预设（增强版）========== */
const EFFECT_PRESETS = {
    // --- 雨系 ---
    rain:       { shape: 'raindrop', spawnArea: 'top', vy: 8, vx: -1.2, color: '#6f95d8', size: 1.8, life: 90, rate: 4.2, randomness: 0.5, gravity: 0.07, trail: true, glowSize: 0, opacity: 0.78 },
    heavy_rain: { shape: 'raindrop', spawnArea: 'top', vy: 12, vx: -2.4, color: '#5572bd', size: 2.2, life: 58, rate: 11, randomness: 1, gravity: 0.11, trail: true, glowSize: 0, opacity: 0.72 },
    light_rain: { shape: 'raindrop', spawnArea: 'top', vy: 3.6, vx: -0.4, color: '#9dbbe8', size: 1.35, life: 140, rate: 1.7, randomness: 0.3, gravity: 0.025, trail: false, glowSize: 0, opacity: 0.65 },

    // --- 雪系 ---
    snow:       { shape: 'snowflake', spawnArea: 'top', vy: 0.8, vx: 0, color: '#e8e8ff', size: 2.5, life: 250, rate: 1.8, randomness: 1.5, gravity: 0, glowSize: 3 },
    heavy_snow: { shape: 'snowflake', spawnArea: 'top', vy: 1.2, vx: 0, color: '#d0d0f0', size: 3.5, life: 200, rate: 4, randomness: 2, gravity: 0, glowSize: 2 },

    // --- 风系 ---
    wind:       { shape: 'circle', spawnArea: 'left', vy: 0, vx: 7, color: '#a8c8c8', size: 1.2, life: 60, rate: 4, randomness: 2, gravity: 0, trail: true, glowSize: 0 },
    breeze:     { shape: 'circle', spawnArea: 'left', vy: 0, vx: 2.5, color: '#c8e8d8', size: 1, life: 110, rate: 1.2, randomness: 1.2, gravity: 0, trail: false, glowSize: 2 },
    storm:      { shape: 'raindrop', spawnArea: 'top', vy: 16, vx: -6, color: '#3344aa', size: 2, life: 35, rate: 18, randomness: 4, gravity: 0.2, trail: true, glowSize: 0 },

    // --- 火系 ---
    fire:       { shape: 'circle', spawnArea: 'bottom', vy: -4, vx: 0, color: '#ff4400', size: 4, life: 55, rate: 7, randomness: 2.5, gravity: -0.06, glowSize: 5, multiColor: ['#ff2200','#ff4400','#ff6600','#ffaa00','#ffcc00'] },
    firework:   { shape: 'spark', spawnArea: 'center_burst', vy: 0, vx: 0, color: '#ff69b4', size: 3, life: 50, rate: 0, randomness: 8, gravity: 0.03, trail: true, glowSize: 4, multiColor: ['#ff0066','#ff69b4','#ffaa00','#00ffcc','#6644ff','#ff4444'] },
    candle:     { shape: 'circle', spawnArea: 'center', vy: -1.8, vx: 0, color: '#ffd700', size: 3, life: 40, rate: 2.5, randomness: 0.6, gravity: -0.03, glowSize: 6 },

    // --- 闪电 ---
    lightning:  { shape: 'spark', spawnArea: 'top', vy: 20, vx: 0, color: '#ffffff', size: 2, life: 8, rate: 0.15, randomness: 15, gravity: 0, glowSize: 10, multiColor: ['#ffffff','#eeeeff','#aaaaff'] },

    // --- 花与叶 ---
    petals:     { shape: 'petal', spawnArea: 'top', vy: 1.2, vx: 1.5, color: '#ffb6c1', size: 4, life: 180, rate: 1.5, randomness: 2, gravity: 0.005, glowSize: 0, multiColor: ['#ffb6c1','#ffb7c5','#ffc0cb','#ff99aa','#ffddee'] },
    leaves:     { shape: 'leaf', spawnArea: 'top', vy: 0.8, vx: 1, color: '#d2691e', size: 4.5, life: 200, rate: 1, randomness: 2, gravity: 0.008, glowSize: 0, multiColor: ['#d2691e','#daa520','#b8860b','#cd853f','#8b4513'] },

    // --- 星/光/闪 ---
    stars:      { shape: 'star', spawnArea: 'random', vy: 0, vx: 0, color: '#ffe68a', size: 1.8, life: 190, rate: 0.45, randomness: 0, gravity: 0, glowSize: 7, opacity: 0.82, twinkle: 0.6 },
    sparkle:    { shape: 'diamond', spawnArea: 'random', vy: -0.25, vx: 0, color: '#ffd700', size: 2.5, life: 56, rate: 2.8, randomness: 3, gravity: 0, glowSize: 5, opacity: 0.78, twinkle: 0.5, multiColor: ['#ffd700','#fffacd','#ffffff'] },
    glow:       { shape: 'circle', spawnArea: 'center', vy: -0.4, vx: 0, color: '#fffacd', size: 5, life: 120, rate: 1, randomness: 2.5, gravity: 0, glowSize: 8, twinkle: 0.35 },
    burst:      { shape: 'spark', spawnArea: 'center', vy: 0, vx: 0, color: '#ffd700', size: 3.5, life: 45, rate: 8, randomness: 6, gravity: 0, trail: true, glowSize: 5 },
    shooting_star: { shape: 'circle', spawnArea: 'top_right', vy: 4, vx: -6, color: '#fffacd', size: 2, life: 40, rate: 0.1, randomness: 1, gravity: 0, trail: true, glowSize: 6 },

    // --- 水系 ---
    wave:       { shape: 'circle', spawnArea: 'bottom_wave', vy: -1.2, vx: 0, color: '#1e90ff', size: 3, life: 70, rate: 3, randomness: 1.5, gravity: 0.015, glowSize: 3 },
    ripple:     { shape: 'circle', spawnArea: 'center', vy: 0, vx: 0, color: '#5f9ea0', size: 2, life: 90, rate: 2, randomness: 4, gravity: 0, glowSize: 4 },
    flow:       { shape: 'circle', spawnArea: 'left', vy: 0, vx: 2.5, color: '#5b9bd5', size: 2.5, life: 130, rate: 2, randomness: 1.5, gravity: 0.008, glowSize: 2 },

    // --- 天象 ---
    sunlight:   { shape: 'diamond', spawnArea: 'top', vy: 1.6, vx: 0, color: '#ffd700', size: 2.3, life: 110, rate: 1.55, randomness: 2, gravity: 0.008, glowSize: 7, opacity: 0.78, multiColor: ['#ffd700','#ffcc00','#ffe44d'] },
    sunrise:    { shape: 'circle', spawnArea: 'bottom_center', vy: -1.5, vx: 0, color: '#ff4500', size: 4, life: 100, rate: 3, randomness: 3, gravity: 0, glowSize: 6, multiColor: ['#ff4500','#ff6347','#ffa500','#ffd700'] },
    sunset:     { shape: 'circle', spawnArea: 'bottom', vy: -0.6, vx: 0, color: '#ff6347', size: 3.5, life: 130, rate: 2, randomness: 2, gravity: 0, glowSize: 5, multiColor: ['#ff6347','#cd853f','#daa520','#9370db'] },
    moonlight:  { shape: 'circle', spawnArea: 'top_center', vy: 0.4, vx: 0, color: '#fffacd', size: 2, life: 180, rate: 0.8, randomness: 2.5, gravity: 0, glowSize: 8 },
    rainbow:    { shape: 'diamond', spawnArea: 'top', vy: 0.35, vx: 0, color: '#ff69b4', size: 2.7, life: 145, rate: 2.2, randomness: 4, glowSize: 5, opacity: 0.78, multiColor: ['#ff4444','#ff8800','#ffdd00','#44ff44','#4488ff','#8844ff','#ff44ff'] },
    clouds:     { shape: 'circle', spawnArea: 'top', vy: 0, vx: 0.3, color: '#d3d3e8', size: 25, life: 350, rate: 0.15, randomness: 0.2, gravity: 0, glowSize: 2 },

    // --- 烟/雾/尘 ---
    fog:        { shape: 'circle', spawnArea: 'random', vy: 0, vx: 0.25, color: '#b8b8c8', size: 20, life: 300, rate: 0.25, randomness: 0.3, gravity: 0, glowSize: 3 },
    smoke:      { shape: 'circle', spawnArea: 'bottom', vy: -0.8, vx: 0, color: '#888899', size: 12, life: 200, rate: 0.5, randomness: 1, gravity: -0.005, glowSize: 3 },
    dust:       { shape: 'circle', spawnArea: 'random', vy: 0.1, vx: 0.6, color: '#edc9af', size: 1.5, life: 220, rate: 1, randomness: 0.5, gravity: 0, glowSize: 2 },

    // --- 暗系 ---
    darkness:   { shape: 'circle', spawnArea: 'random', vy: 0.08, vx: 0, color: '#1a1a3e', size: 12, life: 250, rate: 0.3, randomness: 0.5, gravity: 0, glowSize: 4 },

    // --- 特殊效果 ---
    aurora:     { shape: 'circle', spawnArea: 'top', vy: 0.25, vx: 0, color: '#00ff88', size: 7, life: 240, rate: 0.7, randomness: 3.5, gravity: 0, glowSize: 12, opacity: 0.6, multiColor: ['#00ff88','#00ccff','#8844ff','#ff44ff','#00ffcc'] },
    firefly:    { shape: 'circle', spawnArea: 'random', vy: 0, vx: 0, color: '#ccff00', size: 2, life: 120, rate: 0.5, randomness: 0.3, gravity: 0, glowSize: 8, twinkle: 0.7 },
    drift:      { shape: 'circle', spawnArea: 'random', vy: 0.15, vx: 0.25, color: '#8888aa', size: 2, life: 220, rate: 0.8, randomness: 0.5, gravity: 0, glowSize: 3 },
    float:      { shape: 'circle', spawnArea: 'random', vy: -0.25, vx: 0, color: '#ffffff', size: 2, life: 180, rate: 1, randomness: 0.6, gravity: 0, glowSize: 4 },
};
