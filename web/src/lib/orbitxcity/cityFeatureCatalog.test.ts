import { describe, expect, it } from "vitest";
import {
  FEATURES_PER_SYSTEM,
  MENU_SYSTEMS,
  CITY_SYSTEMS,
  getSystemFeatures,
  countByStatus,
} from "./cityFeatureCatalog";

describe("cityFeatureCatalog", () => {
  it("ships exactly 168 features per menu and city system", () => {
    expect(FEATURES_PER_SYSTEM).toBe(168);
    for (const id of [...MENU_SYSTEMS, ...CITY_SYSTEMS]) {
      const list = getSystemFeatures(id);
      expect(list).toHaveLength(168);
      const counts = countByStatus(id);
      expect(counts.live + counts.beta + counts.planned).toBe(168);
    }
  });
});
