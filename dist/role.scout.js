var roleScout = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.room.name != creep.memory.targetRoom){
            creep.travelTo(new RoomPosition(15, 15, creep.memory.targetRoom));
        }else{
            if(Memory.kingdom.missions.scout[creep.memory.targetRoom]){
                Memory.kingdom.missions.scout[creep.memory.targetRoom].complete = true;
            }
            creep.suicide();
        }
        
    }
};

module.exports = roleScout;

