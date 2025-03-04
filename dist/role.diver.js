const helper = require('functions.helper');
const registry = require('registry');
const supplyDemand = require('supplyDemand')
var roleDiver = {
    //spawnCreep('diver','1a1m','E28S8',60,{job:'harass'})
    //spawnCreep('diver','6m4r1a1h','E28S8',60,{job:'harass',fief:'E28S8'})
    //Object.values(Game.creeps).filter(crp => crp.memory.role = 'diver').forEach(x=>{x.memory.portalled = false})
    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'harass'){
            let hRooms = creep.memory.hRooms || randomChoice([['E3S2','E2S3','E3S3','E2S4','E4S3','E5S2'],['E7S6','E8S7','E9S6','E8S8','E6S8','E6S9','E7S9']]); //['E2S7','E3S7','E4S7','E4S8'],['E7S6','E8S7','E9S6','E8S8','E6S8','E6S9','E7S9']
            if(!creep.memory.portalled && creep.room.name == 'E0S0'){
                creep.memory.portalled = true;
                creep.move(RIGHT)
            }
            if(!creep.memory.portalled){
                creep.travelTo(new RoomPosition(44,44,'E30S10'));
                return;
            }
            let hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
            let soldiers = hostiles.filter(crp => helper.isSoldier(crp));
            if(!creep.memory.hRoom) creep.memory.hRoom = randomChoice(hRooms);
            if(creep.room.name == creep.memory.hRoom){
                let target;
                if(soldiers.length){
                    let total = 0;
                    for(let sold of soldiers){
                        total += sold.body.length;
                    }
                    if(total >= creep.body.length){
                        creep.memory.hRoom = randomChoice(hRooms);
                    }
                    else if(creep.pos.getRangeTo(creep.pos.findClosestByRange(soldiers)) <= 4){
                        target = creep.pos.findClosestByRange(soldiers);
                    }
                }
                if(hostiles.length){
                    target = creep.pos.findClosestByRange(hostiles);
                    creep.travelTo(target);
                }
                else{
                    creep.memory.hRoom = randomChoice(hRooms);
                }

                if(target && creep.pos.getRangeTo(target) <= 1){
                    creep.rangedMassAttack();
                    creep.attack(target);
                    creep.attackingTick = true;
                }
                else if(target && creep.pos.getRangeTo(target) <=3){
                    creep.rangedAttack(target);
                    creep.heal(creep);
                    creep.attackingTick = true;
                }
                if(creep.pos.getRangeTo(target) <3){
                    let res = PathFinder.search(creep.pos, {pos:target.pos,range:4}, {flee:true})
                    let resPath = res.path;
                    let next = creep.pos.getDirectionTo(resPath[0])
                    let x = creep.move(next)
                }
                creep.travelTo(target);

            }
            else{
                let target;
                if(!soldiers.length && hostiles.length){
                    target = creep.pos.findClosestByRange(hostiles);
                    if(creep.pos.getRangeTo(target) < 5){
                        creep.travelTo(target);
                    }
                    else{
                        creep.travelTo(new RoomPosition(25,25,creep.memory.hRoom),{range:25})
                    }
                }
                else if(soldiers.length){
                    target = creep.pos.findClosestByRange(soldiers);
                }
                creep.travelTo(new RoomPosition(25,25,creep.memory.hRoom),{range:25})
                if(target && creep.pos.getRangeTo(target) <= 1){
                    creep.rangedMassAttack();
                    creep.attack(target);
                    creep.attackingTick = true;
                }
                else if(target && creep.pos.getRangeTo(target) <=3){
                    creep.rangedAttack(target);
                    creep.heal(creep);
                    creep.attackingTick = true;
                }

            }
            let structTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL
            });
            let targetStruct = creep.pos.findClosestByRange(structTargets);
            if(!creep.attackingTick && !Memory.kingdom.fiefs[creep.room.name]&& !Memory.kingdom.holdings[creep.room.name]){
                if(creep.pos.getRangeTo(targetStruct) <=1)creep.attack(targetStruct);
                if(creep.pos.getRangeTo(targetStruct) <=3)creep.rangedAttack(targetStruct)
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
module.exports = roleDiver;

