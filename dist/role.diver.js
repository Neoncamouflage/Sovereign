const helper = require('functions.helper');
const registry = require('registry');
const supplyDemand = require('supplyDemand')
var roleDiver = {
    
    /** @param {Creep} creep **/
    run: function(creep) {
        let targetRoom = creep.memory.targetRoom || 'E7S2';
        creep.travelTo(new RoomPosition(25,25,targetRoom))
    }
};
function drainRoom(creep){
    if(creep.room.name != creep.memory.targetRoom){
        creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
        return;
    }
    if(creep.store[RESOURCE_ENERGY]) creep.drop(RESOURCE_ENERGY)
    let structs = creep.room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => {
            if (structure.structureType === STRUCTURE_SPAWN && structure.store[RESOURCE_ENERGY] > 50) {
                return true;
            }
            else if(structure.store[RESOURCE_ENERGY] > 0) {
                return true;
            }
            return false;
        }
    });
    let target = creep.pos.findClosestByRange(structs);
    if(creep.pos.getRangeTo(target) == 1){
        creep.withdraw(target,RESOURCE_ENERGY)
    }else{
        creep.travelTo(target)
    }
}
module.exports = roleDiver;

