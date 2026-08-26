"use client";

import { useEffect, useRef } from "react";

const NUM_CONFETTI = 350;
const COLORS = [
  [85, 71, 106],
  [174, 61, 99],
  [219, 56, 83],
  [244, 92, 68],
  [248, 182, 70]
];
const PI_2 = 2 * Math.PI;

const ConfettiCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let animationFrameId: number;
    let fading = false;

    const resizeWindow = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeWindow);
    resizeWindow();

    const range = (a: number, b: number) => (b - a) * Math.random() + a;

    const drawCircle = (x: number, y: number, r: number, style: string) => {
      context.beginPath();
      context.arc(x, y, r, 0, PI_2, false);
      context.fillStyle = style;
      context.fill();
    };

    class Confetti {
      style: number[];
      rgb: string;
      r: number;
      r2: number;
      opacity: number = 0;
      dop: number = 0;
      x: number = 0;
      y: number = 0;
      xmax: number = 0;
      ymax: number = 0;
      vx: number = 0;
      vy: number = 0;

      constructor() {
        this.style = COLORS[~~range(0, COLORS.length)];
        this.rgb = `rgba(${this.style[0]},${this.style[1]},${this.style[2]}`;
        this.r = ~~range(2, 6);
        this.r2 = 2 * this.r;
        this.replace();
      }

      replace() {
        this.opacity = 1;
        this.dop = 0.03 * range(1, 4);
        this.x = range(-this.r2, w - this.r2);
        this.y = range(-20, h - this.r2);
        this.xmax = w - this.r;
        this.ymax = h - this.r;
        this.vx = range(-2, 2);
        this.vy = 0.7 * this.r + range(-1, 1);
      }

      draw() {
        this.x += this.vx;
        this.y += this.vy;
        if (fading) {
          this.opacity -= 0.02;
        }
        if (this.opacity <= 0) {
          return;
        }
        drawCircle(~~this.x, ~~this.y, this.r, `${this.rgb},${this.opacity})`);
      }
    }

    const confetti = Array.from({ length: NUM_CONFETTI }, () => new Confetti());

    const step = () => {
      context.clearRect(0, 0, w, h);
      confetti.forEach((c) => c.draw());
      if (confetti.some((c) => c.opacity > 0)) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    step();

    const fadeTimeout = setTimeout(() => {
      fading = true;
    }, 10000);

    return () => {
      window.removeEventListener("resize", resizeWindow);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(fadeTimeout);
    };
  }, []);

  return <canvas ref={canvasRef} id="world" className="absolute top-0 left-0 w-full h-full" />;
};

export default ConfettiCanvas;
