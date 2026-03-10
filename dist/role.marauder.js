const helper = require('functions.helper');

const roleMarauder = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
            creep.memory.preflight = true;
        }
        if(!creep.memory.targetRoom)creep.memory.targetRoom = getNewRemote(creep.room.name);
        var targetRoom = creep.memory.targetRoom;
        let attk = creep.getActiveBodyparts(ATTACK);
        let rng = creep.getActiveBodyparts(RANGED_ATTACK);
        let closeRange = attk && !rng;
        let targets = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp))
        let priorityTargets = targets.filter(crp => helper.isSoldier(crp))
        let roomTargets = targets.filter(crp => ![0,49].includes(crp.pos.x) && ![0,49].includes(crp.pos.y))
        let target;
        if(creep.room.controller && creep.room.controller.safeMode){
            targets = [];
            priorityTargets = [];
            roomTargets = []
        }
        if(priorityTargets.length){
            target = creep.pos.findClosestByRange(priorityTargets)
        }
        else{
            target = roomTargets.length ? creep.pos.findClosestByRange(roomTargets) : creep.pos.findClosestByRange(targets)
        }
        let targetRange = Infinity;
        if(target)targetRange = creep.pos.getRangeTo(target);
        if(closeRange){
            if(priorityTargets.length && creep.room.name == targetRoom){
                creep.say(LANGUAGE.flee)
                creep.memory.targetRoom = getNewRemote(creep.room.name);
                delete creep.memory.targetTick;
                creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
                if(targetRange == 1)creep.attack(target);
            }
            else if(target && (creep.room.name == targetRoom || creep.pos.getRangeTo(target) < 3)) {
                if(creep.room.name == targetRoom)creep.memory.targetTick = Game.time;
                 
                //Change targets periodically, only after we made it to the first room
                if(creep.memory.targetTick && Game.time - creep.memory.targetTick > 150){
                    creep.say(LANGUAGE.newTarget)
                    creep.memory.targetRoom = getNewRemote(creep.room.name);
                    delete creep.memory.targetTick;
                    creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
                    if(targetRange == 1)creep.attack(target);
                }
                else{
                    if(targetRange <= 1){
                        creep.say(LANGUAGE.attack)
                        creep.attack(target);
                    }
                    //If the target is on the edge of the room, move using range 1
                    if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y)){
                        if(creep.memory.edgeFight){
                            creep.memory.edgeFight = false;
                            creep.travelTo(target,{ignoreRoads:true});
                        }
                        else{
                            creep.travelTo(target,{ignoreRoads:true});
                        }
                        
                    }
                    else{
                        creep.travelTo(target,{ignoreRoads:true,range:1});
                        creep.memory.edgeFight = true;
                    }
                }
            }
            else if(targetRoom && creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true});
            }
            else if(targetRoom && creep.room.name == targetRoom){
                creep.memory.targetRoom = getNewRemote(creep.room.name);
                delete creep.memory.targetTick;
                creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
                if(target && creep.pos.getRangeTo(target) == 1)creep.attack(target);
            }
            let structTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL&& structure.structureType != STRUCTURE_CONTAINER
            });
            let myRoom = Object.keys(Memory.kingdom.holdings).includes(creep.room.name) || Object.keys(Memory.kingdom.fiefs).includes(creep.room.name);
            let targetStruct = creep.pos.findClosestByRange(structTargets);
            if(!target && creep.room.name == targetRoom && !myRoom){
                if(targetStruct && creep.pos.getRangeTo(targetStruct) > 1){
                    let y = creep.travelTo(targetStruct,{ignoreRoads:true});
                }
                else if(targetStruct){
                    creep.attack(targetStruct);
                }
                else{
                    let cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                    if(cSites.length){
                        let cTarget = creep.pos.findClosestByRange(cSites);
                        creep.travelTo(cTarget)
                    }
    
                }
            }
            else if(!myRoom && creep.pos.getRangeTo(target) > 1){
                if(creep.pos.getRangeTo(targetStruct) <= 1)creep.attack(targetStruct);
            }
        }
        
    }
}

function getNewRemote(currentRoom,harassTarget){
    //Temporary for SWC, replace with a ledger search for remote targets
    remoteOptions = ['W6N61','W4N61'];
    let distances = []
    for(let each of remoteOptions){
        if(each != currentRoom)distances.push({dist:Game.map.getRoomLinearDistance(currentRoom,each),roomName:each});
    }
    distances.sort((a,b) => b.dist - a.dist)
    return randomChoice(distances);
    //Prefer much closer options if not doing a first pick
    if(Memory.kingdom.fiefs[currentRoom]){
        return randomChoice([distances[1].roomName,distances[2].roomName,distances[3].roomName,distances[4].roomName,distances[5].roomName])
    }else{
        return randomChoice([distances[1].roomName,distances[2].roomName,distances[3].roomName])
    }
    

}

module.exports = roleMarauder;