"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Wheel = dynamic(() => import("react-custom-roulette").then((m) => m.Wheel), {
  ssr: false,
});

interface Props {
  data: { option: string }[];
  triggerToken: number;
  prizeNumber: number;
  onFinished: () => void;
}

export default function StableWheel({ data, triggerToken, prizeNumber, onFinished }: Props) {
  const [mustSpin, setMustSpin] = useState(false);

  // 🎨 Country color palette — bright, distinct, and balanced
  const countryColors: Record<string, string> = {
    Italy: "#009246",
    Spain: "#AA151B",
    Greece: "#0D5EAF",
    Mexico: "#006847",
    France: "#0055A4",
    Thailand: "#2D2A4A",
    Japan: "#FFFFFF",
    "UK & R.O.I": "#00247D",
  };

  const backgroundColors = data.map((d) => {
    const name = d.option.replace(/^[^\s]+ /, "").trim();
    return countryColors[name] || "#cccccc";
  });

  // text colors — Japan = red, dark ones = white, light ones = black
  const textColors = data.map((d) => {
    const name = d.option.replace(/^[^\s]+ /, "").trim();
    if (name === "Japan") return "#c8102e";
    if (["Italy", "Mexico", "Spain", "France", "Thailand", "UK & R.O.I"].includes(name)) return "#ffffff";
    return "#000000";
  });

  useEffect(() => {
    if (triggerToken > 0) {
      setMustSpin(true);
    }
  }, [triggerToken]);

  return (
    <Wheel
      mustStartSpinning={mustSpin}
      prizeNumber={prizeNumber}
      data={data}
      backgroundColors={backgroundColors}
      textColors={textColors}
      onStopSpinning={() => {
        setMustSpin(false);
        onFinished();
      }}
      outerBorderColor="#000"
      outerBorderWidth={5}
      radiusLineColor="#000"
      radiusLineWidth={1}
      fontSize={14}
      perpendicularText
      spinDuration={0.4}
    />
  );
}