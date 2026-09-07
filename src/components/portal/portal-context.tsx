import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import { myPortalDataFn, type PortalData } from "@/lib/api/portal.functions";

type PortalContextValue = {
  data: PortalData;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ data, children }: { data: PortalData; children: ReactNode }) {
  const [state, setState] = useState(data);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await myPortalDataFn();
      setState(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <PortalContext.Provider value={{ data: state, refreshing, refresh }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal must be used within a PortalProvider");
  return value;
}

export type PortalMerchant = PortalData["merchants"][number];
