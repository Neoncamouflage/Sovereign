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
        let targetRoom = creep.memory.targetRoom || 'W20S0'
        if(creep.memory.job == 'score'){
            if(creep.store.getUsedCapacity()==0){

                if(creep.room.name == creep.memory.fief){
                    if(creep.room.terminal && creep.room.terminal.store[RESOURCE_SCORE] > 0){
                        creep.travelTo(creep.room.terminal);
                        creep.withdraw(creep.room.terminal,RESOURCE_SCORE)
                        return;
                    }
                    creep.travelTo(creep.room.storage);
                    creep.withdraw(creep.room.storage,RESOURCE_SCORE)
                    return;
                }
                else{
                    let cans = creep.room.find(FIND_SCORE_CONTAINERS);
                    if(cans.length){
                        creep.travelTo(cans[0]);
                        if(creep.pos.getRangeTo(cans[0])){
                            creep.withdraw(cans[0],RESOURCE_SCORE)
                        }
                        return;
                    }
                    if(creep.ticksToLive < 200 || (creep.memory.fief != 'W21S1' && creep.ticksToLive < 300)) {
                        spawnCreep('bait','25m25c',creep.memory.fief,33,{job:'score',targetRoom:'W20S0'});
                        creep.suicide();
                        
                    }
                    creep.travelTo(Game.rooms[creep.memory.fief].storage);
                    return;
                }
            }
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(28,21,targetRoom),{maxOps:20000,maxRooms:64,preferHighway:true});
            }
            else{
                let collector = creep.room.find(FIND_SCORE_COLLECTORS)[0]
                if(!collector) return
                creep.travelTo(collector,{maxOps:20000});
                let g = creep.transfer(collector,RESOURCE_SCORE);
                }
            return;
        }
        if(creep.memory.job == 'mirScore'){
            targetRoom = 'W30N10';
            if(creep.store.getUsedCapacity()==0){

                if(creep.room.name == creep.memory.fief){
                    if(creep.room.storage.store[RESOURCE_SCORE] > 0){
                        creep.travelTo(creep.room.storage);
                        creep.withdraw(creep.room.storage,RESOURCE_SCORE)
                        return;
                    }
                    else if(creep.room.terminal.store[RESOURCE_SCORE] > 0){
                        creep.travelTo(creep.room.terminal);
                        creep.withdraw(creep.room.terminal,RESOURCE_SCORE)
                        return;
                    }

                }
                else{
                    let cans = creep.room.find(FIND_SCORE_CONTAINERS);
                    if(cans.length){
                        creep.travelTo(cans[0]);
                        if(creep.pos.getRangeTo(cans[0])){
                            creep.withdraw(cans[0],RESOURCE_SCORE)
                        }
                        return;
                    }
                    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES).filter(r=>r.resourceType == RESOURCE_SCORE && r.amount > 100);
                    if(droppedResources.length){
                        creep.travelTo(droppedResources[0]);
                        if(creep.pos.getRangeTo(droppedResources[0])){
                            creep.pickup(droppedResources[0])
                        }
                        return;
                    }
                    if(creep.ticksToLive < 350) {
                        spawnCreep('bait','25m25c','W30N10',33,{job:'mirScore',targetRoom:'W30N10'});
                        creep.suicide();
                        
                    }
                    creep.travelTo(Game.rooms[creep.memory.fief].storage);
                    return;
                }
            }
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(28,38,targetRoom),{maxOps:20000,maxRooms:64});
            }
            else{
                let collector = creep.room.find(FIND_SCORE_COLLECTORS)[0]
                if(!collector) return
                creep.travelTo(collector,{maxOps:20000});
                let g = creep.transfer(collector,RESOURCE_SCORE);
                }
            return;
        }
        if(creep.memory.job == 'dakScore'){
            targetRoom = 'W30S0'
            if(creep.store.getUsedCapacity()==0){

                if(creep.room.name == creep.memory.fief){
                    if(creep.room.terminal && creep.room.terminal.store[RESOURCE_SCORE] > 0){
                        creep.travelTo(creep.room.terminal);
                        creep.withdraw(creep.room.terminal,RESOURCE_SCORE)
                        return;
                    }
                    creep.travelTo(creep.room.storage);
                    creep.withdraw(creep.room.storage,RESOURCE_SCORE)
                    return;
                }
                else{
                    let cans = creep.room.find(FIND_SCORE_CONTAINERS);
                    if(cans.length){
                        creep.travelTo(cans[0]);
                        if(creep.pos.getRangeTo(cans[0])){
                            creep.withdraw(cans[0],RESOURCE_SCORE)
                        }
                        return;
                    }
                    if(creep.ticksToLive < 300) {
                        spawnCreep('bait','25m25c','W27N3',33,{job:'dakScore',targetRoom:'W30S0'});
                        creep.suicide();
                        
                    }
                    creep.travelTo(Game.rooms[creep.memory.fief].storage);
                    return;
                }
            }
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(28,21,targetRoom),{maxOps:20000,maxRooms:64,preferHighway:true});
            }
            else{
                let collector = creep.room.find(FIND_SCORE_COLLECTORS)[0]
                if(!collector) return
                creep.travelTo(collector,{maxOps:20000});
                let g = creep.transfer(collector,RESOURCE_SCORE);
                }
            return;
        }
        if(creep.memory.job == 'gopher'){
            if(!creep.memory.step)creep.travelTo(new RoomPosition(20,13,'W25S0'))
            else if(!creep.memory.step2)creep.travelTo(new RoomPosition(48,26,'W26S2'))
            else{creep.travelTo(new RoomPosition(14,15,'W23S3'))}
            if(creep.room.name == 'W25S0') creep.memory.step = true;
            if(creep.room.name == 'W26S2') creep.memory.step2 = true;
            if(creep.room.name != 'W23S3') return;
            creep.memory = {fief:creep.room.name,targetRoom:creep.room.name,job:'remote',role:'generalist',homeRoom:'creep.room.name'}
            return;
            
        }
        if(creep.store.getFreeCapacity() > 0){
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom));
                return;
            }
            let targets = creep.room.find(FIND_HOSTILE_CREEPS)
                .filter(crp => crp.store.getUsedCapacity() > 0)
                .sort((a, b) => a.store.getFreeCapacity() - b.store.getFreeCapacity());
            if(!targets.length) return;
            let target = targets[0]

            if(target.store.getFreeCapacity() < 200){
                creep.travelTo(target);
                creep.rangedAttack(target);
                creep.attack(target);
                for (let direction of directions) {
                    const pos = new RoomPosition(
                        creep.pos.x + direction.x,
                        creep.pos.y + direction.y,
                        creep.room.name
                    );
                
                    const resources = pos.lookFor(LOOK_RESOURCES);
                
                    if (resources.length > 0) {
                        creep.pickup(resources[0]);
                        break;  // Pick up the first resource found and exit the loop
                    }
                }
            }
            else{
                creep.travelTo(target)
            }

        }
        else{
            if(creep.pos.getRangeTo(Game.rooms[creep.memory.fief].storage > 1)){
                creep.travelTo(Game.rooms[creep.memory.fief].storage);
            }
            else{
                for(let resType in creep.store){
                    creep.transfer(creep.room.storage,resType)
                }
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

