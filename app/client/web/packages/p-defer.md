# p-defer

```js
import pDefer from 'p-defer';

function delay(milliseconds) {
 const deferred = pDefer();
 setTimeout(deferred.resolve, milliseconds, '🦄');
 return deferred.promise;
}

console.log(await delay(100));
```
