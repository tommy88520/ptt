-- 對應原本 DynamoDB 的表（rate_limits 改用頻道 webhook 後不需要了），欄位名稱改成 snake_case。
-- 可重複執行：psql -d ptt -f db/schema.sql

SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS articles (
  article_id  TEXT PRIMARY KEY,
  board       TEXT NOT NULL,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  post_date   TEXT NOT NULL DEFAULT '',
  post_time   TEXT NOT NULL DEFAULT '',
  push_count  TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  scraped_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- article_id 形如 M.<unix秒>.A.xxx，字串排序等於時間排序（跟原本 GSI 的排序方式一樣）
CREATE INDEX IF NOT EXISTS articles_board_article_id_idx ON articles (board, article_id DESC);

-- category：'' = 不限、'販售'、'徵求'（比對規則在 app/services/categories.ts）
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id     TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, keyword, category)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscriptions' AND column_name = 'category') THEN
    ALTER TABLE subscriptions ADD COLUMN category TEXT NOT NULL DEFAULT '';
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_pkey;
    ALTER TABLE subscriptions ADD PRIMARY KEY (user_id, keyword, category);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS page_views (
  path   TEXT NOT NULL,
  date   DATE NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (path, date)
);
