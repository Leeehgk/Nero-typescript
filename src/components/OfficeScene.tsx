import { useLayoutEffect, useRef, type ReactNode } from "react";
import { OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Color } from "three";
import { useNeroStore } from "../store";
import { HabboKeyboard } from "./HabboKeyboard";
import { PixelAgent } from "./PixelAgent";
import { HabboOfficeFurniture } from "./FurnitureRegistry";

function HabboSky() {
  const { scene } = useThree();
  const theme = useNeroStore((s) => s.themeMode);

  useLayoutEffect(() => {
    if (theme === "hacker") scene.background = new Color("#0b120d"); // levemente mais claro
    else if (theme === "premium") scene.background = new Color("#161a2b");
    else scene.background = new Color("#87b8d8"); // common
    scene.fog = null;
  }, [scene, theme]);
  return null;
}

function CameraIso() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function HabboFloor() {
  const theme = useNeroStore((s) => s.themeMode);
  const tiles: ReactNode[] = [];
  
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      let c = "";
      let r = 0.92;
      let m = 0.02;

      const isEven = (x + z) % 2 === 0;

      if (theme === "hacker") {
        c = isEven ? "#19261d" : "#0f1611"; // Gunmetal verde ao invez de preto escuro
        r = 0.6; // Suaviza o reflexo do preto
        m = 0.5; // Menos espelhado
      } else if (theme === "premium") {
        c = isEven ? "#fdfdfd" : "#f1f2f6";
        r = 0.1;
        m = 0.1;
      } else { // common
        c = isEven ? "#e8dcc8" : "#b8956a";
      }

      tiles.push(
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color={c} roughness={r} metalness={m} />
          </mesh>
          
          {/* Malha/Grelha de Neon no Chao para Modo Hacker */}
          {theme === "hacker" && isEven && (
             <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
               {/* Usando ring pra simular borda da matriz tech */}
               <ringGeometry args={[0.45, 0.48, 4, 1, Math.PI / 4]} />
               <meshBasicMaterial color="#00ff55" transparent opacity={0.15} />
             </mesh>
          )}
        </group>
      );
    }
  }
  return <group>{tiles}</group>;
}

function FloorClickNav() {
  const setAgentTarget = useNeroStore((s) => s.setAgentTarget);
  const draggingFurnitureId = useNeroStore((s) => s.draggingFurnitureId);
  const setDraggingFurnitureId = useNeroStore((s) => s.setDraggingFurnitureId);
  const updateFurniture = useNeroStore((s) => s.updateFurniture);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerDown={(e) => {
        if (draggingFurnitureId) return; // bloqueia rota se o usuario errou clique no drop
        e.stopPropagation();
        const { x, z } = e.point;
        setAgentTarget(x, z);
      }}
      onPointerMove={(e) => {
        if (!draggingFurnitureId) return;
        e.stopPropagation();
        const { x, z } = e.point;
        let snapX = Math.round(x);
        let snapZ = Math.round(z);
        const state = useNeroStore.getState();
        const item = state.furnitureList.find(f => f.id === draggingFurnitureId);
        
        if (item) {
          let snapY = item.position[1];
          let rot = item.rotation || [0, 0, 0];

          // Ímã de Parede de Luxo
          const wallItems = ["painting", "board"];
          if (wallItems.includes(item.type)) {
            if (snapZ <= -4) {
              snapZ = -5.35; // Fundo
              snapY = 1.8;
              rot = [0, 0, 0];
            } else if (snapX <= -4) {
              snapX = -5.35; // Lateral
              snapY = 1.8;
              rot = [0, Math.PI / 2, 0];
            } else {
              snapY = 0.5; // Caiu no chao
            }
          }

          if (Math.round(item.position[0]) !== snapX || Math.round(item.position[2]) !== snapZ || item.position[1] !== snapY) {
            updateFurniture(draggingFurnitureId, { position: [snapX, snapY, snapZ], rotation: rot });
          }
        }
      }}
      onPointerUp={(e) => {
        if (draggingFurnitureId) {
          e.stopPropagation();
          setDraggingFurnitureId(null);
        }
      }}
    >
      <planeGeometry args={[22, 22]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function HabboBackWall() {
  const theme = useNeroStore((s) => s.themeMode);
  const wallColors = {
    common: "#2f5c42",
    hacker: "#16281e", // Verde militar escuro visível
    premium: "#e6e9ee",
  };
  const windowColors = {
    common: "#9ab8ca",
    hacker: "#0e1e14", // Deixa a janela com profundidade
    premium: "#b2ccda", 
  };
  
  return (
    <group>
      {/* Parede Principal */}
      <mesh position={[0, 1.65, -5.52]} receiveShadow>
        <boxGeometry args={[12.2, 3.4, 0.35]} />
        <meshStandardMaterial color={wallColors[theme]} roughness={theme === "premium" ? 0.3 : 0.88} />
      </mesh>
      
      {/* Listras Tron / Neon Matrix Server */}
      {theme === "hacker" && (
        <group position={[0, 1.65, -5.33]}>
          {[-4.5, -2.5, 0, 2.5, 4.5].map((px) => (
             <mesh key={px} position={[px, 0, 0]}>
               <boxGeometry args={[0.08, 3.4, 0.05]} />
               <meshStandardMaterial color="#00ff55" emissive="#00f34c" emissiveIntensity={1.8} />
             </mesh>
          ))}
          {/* Cabo de neon correndo no rodape */}
          <mesh position={[0, -1.5, 0.05]}>
            <boxGeometry args={[12.2, 0.05, 0.03]} />
            <meshStandardMaterial color="#00ff55" emissive="#00f34c" emissiveIntensity={2} />
          </mesh>
        </group>
      )}

      {/* Area Escura Janela */}
      <mesh position={[0, 1.1, -5.32]}>
        <planeGeometry args={[1.1, 2.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[-4.2, 2.5, -5.25]}>
        <planeGeometry args={[2.2, 1.5]} />
        <meshStandardMaterial color={windowColors[theme]} roughness={0.92} metalness={0.02} />
      </mesh>
    </group>
  );
}

function HabboSideWall() {
  const theme = useNeroStore((s) => s.themeMode);
  const wallColors = {
    common: "#e8dcc8",
    hacker: "#122119", // Acinzentado cibernético
    premium: "#fdfdfd",
  };
  return (
    <group>
      <mesh position={[-5.52, 1.65, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[12.2, 3.4, 0.35]} />
        <meshStandardMaterial color={wallColors[theme]} roughness={theme === "premium" ? 0.3 : 0.9} />
      </mesh>

      {/* Continuacao do cabo Neon de rodape proxima a parede */}
      {theme === "hacker" && (
         <mesh position={[-5.33, 0.15, 0]} rotation={[0, Math.PI / 2, 0]}>
           <boxGeometry args={[12.2, 0.05, 0.03]} />
           <meshStandardMaterial color="#00ff55" emissive="#00f34c" emissiveIntensity={2} />
         </mesh>
      )}
    </group>
  );
}

function HabboColumns() {
  const theme = useNeroStore((s) => s.themeMode);

  if (theme === "hacker") {
    // Coluna Tecnologica Dark Cyberpunk
    return (
      <group position={[-4.6, 0, 2.2]}>
        <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.24, 2.8, 8]} />
          <meshStandardMaterial color="#1f3626" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 2.85, 0]} castShadow>
          <boxGeometry args={[0.45, 0.2, 0.45]} />
          <meshStandardMaterial color="#1f3626" roughness={0.5} />
        </mesh>
        {/* Veias de Neon Pulsante */}
        <mesh position={[0.18, 1.4, 0.18]}>
          <boxGeometry args={[0.03, 2.8, 0.03]} />
          <meshStandardMaterial color="#00f34c" emissive="#00ff44" emissiveIntensity={3} />
        </mesh>
        <mesh position={[-0.18, 1.4, 0.18]}>
          <boxGeometry args={[0.03, 2.8, 0.03]} />
          <meshStandardMaterial color="#00f34c" emissive="#00ff44" emissiveIntensity={3} />
        </mesh>
      </group>
    );
  }

  const marbleColors = {
    common: "#f5f2eb",
    hacker: "#1c2e22", 
    premium: "#d4af37", 
  };
  const marble = marbleColors[theme];
  return (
    <group position={[-4.6, 0, 2.2]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 2.8, 12]} />
        <meshStandardMaterial color={marble} roughness={theme === "premium" ? 0.2 : 0.45} metalness={theme === "premium" ? 0.8 : 0} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <boxGeometry args={[0.45, 0.2, 0.45]} />
        <meshStandardMaterial color={marble} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Componentes de moveis isolados no FurnitureRegistry

export function OfficeScene() {
  return (
    <Canvas 
      frameloop="always" 
      shadows 
      dpr={[1, 2]} 
      gl={{ antialias: true }} 
      style={{ cursor: "crosshair" }}
      onPointerUp={() => useNeroStore.getState().setDraggingFurnitureId(null)}
      onPointerLeave={() => useNeroStore.getState().setDraggingFurnitureId(null)}
    >
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
