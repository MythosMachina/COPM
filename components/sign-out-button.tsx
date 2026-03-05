"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => {
        const callbackUrl =
          typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
        void signOut({ callbackUrl });
      }}
      type="button"
      className="signout"
    >
      Sign out
    </button>
  );
}
