"use client";
import React, { useEffect, useRef, useState } from "react";

type WheelSegment = { option: string };
type Props = {
  data: WheelSegment[];
  triggerToken: number;
  prizeNumber: number;
  onFinished: () => void;
};

export default function StableWheel({
  data,
  triggerToken,
  prizeNumber,
  onFinished,
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

  const segAngle = 360 / data.length;
  const radius = 150;

  // 🇯🇵🇧🇷🇨🇦 Flag colors
  const flagColors: Record<string, string> = {
    Japan: "#FFFFFF", // white
    Brazil: "#009739", // green
    Canada: "#FF0000", // red
  };

  // Fallback colors if flag not found
  const fallbackColors = ["#FFD95A", "#FFB347", "#A0C4FF", "#FFADAD"];

  const background = "conic-gradient(" +
    data
      .map((seg, i) => {
        // Extract the country name (after emoji flag)
        const parts = seg.option.split(" ");
        const country = parts[parts.length - 1];
        const color =
          flagColors[country] || fallbackColors[i % fallbackColors.length];
        const start = (i * segAngle).toFixed(2);
        const end = ((i + 1) * segAngle).toFixed(2);
        return `${color} ${start}deg ${end}deg`;
      })
      .join(",") +
    ")";

  return (
    <div className="relative flex flex-col items-center">
      {/* Wheel body */}
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
        {/* Segment labels */}
        {data.map((seg, i) => {
          const midAngle = i * segAngle + segAngle / 2;
          const textRotation = midAngle;

          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center text-sm font-bold"
              style={{
                transform: `rotate(${textRotation}deg) translate(${radius * 0.65}px) rotate(90deg)`,
                userSelect: "none",
                color: "black",
              }}
            >
              {seg.option}
            </div>
          );
        })}
      </div>

      {/* Pointer (at top, points downward) */}
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