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
      {/* Corpo principal do gabinete */}
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.4, 0.7]} />
        <meshStandardMaterial color="#2a4154" roughness={0.55} />
      </mesh>
      {/* Painel superior inclinado (tela) */}
      <mesh position={[0, 1.55, 0.05]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.78, 1.0, 0.15]} />
        <meshStandardMaterial color="#1b1b2f" roughness={0.4} />
      </mesh>
      {/* Tela CRT */}
      <mesh position={[0, 1.55, 0.13]} rotation={[0.35, 0, 0]}>
        <planeGeometry args={[0.55, 0.7]} />
        <meshBasicMaterial color="#0a4a2a" />
      </mesh>
      {/* Scanlines na tela */}
      <mesh position={[0, 1.55, 0.135]} rotation={[0.35, 0, 0]}>
        <planeGeometry args={[0.55, 0.7]} />
        <meshBasicMaterial color="#00ff55" transparent opacity={0.08} />
      </mesh>
      {/* Borda da tela (bezel) */}
      <mesh position={[-0.39, 1.55, 0.13]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.02, 0.72, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.39, 1.55, 0.13]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.02, 0.72, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Marquee (topo) */}
      <mesh position={[0, 1.95, 0.05]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.82, 0.4, 0.05]} />
        <meshStandardMaterial color="#f39c12" emissive="#d4880a" emissiveIntensity={0.3} />
      </mesh>
      {/* Cartela do marquee */}
      <mesh position={[0, 1.95, 0.075]} rotation={[0.15, 0, 0]}>
        <planeGeometry args={[0.7, 0.28]} />
        <meshBasicMaterial color="#e74c3c" />
      </mesh>
      {/* Painel de controle (joystick e botoes) */}
      <mesh position={[0, 1.05, 0.42]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.88, 0.06, 0.3]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.6} />
      </mesh>
      {/* Joystick */}
      <mesh position={[-0.18, 1.12, 0.5]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.06, 12]} />
        <meshStandardMaterial color="#333" metalness={0.6} />
      </mesh>
      <mesh position={[-0.18, 1.22, 0.52]} castShadow>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      {/* Botoes */}
      <mesh position={[0.08, 1.11, 0.5]}>
        <cylinderGeometry args={[0.035, 0.035, 0.015, 10]} />
        <meshStandardMaterial color="#f1c40f" emissive="#f1c40f" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.22, 1.11, 0.5]}>
        <cylinderGeometry args={[0.035, 0.035, 0.015, 10]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      <mesh position={[0.36, 1.11, 0.5]}>
        <cylinderGeometry args={[0.035, 0.035, 0.015, 10]} />
        <meshStandardMaterial color="#2ecc71" />
      </mesh>
      {/* Slot de moeda */}
      <mesh position={[0.35, 0.65, 0.36]}>
        <planeGeometry args={[0.04, 0.15]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Grade de som inferior */}
      <mesh position={[0, 0.3, 0.36]}>
        <boxGeometry args={[0.5, 0.12, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Moedas decorativas */}
      <mesh position={[-0.12, 0.45, 0.36]}>
        <cylinderGeometry args={[0.04, 0.04, 0.008, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
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

// ================= PACOTE 3: DIVERSÃO E ACONCHEGO ================= //

export function Fridge({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.0, 0.9]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Porta superior (congelador) */}
      <mesh position={[0, 1.6, 0.46]}>
        <planeGeometry args={[0.85, 0.7]} />
        <meshStandardMaterial color="#bdbdbd" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Porta inferior (geladeira) */}
      <mesh position={[0, 0.7, 0.46]}>
        <planeGeometry args={[0.85, 1.1]} />
        <meshStandardMaterial color="#bdbdbd" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Puxador */}
      <mesh position={[0.35, 0.7, 0.48]}>
        <boxGeometry args={[0.04, 0.35, 0.04]} />
        <meshStandardMaterial color="#757575" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function Fireplace({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      {/* Corpo da lareira */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.2, 0.8]} />
        <meshStandardMaterial color="#5d4037" roughness={0.85} />
      </mesh>
      {/* Chaminé */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.6]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </mesh>
      {/* Abertura */}
      <mesh position={[0, 0.5, 0.39]}>
        <planeGeometry args={[0.7, 0.6]} />
        <meshStandardMaterial color="#1a0a00" roughness={1} />
      </mesh>
      {/* Fogo fake */}
      <mesh position={[0, 0.4, 0.35]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.45, 0.3]}>
        <sphereGeometry args={[0.15, 8, 6]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ff8800" emissiveIntensity={0.4} />
      </mesh>
      {/* Prateleira superior */}
      <mesh position={[0, 1.25, 0.15]} castShadow>
        <boxGeometry args={[2.0, 0.1, 0.9]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Piano({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      {/* Corpo principal */}
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.4, 0.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Tampa */}
      <mesh position={[0, 1.45, -0.1]} castShadow>
        <boxGeometry args={[1.65, 0.06, 0.75]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.3} />
      </mesh>
      {/* Teclas brancas */}
      <mesh position={[0, 0.85, 0.36]}>
        <boxGeometry args={[1.4, 0.08, 0.15]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.5} />
      </mesh>
      {/* Pernas */}
      {[[-0.7, 0.05, -0.25], [0.7, 0.05, -0.25], [-0.7, 0.05, 0.25], [0.7, 0.05, 0.25]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.05, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
    </group>
  );
}

export function VendingMachine({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.9, 0.8]} />
        <meshStandardMaterial color="#1565c0" roughness={0.5} />
      </mesh>
      {/* Vidro frontal */}
      <mesh position={[0, 1.1, 0.38]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshPhysicalMaterial color="#e3f2fd" transmission={0.8} roughness={0.1} />
      </mesh>
      {/* Prateleiras internas */}
      <mesh position={[0, 0.8, 0.34]}>
        <boxGeometry args={[0.75, 0.03, 0.04]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      <mesh position={[0, 1.1, 0.34]}>
        <boxGeometry args={[0.75, 0.03, 0.04]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      <mesh position={[0, 1.4, 0.34]}>
        <boxGeometry args={[0.75, 0.03, 0.04]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      {/* Compartimento de coleta */}
      <mesh position={[0, 0.2, 0.38]}>
        <boxGeometry args={[0.5, 0.3, 0.04]} />
        <meshStandardMaterial color="#0d47a1" />
      </mesh>
    </group>
  );
}

export function Barrel({ id, position, rotation }: { id: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const events = useFurnitureEvents(id, rotation);
  return (
    <group position={position} rotation={rotation} {...events}>
      {/* Barril de madeira estilo viking */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.28, 1.1, 14]} />
        <meshStandardMaterial color="#5d4037" roughness={0.85} />
      </mesh>
      {/* Faixas de metal */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <torusGeometry args={[0.32, 0.025, 6, 16]} />
        <meshStandardMaterial color="#78909c" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <torusGeometry args={[0.3, 0.025, 6, 16]} />
        <meshStandardMaterial color="#78909c" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Topo do barril */}
      <mesh position={[0, 1.1, 0]}>
        <circleGeometry args={[0.34, 14]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
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
          case "fridge": return <Fridge key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "fireplace": return <Fireplace key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "piano": return <Piano key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "vending": return <VendingMachine key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          case "barrel": return <Barrel key={item.id} id={item.id} position={item.position} rotation={item.rotation} />;
          default: return null;
        }
      })}
    </group>
  );
}
