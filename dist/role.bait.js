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
        let targetRoom = creep.memory.targetRoom
        let target = Game.getObjectById(creep.memory.targetID);
        const DEP_MAX_CD = 45;
        if(creep.memory.job == 'scoot'){
            let targetPos = new RoomPosition(25,32,'W25S25');
            if(creep.room.name == 'E25N15'){
                targetPos = new RoomPosition(2,40,'E25N15');
                if(creep.pos.isEqualTo(targetPos)){
                    creep.memory.role = 'scout';
                    return;
                }
            }
            creep.travelTo(targetPos);
            return;
        }
        if(creep.memory.job == 'harabi'){
            if(creep.room.name == creep.target.room){
                if(creep.store.getFreeCapacity() > 0){
                    creep.travelTo(creep.room.storage);
                    creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                }
                else{

                    creep.travelTo(new RoomPosition(25,25,'E29S7'))
                }
            }
        }
        if(creep.memory.job == 'tag'){
            /**
             * E19S9
             * ['E12S10','E11S10','E10S10','E9S10','E8S10','E7S10','E6S10','E5S10','E4S10','E3S10','E2S10','E1S10','E0S10','E0S9','E0S8','E0S7','E0S6','E0S5']
             * ['E12S10','E11S10','E10S9','E10S8','E10S7','E10S6','E10S5','E10S4','E10S3','E10S2','E10S1','E10S0','E11S0','E12S0','E13S0']
             * E28S8
             * ['E0S0','E0S1','E0S2','E0S3','E0S4','E0S5','E0S6','E0S7','E0S8','E0S9','E0S10']
             * ['E0S0','E1S0','E2S0','E3S0','E4S0','E5S0','E6S0','E7S0','E8S0','E9S0','E10S0','E11S0','E12S0']
             */
            if(!creep.memory.tagRooms)return;
            if(creep.memory.portal){
                let targetPos = new RoomPosition(44,44,'E30S10');
                
                if(creep.room.name == 'E0S0'){
                    creep.memory.portal = false;
                }
                else{
                    creep.travelTo(targetPos);
                    return;
                }
            }
            if(!creep.memory.roomCount || creep.memory.roomCount == creep.memory.tagRooms.length)creep.memory.roomCount = 0;

            if(!creep.memory.targetRoom || creep.room.name == creep.memory.targetRoom){
                creep.memory.targetRoom = creep.memory.tagRooms[creep.memory.roomCount];
                creep.memory.roomCount++
            }
            let deps = creep.room.find(FIND_DEPOSITS).filter(dep => dep.lastCooldown > 25 && dep.ticksToDecay < 49700)[0];
            if(deps){
                if(creep.pos.getRangeTo(deps) >1){
                    creep.travelTo(deps,{range:1});
                }
                else{
                    creep.say(helper.getSay())
                    creep.harvest(deps)
                }
            }
            else{
                //console.log(JSON.stringify(creep.memory.tagRooms[roomCount]))
                creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom))
            }
            return;

        }
        if(creep.memory.job == 'sneak'){
            if(creep.memory.fief == creep.room.name && creep.store.getFreeCapacity() > 0){
                creep.travelTo(creep.room.storage)
                creep.withdraw(creep.room.storage,'metal')
            }
            if(!target && Game.flags && Game.flags.sneak){
                creep.travelTo(Game.flags.sneak.pos)
            }
            else if(target){
                creep.travelTo(target)
                for(let r of Object.keys(creep.store)){
                    creep.transfer(target,r);
                    break;
                }
            }
            if(Game.flags && Game.flags.sneak && Game.flags.sneak.room && Game.flags.sneak.room.name == creep.room.name){
                let hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => crp.store.getCapacity() == 600 && crp.store.getUsedCapacity() == 0)
                let near = creep.pos.findClosestByRange(hostiles);
                if(near && creep.pos.isNearTo(near.pos)){
                    for(let r of Object.keys(creep.store)){
                        creep.transfer(near,r);
                        break;
                    }
                }
            }
            return;
        }
        if(creep.memory.job == 'deposit'){
            if(!creep.memory.workParts)creep.memory.workParts = creep.getActiveBodyparts(WORK);
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(27,28,targetRoom),{range:1});
                return;
            }
            else if(!target){
                let deps = creep.room.find(FIND_DEPOSITS).sort((a,b) => a.lastCooldown - b.lastCooldown)[0]
                if(deps){
                    creep.memory.targetID = deps.id
                }
            }
            else if(creep.store.getUsedCapacity() == 0 && creep.ticksToLive < 100 && (creep.memory.respawn || target.lastCooldown < DEP_MAX_CD)){
                creep.suicide()
            }
            else{
                if(creep.pos.getRangeTo(target) > 1){
                    creep.travelTo(target,{range:1})
                }
                else if(!target.cooldown && creep.store.getFreeCapacity() > creep.memory.workParts){
                    creep.harvest(target);
                    creep.memory.stay = true;
                }
                
            }
            if(creep.store.getUsedCapacity() >= creep.store.getCapacity()*0.8 || creep.ticksToLive < 250){

                addSupplyRequest(creep.room,{type:'pickup',resourceType:Object.keys(creep.store)[0],amount:creep.store.getCapacity(),targetID:creep.id,international:true,priority:8})
            }
            if(!creep.memory.respawn && creep.ticksToLive < 100 && target.lastCooldown < DEP_MAX_CD){
                //spawnCreep('bait','10w5c10m','E19S9',65,{job:'deposit',targetRoom:'E20S9'});
                //spawnCreep('bait','6w10c6m','E28S8',65,{job:'deposit',targetRoom:'E26S10'});
                spawnCreep('bait',creep.body.map(part => part.type),creep.memory.fief,65,{job:'deposit',targetRoom:targetRoom});
                creep.memory.respawn = true;
            }
            return;
        }



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

