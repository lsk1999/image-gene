import { Footer as FooterType } from "@/types/blocks/footer";
import Icon from "@/components/icon";
import { Link } from "@/i18n/navigation";
import { Mail, Sparkles } from "lucide-react";

export default function Footer({ footer }: { footer: FooterType }) {
  if (footer.disabled) {
    return null;
  }

  return (
    <footer id={footer.name} className="border-t border-slate-200 bg-slate-50 text-slate-900">
      <div className="container py-10 sm:py-14">
          <div className="grid items-start gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              {footer.brand && (
                <div>
                  <div className="flex items-center gap-3">
                    {footer.brand.logo?.src ? (
                      <img
                        src={footer.brand.logo.src}
                        alt={footer.brand.logo.alt || footer.brand.title}
                        className="h-11"
                      />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    {footer.brand.title && (
                      <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                        {footer.brand.title}
                      </p>
                    )}
                  </div>
                  {footer.brand.description && (
                    <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
                      {footer.brand.description}
                    </p>
                  )}
                </div>
              )}
              {footer.social && (
                <ul className="flex items-center space-x-6 text-muted-foreground">
                  {footer.social.items?.map((item, i) => (
                    <li key={i} className="font-medium hover:text-primary">
                      <a href={item.url || ""} target={item.target}>
                        {item.icon && (
                          <Icon name={item.icon} className="size-4" />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              {footer.nav?.items?.map((item, i) => (
                <div key={i}>
                  <p className="mb-3 text-sm font-semibold">{item.title}</p>
                  <ul className="space-y-2.5 text-sm leading-6 text-slate-600">
                    {item.children?.map((iitem, ii) => (
                      <li key={ii} className="hover:text-slate-950 hover:underline">
                        <Link href={iitem.url || ""} target={iitem.target}>
                          {iitem.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {footer.agreement && (
                <div>
                  <p className="mb-3 text-sm font-semibold">{footer.agreementTitle}</p>
                  <ul className="space-y-2.5 text-sm leading-6 text-slate-600">
                    {footer.agreement.items?.map((item, i) => (
                      <li key={i}>
                        <a href={item.url || ""} target={item.target} className="hover:text-slate-950 hover:underline">
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {footer.support && (
              <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-1">
                <Mail className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{footer.support.title}</p>
                  <p className="mt-1 select-all break-all text-sm leading-6 text-slate-700" dir="ltr">{footer.support.email}</p>
                </div>
              </div>
            )}
          </div>
          {footer.copyright && (
            <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-600">
              {footer.copyright}
            </p>
          )}
      </div>
    </footer>
  );
}
