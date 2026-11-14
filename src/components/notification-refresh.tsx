"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function NotificationRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <p className="form-help">
      Updates refresh every 30 seconds while this page is visible. There are no
      email or offline alerts.
    </p>
  );
}
