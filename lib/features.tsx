"use client";
import { createContext, useContext } from "react";
import type { PublicFeatures } from "./config";

const Ctx = createContext<PublicFeatures | null>(null);

export function FeaturesProvider({
  value,
  children,
}: {
  value: PublicFeatures;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFeatures(): PublicFeatures {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFeatures must be used inside FeaturesProvider");
  return v;
}
