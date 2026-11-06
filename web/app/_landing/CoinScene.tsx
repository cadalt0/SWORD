"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

import { CURRENCY_GLYPHS, type GlyphCommand } from "./currencyGlyphs";

/// The hero's background: a few currency coins ($, €, ₹, ...) drifting around the transfer card, in depth, with the
/// whole field tilting gently toward the mouse. Built in code, lit by a studio of light panels; nothing is downloaded.

const RIM = new THREE.MeshStandardMaterial({ color: "#fff4cf", emissive: "#ffd36b", emissiveIntensity: 0.35, metalness: 1, roughness: 0.28 });
const SYMBOL = new THREE.MeshPhysicalMaterial({ color: "#fffaf0", emissive: "#ffe2a0", emissiveIntensity: 0.25, metalness: 1, roughness: 0.15, clearcoat: 1, envMapIntensity: 2 });
const face = (color: string, emissive: string) => new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.28, clearcoat: 0.8, envMapIntensity: 1.7 });
const GOLD = face("#ffd66b", "#6b4500");
const MINT = face("#5eead4", "#0f5f4f");
const SILVER = face("#dfe6ff", "#2a3570");
const VIOLET = face("#b9a4ff", "#3b1f8f");

/// Where each coin floats. x and y are in the camera's view (the card sits in the middle), z is depth: far coins are
/// small and dim, near ones large.
const COINS: { symbol: string; face: THREE.Material; at: [number, number, number]; size: number }[] = [
  { symbol: "$", face: MINT, at: [-2.35, 2.35, -0.4], size: 0.9 },
  { symbol: "€", face: SILVER, at: [2.45, 2.6, -1.2], size: 0.78 },
  { symbol: "₹", face: GOLD, at: [2.2, -1.75, 0.4], size: 0.92 },
  { symbol: "R$", face: VIOLET, at: [-2.25, -1.95, 0.25], size: 0.84 },
  { symbol: "£", face: GOLD, at: [-0.5, 3.3, -2.2], size: 0.58 },
  { symbol: "¥", face: MINT, at: [0.9, -3.35, -1.6], size: 0.6 },
  { symbol: "₦", face: SILVER, at: [-2.95, 0.35, -2.6], size: 0.52 },
  { symbol: "₩", face: VIOLET, at: [3.0, 0.5, -2.8], size: 0.48 },
];

/// A currency symbol as raised metal: its outline, extruded and bevelled. `size` is the width of its 1 x 1 box.
function symbolGeometry(commands: GlyphCommand[], size: number) {
  const path = new THREE.ShapePath();
  for (const [type, ...v] of commands) {
    const n = (v as number[]).map((x) => x * size);
    if (type === "M") path.moveTo(n[0], n[1]);
    else if (type === "L") path.lineTo(n[0], n[1]);
    else if (type === "Q") path.quadraticCurveTo(n[0], n[1], n[2], n[3]);
    else if (type === "C") path.bezierCurveTo(n[0], n[1], n[2], n[3], n[4], n[5]);
  }
  const g = new THREE.ExtrudeGeometry(path.toShapes(), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
  g.computeVertexNormals();
  return g;
}

function Coins({ pointer, calm }: { pointer: React.RefObject<{ x: number; y: number }>; calm: boolean }) {
  const field = useRef<THREE.Group>(null);
  const coins = useRef<THREE.Group[]>([]);
  const symbols = useMemo(() => COINS.map((c) => symbolGeometry(CURRENCY_GLYPHS[c.symbol], c.symbol.length > 1 ? 0.58 : 0.48)), []);
  useEffect(() => () => symbols.forEach((g) => g.dispose()), [symbols]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = pointer.current ?? { x: 0, y: 0 };
    if (field.current) {
      field.current.rotation.y = THREE.MathUtils.lerp(field.current.rotation.y, p.x * 0.18, 0.04);
      field.current.rotation.x = THREE.MathUtils.lerp(field.current.rotation.x, p.y * 0.12, 0.04);
    }
    const speed = calm ? 0.15 : 0.6;
    coins.current.forEach((coin, i) => {
      if (!coin) return;
      const [x, y, z] = COINS[i].at;
      // A slow bob and sway around its own spot, each out of step with the others.
      coin.position.set(x + Math.sin(t * speed * 0.6 + i * 1.7) * 0.12, y + Math.sin(t * speed + i) * 0.18, z);
      // It rocks rather than spins, so its symbol faces the viewer most of the time.
      coin.rotation.y = Math.sin(t * speed * 0.8 + i * 2.1) * 0.65;
      coin.rotation.x = Math.sin(t * speed * 0.5 + i) * 0.15;
      coin.rotation.z = Math.sin(t * speed * 0.4 + i * 0.7) * 0.12;
    });
  });

  return (
    <group ref={field}>
      {COINS.map((c, i) => (
        <group
          key={c.symbol}
          scale={c.size}
          ref={(el) => {
            if (el) coins.current[i] = el;
          }}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} material={c.face}>
            <cylinderGeometry args={[0.5, 0.5, 0.1, 56]} />
          </mesh>
          <mesh material={RIM}>
            <torusGeometry args={[0.5, 0.035, 12, 56]} />
          </mesh>
          <mesh position={[0, 0, 0.05]} material={RIM}>
            <torusGeometry args={[0.41, 0.012, 8, 56]} />
          </mesh>
          <mesh position={[0, 0, -0.05]} material={RIM}>
            <torusGeometry args={[0.41, 0.012, 8, 56]} />
          </mesh>
          <mesh geometry={symbols[i]} material={SYMBOL} position={[0, 0, 0.045]} />
          <mesh geometry={symbols[i]} material={SYMBOL} position={[0, 0, -0.045]} rotation={[0, Math.PI, 0]} />
        </group>
      ))}
    </group>
  );
}

export default function CoinScene() {
  const pointer = useRef({ x: 0, y: 0 });
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 10], fov: 40 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
      <fog attach="fog" args={["#0a0912", 9, 15]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 6]} intensity={2} />
      <pointLight position={[-4, -1, 3]} intensity={16} color="#8b5cf6" distance={14} />
      <pointLight position={[4, 2, 1]} intensity={12} color="#38bdf8" distance={14} />
      <Coins pointer={pointer} calm={calm} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 4, -3]} scale={[10, 1.5, 1]} />
        <Lightformer form="rect" intensity={3} color="#a78bfa" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#38bdf8" position={[5, -1, 1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={2} color="#f5c542" position={[0, -3, 3]} scale={3} />
        <Lightformer form="rect" intensity={2.2} color="#e9e5ff" position={[0, 0, 6]} scale={[6, 6, 1]} />
      </Environment>
    </Canvas>
  );
}
