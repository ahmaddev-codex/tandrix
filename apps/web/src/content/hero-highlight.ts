// The outlines Tandrix's part finder (SAM) drew in a live run on public/photos/pi5-board-cooler.jpg
// (1920×1440), for the step "Fit the Active Cooler". The board is drawn by its box (the cooler on top splits its mask); the cooler by its mask's outer edge. Each mask path is in its raster's pixels and
// covers its box; it's drawn scaled from raster size to box size at the box's position.
export const heroPhoto = { src: "/photos/pi5-board-cooler.jpg", width: 1920, height: 1440 } as const;

export interface HeroPart {
  label: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  raster: { width: number; height: number };
  path: string;
}

export const heroParts: HeroPart[] = [{"label": "Raspberry Pi 5", "confidence": 0.9, "box": {"x": 166, "y": 172, "w": 1481, "h": 971}, "raster": {"width": 1481, "height": 971}, "path": "M28 0H1453Q1481 0 1481 28V943Q1481 971 1453 971H28Q0 971 0 943V28Q0 0 28 0Z"}, {"label": "Active Cooler", "confidence": 0.7, "box": {"x": 704, "y": 378, "w": 372, "h": 371}, "raster": {"width": 372, "height": 371}, "path": "M178 0L220 2L239 6L287 28L302 38L328 65L342 83L354 102L368 142L372 169L372 194L368 223L364 235L362 243L348 276L322 312L294 336L268 352L245 362L228 366L187 370L171 370L154 368L112 356L84 340L65 324L36 296L18 264L10 248L2 220L0 185L2 160L10 120L36 75L48 60L78 32L105 16L134 6Z"}];
