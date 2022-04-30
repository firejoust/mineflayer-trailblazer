const debug = require("./debug.json");
const assert = require("assert");

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    constructPath({ buffer, goal }) {
        assert.ok(typeof buffer === "object" && buffer.length, debug.invalid_buffer);
        assert.ok(typeof goal === "object" && goal.x && goal.y && goal.z, debug.invalid_goal);
    }
}