"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Example {
  scene: string;
  en: string;
  zh: string;
}

interface ReviewCard {
  id: string;
  word: string;
  ipa: string | null;
  pos: string | null;
  translation: string;
  examples: Example[] | null;
}

const RATINGS = [
  {
    value: 1 as const,
    en: "Again",
    zh: "忘記",
    className:
      "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  },
  {
    value: 2 as const,
    en: "Hard",
    zh: "勉強",
    className:
      "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900",
  },
  {
    value: 3 as const,
    en: "Good",
    zh: "順",
    className:
      "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
  },
  {
    value: 4 as const,
    en: "Easy",
    zh: "太簡單",
    className:
      "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900",
  },
];

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardShownAt = useRef<number>(Date.now());

  useEffect(() => {
    async function fetchDueCards() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("words")
        .select("id, word, ipa, pos, translation, examples")
        .lte("due", new Date().toISOString())
        .order("due", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setCards(data ?? []);
        cardShownAt.current = Date.now();
      }
      setLoading(false);
    }
    fetchDueCards();
  }, []);

  function handleShowAnswer() {
    setShowAnswer(true);
  }

  async function handleRate(rating: 1 | 2 | 3 | 4) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const card = cards[currentIndex];
    const durationMs = Date.now() - cardShownAt.current;

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordId: card.id,
          rating,
          reviewType: "flashcard",
          isCorrect: null,
          userAnswer: null,
          durationMs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "送出失敗，請重試");
        setSubmitting(false);
        return;
      }

      setShowAnswer(false);
      setCurrentIndex((i) => i + 1);
      cardShownAt.current = Date.now();
    } catch {
      setError("網路錯誤，請重試");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-sm">載入中...</p>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
            今天沒有要複習的卡片
          </p>
          <p className="text-sm text-zinc-400 mb-6">所有單字都已複習完畢！</p>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
            複習完成！
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            共完成 {cards.length} 張卡片
          </p>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  const card = cards[currentIndex];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            ← 回首頁
          </Link>
          <span className="text-sm text-zinc-400">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8">
          <div
            className="h-1 bg-zinc-500 dark:bg-zinc-400 rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / cards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 mb-5 min-h-[220px] flex flex-col justify-center">
          {/* Front */}
          <div className="text-center">
            <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">
              {card.word}
            </p>
            {card.ipa && (
              <p className="text-zinc-400 text-base">{card.ipa}</p>
            )}
          </div>

          {/* Back */}
          {showAnswer && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 mt-6 pt-6 space-y-4">
              <div className="text-center">
                {card.pos && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium px-2.5 py-0.5 mb-2">
                    {card.pos}
                  </span>
                )}
                <p className="text-xl text-zinc-700 dark:text-zinc-300 font-medium">
                  {card.translation}
                </p>
              </div>

              {card.examples?.[0] && (
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
                  <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                    {card.examples[0].en}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {card.examples[0].zh}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center mb-3">{error}</p>
        )}

        {/* Action */}
        {!showAnswer ? (
          <Button className="w-full" onClick={handleShowAnswer}>
            顯示答案
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map(({ value, en, zh, className }) => (
              <button
                key={value}
                onClick={() => handleRate(value)}
                disabled={submitting}
                className={`rounded-xl px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
              >
                <span className="block text-[10px] opacity-60 mb-0.5">{en}</span>
                {zh}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
