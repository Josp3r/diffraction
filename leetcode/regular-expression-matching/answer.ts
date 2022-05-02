function match(char: string, p1: string, p2 = '') {

    if (p2 === '*') {
        if (p1 === '.') {
            return 3
        }

        if (p1 === char) {
            return 2
        }

        return -1
    }

    if (char === p1 || p1 === '.') {
        return 1
    }

    return 0
}

// . any
// * >= 0
// .* any >=0

function is_match(s: string, p: string) {
    let i = 0, j = 0

    let result = 0

    while (i < s.length) {
        result = match(s[i], p[j], p[j + 1])
        console.log(result)

        if (result === 0) {
            return false
        }

        if (result === 3) {
            return true
        }

        if (result === 2) {
            const char = s[i]
            inner: for (let k = i + 1; k < s.length;) {
                i = k
                if (char !== s[k]) {
                    break inner
                }
                k++
            }

            if (j + 2 === p.length && i + 1 === s.length) {
                return true
            }

            j+=2
            continue
        }

        if (result === -1) {
            i+=2
            j+=2
        }

        if (j === p.length - 1) {
            return i === s.length - 1
        }

        i++
        j++
    }

    console.log(i, j)

    return j === p.length || j + 2 === p.length
}
// const ret = is_match('mississippi', 'mis*is*ip*.')
// const ret = is_match('aa', 'a*')
const ret = is_match('ab', '.*c')

console.log(ret)