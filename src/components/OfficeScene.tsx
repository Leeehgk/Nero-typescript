import { useLayoutEffect, type ReactNode } from "react";
import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Color, Fog } from "three";
import { useNeroStore } from "../store";
import { HabboKeyboard } from "./HabboKeyboard";
import { PixelAgent } from "./PixelAgent";

function HabboSky() {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.background = new Color("#87b8d8");
    scene.fog = new Fog("#a8cce8", 14, 42);
  }, [scene]);
  return null;
}

/** Vista isométrica fixa (tipo Habbo): câmara olha para o centro do quarto. */
function CameraIso() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/** Xadrez bege / castanho como referência Habbo. */
function HabboFloor() {
  const tiles: ReactNode[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      const c = (x + z) % 2 === 0 ? "#e8dcc8" : "#b8956a";
      tiles.push(
        <mesh
          key={`${x}-${z}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0, z]}
          receiveShadow
        >
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={c} roughness={0.92} metalness={0.02} />
        </mesh>
      );
    }
  }
  return <group>{tiles}</group>;
}

/** Clique no chão — move o Nero para o azulejo mais próximo. */
function FloorClickNav() {
  const setAgentTarget = useNeroStore((s) => s.setAgentTarget);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const { x, z } = e.point;
        setAgentTarget(x, z);
      }}
    >
      <planeGeometry args={[11, 11]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function HabboBackWall() {
  const green = "#2f5c42";
  return (
    <group>
      <mesh position={[0, 1.65, -5.52]} receiveShadow>
        <boxGeometry args={[12.2, 3.4, 0.35]} />
        <meshStandardMaterial color={green} roughness={0.88} />
      </mesh>
      <mesh position={[0, 1.1, -5.32]}>
        <planeGeometry args={[1.1, 2.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[-4.2, 2.5, -5.25]}>
        <planeGeometry args={[2.2, 1.5]} />
        <meshStandardMaterial color="#b8dcf0" emissive="#6aa8c8" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function HabboSideWall() {
  return (
    <mesh position={[-5.52, 1.65, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
      <boxGeometry args={[12.2, 3.4, 0.35]} />
      <meshStandardMaterial color="#e8dcc8" roughness={0.9} />
    </mesh>
  );
}

function HabboColumns() {
  const marble = "#f5f2eb";
  return (
    <group position={[-4.6, 0, 2.2]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 2.8, 12]} />
        <meshStandardMaterial color={marble} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <boxGeometry args={[0.45, 0.2, 0.45]} />
        <meshStandardMaterial color={marble} roughness={0.5} />
      </mesh>
    </group>
  );
}

function HabboOfficeFurniture() {
  const wood = "#c49a6c";
  const dark = "#8b6914";
  return (
    <group>
      <group position={[2.2, 0, -3.6]}>
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.09, 1.4]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
        {[
          [-1.2, 0.19, 0.55],
          [1.2, 0.19, 0.55],
          [-1.2, 0.19, -0.55],
          [1.2, 0.19, -0.55],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.12, 0.38, 0.12]} />
            <meshStandardMaterial color={dark} />
          </mesh>
        ))}
        <mesh position={[0.3, 0.85, -0.45]} castShadow>
          <boxGeometry args={[0.75, 0.5, 0.06]} />
          <meshStandardMaterial color="#2a2a30" />
        </mesh>
        <mesh position={[0.3, 0.85, -0.42]}>
          <planeGeometry args={[0.65, 0.38]} />
          <meshStandardMaterial color="#3a5568" emissive="#1e3040" emissiveIntensity={0.45} />
        </mesh>
        <mesh position={[0.25, 0.55, 0.2]} castShadow>
          <boxGeometry args={[0.35, 0.06, 0.25]} />
          <meshStandardMaterial color="#eae8e4" />
        </mesh>
      </group>

      <group position={[-1.5, 0, -3.8]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.35, 0.85]} />
          <meshStandardMaterial color="#2a2a2e" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.55, -0.35]} castShadow>
          <boxGeometry args={[2.1, 0.45, 0.08]} />
          <meshStandardMaterial color="#5c4030" />
        </mesh>
      </group>

      <mesh position={[-2.5, 0.02, 1.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color="#4a4a52" roughness={0.95} />
      </mesh>

      <mesh position={[3.2, 0.65, 1.2]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#4a7cba" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[3.2, 0.05, 1.2]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.65, 8]} />
        <meshStandardMaterial color={wood} />
      </mesh>

      <mesh position={[-3.5, 0.9, -2]} castShadow>
        <boxGeometry args={[0.45, 1.8, 0.45]} />
        <meshStandardMaterial color="#f0ebe4" roughness={0.7} />
      </mesh>
      <mesh position={[-3.5, 1.85, -2]} castShadow>
        <sphereGeometry args={[0.55, 10, 10]} />
        <meshStandardMaterial color="#c8e8c8" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function OfficeScene() {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} style={{ cursor: "crosshair" }}>
      <HabboSky />
      <OrthographicCamera makeDefault position={[18, 16, 18]} zoom={34} near={0.1} far={120} />
      <CameraIso />
      <HabboKeyboard />
      <ambientLight intensity={0.62} color="#fff8f0" />
      <hemisphereLight args={["#ffffff", "#8fb89a", 0.42]} position={[0, 20, 0]} />
      <directionalLight
        castShadow
        position={[10, 22, 12]}
        intensity={1.05}
        color="#fff5e6"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <pointLight position={[-4, 8, 4]} intensity={0.28} color="#ffe8cc" />
      <HabboFloor />
      <FloorClickNav />
      <HabboBackWall />
      <HabboSideWall />
      <HabboColumns />
      <HabboOfficeFurniture />
      <PixelAgent />
    </Canvas>
  );
}
