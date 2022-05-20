const Pathfinder = require("./lib/pathfinder");
const world = require("./lib/world");

const plugin = (client, options) => {
    client.pathfinder = new Pathfinder(client, options);
}

module.exports = { plugin, world };