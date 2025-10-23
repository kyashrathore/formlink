"use client";
import * as React from "react";
import SignatureCanvas from "react-signature-canvas";

export interface InlineSignatureProps {
  value?: string | null; // data URL (PNG)
  onChange: (dataUrl: string | null) => void;
  onSubmit?: () => void;
  onUpload?: (file: File) => Promise<any>;
  width?: number;
  height?: number;
  className?: string;
  saveLabel?: string;
  uploadingLabel?: string;
}

export function InlineSignature({
  value,
  onChange,
  onSubmit,
  onUpload,
  width = 600,
  height = 180,
  className,
  saveLabel = "Save",
  uploadingLabel = "Uploading…",
}: InlineSignatureProps) {
  const sigRef = React.useRef<SignatureCanvas | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Restore existing image into canvas so new strokes are included in export
  React.useEffect(() => {
    if (!isReady || !value || !sigRef.current) return;
    try {
      sigRef.current.clear();
      requestAnimationFrame(() => {
        sigRef.current?.fromDataURL(value, { ratio: 1, width, height });
      });
    } catch {
      // ignore restore errors; user can redraw
    }
  }, [isReady, value, width, height]);

  const handleBegin = React.useCallback(() => {
    // no-op; placeholder to match API and future hooks
  }, []);

  const handleEnd = React.useCallback(() => {
    try {
      const dataUrl = sigRef.current?.toDataURL("image/png") || null;
      onChange(dataUrl);
    } catch {
      onChange(null);
    }
  }, [onChange]);

  const handleClear = React.useCallback(() => {
    try {
      sigRef.current?.clear();
    } finally {
      onChange(null);
    }
  }, [onChange]);

  function dataUrlToFile(
    dataUrl: string,
    filename = "signature.png",
  ): File | null {
    try {
      const parts = dataUrl.split(",");
      if (parts.length < 2) return null;
      const meta = parts[0] || "";
      const base64 = parts[1] || "";
      const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
      const binary = typeof atob === "function" ? atob(base64) : "";
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], filename, { type: mime });
    } catch {
      return null;
    }
  }

  const handleUpload = React.useCallback(async () => {
    if (!onUpload || !value) return;
    const file = dataUrlToFile(value);
    if (!file) return;
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, value]);

  return (
    <div
      className={["w-full max-w-2xl space-y-3", className]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Signature"
    >
      <div
        className="rounded-md border bg-background overflow-hidden"
        style={{ width, height }}
      >
        {isReady ? (
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              width,
              height,
              className: "w-full h-full cursor-crosshair block",
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
            minWidth={0.75}
            maxWidth={2.0}
            dotSize={0}
            throttle={16}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-secondary-foreground hover:opacity-90"
          onClick={handleClear}
        >
          Clear
        </button>
        {onUpload && (
          <button
            type="button"
            disabled={!value || isUploading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60"
            onClick={handleUpload}
            aria-busy={isUploading || undefined}
          >
            {isUploading ? uploadingLabel : saveLabel}
          </button>
        )}
        {/* Use page-level footer for continue in typeform flows */}
      </div>
    </div>
  );
}
