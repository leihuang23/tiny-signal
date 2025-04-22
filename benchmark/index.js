import { signal, computed, effect, batch } from "../src/signal.js";
import { Bench } from "tinybench";

// Basic benchmarking setup
async function runBenchmark(name, tests) {
  console.log("=".repeat(50));

  const bench = new Bench({ name });

  Object.entries(tests).forEach(([testName, testFn]) => {
    bench.add(testName, testFn);
  });

  await bench.run();
  console.log(`\n🚀 ${name}`);
  console.table(bench.table());
}

// 1. Signal creation
await runBenchmark("Signal Creation", {
  "Create 1,000 signals": () => {
    const signals = [];
    for (let i = 0; i < 1000; i++) {
      signals.push(signal(i));
    }
  },
});

// 2. Signal read performance
await runBenchmark("Signal Read Performance", {
  "Read signal 10,000 times": () => {
    const s = signal(0);
    for (let i = 0; i < 10000; i++) {
      void s.value;
    }
  },
  "Read signal with peek 10,000 times": () => {
    const s = signal(0);
    for (let i = 0; i < 10000; i++) {
      void s.peek();
    }
  },
});

// 3. Signal write performance
await runBenchmark("Signal Write Performance", {
  "Write to signal 1,000 times": () => {
    const s = signal(0);
    for (let i = 0; i < 1000; i++) {
      s.value = i;
    }
  },
  "Write to signal with 1 subscriber": () => {
    const s = signal(0);
    const c = computed(() => s.value * 2);
    for (let i = 0; i < 1000; i++) {
      s.value = i;
    }
  },
});

// 4. Computed signal performance
await runBenchmark("Computed Signal Performance", {
  "Simple computed with 1 dependency": () => {
    const s = signal(0);
    const c = computed(() => s.value * 2);
    for (let i = 0; i < 1000; i++) {
      s.value = i;
      const result = c.value;
    }
  },
  "Computed with 5 dependencies": () => {
    const s1 = signal(1);
    const s2 = signal(2);
    const s3 = signal(3);
    const s4 = signal(4);
    const s5 = signal(5);
    const c = computed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );

    for (let i = 0; i < 200; i++) {
      s1.value = i;
      s2.value = i;
      s3.value = i;
      s4.value = i;
      s5.value = i;
      const result = c.value;
    }
  },
});

// 5. Effect performance
await runBenchmark("Effect Performance", {
  "Effect with 1 dependency": () => {
    const s = signal(0);
    let count = 0;
    const e = effect(() => {
      count += s.value;
    });

    for (let i = 0; i < 1000; i++) {
      s.value = i;
    }
    e.dispose();
  },
});

// 6. Deep dependency chain
await runBenchmark("Deep Dependency Chain", {
  "Chain of 10 computed signals": () => {
    const s = signal(0);
    let last = s;

    // Create a chain of 10 computed signals
    for (let i = 0; i < 10; i++) {
      last = computed(() => last.value + 1);
    }

    for (let i = 0; i < 100; i++) {
      s.value = i;
      const result = last.value;
    }
  },
});

// 7. Batch updates
await runBenchmark("Batch Updates", {
  "Update 5 signals without batch": () => {
    const s1 = signal(0);
    const s2 = signal(0);
    const s3 = signal(0);
    const s4 = signal(0);
    const s5 = signal(0);

    const c = computed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );

    for (let i = 0; i < 100; i++) {
      s1.value = i;
      s2.value = i;
      s3.value = i;
      s4.value = i;
      s5.value = i;
      const result = c.value;
    }
  },
  "Update 5 signals with batch": () => {
    const s1 = signal(0);
    const s2 = signal(0);
    const s3 = signal(0);
    const s4 = signal(0);
    const s5 = signal(0);

    const c = computed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );

    for (let i = 0; i < 100; i++) {
      batch(() => {
        s1.value = i;
        s2.value = i;
        s3.value = i;
        s4.value = i;
        s5.value = i;
      });
      const result = c.value;
    }
  },
});

// 8. Memory usage
if (typeof process !== "undefined") {
  console.log("\n📊 Memory Usage Tests");
  console.log("=".repeat(50));

  function logMemoryUsage(label) {
    const used = process.memoryUsage();
    console.log(
      `${label}: ${Math.round((used.heapUsed / 1024 / 1024) * 100) / 100} MB`
    );
  }

  // Memory test
  logMemoryUsage("Baseline");

  const signals = [];
  for (let i = 0; i < 10000; i++) {
    signals.push(signal(i));
  }

  logMemoryUsage("After creating 10,000 signals");

  const computed_signals = [];
  for (let i = 0; i < 1000; i++) {
    computed_signals.push(computed(() => signals[i].value * 2));
  }

  logMemoryUsage("After adding 1,000 computed");

  const effects = [];
  for (let i = 0; i < 100; i++) {
    effects.push(
      effect(() => {
        let sum = 0;
        for (let j = 0; j < 10; j++) sum += signals[i * 10 + j].value;
      })
    );
  }

  logMemoryUsage("After adding 100 effects");

  // Cleanup
  effects.forEach((e) => e.dispose());
  computed_signals.forEach((c) => c.dispose());
  signals.forEach((s) => s.dispose());

  logMemoryUsage("After cleanup");
}
