import {
  getUserValidCredits,
  insertCredit,
} from "@/models/credit";
import { credits as creditsTable } from "@/db/schema";
import { db } from "@/db";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getIsoTimestr } from "@/lib/time";
import { getSnowId } from "@/lib/hash";
import { Order } from "@/types/order";
import { UserCredits } from "@/types/user";
import { getFirstPaidOrderByUserUuid } from "@/models/order";

export enum CreditsTransType {
  NewUser = "new_user", // initial credits for new user
  OrderPay = "order_pay", // user pay for credits
  SystemAdd = "system_add", // system add credits
  Ping = "ping", // cost for ping api
  KitchenDesign = "kitchen_design",
}

export enum CreditsAmount {
  NewUserGet = 1,
  PingCost = 1,
}

type CreditTransaction = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

export async function lockCredits(tx: CreditTransaction, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(7302, hashtext(${userId}))`);
}

// Caller holds the user's credit lock until the transaction ends.
export async function spendCredits(tx: CreditTransaction, userId: string, amount: number, type: CreditsTransType, transactionId: string) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error("Invalid credit amount.");
  const now = new Date();
  const rows = await tx.select().from(creditsTable)
    .where(and(eq(creditsTable.user_uuid, userId), gte(creditsTable.expired_at, now)))
    .orderBy(asc(creditsTable.expired_at), asc(creditsTable.id));
  if (rows.reduce((balance, row) => balance + row.credits, 0) < amount) return false;

  const grants = new Map<string, { order: string; expires: Date; balance: number }>();
  for (const row of rows) {
    if (!row.expired_at) continue;
    const order = row.order_no || "";
    const key = JSON.stringify([order, row.expired_at.toISOString()]);
    const grant = grants.get(key);
    if (grant) grant.balance += row.credits;
    else grants.set(key, { order, expires: row.expired_at, balance: row.credits });
  }

  let remaining = amount;
  let part = 0;
  for (const grant of grants.values()) {
    if (grant.balance <= 0) continue;
    const used = Math.min(grant.balance, remaining);
    await tx.insert(creditsTable).values({
      trans_no: part === 0 ? transactionId : `${transactionId}:${part}`,
      user_uuid: userId,
      trans_type: type,
      credits: -used,
      order_no: grant.order,
      expired_at: grant.expires,
      created_at: now,
    });
    remaining -= used;
    part += 1;
    if (remaining === 0) return true;
  }
  throw new Error("Credit ledger is inconsistent.");
}

export async function getUserCredits(user_uuid: string): Promise<UserCredits> {
  let user_credits: UserCredits = {
    left_credits: 0,
  };

  try {
    const first_paid_order = await getFirstPaidOrderByUserUuid(user_uuid);
    if (first_paid_order) {
      user_credits.is_recharged = true;
    }

    const credits = await getUserValidCredits(user_uuid);
    if (credits) {
      credits.forEach((v) => {
        user_credits.left_credits += v.credits || 0;
      });
    }

    if (user_credits.left_credits < 0) {
      user_credits.left_credits = 0;
    }

    if (user_credits.left_credits > 0) {
      user_credits.is_pro = true;
    }

    return user_credits;
  } catch (e) {
    console.log("get user credits failed: ", e);
    return user_credits;
  }
}

export async function decreaseCredits({
  user_uuid,
  trans_type,
  credits,
}: {
  user_uuid: string;
  trans_type: CreditsTransType;
  credits: number;
}) {
  try {
    await db().transaction(async (tx) => {
      await lockCredits(tx, user_uuid);
      if (!(await spendCredits(tx, user_uuid, credits, trans_type, getSnowId()))) {
        throw new Error("Not enough credits.");
      }
    });
  } catch (e) {
    console.log("decrease credits failed: ", e);
    throw e;
  }
}

export async function increaseCredits({
  user_uuid,
  trans_type,
  credits,
  expired_at,
  order_no,
}: {
  user_uuid: string;
  trans_type: string;
  credits: number;
  expired_at?: string;
  order_no?: string;
}) {
  try {
    const new_credit: typeof creditsTable.$inferInsert = {
      trans_no: getSnowId(),
      created_at: new Date(getIsoTimestr()),
      user_uuid: user_uuid,
      trans_type: trans_type,
      credits: credits,
      order_no: order_no || "",
      expired_at: expired_at ? new Date(expired_at) : null,
    };
    await insertCredit(new_credit);
  } catch (e) {
    console.log("increase credits failed: ", e);
    throw e;
  }
}

export async function updateCreditForOrder(order: Order) {
  try {
    await db().transaction(async (tx) => {
      await lockCredits(tx, order.user_uuid);
      const [issued] = await tx.select({ id: creditsTable.id }).from(creditsTable)
        .where(and(eq(creditsTable.order_no, order.order_no), eq(creditsTable.trans_type, CreditsTransType.OrderPay)))
        .limit(1);
      if (issued) return;
      await tx.insert(creditsTable).values({
        trans_no: `order:${order.order_no}`,
        user_uuid: order.user_uuid,
        trans_type: CreditsTransType.OrderPay,
        credits: order.credits,
        expired_at: order.expired_at ? new Date(order.expired_at) : null,
        created_at: new Date(),
        order_no: order.order_no,
      });
    });
  } catch (e) {
    console.log("update credit for order failed: ", e);
    throw e;
  }
}
