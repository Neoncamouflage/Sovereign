const helper = require('functions.helper');

var roleTrucker = {
    /** @param {Creep} creep **/
    run: function(creep) {
        const canID = creep.memory.canID;
        const fief = Memory.kingdom.fiefs[creep.memory.homeRoom];
        if(!creep.memory.preflight){
            const sourceID = creep.memory.sourceID
            const targetRoom = creep.memory.targetRoom;
            Memory.kingdom.holdings[targetRoom].sources[sourceID].trucker = creep.name;
            creep.memory.preflight = true;
        }

        if(creep.store['energy'] == 0){
            creep.memory.stateFlag = 'pickup';
        }
        else if(creep.store.getFreeCapacity() == 0){
            creep.memory.stateFlag = 'dropoff';
        }
        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: (creep) => {
                return !Memory.diplomacy.allies.includes(creep.owner.username) && !helper.isScout(creep);
            }
        });

        //Check for transfer first
        if(creep.memory.stateFlag == 'dropoff'){
            //let cList = creep.room.lookForAtArea(LOOK_CREEPS,Math.max(creep.pos.y-1,0),Math.max(creep.pos.x-1,0),Math.min(creep.pos.y+1,49),Math.min(creep.pos.x+1,49),true);
            //console.log(JSON.stringify(cList[0].creep.store))
            //let swap = cList.filter(each => each.creep.store.getUsedCapacity() == 0 && Game.getObjectById(each.creep.id).memory.role == 'trucker');
            //console.log(JSON.stringify(swap))
        }

        if(creep.memory.stateFlag == 'pickup'){
            //Clear dropoff destination if needed
            if(creep.memory.destination) delete creep.memory.destination;
            let dead = creep.room.lookForAt(LOOK_RESOURCES,creep.pos.x,creep.pos.y);
            //creep.suicide()
            if(dead){
                creep.pickup(dead[0]);
            }
            if(creep.room.name != creep.memory.targetRoom){
                creep.travelTo(new RoomPosition(creep.memory.pickupSpot[0], creep.memory.pickupSpot[1], creep.memory.targetRoom),{range:1});
            }
            else if (hostiles.length){
                creep.travelTo(new RoomPosition(25,25,creep.memory.homeRoom))
            }
            else{
                //console.log("PICKUP")
                //Make sure pickup spots are good

                let drops = creep.room.lookForAt(LOOK_RESOURCES,creep.memory.pickupSpot[0],creep.memory.pickupSpot[1]);
                
                //if(creep.id == '64848ec714b4db7c96d30a28'){console.log(JSON.stringify(drops))}
                let spotCan = Game.getObjectById(canID);
                //console.log(spotCan)
                if(drops.length && drops[0]['energy'] > 100){
                    //console.log("DROPS")
                    if(creep.pickup(drops[0]) == ERR_NOT_IN_RANGE){
                        creep.travelTo(drops[0],{range:1})
                    }
                }
                else if(spotCan){
                    //console.log(spotCan)
                    //console.log(spotCan)
                    if(creep.withdraw(spotCan,'energy') == ERR_NOT_IN_RANGE){
                        creep.travelTo(spotCan,{range:1});
                    }
                }
                else{
                    creep.travelTo(new RoomPosition(creep.memory.pickupSpot[0],creep.memory.pickupSpot[1],creep.room.name),{range:1})
                    //See if we can set spot can
                    let seeCan = creep.room.lookForAt(LOOK_STRUCTURES,creep.memory.pickupSpot[0],creep.memory.pickupSpot[1]);
                    seeCan.forEach(struct => {
                        if(struct.structureType == STRUCTURE_CONTAINER){
                            creep.memory.canID = struct.id;
                        }
                    })
                }
            }
        }
        else if(creep.memory.stateFlag == 'dropoff'){
            if(creep.room.name != creep.memory.homeRoom){
                creep.travelTo(Game.rooms[creep.memory.homeRoom].storage)
                const structuresToRepair = creep.room.find(FIND_STRUCTURES, {
                                    filter: (structure) => (structure.hits < structure.hitsMax*.8) && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART
                                });
                let repStruct = creep.pos.findClosestByRange(structuresToRepair);
                let x = creep.repair(repStruct);
                if(x!= 0){
                    let buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                    creep.build(buildSite);
                }
            }
            else{
                let remoteLink;
                //If we already know our link, just use it. Otherwise find one if available
                if(creep.memory.remoteLink) remoteLink = Game.getObjectById(creep.memory.remoteLink);
                else if(fief.links){
                    //Map all remote link IDs to gameobjects
                    let remoteLinkArray = fief.links.remoteLinks.map(id => Game.getObjectById(id));
                    //If only one then use it, otherwise find closest
                    if(remoteLinkArray.length == 1){
                        remoteLink = remoteLinkArray[0];
                        creep.memory.remoteLink = remoteLink.id;
                    }else if(remoteLinkArray.length > 1){
                        remoteLink = creep.pos.findClosestByPath(remoteLinkArray);
                        creep.memory.remoteLink = remoteLink.id;
                    }
                }
                let upCan = Game.getObjectById(Memory.kingdom.fiefs[creep.room.name].upCan);
                let roomStore = creep.room.storage;
                let canRange;
                let storeRange;
                let buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                creep.build(buildSite);
                if(upCan && roomStore){
                    canRange = creep.pos.getRangeTo(upCan);
                    storeRange = creep.pos.getRangeTo(roomStore);
                    //If we have a link and queues are created
                    if(remoteLink && global.heap.remoteQueues){
                        //linkHeap has queue and distance
                        //console.log(JSON.stringify(global.heap))
                        let linkHeap = global.heap.remoteQueues[creep.room.name][remoteLink.id]
                        //linkLoads is the total number of operations this link has queued
                        

                        //If the total wait is less than the trip to storage and back, queue up and use the link
                        //Don't want a ton of pathfinding so until we find a good way to get a reusable path and cache it, just use the range

                        //If we haven't made a queue decision
                        if(!creep.memory.destination){
                            let linkLoads = creep.store[RESOURCE_ENERGY];
                            Object.values(linkHeap.queue).forEach(amount =>{
                                linkLoads += amount;
                            });
                            //Divide total amount by the capacity to get the actual number of loads
                            //For now math ceiling it until we get more precise logic
                            //Floor because it can dump the last of it and then leave before cooldown is over
                            linkLoads = Math.floor(linkLoads/remoteLink.store.getCapacity(RESOURCE_ENERGY));
                            //Total current wait time is the link's active cooldown, plus the wait time for all queued loads
                            let totalWait = remoteLink.cooldown + (linkLoads*linkHeap.distance);
                            
                            //Add us to queue if it's worth it
                            //console.log("Total wait",totalWait)
                            //console.log("Store range",storeRange*2)
                            if((storeRange*2) > totalWait){
                                linkHeap.queue[creep.name] = creep.store.getUsedCapacity(RESOURCE_ENERGY);
                                creep.memory.destination = 'link'
                            }
                            //Else continue on to storage
                            else{
                                creep.memory.destination = 'storage';
                            }
                            
                        }
                        //If we are in queue, approach link and use it if we can
                        if (creep.memory.destination == 'link'){
                            //If we're about to die, clear the queue and suicide
                            if(creep.ticksToLive == 1){
                                delete linkHeap.queue[creep.name];
                                creep.suicide();
                            }
                            if(creep.pos.getRangeTo(remoteLink) > 1){
                                creep.travelTo(remoteLink);
                            }
                            else{
                                //console.log("Before transfer")
                                //console.log(creep.store[RESOURCE_ENERGY])
                                //console.log(linkHeap.queue[creep.name])
                                //console.log(remoteLink.store.getFreeCapacity(RESOURCE_ENERGY))
                                let t = creep.transfer(remoteLink,RESOURCE_ENERGY);
                                //console.log("After transfer")
                                //console.log(creep.store[RESOURCE_ENERGY])
                                //console.log(linkHeap.queue[creep.name])
                                //console.log(remoteLink.store.getFreeCapacity(RESOURCE_ENERGY))
                                if(t == 0){
                                    if(creep.store[RESOURCE_ENERGY] - remoteLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0){
                                        linkHeap.queue[creep.name] = creep.store[RESOURCE_ENERGY] - remoteLink.store.getFreeCapacity(RESOURCE_ENERGY);
                                    }
                                    else{
                                        delete linkHeap.queue[creep.name]
                                    }
                                }
                            }
                        }
                        //If not, go to storage
                        else if(creep.memory.destination == 'storage'){
                            if(creep.transfer(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE){
                                creep.travelTo(creep.room.storage);
                            }
                        }
                    }
                    
                    else if(canRange < storeRange/2 && (upCan.store.getUsedCapacity() < 800 || upCan.store.getFreeCapacity() > creep.store[RESOURCE_ENERGY])){
                        for(const resourceType in creep.store) {
                            if (creep.transfer(upCan, resourceType) === ERR_NOT_IN_RANGE) {
                                creep.travelTo(upCan);
                            }
                        }
                    }
                    else{
                        for(const resourceType in creep.store) {
                            if (creep.transfer(creep.room.storage, resourceType) === ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.storage);
                            }
                        }
                    }
                }
                else{
                    for(const resourceType in creep.store) {
                        if (creep.transfer(creep.room.storage, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                        }
                    }
                }
            }
        }
        
        
    }
};

module.exports = roleTrucker;