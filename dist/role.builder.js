const supplyDemand = require('supplyDemand')
const upgrader = require('role.upgrader');
const roleBuilder = {
    /** @param {Creep} creep **/
    run: function(creep) {
        let ramps = 'None'
        if(!creep.memory.preflight){
            if(creep.memory.role == 'remoteBuilder'){
                //If we're a remote builder, our preflight is setting our id to our troupe.
                if(global.heap && global.heap.army && global.heap.army.troupes){
                    for(let troupe of global.heap.army.troupes){
                        if(troupe.name == creep.memory.troupe){
                            troupe.remoteBuilder = creep.id;
                        }
                    }
                }
                else{
                    return;
                }
            }
            creep.memory.preflight = true;
        }
        if(creep.memory.job == 'remoteBuilder' && creep.room.name != creep.memory.targetRoom){
            let tRoom = Game.rooms[creep.memory.targetRoom];
            //If we have vision in the room, go to a site
            if(tRoom){
                let target = tRoom.find(FIND_MY_CONSTRUCTION_SITES)[0];
                creep.travelTo(target);
                return;
            }
            //Otherwise just go to 25,25
            creep.travelTo(new RoomPosition(25, 25, creep.memory.targetRoom))
            return;
        }
        else if(creep.memory.job != 'remoteBuilder' && creep.room.name != creep.memory.fief){
                creep.travelTo(new RoomPosition(38, 23, creep.memory.fief));
                return;
        }
        
        let target;
        if(creep.memory.target) target = Game.getObjectById(creep.memory.target)
        if(!target){
            let targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
            target = creep.pos.findClosestByRange(targets)
            if(target){creep.memory.target = target.id}
            else if(creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000){
                creep.memory.status = 'upgrading'
                upgrader.run(creep);
                return;
            }
            else{
                if(creep.memory.job == 'remoteBuilder'){
                    delete creep.memory.job;
                    return;
                }
                let spawns = Memory.kingdom.fiefs[creep.memory.fief].spawns.map(spw => Game.getObjectById(spw))
                let tSpawn = creep.pos.findClosestByRange(spawns)
                if(creep.pos.getRangeTo(tSpawn) == 1){
                    if(!tSpawn.spawning) tSpawn.recycleCreep(creep)
                }
                else{
                    creep.travelTo(tSpawn)
                }
            }
            
        }
        creep.memory.status = 'building'
        if(creep.pos.getRangeTo(target) > 3){
            creep.travelTo(target);
        }
        else{
            creep.build(target)
        }

        //Submit order if not close to storage
        if(creep.store.getUsedCapacity() < creep.store.getCapacity()){
            if((!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5)){
                let orderDetails = {
                    targetID:creep.id,
                    amount:creep.store.getCapacity(),
                    resourceType:RESOURCE_ENERGY,type:'dropoff'
                };
                if(creep.memory.job == 'remoteBuilder'){
                    orderDetails.international = true;
                    orderDetails.priority = 6
                }
                if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2 || creep.memory.job == 'remoteBuilder') supplyDemand.addRequest(creep.room,orderDetails)
            }
            else{
                if(creep.room.storage){
                    let range = creep.pos.getRangeTo(creep.room.storage);
                    if(range == 1){
                        creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                    }
                    else if(creep.store.getUsedCapacity() == 0){
                        creep.travelTo(creep.room.storage)
                    }
                }
                else{
                    let orderDetails = {
                        targetID:creep.id,
                        amount:creep.store.getCapacity(),
                        resourceType:RESOURCE_ENERGY,type:'dropoff'
                    };
                    if(creep.memory.job == 'remoteBuilder'){
                        orderDetails.international = true;
                        orderDetails.priority = 6
                    }
                    if(creep.room.energyAvailable > creep.room.energyCapacityAvailable/2 || creep.memory.job == 'remoteBuilder') supplyDemand.addRequest(creep.room,orderDetails)
                }
            }
        }
    },
    runFortifiers(room,creeps){

        //Get all rampart construction sites and ramparts under the limit
        let fief = Memory.kingdom.fiefs[room.name]
        let rampSites = room.find(FIND_MY_CONSTRUCTION_SITES)
        let ramps = room.find(FIND_MY_STRUCTURES).filter(struct => struct.structureType == STRUCTURE_RAMPART && struct.hits < fief.rampTarget);
        for(let creep of creeps){
            let target = Game.getObjectById(creep.memory.targetID)
            //If we have a target, we repair or build it if below max hits
            //console.log("Buildtarget: ",target)
            if(target){
                //console.log()
                if(target instanceof Structure){
                    //console.log(`Ramp hits: ${target.hits} Ramptarget: ${fief.rampTarget + (fief.rampTarget*0.15)}`)
                    if(target.hits > fief.rampTarget + Math.min(100000,fief.rampTarget*0.15)){
                        delete creep.memory.targetID;
                        continue;
                    }
                    if(creep.pos.getRangeTo(target) > 3){
                        creep.travelTo(target);
                    }
                    else{
                        creep.repair(target);
                    }
                }
                else if(target instanceof ConstructionSite){
                    if(creep.pos.getRangeTo(target) > 3){
                        creep.travelTo(target);
                    }
                    else{
                        creep.build(target);
                    }
                }
                else{
                    //If not, figure out what it is
                    console.log("Unknown target:",JSON.stringify(target))
                }
            }
            //If not, get one
            else if(ramps.length){
                target = creep.pos.findClosestByRange(ramps);
                creep.memory.targetID = target.id;
                if(creep.pos.getRangeTo(target) > 3){
                    creep.travelTo(target);
                }
                else{
                    creep.repair(target);
                }
            }
            else if(rampSites.length){
                target = creep.pos.findClosestByRange(rampSites);
                creep.memory.targetID = target.id;
                if(creep.pos.getRangeTo(target) > 3){
                    creep.travelTo(target);
                }
                else{
                    creep.build(target);
                }
            }
            //If no targets at all, default to builder work, which falls back to upgrader
            else{
                roleBuilder.run(creep)
            }
            //If we have a target and need energy, request
            if(!target || creep.pos.getRangeTo(target) > 6) continue;
            if(creep.store.getUsedCapacity() < creep.store.getCapacity()){
                supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
            }
        }

    }
};

module.exports = roleBuilder;