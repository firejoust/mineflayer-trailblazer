const Pathfinder = require("./lib/pathfinder");
const world = require("./lib/world");

const plugin = (client) => {
    client.pathfinder = new Pathfinder(client);
}

module.exports = { plugin, world };