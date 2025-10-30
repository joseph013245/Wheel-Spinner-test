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

  // 🎨 Flag color palette (simplified but vibrant)
  const countryColors: Record<string, string> = {
    Japan: "#ffffff",
    Brazil: "#009739",
    Canada: "#ff0000",
  };

  // fallback vibrant palette
  const fallbackColors = [
    "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FFADAD", "#A29BFE",
  ];

  // build the wheel using conic-gradient
  const background = `conic-gradient(${data
    .map((seg, i) => {
      const parts = seg.option.split(" ");
      const country = parts[parts.length - 1];
      const color = countryColors[country] || fallbackColors[i % fallbackColors.length];
      const start = (i * segAngle).toFixed(2);
      const end = ((i + 1) * segAngle).toFixed(2);
      return `${color} ${start}deg ${end}deg`;
    })
    .join(", ")})`;

  return (
    <div className="relative flex flex-col items-center">
      {/* Wheel */}
      <div
        ref={wheelRef}
        className="relative rounded-full border-4 border-black overflow-hidden shadow-lg"
        style={{
          width: radius * 2,
          height: radius * 2,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.25,0.1,0.25,1)" : "none",
          background,
        }}
      >
        {data.map((seg, i) => {
          const midAngle = i * segAngle + segAngle / 2;
          const textRotation = midAngle;
          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center text-sm font-bold"
              style={{
                transform: `rotate(${textRotation}deg) translate(${radius * 0.65}px) rotate(90deg)`,
                color: "#000",
                userSelect: "none",
              }}
            >
              {seg.option}
            </div>
          );
        })}
      </div>

      {/* Pointer (top red triangle) */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "20px solid red", // fixed orientation
        }}
      ></div>
    </div>
  );
}