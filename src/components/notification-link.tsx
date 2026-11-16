"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function NotificationLink() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if (!response.ok) {
          setCount(null);
          return;
        }
        const data = await response.json();
        if (Number.isSafeInteger(data.unread) && data.unread >= 0)
          setCount(data.unread);
      } catch {
        /* Existing count is informational; access is checked again on opening. */
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);
  return (
    <Link href="/notifications">
      Notifications
      {count !== null && count > 0 ? (
        <span className="unread-count" aria-label={`${count} unread`}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}
