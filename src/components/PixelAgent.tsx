import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Outlines } from "@react-three/drei";
import { useNeroStore, type AgentMood, type FurnitureItem } from "../store";
import { calculatePath, createCollisionGrid } from "./pathfinding";

type GridPoint = { x: number; z: number };

const GRID_MIN = -5;
const GRID_MAX = 5;
const INITIAL_FACING_Y = Math.PI * 0.25;
const WORKSTATION_POINT: GridPoint = { x: 3, z: -2 };
const PC_SCREEN_TARGET: GridPoint = { x: 3, z: -4 };
const WALK_SPEED = 4.9;
const ROTATION_SPEED = 9;

function clampTile(v: number): number {
  return Math.max(GRID_MIN, Math.min(GRID_MAX, Math.round(v)));
}

function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.z === b.z;
}

function faceAngle(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

function dampAngle(current: number, target: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const step = 1 - Math.exp(-ROTATION_SPEED * dt);
  return current + delta * step;
}

function moodParams(mood: AgentMood) {
  switch (mood) {
    case "thinking":
      return { bob: 0.05, arm: 0.34, idleSpeed: 3.8 };
    case "speaking":
      return { bob: 0.075, arm: 0.2, idleSpeed: 6.5 };
    case "success":
      return { bob: 0.09, arm: 0.14, idleSpeed: 5.1 };
    case "error":
      return { bob: 0.045, arm: 0.24, idleSpeed: 2.8 };
    case "listening":
      return { bob: 0.03, arm: 0.12, idleSpeed: 2.4 };
    default:
      return { bob: 0.035, arm: 0.08, idleSpeed: 1.5 };
  }
}

function isInteractionMood(mood: AgentMood): boolean {
  return mood === "thinking" || mood === "speaking" || mood === "success" || mood === "error";
}

function pickRandomTarget(from: GridPoint, furnitureList: FurnitureItem[]): GridPoint {
  const obstacles = createCollisionGrid(furnitureList);
  // Não deixa o móvel alvo cair em lugares proibidos
  for (let i = 0; i < 20; i++) {
    const dx = Math.floor(Math.random() * 5) - 2;
    const dz = Math.floor(Math.random() * 5) - 2;
    if (dx === 0 && dz === 0) continue;
    const next = {
      x: clampTile(from.x + dx),
      z: clampTile(from.z + dz),
    };
    if (!samePoint(next, from) && !obstacles.has(`${next.x},${next.z}`)) {
      return next;
    }
  }

  return {
    x: clampTile(from.x + 1),
    z: from.z,
  };
}

export function PixelAgent() {
  const group = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);

  const furnitureList = useNeroStore((s) => s.furnitureList) || [];
  
  const initialTarget = useNeroStore.getState().agentTarget;
  const posRef = useRef<GridPoint>({ x: initialTarget.x, z: initialTarget.z });
  const targetRef = useRef<GridPoint>(pickRandomTarget(initialTarget, furnitureList));
  const pathRef = useRef<GridPoint[]>([]); // Array de passos do algoritmo
  
  const lastExternalTargetRef = useRef<GridPoint>({ x: initialTarget.x, z: initialTarget.z });
  const facingRef = useRef(INITIAL_FACING_Y);
  const nextWanderAtRef = useRef(0);
  const lastDebugSyncAtRef = useRef(0);
  const prevMoodRef = useRef<AgentMood>(useNeroStore.getState().mood);
  const waitingToPauseAtWorkstationRef = useRef(false);
  const lastPathFailedAtRef = useRef<{ x: number, z: number } | null>(null);

  const setAgentDebug = useNeroStore((s) => s.setAgentDebug);
  const skinMode = useNeroStore((s) => s.skinMode);
  const agentShirt = useNeroStore((s) => s.agentShirt);
  const agentShoe = useNeroStore((s) => s.agentShoe);
  const agentHair = useNeroStore((s) => s.agentHair);
  const agentEye = useNeroStore((s) => s.agentEye);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const { mood, agentTarget, furnitureList } = useNeroStore.getState();
    const params = moodParams(mood);
    const isThinking = mood === "thinking";
    const isInteraction = isInteractionMood(mood);

    // Repath function helper
    const navigateTo = (dest: GridPoint) => {
      targetRef.current = dest;
      const roundedPos = { x: Math.round(posRef.current.x), z: Math.round(posRef.current.z) };
      pathRef.current = calculatePath(roundedPos, dest, furnitureList || []);
      
      console.log(`[A* Pathfinder] Origem: ${roundedPos.x},${roundedPos.z} | Alvo: ${dest.x},${dest.z} | Nós Livres: ${pathRef.current.length}`);

      if (pathRef.current.length > 0 && 
          Math.hypot(pathRef.current[0].x - posRef.current.x, pathRef.current[0].z - posRef.current.z) < 0.2) {
        pathRef.current.shift();
      }
      useNeroStore.getState().setPathDebug([...pathRef.current]);
    };

    // Força o pathfinding para o trajeto da inicialização que ignorava a Rota nodal.
    if (pathRef.current.length === 0 && !lastPathFailedAtRef.current && !samePoint(targetRef.current, {x: Math.round(posRef.current.x), z: Math.round(posRef.current.z)})) {
       const hasReachedFallback = Math.hypot(targetRef.current.x - posRef.current.x, targetRef.current.z - posRef.current.z) < 0.05;
       if (!hasReachedFallback) navigateTo(targetRef.current);
    }

    if (prevMoodRef.current !== mood) {
      if (isInteraction) {
        lastExternalTargetRef.current = { ...agentTarget };
        navigateTo({ ...WORKSTATION_POINT });
        waitingToPauseAtWorkstationRef.current = false;
      } else if (isInteractionMood(prevMoodRef.current)) {
        nextWanderAtRef.current = Number.POSITIVE_INFINITY;
        waitingToPauseAtWorkstationRef.current = true;
      }
      prevMoodRef.current = mood;
    }

    if (!isInteraction && !samePoint(agentTarget, lastExternalTargetRef.current)) {
      lastExternalTargetRef.current = { ...agentTarget };
      navigateTo({ ...agentTarget });
      nextWanderAtRef.current = t + 0.8;
    }

    const roundedPos = {
      x: clampTile(posRef.current.x),
      z: clampTile(posRef.current.z),
    };

    const distToFinalTarget = Math.hypot(targetRef.current.x - posRef.current.x, targetRef.current.z - posRef.current.z);
    const reachedFinalTarget = distToFinalTarget < 0.04 && pathRef.current.length === 0;
    
    const distToWorkstation = Math.hypot(WORKSTATION_POINT.x - posRef.current.x, WORKSTATION_POINT.z - posRef.current.z);
    const atWorkstation = distToWorkstation < 0.06;

    if (!isInteraction && waitingToPauseAtWorkstationRef.current && atWorkstation) {
      waitingToPauseAtWorkstationRef.current = false;
      nextWanderAtRef.current = t + 10;
    }

    if (!isInteraction && reachedFinalTarget && t >= nextWanderAtRef.current) {
      const nextRdm = pickRandomTarget(roundedPos, furnitureList || []);
      navigateTo(nextRdm);
      nextWanderAtRef.current = t + 1.3 + Math.random() * 1.6;
    }
    
    // Avança no Caminho Nodal
    let moveDx = 0;
    let moveDz = 0;
    let moveDist = 0;

    if (pathRef.current.length > 0) {
      const currentWaypoint = pathRef.current[0];
      moveDx = currentWaypoint.x - posRef.current.x;
      moveDz = currentWaypoint.z - posRef.current.z;
      moveDist = Math.hypot(moveDx, moveDz);

      if (moveDist < 0.08) {
        pathRef.current.shift();
        if (pathRef.current.length > 0) {
           const nextWaypoint = pathRef.current[0];
           moveDx = nextWaypoint.x - posRef.current.x;
           moveDz = nextWaypoint.z - posRef.current.z;
           moveDist = Math.hypot(moveDx, moveDz);
        } else {
           moveDx = 0; moveDz = 0; moveDist = 0;
        }
      }
    } else {
      const distToIdle = Math.hypot(targetRef.current.x - posRef.current.x, targetRef.current.z - posRef.current.z);
      if (distToIdle < 0.2) {
         moveDx = targetRef.current.x - posRef.current.x;
         moveDz = targetRef.current.z - posRef.current.z;
         moveDist = distToIdle;
      }
    }

    let walking = false;
    if (moveDist > 0.01) {
      const slowFactor = Math.max(0.4, Math.min(1, moveDist / 0.85));
      const step = Math.min(moveDist, WALK_SPEED * slowFactor * dt);
      posRef.current.x += (moveDx / moveDist) * step;
      posRef.current.z += (moveDz / moveDist) * step;
      walking = step > 0.0005;
      if (walking) {
        facingRef.current = faceAngle(moveDx, moveDz);
      }
    }

    const targetRotation =
      mood === "thinking"
        ? faceAngle(PC_SCREEN_TARGET.x - posRef.current.x, PC_SCREEN_TARGET.z - posRef.current.z)
        : walking
          ? facingRef.current
          : facingRef.current + Math.sin(t * 0.7) * 0.04;
    facingRef.current = dampAngle(facingRef.current, targetRotation, dt);

    if (group.current) {
      const walkBob = walking ? Math.sin(t * 13.5) * 0.025 : 0;
      const idleBob = walking ? 0 : Math.sin(t * params.idleSpeed) * params.bob;
      group.current.position.set(posRef.current.x, 0.72 + walkBob + idleBob, posRef.current.z);
      group.current.rotation.y = facingRef.current;
    }

    if (armL.current) {
      const amp = walking ? 0.42 : params.arm;
      armL.current.rotation.x = Math.sin(t * (walking ? 13 : params.idleSpeed * 1.15)) * amp;
    }
    if (armR.current) {
      const amp = walking ? 0.38 : params.arm;
      armR.current.rotation.x = -Math.sin(t * (walking ? 12 : params.idleSpeed * 1.05)) * amp * 0.95;
    }

    if (legL.current) {
      const legAmp = walking ? 0.45 : 0;
      legL.current.rotation.x = -Math.sin(t * (walking ? 13 : 0)) * legAmp;
    }
    if (legR.current) {
      const legAmp = walking ? 0.45 : 0;
      legR.current.rotation.x = Math.sin(t * (walking ? 13 : 0)) * legAmp;
    }

    if (t - lastDebugSyncAtRef.current > 0.12) {
      lastDebugSyncAtRef.current = t;
      setAgentDebug({
        position: {
          x: Number(posRef.current.x.toFixed(2)),
          z: Number(posRef.current.z.toFixed(2)),
        },
        internalTarget: { ...targetRef.current },
        storeTarget: { ...agentTarget },
        walking,
        mood,
        updatedAt: Date.now(),
      });
    }
  });

  /*
   * =================================================
   *   CHIBI 3D CUSTOMIZÁVEL
   *   Cores dinâmicas baseadas em agentShirt/Shoe/Hair/Eye
   * =================================================
   */

  // === Cores da Camisa ===
  const shirtColors: Record<string, { main: string; dark: string }> = {
    casual:    { main: "#3ecfb0", dark: "#2aad94" },
    formal:    { main: "#2c3e6b", dark: "#1a2744" },
    esportivo: { main: "#e63946", dark: "#b52d38" },
  };
  const sc = shirtColors[agentShirt] || shirtColors.casual;

  // === Cores dos Sapatos ===
  const shoeColors: Record<string, string> = {
    tenis: "#3d3d4a",
    social: "#5c3a1e",
    bota: "#1a1a1a",
  };
  const shoeCol = shoeColors[agentShoe] || shoeColors.tenis;

  // === Cores e config do Cabelo ===
  const hairStyles: Record<string, { main: string; dark: string; style: string }> = {
    curto:   { main: "#f4d35e", dark: "#c9a032", style: "curto" },
    longo:   { main: "#8B5E3C", dark: "#5C3A1E", style: "longo" },
    moicano: { main: "#9b59b6", dark: "#6c3483", style: "moicano" },
  };
  const hs = hairStyles[agentHair] || hairStyles.curto;

  // === Cores dos Olhos ===
  const eyeStyles: Record<string, { irisColor: string; size: number; style: string }> = {
    normal: { irisColor: "#4a90d9", size: 0.055, style: "normal" },
    anime:  { irisColor: "#2ecc71", size: 0.065, style: "anime" },
    cool:   { irisColor: "#1a1a1a", size: 0.055, style: "cool" },
  };
  const es = eyeStyles[agentEye] || eyeStyles.normal;

  const skin = "#ffcba4";
  const skinLight = "#ffe4cc";
  const outline = "#1e1e2e";
  const cheekPink = "#ff8888";
  const mouthCol = "#c9616b";

  return (
    <group ref={group} position={[initialTarget.x, 0.72, initialTarget.z]} scale={1.08}>

      {/* ============ PERNAS ============ */}
      <group ref={legL} position={[-0.09, 0.1, 0]}>
        <mesh position={[0, -0.04, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.1, 6, 12]} />
          <meshStandardMaterial color={sc.main} roughness={0.65} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
        <mesh position={[0, -0.18, 0.02]} scale={[1, 0.55, agentShoe === "bota" ? 1.1 : 1.3]} castShadow>
          <sphereGeometry args={[agentShoe === "bota" ? 0.08 : 0.07, 16, 16]} />
          <meshStandardMaterial color={shoeCol} roughness={0.7} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
      </group>
      <group ref={legR} position={[0.09, 0.1, 0]}>
        <mesh position={[0, -0.04, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.1, 6, 12]} />
          <meshStandardMaterial color={sc.main} roughness={0.65} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
        <mesh position={[0, -0.18, 0.02]} scale={[1, 0.55, agentShoe === "bota" ? 1.1 : 1.3]} castShadow>
          <sphereGeometry args={[agentShoe === "bota" ? 0.08 : 0.07, 16, 16]} />
          <meshStandardMaterial color={shoeCol} roughness={0.7} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
      </group>

      {/* ============ CORPINHO ============ */}
      <mesh position={[0, 0.28, 0]} scale={[1, 1.1, 0.85]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color={sc.main} roughness={0.5} metalness={0.05} />
        <Outlines thickness={0.02} color={outline} />
      </mesh>
      <mesh position={[0, 0.18, 0.01]} scale={[0.95, 0.7, 0.8]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color={sc.dark} roughness={0.5} />
      </mesh>
      {/* Gola para formal */}
      {agentShirt === "formal" && (
        <mesh position={[0, 0.42, 0.08]} scale={[0.8, 0.3, 0.5]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.4} />
        </mesh>
      )}
      {/* Faixa para esportivo */}
      {agentShirt === "esportivo" && (
        <mesh position={[0, 0.3, 0.155]} scale={[1, 0.15, 0.1]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      )}

      {/* ============ BRACINHOS ============ */}
      <group ref={armL} position={[-0.22, 0.32, 0]}>
        <mesh castShadow position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.05, 0.1, 6, 12]} />
          <meshStandardMaterial color={sc.main} roughness={0.5} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
        <mesh position={[0, -0.18, 0]} castShadow>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
          <Outlines thickness={0.015} color={outline} />
        </mesh>
      </group>
      <group ref={armR} position={[0.22, 0.32, 0]}>
        <mesh castShadow position={[0, -0.08, 0]}>
          <capsuleGeometry args={[0.05, 0.1, 6, 12]} />
          <meshStandardMaterial color={sc.main} roughness={0.5} />
          <Outlines thickness={0.02} color={outline} />
        </mesh>
        <mesh position={[0, -0.18, 0]} castShadow>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
          <Outlines thickness={0.015} color={outline} />
        </mesh>
      </group>

      {/* ============ PESCOÇO ============ */}
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.06, 12]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>

      {/* ============ CABEÇÃO CHIBI ============ */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
        <Outlines thickness={0.022} color={outline} />
      </mesh>

      {/* ============ CABELO ============ */}
      {hs.style === "curto" && (
        <>
          <mesh position={[0, 0.88, -0.02]} scale={[1.12, 0.6, 1.08]} castShadow>
            <sphereGeometry args={[0.32, 32, 32]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
            <Outlines thickness={0.02} color={hs.dark} />
          </mesh>
          <mesh position={[0, 0.82, 0.22]} scale={[1.05, 0.35, 0.4]}>
            <sphereGeometry args={[0.28, 24, 24]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.72, -0.18]} scale={[1, 0.7, 0.55]} castShadow>
            <sphereGeometry args={[0.3, 24, 24]} />
            <meshStandardMaterial color={hs.dark} roughness={0.8} />
            <Outlines thickness={0.018} color={outline} />
          </mesh>
        </>
      )}
      {hs.style === "longo" && (
        <>
          <mesh position={[0, 0.88, -0.02]} scale={[1.12, 0.6, 1.08]} castShadow>
            <sphereGeometry args={[0.32, 32, 32]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
            <Outlines thickness={0.02} color={hs.dark} />
          </mesh>
          <mesh position={[0, 0.82, 0.22]} scale={[1.05, 0.35, 0.4]}>
            <sphereGeometry args={[0.28, 24, 24]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
          </mesh>
          {/* Mechas longas laterais */}
          <mesh position={[-0.26, 0.62, -0.02]} scale={[0.45, 0.9, 0.55]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
          </mesh>
          <mesh position={[0.26, 0.62, -0.02]} scale={[0.45, 0.9, 0.55]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={hs.main} roughness={0.75} />
          </mesh>
          {/* Parte de trás longa */}
          <mesh position={[0, 0.6, -0.18]} scale={[1, 0.9, 0.6]} castShadow>
            <sphereGeometry args={[0.3, 24, 24]} />
            <meshStandardMaterial color={hs.dark} roughness={0.8} />
            <Outlines thickness={0.018} color={outline} />
          </mesh>
        </>
      )}
      {hs.style === "moicano" && (
        <>
          {/* Base raspada */}
          <mesh position={[0, 0.85, -0.02]} scale={[1.08, 0.5, 1.05]} castShadow>
            <sphereGeometry args={[0.32, 32, 32]} />
            <meshStandardMaterial color={hs.dark} roughness={0.85} />
            <Outlines thickness={0.02} color={outline} />
          </mesh>
          {/* Crista do moicano — cápsulas empilhadas no topo */}
          <mesh position={[0, 1.05, 0]} rotation={[0.3, 0, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.18, 8, 16]} />
            <meshStandardMaterial color={hs.main} roughness={0.6} />
            <Outlines thickness={0.02} color={hs.dark} />
          </mesh>
          <mesh position={[0, 0.95, 0.05]} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.05, 0.12, 6, 12]} />
            <meshStandardMaterial color={hs.main} roughness={0.6} />
          </mesh>
        </>
      )}

      {/* ============ ROSTO ============ */}
      {skinMode === "hacker" ? (
        <group position={[0, 0.72, 0]}>
          {/* ===== MÁSCARA GUY FAWKES ===== */}
          {/* Base da máscara — disco branco cobrindo a face */}
          <mesh position={[0, 0, 0.315]} scale={[0.85, 0.95, 0.15]}>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardMaterial color="#f5f0e8" roughness={0.4} />
            <Outlines thickness={0.015} color={outline} />
          </mesh>
          {/* Sobrancelhas arqueadas estilo Guy Fawkes */}
          <mesh position={[-0.1, 0.08, 0.33]} rotation={[0, 0, 0.4]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.012, 0.07, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          <mesh position={[0.1, 0.08, 0.33]} rotation={[0, 0, -0.4]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.012, 0.07, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          {/* Olhos — triângulos escuros (losangos achatados) */}
          <mesh position={[-0.09, 0.02, 0.34]} scale={[1, 1.3, 0.2]} rotation={[0, 0, Math.PI / 4]}>
            <sphereGeometry args={[0.03, 4, 4]} />
            <meshStandardMaterial color="#111" roughness={0.3} flatShading />
          </mesh>
          <mesh position={[0.09, 0.02, 0.34]} scale={[1, 1.3, 0.2]} rotation={[0, 0, Math.PI / 4]}>
            <sphereGeometry args={[0.03, 4, 4]} />
            <meshStandardMaterial color="#111" roughness={0.3} flatShading />
          </mesh>
          {/* Bochechas rosadas da máscara */}
          <mesh position={[-0.14, -0.04, 0.33]} scale={[1, 1, 0.2]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#d4736a" roughness={0.8} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.14, -0.04, 0.33]} scale={[1, 1, 0.2]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#d4736a" roughness={0.8} transparent opacity={0.6} />
          </mesh>
          {/* Bigode fino estilo Guy Fawkes */}
          <mesh position={[-0.04, -0.08, 0.34]} rotation={[0, 0, 0.5]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.006, 0.04, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          <mesh position={[0.04, -0.08, 0.34]} rotation={[0, 0, -0.5]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.006, 0.04, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          {/* Cavanhaque pontudo */}
          <mesh position={[0, -0.15, 0.33]} rotation={[0.2, 0, 0]} scale={[0.6, 1.2, 0.3]}>
            <capsuleGeometry args={[0.012, 0.04, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          {/* Sorriso fino */}
          <mesh position={[0, -0.1, 0.345]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.006, 0.08, 4, 8]} />
            <meshStandardMaterial color="#c94040" roughness={0.5} />
          </mesh>
          {/* Cantos do sorriso levantados */}
          <mesh position={[-0.05, -0.09, 0.34]} rotation={[0, 0, 0.6]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.005, 0.02, 4, 8]} />
            <meshStandardMaterial color="#c94040" roughness={0.5} />
          </mesh>
          <mesh position={[0.05, -0.09, 0.34]} rotation={[0, 0, -0.6]} scale={[1, 1, 0.3]}>
            <capsuleGeometry args={[0.005, 0.02, 4, 8]} />
            <meshStandardMaterial color="#c94040" roughness={0.5} />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0.72, 0]}>
          {/* ===== OLHOS ===== */}
          {es.style === "cool" ? (
            <>
              {/* Óculos escuros — dois discos escuros */}
              <mesh position={[-0.1, 0.02, 0.315]} scale={[1.2, 0.7, 0.15]}>
                <sphereGeometry args={[0.06, 20, 20]} />
                <meshStandardMaterial color="#111" roughness={0.1} metalness={0.4} />
                <Outlines thickness={0.012} color={outline} />
              </mesh>
              <mesh position={[0.1, 0.02, 0.315]} scale={[1.2, 0.7, 0.15]}>
                <sphereGeometry args={[0.06, 20, 20]} />
                <meshStandardMaterial color="#111" roughness={0.1} metalness={0.4} />
                <Outlines thickness={0.012} color={outline} />
              </mesh>
              {/* Ponte dos óculos */}
              <mesh position={[0, 0.02, 0.33]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
                <capsuleGeometry args={[0.006, 0.04, 4, 8]} />
                <meshStandardMaterial color="#333" roughness={0.3} metalness={0.5} />
              </mesh>
              {/* Brilho nos óculos */}
              <mesh position={[-0.09, 0.04, 0.335]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
              </mesh>
              <mesh position={[0.09, 0.04, 0.335]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
              </mesh>
            </>
          ) : (
            <>
              {/* Olho Esquerdo */}
              <mesh position={[-0.1, 0.02, 0.315]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size, 24, 24]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
                <Outlines thickness={0.01} color={outline} />
              </mesh>
              <mesh position={[-0.095, 0.0, 0.325]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size * 0.72, 20, 20]} />
                <meshStandardMaterial color={es.irisColor} roughness={0.3} metalness={0.1} />
              </mesh>
              <mesh position={[-0.09, -0.002, 0.33]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size * 0.44, 16, 16]} />
                <meshStandardMaterial color="#111128" roughness={0.1} />
              </mesh>
              <mesh position={[-0.078, 0.016, 0.335]}>
                <sphereGeometry args={[0.009, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.105, -0.01, 0.335]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Olho Direito */}
              <mesh position={[0.1, 0.02, 0.315]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size, 24, 24]} />
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
                <Outlines thickness={0.01} color={outline} />
              </mesh>
              <mesh position={[0.095, 0.0, 0.325]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size * 0.72, 20, 20]} />
                <meshStandardMaterial color={es.irisColor} roughness={0.3} metalness={0.1} />
              </mesh>
              <mesh position={[0.09, -0.002, 0.33]} scale={[1, 1, 0.2]}>
                <sphereGeometry args={[es.size * 0.44, 16, 16]} />
                <meshStandardMaterial color="#111128" roughness={0.1} />
              </mesh>
              <mesh position={[0.102, 0.016, 0.335]}>
                <sphereGeometry args={[0.009, 10, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.078, -0.01, 0.335]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </>
          )}

          {/* Sobrancelhas */}
          <mesh position={[-0.1, 0.08, 0.3]} rotation={[0.1, 0, 0.15]}>
            <capsuleGeometry args={[0.01, 0.05, 4, 8]} />
            <meshStandardMaterial color={hs.dark} roughness={0.6} />
          </mesh>
          <mesh position={[0.1, 0.08, 0.3]} rotation={[0.1, 0, -0.15]}>
            <capsuleGeometry args={[0.01, 0.05, 4, 8]} />
            <meshStandardMaterial color={hs.dark} roughness={0.6} />
          </mesh>

          {/* Bochechas rosadas */}
          <mesh position={[-0.19, -0.06, 0.22]}>
            <sphereGeometry args={[0.045, 14, 14]} />
            <meshStandardMaterial color={cheekPink} roughness={0.9} transparent opacity={0.4} />
          </mesh>
          <mesh position={[0.19, -0.06, 0.22]}>
            <sphereGeometry args={[0.045, 14, 14]} />
            <meshStandardMaterial color={cheekPink} roughness={0.9} transparent opacity={0.4} />
          </mesh>

          {/* Boquinha */}
          <mesh position={[0, -0.1, 0.3]} rotation={[0.2, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.012, 0.04, 6, 10]} />
            <meshStandardMaterial color={mouthCol} roughness={0.5} />
          </mesh>

          {/* Nariz */}
          <mesh position={[0, -0.03, 0.32]}>
            <sphereGeometry args={[0.012, 10, 10]} />
            <meshStandardMaterial color={skinLight} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}
