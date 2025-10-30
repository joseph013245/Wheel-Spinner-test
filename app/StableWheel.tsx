"use client";
import React, { useEffect, useRef, useState, memo } from "react";
import dynamic from "next/dynamic";

// Dynamically import wheel only when needed
const WheelBase = dynamic(
  () =>
    import("react-custom-roulette").then((m) => m.Wheel),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm opacity-60 text-center py-10">
        Loading wheel…
      </div>
    ),
  }
);

type Props = {
  data: { option: string }[];
  triggerToken: number;
  prizeNumber: number;
  onFinished: () => void;
};

/**
 * StableWheel: Isolated wheel that freezes its props at spin time.
 * Ensures react-custom-roulette never receives undefined data.
 */
const StableWheel = memo(function StableWheel({
  data,
  triggerToken,
  prizeNumber,
  onFinished,
}: Props) {
  const [spinning, setSpinning] = useState(false);
  const [frozenData, setFrozenData] = useState<{ option: string }[]>([]);
  const [frozenPrize, setFrozenPrize] = useState(0);
  const [wheelReady, setWheelReady] = useState(false);
  const lastTokenRef = useRef<number>(0);

  // Wait for data before ever allowing a render
  const safeData =
    Array.isArray(data) && data.length > 0
      ? data
      : [{ option: "🎡 Waiting…" }];

  // Track wheel loaded
  useEffect(() => {
    setWheelReady(true);
  }, []);

  // Start new spin
  useEffect(() => {
    if (!wheelReady) return;
    if (triggerToken === 0) return;
    if (triggerToken === lastTokenRef.current) return;

    setFrozenData(safeData);
    setFrozenPrize(prizeNumber);
    setSpinning(true);
    lastTokenRef.current = triggerToken;
  }, [triggerToken, prizeNumber, wheelReady]);

  // If still loading or no data yet
  if (!wheelReady || !Array.isArray(safeData) || safeData.length === 0) {
    return (
      <div className="text-sm opacity-60 text-center py-10">
        Preparing wheel...
      </div>
    );
  }

  return (
    <WheelBase
      mustStartSpinning={spinning}
      prizeNumber={frozenPrize}
      data={frozenData}
      outerBorderColor="#111"
      radiusLineColor="#333"
      fontSize={14}
      onStopSpinning={() => {
        setSpinning(false);
        onFinished();
      }}
    />
  );
});

export default StableWheel;