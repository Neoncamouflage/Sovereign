var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.job == 'homeBuilder'){
            let ramps = 'None'
            if(!creep.memory.preflight){
                creep.memory.preflight = true;
            }
            if(creep.room.name != creep.memory.homeRoom){
                    creep.travelTo(new RoomPosition(38, 23, creep.memory.homeRoom));
            }
            else if(creep.store.getUsedCapacity() > 0){
                var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                
                    if(targets.length) {
                        var buildSite = creep.pos.findClosestByRange(targets)
                        if(creep.room.storage){
                            creep.withdraw(creep.room.storage,RESOURCE_ENERGY)
                        }
                        if(creep.pos.getRangeTo(buildSite) != 1){
                            creep.travelTo(buildSite);
                        }
                        x = creep.build(buildSite);

                        //Keeps him next to the site and out of narrow hallways
                        
                    }
                    else{
                        
                        /*var damagedStructures = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => (structure.hits < 1000000 && structure.structureType == STRUCTURE_WALL)
                        });
                        if(creep.repair(damagedStructures[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(damagedStructures[0]);
                        }*/
                        /*let ffCan = Object.keys(Memory.kingdom.fiefs[creep.room.name].fastFiller)[0];
                        console.log(ffCan)
                        if(Game.getObjectById(ffCan)){
                            
                            let can = Game.getObjectById(ffCan)
                            if(creep.pos.getRangeTo(can) == 0){
                                creep.suicide();
                            }
                            creep.travelTo(can);
                        }*/
                    }
            }
            else{
                var sources = false
                    if (sources) {
                        if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(sources);
                        }
                    }
                    else{
                        if(creep.room.terminal && creep.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 1000){
                            if (creep.withdraw(creep.room.terminal, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.terminal);
                            }
                        }
                        else if(creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 5000){
                            if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.storage);
                            }
                        }
                    }
            }
        }
        else if(creep.memory.job == 'remoteBuilder'){
            if(!creep.memory.preflight){
            }
            var homeRoom = creep.memory.homeRoom
            if(creep.room.name != creep.memory.homeRoom){
                try{creep.travelTo(Game.rooms[homeRoom].controller,{range:1})}
                catch(e){
                    console.log('builder',e);
                    creep.travelTo(new RoomPosition(25,25,homeRoom),{range:6})
                }
            }
            else if(creep.store.getUsedCapacity() > 0){
                //Find cans to build first
                var target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                    filter: {structureType: STRUCTURE_CONTAINER}
                });
                //Find anything else otherwise
                if(!target){
                    var target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                }
                //If there is anything else, build it
                if(target) {
                    if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target);
                    }
                }
                else{
                    console.log(creep.room.name)
                    creep.suicide()
                }
            }
            else{
                //console.log(creep.name)
                var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                    filter: (resource) => resource.resourceType === RESOURCE_ENERGY
                });
                if (sources){
                    if(creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(sources);
                    }
                }
                else{
                    var containers = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_CONTAINER) &&
                                structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                        }
                    });
                    if (containers.length > 0) {
                        if (creep.withdraw(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(containers[0]);
                        }
                    }
                    else{
                        //If no energy, see if we even need to be here. Suicide if not
                        let target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                        if(!target){
                            creep.suicide()
                        }
                    }
                }
            }
        }
        else if(creep.memory.job == 'fortBuilder'){
            buildFlag = creep.memory.buildFlag
            if(creep.store['energy'] == 0){
                let hitMin = Memory.kingdom.fiefs[creep.room.name].rampartPlan.outerMin;
                if(!hitMin) hitMin = 50000
                console.log("Fortbuilder")
                creep.memory.buildFlag = false;
                ramps = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_RAMPART && structure.hits < Memory.kingdom.fiefs[creep.room.name].rampartPlan.outerMin)});
                //console.log("RAMPS"+ramps)
                if(ramps.length){
                    console.log("Rampyes, range")
                    creep.memory.target = creep.pos.findClosestByRange(ramps).id;
                }
            }
            else{
                creep.memory.buildFlag = true;
            }
            if(buildFlag){
                target = Game.getObjectById(creep.memory.target);
                if(creep.repair(target) == ERR_NOT_IN_RANGE){
                    creep.travelTo(target);
                }
            }
            else{
                if(creep.withdraw(creep.room.storage,'energy') == ERR_NOT_IN_RANGE){
                    creep.travelTo(creep.room.storage);
                }
            }
        }
        else{
            var targetRoom = creep.memory.targetRoom
            var homeRoom = creep.memory.homeRoom
            
            //else if(creep.room.name != targetRoom && creep.store.getUsedCapacity()  > 0){
             //   creep.travelTo(new RoomPosition(38, 23, targetRoom));
            //}
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(38, 23, targetRoom));
                //console.log("RUN")
            }
            else if(creep.store.getUsedCapacity() > 0){
                const structuresToRepair = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => structure.hits < structure.hitsMax*.8
                });
                
                if (structuresToRepair.length > 0) {
                    //console.log('repair')
                    const target = structuresToRepair[0];
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                      creep.travelTo(target);
                    }
                }
                else{
                    var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                        if(targets.length) {
                            if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(targets[0]);
                            }
                        }
                }
            }
            else{
                var sources = false
                    if (sources) {
                        if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(sources);
                        }
                    }
                    else{
                        var containers = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_CONTAINER) &&
                                    structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                            }
                        });
                        if (containers.length > 0) {
                            if (creep.withdraw(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(containers[0]);
                            }
                        }
                    }
            }
        }//--------------------------------------
    }
};

module.exports = roleBuilder;