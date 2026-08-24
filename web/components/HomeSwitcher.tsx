"use client";

import { ReactNode } from "react";

import { inkSurvivorsConstants } from "@/lib/contract";
import { useChainStats } from "@/lib/hooks";

import { SoldOutScreen } from "./SoldOutScreen";

/**
 * Toggles between the normal homepage children and a sold-out replacement once
 * `totalSupply` reaches `MAX_SUPPLY`. Client-rendered so we can read live chain
 * state and react to the moment of the 10,000th mint.
 */
export function HomeSwitcher({ children }: { children: ReactNode }) {
  const { totalSupply, isLoading } = useChainStats();
  const soldOut = !isLoading && totalSupply >= inkSurvivorsConstants.MAX_SUPPLY;

  if (soldOut) return <SoldOutScreen />;
  return <>{children}</>;
}
