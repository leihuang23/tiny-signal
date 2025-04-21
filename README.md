# tiny-signal

A tiny reactive signal system inspired by SolidJS.  
This is a study project for fun, but it's almost feature-complete. Use at your own risk.

## API

### `signal(initialValue, options?)`

Create a reactive signal.

```js
const count = signal(0);
count.value = 1;
console.log(count.value); // 1
count.peek(); // get value without tracking dependency
```

### `memo(fn)`

Create a memoized computation that updates when dependencies change.

```js
const a = signal(2);
const b = signal(3);
const sum = memo(() => a.value + b.value);
console.log(sum()); // 5
a.value = 5;
console.log(sum()); // 8
```

### `effect(fn)`

Run a function whenever its dependencies change.

```js
effect(() => {
  console.log("Count is", count.value);
});
count.value = 2; // logs: Count is 2
```

### `batch(fn)`

Batch multiple updates into a single transaction.

```js
batch(() => {
  a.value = 10;
  b.value = 20;
});
```

### Middleware

#### `use(middleware)`

Register middleware to intercept signal operations.

## Included Middlewares

#### `createLoggerMiddleware(options)`

Log signal operations.

#### `createValidatorMiddleware(validator, errorHandler?)`

Validate signal values.

#### `createPersistMiddleware(options?)`

Persist signal values to localStorage.

## Example

```js
import {
  signal,
  effect,
  memo,
  batch,
  use,
  createLoggerMiddleware,
} from "./src/signal.js";

const count = signal(1);
const double = memo(() => count.value * 2);

use(createLoggerMiddleware({ logGets: true, logSets: true }));

effect(() => {
  console.log("Double is", double());
});

count.value = 5; // logs: Double is 10
```

## License

[MIT](./LICENSE)
