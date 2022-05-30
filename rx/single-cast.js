const { interval, take } = require('rxjs')

const source = interval(1000).pipe(take(4))

source.subscribe((value) => console.log('A ' + value))

setTimeout(() => {
    source.subscribe((value) => console.log('B ' + value))
}, 1000)