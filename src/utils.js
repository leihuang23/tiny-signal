export function valueChanged(oldValue, newValue) {
  if (
    typeof oldValue !== "object" ||
    oldValue === null ||
    typeof newValue !== "object" ||
    newValue === null
  ) {
    return !Object.is(oldValue, newValue);
  }

  // For arrays, check length and content efficiently
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length !== newValue.length) return true;
    for (let i = 0; i < oldValue.length; i++) {
      if (!Object.is(oldValue[i], newValue[i])) return true;
    }
    return false;
  }

  // For objects, compare keys and values
  const keys1 = Object.keys(oldValue);
  const keys2 = Object.keys(newValue);
  if (keys1.length !== keys2.length) return true;

  for (let i = 0; i < keys1.length; i++) {
    const key = keys1[i];
    if (
      !Object.hasOwn(newValue, key) ||
      !Object.is(oldValue[key], newValue[key])
    ) {
      return true;
    }
  }

  return false;
}

export class ComputationQueue {
  constructor() {
    this.queue = [];
    this.seen = new Set();
  }

  add(computation, priority = 0) {
    if (this.seen.has(computation) || computation.flags & DISPOSED) return;
    this.seen.add(computation);

    // Insert maintaining sort by priority (lower runs first)
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].priority > priority) {
      i--;
    }
    this.queue.splice(i, 0, { computation, priority });
  }

  next() {
    if (this.queue.length === 0) return null;
    return this.queue.shift().computation;
  }

  get isEmpty() {
    return this.queue.length === 0;
  }

  clear() {
    this.queue.length = 0;
    this.seen.clear();
  }
}

// Topological sort for dependency resolution
export function topologicalSort(computations) {
  const visited = new Set();
  const visiting = new Set();
  const result = [];

  function visit(computation) {
    if (visited.has(computation)) return;
    if (visiting.has(computation)) return; // Handle cycles gracefully

    visiting.add(computation);

    // For each dependency set
    const depsIter = computation.deps.values();
    let depSet;
    while (!(depSet = depsIter.next()).done) {
      const deps = depSet.value;
      if (!deps.owner) continue; // Skip if not owned

      // Visit owner computation
      if (deps.owner !== computation) {
        visit(deps.owner);
      }
    }

    visiting.delete(computation);
    visited.add(computation);
    result.push(computation);
  }

  for (let i = 0; i < computations.length; i++) {
    visit(computations[i]);
  }

  return result;
}

export function subscribe(computation, subs) {
  subs.add(computation);
  computation.deps.add(subs);
}

export function clearDeps(computation) {
  const deps = computation.deps;
  if (!deps.size) return;

  // Use an iterator to avoid array allocation
  const it = deps.values();
  let dep;
  while (!(dep = it.next()).done) {
    dep.value?.delete?.(computation);
  }
  deps.clear();
}
