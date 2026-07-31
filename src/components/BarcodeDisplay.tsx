"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeDisplayProps {
  value: string;
  className?: string;
}

export function BarcodeDisplay({ value, className }: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 16,
        height: 72,
        margin: 8,
        background: "#ffffff",
        lineColor: "#111111",
      });
    } catch {
      // Invalid barcode content — leave previous render or blank
    }
  }, [value]);

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}
