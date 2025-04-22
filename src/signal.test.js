import { describe, it, expect, vi } from "vitest";
import { signal, memo, batch, computed, effect } from "./signal.js";

describe("core", () => {
  it("should get and set value", () => {
    const count = signal(1);
    expect(count.value).toBe(1);
    count.value = 2;
    expect(count.value).toBe(2);
  });

  it("should trigger effects on set", () => {
    const count = signal(0);
    let triggered = 0;
    effect(() => {
      // Accessing count.value should register dependency
      count.value;
      triggered++;
    });
    expect(triggered).toBe(1);
    count.value = 1;
    expect(triggered).toBe(2);
    count.value = 1; // No change, should not trigger
    expect(triggered).toBe(2);
    count.value = 2;
    expect(triggered).toBe(3);
  });

  it("should support memo", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = memo(() => a.value + b.value);
    expect(sum()).toBe(5);
    a.value = 5;
    expect(sum()).toBe(8);
  });

  it("should return current value with peek without tracking dependency", () => {
    const count = signal(5);
    let triggered = 0;
    effect(() => {
      // Only access count.value, not peek
      count.value;
      triggered++;
    });
    expect(triggered).toBe(1);

    // Accessing peek should not trigger effect
    expect(count.peek()).toBe(5);
    count.value = 10;
    expect(count.peek()).toBe(10);
    expect(triggered).toBe(2);

    // Accessing peek again should not trigger effect
    expect(count.peek()).toBe(10);
    expect(triggered).toBe(2);
  });

  it("should batch updates", () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;
    effect(() => {
      // Should only run once per batch
      a.value;
      b.value;
      runs++;
    });
    expect(runs).toBe(1);
    batch(() => {
      a.value = 10;
      b.value = 20;
    });
    expect(runs).toBe(2);
  });

  it("should derive value from dependencies and update reactively", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);

    expect(sum.value).toBe(5);

    a.value = 10;
    expect(sum.value).toBe(13);

    b.value = -2;
    expect(sum.value).toBe(8);
  });

  it("should not allow direct assignment to computed.value", () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);

    expect(() => {
      double.value = 10;
    }).toThrow();
  });
});
