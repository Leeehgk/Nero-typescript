import { useRef } from "react";
import { useNeroStore } from "../store";

export function useFurnitureEvents(id: string, rotation?: [number, number, number]) {
  const clickTime = useRef(0);
  const isStoreOpen = useNeroStore((s) => s.isStoreOpen);
  
  return {
    onClick: (e: any) => {
      e.stopPropagation();
      if (!isStoreOpen) return;
      if (Date.now() - clickTime.current > 200) return;
      const rot = rotation || [0, 0, 0];
      useNeroStore.getState().updateFurniture(id, { rotation: [rot[0], rot[1] - Math.PI / 2, rot[2]] });
    },
    onPointerDown: (e: any) => {
      e.stopPropagation();
      if (!isStoreOpen) return;
      clickTime.current = Date.now();
      useNeroStore.getState().setDraggingFurnitureId(id);
    },
  };
}

// ================= CLÁSSICOS ================= //

export function Desk({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const computerActive = useNeroStore((s) => s.computerActive);
  const events = useFurnitureEvents(id, rotation);
  const wood = "#c49a6c";
  const dark = "#8b6914";
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.09, 1.4]} />
        <meshStandardMaterial color={wood} roughness={0.6} />
      </mesh>
      {[
        [-1.2, 0.19, 0.55], [1.2, 0.19, 0.55], [-1.2, 0.19, -0.55], [1.2, 0.19, -0.55],
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
      <mesh position={[0.3, 0.85, -0.414]}>
        <planeGeometry args={[0.56, 0.3]} />
        <meshBasicMaterial color={computerActive ? "#eef3f6" : "#334b5b"} />
      </mesh>
      <mesh position={[0.25, 0.55, 0.2]} castShadow>
        <boxGeometry args={[0.35, 0.06, 0.25]} />
        <meshStandardMaterial color="#eae8e4" />
      </mesh>
    </group>
  );
}

export function SeatingGroup({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.35, 0.85]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.55, -0.35]} castShadow>
        <boxGeometry args={[2.1, 0.45, 0.08]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
    </group>
  );
}

export function Rug({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color="#4a4a52" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Globe({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const wood = "#c49a6c";
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#4a7cba" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.65, 8]} />
        <meshStandardMaterial color={wood} />
      </mesh>
    </group>
  );
}

// ================= PACOTE 1: LUXO E REDESIGN ================= //

export function Plant({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.2, 0.8, 12]} />
        <meshStandardMaterial color="#a39081" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.8, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 12]} />
        <meshStandardMaterial color="#30251d" roughness={1} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.9, 5]} />
        <meshStandardMaterial color="#40552b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.45, 12, 10]} />
        <meshStandardMaterial color="#608842" roughness={0.7} />
      </mesh>
      <mesh position={[-0.2, 1.2, 0.2]} castShadow>
        <sphereGeometry args={[0.35, 10, 8]} />
        <meshStandardMaterial color="#4f7532" roughness={0.7} />
      </mesh>
      <mesh position={[0.2, 1.3, -0.1]} castShadow>
        <sphereGeometry args={[0.4, 10, 8]} />
        <meshStandardMaterial color="#557c37" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Sofa({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  const color = "#34495e";
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.4, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.9, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.9, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[-1.3, 0.7, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.6, 1.0]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[1.3, 0.7, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.6, 1.0]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Bookshelf({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  const wood = "#5c4030";
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 2.4, 0.6]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 0.28]}>
        <planeGeometry args={[1.4, 2.2]} />
        <meshStandardMaterial color="#2a1d15" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.6, 0.3]} castShadow>
        <boxGeometry args={[1.4, 0.05, 0.55]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 1.2, 0.3]} castShadow>
        <boxGeometry args={[1.4, 0.05, 0.55]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 1.8, 0.3]} castShadow>
        <boxGeometry args={[1.4, 0.05, 0.55]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      {/* Livros decorativos */}
      <mesh position={[-0.3, 0.8, 0.2]}>
        <boxGeometry args={[0.4, 0.35, 0.3]} />
        <meshStandardMaterial color="#a43d3d" />
      </mesh>
      <mesh position={[0.4, 1.4, 0.2]}>
        <boxGeometry args={[0.3, 0.35, 0.3]} />
        <meshStandardMaterial color="#406a4b" />
      </mesh>
    </group>
  );
}

export function Lamp({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.1, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#333" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 0.5, 16]} />
        <meshStandardMaterial color="#fffbe6" roughness={0.9} emissive="#ffeaad" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

export function CoffeeTable({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.05, 1.0]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.9} opacity={1} transparent roughness={0.1} ior={1.5} />
      </mesh>
      {[[-0.7, 0.19, 0.4], [0.7, 0.19, 0.4], [-0.7, 0.19, -0.4], [0.7, 0.19, -0.4]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.05, 0.03, 0.38, 8]} />
          <meshStandardMaterial color="#bdc3c7" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export function Tv({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.6, 0.6]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.8, 1.0, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, 0.045]}>
        <planeGeometry args={[1.7, 0.9]} />
        <meshBasicMaterial color="#112233" />
      </mesh>
    </group>
  );
}

// ================= MAGNÉTICOS DE PAREDE ================= //

export function Painting({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[1.6, 1.2, 0.1]} />
        <meshStandardMaterial color="#121212" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[1.4, 1.0]} />
        <meshStandardMaterial color="#a0c0b8" />
      </mesh>
      <mesh position={[-0.3, -0.2, 0.111]}>
        <planeGeometry args={[0.4, 0.5]} />
        <meshBasicMaterial color="#c46a5c" />
      </mesh>
      <mesh position={[0.2, 0.2, 0.111]}>
        <planeGeometry args={[0.6, 0.4]} />
        <meshBasicMaterial color="#d4b455" />
      </mesh>
    </group>
  );
}

export function Board({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0, 0.03]} castShadow>
        <boxGeometry args={[2.0, 1.4, 0.06]} />
        <meshStandardMaterial color="#bdc3c7" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[1.9, 1.3]} />
        <meshStandardMaterial color="#ecf0f1" roughness={0.9} />
      </mesh>
      <mesh position={[-0.6, 0.3, 0.072]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshStandardMaterial color="#f1c40f" roughness={1} />
      </mesh>
    </group>
  );
}

// ================= NOVOS (LOTE 2) ================= //

export function Bed({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.4, 2.2]} />
        <meshStandardMaterial color="#3e2723" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.45, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.15, 1.8]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.9} />
      </mesh>
      {/* Travesseiros */}
      <mesh position={[-0.45, 0.55, -0.7]} castShadow>
        <boxGeometry args={[0.7, 0.15, 0.4]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.9} />
      </mesh>
      <mesh position={[0.45, 0.55, -0.7]} castShadow>
        <boxGeometry args={[0.7, 0.15, 0.4]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Wardrobe({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.8, 1.0]} />
        <meshStandardMaterial color="#4e342e" roughness={0.7} />
      </mesh>
      {/* Portas */}
      <mesh position={[-0.55, 1.4, 0.51]}>
        <planeGeometry args={[1.05, 2.7]} />
        <meshStandardMaterial color="#5d4037" roughness={0.6} />
      </mesh>
      <mesh position={[0.55, 1.4, 0.51]}>
        <planeGeometry args={[1.05, 2.7]} />
        <meshStandardMaterial color="#5d4037" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function DiningTable({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.08, 1.4]} />
        <meshStandardMaterial color="#212121" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Perna Central */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[1.8, 0.75, 0.4]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  );
}

export function Arcade({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.0, 1.1]} />
        <meshStandardMaterial color="#e53935" roughness={0.5} />
      </mesh>
      {/* Tela */}
      <mesh position={[0, 1.3, 0.4]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[0.8, 0.6]} />
        <meshBasicMaterial color="#00bcd4" />
      </mesh>
      {/* Teclado Arcade */}
      <mesh position={[0, 0.9, 0.6]} rotation={[0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.1, 0.4]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
    </group>
  );
}

export function Nightstand({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.6, 0.7]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.8} />
      </mesh>
      {/* Gavetas */}
      <mesh position={[0, 0.4, 0.36]}>
        <planeGeometry args={[0.6, 0.2]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
}

export function Bonsai({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      {/* Vaso */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.2, 0.4]} />
        <meshStandardMaterial color="#455a64" roughness={0.6} />
      </mesh>
      {/* Tronco */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.5, 5]} />
        <meshStandardMaterial color="#3e2723" roughness={0.9} />
      </mesh>
      {/* Folhas */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, 0.5, 0.1]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Mirror({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.0, 0.1]} />
        <meshStandardMaterial color="#795548" roughness={0.7} />
      </mesh>
      {/* Reflexo falso */}
      <mesh position={[0, 1.0, 0.06]}>
        <planeGeometry args={[0.8, 1.8]} />
        <meshStandardMaterial color="#b0bec5" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

export function Statue({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.3, 0.6]} />
        <meshStandardMaterial color="#212121" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.4, 1.2, 6]} />
        <meshStandardMaterial color="#cfd8dc" metalness={0.3} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function WallClock({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
        <meshStandardMaterial color="#212121" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.11]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      {/* Ponteiros */}
      <mesh position={[0, 0.08, 0.12]}>
        <planeGeometry args={[0.02, 0.16]} />
        <meshBasicMaterial color="#d32f2f" />
      </mesh>
    </group>
  );
}

export function Speaker({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.2, 0.5]} />
        <meshStandardMaterial color="#111111" roughness={0.6} />
      </mesh>
      {/* Woofers */}
      <mesh position={[0, 0.8, 0.26]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="#424242" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0.26]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="#424242" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ================= RENDERIZADOR PRINCIPAL ================= //

export function HabboOfficeFurniture() {
  const furnitureList = useNeroStore((s) => s.furnitureList);
  if (!furnitureList) return null;

  return (
    <group>
      {furnitureList.map((item) => {
        switch (item.type) {
          case "desk": return <Desk key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "seating": return <SeatingGroup key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "rug": return <Rug key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "globe": return <Globe key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "plant": return <Plant key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "painting": return <Painting key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "board": return <Board key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "bookshelf": return <Bookshelf key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "sofa": return <Sofa key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "lamp": return <Lamp key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "coffeetable": return <CoffeeTable key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "tv": return <Tv key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "bed": return <Bed key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "wardrobe": return <Wardrobe key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "diningtable": return <DiningTable key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "arcade": return <Arcade key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "nightstand": return <Nightstand key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "bonsai": return <Bonsai key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "mirror": return <Mirror key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "statue": return <Statue key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "wall_clock": return <WallClock key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "speaker": return <Speaker key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          default: return null;
        }
      })}
    </group>
  );
}
