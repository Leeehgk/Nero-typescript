import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import type { Group } from "three";
import { useNeroStore, type AgentMood } from "../store";

function moodParams(mood: AgentMood) {
  switch (mood) {
    case "thinking":
      return { bob: 0.06, arm: 0.55, rot: 0.06, speed: 4 };
    case "speaking":
      return { bob: 0.1, arm: 0.28, rot: 0.03, speed: 7 };
    case "success":
      return { bob: 0.12, arm: 0.18, rot: 0.1, speed: 5 };
    case "error":
      return { bob: 0.05, arm: 0.35, rot: -0.05, speed: 3 };
    case "listening":
      return { bob: 0.035, arm: 0.12, rot: 0.04, speed: 2 };
    default:
      return { bob: 0.04, arm: 0.08, rot: 0.015, speed: 1.5 };
  }
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** Avatar isométrico Habbo — locomove-se entre azulejos; balão de fala opcional. */
export function PixelAgent() {
  const group = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const curX = useRef(useNeroStore.getState().agentTarget.x);
  const curZ = useRef(useNeroStore.getState().agentTarget.z);
  const lastFacing = useRef(Math.PI * 0.25);

  const mood = useNeroStore((s) => s.mood);
  const agentTarget = useNeroStore((s) => s.agentTarget);
  const lastReply = useNeroStore((s) => s.lastReply);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const dt = state.clock.getDelta();
    const p = moodParams(mood);

    const tx = agentTarget.x;
    const tz = agentTarget.z;
    const k = 1 - Math.exp(-12 * dt);
    curX.current = MathUtils.lerp(curX.current, tx, k);
    curZ.current = MathUtils.lerp(curZ.current, tz, k);

    const dx = tx - curX.current;
    const dz = tz - curZ.current;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.025;

    if (walking) {
      lastFacing.current = Math.atan2(dx, dz);
    }

    if (group.current) {
      group.current.position.x = curX.current;
      group.current.position.z = curZ.current;

      const walkBob = walking ? Math.sin(t * 14) * 0.07 : 0;
      const idleBob = walking ? 0 : Math.sin(t * p.speed) * p.bob;
      group.current.position.y = 0.72 + walkBob + idleBob;

      group.current.rotation.y = walking ? lastFacing.current : lastFacing.current + Math.sin(t * 0.8) * p.rot * 0.5;
    }

    if (armL.current) {
      const amp = walking ? 0.45 : p.arm;
      armL.current.rotation.x = Math.sin(t * (walking ? 16 : p.speed * 1.15)) * amp;
    }
    if (armR.current) {
      const amp = walking ? 0.4 : p.arm;
      armR.current.rotation.x = -Math.sin(t * (walking ? 15 : p.speed * 1.05)) * amp * 0.85;
    }
  });

  const skin = "#ffd4b3";
  const shirt = "#3ecfb0";
  const shirtDark = "#2db89a";
  const pants = "#5b7cff";
  const hair = "#f4d35e";
  const shoe = "#4a4a55";

  const bubbleText = truncate(lastReply.trim(), 100);

  return (
    <group ref={group} position={[1, 0.72, 1]} scale={1.08}>
      <Html position={[0, 1.45, 0]} center distanceFactor={10} style={{ pointerEvents: "none", width: 220 }}>
        {bubbleText ? (
          <div
            style={{
              background: "rgba(255,255,255,0.96)",
              border: "3px solid #2d6b56",
              borderRadius: 12,
              padding: "8px 10px",
              fontFamily: '"VT323", monospace',
              fontSize: 16,
              lineHeight: 1.25,
              color: "#1a3d32",
              boxShadow: "3px 4px 0 rgba(0,0,0,0.15)",
              textAlign: "center",
            }}
          >
            {bubbleText}
          </div>
        ) : null}
      </Html>

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
    </group>
  );
}
