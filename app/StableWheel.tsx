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

  // Handle spin trigger
  useEffect(() => {
    if (triggerToken === 0 || triggerToken === lastToken.current) return;
    if (!data || data.length === 0) return;

    lastToken.current = triggerToken;
    setSpinning(true);

    const randomTurns = 3 + Math.random() * 2; // 3–5 rotations
    const degPerSegment = 360 / data.length;
    const stopDeg = 360 - prizeNumber * degPerSegment;
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
  const radius = 150; // px

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
          background: "white",
        }}
      >
        {data.map((seg, i) => {
          const startAngle = i * segAngle;
          const endAngle = startAngle + segAngle;
          const color = i % 2 === 0 ? "#FFD95A" : "#FFB347"; // alternate gold/orange
          const textRotation = startAngle + segAngle / 2;

          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: `conic-gradient(${color} ${startAngle}deg ${endAngle}deg, transparent ${endAngle}deg 360deg)`,
                borderRadius: "50%",
              }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                style={{
                  transform: `rotate(${textRotation}deg) translate(${radius * 0.55}px) rotate(90deg)`,
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {seg.option}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pointer (flipped downwards) */}
      <div
        className="absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2"
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