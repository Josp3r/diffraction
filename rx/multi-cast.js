const { interval, take, Subject } = require('rxjs')

const source = interval(1000).pipe(take(3))

const subject = new Subject()

source.subscribe(subject)

subject.subscribe((value) => console.log('A ' + value))

setTimeout(() => {
    subject.subscribe((value) => console.log('B ' + value))
}, 1000)