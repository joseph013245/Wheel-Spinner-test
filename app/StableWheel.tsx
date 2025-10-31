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
      onStopSpinning={() => {
        setMustSpin(false);
        onFinished();
      }}
      textColors={["#fff"]}
      outerBorderColor="#000"
      outerBorderWidth={5}
      radiusLineColor="#000"
      radiusLineWidth={1}
      fontSize={14}
      perpendicularText
    />
  );
}