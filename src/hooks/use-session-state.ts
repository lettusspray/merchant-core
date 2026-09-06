import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type SessionState =
  { status: "checking" } | { status: "signed-out" } | { status: "signed-in" };

/** Lightweight browser-side auth gate. The server re-validates on every call. */
export function useSessionState(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "checking" });

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setState(data.session ? { status: "signed-in" } : { status: "signed-out" });
      })
      .catch(() => {
        if (!active) return;
        setState({ status: "signed-out" });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session ? { status: "signed-in" } : { status: "signed-out" });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
