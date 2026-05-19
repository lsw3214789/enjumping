"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WordVariant {
  word: string;
  pos: string;
  meaning: string;
}

interface WordExample {
  scene: string;
  en: string;
  zh: string;
}

interface WordSynonym {
  word: string;
  diff: string;
  compare_example: { en: string; zh: string };
}

interface WordData {
  word: string;
  ipa: string;
  pos: string;
  translation: string;
  level: string;
  variants: WordVariant[];
  examples: WordExample[];
  synonyms: WordSynonym[];
}

interface TranslateResult {
  translation: string;
  words: WordData[];
}

const sceneLabel: Record<string, string> = {
  business: "商務",
  humor: "幽默",
  daily: "日常",
};

const levelColor: Record<string, string> = {
  A2: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B2: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function TranslateForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordStatus, setWordStatus] = useState<Record<string, "saving" | "saved" | "exists">>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setWordStatus({});

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "翻譯失敗");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWord(wordData: WordData) {
    setWordStatus((prev) => ({ ...prev, [wordData.word]: "saving" }));

    const res = await fetch("/api/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: wordData.word,
        ipa: wordData.ipa,
        pos: wordData.pos,
        translation: wordData.translation,
        variants: wordData.variants,
        examples: wordData.examples,
        synonyms: wordData.synonyms,
        source_text: text,
      }),
    });

    if (res.status === 409) {
      setWordStatus((prev) => ({ ...prev, [wordData.word]: "exists" }));
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "儲存失敗");
      setWordStatus((prev) => {
        const next = { ...prev };
        delete next[wordData.word];
        return next;
      });
      return;
    }
    setWordStatus((prev) => ({ ...prev, [wordData.word]: "saved" }));
  }

  function saveButtonLabel(word: string) {
    const s = wordStatus[word];
    if (s === "saving") return "儲存中...";
    if (s === "saved") return "已加入";
    if (s === "exists") return "已在單字庫";
    return "+ 加入單字庫";
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="輸入英文單字或句子，例如：The CEO announced a pivot in strategy."
          className="flex-1"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !text.trim()}>
          {loading ? "分析中..." : "分析"}
        </Button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* 整段翻譯 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">整段翻譯</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                {result.translation}
              </p>
            </CardContent>
          </Card>

          {/* 單字卡片 */}
          {result.words.map((w) => (
            <Card key={w.word} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                        {w.word}
                      </span>
                      <span className="text-sm text-zinc-400">{w.ipa}</span>
                      <Badge variant="outline" className="text-xs">
                        {w.pos}
                      </Badge>
                      {w.level && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelColor[w.level] ?? ""}`}
                        >
                          {w.level}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm">
                      {w.translation}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={
                      wordStatus[w.word] === "saved" || wordStatus[w.word] === "exists"
                        ? "outline"
                        : "default"
                    }
                    onClick={() => handleSaveWord(w)}
                    disabled={!!wordStatus[w.word]}
                    className="shrink-0"
                  >
                    {saveButtonLabel(w.word)}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 例句 */}
                {w.examples.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      例句
                    </p>
                    <div className="space-y-2">
                      {w.examples.map((ex, i) => (
                        <div key={i} className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-200 dark:bg-zinc-700 rounded px-1">
                              {sceneLabel[ex.scene] ?? ex.scene}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">{ex.en}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{ex.zh}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 詞形變化 */}
                {w.variants.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      詞形變化
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {w.variants.map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 text-xs"
                        >
                          <span className="font-medium">{v.word}</span>
                          <span className="text-zinc-400">{v.pos}</span>
                          <span className="text-zinc-500">— {v.meaning}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 同義詞辨析 */}
                {w.synonyms.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      同義詞辨析
                    </p>
                    <div className="space-y-2">
                      {w.synonyms.map((s, i) => (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
