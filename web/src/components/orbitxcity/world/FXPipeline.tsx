import { useMemo } from "react";
import * as THREE from "three";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/** Cinematic post pipeline: neon bloom, film grain, CRT fringe, vignette. */
export function FXPipeline() {
  const caOffset = useMemo(() => new THREE.Vector2(0.0009, 0.0006), []);

  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.9} luminanceThreshold={0.26} luminanceSmoothing={0.2} mipmapBlur radius={0.68} />
      <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0.15} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
      <Vignette eskil={false} offset={0.2} darkness={0.62} />
    </EffectComposer>
  );
}
