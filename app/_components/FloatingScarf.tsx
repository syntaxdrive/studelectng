"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * FloatingScarf Component
 * Renders a silky, flowing iridescent ribbon / scarf stretched across the screen.
 * - Multi-chromatic gradient (cyan -> blue -> violet -> magenta -> amber -> emerald)
 * - Undulating fluid physics with layered satin folds
 * - Interactive mouse parallax breeze
 * - 60 FPS GPU-accelerated canvas with automatic retina scaling
 */
export function FloatingScarf() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      setIsSupported(false);
      return;
    }

    let animationFrameId: number;
    let time = 0;
    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Number of ribbons that make up the folded scarf
    const ribbons = [
      {
        baseYOffset: 0,
        amplitude: 55,
        freq: 0.0016,
        speed: 0.014,
        phase: 0,
        thickness: 95,
        opacity: 0.85,
        blur: 24,
      },
      {
        baseYOffset: 18,
        amplitude: 45,
        freq: 0.0022,
        speed: 0.018,
        phase: 1.8,
        thickness: 75,
        opacity: 0.7,
        blur: 16,
      },
      {
        baseYOffset: -22,
        amplitude: 65,
        freq: 0.0013,
        speed: 0.011,
        phase: 3.4,
        thickness: 110,
        opacity: 0.6,
        blur: 32,
      },
      {
        baseYOffset: 8,
        amplitude: 38,
        freq: 0.0028,
        speed: 0.022,
        phase: 4.9,
        thickness: 55,
        opacity: 0.9,
        blur: 10,
      },
    ];

    const render = () => {
      // Pause rendering if canvas is not in viewport or tab hidden
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Smooth mouse interpolation (spring effect)
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const midY = height * 0.46;

      // Draw each ribbon of the scarf
      ribbons.forEach((ribbon, rIdx) => {
        const ribbonTime = time * ribbon.speed;

        // Dynamic multi-stop iridescent rainbow gradient
        // Offsets slightly over time to simulate shimmering silk reflection
        const gradShift = (time * 0.001) % 1;
        const grad = ctx.createLinearGradient(0, 0, width, height * 0.5);

        grad.addColorStop(0.0, `hsla(${(190 + gradShift * 60) % 360}, 95%, 62%, ${ribbon.opacity})`); // Cyan/Sky
        grad.addColorStop(0.2, `hsla(${(220 + gradShift * 60) % 360}, 90%, 65%, ${ribbon.opacity})`); // Royal Blue
        grad.addColorStop(0.42, `hsla(${(275 + gradShift * 60) % 360}, 85%, 68%, ${ribbon.opacity})`); // Violet/Purple
        grad.addColorStop(0.62, `hsla(${(330 + gradShift * 60) % 360}, 92%, 67%, ${ribbon.opacity})`); // Magenta/Pink
        grad.addColorStop(0.82, `hsla(${(35 + gradShift * 60) % 360}, 95%, 64%, ${ribbon.opacity})`); // Golden Coral
        grad.addColorStop(1.0, `hsla(${(160 + gradShift * 60) % 360}, 90%, 55%, ${ribbon.opacity})`); // Mint/Emerald

        ctx.save();
        ctx.fillStyle = grad;
        ctx.shadowColor = `rgba(139, 92, 246, 0.35)`;
        ctx.shadowBlur = ribbon.blur;

        // Draw the ribbon as an enclosed filled path between top and bottom wave edges
        ctx.beginPath();

        const step = 8;
        const pointsTop: Array<{ x: number; y: number }> = [];
        const pointsBottom: Array<{ x: number; y: number }> = [];

        for (let x = -20; x <= width + 20; x += step) {
          // Compound sinusoidal waves for organic silk motion
          const wave1 = Math.sin(x * ribbon.freq + ribbonTime + ribbon.phase) * ribbon.amplitude;
          const wave2 = Math.cos(x * ribbon.freq * 1.7 - ribbonTime * 0.8) * (ribbon.amplitude * 0.45);
          const wave3 = Math.sin(x * 0.0007 + ribbonTime * 0.4) * 25;

          // Mouse proximity displacement (gentle breeze push)
          let mouseDisplacement = 0;
          if (mouseX > 0 && mouseY > 0) {
            const dist = Math.hypot(x - mouseX, midY - mouseY);
            if (dist < 260) {
              const force = (1 - dist / 260) * 35;
              mouseDisplacement = Math.sin((dist / 260) * Math.PI) * force;
            }
          }

          const centerY = midY + ribbon.baseYOffset + wave1 + wave2 + wave3 + mouseDisplacement;

          // Dynamic thickness modulation creates 3D ribbon twists
          const twist = Math.sin(x * 0.003 + ribbonTime * 0.6 + rIdx * 1.2);
          const currentThickness = Math.max(12, ribbon.thickness * (0.65 + 0.35 * twist));

          pointsTop.push({ x, y: centerY - currentThickness * 0.5 });
          pointsBottom.push({ x, y: centerY + currentThickness * 0.5 });
        }

        // Trace top edge from left to right
        if (pointsTop.length > 0) {
          ctx.moveTo(pointsTop[0].x, pointsTop[0].y);
          for (let i = 1; i < pointsTop.length; i++) {
            const prev = pointsTop[i - 1];
            const curr = pointsTop[i];
            const cx = (prev.x + curr.x) / 2;
            const cy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
          }
        }

        // Trace bottom edge from right to left to seal the ribbon polygon
        for (let i = pointsBottom.length - 1; i >= 0; i--) {
          const curr = pointsBottom[i];
          ctx.lineTo(curr.x, curr.y);
        }

        ctx.closePath();
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (!isSupported) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-[480px] sm:h-[620px] lg:h-[720px] pointer-events-none overflow-hidden select-none z-0"
    >
      {/* Background Soft Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1000px] h-[350px] bg-gradient-to-r from-blue-400/20 via-fuchsia-400/20 to-amber-300/15 blur-3xl rounded-full pointer-events-none" />

      {/* Floating Rainbow Scarf Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-70 sm:opacity-85 mix-blend-multiply dark:mix-blend-screen transition-opacity duration-1000"
      />

      {/* Vignette Gradients for Flawless Soft Edge Blending */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
    </div>
  );
}
