const helper = require('functions.helper');
const registry = require('registry');
const supplyDemand = require('supplyDemand')
var roleDiver = {
    //spawnCreep('diver','1a1m','E28S8',60,{job:'harass'})
    //spawnCreep('diver','6m4r1a1h','E28S8',60,{job:'harass',fief:'E28S8'})
    //Object.values(Game.creeps).filter(crp => crp.memory.role = 'diver').forEach(x=>{x.memory.portalled = false})
    /** @param {Creep} creep **/
    run: function(creep) {
        creep.respawn()
        let tpos =new RoomPosition(11,28,'W9N67');
        if(creep.room.controller && creep.room.controller.safeMode){
            creep.suicide();
            return;
        }
        if(!creep.memory.stepped){
            if(creep.pos.isEqualTo(tpos)){
                creep.memory.stepped = true;
            }
            else{
                creep.travelTo(tpos);
                return;
            }
            
        }
        let target = creep.memory.target && Game.getObjectById(creep.memory.target);
        if(!target){
            let sites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(sites.length){
                creep.memory.target = sites[0].id;
                target = sites[0];
            }
        }
        if(target && creep.pos.getRangeTo(target) > 1){
            creep.travelTo(target);
        }
        else if(target && creep.pos.getRangeTo(target) == 1){
            let movDir = creep.pos.getDirectionTo(target);
            creep.move(movDir);
        }
        

        return;
    }
};





function drainRoom(creep){
    if(creep.room.name != creep.memory.targetRoom){
        creep.travelTo(new RoomPosition(11,28,creep.memory.targetRoom));
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

