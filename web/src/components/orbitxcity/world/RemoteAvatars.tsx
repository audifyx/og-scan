import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { CityRealtimeClient, RemotePlayerState } from "@/lib/orbitxcity/realtime";

const CHAT_TTL_MS = 4500;
const SMOOTH = 10;

function RemoteAvatar({ player }: { player: RemotePlayerState }) {
  const group = useRef<THREE.Group>(null);
  const display = useRef({ x: player.x, z: player.z, yaw: player.yaw });
  const [chat, setChat] = useState<string | null>(null);
  const lastChat = useRef<string | null>(null);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;

    const a = 1 - Math.exp(-SMOOTH * dt);
    display.current.x += (player.x - display.current.x) * a;
    display.current.z += (player.z - display.current.z) * a;
    let dy = player.yaw - display.current.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    display.current.yaw += dy * a;

    const dancing = player.emoteAt > 0 && Date.now() - player.emoteAt < 2600;
    const hop = dancing ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.28 : 0;
    g.position.set(display.current.x, hop, display.current.z);
    g.rotation.y = dancing ? clock.elapsedTime * 9 : display.current.yaw;

    const show = player.chatText && Date.now() - player.chatAt < CHAT_TTL_MS ? player.chatText : null;
    if (show !== lastChat.current) {
      lastChat.current = show;
      setChat(show);
    }
  });

  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.65, 6, 10]} />
        <meshStandardMaterial color={player.bodyColor} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.3, 14, 14]} />
        <meshStandardMaterial color={player.skinColor} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.98, 0.2]}>
        <boxGeometry args={[0.34, 0.1, 0.06]} />
        <meshBasicMaterial color={player.accentColor} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.4, -0.2]}>
        <boxGeometry args={[0.45, 0.28, 0.16]} />
        <meshStandardMaterial color={player.accentColor} emissive={player.accentColor} emissiveIntensity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.4, 0.5, 24]} />
        <meshBasicMaterial color={player.accentColor} transparent opacity={0.45} toneMapped={false} />
      </mesh>

      <Billboard position={[0, 2.55, 0]}>
        <Text
          fontSize={0.28}
          color={player.accentColor}
          anchorX="center"
          outlineWidth={0.04}
          outlineColor="#04070f"
          material-toneMapped={false}
        >
          {player.name}
        </Text>
      </Billboard>

      {chat && (
        <Billboard position={[0, 3.05, 0]}>
          <Text
            fontSize={0.24}
            color="#e8f1ff"
            anchorX="center"
            maxWidth={3.2}
            outlineWidth={0.04}
            outlineColor="#04070f"
          >
            {chat}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/** Renders every remote player currently tracked by the realtime client. */
export function RemoteAvatars({ client }: { client: CityRealtimeClient | null }) {
  const [ids, setIds] = useState<string[]>([]);
  const playersRef = useRef(new Map<string, RemotePlayerState>());

  useFrame(() => {
    if (!client) return;
    playersRef.current = client.players;
    const next = Array.from(client.players.keys()).sort();
    setIds((prev) => {
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) return prev;
      return next;
    });
  });

  if (!client) return null;

  return (
    <group>
      {ids.map((id) => {
        const p = playersRef.current.get(id);
        return p ? <RemoteAvatar key={id} player={p} /> : null;
      })}
    </group>
  );
}
