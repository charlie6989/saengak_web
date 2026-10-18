interface SignInTimes {
  created_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

// 第一次登入與帳號建立（Google 等第三方）或 Email 驗證完成幾乎同時發生；容許註冊後稍晚才點驗證信
const FIRST_SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

const time = (value?: string | null) => (value ? Date.parse(value) : NaN);

/** 這次登入是否為會員的第一次登入：新會員看「歡迎加入」，老會員看「歡迎回來」。 */
export function isFirstSignIn(user: SignInTimes | null | undefined): boolean {
  const lastSignIn = time(user?.last_sign_in_at);
  if (Number.isNaN(lastSignIn)) return true;
  return [user?.created_at, user?.email_confirmed_at].some((value) => {
    const at = time(value);
    return !Number.isNaN(at) && Math.abs(lastSignIn - at) <= FIRST_SIGN_IN_WINDOW_MS;
  });
}
