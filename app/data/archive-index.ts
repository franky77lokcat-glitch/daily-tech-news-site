import archive0 from "./archive/2026-07-12.json";
import archive1 from "./archive/2026-07-11.json";
import archive2 from "./archive/2026-07-10.json";

export const archives = {
  "2026-07-12": archive0,
  "2026-07-11": archive1,
  "2026-07-10": archive2
} as const;

export const archiveDates = [
  "2026-07-12",
  "2026-07-11",
  "2026-07-10"
] as const;
