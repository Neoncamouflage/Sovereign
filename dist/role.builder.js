const supplyDemand = require('supplyDemand')

const roleBuilder = {
    /** @param {Creep} creep **/
    run: function(creep) {
        let ramps = 'None'
        if(!creep.memory.preflight){
            creep.memory.preflight = true;
        }
        if(creep.room.name != creep.memory.fief){
                creep.travelTo(new RoomPosition(38, 23, creep.memory.fief));
        }
        else{
            let target;
            if(creep.memory.target) target = Game.getObjectById(creep.memory.target)
            if(!target){
                let targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                target = creep.pos.findClosestByRange(targets)
                if(target){creep.memory.target = target.id}
                
            }
            if(target && creep.store.getUsedCapacity() > 0) {
                if(creep.pos.getRangeTo(target) > 3){
                    creep.travelTo(target);
                }
                else{
                    creep.build(target)
                }                    
            }

            //Submit order if not close to storage
            if(creep.store.getUsedCapacity() < creep.store.getCapacity()){
                if(!creep.room.storage || creep.pos.getRangeTo(creep.room.storage) >=5){
                    supplyDemand.addRequest(creep.room,{targetID:creep.id,amount:creep.store.getFreeCapacity(),resourceType:RESOURCE_ENERGY,type:'dropoff'})
                }
                else if(creep.store.getUsedCapacity() == 0){
                    if(creep.room.storage){
                        let range = creep.pos.getRangeTo(creep.room.storage);
                        if(range == 1){
                            creep.withdraw(creep.room.storage,RESOURCE_ENERGY);
                        }
                        else if(range < 5){
                            creep.travelTo(creep.room.storage)
                        }
                    }
                }
            }
        }
}
        /*
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
    }*/
};

module.exports = roleBuilder;