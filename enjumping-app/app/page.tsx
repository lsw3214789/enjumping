import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TranslateForm from "@/components/TranslateForm";
import SignOutButton from "@/components/SignOutButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Enjumping
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 hidden sm:block">{user.email}</span>
              <Link
                href="/review"
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                開始複習
              </Link>
              <Link
                href="/words"
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                我的單字庫
              </Link>
              <SignOutButton />
            </div>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            貼入英文句子或單字，AI 幫你拆解、翻譯、生成例句
          </p>
        </div>
        <TranslateForm />
      </div>
    </main>
  );
}
