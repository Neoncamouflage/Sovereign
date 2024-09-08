var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(false){
        }
        else{
            const targetID = creep.memory.target
            const homeRoom = creep.memory.fief
            const fief = Memory.kingdom.fiefs[homeRoom]
            
            const link = null;
            if(!creep.memory.preflight && !creep.memory.spawning){
                creep.memory.preflight = true;
            }
            //Assign source ID to target
            let target = Game.getObjectById(creep.memory.target);
            //If target is a mineral, do mineral harvest things
            
            if(creep.memory.target == fief.mineral.id){
                
                //If not in spot, go there
                if(!(creep.memory.status == 'harvest')){
                    //console.log(JSON.stringify(fief.mineral))
                    if(fief.mineral.can && Game.getObjectById(fief.mineral.can)){
                        if(!creep.pos.isEqualTo(Game.getObjectById(fief.mineral.can).pos)){
                            creep.travelTo(Game.getObjectById(fief.mineral.can).pos)
                        }
                        else{
                            creep.memory.stay = true;
                            creep.memory.status = 'harvest'
                        }
                    }
                    else if(creep.pos.getRangeTo(target) > 1){
                        creep.travelTo(target);
                    }
                    else{
                        creep.memory.stay = true;
                        creep.memory.status = 'harvest'
                    }
                }
                //Else, harvest
                else{
                    //console.log(target.mineralAmount)

                    let can = fief.mineral.can ? Game.getObjectById(fief.mineral.can) : false;
                
                    if(target.mineralAmount >0 && (!can || can.store.getFreeCapacity() > 0)){
                        //console.log("AYE")
                        let g =creep.harvest(target);
                        //console.log(g)
                    }
                }
                return;
            }

            //Else, regular harvesting stuff
            //If not in spot, go there
            else if(!(creep.memory.status == 'harvest')){
                    if(creep.getActiveBodyparts(WORK) >=5){
                        if(creep.pos.x == fief.sources[creep.memory.target].spotx && creep.pos.y == fief.sources[creep.memory.target].spoty && creep.room.name == homeRoom){
                            creep.memory.stay = true;
                            creep.memory.status = 'harvest';
                        }
                        else{
                            creep.travelTo(new RoomPosition(fief.sources[creep.memory.target].spotx,fief.sources[creep.memory.target].spoty,homeRoom))
                        }
                        return;
                    }
                    else{
                        if(creep.pos.getRangeTo(target) == 1){
                            creep.memory.stay = true;
                            creep.memory.status = 'harvest';
                        }
                        else{
                            creep.travelTo(target)
                        }
                        return;
                    }
            }
            
            //If there's a source, harvest if energy. If no energy, repair can if there
            if(target){
                const can = fief.sources[targetID].can && Game.getObjectById(fief.sources[targetID].can)
                if(target.energy > 0){
                    creep.harvest(target);
                }
                else if(can && can.hits < can.hitsMax * 0.8){
                    creep.repair(can);
                    creep.withdraw(can,RESOURCE_ENERGY);
                }
            }

            //Old link code, likely just remove
            if(link){
                //console.log("HERE")
                //Stop flag in case link is full
                let stopFlag = false;
                //If we're at the point of using carry creeps
                if(creep.store && creep.store.getCapacity() > 0){
                    //Check for a can to repair
                    let harvLink = Game.getObjectById(Memory.kingdom.fiefs[creep.room.name].sources[creep.memory.target].link);
                    //If link is live
                    if(harvLink && harvLink.store[RESOURCE_ENERGY] != 800){
                        creep.transfer(harvLink,RESOURCE_ENERGY);
                    }else if(harvLink){
                        //stopFlag = true;
                    }
                    //If free room and energy in can/on ground, get it
                    if(creep.store.getFreeCapacity() != 0){
                        let canSpot = creep.room.lookForAt(LOOK_STRUCTURES,creep.pos)
                        let can = canSpot.filter(structure => structure.structureType === STRUCTURE_CONTAINER)[0]
                        let drops = creep.room.lookForAt(LOOK_RESOURCES,creep.pos)[0]
                        //if(can) console.log(can)
                        if(can && can.store[RESOURCE_ENERGY] > 0){
                            creep.withdraw(can,RESOURCE_ENERGY)
                        }
                        else if(drops){
                            creep.pickup(drops)
                        }
                    }
                }
            }
        }
    }
};

module.exports = roleHarvester;