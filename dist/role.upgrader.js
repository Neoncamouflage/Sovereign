const supplyDemand = require('supplyDemand');
const helper = require('functions.helper')
var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let fief = Memory.kingdom.fiefs[creep.memory.fief]
        let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType != STRUCTURE_RAMPART)
        if(creep.memory.status == 'spawning' && !creep.spawning) creep.memory.status = 'travel'
        if(creep.memory.job != 'starterUpgrader' && cSites.length && creep.room.controller.ticksToDowngrade > CONTROLLER_DOWNGRADE[creep.room.controller.level]/2){
           
            creep.memory.role = 'builder';

        }
        else if(cSites.length && creep.room.controller.ticksToDowngrade > CONTROLLER_DOWNGRADE[creep.room.controller.level]/2){
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
        if(range <=3){
            creep.upgradeController(creep.room.controller);
            creep.memory.stay = true;
        }
        else{
            creep.memory.stay = false;
        }
        //If we're not at range one, see if we can move closer
        if(range != 1){ //&& (creep.status == 'travel' || Game.time % 10 == 0)
            rangeLoop:
            for(i=1;i<Math.min(4,range);i++){
                for(let spot of fief.controllerSpots[i]){
                    //No creep means move to that and break the loop
                    if(!creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y).length){
                        creep.travelTo(new RoomPosition(spot.x,spot.y,creep.room.name));
                        break rangeLoop;
                    }
                }
            }
        }
        if(creep.store.getUsedCapacity() < creep.store.getCapacity()*0.8){
            let gotTransfer = false;
            let isPacked = true;
            if(range < 3){
                transferLoop:
                for(i=range+1;i<=3;i++){
                    if(gotTransfer)break;
                    for(let spot of fief.controllerSpots[i]){
                        //No creep means move to that and break the loop
                        let search = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                        if(search.length){
                            let buddy = search[0]
                            if(buddy.my && buddy.pos.isNearTo(creep) &&  (buddy.memory.role == 'upgrader' || buddy.memory.status == 'upgrading') && buddy.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !buddy.transferring){
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
                                break transferLoop;
                            }
                        }
                        else{
                            isPacked = false;
                        }
                    }
                }
            }
            if(gotTransfer) return;
            if(!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5){
                if(creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] > 0){
                    let tRange = creep.pos.getRangeTo(creep.room.terminal);

                    if(tRange <= 5){
                        if(tRange == 1){
                            creep.withdraw(creep.room.terminal,RESOURCE_ENERGY);
                        }
                        else if(creep.store.getUsedCapacity() == 0){
                            creep.travelTo(creep.room.terminal)
                        }
                    }
                    else if(!isPacked && creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
                }
                else if(!isPacked && creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            else{
                if(creep.room.storage){
                    let storageRange = creep.pos.getRangeTo(creep.room.storage);
                    if(creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] > 0){
                        let tRange = creep.pos.getRangeTo(creep.room.terminal);

                        if(tRange <= storageRange){
                            if(tRange == 1){
                                creep.withdraw(creep.room.terminal,RESOURCE_ENERGY);
                            }
                            else if(creep.store.getUsedCapacity() == 0){
                                creep.travelTo(creep.room.terminal)
                            }
                        }
                        else if(storageRange == 1){
                            creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                        }
                        else if(creep.store.getUsedCapacity() == 0){
                            creep.travelTo(creep.room.storage)
                        }
                    }
                    else if(storageRange == 1){
                        creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                    }
                    else if(creep.store.getUsedCapacity() == 0){
                        creep.travelTo(creep.room.storage)
                    }
                }
            }
        }
        return;  
    }
};

module.exports = roleUpgrader;