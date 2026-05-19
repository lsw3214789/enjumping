import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "未登入" }, { status: 401 });
  }

  const body = await req.json();
  const { word, ipa, pos, translation, variants, examples, synonyms, source_text } = body;

  const { data, error } = await supabase
    .from("words")
    .insert([
      {
        user_id: user.id,
        word,
        ipa,
        pos,
        translation,
        variants: variants ?? [],
        examples: examples ?? [],
        synonyms: synonyms ?? [],
        source_text: source_text ?? null,
        source_type: "manual",
      },
    ])
    .select("id")
    .single();

  if (error) {
    // unique violation: 同一使用者同一單字已存在
    if (error.code === "23505") {
      return Response.json({ error: "已經在單字庫了" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id });
}
