import { CreditsAmount, CreditsTransType } from "./credit";
import { findUserByUuid } from "@/models/user";

import { User } from "@/types/user";
import { auth } from "@/auth";
import { getOneYearLaterTimestr } from "@/lib/time";
import { getUserUuidByApiKey } from "@/models/apikey";
import { headers } from "next/headers";
import { credits, users } from "@/db/schema";
import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { getUuid } from "@/lib/hash";

// save user to database, if user not exist, create a new user
export async function saveUser(user: User) {
  try {
    if (!user.email) {
      throw new Error("invalid user email");
    }

    return await db().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7301, hashtext(${user.email}))`);
      const [existing] = await tx.select().from(users).where(eq(users.email, user.email)).limit(1);
      if (existing) return existing as unknown as User;

      const [created] = await tx.insert(users).values({ ...user, uuid: user.uuid || getUuid() } as typeof users.$inferInsert).returning();
      await tx.insert(credits).values({
        trans_no: `trial:${created.uuid}`,
        user_uuid: created.uuid,
        trans_type: CreditsTransType.NewUser,
        credits: CreditsAmount.NewUserGet,
        created_at: new Date(),
        expired_at: new Date(getOneYearLaterTimestr()),
        order_no: "",
      });
      return created as unknown as User;
    });
  } catch (e) {
    console.log("save user failed: ", e);
    throw e;
  }
}

export async function getUserUuid() {
  let user_uuid = "";

  const token = await getBearerToken();

  if (token) {
    // api key
    if (token.startsWith("sk-")) {
      const user_uuid = await getUserUuidByApiKey(token);

      return user_uuid || "";
    }
  }

  const session = await auth();
  if (session && session.user && session.user.uuid) {
    user_uuid = session.user.uuid;
  }

  return user_uuid;
}

export async function getBearerToken() {
  const h = await headers();
  const auth = h.get("Authorization");
  if (!auth) {
    return "";
  }

  return auth.replace("Bearer ", "");
}

export async function getUserEmail() {
  let user_email = "";

  const session = await auth();
  if (session && session.user && session.user.email) {
    user_email = session.user.email;
  }

  return user_email;
}

export async function getUserInfo() {
  let user_uuid = await getUserUuid();

  if (!user_uuid) {
    return;
  }

  const user = await findUserByUuid(user_uuid);

  return user;
}
