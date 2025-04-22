import { Bench } from "tinybench";
import {
  signal as tinySignal,
  computed as tinyComputed,
  effect as tinyEffect,
  batch as tinyBatch,
} from "../src/signal.js";
import {
  createSignal as solidSignal,
  createMemo as solidComputed,
  createEffect as solidEffect,
  batch as solidBatch,
} from "solid-js";
import {
  signal as preactSignal,
  computed as preactComputed,
  effect as preactEffect,
  batch as preactBatch,
} from "@preact/signals";

async function runComparisonBenchmark() {
  const bench = new Bench();

  bench.add("tiny-signal", function () {
    const count = tinySignal(0);
    const doubled = tinyComputed(() => count.value * 2);
    const disposed = tinyEffect(() => doubled.value);

    for (let i = 0; i < 100; i++) {
      count.value = i;
    }

    disposed.dispose();
  });

  bench.add("solid-js", function () {
    const [count, setCount] = solidSignal(0);
    const doubled = solidComputed(() => count() * 2);
    solidEffect(() => doubled());

    for (let i = 0; i < 100; i++) {
      setCount(i);
    }
  });

  bench.add("preact/signals", function () {
    const count = preactSignal(0);
    const doubled = preactComputed(() => count.value * 2);
    preactEffect(() => doubled.value);

    for (let i = 0; i < 100; i++) {
      count.value = i;
    }
  });

  await bench.run();
  console.table(bench.table());
}

// Batch benchmark
async function runBatchBenchmark() {
  console.log("\n🔄 Batch Update Performance Comparison");
  console.log("=".repeat(50));

  const bench = new Bench();

  bench.add("tiny-signal (no batch)", function () {
    const s1 = tinySignal(0);
    const s2 = tinySignal(0);
    const s3 = tinySignal(0);
    const s4 = tinySignal(0);
    const s5 = tinySignal(0);

    const c = tinyComputed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );
    const e = tinyEffect(() => c.value);

    for (let i = 0; i < 50; i++) {
      s1.value = i;
      s2.value = i;
      s3.value = i;
      s4.value = i;
      s5.value = i;
    }

    e.dispose();
  });

  bench.add("tiny-signal (with batch)", function () {
    const s1 = tinySignal(0);
    const s2 = tinySignal(0);
    const s3 = tinySignal(0);
    const s4 = tinySignal(0);
    const s5 = tinySignal(0);

    const c = tinyComputed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );
    const e = tinyEffect(() => c.value);

    for (let i = 0; i < 50; i++) {
      tinyBatch(() => {
        s1.value = i;
        s2.value = i;
        s3.value = i;
        s4.value = i;
        s5.value = i;
      });
    }

    e.dispose();
  });

  bench.add("solid-js (no batch)", function () {
    const [s1, setS1] = solidSignal(0);
    const [s2, setS2] = solidSignal(0);
    const [s3, setS3] = solidSignal(0);
    const [s4, setS4] = solidSignal(0);
    const [s5, setS5] = solidSignal(0);

    const c = solidComputed(() => s1() + s2() + s3() + s4() + s5());
    solidEffect(() => c());

    for (let i = 0; i < 50; i++) {
      setS1(i);
      setS2(i);
      setS3(i);
      setS4(i);
      setS5(i);
    }
  });
  bench.add("solid-js (with batch)", function () {
    const [s1, setS1] = solidSignal(0);
    const [s2, setS2] = solidSignal(0);
    const [s3, setS3] = solidSignal(0);
    const [s4, setS4] = solidSignal(0);
    const [s5, setS5] = solidSignal(0);

    const c = solidComputed(() => s1() + s2() + s3() + s4() + s5());
    solidEffect(() => c());

    for (let i = 0; i < 50; i++) {
      solidBatch(() => {
        setS1(i);
        setS2(i);
        setS3(i);
        setS4(i);
        setS5(i);
      });
    }
  });
  bench.add("preact/signals (no batch)", function () {
    const s1 = preactSignal(0);
    const s2 = preactSignal(0);
    const s3 = preactSignal(0);
    const s4 = preactSignal(0);
    const s5 = preactSignal(0);

    const c = preactComputed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );
    preactEffect(() => c.value);

    for (let i = 0; i < 50; i++) {
      s1.value = i;
      s2.value = i;
      s3.value = i;
      s4.value = i;
      s5.value = i;
    }
  });

  bench.add("preact/signals (with batch)", function () {
    const s1 = preactSignal(0);
    const s2 = preactSignal(0);
    const s3 = preactSignal(0);
    const s4 = preactSignal(0);
    const s5 = preactSignal(0);

    const c = preactComputed(
      () => s1.value + s2.value + s3.value + s4.value + s5.value
    );
    preactEffect(() => c.value);

    for (let i = 0; i < 50; i++) {
      preactBatch(() => {
        s1.value = i;
        s2.value = i;
        s3.value = i;
        s4.value = i;
        s5.value = i;
      });
    }
  });

  await bench.run();
  console.table(bench.table());
}

await runComparisonBenchmark();
await runBatchBenchmark();
