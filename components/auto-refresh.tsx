"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { softRefreshPreserveScroll } from "@/lib/client/soft-refresh";

type AutoRefreshProps = {
  intervalMs?: number;
};

export function AutoRefresh({ intervalMs = 10_000 }: AutoRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || isPending) {
        return;
      }

      startTransition(() => {
        softRefreshPreserveScroll(router);
      });
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, isPending, router]);

  return null;
}
