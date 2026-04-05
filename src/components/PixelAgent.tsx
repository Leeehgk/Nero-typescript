import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useNeroStore, type AgentMood } from "../store";

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

function pickRandomTarget(from: GridPoint): GridPoint {
  for (let i = 0; i < 12; i++) {
    const dx = Math.floor(Math.random() * 5) - 2;
    const dz = Math.floor(Math.random() * 5) - 2;
    if (dx === 0 && dz === 0) continue;
    const next = {
      x: clampTile(from.x + dx),
      z: clampTile(from.z + dz),
    };
    if (!samePoint(next, from)) return next;
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

  const initialTarget = useNeroStore.getState().agentTarget;
  const posRef = useRef<GridPoint>({ x: initialTarget.x, z: initialTarget.z });
  const targetRef = useRef<GridPoint>(pickRandomTarget(initialTarget));
  const lastExternalTargetRef = useRef<GridPoint>({ x: initialTarget.x, z: initialTarget.z });
  const facingRef = useRef(INITIAL_FACING_Y);
  const nextWanderAtRef = useRef(0);
  const lastDebugSyncAtRef = useRef(0);
  const prevMoodRef = useRef<AgentMood>(useNeroStore.getState().mood);
  const waitingToPauseAtWorkstationRef = useRef(false);

  const setAgentDebug = useNeroStore((s) => s.setAgentDebug);
  const skinMode = useNeroStore((s) => s.skinMode);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const { mood, agentTarget } = useNeroStore.getState();
    const params = moodParams(mood);
    const isThinking = mood === "thinking";
    const isInteraction = isInteractionMood(mood);

    if (prevMoodRef.current !== mood) {
      if (isInteraction) {
        lastExternalTargetRef.current = { ...agentTarget };
        targetRef.current = { ...WORKSTATION_POINT };
        waitingToPauseAtWorkstationRef.current = false;
      } else if (isInteractionMood(prevMoodRef.current)) {
        nextWanderAtRef.current = Number.POSITIVE_INFINITY;
        waitingToPauseAtWorkstationRef.current = true;
      }
      prevMoodRef.current = mood;
    }

    if (!isInteraction && !samePoint(agentTarget, lastExternalTargetRef.current)) {
      lastExternalTargetRef.current = { ...agentTarget };
      targetRef.current = { ...agentTarget };
      nextWanderAtRef.current = t + 0.8;
    }

    const roundedPos = {
      x: clampTile(posRef.current.x),
      z: clampTile(posRef.current.z),
    };

    const dxToTarget = targetRef.current.x - posRef.current.x;
    const dzToTarget = targetRef.current.z - posRef.current.z;
    const distToTarget = Math.hypot(dxToTarget, dzToTarget);
    const reachedTarget = distToTarget < 0.04;
    const distToWorkstation = Math.hypot(WORKSTATION_POINT.x - posRef.current.x, WORKSTATION_POINT.z - posRef.current.z);
    const atWorkstation = distToWorkstation < 0.06;

    if (!isInteraction && waitingToPauseAtWorkstationRef.current && atWorkstation) {
      waitingToPauseAtWorkstationRef.current = false;
      nextWanderAtRef.current = t + 10;
    }

    if (!isInteraction && reachedTarget && t >= nextWanderAtRef.current) {
      targetRef.current = pickRandomTarget(roundedPos);
      nextWanderAtRef.current = t + 1.3 + Math.random() * 1.6;
    }

    const moveDx = targetRef.current.x - posRef.current.x;
    const moveDz = targetRef.current.z - posRef.current.z;
    const moveDist = Math.hypot(moveDx, moveDz);

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
      const walkBob = walking ? Math.sin(t * 13.5) * 0.075 : 0;
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

  const skin = "#ffd4b3";
  const shirt = "#3ecfb0";
  const shirtDark = "#2db89a";
  const pants = "#5b7cff";
  const hair = "#f4d35e";
  const shoe = "#4a4a55";

  return (
    <group ref={group} position={[initialTarget.x, 0.72, initialTarget.z]} scale={1.08}>
      <mesh position={[-0.11, -0.02, 0.06]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.26]} />
        <meshStandardMaterial color={shoe} roughness={0.7} />
      </mesh>
      <mesh position={[0.11, -0.02, 0.06]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.26]} />
        <meshStandardMaterial color={shoe} roughness={0.7} />
      </mesh>
      <mesh position={[-0.1, 0.16, 0]} castShadow>
        <boxGeometry args={[0.2, 0.32, 0.2]} />
        <meshStandardMaterial color={pants} roughness={0.75} />
      </mesh>
      <mesh position={[0.1, 0.16, 0]} castShadow>
        <boxGeometry args={[0.2, 0.32, 0.2]} />
        <meshStandardMaterial color={pants} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[0.52, 0.42, 0.28]} />
        <meshStandardMaterial color={shirt} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.52, 0.15]}>
        <planeGeometry args={[0.18, 0.12]} />
        <meshStandardMaterial color={shirtDark} roughness={0.5} />
      </mesh>
      <group ref={armL} position={[-0.34, 0.52, 0]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.14, 0.32, 0.14]} />
          <meshStandardMaterial color={shirt} roughness={0.55} />
        </mesh>
      </group>
      <group ref={armR} position={[0.34, 0.52, 0]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.14, 0.32, 0.14]} />
          <meshStandardMaterial color={shirt} roughness={0.55} />
        </mesh>
      </group>
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[0.48, 0.44, 0.42]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.18, -0.02]} castShadow>
        <boxGeometry args={[0.52, 0.22, 0.46]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.32, 0.08]} castShadow>
        <boxGeometry args={[0.36, 0.1, 0.36]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
      {skinMode === "hacker" ? (
        <group position={[0, 0.92, 0.22]}>
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.5, 0.46, 0.02]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
          </mesh>
          <mesh position={[-0.12, 0.05, 0.012]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[0.14, 0.03, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0.12, 0.05, 0.012]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.14, 0.03, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, -0.1, 0.012]}>
            <boxGeometry args={[0.2, 0.02, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-0.1, -0.12, 0.012]} rotation={[0, 0, -0.7]}>
            <boxGeometry args={[0.08, 0.02, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0.1, -0.12, 0.012]} rotation={[0, 0, 0.7]}>
            <boxGeometry args={[0.08, 0.02, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ) : (
        <>
          <mesh position={[-0.11, 0.95, 0.22]}>
            <boxGeometry args={[0.1, 0.1, 0.04]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          <mesh position={[0.11, 0.95, 0.22]}>
            <boxGeometry args={[0.1, 0.1, 0.04]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          <mesh position={[-0.11, 0.95, 0.24]}>
            <boxGeometry args={[0.05, 0.06, 0.02]} />
            <meshStandardMaterial color="#1a1a22" />
          </mesh>
          <mesh position={[0.11, 0.95, 0.24]}>
            <boxGeometry args={[0.05, 0.06, 0.02]} />
            <meshStandardMaterial color="#1a1a22" />
          </mesh>
          <mesh position={[0, 0.82, 0.22]}>
            <boxGeometry args={[0.12, 0.03, 0.02]} />
            <meshStandardMaterial color="#c87a7a" />
          </mesh>
        </>
      )}
    </group>
  );
}
