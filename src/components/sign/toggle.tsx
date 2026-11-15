"use client";

import SignIn from "./sign_in";
import User from "./user";
import { useAppContext } from "@/contexts/app";
import { isAuthEnabled } from "@/lib/auth";

export default function SignToggle() {
  const { user, authStatus, sessionUser } = useAppContext();

  if (!isAuthEnabled()) {
    return null;
  }

  if (authStatus === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading account"
        className="flex items-center px-2"
      >
        <span className="size-10 rounded-full bg-slate-200 motion-safe:animate-pulse" />
      </div>
    );
  }

  const account = authStatus === "authenticated" && sessionUser?.uuid
    ? user ?? {
        nickname: sessionUser.nickname || sessionUser.name || sessionUser.email || "",
        avatar_url: sessionUser.avatar_url || sessionUser.image || "",
      }
    : null;

  return (
    <div className="flex cursor-pointer items-center gap-x-2 px-2">
      {account ? <User user={account} /> : <SignIn />}
    </div>
  );
}
