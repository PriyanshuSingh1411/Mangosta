"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function RotatingGarment({
  color,
  autoRotate,
  dragRotation,
}: {
  color: string;
  autoRotate: boolean;
  dragRotation: React.MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.Group>(null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.1,
        roughness: 0.55,
        flatShading: true,
      }),
    [color]
  );

  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (autoRotate) {
      mesh.current.rotation.y += delta * 0.25;
    } else {
      mesh.current.rotation.y = dragRotation.current;
    }
  });

  return (
    <group ref={mesh}>
      {/* Simplified garment-like silhouette: torso block + collar ring + sleeves */}
      <mesh material={material} position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.85, 1.05, 2.1, 8, 1]} />
      </mesh>
      <mesh material={material} position={[0, 1.2, 0]} castShadow>
        <torusGeometry args={[0.42, 0.14, 8, 16]} />
      </mesh>
      <mesh material={material} position={[-1.05, 0.55, 0]} rotation={[0, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 1.1, 7]} />
      </mesh>
      <mesh material={material} position={[1.05, 0.55, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 1.1, 7]} />
      </mesh>
    </group>
  );
}

function Scene({
  color,
  autoRotate,
  dragRotation,
}: {
  color: string;
  autoRotate: boolean;
  dragRotation: React.MutableRefObject<number>;
}) {
  return (
    <>
      <color attach="background" args={["#141311"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 4, 3]} intensity={1.2} color="#f5f2ec" />
      <directionalLight position={[-3, 1, -3]} intensity={1.1} color="#f5f2ec" />
      <pointLight position={[-3, 1, -2]} intensity={0.9} color="#c4ff61" distance={8} />
      <pointLight position={[0, -2, 3]} intensity={0.4} color="#b8b2a6" distance={8} />
      <RotatingGarment color={color} autoRotate={autoRotate} dragRotation={dragRotation} />
    </>
  );
}

export default function ProductViewer3D({ colorHex }: { colorHex: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRotation = useRef(0.6);
  const lastX = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - lastX.current;
    dragRotation.current += delta * 0.01;
    lastX.current = e.clientX;
  };

  const onPointerUp = () => setIsDragging(false);

  return (
    <div
      className="relative h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Canvas
        camera={{ position: [0, 0.3, 6.2], fov: 32 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        className="!absolute inset-0"
      >
        <Suspense fallback={null}>
          <Scene color={colorHex} autoRotate={!isDragging} dragRotation={dragRotation} />
        </Suspense>
      </Canvas>
      <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-stone">
        DRAG TO EXPLORE
      </span>
    </div>
  );
}
