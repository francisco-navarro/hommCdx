function key(col, row) {
  return `${col},${row}`;
}

function manhattan(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function neighbors(node, world) {
  const out = [];
  if (node.col > 0) out.push({ col: node.col - 1, row: node.row });
  if (node.col < world.cols - 1) out.push({ col: node.col + 1, row: node.row });
  if (node.row > 0) out.push({ col: node.col, row: node.row - 1 });
  if (node.row < world.rows - 1) out.push({ col: node.col, row: node.row + 1 });
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
  return path;
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
  const fScore = new Map([[key(start.col, start.row), manhattan(start, safeGoal)]]);

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

    for (const nb of neighbors(current, world)) {
      if (!isWalkableTile(nb.col, nb.row)) continue;
      const currentKey = key(current.col, current.row);
      const nbKey = key(nb.col, nb.row);
      const tentativeG = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (tentativeG >= (gScore.get(nbKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(nbKey, current);
      gScore.set(nbKey, tentativeG);
      fScore.set(nbKey, tentativeG + manhattan(nb, safeGoal));
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
