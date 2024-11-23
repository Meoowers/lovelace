function djb2(str) {
    let len = str.length
    let h = 5381

    for (let i = 0; i < len; i++) {
        h = h * 33 ^ str.charCodeAt(i)
    }
    return h >>> 0
}

class Atom {
    constructor(value) {
        this.value = value
        this.hash = djb2(this.value)
    }

    equals(other) {
        return this.hash == other.hash
    }
}

class Identifier {
    constructor(value) {
        this.value = value
    }

    equals(other) {
        return this.value == other.value
    }
}
