"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase";

// Use a global variable to track the channel outside the React lifecycle
let activeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

export function useRealtimeSync() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // 1. If a channel already exists (e.g., from another component), don't create a new one.
    if (activeChannel) return;

    // 2. Generate a unique channel name to avoid clashes
    const channelName = `epas-sync-${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evidence" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => router.refresh()
      )
      .subscribe();

    activeChannel = channel;

    return () => {
      // 3. Cleanup: Unsubscribe and remove the channel
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  }, [supabase, router]);
}