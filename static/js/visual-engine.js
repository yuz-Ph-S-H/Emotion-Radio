/**
 * 增强版视觉引擎
 * 管理Canvas渲染、背景渐变、粒子生成、后处理效果
 */
const VisualEngine = (() => {
    let canvas, ctx;
    let width, height;
    let particles = [];
    let activeEffects = [];
    let frameCounter = 0;

    // 当前/目标状态（平滑过渡）
    let currentBg = { h: 230, s: 20, l: 8 };
    let targetBg  = { h: 230, s: 20, l: 8 };
    let currentGlow = 0.2;
    let targetGlow = 0.2;
    let currentSpeed = 1.0;
    let targetSpeed = 1.0;
    let currentPalette = ['#555577', '#333355', '#222244'];

    function init() {
        canvas = document.getElementById('visual-canvas');
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
        animate();
    }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    function updateParams(vp) {
        targetBg = vp.background;
        targetGlow = vp.glow_intensity;
        targetSpeed = vp.particle_speed;
        currentPalette = vp.color_palette;

        // 最多 2 个效果：主效果保持原速率，次效果降到 45%，避免画面杂乱
        activeEffects = vp.particle_effects.slice(0, 2).map((name, i) => {
            const preset = EFFECT_PRESETS[name];
            if (!preset) return null;
            return { name, ...preset, rate: preset.rate * (i === 0 ? 1 : 0.45) };
        }).filter(Boolean);

        // 烟花效果：立即爆发一次
        if (vp.particle_effects.includes('firework')) {
            burstFirework();
        }
    }

    function burstFirework() {
        const cx = width * (0.3 + Math.random() * 0.4);
        const cy = height * (0.2 + Math.random() * 0.3);
        const colors = ['#ff0066','#ff69b4','#ffaa00','#00ffcc','#6644ff','#ffffff'];
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 / 60) * i;
            const speed = 3 + Math.random() * 4;
            particles.push(new Particle(cx, cy, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: randomChoice(colors),
                size: 2 + Math.random() * 2,
                shape: 'spark',
                life: 40 + Math.random() * 30,
                randomness: 0.5,
                gravity: 0.04,
                trail: true,
                glowSize: 5,
            }));
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        frameCounter++;

        // 平滑过渡
        const t = 0.02;
        currentBg.h += (targetBg.h - currentBg.h) * t;
        currentBg.s += (targetBg.s - currentBg.s) * t;
        currentBg.l += (targetBg.l - currentBg.l) * t;
        currentGlow += (targetGlow - currentGlow) * t;
        currentSpeed += (targetSpeed - currentSpeed) * 0.05;

        // === 绘制 ===

        // 1. 背景（渐变叠加，产生拖尾效果）
        Effects.drawBackground(ctx, width, height, currentBg, 0.1);

        // 2. 生成粒子
        for (const effect of activeEffects) {
            const adjustedRate = effect.rate * currentSpeed;
            const count = Math.floor(adjustedRate);
            const rem = adjustedRate - count;
            for (let i = 0; i < count; i++) spawnParticle(effect);
            if (Math.random() < rem) spawnParticle(effect);
        }

        // 3. 更新 & 绘制粒子
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw(ctx);
            if (p.isDead() || p.x < -80 || p.x > width + 80 ||
                p.y < -80 || p.y > height + 80) {
                particles.splice(i, 1);
            }
        }

        // 4. 后处理效果
        Effects.drawColorVeils(ctx, width, height, currentPalette, currentGlow);
        Effects.drawBloom(ctx, width, height, currentGlow);
        Effects.drawAmbientGlow(ctx, width, height, currentPalette, currentGlow);
        Effects.drawGrain(ctx, width, height, frameCounter);
        Effects.drawVignette(ctx, width, height);

        // 5. 粒子数量限制（更克制，避免画面拥挤）
        if (particles.length > 480) particles.splice(0, particles.length - 480);
    }

    function spawnParticle(effect) {
        let x, y;
        switch (effect.spawnArea) {
            case 'top':           x = Math.random() * width; y = -15; break;
            case 'top_center':    x = width/2 + (Math.random()-0.5)*width*0.3; y = -15; break;
            case 'top_right':     x = width + 10; y = Math.random() * height * 0.3; break;
            case 'bottom':        x = Math.random() * width; y = height + 15; break;
            case 'bottom_center': x = width/2 + (Math.random()-0.5)*width*0.3; y = height + 15; break;
            case 'bottom_wave':
                x = Math.random() * width;
                y = height - 40 + Math.sin(frameCounter*0.02 + x*0.008)*25;
                break;
            case 'left':          x = -15; y = Math.random() * height; break;
            case 'center':        x = width/2 + (Math.random()-0.5)*250; y = height/2 + (Math.random()-0.5)*250; break;
            case 'random':
            default:              x = Math.random() * width; y = Math.random() * height; break;
        }

        let color = effect.color;
        if (effect.multiColor) color = randomChoice(effect.multiColor);

        particles.push(new Particle(x, y, {
            vx: effect.vx,
            vy: effect.vy,
            color: color,
            size: effect.size + (Math.random()-0.5) * effect.size * 0.6,
            shape: effect.shape,
            life: effect.life + Math.floor((Math.random()-0.5) * effect.life * 0.3),
            randomness: effect.randomness,
            gravity: effect.gravity || 0,
            friction: effect.friction || 1,
            trail: effect.trail || false,
            glowSize: effect.glowSize || 0,
            twinkle: effect.twinkle || 0,
        }));
    }

    return { init, updateParams };
})();
