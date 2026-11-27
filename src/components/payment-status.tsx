"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAppContext } from "@/contexts/app";
import { useLocale } from "next-intl";
export default function PaymentStatus({ orderNo }: { orderNo: string }) {
  const zh = useLocale() === "zh";
  const { sessionUser, setUser } = useAppContext();
  const uuid = sessionUser?.uuid;
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!uuid || (status !== "paid" && status !== "refunded")) return;
    const controller = new AbortController();
    void fetch("/api/get-user-info", {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((result) => {
        if (
          !controller.signal.aborted &&
          result?.code === 0 &&
          result.data?.uuid === uuid
        )
          setUser(result.data);
      })
      .catch(() => {
        /* A balance refresh must not change the confirmed payment state. */
      });
    return () => controller.abort();
  }, [status, uuid, setUser]);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    setStatus("checking");
    async function check() {
      try {
        const response = await fetch(
          `/api/pay/status/waffo?order_no=${encodeURIComponent(orderNo)}`,
          {
            signal: AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(10_000),
            ]),
            cache: "no-store",
          },
        );
        if (!response.ok) {
          if (abort.signal.aborted) return;
          setStatus(response.status === 401 ? "signin" : "unavailable");
          return;
        }
        const data = await response.json();
        if (abort.signal.aborted) return;
        if (data.status === "paid") {
          setStatus("paid");
          return;
        }
        if (data.status === "refunded") {
          setStatus("refunded");
          return;
        }
        if (++count >= 12) {
          setStatus("pending");
          return;
        }
        timer = setTimeout(check, 2500);
      } catch {
        if (!abort.signal.aborted) setStatus("unavailable");
      }
    }
    if (orderNo) void check();
    else setStatus("unavailable");
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [orderNo, attempt]);
  return (
    <section className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold">
        {status === "paid"
          ? zh
            ? "积分已到账"
            : "Your credits are ready"
          : zh
            ? "付款确认"
            : "Payment confirmation"}
      </h1>
      <p role="status" className="my-6 leading-7 text-slate-600">
        {zh
          ? status === "paid"
            ? "付款已确认，积分已加入你的账户。"
            : status === "checking"
              ? "正在等待安全的付款确认，请稍候。"
              : status === "signin"
                ? "请登录付款时使用的账户，然后再次查询。"
                : status === "refunded"
                  ? "此订单已退款。如需帮助，请联系支持。"
                  : "暂未收到付款确认，这不代表付款失败。请再次查询或联系支持，先不要重复付款。"
          : status === "paid"
            ? "Your payment is confirmed and your credits have been added to your account."
            : status === "checking"
              ? "We’re waiting for secure payment confirmation. Please keep this page open."
              : status === "signin"
                ? "Sign in to the account used for this purchase, then check again."
                : status === "refunded"
                  ? "This purchase has a refund record. Contact support if you need help."
                  : "We haven’t confirmed this purchase yet. This does not mean your payment failed. Please check again or contact support before paying a second time."}
      </p>
      {status !== "paid" && status !== "checking" && (
        <button
          type="button"
          onClick={() => setAttempt((x) => x + 1)}
          className="mb-5 rounded-lg border px-5 py-3"
        >
          {zh ? "再次查询" : "Check again"}
        </button>
      )}
      <div className="flex flex-wrap justify-center gap-5">
        {status === "signin" && (
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`${zh ? "/zh" : ""}/payment-status?order_no=${encodeURIComponent(orderNo)}`)}`}
            className="font-semibold underline"
          >
            {zh ? "登录" : "Sign in"}
          </Link>
        )}
        <a
          href={`${zh ? "/zh" : ""}/ai-kitchen-design`}
          className="font-semibold text-primary underline"
        >
          {zh ? "打开厨房设计工具" : "Open kitchen designer"}
        </a>
        <Link href="/my-orders" className="underline">
          {zh ? "我的订单" : "My orders"}
        </Link>
        <a href="mailto:support@aidesignkitchen.com" className="underline">
          {zh ? "联系支持" : "Contact support"}
        </a>
      </div>
    </section>
  );
}
