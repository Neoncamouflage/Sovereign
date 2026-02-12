const helper = require('functions.helper');

var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        const targetRoom = Game.getObjectById(creep.memory.holding);
        const targetID = creep.memory.target;
        const fief = Memory.kingdom.fiefs[creep.memory.fief]
        const targetSource = Game.getObjectById(creep.memory.target);
        const holding = Memory.kingdom.holdings[creep.memory.holding];
        if(!holding){
            //If we've converted to a fief
            if(Memory.kingdom.fiefs[creep.memory.holding]){
                creep.memory.role = 'settler';
                creep.memory.targetRoom = creep.memory.holding
            }
            else{
                return;
            }
        }
        let can;
        try{
             can = holding.sources[targetID].can && Game.getObjectById(holding.sources[targetID].can)
        }
        catch(error){
            chronicle.log(`Unable to get can: ${error}`,'role.miner',1)
            return;
        }
        if(!creep.memory.preflight){
            //Memory.kingdom.holdings[targetRoom].sources[harvestID].miner = creep.name;
            creep.memory.preflight = true;
        }

        //If alarming, get to safety
        if(global.heap.alarms[creep.memory.holding]){     
            let baddies = creep.room.find(FIND_HOSTILE_CREEPS).filter(c=>helper.isSoldier(c) && !isFriend(c))
            let bad = creep.pos.findClosestByRange(baddies)
            if(creep.memory.holding != creep.room.name || (bad && creep.pos.getRangeTo(bad) < 7)){
                if(creep.room.name != creep.memory.fief){
                    creep.memory.stay = false;
                    creep.memory.status = 'flee';
                    creep.drop(RESOURCE_ENERGY)
                    creep.travelTo(Game.rooms[creep.memory.fief].controller)
                    let words = helper.getSay({symbol:`${Game.time % 2 == 0 ? '🚨' : '📢'}`});
                    creep.say(words.join(''))
                }
                else{
                    //console.log("AYE")
                    if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                        creep.travelTo(Game.rooms[creep.memory.fief].controller);
                    }
                }
                return;
            }

        }

        //Otherwise move to position
        if(creep.memory.status != 'harvesting'){
            /*if(creep.memory.doRepair){
                if(!creep.memory.filled && creep.room.name == creep.memory.fief && creep.store[RESOURCE_ENERGY] == 0){
                    if(creep.pos.getRangeTo(creep.room.storage) > 1){
                        creep.travelTo(creep.room.storage);
                        return;
                    }
                    else{
                        creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                        creep.memory.filled = true;
                    }
                }
                if(creep.room.name != creep.memory.fief && creep.store[RESOURCE_ENERGY]){
                    let badRoad = creep.pos.lookFor(LOOK_STRUCTURES).filter(str => str.structureType == STRUCTURE_ROAD)[0];
                    if(badRoad && badRoad.hits < (badRoad.hitsMax*0.9)){
                        creep.repair(badRoad);
                    }
                    else{
                        let cRoads = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                        if(cRoads.length){
                                let cTarget = creep.pos.findClosestByRange(cRoads)
                                if(creep.pos.getRangeTo(cTarget) <= 3) creep.repair(cTarget);
                        }
                    }
                }

            }*/
            //Large creeps want their spot. Small creeps just go to the source.
            //Large creeps are immobile once placed, small are not
            if(creep.getActiveBodyparts(WORK) >=5){
                let pathSpot = holding.sources[targetID].path[holding.sources[targetID].path.length-1]
                let targetSpot = new RoomPosition(pathSpot.x,pathSpot.y,creep.memory.holding);
                if(creep.pos.isEqualTo(targetSpot)){
                    creep.memory.status = 'harvesting';
                    creep.memory.stay = true;
                }else{
                    creep.travelTo(targetSpot);
                    return;
                }
            }
            else{
                if(targetSource){
                    if(creep.pos.getRangeTo(targetSource) ==1){
                        creep.memory.status = 'harvesting';
                        creep.memory.stay = true;
                    }
                    else{
                        let openSpots = holding.sources[targetID].openSpots;
                        for(let spot of openSpots){
                            let crps = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                            //console.log("CHECKING SPOT",JSON.stringify(spot),"CRPS",crps.length,JSON.stringify(crps))
                            if(!crps.length){
                                if(creep.room.name == creep.memory.holding){
                                    creep.travelTo(new RoomPosition(spot.x,spot.y,spot.roomName),{maxRooms:1});
                                }
                                else{
                                    creep.travelTo(new RoomPosition(spot.x,spot.y,spot.roomName));
                                }
                                return;
                            }
                        }
                        //If no open spots, just go to range 2 and wait 
                        creep.travelTo(new RoomPosition(openSpots[0].x,openSpots[0].y,openSpots[0].roomName),{range:2});
                        return
                    }     
                }
                else{
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.holding),{range:10});
                    return;
                }
            }
        }

        
        if(targetSource){
            //Harvest energy if it's regenerated and we don't need to repair a container up to minimum
            //Only do so if we have energy currently in our store, otherwise we get stuck with no energy and no harvesting
            if(targetSource.energy > 0 && (!can || (can && (can.hits > can.hitsMax * 0.1 || !creep.store[RESOURCE_ENERGY])))){
                creep.harvest(targetSource);
            }
            //If no energy, repair the container.
            else if(can){
                if(can.hits < can.hitsMax * 0.9){
                    creep.repair(can);
                    creep.repping = true;
                    let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                    //Pickup loose energy if available, otherwise withdraw
                    if(resSpot.length) creep.pickup(resSpot[0])
                    else{
                        creep.withdraw(can,RESOURCE_ENERGY);
                    }
                    
                }
                else{
                    let cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                    if(cSites.length){
                        let targetSite = creep.pos.findClosestByRange(cSites);
                        if(creep.pos.getRangeTo(targetSite) <=3) creep.build(targetSite);
                        creep.repping = true;
                    }
                }
            }
            //If no can and home RCL is 4+ and we're a big creep, build one
            else if(Game.rooms[creep.memory.fief].controller.level >= 4){
                if(creep.getActiveBodyparts(WORK) >=5){
                    let cSite = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES,creep.pos)
                    if(!cSite.length){
                        let canSpot = creep.room.lookForAt(LOOK_STRUCTURES,creep.pos)
                        if(canSpot.length){
                            for(let struct of canSpot){
                                if(struct.structureType == STRUCTURE_CONTAINER) holding.sources[targetID].can = struct.id
                            }
                            
                        }
                        else{
                            creep.room.createConstructionSite(creep.pos,STRUCTURE_CONTAINER) 
                        }
                    }
                    else{
                        creep.build(cSite[0])
                        creep.repping = true;
                    }
                }
            }
        }
        //Get energy for repairing
        if(creep.repping){
            //Check container for energy first
            if(can && can.store && can.store[RESOURCE_ENERGY] > 0){
                creep.withdraw(can,RESOURCE_ENERGY)
            }
            //Safety check in case the container is bad
            else if(can && !can.store){
                if(can.structureType && can.structureType != STRUCTURE_CONTAINER){
                    delete holding.sources[targetID].can
                }
            }
            //If no container, check resources on the ground
            else{
                let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                if(resSpot.length){
                    creep.pickup(resSpot[0]);
                }
            }
        }
    }
};

module.exports = roleMiner;

