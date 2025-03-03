const helper = require('functions.helper');
var roleBait = {
    //[MOVE,MOVE,CARRY,CARRY,MOVE,ATTACK,MOVE,ATTACK]
    /** @param {Creep} creep **/
    run: function(creep) {
        const directions = [
            { x: 0, y: -1 },  // Top
            { x: 1, y: -1 },  // Top-right
            { x: 1, y: 0 },   // Right
            { x: 1, y: 1 },   // Bottom-right
            { x: 0, y: 1 },   // Bottom
            { x: -1, y: 1 },  // Bottom-left
            { x: -1, y: 0 },  // Left
            { x: -1, y: -1 }  // Top-left
        ];
        let targetRoom = creep.memory.targetRoom || 'E7S8'

        if(creep.room.name != targetRoom){
            creep.travelTo(new RoomPosition(25,25,targetRoom),{range:10})
        }
        else{
            let targets = creep.room.find(FIND_HOSTILE_STRUCTURES).filter(str => str.structureType != STRUCTURE_WALL);
            let spawns = targets.filter(str => str.structureType == STRUCTURE_SPAWN)
            let towers = targets.filter(str => str.structureType == STRUCTURE_TOWER);
            if(spawns[0]){
                creep.travelTo(spawns[0]);
                let x = creep.dismantle(spawns[0]);
                if(x == OK){
                    if(spawns[0].hits <= 500)creep.say('𒋲🔥𒋲')
                }
            }
            else if(towers[0]){
                creep.travelTo(towers[0]);
                creep.dismantle(towers[0]);
            }
            else{
                let target = creep.pos.findClosestByRange(targets)
                creep.travelTo(target);
                creep.dismantle(target);
            }
        }
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

module.exports = roleBait;

