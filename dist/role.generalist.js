var roleGeneralist = {

    /** @param {Creep} creep **/
    run: function(creep) {
                if(!creep.memory.fief) creep.memory.fief = creep.memory.fief;
                if(!creep.memory.flag){
                    creep.memory.flag = 'harvesting';
                }
                if(creep.memory.flag == 'harvesting' && creep.store.getFreeCapacity() == 0){
                    creep.memory.flag = 'doing';
                }
                else if (creep.memory.flag == 'doing' && creep.store.getUsedCapacity() == 0){
                    creep.memory.flag = 'harvesting';
                    delete creep.memory.doingFlag;
                }
                if(creep.memory.flag == 'doing'){
                    if(creep.memory.doingFlag && creep.memory.doingFlag == 'upgrade'){
                        //console.log(Game.rooms[creep.memory.fief],' ',creep.name,' ',creep.room.name)
                        creep.upgradeController(Game.rooms[creep.memory.fief].controller);
                        creep.travelTo(Game.rooms[creep.memory.fief].controller);
                        
                    }
                    else if(creep.memory.job == 'remote'){
                        //let remoteLink = Game.getObjectById(creep.room.memory.remoteLink);
                        var target = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
                        if(creep.room.name != creep.memory.fief){
                            if(target){
                                creep.build(target);
                                creep.travelTo(target);
                            }
                            else{
                                
                                const structuresToRepair = creep.room.find(FIND_STRUCTURES, {
                                    filter: (structure) => (structure.hits < structure.hitsMax*.8) && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_CONTAINER && structure.structureType != STRUCTURE_RAMPART
                                });
                                var repStruct = creep.pos.findClosestByPath(structuresToRepair);
                                if(structuresToRepair.length && creep.pos.getRangeTo(repStruct) <=3){
                                    //console.log(creep.name)
                                    if (creep.repair(repStruct) === ERR_NOT_IN_RANGE) {
                                      creep.travelTo(repStruct);
                                    }
                                }
                                else{
                                    creep.travelTo(Game.rooms[creep.memory.fief].controller);
                                }
                            }
                        }
                        else if(creep.room.energyAvailable < creep.room.energyCapacityAvailable){
                            var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) &&
                                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                            }
                        });
                            //console.log(targets)
                            if(creep.transfer(target,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                                creep.travelTo(target)
                            }
                        }
                        else if(target && !Game.creeps[creep.room.memory.builder]) {
                            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                                var m = creep.travelTo(target);
                                if(m == ERR_NO_PATH){
                                    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                                        creep.travelTo(creep.room.controller)
                                    }
                                }
                            }
                        }
                        /*else if(remoteLink){
                           
                            if(creep.pos.getRangeTo(remoteLink) < creep.pos.getRangeTo(creep.room.storage)){
                                if(creep.transfer(remoteLink,'energy') == ERR_NOT_IN_RANGE){
                                    creep.travelTo(remoteLink);
                                }
                            }
                            else{
                                if(creep.transfer(creep.room.storage,'energy') == ERR_NOT_IN_RANGE){
                                    creep.travelTo(creep.room.storage);
                                }
                            }
                        }
                        else if(creep.room.memory.upgradeCan && Game.getObjectById(creep.room.memory.upgradeCan) && Game.getObjectById(creep.room.memory.upgradeCan).store['energy'] < 1500){
                            if(creep.transfer(Game.getObjectById(creep.room.memory.upgradeCan),'energy') == ERR_NOT_IN_RANGE){
                                creep.travelTo(Game.getObjectById(creep.room.memory.upgradeCan));
                            }
                        }*/
                        else if(creep.room.controller.ticksToDowngrade > 1000 && (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] < 10000)){
                            if(creep.transfer(creep.room.storage,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                                creep.travelTo(creep.room.storage)
                            }
                        }
                        else{
                            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                                creep.travelTo(creep.room.controller)
                                creep.memory.doingFlag = 'upgrade';
                            }
                        }
                    }
                    else if(Game.rooms[creep.memory.fief].controller.ticksToDowngrade < 3000){
                        creep.upgradeController(Game.rooms[creep.memory.fief].controller);
                        creep.travelTo(Game.rooms[creep.memory.fief].controller);
                    }
                    else if(creep.room.energyAvailable == creep.room.energyCapacityAvailable){
                        const structuresToRepair = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => (structure.hits < structure.hitsMax*0.8) && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART
                        });
                        let towers = creep.room.find(FIND_MY_STRUCTURES, {
                            filter: { structureType: STRUCTURE_TOWER}
                        });
                        let tow = creep.pos.findClosestByPath(towers);
                        var target = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
                            filter: (site) => site.structureType === STRUCTURE_STORAGE
                        })[0]; // Take the first storage construction site if there are any
                        
                        // If there is no storage construction site, then find the closest construction site of any type
                        if (!target) {
                            target = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
                        }
                        if (structuresToRepair.length > 0) {
                            const target = creep.pos.findClosestByPath(structuresToRepair);
                        
                            if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                              creep.travelTo(target);
                            }
                        }
                        
                        //Code to check for tower storage
                        else if(tow && tow.store[RESOURCE_ENERGY] < 700){
                            if(creep.transfer(tow,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                                creep.travelTo(tow)
                            }
                        }
                        
                        else if(target) {
                            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                            var m = creep.travelTo(target);
                            }
                            if(m == ERR_NO_PATH){
                                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                                    creep.travelTo(creep.room.controller)
                                }
                            }
                        }else if(creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] < 20000){
                            if(creep.transfer(creep.room.storage,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                                creep.travelTo(creep.room.storage)
                            }
                        }
                        else{
                            creep.memory.doingFlag = 'upgrade';
                            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE){
                                creep.travelTo(creep.room.controller)
                            }
                        }
                    }
                    else{
                        var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) &&
                                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                            }
                        });
                        //console.log(targets)
                        if(creep.transfer(target,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                            creep.travelTo(target)
                        }
                    }
                }
                else if(creep.memory.flag == 'harvesting'){
                    if(!(creep.memory.job == 'remote')){
                        //Check for cans first
                        let fief = Memory.kingdom.fiefs[creep.memory.fief]
                        let target;
                        let cans = [];
                        Object.keys(fief.sources).forEach(source => {
                            if(Game.getObjectById(fief.sources[source].can) && Game.getObjectById(fief.sources[source].can).store.getUsedCapacity() > creep.store.getFreeCapacity()){
                                cans.push(Game.getObjectById(fief.sources[source].can))
                            }
                        });
                        //console.log(cans)
                        //Go home if needed
                        if(creep.room.name != creep.memory.fief){
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.fief))
                        }
                        //If there are cans to pull from
                        else if(cans.length){
                            //Range of big can
                            let bigCanRange = 99;
                            //console.log("Can")
                            let closeCan;
                            let bigCan = 0;
                            let goCan;
                            cans.forEach(can => {
                                //If within range 10 of a can already, just go it that one
                                if(creep.pos.getRangeTo(can) <=10){
                                    closeCan = can;
                                }
                                //Sort bigCan by the most stored
                                if(can.store[RESOURCE_ENERGY] > bigCan){
                                    goCan = can;
                                    bigCan = can.store[RESOURCE_ENERGY];
                                    bigCanRange = creep.pos.getRangeTo(can);
                                }
                            })
                            //If we have a close can use it, go to goCan if it has 1500 or more and it's twice as close as closecan
                            if((closeCan && bigCanRange/2 > creep.pos.getRangeTo(closeCan)) && (!goCan || goCan.store[RESOURCE_ENERGY] < 1500)){
                                target = closeCan;
                            }else{
                                target = goCan;
                            }
                            //Otherwise otherwise, go to source
                        }else{
                            target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        }
                        
                        let things = creep.room.find(FIND_DROPPED_RESOURCES)
                        let stuff = creep.room.find(FIND_TOMBSTONES)
                        let altFlag = false
                        if(things.length){
                            let closestThing = creep.pos.findClosestByRange(things);
                            let biggestThing;
                            things.forEach(eng => {
                                if(!biggestThing || (biggestThing && biggestThing['energy'] < eng['energy'])){
                                    biggestThing = eng;
                                }
                            })
                            //If closest energy is pretty close and over 50
                            if(closestThing['energy'] > creep.store.getFreeCapacity() && creep.pos.getRangeTo(closestThing) <= 5){
                                altFlag = true;
                                if(creep.pickup(closestThing) == ERR_NOT_IN_RANGE){
                                    creep.travelTo(closestThing)
                                }
                            }
                            //If not, look for biggets energy. If that's reasonable, get it
                            else if(biggestThing && biggestThing['energy'] > 100){
                                altFlag = true;
                                if(creep.pickup(biggestThing) == ERR_NOT_IN_RANGE){
                                    creep.travelTo(biggestThing)
                                }
                            }
                        }
                        else if(stuff.length && creep.pos.findClosestByRange(stuff) <= 10 && creep.pos.findClosestByRange(stuff).store['energy'] > 50){
                            let closestThing = creep.pos.findClosestByRange(stuff);
                            altFlag = true;
                            if(creep.withdraw(closestThing,'energy') == ERR_NOT_IN_RANGE){
                                creep.travelTo(closestThing);
                            }  
                        }
                        else{
                            if(!cans.length){
                                let harv = creep.harvest(target);
                                if(harv  == ERR_NOT_IN_RANGE){
                                    creep.travelTo(target);
                                }else if(harv != 0){
                                    creep.travelTo(creep.room.storage);
                                    if(creep.store.getUsedCapacity() > 0){
                                        creep.transfer(creep.room.storage,RESOURCE_ENERGY);
                                    }
                                }
                                //console.log(creep.name)
                                
                            }else{ 
                                let wiff = creep.withdraw(target,RESOURCE_ENERGY);
                                if(wiff == ERR_NOT_IN_RANGE){
                                    creep.travelTo(target);
                                }else if(wiff != 0){
                                    creep.travelTo(creep.room.storage);
                                    if(creep.store.getUsedCapacity() > 0){
                                        creep.transfer(creep.room.storage,RESOURCE_ENERGY);
                                    }
                                }
                            }
                        }
                    }
                    else{
                        if(Game.rooms[creep.memory.targetRoom] && Game.rooms[creep.memory.targetRoom].memory.alarm){
                            //creep.travelTo(new RoomPosition(25, 25, creep.memory.fief))
                        }
                        else{
                            let things = creep.room.find(FIND_DROPPED_RESOURCES)
                            let targetRoom = creep.memory.targetRoom;
                            let stuff = creep.room.find(FIND_TOMBSTONES)
                            let altFlag = false
                            if(creep.room.name != targetRoom){
                                if(creep.memory.stepTarget){
                                    if(creep.memory.stepFlag){
                                        creep.travelTo(new RoomPosition(25, 25, creep.memory.targetRoom));
                                    }else{
                                        if(creep.memory.stepTarget == creep.room.name){
                                            creep.memory.stepFlag = true;
                                        }
                                        //console.log(creep.name,' is moving to step target:',creep.memory.stepTarget)
                                        creep.travelTo(new RoomPosition(25, 25, creep.memory.stepTarget));
                                    }
                                }
                                    creep.travelTo(new RoomPosition(25, 25, creep.memory.targetRoom));
                                return;
                            }
                            else if(creep.room.name == targetRoom){

                                //console.log("YES")
                                let target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                                //console.log(creep.room.name + ' INROOM');
                                //console.log(target)
                                //if(creep.id == '6480afaece51add94f996497'){console.log(creep.harvest(target))}
                                let g = creep.harvest(target) 
                                //console.log(g)
                                if(g== ERR_NOT_IN_RANGE){

                                    let x = creep.travelTo(target,{range:1});
                                }
                                else{
                                    let can = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
                                    });
                                    if(can){
                                        if(creep.withdraw(can,'energy') == ERR_NOT_IN_RANGE){
                                            creep.travelTo(can)
                                        }
                                    }
                                }
                            }

                            //console.log("THIS")
                            //console.log(stuff.length)
                            if(things.length){
                                let closestThing = creep.pos.findClosestByRange(things);
                                let biggestThing;
                                things.forEach(eng => {
                                    if(!biggestThing || (biggestThing && biggestThing['energy'] < eng['energy'])){
                                        biggestThing = eng;
                                    }
                                })
                                //If closest energy is pretty close and over 50
                                if(closestThing['energy'] > 50 && creep.pos.getRangeTo(closestThing) <= 6){
                                    altFlag = true;
                                    if(creep.pickup(closestThing) == ERR_NOT_IN_RANGE){
                                        creep.travelTo(closestThing)
                                    }
                                }
                                //If not, look for biggets energy. If that's reasonable, get it
                                else if(biggestThing && biggestThing['energy'] > 100){
                                    altFlag = true;
                                    if(creep.pickup(biggestThing) == ERR_NOT_IN_RANGE){
                                        creep.travelTo(biggestThing)
                                    }
                                }
                            }
                            else if(stuff.length){
                                let closestThing = creep.pos.findClosestByRange(stuff);
                                if(closestThing.store['energy'] > 50 && creep.pos.getRangeTo(closestThing) <= 6){
                                    altFlag = true;
                                    if(creep.withdraw(closestThing,'energy') == ERR_NOT_IN_RANGE){
                                        creep.travelTo(closestThing)
                                    }
                                }
                                
                            }
                        }
                    }
                }
    }
};

module.exports = roleGeneralist;