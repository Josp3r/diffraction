// const { BehaviorSubject } = require('rxjs')

// const subject = new BehaviorSubject(0)

// subject.subscribe((value) => console.log('A ' + value))

// subject.next(1)

// subject.next(2)

// setTimeout(() => {
//     subject.subscribe((value) => console.log('B ' + value))
// }, 1000)

// const { ReplaySubject } = require('rxjs')

// const subject = new ReplaySubject()

// subject.next(1)
// subject.next(2)
// subject.next(3)

// subject.subscribe((value) => console.log('A ' + value))

// subject.next(4)

// subject.next(5)

// setTimeout(() => {
//     subject.subscribe((value) => console.log('B ' + value))
// }, 1000)

const { AsyncSubject } = require('rxjs')

const subject = new AsyncSubject();
subject.next(1);
subject.subscribe(res => {
    console.log('A:' + res);
});
subject.next(2);
subject.subscribe(res => {
    console.log('B:' + res);
});
subject.next(3);
subject.subscribe(res => {
    console.log('C:' + res);
});
subject.complete();
subject.next(4);