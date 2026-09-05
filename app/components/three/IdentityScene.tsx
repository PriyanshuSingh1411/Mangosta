"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import MongooseModel from "./MongooseModel";

function IdentityScene({
  pointer,
  revealProgress,
}: {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  revealProgress: React.MutableRefObject<number>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const staticProgress = useRef(0);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.intensity = 1.4 * revealProgress.current;
    }
  });

  return (
    <>
      <color attach="background" args={["#0a0a0a"]} />
      <fog attach="fog" args={["#0a0a0a", 3, 9]} />
      <ambientLight intensity={0.14} />
      <pointLight ref={lightRef} position={[1.2, 1.2, 2.4]} intensity={0} color="#c4ff61" distance={6} decay={2} />
      <directionalLight position={[-2, 2, 2]} intensity={0.6} color="#b8b2a6" />
      <directionalLight position={[2, -1, 2]} intensity={0.25} color="#f5f2ec" />
      <group rotation={[0, -0.4, 0]} scale={0.85}>
        <MongooseModel pointer={pointer} scrollProgress={staticProgress} />
      </group>
    </>
  );
}

export default function IdentityScene3D({
  pointer,
  revealProgress,
}: {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  revealProgress: React.MutableRefObject<number>;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 4.6], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <IdentityScene pointer={pointer} revealProgress={revealProgress} />
      </Suspense>
    </Canvas>
  );
}
