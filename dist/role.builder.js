const supplyDemand = require('supplyDemand')
const upgrader = require('role.upgrader');
const helper = require('functions.helper')
const roleBuilder = {
    /** @param {Creep} creep **/
    run: function(creep) {
        let ramps = 'None'
        if(!creep.memory.preflight){
            if(creep.memory.job == 'remoteBuilder'){
                //If we're an army remote builder, our preflight is setting our id to our troupe.
                if(creep.memory.troupe && global.heap && global.heap.army && global.heap.army.troupes){
                    for(let troupe of global.heap.army.troupes){
                        if(troupe.name == creep.memory.troupe){
                            troupe.remoteBuilder = creep.id;
                        }
                    }
                }
                
            }
            creep.memory.preflight = true;
        }

        //Non-army remote builder check for alarms
        if(creep.memory.job == 'remoteBuilder' && !creep.memory.troupe && global.heap.alarms[creep.memory.targetRoom]){     
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
                    creep.travelTo(Game.rooms[creep.memory.fief].controller);
                }
            }
            return;
        }


        if(creep.memory.job == 'remoteBuilder' && creep.room.name != creep.memory.targetRoom){
            let tRoom = Game.rooms[creep.memory.targetRoom];
            //If we have vision in the room, go to a site
            if(tRoom){
                let target = tRoom.find(FIND_MY_CONSTRUCTION_SITES)[0];
                if(target){
                    creep.travelTo(target);
                    return;
                }
                //If no target and we're not an army builder, see if we need a new target room
                else if(!creep.memory.troupe){
                    let fief = Memory.kingdom.fiefs[creep.memory.fief];
                    if(fief.remoteBuild && fief.remoteBuild != creep.memory.targetRoom){
                        creep.memory.targetRoom = fief.remoteBuild;
                    }
                    return;
                }
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
                //If no target and we're a remote builder, keep checking to see if one is needed elsewhere
                if(creep.memory.job == 'remoteBuilder'){
                    if(creep.memory.troupe) delete creep.memory.troupe
                    let fief = Memory.kingdom.fiefs[creep.memory.fief];
                    if(fief.remoteBuild && fief.remoteBuild != creep.memory.targetRoom){
                        creep.memory.targetRoom = fief.remoteBuild;
                    }
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
            if(!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5){
                let orderDetails = {
                    targetID:creep.id,
                    amount:creep.store.getCapacity(),
                    resourceType:RESOURCE_ENERGY,type:'dropoff'
                };
                if(creep.memory.job == 'remoteBuilder'){
                    orderDetails.international = true;
                    orderDetails.priority = 6
                    orderDetails.amount *= 2;
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
            if(room.controller.level >= 6 && !creep.memory.boosted){
                let body = creep.body.filter(part => part.type == WORK && !part.boost);
                //console.log("REAVER",body)
                if(!body.length){
                    creep.memory.boosted = true;
                    return;
                }
                let labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'XLH2O' && lab.store['XLH2O'] >30);
                if(!labs.length){
                    labs = creep.room.find(FIND_MY_STRUCTURES).filter(lab => lab.structureType == STRUCTURE_LAB && lab.mineralType && lab.mineralType == 'LH2O' && lab.store['LH2O'] >30);
                    if(!labs.length) creep.memory.boosted = true;
                }
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
                        if(tLab && creep.pos.getRangeTo(tLab) > 1) creep.travelTo(tLab);
                        return;
                    }
                }
                else{
                    creep.travelTo(tLab)
                }
                return;
            }
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