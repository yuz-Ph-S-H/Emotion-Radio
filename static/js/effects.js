/**
 * 高级视觉特效模块
 * 提供背景渐变动画、全局辉光(bloom)、波纹、呼吸灯等效果
 */
const Effects = (() => {
    let time = 0;

    /**
     * 绘制背景渐变（比纯色更有层次感）
     */
    function drawBackground(ctx, w, h, bg, opacity) {
        time += 0.004;
        const driftX = Math.sin(time * 0.7) * w * 0.06;
        const driftY = Math.cos(time * 0.5) * h * 0.05;

        // 多层径向渐变叠加
        const gradient1 = ctx.createRadialGradient(
            w * 0.28 + driftX, h * 0.28 + driftY, 0,
            w * 0.28 + driftX, h * 0.28 + driftY, w * 0.95
        );
        gradient1.addColorStop(0, hsl(bg.h + 12, bg.s + 14, bg.l + 10, opacity));
        gradient1.addColorStop(0.55, hsl(bg.h, bg.s + 6, bg.l + 3, opacity));
        gradient1.addColorStop(1, hsl(bg.h - 18, bg.s, Math.max(3, bg.l - 2), opacity));
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, w, h);

        // 第二层：右下方微弱补色光
        const gradient2 = ctx.createRadialGradient(
            w * 0.74 - driftX * 0.5, h * 0.68 - driftY * 0.4, 0,
            w * 0.74 - driftX * 0.5, h * 0.68 - driftY * 0.4, w * 0.7
        );
        gradient2.addColorStop(0, hsl(bg.h - 55, bg.s + 8, bg.l + 6, opacity * 0.55));
        gradient2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, w, h);

        // 顶部轻微冷光，让画面不显得一整片纯色
        const wash = ctx.createLinearGradient(0, 0, w, h);
        wash.addColorStop(0, hsl(bg.h + 80, bg.s + 8, bg.l + 5, opacity * 0.18));
        wash.addColorStop(0.5, 'rgba(0,0,0,0)');
        wash.addColorStop(1, hsl(bg.h - 80, bg.s + 8, bg.l + 4, opacity * 0.12));
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * 全局辉光/Bloom后处理效果
     */
    function drawBloom(ctx, w, h, intensity) {
        if (intensity < 0.1) return;
        // 中心辉光（缓慢呼吸）
        const breathe = 0.5 + Math.sin(time * 2) * 0.15;
        const radius = w * (0.3 + breathe * 0.2);

        const gradient = ctx.createRadialGradient(
            w / 2, h / 2, 0,
            w / 2, h / 2, radius
        );
        gradient.addColorStop(0, `rgba(255,255,255,${intensity * 0.06 * breathe})`);
        gradient.addColorStop(0.5, `rgba(255,255,255,${intensity * 0.02 * breathe})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    /**
     * 渐变光晕条（底部/顶部氛围光）
     */
    function drawAmbientGlow(ctx, w, h, palette, intensity) {
        if (intensity < 0.1 || !palette || palette.length === 0) return;

        const rgb = hexToRgb(palette[0]);

        // 底部光晕
        const bottomGlow = ctx.createLinearGradient(0, h, 0, h * 0.7);
        bottomGlow.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${intensity * 0.15})`);
        bottomGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bottomGlow;
        ctx.fillRect(0, h * 0.7, w, h * 0.3);

        // 顶部微光
        if (palette.length > 1) {
            const rgb2 = hexToRgb(palette[1]);
            const topGlow = ctx.createLinearGradient(0, 0, 0, h * 0.25);
            topGlow.addColorStop(0, `rgba(${rgb2.r},${rgb2.g},${rgb2.b},${intensity * 0.08})`);
            topGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = topGlow;
            ctx.fillRect(0, 0, w, h * 0.25);
        }
    }

    function drawColorVeils(ctx, w, h, palette, intensity) {
        if (!palette || palette.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < Math.min(3, palette.length); i++) {
            const rgb = hexToRgb(palette[i]);
            const x = w * (0.2 + i * 0.28) + Math.sin(time * (0.6 + i * 0.2)) * w * 0.05;
            const y = h * (0.2 + (i % 2) * 0.45) + Math.cos(time * (0.5 + i * 0.15)) * h * 0.06;
            const radius = Math.max(w, h) * (0.28 + i * 0.08);
            const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
            g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.045 * intensity})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();
    }

    function drawGrain(ctx, w, h, frame) {
        if (frame % 3 !== 0) return;
        ctx.save();
        ctx.globalAlpha = 0.015;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 22; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.restore();
    }

    /**
     * 暗角效果（画面边缘压暗，突出中心）
     */
    function drawVignette(ctx, w, h) {
        const gradient = ctx.createRadialGradient(
            w / 2, h / 2, w * 0.25,
            w / 2, h / 2, w * 0.75
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    return { drawBackground, drawBloom, drawAmbientGlow, drawColorVeils, drawGrain, drawVignette };
})();
