"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { loadGsap, loadScrollGsap } from "@/components/motion/load-gsap";
import { WORLD_LAYER, type CharacterPlacement } from "@/lib/world";

export function WorldCharacter({ placement }: { placement?: CharacterPlacement }) {
  if (!WORLD_LAYER.enabled || !placement) return null;
  return <Character key={placement.src} placement={placement} />;
}

function Character({ placement }: { placement: CharacterPlacement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const entered = useRef(false);
  const entrance = placement.entrance;

  useEffect(() => {
    const node = ref.current;
    if (!ready || failed || !node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let generation = 0;
    let revert: (() => void) | undefined;

    const update = () => {
      const current = ++generation;
      revert?.();
      revert = undefined;
      if (media.matches || entered.current || node.getClientRects().length === 0) return;

      const loading = entrance === "peek" ? loadGsap() : loadScrollGsap();
      loading.then((module) => {
        if (cancelled || current !== generation) return;
        const { gsap } = module;
        const ctx = gsap.context(() => {
          const timeline = gsap.timeline({ paused: entrance !== "peek" });
          if (entrance === "peek") {
            entered.current = true;
            timeline.fromTo(node, { x: -24 }, { x: 0, duration: 0.65, ease: "back.out(1.7)" });
            // A finite sway settles within five seconds, without another pause control.
            timeline.to(node, { keyframes: [{ rotate: -2 }, { rotate: 2 }, { rotate: 0 }], duration: 3.2, ease: "sine.inOut" });
          } else {
            if (entrance === "rise" || entrance === "walk") {
              const from = entrance === "rise" ? { y: 24, scale: 0.96 } : { x: -24, rotate: -3 };
              timeline.fromTo(node, from, { x: 0, y: 0, rotate: 0, scale: 1, duration: 0.8, ease: "back.out(1.5)", immediateRender: false });
            } else {
              const angle = entrance === "wave" ? 7 : 5;
              timeline.to(node, { keyframes: [{ rotate: -angle }, { rotate: angle }, { rotate: -angle / 2 }, { rotate: 0 }], transformOrigin: "50% 90%", duration: 0.9, ease: "sine.inOut" });
            }
            if ("ScrollTrigger" in module) {
              module.ScrollTrigger.create({
                trigger: node.closest("[data-world-trigger], section") ?? node,
                start: "top 85%",
                once: true,
                onEnter: () => {
                  if (entered.current) return;
                  entered.current = true;
                  timeline.play();
                },
              });
            }
          }
        }, node);
        revert = () => ctx.revert();
      }).catch((error: unknown) => {
        console.warn("World character motion unavailable", error);
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
  }, [ready, failed, entrance]);

  if (failed) return null;
  return (
    <div aria-hidden="true" data-world-character={entrance} className={`pointer-events-none absolute select-none ${placement.position}`}>
      <div ref={ref} className="h-full w-full">
        <Image
          src={placement.src}
          alt=""
          aria-hidden="true"
          width={placement.width}
          height={placement.height}
          sizes={placement.sizes}
          loading={placement.eager ? "eager" : "lazy"}
          priority={placement.eager}
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}
