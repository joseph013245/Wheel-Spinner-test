"use client";
import React, { useEffect, useRef, useState, memo } from "react";
import dynamic from "next/dynamic";

// Load the real wheel (no SSR)
const WheelBase = dynamic(
  () => import("react-custom-roulette").then((m) => m.Wheel),
  { ssr: false }
);

type Props = {
  /** Immutable data for this spin (array of { option: "🇯🇵 Japan" } ) */
  data: { option: string }[];
  /** Increments each time you want to start a new spin (prevents boolean flapping) */
  triggerToken: number;
  /** The winning segment index for this spin */
  prizeNumber: number;
  /** Called once the wheel animation finishes */
  onFinished: () => void;
};

/**
 * A fully isolated wheel. It **freezes props** at spin start so that
 * any parent re-renders (Firebase updates, timers, etc.) CANNOT reset
 * or jolt the animation mid-spin.
 */
const StableWheel = memo(function StableWheel({
  data,
  triggerToken,
  prizeNumber,
  onFinished,
}: Props) {
  // Local frozen state for the active spin
  const [spinning, setSpinning] = useState(false);
  const [frozenData, setFrozenData] = useState<{ option: string }[]>([]);
  const [frozenPrize, setFrozenPrize] = useState(0);

  // Start a spin whenever triggerToken changes
  const lastTokenRef = useRef<number>(0);
  useEffect(() => {
    if (triggerToken === 0) return;              // first render - do nothing
    if (triggerToken === lastTokenRef.current) return;

    // Freeze the inputs for this whole animation
    setFrozenData(data);
    setFrozenPrize(prizeNumber);
    setSpinning(true);

    lastTokenRef.current = triggerToken;
  }, [triggerToken, prizeNumber, data]);

  return (
    <WheelBase
      mustStartSpinning={spinning}
      prizeNumber={frozenPrize}
      data={frozenData}
      // IMPORTANT: never change key; keep the same component instance
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