"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Procedural low-poly mongoose built as a SINGLE extruded silhouette (not a
 * union of primitive limbs). A stacked-primitive approach reads as scattered
 * debris once lit and partially occluded by text; a continuous extruded
 * profile - echoing the flat brand mark's posture (low body, arched back,
 * alert raised head, long sweeping tail) - reads as one coherent sculptural
 * object at hero scale.
 */
export default function MongooseModel({
  pointer,
  scrollProgress,
}: {
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  scrollProgress: React.MutableRefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#c9c4b6"),
        metalness: 0.55,
        roughness: 0.4,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    []
  );

  const rimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#8c8880"),
        metalness: 0.6,
        roughness: 0.45,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    []
  );

  const eyeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#c4ff61"),
        emissive: new THREE.Color("#c4ff61"),
        emissiveIntensity: 1.6,
        metalness: 0.1,
        roughness: 0.25,
      }),
    []
  );

  // Single continuous silhouette traced nose -> forehead -> ear -> back arch
  // -> rump -> tail base -> rear leg -> belly -> front leg -> chest -> chin
  // -> nose. Facing +X, in local units.
  const { bodyGeometry, tailGeometry } = useMemo(() => {
    const body = new THREE.Shape();
    body.moveTo(1.55, 0.62); // nose tip
    body.quadraticCurveTo(1.5, 0.78, 1.3, 0.86); // forehead
    body.quadraticCurveTo(1.18, 0.98, 1.1, 1.12); // ear front
    body.quadraticCurveTo(1.02, 1.2, 0.96, 1.1); // ear tip
    body.quadraticCurveTo(0.92, 1.0, 0.98, 0.9); // ear back
    body.quadraticCurveTo(0.86, 0.78, 0.7, 0.7); // back of head/neck start
    body.quadraticCurveTo(0.5, 0.62, 0.42, 0.78); // neck to back arch rise
    body.quadraticCurveTo(0.3, 0.98, 0.05, 1.0); // shoulder/back peak
    body.quadraticCurveTo(-0.25, 1.02, -0.5, 0.86); // back slope down
    body.quadraticCurveTo(-0.7, 0.74, -0.82, 0.56); // rump
    body.quadraticCurveTo(-0.9, 0.44, -0.86, 0.3); // tail base upper
    body.quadraticCurveTo(-0.6, 0.2, -0.3, 0.12); // rump underside toward legs
    body.quadraticCurveTo(-0.5, -0.15, -0.62, -0.55); // rear leg back
    body.quadraticCurveTo(-0.6, -0.72, -0.48, -0.74); // rear paw
    body.quadraticCurveTo(-0.38, -0.72, -0.36, -0.56); // rear paw front
    body.quadraticCurveTo(-0.34, -0.3, -0.22, -0.05); // rear leg front / belly start
    body.quadraticCurveTo(-0.05, 0.1, 0.2, 0.05); // belly curve
    body.quadraticCurveTo(0.36, 0.0, 0.42, -0.2); // toward front leg
    body.quadraticCurveTo(0.46, -0.5, 0.5, -0.68); // front leg back
    body.quadraticCurveTo(0.52, -0.8, 0.64, -0.78); // front paw
    body.quadraticCurveTo(0.72, -0.74, 0.68, -0.58); // front paw front
    body.quadraticCurveTo(0.64, -0.3, 0.68, -0.02); // front leg front / chest
    body.quadraticCurveTo(0.74, 0.28, 0.95, 0.4); // chest rise to chin
    body.quadraticCurveTo(1.15, 0.46, 1.3, 0.44); // chin/jaw
    body.quadraticCurveTo(1.42, 0.46, 1.55, 0.62); // back to nose

    const bodyGeo = new THREE.ExtrudeGeometry(body, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 8,
    });
    bodyGeo.center();
    bodyGeo.computeVertexNormals();

    // Tail as its own tapered extrude for independent sway animation
    const tail = new THREE.Shape();
    tail.moveTo(0.1, 0.16);
    tail.quadraticCurveTo(-0.15, 0.22, -0.42, 0.14);
    tail.quadraticCurveTo(-0.75, 0.04, -1.02, -0.18);
    tail.quadraticCurveTo(-1.2, -0.34, -1.3, -0.56);
    tail.quadraticCurveTo(-1.34, -0.68, -1.24, -0.68);
    tail.quadraticCurveTo(-1.1, -0.5, -0.9, -0.32);
    tail.quadraticCurveTo(-0.6, -0.08, -0.28, 0.0);
    tail.quadraticCurveTo(-0.05, 0.04, 0.1, -0.02);
    tail.closePath();

    const tailGeo = new THREE.ExtrudeGeometry(tail, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 8,
    });
    tailGeo.computeVertexNormals();

    return { bodyGeometry: bodyGeo, tailGeometry: tailGeo };
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();

    group.current.position.y = Math.sin(t * 0.6) * 0.06 - scrollProgress.current * 0.6;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      -0.35 + pointer.current.x * 0.4 - scrollProgress.current * 1.1,
      0.045
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      pointer.current.y * -0.1,
      0.045
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      pointer.current.y * 0.04,
      0.045
    );

    if (eyeRef.current) {
      eyeRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06);
    }
  });

  return (
    <group ref={group} scale={0.92} dispose={null}>
      <mesh geometry={bodyGeometry} material={material} castShadow receiveShadow />
      <mesh
        geometry={tailGeometry}
        material={rimMaterial}
        position={[-0.78, 0.08, -0.03]}
        castShadow
      />
      <mesh ref={eyeRef} material={eyeMaterial} position={[1.28, 0.78, 0.16]}>
        <sphereGeometry args={[0.05, 10, 10]} />
      </mesh>
    </group>
  );
}
