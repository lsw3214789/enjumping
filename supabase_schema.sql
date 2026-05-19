-- ============================================================
-- 單字學習 App 資料庫 Schema
-- 直接複製整份貼到 Supabase SQL Editor 執行
-- ============================================================

-- 1. 使用者設定表（記錄個人偏好）
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_review_target INT DEFAULT 20,          -- 每日複習目標單字數
  notification_email TEXT,                      -- 推播 Email
  notification_time TIME DEFAULT '09:00:00',    -- 推播時間
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 單字庫主表（核心）
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 單字資訊
  word TEXT NOT NULL,                          -- 英文單字本身
  ipa TEXT,                                    -- KK 音標
  pos TEXT,                                    -- 詞性：noun/verb/adj/adv
  translation TEXT NOT NULL,                   -- 中文翻譯
  variants JSONB DEFAULT '[]'::jsonb,          -- 其他詞性變化：[{word, pos, meaning}]
  examples JSONB DEFAULT '[]'::jsonb,          -- 3 個例句：[{en, zh, scene}]
  synonyms JSONB DEFAULT '[]'::jsonb,          -- 同義詞辨析：[{word, diff, example}]
  
  -- 來源資訊
  source_text TEXT,                            -- 原始句子（從哪段話抓出來的）
  source_type TEXT,                            -- 'browser'/'subtitle'/'ocr'/'manual'
  tags TEXT[] DEFAULT '{}',                    -- 標籤：商務/日常/旅遊
  
  -- FSRS 記憶曲線欄位（複習演算法用）
  due TIMESTAMPTZ DEFAULT NOW(),               -- 下次該複習時間
  stability REAL DEFAULT 0,                    -- 記憶穩定度
  difficulty REAL DEFAULT 0,                   -- 難度
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,                          -- 累積複習次數
  lapses INT DEFAULT 0,                        -- 答錯次數
  state SMALLINT DEFAULT 0,                    -- 0=新卡 1=學習中 2=複習中 3=重學
  last_review TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, word)                        -- 同一使用者不重複同一個單字
);

-- 加速查詢的索引
CREATE INDEX idx_words_user_due ON words(user_id, due);
CREATE INDEX idx_words_user_state ON words(user_id, state);
CREATE INDEX idx_words_user_tags ON words USING GIN(tags);

-- 3. 複習紀錄表（學習數據 + 錯題本用）
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  rating SMALLINT NOT NULL,                    -- 1=Again 2=Hard 3=Good 4=Easy
  review_type TEXT NOT NULL,                   -- 'choice'/'cloze'/'dictation'/'speaking'
  is_correct BOOLEAN,
  user_answer TEXT,                            -- 使用者實際答案
  duration_ms INT,                             -- 作答秒數
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_user_word ON review_logs(user_id, word_id);
CREATE INDEX idx_logs_created ON review_logs(created_at);

-- ============================================================
-- 4. Row Level Security（資料隔離，超重要，每個人只能看自己的資料）
-- ============================================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own words" ON words
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own logs" ON review_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. 自動建立 user_settings：新使用者註冊時自動產生一筆設定
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, notification_email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
