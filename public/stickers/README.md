# Sticker merit badges (Geezy_Goober_V1_Stickers_Final)

Drop the illustrator's 19 full-colour, transparent PNG merit badges here, named
sequentially to match the 19 Book 1 virtue pages:

```
slot-01.png   (Page 1 — Humility)
slot-02.png   (Page 2 — Perseverance)
...
slot-19.png   (Page 19 — Love)
```

Rules:
- Exact names: `slot-01.png` … `slot-19.png` (zero-padded, lowercase).
- Transparent background PNG; roughly square; high resolution (≥ 512×512 recommended
  so the printed Master Sticker Sheet stays crisp).

Until a file exists, the dashboard grid and the Master Sticker Sheet PDF show a
clean numbered placeholder in its place, so badges can be added one at a time as
they are delivered — no code changes needed.

Referenced by: `lib/gamification.ts` (`stickerBadgePath`),
`components/dashboard/PageStickersGrid.tsx`, and `app/api/stickers/sheet/route.ts`.
