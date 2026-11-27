"use client";

import { Check, Loader } from "lucide-react";
import { PricingItem, Pricing as PricingType } from "@/types/blocks/pricing";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Icon from "@/components/icon";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/app";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Pricing({
  pricing,
  paymentMode,
  checkoutEnabled = false,
}: {
  pricing: PricingType;
  paymentMode?: "test" | "live";
  checkoutEnabled?: boolean;
}) {
  if (pricing.disabled) {
    return null;
  }

  const locale = useLocale();

  const { setShowSignModal } = useAppContext();
  const checkoutInFlight = useRef(false);

  const [group, setGroup] = useState(() => {
    // First look for a group with is_featured set to true
    const featuredGroup = pricing.groups?.find((g) => g.is_featured);
    // If no featured group exists, fall back to the first group
    return featuredGroup?.name || pricing.groups?.[0]?.name;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>();
  const packGroupName = useId();
  const visiblePacks = pricing.items?.filter((item) => !item.group || item.group === group) ?? [];
  const selectedPack = visiblePacks.find((item) => item.product_id === selectedPackId)
    ?? visiblePacks.find((item) => item.is_featured)
    ?? visiblePacks[0];

  const handleCheckout = async (item: PricingItem, cn_pay: boolean = false) => {
    if (!checkoutEnabled || checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setSelectedPackId(item.product_id);
    setIsLoading(true);
    setProductId(item.product_id);
    try {
      const params = {
        product_id: item.product_id,
        currency: cn_pay ? "cny" : item.currency,
        locale: locale || "en",
      };

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(45_000),
      });

      if (response.status === 401) {
        setIsLoading(false);
        setProductId(null);

        setShowSignModal(true);
        return;
      }

      const { code, message, data } = await response.json();
      if (!response.ok || code !== 0) {
        toast.error(message || "Could not start checkout. Please try again.");
        return;
      }

      const { checkout_url } = data;
      if (!checkout_url) {
        toast.error("checkout failed");
        return;
      }

      window.location.href = checkout_url;
    } catch (e) {
      toast.error("checkout failed");
    } finally {
      checkoutInFlight.current = false;
      setIsLoading(false);
      setProductId(null);
    }
  };

  return (
    <section id={pricing.name} className="bg-[#f7f8f4] py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            {pricing.title}
          </h2>
          <p className="mt-5 text-slate-600 lg:text-lg">
            {pricing.description}
          </p>
          {!checkoutEnabled && (
            <p className="mt-4 text-sm font-medium text-slate-700">
              {locale === "zh" ? "积分购买暂未开放。" : "Credit purchases are temporarily unavailable."}{" "}
              <Link href="/ai-kitchen-design" className="underline underline-offset-4">
                {locale === "zh" ? "免费试用厨房设计工具" : "Try the kitchen designer for free"}
              </Link>
            </p>
          )}
          {checkoutEnabled && paymentMode === "test" && (
            <p role="status" className="mt-4 text-sm font-medium text-slate-700">
              {locale === "zh" ? "测试结账，仅使用测试卡。" : "Test checkout. Use a test card only."}
            </p>
          )}
        </div>
        <div className="w-full flex flex-col items-center gap-1">
          {pricing.groups && pricing.groups.length > 1 && (
            <div className="mb-10 flex h-12 items-center rounded-full border border-slate-200 bg-white p-1 text-base shadow-sm">
              <RadioGroup
                value={group}
                className="h-full grid-cols-1"
                onValueChange={(value) => {
                  setGroup(value);
                }}
              >
                {pricing.groups.map((item, i) => {
                  return (
                    <div
                      key={i}
                      className='h-full rounded-full transition-all has-[button[data-state="checked"]]:bg-primary/10'
                    >
                      <RadioGroupItem
                        value={item.name || ""}
                        id={item.name}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={item.name}
                        className="flex h-full cursor-pointer items-center justify-center px-4 font-semibold text-muted-foreground peer-data-[state=checked]:text-primary"
                      >
                        {item.title}
                        {item.label && (
                          <Badge
                            variant="outline"
                            className="border-primary bg-primary px-1.5 ml-1 text-primary-foreground"
                          >
                            {item.label}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}
          <div className="mt-0 grid w-full max-w-6xl gap-5 md:grid-cols-3">
            {visiblePacks.map((item, index) => {
              const selected = item === selectedPack;
              const packInputId = `${packGroupName}-${index}`;

              return (
                <div
                  key={item.product_id}
                  className={`relative rounded-2xl border bg-white p-7 transition-shadow ${
                    selected
                      ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
                      : "border-slate-200 shadow-sm"
                  }`}
                >
                  <input
                    id={packInputId}
                    type="radio"
                    name={packGroupName}
                    checked={selected}
                    aria-label={item.title || item.product_id}
                    onChange={() => setSelectedPackId(item.product_id)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={packInputId}
                    className="absolute inset-0 cursor-pointer rounded-2xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary"
                  />
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        {item.title && (
                          <h3 className="text-lg font-semibold text-slate-950">
                            {item.title}
                          </h3>
                        )}
                        <div className="flex-1"></div>
                        {item.label && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary bg-primary px-2.5 py-1 text-primary-foreground"
                          >
                            {item.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-end gap-2 mb-4">
                        {item.original_price && (
                          <span className="text-xl text-muted-foreground font-semibold line-through">
                            {item.original_price}
                          </span>
                        )}
                        {item.price && (
                          <span className="text-5xl font-semibold tracking-[-0.04em] text-slate-950">
                            {item.price}
                          </span>
                        )}
                        {item.unit && (
                          <span className="block font-semibold">
                            {item.unit}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      )}
                      {item.features_title && (
                        <p className="mb-3 mt-6 font-semibold">
                          {item.features_title}
                        </p>
                      )}
                      {item.features && (
                        <ul className="flex flex-col gap-3 text-sm text-slate-700">
                          {item.features.map((feature, fi) => {
                            return (
                              <li className="flex gap-2" key={`feature-${fi}`}>
                                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50"><Check className="size-3 text-emerald-700" /></span>
                                {feature}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {checkoutEnabled && !paymentMode && item.cn_amount && item.cn_amount > 0 ? (
                        <button
                            type="button"
                            className="relative z-10 mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5"
                            disabled={isLoading}
                            onClick={() => {
                              if (isLoading) {
                                return;
                              }
                              handleCheckout(item, true);
                            }}
                          >
                            <span>{locale === "zh" ? "人民币支付" : "Pay in CNY"}</span>
                            <img
                              src="/imgs/cnpay.png"
                              alt="Chinese payment methods"
                              className="h-7 w-auto rounded-md object-contain"
                            />
                        </button>
                      ) : null}
                      {checkoutEnabled && item.button && (
                        <Button
                          className="relative z-10 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold"
                          disabled={isLoading}
                          onClick={() => {
                            if (isLoading) {
                              return;
                            }
                            handleCheckout(item);
                          }}
                        >
                          {(!isLoading ||
                            (isLoading && productId !== item.product_id)) && (
                            <p>{item.button.title}</p>
                          )}

                          {isLoading && productId === item.product_id && (
                            <p>{item.button.title}</p>
                          )}
                          {isLoading && productId === item.product_id && (
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {item.button.icon && (
                            <Icon name={item.button.icon} className="size-4" />
                          )}
                        </Button>
                      )}
                      {item.tip && (
                        <p className="text-muted-foreground text-sm mt-2">
                          {item.tip}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
