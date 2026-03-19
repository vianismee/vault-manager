/**
 * Supabase Realtime Hooks
 * Subscribe to database changes for live updates
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

// Generic subscription hook
export function useRealtimeSubscription<T>(
  table: string,
  filter?: string,
  onError?: (error: Error) => void
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Initial fetch
        const { data: initialData, error } = await supabase
          .from(table as "passwords")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setData((initialData as unknown as T[]) || []);
        setLoading(false);

        // Set up realtime subscription
        const channelName = `${table}_changes_${user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: table,
              filter: filter || `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log(`[Realtime ${table}]`, payload.eventType, payload);

              switch (payload.eventType) {
                case "INSERT":
                  setData((prev) => [...prev, payload.new as T]);
                  break;
                case "UPDATE":
                  setData((prev) =>
                    prev.map((item) =>
                      (item as any).id === payload.new.id ? payload.new as T : item
                    )
                  );
                  break;
                case "DELETE":
                  setData((prev) =>
                    prev.filter((item) => (item as any).id !== payload.old.id)
                  );
                  break;
              }
            }
          )
          .subscribe((status) => {
            console.log(`[Realtime ${table}] Status:`, status);
            if (status === "CHANNEL_ERROR" && onError) {
              onError(new Error("Subscription error"));
            }
          });
      } catch (error) {
        console.error(`[Realtime ${table}] Error:`, error);
        setLoading(false);
        if (onError) onError(error as Error);
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log(`[Realtime ${table}] Unsubscribed`);
      }
    };
  }, [table, filter, onError]);

  return { data, loading };
}

// Hook for categories with realtime updates
export function useCategories() {
  return useRealtimeSubscription<any>("categories");
}

// Hook for passwords with realtime updates
export function usePasswords() {
  return useRealtimeSubscription<any>("passwords");
}

// Simple subscription manager for manual use
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private user_id: string | null = null;

  async init() {
    const { data: { user } } = await supabase.auth.getUser();
    this.user_id = user?.id || null;
  }

  subscribe(
    table: string,
    callbacks: {
      onInsert?: (payload: any) => void;
      onUpdate?: (payload: any) => void;
      onDelete?: (payload: any) => void;
    }
  ) {
    if (!this.user_id) return { unsubscribe: () => {} };

    const channelName = `${table}_realtime_${this.user_id}`;
    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table,
        filter: `user_id=eq.${this.user_id}`,
      },
      (payload) => {
        switch (payload.eventType) {
          case "INSERT":
            callbacks.onInsert?.(payload);
            break;
          case "UPDATE":
            callbacks.onUpdate?.(payload);
            break;
          case "DELETE":
            callbacks.onDelete?.(payload);
            break;
        }
      }
    );

    channel.subscribe((status) => {
      console.log(`[Realtime ${table}] Status:`, status);
    });

    this.channels.set(channelName, channel);

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
        this.channels.delete(channelName);
      },
    };
  }

  unsubscribeAll() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtimeManager = new RealtimeManager();
