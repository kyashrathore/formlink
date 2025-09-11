"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { cn } from "../../../lib/utils";

export interface UnifiedSignatureProps {
  mode: "chat" | "typeform";
  value?: string | null; // data URL (PNG)
  onChange: (dataUrl: string | null) => void;
  onSubmit?: () => void;
  required?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function UnifiedSignature({
  value,
  onChange,
  onSubmit,
  required,
  width = 560,
  height = 200,
  className,
}: UnifiedSignatureProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ensure canvas is ready
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Restore previous signature if exists
    if (isReady && value && sigCanvasRef.current) {
      try {
        // Clear first to ensure clean state
        sigCanvasRef.current.clear();
        // Wait for next frame to ensure canvas is properly sized
        requestAnimationFrame(() => {
          if (sigCanvasRef.current) {
            sigCanvasRef.current.fromDataURL(value, {
              ratio: 1,
              width: width,
              height: height,
            });
          }
        });
      } catch (e) {
        console.error("Failed to restore signature:", e);
      }
    }
  }, [isReady, value, width, height]);

  const handleBegin = () => {
    console.log("Signature started");
    setError(null);
  };

  const handleEnd = () => {
    console.log("Signature ended");
    try {
      const dataUrl = sigCanvasRef.current?.toDataURL("image/png") || null;
      console.log("Generated dataURL:", dataUrl ? "success" : "null");
      onChange(dataUrl);
      setError(null);
    } catch (e) {
      console.error("Signature capture error:", e);
      setError("Failed to capture signature");
    }
  };

  const clearSignature = () => {
    try {
      sigCanvasRef.current?.clear();
      onChange(null);
      setError(null);
    } catch (e) {
      setError("Failed to clear signature");
    }
  };

  return (
    <div className={cn("space-y-3", className)} style={{ width }}>
      <div>
        <span className="text-sm text-muted-foreground">Sign below</span>
      </div>
      <div
        className={cn("border rounded-md bg-white overflow-hidden relative")}
        style={{ width, height }}
      >
        {isReady ? (
          <SignatureCanvas
            ref={sigCanvasRef}
            canvasProps={{
              width,
              height,
              className: "cursor-crosshair block",
              style: {
                width: `${width}px`,
                height: `${height}px`,
                touchAction: "none",
                display: "block",
              },
            }}
            backgroundColor="white"
            penColor="black"
            onBegin={handleBegin}
            onEnd={handleEnd}
            minWidth={1}
            maxWidth={3}
            dotSize={0}
            throttle={16}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading canvas...</span>
          </div>
        )}
      </div>
      <div className="flex justify-start">
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors"
          onClick={clearSignature}
        >
          Clear
        </button>
      </div>
      {required && !value && (
        <p className="text-sm text-destructive">Signature is required</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
