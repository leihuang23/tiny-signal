# tiny-signal

A tiny reactive signal system.

This library provides fine-grained reactivity with signals, computed values, effects, batching, and extensible middleware.

**Note:** This is a study project and not intended for production use.

## API

### `signal(initialValue, options?)`

Create a reactive signal.

```js
import { signal } from "tiny-signal";

const count = signal(0);
count.value = 1;
console.log(count.value); // 1
count.peek(); // get value without tracking dependency
```

#### Options

- `name` (string): Optional name for debugging.
- `persist` (object): Used by persist middleware.

---

### `computed(fn, options?)`

Create a read-only computed signal derived from other signals.

```js
import { signal, computed } from "tiny-signal";

const a = signal(2);
const b = signal(3);
const sum = computed(() => a.value + b.value);
console.log(sum.value); // 5
a.value = 5;
console.log(sum.value); // 8
```

---

### `memo(fn)`

Create a memoized computation that updates when dependencies change.

```js
import { signal, memo } from "tiny-signal";

const a = signal(2);
const b = signal(3);
const sum = memo(() => a.value + b.value);
console.log(sum()); // 5
a.value = 5;
console.log(sum()); // 8
```

---

### `effect(fn)`

Run a function whenever its dependencies change.

```js
import { signal, effect } from "tiny-signal";

const count = signal(0);
effect(() => {
  console.log("Count is", count.value);
});
count.value = 2; // logs: Count is 2
```

---

### `batch(fn)`

Batch multiple updates into a single transaction.

```js
import { signal, batch } from "tiny-signal";

const a = signal(1);
const b = signal(2);

batch(() => {
  a.value = 10;
  b.value = 20;
});
```

---

### `use(middleware, types?)`

Register middleware to intercept signal operations.

```js
import { use } from "tiny-signal";
import { createLoggerMiddleware } from "./src/middlewares.js";

use(createLoggerMiddleware({ logGets: true, logSets: true }));
```

---

### `enableScheduling(strategy)`

Configure how updates are scheduled.

- `'animation'` (default): Uses `requestAnimationFrame`
- `'idle'`: Uses `requestIdleCallback` or `setTimeout`
- `function`: Custom scheduler

```js
import { enableScheduling } from "tiny-signal";

enableScheduling("idle");
```

---

## Middleware

#### `createLoggerMiddleware(options)`

Log signal operations.

#### `createValidatorMiddleware(validator, errorHandler?)`

Validate signal values.

#### `createPersistMiddleware(options?)`

Persist signal values to localStorage.

---

## Example

```js
import {
  signal,
  effect,
  memo,
  batch,
  use,
  createLoggerMiddleware,
} from "tiny-signal";

const count = signal(1);
const double = memo(() => count.value * 2);

use(createLoggerMiddleware({ logGets: true, logSets: true }));

effect(() => {
  console.log("Double is", double());
});

count.value = 5; // logs: Double is 10
```

---

## License

[MIT](./LICENSE)
