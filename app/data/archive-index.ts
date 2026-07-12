import archive0 from "./archive/2026-07-13.json";
import archive1 from "./archive/2026-07-12.json";
import archive2 from "./archive/2026-07-11.json";
import archive3 from "./archive/2026-07-10.json";

export const archives = {
  "2026-07-13": archive0,
  "2026-07-12": archive1,
  "2026-07-11": archive2,
  "2026-07-10": archive3
} as const;

export const archiveDates = [
  "2026-07-13",
  "2026-07-12",
  "2026-07-11",
  "2026-07-10"
] as const;
