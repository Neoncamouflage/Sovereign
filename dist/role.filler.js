var roleFiller = {

    /** @param {Creep} creep **/
    run: function(creep) {

        const fief = Memory.kingdom.fiefs[creep.room.name];
        if(!creep.memory.preflight){
        }
        let swapCan = Game.getObjectById(creep.memory.can);

        //If mobile, move to spot before anything else
        if(creep.memory.job == 'mobile'){
            if(creep.pos.x != creep.memory.spotx || creep.pos.y != creep.memory.spoty){
                creep.travelTo(new RoomPosition(creep.memory.spotx,creep.memory.spoty,creep.room.name));
                return;
            }else if(!creep.memory.stay){
                creep.memory.stay = true;
            }

        }

        //Find FF cans after spawning
        if(!creep.memory.refills && creep.ticksToLive < 1499){
            creep.memory.refills = creep.pos.findInRange(FIND_STRUCTURES,1,{
                filter:{structureType : STRUCTURE_EXTENSION}
            }).map(fill => fill.id);
            creep.memory.refills.push(creep.memory.spawner)

        }
        let refills = creep.memory.refills

        let fillFlag = false;
        try{
            for(let each of refills){
             
                //console.log(each)
                let thisCan = Game.getObjectById(each);
                //console.log(each)
                if(thisCan.store.getFreeCapacity(RESOURCE_ENERGY) > 0){
                    creep.transfer(thisCan,RESOURCE_ENERGY);
                    creep.withdraw(swapCan,'energy');
                    fillFlag = true;
                    break; 
                }
            }
        }
        //This is erroring on mobiles, fix at some point
        catch(e){/*console.log("Filler role error ",e,' ',creep.name)*/}
        if(!fillFlag){
            creep.withdraw(swapCan,'energy');
        }
    }
};

module.exports = roleFiller;