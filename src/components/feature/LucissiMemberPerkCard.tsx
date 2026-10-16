import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LUCISSI_URL } from '../../content/carePillars';
import { LUCISSI_MEMBER_PERK_ENABLED, claimLucissiMemberPerk, fetchMyMemberPerk, visibleMemberPerk, type MemberPerk } from '../../lib/memberPerk';

/** LUCISSI 會員首單免運：確認母站會員資格後，發給一組只屬於自己的免運代碼。 */
export default function LucissiMemberPerkCard({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // 代碼只屬於載入它的那位會員；登出或換帳號時立即丟掉，非同步結果也要對得上目前的會員
  const [perkState, setPerkState] = useState<{ ownerId: string; perk: MemberPerk } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const perk = visibleMemberPerk(perkState, userId);

  useEffect(() => {
    setPerkState(null);
    setMessage('');
    setCopied(false);
    if (!LUCISSI_MEMBER_PERK_ENABLED || !userId) return;
    let active = true;
    void fetchMyMemberPerk().then((row) => {
      if (active && row) setPerkState({ ownerId: userId, perk: row });
    });
    return () => { active = false; };
  }, [userId]);

  if (!LUCISSI_MEMBER_PERK_ENABLED) return null;

  const claim = async () => {
    if (!userId) return;
    const claimingFor = userId;
    setBusy(true);
    setMessage('');
    const result = await claimLucissiMemberPerk();
    setBusy(false);
    if (result.success && result.perk) {
      setPerkState({ ownerId: claimingFor, perk: result.perk });
      return;
    }
    setMessage(result.message || '暫時無法領取，請稍後再試');
  };

  const copy = async () => {
    if (!perk) return;
    try {
      await navigator.clipboard.writeText(perk.coupon_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="lucissi-member-perk-title" className={`border border-gray-200 bg-white p-6 sm:p-8 ${className}`}>
      <p className="mb-2 text-xs font-medium tracking-[0.18em] text-brand">FROM LUCISSI</p>
      <h2 id="lucissi-member-perk-title" className="mb-2 text-xl font-semibold text-brand sm:text-2xl">LUCISSI 會員首單免運</h2>
      <p className="mb-5 max-w-2xl text-sm leading-6 text-gray-600">
        已是 LUCISSI 官網會員？用同一個 Email 登入 LUCISSI CARE，確認會員資格後即可領取一組首單免運代碼：不限金額、只限本人首次購物使用一次，60 天內有效。
      </p>

      {perk && user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="inline-flex items-center border border-dashed border-brand px-4 py-2 font-mono text-lg tracking-wider text-brand">{perk.coupon_code}</span>
          <button type="button" onClick={copy} className="self-start border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-ivory sm:self-auto">
            {copied ? '已複製' : '複製代碼'}
          </button>
          <p className="text-sm text-gray-600">
            {perk.status === 'used'
              ? '這組代碼已使用。'
              : perk.status === 'expired'
                ? '首單已完成，這組代碼已失效。'
                : `結帳前在購物車的「輸入折扣代碼」貼上即可${perk.expires_at ? `，${new Date(perk.expires_at).toLocaleDateString('zh-TW')} 前有效` : ''}。`}
          </p>
        </div>
      ) : user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="self-start bg-brand px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? '確認中…' : '確認 LUCISSI 會員資格並領取'}
          </button>
          {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
        </div>
      ) : (
        <Link to="/login" className="inline-flex bg-brand px-6 py-3 text-sm font-semibold text-white">登入後領取</Link>
      )}

      <p className="mt-5 text-xs leading-5 text-gray-500">
        我們只會向 LUCISSI 確認這個 Email 是否為已驗證的會員，不交換地址或訂單資料。還不是 LUCISSI 會員？
        <a href={LUCISSI_URL} target="_blank" rel="noopener" className="ml-1 border-b border-gray-400 text-gray-600">前往 LUCISSI</a>
      </p>
    </section>
  );
}
