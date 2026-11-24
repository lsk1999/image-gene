"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { cacheGet, cacheRemove } from "@/lib/cache";

import { CacheKey } from "@/services/constant";
import { ContextValue } from "@/types/context";
import { User } from "@/types/user";
import moment from "moment";
import useOneTapLogin from "@/hooks/useOneTapLogin";
import { useSession } from "next-auth/react";
import { isAuthEnabled, isGoogleOneTapEnabled } from "@/lib/auth";

const AppContext = createContext({} as ContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  if (isAuthEnabled() && isGoogleOneTapEnabled()) {
    useOneTapLogin();
  }

  const { data: session, status: authStatus } = isAuthEnabled()
    ? useSession()
    : { data: null, status: "unauthenticated" as const };
  const sessionUser = authStatus === "authenticated" ? session?.user : undefined;
  const userId = sessionUser?.uuid;

  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  // SessionProvider may have a cached client session that is absent during SSR.
  // Give consumers the same initial auth snapshot on both sides.
  const [authMounted, setAuthMounted] = useState(false);
  useEffect(() => setAuthMounted(true), []);

  const fetchUserInfo = async function (uuid: string, signal: AbortSignal) {
    try {
      const resp = await fetch("/api/get-user-info", {
        method: "POST",
        signal,
      });

      if (!resp.ok) {
        throw new Error("fetch user info failed with status: " + resp.status);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      if (signal.aborted || data?.uuid !== uuid) return;
      setUser(data);

      void updateInvite(data, signal);
    } catch (e) {
      if (!signal.aborted) console.log("fetch user info failed");
    }
  };

  const updateInvite = async (user: User, signal: AbortSignal) => {
    try {
      if (user.invited_by) {
        // user already been invited
        console.log("user already been invited", user.invited_by);
        return;
      }

      const inviteCode = cacheGet(CacheKey.InviteCode);
      if (!inviteCode) {
        // no invite code
        return;
      }

      const userCreatedAt = moment(user.created_at).unix();
      const currentTime = moment().unix();
      const timeDiff = Number(currentTime - userCreatedAt);

      if (timeDiff <= 0 || timeDiff > 7200) {
        // user created more than 2 hours
        console.log("user created more than 2 hours");
        return;
      }

      // update invite relation
      console.log("update invite", inviteCode, user.uuid);
      const req = {
        invite_code: inviteCode,
        user_uuid: user.uuid,
      };
      const resp = await fetch("/api/update-invite", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      });
      if (!resp.ok) {
        throw new Error("update invite failed with status: " + resp.status);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      if (signal.aborted) return;
      if (data?.uuid === user.uuid) {
        setUser((current) =>
          current?.uuid === user.uuid ? { ...current, ...data } : current
        );
      }
      cacheRemove(CacheKey.InviteCode);
    } catch (e) {
      if (!signal.aborted) console.log("update invite failed: ", e);
    }
  };

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }

    const controller = new AbortController();
    void fetchUserInfo(userId, controller.signal);
    return () => controller.abort();
  }, [session, userId]);

  return (
    <AppContext.Provider
      value={{
        showSignModal,
        setShowSignModal,
        user: userId && user?.uuid === userId ? user : null,
        setUser,
        authStatus: authMounted ? authStatus : "loading",
        sessionUser: authMounted ? sessionUser : undefined,
        showFeedback,
        setShowFeedback,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
