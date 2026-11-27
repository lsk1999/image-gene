import type { Metadata } from "next";
import PaymentStatus from "@/components/payment-status";
export const metadata: Metadata = {
  title: "Payment confirmation",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ order_no?: string }>;
}) {
  const { order_no } = await searchParams;
  return (
    <PaymentStatus orderNo={typeof order_no === "string" ? order_no : ""} />
  );
}
