export function createLoggerMiddleware(options = {}) {
  const { logGets = 0, logSets = 1, logComputes = 0, logEffects = 0 } = options;
  return (type, value, context) => {
    if (type === "get" && logGets) console.log(`[signal:get]`, value);
    else if (type === "set" && logSets)
      console.log(`[signal:set]`, context.prevValue, "→", value);
    else if (type === "compute" && logComputes)
      console.log(`[signal:compute]`, value, context);
    else if (type === "beforeEffect" && logEffects)
      console.log(`[signal:effect:start]`, context);
    else if (type === "afterEffect" && logEffects)
      console.log(`[signal:effect:end]`, context);
    return value;
  };
}

export function createValidatorMiddleware(validator, errorHandler) {
  return (type, value, context) => {
    if (type === "set" || type === "init") {
      if (!validator(value, context)) {
        if (errorHandler) return errorHandler(value, context);
        console.error(`[signal:validation] Value failed validation:`, value);
        return context.prevValue;
      }
    }
    return value;
  };
}

export function createPersistMiddleware(options = {}) {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;
  return (type, value, context) => {
    if (!context.persist) return value;
    const key = context.persist.key;
    if (!key) return value;
    const s = context.persist.serialize || serialize;
    const d = context.persist.deserialize || deserialize;
    if (type === "init") {
      try {
        const stored = localStorage.getItem(key);
        if (stored != null) return d(stored);
      } catch {}
      return value ?? context.persist.defaultValue;
    }
    if (type === "set") {
      try {
        localStorage.setItem(key, s(value));
      } catch {}
    }
    return value;
  };
}
