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
        
        let holding = Memory.kingdom.holdings[creep.memory.holding];
        if(creep.room.name != creep.memory.holding){
            if(targetSource && holding.sources[creep.memory.target].path){
                let path = holding.sources[creep.memory.target].path
                let pos = path[path.length-1]
                creep.travelTo(new RoomPosition(pos.x,pos.y, creep.memory.holding),{range:0})
            }
            else if (targetSource){
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

