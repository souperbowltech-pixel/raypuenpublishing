"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface SponsorQRCodeProps {
  /** The URL the QR code should encode (e.g. the Grandpa sponsor landing link). */
  value: string;
  size?: number;
  caption?: string;
}

/**
 * Renders a scannable QR code for a checkout/sponsor link, so a relative can pay
 * from a printed page or a shared screen — Ray's "legacy QR checkouts".
 */
export default function SponsorQRCode({ value, size = 132, caption }: SponsorQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#2b2118", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-xl border border-ink/15 bg-white p-2 shadow-sm"
        style={{ width: size + 16, height: size + 16 }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR code to sponsor Book 3" width={size} height={size} />
        ) : (
          <div
            className="flex items-center justify-center text-[10px] text-ink-soft"
            style={{ width: size, height: size }}
          >
            Generating…
          </div>
        )}
      </div>
      {caption && (
        <span className="text-[11px] font-semibold text-ink-soft text-center max-w-[160px]">
          {caption}
        </span>
      )}
    </div>
  );
}
