import { RamenBowl } from "./Ramen3D";
import { PizzaBox } from "./Pizza3D";
import { EnergyDrinks } from "./Drinks3D";
import { SnackPile } from "./Snacks3D";

export function ViralMeals() {
  return (
    <group>
      <group position={[3.55, 0.94, 2.85]}>
        <RamenBowl />
      </group>
      <group position={[4.25, 0.94, 3.15]}>
        <PizzaBox />
      </group>
      <group position={[3.75, 0.94, 3.3]}>
        <EnergyDrinks />
      </group>
      <group position={[4.35, 0.94, 2.8]}>
        <SnackPile />
      </group>
    </group>
  );
}
