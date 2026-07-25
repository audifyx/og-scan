# Avatar & Character Team — Interface

## Owns
- `web/src/components/orbitxcity/world/CharacterMesh.tsx` (create)
- `web/src/components/orbitxcity/world/PlayerAvatar.tsx`
- `web/src/components/orbitxcity/world/RemoteAvatars.tsx`

## Contract
Render `AvatarAppearance` from `types.ts`:
- hairStyle, hairColor, outfit, faceStyle + existing colors/name
- Sims-like proportions (distinct head, torso, hips, limbs — not a single capsule)
- Walk bob + dance emote already exist — preserve movement/camera logic in PlayerAvatar
- Extract visual body into shared `CharacterMesh` used by local + remote

## Do not touch
UI files, CityProvider, realtime.ts, demoBlock, city.css
