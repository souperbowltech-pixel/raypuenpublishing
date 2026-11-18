"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { loadScrollGsap } from "@/components/motion/load-gsap";
import { WORLD_LAYER, type ScenePlacement } from "@/lib/world";

export function WorldScene({ placement }: { placement?: ScenePlacement }) {
  if (!WORLD_LAYER.enabled || !placement) return null;
  return <Scene key={placement.src} placement={placement} />;
}

function Scene({ placement }: { placement: ScenePlacement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !ready || failed) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let generation = 0;
    let revert: (() => void) | undefined;
    const update = () => {
      const current = ++generation;
      revert?.();
      revert = undefined;
      if (media.matches || node.getClientRects().length === 0) return;
      loadScrollGsap().then(({ gsap }) => {
        if (cancelled || current !== generation) return;
        const ctx = gsap.context(() => {
          gsap.fromTo(node, { y: 6 }, {
            y: -6,
            ease: "none",
            scrollTrigger: {
              trigger: node.closest("section") ?? node,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          });
        }, node);
        revert = () => ctx.revert();
      }).catch((error: unknown) => {
        console.warn("World scenery motion unavailable", error);
      });
    };
    update();
    media.addEventListener("change", update);
    return () => {
      cancelled = true;
      generation++;
      media.removeEventListener("change", update);
      revert?.();
    };
  }, [ready, failed]);

  if (failed) return null;
  return (
    <div aria-hidden="true" data-world-scene="" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden" style={{ opacity: placement.opacity }}>
      <div ref={ref} className="absolute -inset-4">
        <Image
          src={placement.src}
          alt=""
          aria-hidden="true"
          width={placement.width}
          height={placement.height}
          sizes={placement.sizes}
          loading="lazy"
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
