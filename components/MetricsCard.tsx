'use client';

import Image from "next/image";
import { useEffect, useRef } from 'react';

interface MetricsCardProps {
  title: string;
  type: 'heartbeat' | 'steps';
}

function drawHeartbeat(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = '#2d9ad5';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const centerY = height / 2;
  const amplitude = height * 0.3;

  ctx.beginPath();

  const points = [
    { x: 0, y: centerY },
    { x: width * 0.15, y: centerY },
    { x: width * 0.2, y: centerY - amplitude },
    { x: width * 0.25, y: centerY + amplitude * 0.5 },
    { x: width * 0.3, y: centerY - amplitude * 0.3 },
    { x: width * 0.35, y: centerY },
    { x: width * 0.55, y: centerY },
    { x: width * 0.6, y: centerY - amplitude },
    { x: width * 0.65, y: centerY + amplitude * 0.5 },
    { x: width * 0.7, y: centerY - amplitude * 0.3 },
    { x: width * 0.75, y: centerY },
    { x: width, y: centerY }
  ];

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.stroke();

  ctx.shadowColor = '#2d9ad5';
  ctx.shadowBlur = 15;
  ctx.stroke();
}

function drawStepsGraph(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bars = 24;
  const barWidth = width / bars;
  const data = Array.from({ length: bars }, () => Math.random() * 0.7 + 0.3);

  for (let i = 0; i < bars; i++) {
    const barHeight = height * data[i];
    const x = i * barWidth;
    const y = height - barHeight;

    const gradient = ctx.createLinearGradient(x, y, x, height);
    gradient.addColorStop(0, '#2d9ad5');
    gradient.addColorStop(1, '#3b82f6');

    ctx.fillStyle = gradient;
    ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
  }
}

export default function MetricsCard({ title, type }: MetricsCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    if (type === 'heartbeat') {
      drawHeartbeat(ctx, width, height);
    } else {
      drawStepsGraph(ctx, width, height);
    }
  }, [type]);

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20 relative overflow-hidden">
      {/* Background image at bottom, fading upward */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/Background.jpg"
          alt=""
          fill
          className="object-cover object-bottom opacity-20"
          style={{ objectPosition: "bottom" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-slate-800/60 to-slate-800/90" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 z-[1]"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-medium text-slate-300 mb-1">{title}</h3>
            <div className="text-3xl font-bold text-white">
              {type === 'heartbeat' ? '72' : '8,432'}
              <span className="text-lg text-slate-400 ml-2">
                {type === 'heartbeat' ? 'bpm' : 'steps'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
          <canvas
            ref={canvasRef}
            className="w-full h-32"
          />
        </div>
      </div>
    </div>
  );
}
