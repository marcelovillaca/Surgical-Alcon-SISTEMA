import React, { createContext, useContext, ReactNode } from "react";
import { useConoftaInventory } from "@/hooks/useConoftaInventory";

type InventoryContextType = ReturnType<typeof useConoftaInventory>;

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const inventory = useConoftaInventory();
  return (
    <InventoryContext.Provider value={inventory}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
