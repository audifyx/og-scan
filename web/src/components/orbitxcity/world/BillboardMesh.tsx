import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import QRCode from "qrcode";
import type { BillboardDefinition } from "@/lib/orbitxcity/types";
import { hashSeed } from "@/lib/orbitxcity/collision";
import { createAdTexture, drawLiveTokenBoard } from "@/lib/orbitxcity/textures";
import { fetchTokenChart, fetchTokenDetail } from "@/lib/orbitxcity/tokenApi";
import type { ChartCandle } from "@/lib/orbitxcity/tokenApi";
import type { TokenDetail } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";

/** Neon ad board — static procedural screen OR live token ad with price/mcap/chart. */
export function BillboardMesh({ board }: { board: BillboardDefinition }) {
  if (board.tokenMint) return <LiveTokenBillboard board={board} />;
  return <StaticAdBillboard board={board} />;
}

function StaticAdBillboard({ board }: { board: BillboardDefinition }) {
  const { position, rotationY, width, height, title, subtitle, accent } = board;
  const frameColor = useMemo(() => new THREE.Color(accent).multiplyScalar(0.35).getStyle(), [accent]);
  const screenTex = useMemo(
    () => createAdTexture(title, subtitle, accent, hashSeed(board.id)),
    [title, subtitle, accent, board.id],
  );
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!screenMat.current) return;
    screenMat.current.opacity = Math.random() < 0.03 ? 0.68 : 1;
  });

  return (
    <BillboardFrame position={position} rotationY={rotationY} width={width} height={height} accent={accent} frameColor={frameColor}>
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={screenMat} map={screenTex} transparent toneMapped={false} />
      </mesh>
    </BillboardFrame>
  );
}

function LiveTokenBillboard({ board }: { board: BillboardDefinition }) {
  const { position, rotationY, width, height, accent, title, tokenMint } = board;
  const { openToken } = useCity();
  const frameColor = useMemo(() => new THREE.Color(accent).multiplyScalar(0.35).getStyle(), [accent]);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 288;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  const [token, setToken] = useState<TokenDetail | null>(null);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!tokenMint) return;
    let live = true;
    const load = async () => {
      const [t, c] = await Promise.all([fetchTokenDetail(tokenMint), fetchTokenChart(tokenMint, "1h", 40)]);
      if (!live) return;
      setToken(t);
      setCandles(c);
    };
    load();
    const id = setInterval(load, 45_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [tokenMint]);

  // Real scannable QR → token page on OrbitX DEX
  useEffect(() => {
    if (!tokenMint) return;
    let live = true;
    QRCode.toDataURL(`${window.location.origin}/ORBITX_DEX/token/${tokenMint}`, {
      margin: 1,
      width: 136,
      color: { dark: "#05070d", light: "#ffffff" },
    })
      .then((url) => {
        if (!live) return;
        const img = new Image();
        img.onload = () => live && setQrImage(img);
        img.src = url;
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [tokenMint]);

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawLiveTokenBoard(ctx, token, candles, accent, title, qrImage);
    texture.needsUpdate = true;
  }, [canvas, texture, token, candles, accent, title, qrImage]);

  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!screenMat.current) return;
    screenMat.current.opacity = Math.random() < 0.02 ? 0.75 : 1;
  });

  return (
    <BillboardFrame position={position} rotationY={rotationY} width={width} height={height} accent={accent} frameColor={frameColor}>
      <mesh
        position={[0, 0, 0.1]}
        onClick={(e) => {
          e.stopPropagation();
          if (tokenMint) openToken(tokenMint);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={screenMat} map={texture} transparent toneMapped={false} />
      </mesh>
    </BillboardFrame>
  );
}

function BillboardFrame({
  position,
  rotationY,
  width,
  height,
  accent,
  frameColor,
  children,
}: {
  position: { x: number; y: number; z: number };
  rotationY: number;
  width: number;
  height: number;
  accent: string;
  frameColor: string;
  children: React.ReactNode;
}) {
  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotationY, 0]}>
      {/* Steel pole + bolted foot */}
      <mesh position={[0, -position.y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, position.y, 10]} />
        <meshStandardMaterial color="#3a4048" metalness={0.65} roughness={0.4} />
      </mesh>
      <mesh position={[0, -position.y + 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.16, 10]} />
        <meshStandardMaterial color="#4a5158" metalness={0.35} roughness={0.7} />
      </mesh>
      {/* Matte aluminum cabinet */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.28, height + 0.28, 0.22]} />
        <meshStandardMaterial color={frameColor} metalness={0.45} roughness={0.42} />
      </mesh>
      {/* Soft brand edge — not neon tubes */}
      <mesh position={[0, height / 2 + 0.18, 0.08]}>
        <boxGeometry args={[width + 0.2, 0.06, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} roughness={0.55} metalness={0.2} />
      </mesh>
      {children}
    </group>
  );
}
