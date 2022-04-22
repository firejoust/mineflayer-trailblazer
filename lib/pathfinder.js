const ffi = require('ffi-napi');

module.exports = class {
    constructor(client) {
        this.client = client;
    }
}