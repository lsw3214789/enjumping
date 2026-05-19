import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/words/[id]">
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "未登入" }, { status: 401 });
  }

  const { error } = await supabase
    .from("words")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
