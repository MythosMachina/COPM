"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function softRefreshPreserveScroll(router: AppRouterInstance): void {
  const scrollY = window.scrollY;
  router.refresh();

  const restore = () => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
  };

  window.requestAnimationFrame(restore);
  window.setTimeout(restore, 120);
  window.setTimeout(restore, 320);
}
