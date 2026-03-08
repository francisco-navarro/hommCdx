function key(col, row) {
  return `${col},${row}`;
}

function octile(a, b) {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  const dMin = Math.min(dx, dy);
  const dMax = Math.max(dx, dy);
  return dMin * Math.SQRT2 + (dMax - dMin);
}

function neighbors(node, world, isWalkableTile) {
  const out = [];

  const orthogonal = [
    { dc: -1, dr: 0, cost: 1 },
    { dc: 1, dr: 0, cost: 1 },
    { dc: 0, dr: -1, cost: 1 },
    { dc: 0, dr: 1, cost: 1 },
  ];
  for (const step of orthogonal) {
    const col = node.col + step.dc;
    const row = node.row + step.dr;
    if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) continue;
    out.push({ col, row, cost: step.cost });
  }

  // Diagonals are allowed, but avoid corner cutting through blocked orthogonal tiles.
  const diagonals = [
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: 1, dr: 1 },
    { dc: -1, dr: 1 },
  ];
  for (const step of diagonals) {
    const col = node.col + step.dc;
    const row = node.row + step.dr;
    if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) continue;

    const adjACol = node.col + step.dc;
    const adjARow = node.row;
    const adjBCol = node.col;
    const adjBRow = node.row + step.dr;
    if (!isWalkableTile(adjACol, adjARow) || !isWalkableTile(adjBCol, adjBRow)) continue;

    out.push({ col, row, cost: Math.SQRT2 });
  }

  return out;
}

function reconstructPath(cameFrom, end) {
  const path = [end];
  let current = end;
  while (cameFrom.has(key(current.col, current.row))) {
    current = cameFrom.get(key(current.col, current.row));
    path.push(current);
  }
  path.reverse();
  return path.map((node) => ({ col: node.col, row: node.row }));
}

function findNearestWalkableTile(target, isWalkableTile, world) {
  if (isWalkableTile(target.col, target.row)) return target;

  const maxRadius = Math.max(world.cols, world.rows);
  for (let r = 1; r <= maxRadius; r += 1) {
    const minCol = Math.max(0, target.col - r);
    const maxCol = Math.min(world.cols - 1, target.col + r);
    const minRow = Math.max(0, target.row - r);
    const maxRow = Math.min(world.rows - 1, target.row + r);

    for (let col = minCol; col <= maxCol; col += 1) {
      if (isWalkableTile(col, minRow)) return { col, row: minRow };
      if (isWalkableTile(col, maxRow)) return { col, row: maxRow };
    }
    for (let row = minRow + 1; row < maxRow; row += 1) {
      if (isWalkableTile(minCol, row)) return { col: minCol, row };
      if (isWalkableTile(maxCol, row)) return { col: maxCol, row };
    }
  }
  return target;
}

function findPathAStar(start, goal, world, isWalkableTile) {
  const safeGoal = findNearestWalkableTile(goal, isWalkableTile, world);
  if (!isWalkableTile(start.col, start.row)) return [];
  if (!isWalkableTile(safeGoal.col, safeGoal.row)) return [];

  const open = [start];
  const openSet = new Set([key(start.col, start.row)]);
  const cameFrom = new Map();
  const gScore = new Map([[key(start.col, start.row), 0]]);
  const fScore = new Map([[key(start.col, start.row), octile(start, safeGoal)]]);

  while (open.length > 0) {
    let bestIdx = 0;
    let bestNode = open[0];
    let bestScore = fScore.get(key(bestNode.col, bestNode.row)) ?? Number.POSITIVE_INFINITY;
    for (let i = 1; i < open.length; i += 1) {
      const n = open[i];
      const score = fScore.get(key(n.col, n.row)) ?? Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        bestNode = n;
      }
    }

    const current = bestNode;
    open.splice(bestIdx, 1);
    openSet.delete(key(current.col, current.row));

    if (current.col === safeGoal.col && current.row === safeGoal.row) {
      return reconstructPath(cameFrom, current);
    }

    for (const nb of neighbors(current, world, isWalkableTile)) {
      if (!isWalkableTile(nb.col, nb.row)) continue;
      const currentKey = key(current.col, current.row);
      const nbKey = key(nb.col, nb.row);
      const tentativeG = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + nb.cost;
      if (tentativeG >= (gScore.get(nbKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(nbKey, current);
      gScore.set(nbKey, tentativeG);
      fScore.set(nbKey, tentativeG + octile(nb, safeGoal));
      if (!openSet.has(nbKey)) {
        open.push(nb);
        openSet.add(nbKey);
      }
    }
  }

  return [];
}

module.exports = {
  findPathAStar,
};
