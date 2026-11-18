"use client";

import { useState } from "react";
import Image from "next/image";
import { WORLD_LAYER } from "@/lib/world";

/** Reuse the lazy image's decoded URL for the static repeating background. */
export function WorldPaper() {
  const [tile, setTile] = useState<string>();
  const [failed, setFailed] = useState(false);
  const paper = WORLD_LAYER.placements.paper;
  if (!WORLD_LAYER.enabled || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-world-paper=""
      className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden"
      style={{ opacity: paper.opacity, backgroundRepeat: "repeat", backgroundSize: "512px 512px", backgroundImage: tile ? `url("${tile}")` : undefined }}
    >
      <Image
        src={paper.src}
        alt=""
        aria-hidden="true"
        width={paper.width}
        height={paper.height}
        sizes={paper.sizes}
        loading="lazy"
        onLoad={(event) => setTile(event.currentTarget.currentSrc || event.currentTarget.src)}
        onError={() => setFailed(true)}
        className="absolute left-0 top-0 h-[512px] w-[512px] max-w-none"
      />
      <noscript>
        <div className="absolute inset-0" style={{ backgroundImage: `url("${paper.src}")`, backgroundRepeat: "repeat", backgroundSize: "512px 512px" }} />
      </noscript>
    </div>
  );
}
