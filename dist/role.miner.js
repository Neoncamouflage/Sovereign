const helper = require('functions.helper');

var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        const targetRoom = Game.getObjectById(creep.memory.holding);
        const targetID = creep.memory.target;
        const fief = Memory.kingdom.fiefs[creep.memory.fief]
        const targetSource = Game.getObjectById(creep.memory.target);
        const holding = Memory.kingdom.holdings[creep.memory.holding];
        const can = holding.sources[targetID].can && Game.getObjectById(holding.sources[targetID].can)
        if(!creep.memory.preflight){
            //Memory.kingdom.holdings[targetRoom].sources[harvestID].miner = creep.name;
            creep.memory.preflight = true;
        }

        //If alarming, get to safety
        if(global.heap.alarms[creep.memory.holding]){     
            if(creep.room.name != creep.memory.fief){
                creep.memory.stay = false;
                creep.memory.status = 'flee';
                creep.travelTo(Game.rooms[creep.memory.fief].controller)
                let words = helper.getSay({symbol:`${Game.time % 2 == 0 ? '🚨' : '📢'}`});
                creep.say(words.join(''))
            }
            else{
                //console.log("AYE")
                if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                    //console.log("TWO")
                    creep.travelTo(Game.rooms[creep.memory.fief].controller);
                }
            }
            return;
        }

        //Otherwise move to position
        if(creep.memory.status != 'harvesting'){
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
                        for(let spot of holding.sources[targetID].openSpots){
                            let crps = creep.room.lookForAt(LOOK_CREEPS,spot.x,spot.y);
                            console.log("CHECKING SPOT",JSON.stringify(spot),"CRPS",crps.length,JSON.stringify(crps))
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
                    }     
                }
                else{
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.holding),{range:10});
                    return;
                }
            }
        }

        //If there's a source, harvest if energy. If no energy, repair can if there
        if(targetSource){
            if(targetSource.energy > 0){
                creep.harvest(targetSource);
            }
            else if(can){
                if(can.hits < can.hitsMax * 0.9){
                    creep.repair(can);
                    let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                    //Pickup loose energy if available, otherwise withdraw
                    if(resSpot.length) creep.pickup(resSpot[0])
                    else{
                        creep.withdraw(can,RESOURCE_ENERGY);
                    }
                    
                }
            }
            //If no can and home RCL is 4+ and we're a big creep, build one
            else if(Game.rooms[creep.memory.fief].controller.level > 4){
                if(creep.getActiveBodyparts(WORK) >=5){
                    let cSite = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES,creep.pos)
                    if(!cSite.length){
                        let canSpot = creep.room.lookForAt(LOOK_STRUCTURES,creep.pos).filter(struct => struct.structureType == STRUCTURE_CONTAINER)
                        if(canSpot.length){
                            holding.sources[targetID].can = canSpot[0].id
                        }
                        else{
                            creep.room.createConstructionSite(creep.pos,STRUCTURE_CONTAINER) 
                        }
                    }
                    else{
                        creep.build(cSite[0])
                        let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                        if(resSpot.length) creep.pickup(resSpot[0])
                    }
                }
            }
        }
    }
};

module.exports = roleMiner;

