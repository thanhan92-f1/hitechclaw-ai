"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAuthHeaders } from "../api";

export type FetchState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export type PollingResult<T> = FetchState<T> & {
  refresh: () => Promise<void>;
};

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function submitQuickCommand(command: string) {
  const trimmed = command.trim();
  if (!trimmed) return;

  await fetchJson("/api/tools/commands", {
    method: "POST",
    body: JSON.stringify({
      agent_id: "default",
      command: trimmed,
      status: "sent",
    }),
  });

  try {
    const proxyRes = await fetch("/api/gateway/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/system-event",
        method: "POST",
        body: { text: trimmed, mode: "now" },
      }),
    });

    if (proxyRes.ok) {
      toast.success("Command sent to agent");
    } else {
      toast("Command saved — gateway unreachable", { icon: "⚠️" });
    }
  } catch {
    toast("Command saved — gateway unreachable", { icon: "⚠️" });
  }
}

export function usePollingData<T>(url: string, intervalMs = 15000): PollingResult<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const urlRef = useRef(url);
  urlRef.current = url;

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<T>(urlRef.current);
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        error: error instanceof Error ? error.message : "Request failed",
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const data = await fetchJson<T>(urlRef.current);
        if (!mounted) return;
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          data: current.data,
          error: error instanceof Error ? error.message : "Request failed",
          loading: false,
        }));
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [intervalMs, url]);

  return { ...state, refresh };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-ZA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-ZA", {
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "Now";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function elapsedLabel(startedAt: string, completedAt: string | null, now: number) {
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const totalSeconds = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}
