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

    const randomTurns = 3 + Math.random() * 2; // 3–5 full spins
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

  const segAngle = 360 / (data?.length || 1);

  return (
    <div className="relative flex flex-col items-center">
      <div
        ref={wheelRef}
        className="relative rounded-full border-4 border-black overflow-hidden"
        style={{
          width: 300,
          height: 300,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.25,0.1,0.25,1)" : "none",
        }}
      >
        {data.map((seg, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
            style={{
              transform: `rotate(${i * segAngle}deg)`,
              background: i % 2 === 0 ? "#ffe58a" : "#ffb347",
              clipPath: "polygon(50% 50%, 100% 0%, 100% 100%)",
            }}
          >
            <span
              style={{
                transform: `rotate(${segAngle / 2}deg) translate(100px) rotate(90deg)`,
              }}
            >
              {seg.option}
            </span>
          </div>
        ))}
      </div>

      <div
        className="absolute top-[-10px] left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderBottom: "20px solid red",
        }}
      ></div>
    </div>
  );
}