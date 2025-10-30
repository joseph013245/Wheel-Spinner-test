"use client";
import React, { useEffect, useRef, useState } from "react";

type WheelSegment = { option: string };
type Props = {
  data: WheelSegment[];
  triggerToken: number;
  prizeNumber: number;
  onFinished: () => void;
  gameOver?: boolean; // 👈 Added to hide wheel when done
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

  // 🌀 Handle spin
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

  // 🏁 Hide wheel once the game is over
  if (gameOver) {
    return null;
  }

  const segAngle = 360 / data.length;
  const radius = 150;

  // 🇯🇵🇧🇷🇨🇦 flag-inspired gradients
  const flagGradients: Record<string, string> = {
    Japan: "conic-gradient(from 0deg, white 0deg 340deg, red 340deg 360deg)",
    Brazil:
      "conic-gradient(from 0deg, #009739 0deg 240deg, #FFDF00 240deg 300deg, #002776 300deg 360deg)",
    Canada:
      "conic-gradient(from 0deg, #FF0000 0deg 120deg, white 120deg 240deg, #FF0000 240deg 360deg)",
  };

  // fallback colors
  const fallbackColors = [
    "#FFD95A",
    "#FFB347",
    "#A0C4FF",
    "#FFADAD",
    "#B5E48C",
    "#F9C74F",
  ];

  // build wheel background
  const background = "conic-gradient(" +
    data
      .map((seg, i) => {
        const parts = seg.option.split(" ");
        const country = parts[parts.length - 1];
        const grad = flagGradients[country];
        const start = (i * segAngle).toFixed(2);
        const end = ((i + 1) * segAngle).toFixed(2);
        if (grad) {
          // embed gradient slice
          return `${grad} ${start}deg ${end}deg`;
        } else {
          const color = fallbackColors[i % fallbackColors.length];
          return `${color} ${start}deg ${end}deg`;
        }
      })
      .join(",") +
    ")";

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

      {/* Red pointer at top */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderBottom: "20px solid red",
          transform: "rotate(180deg)",
        }}
      ></div>
    </div>
  );
}