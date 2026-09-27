"use client";
import { createContext, useContext, useState, type MouseEvent, type ReactNode } from "react";
import { createNavigationGuard } from "@/lib/navigation-guard";

type Guard = ReturnType<typeof createNavigationGuard<MouseEvent<HTMLAnchorElement>>>;
const Context = createContext<Guard>({ register: () => () => {}, handle: () => {} });

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [guard] = useState(() => createNavigationGuard<MouseEvent<HTMLAnchorElement>>());
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}
export const useNavigationGuard = () => useContext(Context);
