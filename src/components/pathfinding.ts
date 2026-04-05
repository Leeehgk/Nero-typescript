import type { FurnitureItem, FurnitureType, AgentGrid } from "../store";

export const GRID_MIN = -7;
export const GRID_MAX = 7;

// Define se o móvel bloqueia o caminho (tem colisão)
export function isSolid(type: FurnitureType): boolean {
  switch (type) {
    case "rug":
    case "painting":
    case "board":
    case "wall_clock":
      return false; // Pode pisar ou passar por baixo
    default:
      return true;
  }
}

// Recupera os tiles matemáticos que um móvel ocupa cruzando Axis-Aligned Bounding Box
export function getOccupiedTiles(item: FurnitureItem): AgentGrid[] {
  if (!isSolid(item.type)) return [];

  const [px, , pz] = item.position;
  const rotY = item.rotation?.[1] || 0;
  const isRotated = Math.abs(Math.cos(rotY)) < 0.5;

  let widthDef = 1.0;
  let depthDef = 1.0;

  switch (item.type) {
    case "sofa":
      widthDef = 2.8; depthDef = 1.2; break;
    case "desk":
      widthDef = 2.8; depthDef = 1.4; break;
    case "tv":
      widthDef = 2.4; depthDef = 0.6; break;
    case "seating":
      widthDef = 2.2; depthDef = 0.85; break;
    case "bookshelf":
      widthDef = 1.6; depthDef = 0.6; break;
    case "coffeetable":
      widthDef = 1.6; depthDef = 1.0; break;
    case "bed":
      widthDef = 2.0; depthDef = 2.2; break;
    case "wardrobe":
      widthDef = 2.2; depthDef = 1.0; break;
    case "diningtable":
      widthDef = 2.5; depthDef = 1.4; break;
    case "arcade":
      widthDef = 0.9; depthDef = 0.7; break;
    case "nightstand":
      widthDef = 0.7; depthDef = 0.7; break;
    case "bonsai":
      widthDef = 0.6; depthDef = 0.4; break;
    case "speaker":
      widthDef = 0.5; depthDef = 0.5; break;
    case "mirror":
      widthDef = 1.0; depthDef = 0.1; break;
    case "statue":
      widthDef = 0.6; depthDef = 0.6; break;
    case "fridge":
      widthDef = 1.0; depthDef = 0.9; break;
    case "fireplace":
      widthDef = 1.8; depthDef = 0.8; break;
    case "piano":
      widthDef = 1.6; depthDef = 0.7; break;
    case "vending":
      widthDef = 1.0; depthDef = 0.8; break;
    case "barrel":
      widthDef = 0.7; depthDef = 0.7; break;
    default:
      // Plant, Lamp, Globe...
      widthDef = 0.6; depthDef = 0.6; break;
  }
  
  if (isRotated) {
    const temp = widthDef;
    widthDef = depthDef;
    depthDef = temp;
  }

  // Usa as bordas nuas da largura para gerar o Tile Grid Box
  const minX = px - widthDef / 2;
  const maxX = px + widthDef / 2;
  const minZ = pz - depthDef / 2;
  const maxZ = pz + depthDef / 2;

  // Um azulejo de coordenada "0" vai fisicamente de -0.5 até 0.5
  // Portanto, para saber quais tiles ele toca perfeitamente:
  const startX = Math.round(minX);
  const endX = Math.round(maxX);
  const startZ = Math.round(minZ);
  const endZ = Math.round(maxZ);

  const result: AgentGrid[] = [];
  for (let x = startX; x <= endX; x++) {
    for (let z = startZ; z <= endZ; z++) {
      if (x >= GRID_MIN && x <= GRID_MAX && z >= GRID_MIN && z <= GRID_MAX) {
        result.push({ x, z });
      }
    }
  }

  return result;
}

// Mapa de colisões Set("x,z")
export function createCollisionGrid(furnitureList: FurnitureItem[]): Set<string> {
  const grid = new Set<string>();
  for (const item of furnitureList) {
    const tiles = getOccupiedTiles(item);
    for (const t of tiles) {
      grid.add(`${t.x},${t.z}`);
    }
  }
  return grid;
}

// Função Heurística para A* (Diagonal/Chebyshev mais próximo de grid real)
function heuristic(a: AgentGrid, b: AgentGrid): number {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
}

// Retorna todos os vizinhos andáveis válidos
function getNeighbors(node: AgentGrid, obstacles: Set<string>): AgentGrid[] {
  const dirs = [
    { x: 0, z: -1 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 1, z: 0 },
    // Diagonais custam mais no A*, mas o agente pode andar se o caminho estiver livre
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: 1, z: 1 },
  ];
  
  const result: AgentGrid[] = [];
  for (const d of dirs) {
    const nx = node.x + d.x;
    const nz = node.z + d.z;
    if (nx >= GRID_MIN && nx <= GRID_MAX && nz >= GRID_MIN && nz <= GRID_MAX) {
      if (!obstacles.has(`${nx},${nz}`)) {
        result.push({ x: nx, z: nz });
      }
    }
  }
  return result;
}

/**
 * A* Pathfinding - Retorna o array de caminho (waypoints).
 * Se não encontrar (travado), retorna Array vazio ou linha reta pro mais próximo.
 */
export function calculatePath(start: AgentGrid, target: AgentGrid, furnitureList: FurnitureItem[]): AgentGrid[] {
  const obstacles = createCollisionGrid(furnitureList);
  obstacles.delete(`${target.x},${target.z}`);
  obstacles.delete(`3,-2`); // WORKSTATION_POINT
  
  if (start.x === target.x && start.z === target.z) {
    return [target];
  }

  type Node = { x: number, z: number, f: number, g: number, parent: Node | null };
  
  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  
  openSet.push({ 
    x: start.x, 
    z: start.z, 
    g: 0, 
    f: heuristic(start, target), 
    parent: null 
  });

  let loops = 0;
  
  while (openSet.length > 0 && loops++ < 950) {
    // Sort pra pegar o menor f
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currStr = `${current.x},${current.z}`;

    if (closedSet.has(currStr)) continue;
    closedSet.add(currStr);

    if (current.x === target.x && current.z === target.z) {
      const path: AgentGrid[] = [];
      let currObj: Node | null = current;
      while (currObj !== null) {
        path.unshift({ x: currObj.x, z: currObj.z });
        currObj = currObj.parent;
      }
      return path;
    }

    const neighbors = getNeighbors({ x: current.x, z: current.z }, obstacles);
    for (const neighbor of neighbors) {
      const nStr = `${neighbor.x},${neighbor.z}`;
      if (closedSet.has(nStr)) continue;

      const isDiagonal = Math.abs(neighbor.x - current.x) === 1 && Math.abs(neighbor.z - current.z) === 1;
      if (isDiagonal) {
        if (obstacles.has(`${current.x},${neighbor.z}`) || obstacles.has(`${neighbor.x},${current.z}`)) {
          continue;
        }
      }

      const dist = isDiagonal ? 1.414 : 1.0;
      const tentativeG = current.g + dist;
      
      const existingInOpen = openSet.find(n => n.x === neighbor.x && n.z === neighbor.z);
      if (!existingInOpen) {
        openSet.push({
          x: neighbor.x,
          z: neighbor.z,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor, target),
          parent: current
        });
      } else if (tentativeG < existingInOpen.g) {
        existingInOpen.g = tentativeG;
        existingInOpen.f = tentativeG + heuristic(neighbor, target);
        existingInOpen.parent = current;
      }
    }
  }

  // Falha na Rota
  return [];
}
