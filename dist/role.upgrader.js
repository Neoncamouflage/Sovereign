const supplyDemand = require('supplyDemand');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType != STRUCTURE_RAMPART)
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
        
        if(range > 2 && creep.store.getUsedCapacity() > 0){
            creep.travelTo(creep.room.controller,{range:1});
        }
        if(range < 4){
            creep.upgradeController(creep.room.controller)
        }
        if(creep.store.getUsedCapacity() < creep.store.getCapacity() ){
            if(!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5){
                if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2)supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getFreeCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
            else if(creep.store.getUsedCapacity() == 0){
                if(creep.room.storage){
                    let range = creep.pos.getRangeTo(creep.room.storage);
                    if(range == 1){
                        creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                    }
                    else if(range < 5){
                        creep.travelTo(creep.room.storage)
                    }
                }
            }
        }
        return;  
        let fief = Memory.kingdom.fiefs[creep.room.name];
        let upcan;
        if(fief.upLink){
            creep.memory.link = true;
            upCan = Game.getObjectById(fief.upLink)
        }else{
            upCan = Game.getObjectById(fief.upCan)
        }
        let upLink;
        if(fief.links && fief.links.upLink){
            upLink = Game.getObjectById(fief.links.upLink);
        }
        if(creep.ticksToLive <= 10){
            if(creep.pos.x == upCan.pos.x && creep.pos.y == upCan.pos.y){ 
                creep.suicide()
            }
            else{
                creep.travelTo(new RoomPosition(upCan.pos.x,upCan.pos.y,creep.room.name))
            }
        }
        else{   
            if(upLink && upLink.store[RESOURCE_ENERGY] > 0){
                if(creep.withdraw(upLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                    creep.travelTo(upLink);
                }
            }
            else if(creep.withdraw(upCan, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
                creep.travelTo(upCan);
            }
            if(creep.pos.getRangeTo(creep.room.controller) > 1){
                creep.travelTo(creep.room.controller,{range:1});
            }
            creep.upgradeController(creep.room.controller)
        }
    }
};

module.exports = roleUpgrader;