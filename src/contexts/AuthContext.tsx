import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { captureExceptionSafe } from '../lib/sentry';
import { claimGuestOrders } from '../lib/guestOrders';

/**
 * 認證上下文介面定義
 */
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 安全地從 User 物件提取使用者角色
 * 依據 docs/MAIN_SPECIFICATION.md §5.2 安全不變量：
 * 權限與角色必須嚴格取自不可由前端任意寫入的 app_metadata，
 * 嚴禁使用可被前端竄改的 user_metadata。
 */
export function extractUserRole(user: User | null): string | null {
  if (!user || !user.app_metadata) {
    return null;
  }
  const role = user.app_metadata.role;
  return typeof role === 'string' ? role : null;
}

/**
 * 判定使用者是否具備管理員權限
 * 嚴格比對 user?.app_metadata?.role === 'admin'
 */
export function isUserAdmin(user: User | null): boolean {
  if (!user || !user.app_metadata) {
    return false;
  }
  return user.app_metadata.role === 'admin';
}

/**
 * 登入後把同一個已驗證 Email 的訪客訂單併入會員（docs/GUEST_CHECKOUT_PLAN.md §6）。
 * 只處理 SIGNED_IN；同一位使用者在同一個頁面生命週期只呼叫一次。
 * 用 setTimeout 移出 onAuthStateChange 回呼，避免在回呼內等待 Supabase 呼叫造成鎖死；
 * 失敗不影響登入。
 */
export function scheduleGuestOrderClaim(
  event: AuthChangeEvent,
  session: Session | null,
  claimedUserIds: Set<string>,
  claim: () => Promise<unknown> = claimGuestOrders,
): boolean {
  const userId = session?.user?.id;
  if (event !== 'SIGNED_IN' || !userId || claimedUserIds.has(userId)) {
    return false;
  }
  claimedUserIds.add(userId);
  setTimeout(() => {
    void claim();
  }, 0);
  return true;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * 全站 Supabase Auth 提供者
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const role = useMemo(() => extractUserRole(user), [user]);
  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        captureExceptionSafe(error, { source: 'AuthContext.refreshSession' });
        setUser(null);
        setSession(null);
      } else {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    } catch (err) {
      captureExceptionSafe(err, { source: 'AuthContext.refreshSession.catch' });
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 初始載入 Session
    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          captureExceptionSafe(error, { source: 'AuthContext.initAuth' });
        }
        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setIsLoading(false);
        }
      } catch (err) {
        captureExceptionSafe(err, { source: 'AuthContext.initAuth.catch' });
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // 監聽 Supabase 認證狀態變更
    if (isSupabaseConfigured) {
      const claimedUserIds = new Set<string>();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, newSession: Session | null) => {
          if (isMounted) {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setIsLoading(false);
          }
          scheduleGuestOrderClaim(event, newSession, claimedUserIds);
        }
      );

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        captureExceptionSafe(err, { source: 'AuthContext.signOut' });
      }
    }
    setUser(null);
    setSession(null);
  }, []);

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    session,
    role,
    isAdmin,
    isLoading,
    isConfigured: isSupabaseConfigured,
    signOut,
    refreshSession,
  }), [user, session, role, isAdmin, isLoading, signOut, refreshSession]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 取得認證狀態之自訂 Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 內部使用');
  }
  return context;
}
