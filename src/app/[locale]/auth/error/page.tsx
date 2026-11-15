import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function AuthErrorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const chinese = locale === "zh";

  return (
    <main className="grid min-h-svh place-items-center bg-muted px-6 py-12">
      <section className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-8">
        <h1 className="text-2xl font-semibold">
          {chinese ? "登录未完成" : "Sign-in could not be completed"}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {chinese
            ? "请重新发起登录。如果多次失败，请稍后再试。"
            : "Start a new sign-in attempt. If the issue persists, try again later."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/auth/signin">{chinese ? "重新登录" : "Try signing in again"}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{chinese ? "返回首页" : "Back to home"}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
