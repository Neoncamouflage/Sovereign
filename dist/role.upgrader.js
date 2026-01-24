const supplyDemand = require('supplyDemand');
const helper = require('functions.helper')
var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let fief = Memory.kingdom.fiefs[creep.memory.fief]
        let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType != STRUCTURE_RAMPART)
        //Pick up boosts if available, this applies to all upgraders
        if(creep.room.controller.level >= 6 && !creep.memory.boosted){
            let body = creep.body.filter(part => part.type == WORK && !part.boost);
            //console.log("REAVER",body)
            if(!body.length){
                creep.memory.boosted = true;
                return;
            }
            let labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'XGH2O' && lab.store['XGH2O'] >30);
            if(!labs.length){
                labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'GH2O' && lab.store['GH2O'] >30);      
            }
            if(!labs.length){
                //labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'LH' && lab.store['LH'] >30);      
            }
            if(!labs.length) creep.memory.boosted = 'nolabs';
            else{
                let tLab = creep.pos.findClosestByRange(labs);
                if(creep.pos.getRangeTo(tLab) == 1){
                    tLab.boostCreep(creep);
                    body = body.filter(part => part.type == WORK && !part.boost);
                    if(!body.length){
                        creep.memory.boosted = true;
                    }
                    else{
                        labs = labs.filter(lab => lab.id != tLab.id);
                        tLab = creep.pos.findClosestByRange(labs);
                        if(tLab && creep.pos.getRangeTo(tLab) > 1){
                            creep.travelTo(tLab);
                            return;
                        }
                        
                    }
                }
                else{
                    creep.travelTo(tLab)
                    return; 
                }
                
            }

        }
        //Instructions for initial room upgraders to help build when needed
        if(creep.memory.job == 'starterUpgrader' && cSites.length && creep.room.controller.ticksToDowngrade > CONTROLLER_DOWNGRADE[creep.room.controller.level]/2 && !creep.memory.scribeFirst){
            let target;
            if(creep.memory.target) target = Game.getObjectById(creep.memory.target)
            if(!target || target instanceof Structure){
                let targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                target = creep.pos.findClosestByRange(targets)
                if(target){creep.memory.target = target.id}
            }
            creep.memory.stay = false;
            if(target && creep.store.getUsedCapacity() > 0) {
                if(creep.pos.getRangeTo(target) > 3){
                    creep.travelTo(target);
                }
                else{
                    creep.build(target);
                }                    
            }

            //Submit order if not close to storage
            if(target && creep.pos.getRangeTo(target) <= 6 && creep.store.getUsedCapacity() < creep.store.getCapacity()){
                if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2) supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            return;
        }
        else if(creep.memory.job == 'starterUpgrader' && !cSites.length && creep.ticksToLive >= 1450) creep.memory.scribeFirst = true
        if(creep.memory.job == 'starterUpgrader' && (!creep.room.controller.sign || creep.room.controller.sign !='🏰') && creep.pos.getRangeTo(creep.room.controller) == 1) creep.signController(creep.room.controller,'🏰')
        creep.memory.target = creep.room.controller.id;
            //If the creep is spawned in a different room, or somehow accidentally leaves, it should go to its home fief before doing anything else from this point
        if(creep.room.name != creep.memory.fief){
            let targetPos;
            if(Game.rooms[creep.memory.fief]) targetPos = Game.rooms.controller
            else targetPos = new RoomPosition(25,25,creep.memory.fief);
            return;
        }
        let range = creep.pos.getRangeTo(creep.room.controller);
        let chain;
        let chainOrigin;
        let prevOrigin = creep.memory.prevOrigin;
        //Prefer to chain energy from terminal, else storage, else use the base chaining system.
        if(fief.controllerSpots.terminal && creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] > (!prevOrigin || chain == prevOrigin ? 5000 : 10000)){
            chain = 'terminal'
            chainOrigin = creep.room.terminal
            creep.memory.prevOrigin = 'terminal'
        }
        else if(fief.controllerSpots.storage && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > (!prevOrigin || chain == prevOrigin ? 5000 : 10000)){
            chain = 'storage'
            chainOrigin = creep.room.storage
            creep.memory.prevOrigin = 'storage'
        }
        else {
            chain = 'base'
        }
        
        //Always take the upgrade action if we can.
        if(range <=3 && creep.store[RESOURCE_ENERGY] > 0){
            creep.upgradeController(creep.room.controller);
        }
        //A valid chain origin means we execute the logic to pull from that source and chain the energy out to other creeps
        if(chainOrigin){
            //creep.memory.stay = true //Tells other creeps not to push us out of this spot
            //Always look if we can move closer, and do so if there's a spot.
            if(creep.pos.getRangeTo(chainOrigin) != 1 || creep.pos.getRangeTo(creep.room.controller) > 3){
                rangeLoop:
                for(i=1;i<4;i++){
                    for(let spot of fief.controllerSpots[chain][i]){
                        //No creep means move to that and break the loop
                        let buddy = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y)[0]
                        if(!buddy){
                            creep.travelTo(new RoomPosition(spot.x,spot.y,creep.room.name));
                            break rangeLoop;
                        }
                        else if(buddy.id == creep.id)break rangeLoop;
                    }
                }
            }
        }
        //No origin means we stack up in front of the controller and chain energy inward as it's delivered to those on the outside
        else if(fief.controllerSpots.base && range != 1){
            creep.memory.stay = true;
            rangeLoop:
            for(i=1;i<Math.min(4,range);i++){
                for(let spot of fief.controllerSpots[chain][i]){
                    //No creep means move to that and break the loop
                    if(!creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y).length){
                        creep.travelTo(new RoomPosition(spot.x,spot.y,creep.room.name));
                        break rangeLoop;
                    }
                }
            }
        }

        //Base logic for chaining energy inward
        if(!chainOrigin && creep.store.getUsedCapacity() < creep.store.getCapacity()){
            let gotTransfer = false;
            let isPacked = false;
            if(range < 3){
                for(let spot of fief.controllerSpots[chain][range+1]){
                    //No creep means move to that and break the loop
                    let search = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                    if(search.length){
                        let buddy = search[0]
                        if(buddy.my && buddy.pos.isNearTo(creep) &&  (buddy.memory.role == 'upgrader' || buddy.memory.status == 'upgrading') && !buddy.transferring){
                            buddy.transfer(creep,RESOURCE_ENERGY);
                            buddy.transferring = true;
                            gotTransfer = true;
                            break;
                        }
                    }
                    else{
                        isPacked = false;
                    }
                }
            }
            if(gotTransfer) return;
            if(range < 6 && !isPacked && creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
        }
        //Storage/terminal logic for chaining energy outward
        else {
            let gotTransfer = false;
            let storeRange = creep.pos.getRangeTo(chainOrigin)
            if(storeRange == 1){

                if(storeRange == 1){
                    creep.withdraw(chainOrigin,RESOURCE_ENERGY)
                    return;
                }
            }
            else if(range < 3 && creep.store.getUsedCapacity() < creep.store.getCapacity()*(1.0-(storeRange/10))){
                for(let spot of fief.controllerSpots[chain][storeRange-1]){
                    //No creep means move to that and break the loop
                    let search = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                    if(search.length){
                        let buddy = search[0]
                        if(buddy.my && buddy.pos.isNearTo(creep) &&  (buddy.memory.role == 'upgrader' || buddy.memory.status == 'upgrading') && !buddy.transferring){
                            buddy.transfer(creep,RESOURCE_ENERGY);
                            buddy.transferring = true;
                            gotTransfer = true;
                            break;
                        }
                    }
                    else{
                        isPacked = false;
                    }
                }
            }
            if(gotTransfer) return;
        }
        return;  
    }
};

module.exports = roleUpgrader;