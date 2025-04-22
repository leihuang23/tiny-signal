import { describe, it, expect, vi } from "vitest";
import { signal, use } from "./signal.js";
import {
  createLoggerMiddleware,
  createValidatorMiddleware,
  createPersistMiddleware,
} from "./middlewares.js";

describe("middleware", () => {
  it("should call logger middleware on get/set", () => {
    const logs = [];
    const remove = use(
      createLoggerMiddleware({
        logGets: true,
        logSets: true,
        logComputes: false,
        logEffects: false,
      })
    );
    // Patch console.log for this test
    const origLog = console.log;
    console.log = (...args) => logs.push(args);

    const s = signal(1);
    expect(s.value).toBe(1); // get
    s.value = 2; // set

    expect(logs.some((l) => l[0] === "[signal:get]")).toBe(true);
    expect(logs.some((l) => l[0] === "[signal:set]")).toBe(true);

    // Restore
    console.log = origLog;
    remove();
  });

  it("should validate values with validator middleware", () => {
    const validator = (v) => typeof v === "number" && v >= 0;
    const remove = use(createValidatorMiddleware(validator));
    const s = signal(0);
    expect(s.value).toBe(0);
    s.value = 5;
    expect(s.value).toBe(5);
    s.value = -1; // Should not update
    expect(s.value).toBe(5);
    remove();
  });

  it("should persist values with persist middleware (mocked localStorage)", () => {
    // Mock localStorage
    const store = {};
    const localStorageMock = {
      getItem: vi.fn((k) => store[k] ?? null),
      setItem: vi.fn((k, v) => {
        store[k] = v;
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
    };
    globalThis.localStorage = localStorageMock;

    const remove = use(createPersistMiddleware());

    const s = signal(42, { persist: { key: "test-key" } });

    s.value = 99;
    expect(localStorageMock.setItem).toHaveBeenCalledWith("test-key", "99");

    // Simulate reload: new signal should load from storage
    store["test-key"] = "123";
    const s2 = signal(0, { persist: { key: "test-key" } });
    expect(s2.value).toBe(123);

    remove();
    delete globalThis.localStorage;
  });

  it("should apply multiple middleware in order", () => {
    const calls = [];
    // Middleware 1: logs get/set
    const mw1 = (type, value, ctx) => {
      calls.push(`mw1:${type}:${value}`);
      return value;
    };
    // Middleware 2: transforms set value
    const mw2 = (type, value, ctx) => {
      calls.push(`mw2:${type}:${value}`);
      if (type === "set") return value * 2;
      return value;
    };
    const remove = use([mw1, mw2]);

    const s = signal(3);
    // Get should call both middleware
    expect(s.value).toBe(3);
    // Set should call both, and mw2 should double the value
    s.value = 4;
    expect(s.value).toBe(8);

    // Check call order and that both middleware were called for get and set
    const getCalls = calls.filter((c) => c.includes(":get:"));
    const setCalls = calls.filter((c) => c.includes(":set:"));
    expect(getCalls.length).toBe(4);
    expect(setCalls.length).toBe(2);
    expect(calls.indexOf("mw1:get:3")).toBeLessThan(calls.indexOf("mw2:get:3"));
    expect(calls.indexOf("mw1:set:4")).toBeLessThan(calls.indexOf("mw2:set:4"));

    remove();
  });
});
