"use client";

import { useEffect, useState } from "react";

function formatBeijingTime(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
}

export function BeijingClock() {
  const [time, setTime] = useState(() => formatBeijingTime(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(formatBeijingTime(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return <span className="clock">北京时间 {time}</span>;
}
