const helper = require('functions.helper');

var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let targetRoom = Game.getObjectById(creep.memory.holding);
        let targetSource = Game.getObjectById(creep.memory.target)
        if(!creep.memory.preflight){
            //Memory.kingdom.holdings[targetRoom].sources[harvestID].miner = creep.name;
            creep.memory.preflight = true;
        }
        

        if(creep.room.name != creep.memory.holding){
            if(targetSource){
                creep.travelTo(targetSource)
            }
            else{
                creep.travelTo(new RoomPosition(25, 25, creep.memory.holding));
            }
            return;
        }
        //Target seems to go null when out of energy, not sure why
        if(creep.pos.getRangeTo(targetSource) == 1){
            if(!creep.memory.stay) creep.memory.stay = true;
            let x = creep.harvest(targetSource); 
            //console.log("Mining attempt: ",x)
        }
        else{
            creep.travelTo(targetSource)
        }
    }
};

module.exports = roleMiner;

