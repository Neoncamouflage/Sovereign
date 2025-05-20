var roleSettler = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let settlement = Memory.kingdom.fiefs[creep.memory.targetRoom]
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

        //Post-spawn build logic
        if(settlement && settlement.spawns && settlement.spawns.length){
            let spawn = Game.getObjectById(settlement.spawns[0]);
            if(creep.pos.getRangeTo(spawn) == 1){
                if(!spawn.spawning && creep.store.getUsedCapacity() == 0) spawn.recycleCreep(creep)
                else creep.transfer(spawn,RESOURCE_ENERGY)
            }
            else{
                creep.travelTo(spawn)
            }
            return;
        }
        //General logic
        if(creep.memory.flag == 'doing'){
            if(creep.room.name != creep.memory.targetRoom){
                creep.travelTo(new RoomPosition(25, 25, creep.memory.targetRoom));
                return;
            }
            let towers = creep.room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_TOWER}
            });
            let tow = creep.pos.findClosestByPath(towers);
            if(tow && tow.store[RESOURCE_ENERGY] < 700){
                if(creep.transfer(tow,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                    creep.travelTo(tow)
                }
                return;
            }
            //Upgrade first if we're getting close to downgrade or if we haven't ticked up to 2 for a safemode
            if(Game.rooms[creep.memory.targetRoom].controller.ticksToDowngrade < 3000 || Game.rooms[creep.memory.targetRoom].controller.level <2){
                creep.upgradeController(Game.rooms[creep.memory.targetRoom].controller);
                creep.travelTo(Game.rooms[creep.memory.targetRoom].controller);
            }
            else if(creep.room.energyAvailable == creep.room.energyCapacityAvailable){
                const structuresToRepair = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => (structure.hits < structure.hitsMax*0.8) && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART
                });

                var target = creep.room.find(FIND_CONSTRUCTION_SITES, {
                    filter: (site) => site.structureType === STRUCTURE_TOWER
                })[0];
                if(!target){
                    var target = creep.room.find(FIND_CONSTRUCTION_SITES, {
                        filter: (site) => site.structureType === STRUCTURE_SPAWN
                    })[0];
                }
                // If there is no storage construction site, then find the closest construction site of any type
                if (!target) {
                    target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
                }
                if (structuresToRepair.length > 0) {
                    const target = creep.pos.findClosestByPath(structuresToRepair);
                
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                        creep.travelTo(target);
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
                if(target && creep.transfer(target,RESOURCE_ENERGY)== ERR_NOT_IN_RANGE){
                    creep.travelTo(target,{range:1})
                }
                else{
                    creep.upgradeController(Game.rooms[creep.memory.targetRoom].controller);
                    creep.travelTo(Game.rooms[creep.memory.targetRoom].controller);
                }
            }
        }
        else if(creep.memory.flag == 'harvesting'){
            let things = creep.room.find(FIND_DROPPED_RESOURCES)
            let targetRoom = creep.memory.assist ? creep.memory.assistRoom : creep.memory.targetRoom;
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
                if(closestThing['energy'] > 50 && creep.pos.getRangeTo(closestThing) <= 6){
                    altFlag = true;
                    if(creep.pickup(closestThing) == ERR_NOT_IN_RANGE){
                        creep.travelTo(closestThing,{range:1})
                        return;
                    }
                }
                //If not, look for biggets energy. If that's reasonable, get it
                else if(biggestThing && biggestThing['energy'] > 100){
                    altFlag = true;
                    if(creep.pickup(biggestThing) == ERR_NOT_IN_RANGE){
                        creep.travelTo(biggestThing,{range:1})
                        return;
                    }
                }
            }
            else if(stuff.length){
                let closestThing = creep.pos.findClosestByRange(stuff);
                if(closestThing.store['energy'] > 50 && creep.pos.getRangeTo(closestThing) <= 6){
                    altFlag = true;
                    if(creep.withdraw(closestThing,'energy') == ERR_NOT_IN_RANGE){
                        creep.travelTo(closestThing,{range:1})
                        return;
                    }
                }
                
            }
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25, 25, targetRoom));
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
                            creep.travelTo(can,{range:1})
                        }
                    }
                }
            }

            //console.log("THIS")
            //console.log(stuff.length)

        }
    }
};

module.exports = roleSettler;