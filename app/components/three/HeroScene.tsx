"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import MongooseModel from "./MongooseModel";
import { useSiteStore } from "@/app/store/useSiteStore";

function Particles({ count = 220 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.getElapsedTime() * 0.015;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#d8d4ca" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function Scene({
  pointer,
  scrollProgress,
}: {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  scrollProgress: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    // subtle camera parallax follows cursor
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.current.x * 0.6, 0.03);
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      0.3 + pointer.current.y * 0.35,
      0.03
    );
    camera.lookAt(0, 0, 0);

    if (lightRef.current) {
      lightRef.current.position.x = pointer.current.x * 3;
      lightRef.current.position.y = 1.5 + pointer.current.y * 1.5;
    }
  });

  return (
    <>
      <color attach="background" args={["#0a0a0a"]} />
      <fog attach="fog" args={["#0a0a0a", 4, 11]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 2]} intensity={1.3} color="#f5f2ec" />
      <directionalLight position={[-2, 1, -3]} intensity={0.35} color="#b8b2a6" />
      <directionalLight position={[0, -2, 3]} intensity={0.4} color="#f5f2ec" />
      <pointLight ref={lightRef} position={[1.5, 1.2, 2.2]} intensity={0.9} color="#c4ff61" distance={6} decay={2} />
      <MongooseModel pointer={pointer} scrollProgress={scrollProgress} />
      <Particles />
    </>
  );
}

export default function HeroScene({
  pointer,
  scrollProgress,
}: {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  scrollProgress: React.MutableRefObject<number>;
}) {
  const prefersReducedMotion = useSiteStore((s) => s.prefersReducedMotion);

  return (
    <Canvas
      camera={{ position: [0, 0.3, 5.4], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <Scene pointer={pointer} scrollProgress={scrollProgress} />
      </Suspense>
    </Canvas>
  );
}
