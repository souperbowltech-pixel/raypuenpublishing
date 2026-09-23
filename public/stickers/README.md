# Sticker merit badges (Geezy_Goober_V1_Stickers_Final)

The illustrator's 19 full-colour merit badges, named sequentially to match the 19
Book 1 virtue pages. The virtue printed on each badge is mirrored in
`lib/stickers.ts` — **if the artwork's wording changes, that file must change with
it**, or the dashboard will label a badge differently from the picture on it.

```
slot-01.png   (Page 1 — Awareness)
slot-02.png   (Page 2 — Discernment)
...
slot-18.png   (Page 18 — Generosity)
slot-19.png   (Page 19 — Integrity)
```

Rules:
- Exact names: `slot-01.png` … `slot-19.png` (zero-padded, lowercase).
- Transparent background PNG; roughly square; high resolution (≥ 512×512 recommended
  so the printed Master Sticker Sheet stays crisp).

**Current files (2026-09-23):** 900×900 RGBA, from the illustrator's final delivery.
Those originals arrived as opaque RGB with no alpha channel (a white rectangle, and
a blue-grey one on badge 18), which would have printed as squares for children to cut
out. The background was removed on our side by flood-filling inward from the border,
so white *inside* a badge (eyes, the number disc) is untouched. If the illustrator
later supplies genuinely transparent exports, prefer those over these processed ones.

Until a file exists, the dashboard grid and the Master Sticker Sheet PDF show a
clean numbered placeholder in its place, so badges can be added one at a time as
they are delivered — no code changes needed.

Referenced by: `lib/gamification.ts` (`stickerBadgePath`),
`components/dashboard/PageStickersGrid.tsx`, and `app/api/stickers/sheet/route.ts`.
