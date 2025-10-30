"use client";
import { useEffect, useState } from "react";

export default function PigCelebration() {
  const [pigs, setPigs] = useState<
    { id: number; angle: number; distance: number; size: number; delay: number }[]
  >([]);

  useEffect(() => {
    const pigsArr = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      angle: Math.random() * 360, // random direction
      distance: 200 + Math.random() * 250, // how far they fly
      size: 40 + Math.random() * 60,
      delay: Math.random() * 0.3,
    }));
    setPigs(pigsArr);

    const timeout = setTimeout(() => setPigs([]), 4000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-[9999]">
      {pigs.map((pig) => (
        <img
          key={pig.id}
          src="/piggy.jpg"
          alt="pig in blanket"
          style={{
            position: "absolute",
            width: `${pig.size}px`,
            transform: `rotate(${pig.angle}deg)`,
            animation: `pigExplosion-${pig.id} 3.5s ease-out ${pig.delay}s forwards`,
          }}
        />
      ))}

      <style jsx global>{`
        @keyframes pigFly {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--x), var(--y)) scale(0.8) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelectorAll('img[alt="pig in blanket"]').forEach((el, i) => {
              const angle = parseFloat(el.style.transform.replace(/[^0-9.-]/g, '')) || 0;
              const radians = (angle * Math.PI) / 180;
              const distance = 250 + Math.random() * 150;
              const x = Math.cos(radians) * distance;
              const y = Math.sin(radians) * distance;
              el.style.setProperty('--x', x + 'px');
              el.style.setProperty('--y', y + 'px');
              el.style.animation = 'pigFly 4s ease-out ' + (Math.random() * 0.3) + 's forwards';
            });
          `,
        }}
      />
    </div>
  );
}