var RandomizedSet = function() {
    this.hash = {}
    this.set = []
};

/** 
 * @param {number} val
 * @return {boolean}
 */
RandomizedSet.prototype.insert = function(val) {
    if (typeof this.hash[val] !== 'undefined') {
        return false
    }
    this.hash[val] = this.set.length
    this.set.push(val)
    return true
};

/** 
 * @param {number} val
 * @return {boolean}
 */
RandomizedSet.prototype.remove = function(val) {
    if (typeof this.hash[val] === 'undefined') {
        return false
    }
    // 只能pop出栈
    // 因此需要最后出栈的元素replace当前，并记录至hash中，再进行pop
    const idx = this.hash[val]
    const lastVal = this.set[this.set.length - 1]
    this.set[idx] = lastVal
    this.hash[lastVal] = idx
    this.set.pop()
    delete this.hash[val]
    return true
};

/**
 * @return {number}
 */
RandomizedSet.prototype.getRandom = function() {
    const idx = Math.floor(Math.random() * this.set.length)
    return this.set[idx]
};

/**
 * Your RandomizedSet object will be instantiated and called as such:
 * var obj = new RandomizedSet()
 * var param_1 = obj.insert(val)
 * var param_2 = obj.remove(val)
 * var param_3 = obj.getRandom()
 */