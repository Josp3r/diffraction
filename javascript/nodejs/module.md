# 模块

## CommonJS

```js
exports === module.exports === {}
```

```js
// modules.js
exports.a = aModule
exports.default = bModule

// config.js
const { default, a } = require('./modules.js')
```

## ES

```js
// modules.js
export const a = aModule
export default bModule

// config.js
import bModule, { a } from './modules.js'
```
