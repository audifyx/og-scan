import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/** Soft cinematic grade — haze depth, light film grain, restrained bloom. */
export function FXPipeline() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.22} luminanceThreshold={0.72} luminanceSmoothing={0.35} mipmapBlur radius={0.45} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} />
      <Vignette eskil={false} offset={0.28} darkness={0.48} />
    </EffectComposer>
  );
}
