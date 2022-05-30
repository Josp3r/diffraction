const { Observable } = require('rxjs')

const a = Observable.create(observer => {
    observer.next('111')
    setTimeout(() => {
        observer.next('777')
    }, 3000)
})

const s = a.subscribe((text) => {
    console.log(text)
})

s.unsubscribe()
// 111
