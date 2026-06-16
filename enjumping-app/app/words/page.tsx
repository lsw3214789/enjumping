import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import WordsList from "./WordsList";

export default async function WordsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: words } = await supabase
    .from("words")
    .select("id, word, ipa, pos, translation, tags, due, state, examples, synonyms, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              ← 回首頁
            </Link>
            <Link
              href="/review"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              開始複習
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-3">
            我的單字庫
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{words?.length ?? 0} 個單字</p>
        </div>
        <WordsList words={words ?? []} />
      </div>
    </main>
  );
}
