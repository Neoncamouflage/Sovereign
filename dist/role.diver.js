const helper = require('functions.helper');
const registry = require('registry');
var roleDiver = {

    /** @param {Creep} creep **/
    run: function(creep) {
        creep.respawn();
        let target = new RoomPosition(31,14,'E37S11')
        creep.travelTo(target)
    }
};

module.exports = roleDiver;

