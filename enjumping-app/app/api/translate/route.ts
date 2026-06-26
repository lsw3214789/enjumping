import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `你是一位專業且幽默的英文學習助理。
服務對象：A2 程度的繁體中文使用者，目標 B2。

【任務】
當使用者輸入一段英文（可能是單字、句子或段落），請依下列規則回應，並以 **嚴格的 JSON 格式** 輸出，禁止任何額外文字、不要用 markdown 包覆。

【JSON 結構】
{
  "translation": "整段流暢的繁體中文翻譯",
  "words": [
    {
      "word": "英文單字（原型）",
      "ipa": "/KK 音標/",
      "pos": "noun | verb | adj | adv | phrase",
      "translation": "中文意思（精簡）",
      "level": "A2 | B1 | B2",
      "variants": [
        { "word": "其他詞性的同根字", "pos": "詞性", "meaning": "中文意思" }
      ],
      "examples": [
        { "scene": "business", "en": "商務情境例句", "zh": "中文翻譯" },
        { "scene": "humor", "en": "日常幽默情境例句（要真的好笑、有畫面）", "zh": "中文翻譯" },
        { "scene": "daily", "en": "一般日常例句", "zh": "中文翻譯" }
      ],
      "synonyms": [
        {
          "word": "易混淆同義詞",
          "diff": "用 1-2 句話說明語境/語氣/搭配上的差異",
          "compare_example": { "en": "對比例句", "zh": "中文翻譯" }
        }
      ]
    }
  ]
}

【篩選規則】
- 只挑 A2–B2 程度的「值得學」單字，最多 8 個
- 已經太簡單的（is、the、go、good）跳過
- 太難或太冷門（B2 以上、專業術語）也跳過，除非使用者輸入的就是要查那個字
- 片語（phrasal verb / idiom）也算單字，pos 標 "phrase"

【例句品質要求】
- 商務例句：真的會在 email/會議出現的句子，不要罐頭
- 幽默例句：要有畫面、有反差或自嘲，避免冷掉的尷尬笑話
- 句子長度控制在 8-15 字，符合 A2-B2 程度
- 同義詞辨析要點出實際語境差異（formality / connotation / collocation）

【其他】
- 中文一律使用繁體
- 若使用者只輸入單一個字，translation 欄位放該字的中文意思即可
- 嚴格只輸出 JSON，前後不要加任何說明文字`;

const MODEL_NAME = "gemini-2.5-flash-lite";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(text: string) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });

  const result = await model.generateContent(text);
  const response = result.response;

  // Step 4: detect safety filter or empty candidates
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    const blockReason = response.promptFeedback?.blockReason;
    console.error(
      "[translate] Gemini returned no candidates. blockReason:",
      blockReason ?? "none",
      "promptFeedback:",
      JSON.stringify(response.promptFeedback)
    );
    throw new Error(`Gemini response empty or blocked (${blockReason ?? "unknown"})`);
  }

  // Step 2: isolate JSON.parse so we can log rawText on failure
  let rawText: string;
  try {
    rawText = response.text();
  } catch (textErr) {
    console.error("[translate] response.text() threw:", textErr);
    console.error("[translate] candidates[0].finishReason:", candidates[0]?.finishReason);
    throw textErr;
  }

  try {
    return JSON.parse(rawText);
  } catch (parseErr) {
    console.error("[translate] JSON.parse failed. rawText (first 500 chars):", rawText.slice(0, 500));
    throw parseErr;
  }
}

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({ text: null }));

  if (!text?.trim()) {
    return Response.json({ error: "請輸入英文文字" }, { status: 400 });
  }

  const MAX_ATTEMPTS = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[translate] retry attempt ${attempt} for input: "${text.slice(0, 80)}"`);
        await delay(500);
      }

      const json = await callGemini(text);
      return Response.json(json);
    } catch (error) {
      lastError = error;
      // Step 1: log full error details on every failure
      console.error(
        `[translate] attempt ${attempt}/${MAX_ATTEMPTS} failed.`,
        "message:", error instanceof Error ? error.message : String(error),
        "error:", error
      );
    }
  }

  // Both attempts failed — return friendly message, full details already in logs
  return Response.json({ error: "AI 翻譯失敗，請稍後再試" }, { status: 500 });
}
