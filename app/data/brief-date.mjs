const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function getCurrentBriefDate(now = new Date()) {
  const beijingNow = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const briefDate = new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate(),
  ));

  if (beijingNow.getUTCHours() < 8) {
    briefDate.setUTCDate(briefDate.getUTCDate() - 1);
  }

  return `${briefDate.getUTCFullYear()}-${pad(briefDate.getUTCMonth() + 1)}-${pad(briefDate.getUTCDate())}`;
}
