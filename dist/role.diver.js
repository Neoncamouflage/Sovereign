const helper = require('functions.helper');
const registry = require('registry');
var roleDiver = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(Game.time % 3 == 0 && creep.ticksToLive <= 100 && !creep.memory.respawn){
            registry.requestCreep({sev:30,body:[MOVE,CARRY],memory:{role:creep.memory.role,fief:'E46N37',preflight:false},respawn:creep.id})
        }
        for(let res of Object.keys(creep.store)){
            creep.drop(res);
            return;
        }
        if(creep.room.name != 'E45N38'){
            let target = new RoomPosition(17,25,'E45N38');
            creep.travelTo(target);
            return;
        }

        if(creep.memory.target){
            let t = Game.getObjectById(creep.memory.target)
            if(t && t.store.getUsedCapacity(RESOURCE_ENERGY) > t.structureType == STRUCTURE_SPAWN ? 50 : 0){
                creep.travelTo(t);
                creep.withdraw(t,RESOURCE_ENERGY)
                return;
            }
        }
        //console.log("No target")
        let targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return ((structure.structureType === STRUCTURE_TOWER ||
                        structure.structureType === STRUCTURE_EXTENSION) &&
                       structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                       ((structure.structureType === STRUCTURE_SPAWN) &&
                       structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50);
            }
        });
        //console.log("TARGETS: ",targets)
        if(!targets.length) return;
        creep.memory.target = creep.pos.findClosestByRange(targets).id;
        let t = Game.getObjectById(creep.memory.target)
        if(t && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0){
            creep.travelTo(t);
            creep.withdraw(t,RESOURCE_ENERGY)
            return;
        }
    }
};

module.exports = roleDiver;

