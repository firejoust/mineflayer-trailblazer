const assert = require("assert")

function readUInt4LE(buffer, cursor) {
    return cursor % 1 === 0
    ? buffer.readUInt8(cursor) % 0b1111
    : buffer.readUInt8(Math.floor(cursor)) >> 4
}

function readUInt4BE(buffer, cursor) {
    return cursor % 1 === 0
    ? buffer.readUInt8(cursor) >> 4
    : buffer.readUInt8(Math.floor(cursor)) & 0b1111
}

function writeUInt4LE(buffer, value, cursor) {
    const index = Math.floor(cursor)
    assert.ok(value < 16, "Value is out of bounds")

    cursor % 1 === 0
    // first nibble
    ? buffer.writeUInt8(
        readUInt4LE(buffer, index) << 4 | value,
        index
    )
    // second nibble
    : buffer.writeUInt8(
        readUInt4LE(buffer, index) | value << 4,
        index
    )
}

function writeUInt4BE(buffer, value, cursor) {
    const index = Math.floor(cursor)
    assert.ok(value < 16, "Value is out of bounds")
    
    cursor % 1 === 0
    // first nibble
    ? buffer.writeUInt8(
        readUInt4BE(buffer, cursor) | value << 4,
        index
    )
    // second nibble
    : buffer.writeUInt8(
        readUInt4BE(buffer, index) << 4 | value,
        index
    )
}

module.exports = {
    readUInt4LE,
    readUInt4BE,
    writeUInt4LE,
    writeUInt4BE
}