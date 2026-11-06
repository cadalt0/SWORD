"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

/// A dotted globe with money moving between cities: glowing arcs that flow, and pulsing hubs.

const R = 1.6;

/// Cities, by latitude and longitude.
const CITIES: [number, number][] = [
  [40.7, -74], // New York
  [51.5, -0.1], // London
  [6.5, 3.4], // Lagos
  [19.1, 72.9], // Mumbai
  [14.6, 121], // Manila
  [-23.5, -46.6], // São Paulo
  [19.4, -99.1], // Mexico City
  [-1.3, 36.8], // Nairobi
  [25.2, 55.3], // Dubai
  [1.35, 103.8], // Singapore
  [52.5, 13.4], // Berlin
  [-33.9, 18.4], // Cape Town
];

/// Payments between cities (indexes into CITIES).
const ROUTES: [number, number][] = [
  [0, 1],
  [0, 5],
  [1, 2],
  [1, 3],
  [8, 3],
  [3, 4],
  [9, 4],
  [0, 6],
  [10, 7],
  [8, 9],
  [1, 11],
  [6, 5],
];

function toVec(lat: number, lon: number, r = R) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function Dots() {
  const geometry = useMemo(() => {
    const n = 2600;
    const positions = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const t = golden * i;
      positions.set([Math.cos(t) * radius * R, y * R, Math.sin(t) * radius * R], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.018} color="#b7a8ff" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Arc({ from, to, color, speed }: { from: THREE.Vector3; to: THREE.Vector3; color: string; speed: number }) {
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  const points = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const lift = 1 + from.distanceTo(to) * 0.32;
    mid.normalize().multiplyScalar(R * lift);
    return new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(60);
  }, [from, to]);
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * speed;
  });
  return (
    <>
      <Line points={points} color={color} lineWidth={0.6} transparent opacity={0.18} />
      <Line ref={line as never} points={points} color={color} lineWidth={1.8} dashed dashSize={0.35} gapSize={2.2} dashScale={1} transparent opacity={0.95} toneMapped={false} />
    </>
  );
}

function Hub({ at, offset }: { at: THREE.Vector3; offset: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), at.clone().normalize()), [at]);
  useFrame((state) => {
    if (!ring.current) return;
    const t = ((state.clock.elapsedTime + offset) % 2) / 2;
    ring.current.scale.setScalar(1 + t * 2.5);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <group position={at} quaternion={quaternion}>
      <mesh>
        <circleGeometry args={[0.028, 20]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.04, 0.052, 32]} />
        <meshBasicMaterial color="#7dd3fc" transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Globe() {
  const group = useRef<THREE.Group>(null);
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const cities = useMemo(() => CITIES.map(([lat, lon]) => toVec(lat, lon, R * 1.003)), []);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * (calm ? 0.02 : 0.09);
  });
  const colors = ["#a78bfa", "#7dd3fc", "#6ee7b7", "#fcd34d"];
  return (
    <group rotation={[0.35, -1.2, 0]}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[R * 0.985, 64, 64]} />
          <meshBasicMaterial color="#0b0820" transparent opacity={0.85} />
        </mesh>
        <Dots />
        {cities.map((c, i) => (
          <Hub key={i} at={c} offset={(i * 0.37) % 2} />
        ))}
        {ROUTES.map(([a, b], i) => (
          <Arc key={i} from={cities[a]!} to={cities[b]!} color={colors[i % colors.length]!} speed={calm ? 0.2 : 0.9 + (i % 3) * 0.25} />
        ))}
      </group>
      {/* atmosphere */}
      <mesh scale={1.12}>
        <sphereGeometry args={[R, 64, 64]} />
        <meshBasicMaterial color="#6d4dff" transparent opacity={0.07} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function GlobeScene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6.4], fov: 40 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
      <Globe />
    </Canvas>
  );
}
