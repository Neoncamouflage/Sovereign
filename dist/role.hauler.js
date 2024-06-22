var roleHauler = {
    /** @param {Creep} creep **/
    run: function(creep) {

        // -------------- Refill Job -------------------
        if(creep.memory.job == 'refiller'){
            
            //Set targetFills to all general fill structures
            let fief = Memory.kingdom.fiefs[creep.room.name];
            let targetFills = fief.genRefills;
            
            //Find all towers and labs
            towers = creep.room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_TOWER}
            }).map(tower => tower.id);
            labs = creep.room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_LAB}
            }).map(lab => lab.id);

            //If no targetFills, just add all extensions and spawns
            if (targetFills == undefined) {
                targetFills = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN
                }).map(structure => structure.id);
            }
            //Get FF containers
            let ffCans = []
            Object.keys(fief.fastFiller).forEach(spawn => {
                //console.log(fief.fastFiller[spawn].can)
                ffCans.push(fief.fastFiller[spawn].can)
                targetFills.push(fief.fastFiller[spawn].can)
            })
            if(fief.ffMobile){
                targetFills.push(fief.ffMobile.can)
            }
            //Add towers and labs
            targetFills = targetFills.concat(towers,labs);// ,creep.room.memory.swapCans was also in this before link
            
            
            if(!creep.memory.preflight){
                const homeRoom = creep.memory.homeRoom
                const homeMemory = Game.rooms[homeRoom].memory
                creep.memory.preflight = true;
            }
            let things = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            //let stuff = creep.pos.findClosestByRange(FIND_TOMBSTONES);
            //console.log(stuff[0])
            //console.log(creep.pos.getRangeTo(stuff[0]))
            if(creep.ticksToLive < 30){
                if(creep.store.getUsedCapacity() == 0){
                    creep.suicide();
                }
                else if(creep.transfer(creep.room.storage,'energy') == -9){
                    creep.travelTo(creep.room.storage);
                }
            }
            else if (creep.store[RESOURCE_ENERGY] == 0) {
                if(things && things['energy'] >= 100 && creep.pos.getRangeTo(things) <= 6){
                    if(creep.pickup(things) == ERR_NOT_IN_RANGE){
                       creep.travelTo(things);
                       return;
                    }
                }
                else if(creep.room.storage && creep.room.storage.store['energy'] > 10000){
                    target = creep.room.storage;
                }
                else if(creep.room.terminal && creep.room.terminal.store['energy'] > 1000){
                    target = creep.room.terminal;
                }
                else{
                    target = creep.room.storage;
                }
                if(creep.ticksToLive > 50){
                    if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(target);
                    }
                            
                }   
                
            }
            else {
                let emptyRefills = [];
                let emptyFFs = [];
                let backup = false;
                let upContainer = Game.getObjectById(fief.upCan);
                //Check if we're backup
                //console.log(creep.name,'   ',Memory.kingdom.fiefs[creep.room.name].refiller)
                if(creep.name != Memory.kingdom.fiefs[creep.room.name].refiller){
                    backup = true;
                    //console.log(creep.name,' backup')
                }

                //console.log(targetFills)
                for(let each of ffCans){
                    let thisCan = Game.getObjectById(each);
                    if(thisCan && thisCan.store[RESOURCE_ENERGY] < 500){
                        if((thisCan.structureType != STRUCTURE_TOWER || thisCan.store[RESOURCE_ENERGY] < 700)){
                            emptyFFs.push(thisCan);
                        }
                    }
                }
                
                for(let each of targetFills){
                    let thisFill = Game.getObjectById(each);
                    //If a refill target is invalid, remove it from the list in memory and continue
                    //if(!thisFill){
                        //let newRefills = creep.room.memory.genRefills;
                        //let refIndex = newRefills.indexOf(each);
                        //if(refIndex !== -1){
                            //newRefills.splice(refIndex,1);
                        //}
                        //creep.room.memory.genRefills = newRefills;
                       // continue;
                    //}
                    if(thisFill && thisFill.store[RESOURCE_ENERGY] < thisFill.store.getCapacity(RESOURCE_ENERGY)){
                        if((thisFill.structureType != STRUCTURE_TOWER || thisFill.store[RESOURCE_ENERGY] < 700)){
                            emptyRefills.push(thisFill);
                        }
                    }
                }
                if( emptyFFs.length> 0 && (!backup || (upContainer &&upContainer.store[RESOURCE_ENERGY] > 800 && creep.room.storage.store[RESOURCE_ENERGY] > 0))){
                    pick = creep.pos.findClosestByPath(emptyFFs);
                    if (creep.transfer(pick, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(pick);
                    }
                }
                //Attend to empty refills first, unless refiller is on backup
                else if (emptyRefills.length > 0 && (!backup || (upContainer &&upContainer.store[RESOURCE_ENERGY] > 800 && creep.room.storage.store[RESOURCE_ENERGY] > 3000))) {
                    //console.log('Refill ',creep.name)
                    //console.log("NOTDONE "+creep.room.name)
                    //console.log(emptyRefills)
                    pick = creep.pos.findClosestByPath(emptyRefills);
                    //if(creep.pos.getRangeTo(pick) == 1){
                        //var simFills = creep.pos.findInRange(emptyRefills,1);
                    //}
                    //else{
                        //creep.travelTo(pick)
                    //}
                    
                    //for(each in simFills){
                        //console.log(creep.transfer(simFills[each],RESOURCE_ENERGY));
                    //}
                    if (creep.transfer(pick, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(pick);
                    }
                }
                else{
                    //console.log("READYFILL")
                    if(upContainer && upContainer.store && upContainer.store.getFreeCapacity() > 500 && creep.room.storage.store[RESOURCE_ENERGY] > 3000){
                        //console.log("RADYFUP")
                        if (creep.store.getFreeCapacity() > 0) {
                            target = creep.room.storage;
                            if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(target);
                                }
                            
                        }
                        else if (creep.transfer(upContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(upContainer);
                        }
                    }
                    else if(creep.store.getFreeCapacity() > 0){
                        target = creep.room.storage;
                            if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
                            }
                    }
                    else{
                    if(upContainer && upContainer.store.getFreeCapacity() > 0){
                        //console.log("RADYFUP")
                        if (creep.store.getFreeCapacity() > 0) {
                            target = creep.room.storage;
                            if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(target);
                                }
                            
                        }
                        else if (creep.transfer(upContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(upContainer);
                        }
                    }
                    else{
                        if(creep.room.memory.parking) creep.travelTo(creep.room.memory.parking.x,creep.room.memory.parking.y);
                    }
                        
                    }
                }
            }
        }
        else if(creep.memory.job == 'canHauler' || creep.memory.job == 'mineralHauler'){
            let can;
            if(!creep.memory.preflight){
                const homeRoom = creep.room.name
                const homeMemory = Game.rooms[homeRoom].memory
                creep.memory.preflight = true;
            }
            can = Game.getObjectById(creep.memory.can);
            
            
            if(creep.ticksToLive <= 50){
                if (creep.store.getUsedCapacity() > 0) {
                    for(const resourceType in creep.store) {
                        if (creep.transfer(creep.room.storage, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                            break;
                        }
                    }
                }
                else{
                    creep.suicide();
                }
            }
            else if (creep.store.getUsedCapacity() == 0) {
                
                if(can){
                    
                    if(creep.pos.getRangeTo(can) == 1){
                        if(can.store.getUsedCapacity() != 0){
                            for(let resourceType in can.store) {
                                creep.withdraw(can,resourceType);
                                break;
                            }
                        }
                    }
                    else{
                        creep.travelTo(can)
                    }
                }else if(creep.memory.source){
                    //Check for raw energy
                    
                    let source = Game.getObjectById(creep.memory.source);
                    //if(creep.id=='65df2f8da290b04eb102cac5')console.log(source)
                    targetDrops = source.pos.findInRange(FIND_DROPPED_RESOURCES,1);   
                    if(targetDrops.length){
                        //Just get the first one in the array
                        target = targetDrops[0];
                        if(creep.pos.getRangeTo(target) >1){
                            creep.travelTo(target);
                            //console.log(x)
                        }else{
                            let p = creep.pickup(target)
                            //console.log(p,target)
                        }
                    }
                    targetCan = source.pos.findInRange(FIND_STRUCTURES,1,{
                        filter:{structureType: STRUCTURE_CONTAINER}
                    })[0];
                    if(targetCan){
                        creep.memory.can = targetCan.id
                    }
                }else{
                    //creep.suicide();
                    let targetDrops = new RoomPosition(creep.memory.spot.spotx,creep.memory.spot.spoty,creep.memory.homeRoom).findInRange(FIND_DROPPED_RESOURCES,1)
                        if (creep.pickup(targetDrops[0]) === ERR_NOT_IN_RANGE) {
                            creep.travelTo(targetDrops[0]);
                        }
                    }
            }
            else {
                    
                    for(const resourceType in creep.store) {
                        if (creep.transfer(creep.room.storage, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                            break;
                        }
                    }
            }
        }
        else if(creep.memory.job == 'elevator'){
            if(!creep.memory.preflight){
                const homeRoom = creep.memory.homeRoom
                const homeMemory = Game.rooms[homeRoom].memory
                homeMemory.elevator = creep.name
                creep.memory.preflight = true;
            }
            if(creep.store['energy'] == 0){
                if(creep.withdraw(creep.room.storage,'energy') == ERR_NOT_IN_RANGE){
                    creep.travelTo(creep.room.storage);
                }
                
            }
            else if(creep.transfer(Game.getObjectById(creep.room.memory.upgradeCan),'energy') == ERR_NOT_IN_RANGE){
                creep.travelTo(Game.getObjectById(creep.room.memory.upgradeCan));
            }
        }
        else if(creep.memory.job == 'translotoxus'){
            if(!creep.memory.preflight){
                creep.room.memory.toxisFlag = Game.time;
                creep.memory.preflight = true;
            }
            if(creep.store.getUsedCapacity() == 0 && creep.room.name != creep.memory.targetRoom){
                if(creep.withdraw(creep.room.terminal,'T') == -9){
                    creep.travelTo(creep.room.terminal);
                }
            }
            else if(creep.room.name != creep.memory.targetRoom){
                creep.travelTo(Game.getObjectById('646f55e99bdd4e0008300cfc'));
            }
            else if(creep.store.getUsedCapacity() == 0){
                creep.suicide();
            }
            else if (creep.transfer(Game.getObjectById('646f55e99bdd4e0008300cfc'),'T') == -9){
                creep.travelTo(Game.getObjectById('646f55e99bdd4e0008300cfc'),{range:1})
            }
            
        }
    }
};

module.exports = roleHauler;