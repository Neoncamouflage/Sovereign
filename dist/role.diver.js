const helper = require('functions.helper');
const registry = require('registry');
const supplyDemand = require('supplyDemand')
var roleDiver = {
    
    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'dig'){
            if(creep.ticksToLive < 200 && !creep.memory.call){
                spawnCreep('diver','25m25w','W21S1',33,{job:'dig'});
                creep.memory.call = true;
            }
            let targetRoom = creep.memory.targetRoom || 'W20S0';
            if(creep.room.name == creep.memory.fief){
                if(creep.memory.boosted){
                    creep.travelTo(new RoomPosition(26,48,targetRoom))
                    return;
                }
                let body = creep.body.filter(part => part.type == WORK && !part.boost);
                //console.log("REAVER",body)
                if(!body.length){
                    creep.memory.boosted = true;
                    creep.travelTo(new RoomPosition(26,48,targetRoom))
                    return;
                }
                let labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'XZH2O' && lab.store['XZH2O'] >30);
                if(!labs.length){
                    labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'ZH2O' && lab.store['ZH2O'] >30);
                    if(!labs.length) creep.memory.boosted = true;
                }
                let tLab = creep.pos.findClosestByRange(labs);
                if(creep.pos.getRangeTo(tLab) == 1){
                    tLab.boostCreep(creep);
                    body = body.filter(part => part.type == WORK && !part.boost);
                    if(!body.length){
                        creep.memory.boosted = true;
                        creep.travelTo(new RoomPosition(26,48,targetRoom));
                    }
                    else{
                        labs = labs.filter(lab => lab.id != tLab.id);
                        tLab = creep.pos.findClosestByRange(labs);
                        if(tLab && creep.pos.getRangeTo(tLab) > 1) creep.travelTo(tLab);
                        return;
                    }
                }
                else{
                    creep.travelTo(tLab)
                }
                return;
            }
            else if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(26,48,targetRoom))
                return;
            }
            if(!creep.memory.targetID || !Game.getObjectById(creep.memory.targetID)){
                for(i=0;i<Memory.season.scoreCollectors[targetRoom].targetWalls.length;i++){
                    let spot = Memory.season.scoreCollectors[targetRoom].targetWalls[i]
                    //console.log("SPOT CHECK",JSON.stringify(spot))
                    let spotCheck = creep.room.lookForAt(LOOK_STRUCTURES,spot.x,spot.y).filter(struct => struct.structureType == STRUCTURE_WALL);
                    //console.log("CHECK",JSON.stringify(spotCheck))
                    if(spotCheck.length){
                        creep.memory.targetID = spotCheck[0].id;
                        break;;
                    }
                }
            }
            let target = Game.getObjectById(creep.memory.targetID);
            if(target && creep.pos.getRangeTo(target) == 1){
                creep.dismantle(target);

                if(!global.reaverTick || Game.time - global.reaverTick > 7 ){
                    global.reaverTick = Game.time;
                    let droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
                    //console.log("Checking drops in",remote.name,"and found",droppedResources.length)
                    //Retrieve current tasks to check against
                    droppedResources.forEach(resource => {
                        const { id, amount, resourceType } = resource;
                
                        //Details object for the addRequest call
                        let details = {
                            type: 'pickup',
                            targetID: id,
                            amount: amount,
                            resourceType: resourceType,
                            international : true,
                            priority: 5
                        };
                        //console.log("Attempting to add",JSON.stringify(details))
                        const taskID = supplyDemand.addRequest(Game.rooms[creep.memory.fief], details);
                        //console.log('Holding added new task:', taskID);
                    });
                }
            }
            else if(target){
                creep.travelTo(target,{maxRooms:1,maxOps:20000});
            }
            return;
        }
        if(creep.memory.job == 'pull'){

        }
        if(creep.memory.job == 'dropoff'){
            let targetRoom = creep.memory.targetRoom;
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                creep.memory.lastRoom = creep.memory.fief;
                creep.memory.role = 'scout'
            }
            return;
            return;
        }
        if(creep.memory.job == 'customScout'){
            let occupied =[
                "The Throne's justice will soon restore order to this land.",
                "Here lies a land soon to be reclaimed by the Crown.",
                "This land trembles in anticipation of the Throne's righteous fury.",
                "Chaos reigns for now, but the Kingdom's order is on the horizon.",
                "A land in turmoil, soon to be pacified under the Crown's iron fist.",
                "This land will one day sing the hymns of the Throne.",
                "Order shall be restored; the Crown's banner will rise over these walls.",
                "The usurper's time is short; the Crown's forces will restore what is lost.",
                "Here stands a bastion of the foolish, blind to the coming storm.",
                "The Sovereign's banners will rise again over this troubled land.",
                "This land's defiance is but a fleeting spark before the Sovereign's storm.",
                "This land's freedom is but a fleeting illusion; the Sovereign will reclaim it.",
                "Under the weight of the Throne, rebellion will crumble into dust.",
                "You dwell in borrowed time. The Sovereign's tide will reclaim all.",
                "A tapestry incomplete, awaiting the Crown's unifying thread.",
            ]
            let targetRoom = creep.memory.targetRoom || 'W29S4'
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                creep.travelTo(creep.room.controller)
                let x = creep.signController(creep.room.controller,occupied[Math.floor(Math.random() * occupied.length)])
                if(x == OK) creep.memory.role = 'scout'
            }
            return;
        }
        else if(creep.memory.job == 'kill'){ //
            let targetRoom = creep.memory.targetRoom
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom))
            }
            else{
                let hostiles = creep.room.find(FIND_HOSTILE_CREEPS)
                if(!hostiles.length) return;
                let target = hostiles[0]
                creep.travelTo(target)
                creep.rangedAttack(target)
                creep.attack(target)
            }
            return;

        }
        creep.respawn();
        if(!creep.memory.targetRoom) creep.memory.targetRoom = 'E37S11'
        drainRoom(creep)
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

