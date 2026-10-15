-- =============================================================================
-- Migration: 建立獨立社群身分關聯表 (user_social_accounts)
-- 適用於：Facebook, Google, LINE, Apple 多重第三方登入與帳號綁定管理 (方案 B)
-- =============================================================================

-- 1. 建立資料表
CREATE TABLE IF NOT EXISTS public.user_social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                  -- 'facebook' | 'google' | 'line' | 'apple'
    provider_user_id TEXT NOT NULL,         -- 第三方平台唯一代碼 (sub / openid)
    provider_email TEXT,                    -- 該社群帳號的 Email
    provider_name TEXT,                     -- 該社群顯示姓名 (如 "Lucissi Chen")
    avatar_url TEXT,                        -- 該社群大頭照網址
    raw_data JSONB DEFAULT '{}'::jsonb,     -- 第三方中繼資料備用
    last_sign_in_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 關鍵安全性與業務約束 (Constraints)
-- 【防劫持防禦】：同一個第三方帳號 (如某個特定 FB ID) 絕不可同時綁定至兩個不同會員
ALTER TABLE public.user_social_accounts 
    DROP CONSTRAINT IF EXISTS uq_provider_account;
ALTER TABLE public.user_social_accounts 
    ADD CONSTRAINT uq_provider_account UNIQUE (provider, provider_user_id);

-- 【防止重複綁定】：同一會員對同一平台僅能綁定 1 個帳號
ALTER TABLE public.user_social_accounts 
    DROP CONSTRAINT IF EXISTS uq_user_provider;
ALTER TABLE public.user_social_accounts 
    ADD CONSTRAINT uq_user_provider UNIQUE (user_id, provider);

-- 3. 查詢效能索引 (Indexes)
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_user_id ON public.user_social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_provider ON public.user_social_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_email ON public.user_social_accounts(provider_email);

-- 4. 自動更新 updated_at 觸發器
DROP TRIGGER IF EXISTS user_social_accounts_touch_updated_at ON public.user_social_accounts;
CREATE TRIGGER user_social_accounts_touch_updated_at
    BEFORE UPDATE ON public.user_social_accounts
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- 5. 行級安全防護 (Row Level Security - RLS)
ALTER TABLE public.user_social_accounts ENABLE ROW LEVEL SECURITY;

-- 5.1 查詢策略：會員可讀取自己的社群身分；管理員 (admin) 可讀取全量
DROP POLICY IF EXISTS user_social_accounts_select ON public.user_social_accounts;
CREATE POLICY user_social_accounts_select ON public.user_social_accounts
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 5.2 寫入/更新策略：會員可建立/更新自己的社群紀錄；管理員可代為管理
DROP POLICY IF EXISTS user_social_accounts_insert ON public.user_social_accounts;
CREATE POLICY user_social_accounts_insert ON public.user_social_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS user_social_accounts_update ON public.user_social_accounts;
CREATE POLICY user_social_accounts_update ON public.user_social_accounts
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 5.3 刪除（解綁）策略：會員可解除自己的社群綁定；管理員可執行解綁
DROP POLICY IF EXISTS user_social_accounts_delete ON public.user_social_accounts;
CREATE POLICY user_social_accounts_delete ON public.user_social_accounts
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 6. 權限授權
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_social_accounts TO authenticated, service_role;
