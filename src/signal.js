import {
  topologicalSort,
  subscribe,
  clearDeps,
  ComputationQueue,
} from "./utils.js";

let currentComputation = null;
let batched = null;
let effects = null;
let scheduler = null;
const middleware = [];
const typeMiddleware = {};
const MAX_POOL_SIZE = 50;
const ctxPool = [];

const STALE = 1 << 0; // 1
const USER_EFFECT = 1 << 1; // 2
const QUEUED = 1 << 2; // 4
const RUNNING = 1 << 3; // 8
const DISPOSED = 1 << 4; // 16
const ERROR = 1 << 5; // 32

let hasMiddleware = false;

/**
 * @private
 * Retrieves a context object from the pool for middleware execution.
 *
 * @returns {Object} Empty context object
 */
function getCtx() {
  return ctxPool.pop() || {};
}

/**
 * @private
 * Returns a context object to the pool after use, clearing all properties.
 *
 * @param {Object} ctx - The context object to release
 * @returns {void}
 */
function releaseCtx(ctx) {
  if (ctxPool.length >= MAX_POOL_SIZE) return;
  for (const key in ctx) {
    delete ctx[key];
  }
  ctxPool.push(ctx);
}

/**
 * @private
 * Applies middleware transformations to a value based on operation type.
 *
 * @param {string} type - The operation type (e.g., 'get', 'set', 'init')
 * @param {any} value - The value to transform
 * @param {Object|null} ctx - Additional context information for middleware
 * @returns {any} The transformed value after middleware processing
 */
function applyMiddleware(type, value, ctx) {
  // Fast path for no middleware
  if (!hasMiddleware && !typeMiddleware[type]?.length) return value;

  // Check type-specific middleware first
  const typeMiddlewares = typeMiddleware[type];
  if (typeMiddlewares?.length) {
    for (let i = 0; i < typeMiddlewares.length; i++) {
      try {
        value = typeMiddlewares[i](type, value, ctx) ?? value;
      } catch (err) {
        console.error(`[tiny-signal] Type middleware error in "${type}":`, err);
      }
    }
  }

  // Then general middleware
  if (!hasMiddleware) return value;

  const len = middleware.length;
  for (let i = 0; i < len; i++) {
    try {
      value = middleware[i](type, value, ctx) ?? value;
    } catch (err) {
      console.error(
        `[tiny-signal] Middleware error in "${type}" at index ${i}:`,
        err
      );
    }
  }
  return value;
}

/**
 * @private
 * Executes a function within a batch context and processes all resulting updates.
 * Handles topological sorting of computations and scheduling of updates.
 *
 * @template T
 * @param {function(): T} fn - Function to execute within the batch
 * @returns {T} The result of the executed function
 * @throws {Error} Rethrows any errors from the executed function
 */
function runUpdates(fn) {
  if (batched) return fn(); // Already in a batch

  const computationQueue = new ComputationQueue();
  const effectQueue = new ComputationQueue();

  // Initialize batching state
  batched = [];
  effects = [];
  let result;

  try {
    result = fn();

    // Sort computations topologically to minimize recalculations
    if (batched.length > 0) {
      const sortedComputations = topologicalSort(batched);

      // Add to appropriate queue
      for (let i = 0; i < sortedComputations.length; i++) {
        const comp = sortedComputations[i];
        if (comp.flags & DISPOSED) continue;

        // User effects go to main queue, others to effect queue
        if (comp.flags & USER_EFFECT) {
          computationQueue.add(comp, 1); // Lower priority, run after deps
        } else {
          effectQueue.add(comp, 0); // Higher priority
        }
      }

      // Process computation queue
      if (scheduler) {
        while (!computationQueue.isEmpty) {
          const comp = computationQueue.next();
          scheduler(() => runComputation(comp));
        }
      } else {
        while (!computationQueue.isEmpty) {
          runComputation(computationQueue.next());
        }
      }
    }

    // Process effect queue
    while (!effectQueue.isEmpty) {
      runComputation(effectQueue.next());
    }

    // Process remaining user effects
    if (effects.length > 0) {
      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        if (effect.flags & DISPOSED) continue;
        runComputation(effect);
      }
    }

    computationQueue.clear();
    effectQueue.clear();
    effects = null;
    batched = null;
    return result;
  } catch (e) {
    computationQueue.clear();
    effectQueue.clear();
    batched = null;
    effects = null;
    throw e;
  }
}

/**
 * @private
 * Executes a computation to update its value and track dependencies.
 *
 * @param {Object} computation - Computation object to run
 * @param {function(): any} computation.fn - The computation function
 * @param {number} computation.flags - Bit flags for computation state
 * @param {Set<Object>} computation.deps - Set of dependencies
 * @param {any} computation.value - Cached value of the computation
 * @returns {any} Result of the computation
 * @throws {Error} Rethrows any errors from the computation function
 */
function runComputation(computation) {
  if (computation.flags & DISPOSED) return computation.value;
  if (!(computation.flags & STALE)) return computation.value;

  // Mark as running to prevent re-entry
  computation.flags |= RUNNING;
  computation.flags &= ~STALE;

  clearDeps(computation);
  const prev = currentComputation;
  currentComputation = computation;

  try {
    const ctx = hasMiddleware ? getCtx() : null;

    if (hasMiddleware) {
      ctx.computation = computation;
      ctx.isUser = !!(computation.flags & USER_EFFECT);
      applyMiddleware("beforeCompute", null, ctx);
    }

    let result = computation.fn();

    if (hasMiddleware) {
      ctx.result = result;
      const transformed = applyMiddleware("compute", result, ctx);
      if (transformed !== undefined) result = transformed;
      releaseCtx(ctx);
    }

    computation.value = result;
    computation.flags &= ~RUNNING;
    return result;
  } catch (err) {
    computation.flags |= ERROR;
    computation.flags &= ~RUNNING;
    console.error("[tiny-signal] Computation error:", err);
    throw err;
  } finally {
    currentComputation = prev;
    if (hasMiddleware) {
      const ctx = getCtx();
      ctx.computation = computation;
      ctx.isUser = !!(computation.flags & USER_EFFECT);
      applyMiddleware("afterCompute", null, ctx);
      releaseCtx(ctx);
    }
  }
}

/**
 * @private
 * Creates a computation object that can track dependencies and cache results.
 *
 * @param {function(): any} fn - Function defining the computation
 * @param {boolean} isUser - Whether this is a user-defined effect
 * @returns {{
 *   fn: function(): any,
 *   flags: number,
 *   deps: Set<Object>,
 *   value: any,
 *   execute(): any,
 *   dispose(): void
 * }} Computation object with execution and cleanup capabilities
 */
function createComputation(fn, isUser) {
  return {
    fn,
    flags: STALE | (isUser ? USER_EFFECT : 0),
    deps: new Set(),
    value: undefined,
    execute() {
      if (this.flags & DISPOSED) return;
      return runComputation(this);
    },
    dispose() {
      if (this.flags & DISPOSED) return;
      clearDeps(this);
      this.flags |= DISPOSED;
    },
  };
}

/**
 * @public
 * Configures how reactive updates are scheduled.
 *
 * @param {'animation'|'idle'|Function} [s='animation'] - Scheduling strategy:
 *   - 'animation': Uses requestAnimationFrame
 *   - 'idle': Uses requestIdleCallback (falls back to setTimeout)
 *   - Function: Custom scheduler function
 * @returns {void}
 */
export function enableScheduling(s = "animation") {
  scheduler =
    s === "animation"
      ? requestAnimationFrame
      : s === "idle"
      ? typeof window !== "undefined" && window.requestIdleCallback
        ? window.requestIdleCallback
        : (fn) => setTimeout(fn, 1)
      : typeof s === "function"
      ? s
      : null;
}

/**
 * @public
 * Creates a reactive signal with getter/setter semantics.
 *
 * @template T
 * @param {T} initial - Initial value of the signal
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.name] - Optional name for debugging
 * @returns {{
 *   get value(): T,
 *   set value(v: T): void,
 *   peek(): T,
 *   dispose(): void
 * }} A reactive signal object
 */
export function signal(initial, options = {}) {
  // Lazy subscription set creation
  let subs = null;
  const ctx = hasMiddleware ? { type: "signal", ...options } : null;
  let value = hasMiddleware ? applyMiddleware("init", initial, ctx) : initial;

  function ensureSubs() {
    if (!subs) {
      subs = new Set();
      // Add owner reference for topological sorting
      subs.owner = currentComputation;
    }
    return subs;
  }

  // Add a dispose method for manual cleanup
  function dispose() {
    if (subs) subs.clear();
    subs = null;
  }

  return {
    get value() {
      if (currentComputation) {
        subscribe(currentComputation, ensureSubs());
      }
      return hasMiddleware ? applyMiddleware("get", value, ctx) : value;
    },

    peek() {
      return hasMiddleware ? applyMiddleware("peek", value, ctx) : value;
    },

    set value(next) {
      if (hasMiddleware) {
        const nextCtx = getCtx();
        Object.assign(nextCtx, ctx || {});
        nextCtx.prevValue = value;
        next = applyMiddleware("set", next, nextCtx);
        releaseCtx(nextCtx);
      }

      if (Object.is(value, next)) return;

      value = next;
      if (!subs || !subs.size) return;

      runUpdates(() => {
        // Use iterator to avoid temporary array allocation
        const it = subs.values();
        let computation;
        while (!(computation = it.next()).done) {
          computation = computation.value;
          if (computation.flags & DISPOSED) continue;
          computation.flags |= STALE;
          (computation.flags & USER_EFFECT ? effects : batched).push(
            computation
          );
        }
      });
    },

    dispose,
  };
}

/**
 * @public
 * Creates a memoized computation that updates only when dependencies change.
 *
 * @template T
 * @param {function(): T} fn - Function that computes the value
 * @returns {function(): T & {dispose(): void}} Memoized getter with cleanup method
 */
export function memo(fn) {
  const computation = createComputation(fn, true);
  runUpdates(() => computation.execute());

  function getter() {
    return computation.value;
  }

  getter.dispose = () => computation.dispose();
  return getter;
}

/**
 * @public
 * Creates a read-only computed signal derived from other reactive sources.
 * Automatically tracks dependencies and updates when they change.
 *
 * @template T
 * @param {function(): T} fn - Function that computes the derived value
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.name] - Optional name for debugging
 * @returns {{
 *   get value(): T,
 *   peek(): T,
 *   dispose(): void
 * }} A read-only computed signal
 */
export function computed(fn, options = {}) {
  const computation = createComputation(fn, true);
  runUpdates(() => computation.execute());

  const computedCtx = hasMiddleware ? { type: "computed", ...options } : null;

  return {
    get value() {
      if (currentComputation) subscribe(currentComputation, computation.deps);
      if (computation.flags & STALE) runComputation(computation);

      return hasMiddleware
        ? applyMiddleware("get", computation.value, computedCtx)
        : computation.value;
    },

    peek() {
      if (computation.flags & STALE) runComputation(computation);
      return hasMiddleware
        ? applyMiddleware("peek", computation.value, computedCtx)
        : computation.value;
    },

    dispose() {
      computation.dispose();
    },
  };
}

/**
 * @public
 * Creates a reactive effect that runs automatically when dependencies change.
 *
 * @param {function(): (void|function(): void)} fn - Effect function that may return
 *   an optional cleanup function
 * @returns {{
 *   dispose(): void,
 *   get disposed(): boolean
 * }} Object to control the effect lifecycle
 */
export function effect(fn) {
  let cleanup;
  const computation = createComputation(() => {
    if (hasMiddleware) {
      const ctx = getCtx();
      ctx.fn = fn;
      applyMiddleware("beforeEffect", null, ctx);
      releaseCtx(ctx);
    }

    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    const result = fn();
    if (typeof result === "function") cleanup = result;

    if (hasMiddleware) {
      const ctx = getCtx();
      ctx.fn = fn;
      ctx.cleanup = cleanup;
      applyMiddleware("afterEffect", null, ctx);
      releaseCtx(ctx);
    }
  }, true);

  runUpdates(() => computation.execute());

  return {
    dispose: () => {
      if (cleanup) cleanup();
      computation.dispose();
    },
    get disposed() {
      return !!(computation.flags & DISPOSED);
    },
  };
}

/**
 * @public
 * Batches multiple updates into a single transaction to improve performance.
 * Defers all reactive updates until the batch completes.
 *
 * @template T
 * @param {function(): T} fn - Function containing multiple updates
 * @returns {T} The return value of the batched function
 */
export function batch(fn) {
  if (hasMiddleware) {
    const ctx = getCtx();
    ctx.fn = fn;
    applyMiddleware("beforeBatch", null, ctx);
    releaseCtx(ctx);
  }

  const result = runUpdates(fn);

  if (hasMiddleware) {
    const ctx = getCtx();
    ctx.fn = fn;
    const transformed = applyMiddleware("afterBatch", result, ctx);
    releaseCtx(ctx);
    return transformed;
  }

  return result;
}

/**
 * @public
 * Registers middleware to intercept and transform signal operations.
 *
 * @param {Function|Function[]} m - Middleware function(s) with signature:
 *   (type: string, value: any, ctx: Object) => any
 * @param {string[]} [types] - Optional array of operation types to intercept
 *   (e.g., 'init', 'get', 'set', 'compute', 'beforeEffect', 'afterEffect')
 * @returns {function(): void} Function to unregister the middleware
 */
export function use(m, types) {
  const fns = Array.isArray(m) ? m : [m];

  if (types && types.length) {
    // Register for specific types
    types.forEach((type) => {
      typeMiddleware[type] = typeMiddleware[type] || [];
      typeMiddleware[type].push(...fns);
    });
  } else {
    // Register for all types
    middleware.push(...fns);
  }

  hasMiddleware = middleware.length > 0;
  let removed = false;

  return () => {
    if (removed) return;
    removed = true;

    if (types && types.length) {
      types.forEach((type) => {
        if (!typeMiddleware[type]) return;

        fns.forEach((fn) => {
          const idx = typeMiddleware[type].indexOf(fn);
          if (idx > -1) {
            typeMiddleware[type].splice(idx, 1);
          }
        });

        if (typeMiddleware[type].length === 0) {
          delete typeMiddleware[type];
        }
      });
    } else {
      fns.forEach((fn) => {
        let idx;
        while ((idx = middleware.indexOf(fn)) > -1) {
          middleware.splice(idx, 1);
        }
      });
    }

    hasMiddleware = middleware.length > 0;
  };
}

// export aliases
export const createSignal = signal;
export const createEffect = effect;
export const createMemo = memo;
export const derive = computed;
