"use client";
import React, { useEffect, useRef, useState } from "react";

type WheelSegment = { option: string };
type Props = {
  data: WheelSegment[];
  triggerToken: number;
  prizeNumber: number;
  onFinished: () => void;
  gameOver?: boolean;
};

export default function StableWheel({
  data,
  triggerToken,
  prizeNumber,
  onFinished,
  gameOver = false,
}: Props) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastToken = useRef(0);

  useEffect(() => {
    if (triggerToken === 0 || triggerToken === lastToken.current) return;
    if (!data || data.length === 0) return;

    lastToken.current = triggerToken;
    setSpinning(true);

    const randomTurns = 3 + Math.random() * 2;
    const degPerSegment = 360 / data.length;
    const stopDeg = prizeNumber * degPerSegment + degPerSegment / 2;
    const finalRotation = rotation + randomTurns * 360 + stopDeg;

    setRotation(finalRotation);

    const timeout = setTimeout(() => {
      setSpinning(false);
      onFinished();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [triggerToken, prizeNumber, data]);

  if (!data || data.length === 0) {
    return (
      <div className="text-sm opacity-60 text-center py-10">
        Preparing wheel...
      </div>
    );
  }

  if (gameOver) return null;

  const segAngle = 360 / data.length;
  const radius = 150;

  // 🇯🇵🇧🇷🇨🇦 flag-like backgrounds
  const flagBackgrounds: Record<string, string> = {
    Japan: "radial-gradient(circle at center, #ff0000 20%, #ffffff 21%)",
    Brazil:
      "radial-gradient(circle at center, #002776 15%, #ffdf00 20%, #009739 80%)",
    Canada:
      "linear-gradient(to right, #ff0000 0 25%, #ffffff 25% 75%, #ff0000 75% 100%)",
  };

  const fallbackColors = [
    "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FFADAD", "#A29BFE",
  ];

  return (
    <div className="relative flex flex-col items-center">
      <div
        ref={wheelRef}
        className="relative rounded-full border-4 border-black shadow-lg overflow-hidden"
        style={{
          width: radius * 2,
          height: radius * 2,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.25,0.1,0.25,1)" : "none",
        }}
      >
        {data.map((seg, i) => {
          const startAngle = i * segAngle;
          const endAngle = (i + 1) * segAngle;
          const midAngle = startAngle + segAngle / 2;

          const parts = seg.option.split(" ");
          const country = parts[parts.length - 1];
          const bg =
            flagBackgrounds[country] || fallbackColors[i % fallbackColors.length];

          return (
            <div
              key={i}
              className="absolute inset-0 origin-center"
              style={{
                clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((Math.PI * startAngle) / 180)}% ${
                  50 + 50 * Math.sin((Math.PI * startAngle) / 180)
                }%, ${50 + 50 * Math.cos((Math.PI * endAngle) / 180)}% ${
                  50 + 50 * Math.sin((Math.PI * endAngle) / 180)
                }%)`,
                background: bg,
                transform: `rotate(${startAngle}deg)`,
              }}
            />
          );
        })}

        {/* labels */}
        {data.map((seg, i) => {
          const midAngle = i * segAngle + segAngle / 2;
          return (
            <div
              key={`label-${i}`}
              className="absolute inset-0 flex items-center justify-center text-sm font-bold"
              style={{
                transform: `rotate(${midAngle}deg) translate(${radius * 0.65}px) rotate(90deg)`,
                userSelect: "none",
                color: "#000",
                textShadow: "0 0 3px #fff",
              }}
            >
              {seg.option}
            </div>
          );
        })}
      </div>

      {/* pointer */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "20px solid red",
        }}
      ></div>
    </div>
  );
}