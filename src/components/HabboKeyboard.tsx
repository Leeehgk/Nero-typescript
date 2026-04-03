import { useEffect } from "react";
import { useNeroStore } from "../store";

/** Teclas WASD / setas — move o Nero um azulejo (estilo Habbo). */
export function HabboKeyboard() {
  const nudgeAgent = useNeroStore((s) => s.nudgeAgent);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      let dx = 0;
      let dz = 0;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          dz = -1;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          dz = 1;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          dx = -1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          dx = 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      nudgeAgent(dx, dz);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudgeAgent]);

  return null;
}
