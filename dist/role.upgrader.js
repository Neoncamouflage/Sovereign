const supplyDemand = require('supplyDemand');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let fief = Memory.kingdom.fiefs[creep.memory.fief]
        let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType != STRUCTURE_RAMPART)
        if(creep.memory.status == 'spawning' && !creep.spawning) creep.memory.status = 'travel'
        if(cSites.length){
           
            let target = cSites[0];
            let range = creep.pos.getRangeTo(target);
            if(range <= 3){
                creep.build(target)
            }
            if(range > 2){
                creep.travelTo(target)
            }
            if(creep.store.getFreeCapacity() > creep.store.getCapacity()*0.2 && range <=5 && creep.room.energyAvailable > creep.room.energyCapacityAvailable/2){
                let x = supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getFreeCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            return;

        }

        let range = creep.pos.getRangeTo(creep.room.controller);
        if(range <=3) creep.upgradeController(creep.room.controller)
        //If we're not at range one, see if we can move closer
        if(range != 1){ //&& (creep.status == 'travel' || Game.time % 10 == 0)
            rangeLoop:
            for(i=1;i<range;i++){
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
            if(range < 3){
                transferLoop:
                for(i=range+1;i<3;i++){
                    for(let spot of fief.controllerSpots[i]){
                        //No creep means move to that and break the loop
                        let search = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                        if(search.length){
                            let buddy = search[0]
                            if((buddy.memory.role == 'upgrader' || buddy.memory.status == 'upgrading') && buddy.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !buddy.transferring){
                                buddy.transfer(creep,RESOURCE_ENERGY);
                                buddy.transferring = true;
                                gotTransfer = true;
                                break transferLoop;
                            }
                        }
                    }
                }
            }
            if(gotTransfer) return;
            if(!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5){
                if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getFreeCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            else if(creep.store.getUsedCapacity() == 0){
                if(creep.room.storage){
                    let storageRange = creep.pos.getRangeTo(creep.room.storage);
                    if(storageRange == 1){
                        creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                    }
                    else if(storageRange < 5){
                        creep.travelTo(creep.room.storage)
                    }
                }
            }
        }
        return;  
    }
};

module.exports = roleUpgrader;