"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Category, PortfolioItem, Review, Service, Settings } from "@/lib/types";

export type ShopData = {
  settings: Settings;
  cats: Category[];
  services: Service[];
  pcats: Category[];
  portfolio: PortfolioItem[];
  reviews: Review[];
};

/** 손님 화면과 관리자 화면이 함께 쓰는 가게 정보 불러오기 */
export function useShopData() {
  const [data, setData] = useState<ShopData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const c = sb();
      const [st, cats, svcs, pcats, pf, rv] = await Promise.all([
        c.from("settings").select("*").eq("id", 1).single(),
        c.from("service_categories").select("*").order("sort").order("name"),
        c.from("services").select("*").order("sort").order("created_at"),
        c.from("portfolio_categories").select("*").order("sort").order("name"),
        c.from("portfolio_items").select("*").order("sort").order("created_at", { ascending: false }),
        c.from("reviews").select("*").order("created_at", { ascending: false }),
      ]);
      const firstErr = [st, cats, svcs, pcats, pf, rv].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setData({
        settings: st.data as Settings,
        cats: (cats.data ?? []) as Category[],
        services: (svcs.data ?? []) as Service[],
        pcats: (pcats.data ?? []) as Category[],
        portfolio: (pf.data ?? []) as PortfolioItem[],
        reviews: (rv.data ?? []) as Review[],
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가게 정보를 불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, reload: load };
}

export function Loading({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (error)
    return (
      <div className="center-msg">
        <p>정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
        <p className="note">{error}</p>
        {onRetry && (
          <div>
            <button className="btn" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className="center-msg" aria-busy="true">
      <div className="spinner" />
      <p className="muted">불러오는 중이에요</p>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2400);
  }, []);
  return { msg, show };
}
