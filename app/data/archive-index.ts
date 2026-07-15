import archive0 from "./archive/2026-07-15.json";
import archive1 from "./archive/2026-07-14.json";
import archive2 from "./archive/2026-07-13.json";
import archive3 from "./archive/2026-07-12.json";
import archive4 from "./archive/2026-07-11.json";
import archive5 from "./archive/2026-07-10.json";

export const archives = {
  "2026-07-15": archive0,
  "2026-07-14": archive1,
  "2026-07-13": archive2,
  "2026-07-12": archive3,
  "2026-07-11": archive4,
  "2026-07-10": archive5
} as const;

export const archiveDates = [
  "2026-07-15",
  "2026-07-14",
  "2026-07-13",
  "2026-07-12",
  "2026-07-11",
  "2026-07-10"
] as const;
