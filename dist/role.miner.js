const helper = require('functions.helper');

var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        const targetRoom = creep.memory.homeRoom
        const harvestID = creep.memory.harvestSpot.id;
        if(!creep.memory.preflight){
            //Memory.kingdom.holdings[targetRoom].sources[harvestID].miner = creep.name;
            creep.memory.preflight = true;
        }
        
        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        let runFlag = false;
        for(each of hostiles){
            if(!Memory.diplomacy.allies.includes(each.owner.username) && !helper.isScout(each)){
                runFlag =true;
            }
        }
        
        //Make sure we have an x and y
        if(!creep.memory.harvestSpot.x || !creep.memory.harvestSpot.y){
            creep.memory.harvestSpot.x = Memory.kingdom.holdings[targetRoom].sources[harvestID].x
            creep.memory.harvestSpot.y = Memory.kingdom.holdings[targetRoom].sources[harvestID].y
        }
        if(creep.room.name != targetRoom){
           let m = creep.travelTo(new RoomPosition(creep.memory.harvestSpot.x, creep.memory.harvestSpot.y, targetRoom));
        }
        else if (runFlag){
            creep.travelTo(new RoomPosition(25,25,Memory.kingdom.holdings[targetRoom].homeRoom))
        }
        else if (creep.pos.x != creep.memory.harvestSpot.x || creep.pos.y != creep.memory.harvestSpot.y) {
            creep.travelTo(new RoomPosition(creep.memory.harvestSpot.x, creep.memory.harvestSpot.y,creep.room.name));
        }
        let target = Game.getObjectById(harvestID);
        //Target seems to go null when out of energy, not sure why
        if(!target || target.energy == 0){
            let spotCan = Game.getObjectById(Memory.kingdom.holdings[targetRoom].sources[harvestID].can);
            if(spotCan && spotCan.hits < spotCan.hitsMax*0.8){
                creep.withdraw(spotCan,'energy');
                creep.repair(spotCan);
            }else if(creep.store[RESOURCE_ENERGY] > 0){
                let site = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES,creep.pos);
                //console.log(site)
                creep.build(site[0]);
            }else{
                //Find energy under creep
                let drops = creep.room.lookForAt(LOOK_ENERGY,creep);
                if(drops.length){
                    creep.pickup(drops[0])
                }
            }
        }
        else if(target.energy > 0){
            let g = creep.harvest(target);
            
                
                
        }
        else{
            
        }
    }
};

module.exports = roleMiner;

