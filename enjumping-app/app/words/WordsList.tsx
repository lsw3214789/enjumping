"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Example {
  scene: string;
  en: string;
  zh: string;
}

interface Synonym {
  word: string;
  diff: string;
  compare_example?: { en: string; zh: string };
}

interface Word {
  id: string;
  word: string;
  ipa: string | null;
  pos: string | null;
  translation: string;
  tags: string[] | null;
  due: string | null;
  state: number | null;
  examples: Example[] | null;
  synonyms: Synonym[] | null;
  created_at: string;
}

const sceneLabel: Record<string, string> = {
  business: "商務",
  humor: "幽默",
  daily: "日常",
};

function formatDue(due: string | null): string {
  if (!due) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "short",
    day: "numeric",
  }).format(new Date(due));
}

function WordCard({
  word,
  onDelete,
}: {
  word: Word;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`確定要刪除「${word.word}」嗎？`)) return;
    setDeleting(true);
    const res = await fetch(`/api/words/${word.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete(word.id);
    } else {
      alert("刪除失敗，請稍後再試");
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3">
      {/* 上排 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {word.word}
          </span>
          {word.ipa && (
            <span className="text-xs text-zinc-400">{word.ipa}</span>
          )}
          {word.pos && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium px-2 py-0.5">
              {word.pos}
            </span>
          )}
        </div>
      </div>

      {/* 中排：中文 */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{word.translation}</p>

      {/* 下排：tags + due + 按鈕 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {word.tags && word.tags.length > 0 &&
            word.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-zinc-400 border-zinc-200 dark:border-zinc-700"
              >
                {tag}
              </Badge>
            ))}
          <span className="text-[11px] text-zinc-400">
            下次複習：{formatDue(word.due)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {expanded ? "收起" : "展開"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {deleting ? "刪除中..." : "刪除"}
          </button>
        </div>
      </div>

      {/* 展開區塊 */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-4">
          {/* 例句 */}
          {word.examples && word.examples.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                例句
              </p>
              <div className="space-y-2">
                {word.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-zinc-50 dark:bg-zinc-800 px-3 py-2"
                  >
                    <span className="inline-block text-[10px] font-medium text-zinc-400 bg-zinc-200 dark:bg-zinc-700 rounded px-1 mb-0.5">
                      {sceneLabel[ex.scene] ?? ex.scene}
                    </span>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{ex.en}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{ex.zh}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 同義詞辨析 */}
          {word.synonyms && word.synonyms.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                同義詞辨析
              </p>
              <div className="space-y-2">
                {word.synonyms.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {s.word}
                    </span>{" "}
                    <span className="text-zinc-500 text-xs">— {s.diff}</span>
                    {s.compare_example && (
                      <p className="mt-1 text-xs text-zinc-400 italic">
                        {s.compare_example.en} / {s.compare_example.zh}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WordsList({ words: initialWords }: { words: Word[] }) {
  const [words, setWords] = useState(initialWords);
  const [query, setQuery] = useState("");

  const filtered = words.filter((w) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      w.word.toLowerCase().includes(q) ||
      w.translation.toLowerCase().includes(q)
    );
  });

  function handleDelete(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="space-y-5">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋單字或中文意思…"
        className="max-w-sm"
      />

      {words.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="mb-2">還沒有單字</p>
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-300 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
          >
            去首頁加幾個吧
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-400 py-10 text-center">
          找不到「{query}」相關的單字
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((w) => (
            <WordCard key={w.id} word={w} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
