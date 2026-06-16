import { createClient } from "@/lib/supabase/server";
import { fsrs, type CardInput, type Grade } from "ts-fsrs";

const f = fsrs();

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "未登入" }, { status: 401 });
    }

    const body = await req.json();
    const { wordId, rating, reviewType, isCorrect, userAnswer, durationMs } =
      body as {
        wordId: string;
        rating: 1 | 2 | 3 | 4;
        reviewType: "flashcard" | "cloze";
        isCorrect: boolean | null;
        userAnswer: string | null;
        durationMs: number;
      };

    if (!wordId || ![1, 2, 3, 4].includes(rating)) {
      return Response.json({ error: "參數錯誤" }, { status: 400 });
    }

    const { data: word, error: fetchError } = await supabase
      .from("words")
      .select(
        "due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review"
      )
      .eq("id", wordId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !word) {
      return Response.json({ error: "找不到單字" }, { status: 404 });
    }

    const card: CardInput = {
      due: word.due ?? new Date().toISOString(),
      stability: word.stability ?? 0,
      difficulty: word.difficulty ?? 0,
      elapsed_days: word.elapsed_days ?? 0,
      scheduled_days: word.scheduled_days ?? 0,
      learning_steps: 0,
      reps: word.reps ?? 0,
      lapses: word.lapses ?? 0,
      state: word.state ?? 0,
      last_review: word.last_review ?? null,
    };

    const now = new Date();
    const result = f.next(card, now, rating as Grade);
    const newCard = result.card;

    const { error: updateError } = await supabase
      .from("words")
      .update({
        due: newCard.due.toISOString(),
        stability: newCard.stability,
        difficulty: newCard.difficulty,
        elapsed_days: newCard.elapsed_days,
        scheduled_days: newCard.scheduled_days,
        reps: newCard.reps,
        lapses: newCard.lapses,
        state: newCard.state,
        last_review: now.toISOString(),
      })
      .eq("id", wordId)
      .eq("user_id", user.id);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    const { error: logError } = await supabase.from("review_logs").insert({
      word_id: wordId,
      user_id: user.id,
      rating,
      review_type: reviewType,
      is_correct: isCorrect,
      user_answer: userAnswer,
      duration_ms: durationMs,
    });

    if (logError) {
      return Response.json({ error: logError.message }, { status: 500 });
    }

    return Response.json({ success: true, nextDue: newCard.due.toISOString() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "未知錯誤" },
      { status: 500 }
    );
  }
}
