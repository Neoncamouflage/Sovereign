const supplyDemand = require('supplyDemand');
const helper = require('functions.helper')
var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let fief = Memory.kingdom.fiefs[creep.memory.fief]
        let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType != STRUCTURE_RAMPART)
        if(creep.memory.status == 'spawning' && !creep.spawning) creep.memory.status = 'travel'
        if(creep.memory.job == 'starterUpgrader' && cSites.length && creep.room.controller.ticksToDowngrade > CONTROLLER_DOWNGRADE[creep.room.controller.level]/2){
            let target;
            if(creep.memory.target) target = Game.getObjectById(creep.memory.target)
            if(!target){
                let targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                target = creep.pos.findClosestByRange(targets)
                if(target){creep.memory.target = target.id}
            }
            if(target && creep.store.getUsedCapacity() > 0) {
                if(creep.pos.getRangeTo(target) > 3){
                    creep.travelTo(target);
                }
                else{
                    creep.build(target);
                }                    
            }

            //Submit order if not close to storage
            if(creep.store.getUsedCapacity() < creep.store.getCapacity()){
                if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2) supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            return;
        }

        let range = creep.pos.getRangeTo(creep.room.controller);
        let chain;
        let chainOrigin;
        let prevOrigin = creep.memory.prevOrigin;
        if(fief.controllerSpots.storage && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > (!prevOrigin || chain == prevOrigin ? 10000 : 50000)){
            chain = 'storage'
            chainOrigin = creep.room.storage
            creep.memory.prevOrigin = 'storage'
        }
        else if(fief.controllerSpots.terminal && creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] > (!prevOrigin || chain == prevOrigin ? 10000 : 50000)){
            chain = 'terminal'
            chainOrigin = creep.room.terminal
            creep.memory.prevOrigin = 'terminal'
        }
        else{
            chain = 'base'
        }
        if(range <=3 && creep.store[RESOURCE_ENERGY] > 0){
            creep.upgradeController(creep.room.controller);
        }
        //console.log(creep,"Origin:",chain)
        if(chainOrigin){
            creep.memory.stay = true
            if(creep.pos.getRangeTo(chainOrigin) !=1 || creep.pos.getRangeTo(creep.room.controller) > 3){
                //console.log('Outta range!')
                rangeLoop:
                for(i=1;i<4;i++){
                    for(let spot of fief.controllerSpots[chain][i]){
                        //No creep means move to that and break the loop
                        //console.log("Checking spot",JSON.stringify(spot))
                        let buddy = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y)[0]
                        if(!buddy){
                            creep.travelTo(new RoomPosition(spot.x,spot.y,creep.room.name));
                            //console.log(creep,"going to spot",JSON.stringify(spot))
                            break rangeLoop;
                        }
                        else if(buddy.id == creep.id)break rangeLoop;
                    }
                }
            }
        }
        else if(fief.controllerSpots.base && range != 1){ //&& (creep.status == 'travel' || Game.time % 10 == 0)
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


        if(!chainOrigin && creep.store.getUsedCapacity() < creep.store.getCapacity()){
            //console.log(creep,'t1')
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
                            let dirRef = {
                                1: '⬆️',
                                2: '↗️',
                                3: '➡️',
                                4: '↘️',
                                5: '⬇️',
                                6: '↙️',
                                7: '⬅️',
                                8: '↖️',
                            }
                            //let words = helper.getSay({symbol:`${dirRef[buddy.pos.getDirectionTo(creep)]}`});
                            //buddy.say(words.join(''))
                            //console.log(buddy.name,buddy.pos,"TRANSFERRING TO",creep.name,creep.pos)
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
            if(!isPacked && creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
        }
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
                            let dirRef = {
                                1: '⬆️',
                                2: '↗️',
                                3: '➡️',
                                4: '↘️',
                                5: '⬇️',
                                6: '↙️',
                                7: '⬅️',
                                8: '↖️',
                            }
                            //let words = helper.getSay({symbol:`${dirRef[buddy.pos.getDirectionTo(creep)]}`});
                            //buddy.say(words.join(''))
                            //console.log(buddy.name,buddy.pos,"TRANSFERRING TO",creep.name,creep.pos)
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