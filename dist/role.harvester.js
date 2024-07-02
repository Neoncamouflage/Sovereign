var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(false){
        }
        else{
            const targetID = creep.memory.target
            const homeRoom = creep.memory.fief
            const fief = Memory.kingdom.fiefs[homeRoom]
            if(!creep.memory.preflight && !creep.memory.spawning){
                creep.memory.preflight = true;
            }
            //Assign source ID to target
            let target = Game.getObjectById(creep.memory.target);
            //If target is a mineral, do mineral harvest things
            
            if(creep.memory.target == fief.mineral.id){
                //console.log(creep.memory.target)
                //console.log(creep.memory.target == fief.mineral.id)
                //If not in spot, go there
                if(!(creep.memory.status == 'harvest')){
                    //console.log(JSON.stringify(fief.mineral))
                    if (creep.pos.x != fief.mineral.spot.x || creep.pos.y != fief.mineral.spot.y) {
                        if(!creep.memory.pull){
                            //Plan on legless harvesters, so see if we're marked as pull
                            creep.travelTo(new RoomPosition(fief.mineral.spot.x, fief.mineral.spot.y, homeRoom));
                        }
                    }else{
                        creep.memory.stay = true;
                        creep.memory.status = 'harvest'
                    }
                }
                //Else, harvest
                else{
                    //console.log(target.mineralAmount)
                    if(target.mineralAmount >0){
                        //console.log("AYE")
                        let g =creep.harvest(target);
                        //console.log(g)
                    }
                }
            }

            //Else, regular harvesting stuff
            //If not in spot, go there
            else if(!(creep.memory.status == 'harvest')){
                if(creep.getActiveBodyparts(WORK) < 5){
                    if(creep.pos.getRangeTo(target) == 1){
                        creep.memory.stay = true;
                        creep.memory.status = 'harvest';
                    }
                    else{
                        creep.travelTo(target)
                    }
                }
                else if (creep.pos.x != fief.sources[targetID].spotx || creep.pos.y != fief.sources[targetID].spoty) {
                    creep.travelTo(new RoomPosition(fief.sources[targetID].spotx, fief.sources[targetID].spoty, homeRoom));
                }else{
                    creep.memory.stay = true;
                    creep.memory.status = 'harvest';
                }
            }
            else{
                //console.log("HERE")
                //Stop flag in case link is full
                let stopFlag = false;
                //If we're at the point of using carry creeps
                if(creep.store.getCapacity() > 0){
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
                
                if(target && target.energy > 0 && !stopFlag){
                    creep.harvest(target);
                }
            }
        }
    }
};

module.exports = roleHarvester;