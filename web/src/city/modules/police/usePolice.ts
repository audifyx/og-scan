/**
 * OrbitXCity — Police module React binding.
 *
 * Single shared `PoliceStore` instance; revision-snapshot subscription like
 * the other module hooks.
 */

import { useEffect, useReducer } from "react";
import { getPoliceStore } from "./store";

export function usePoliceStore() {
  const store = getPoliceStore();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => store.subscribe(bump), [store]);
  return store;
}
