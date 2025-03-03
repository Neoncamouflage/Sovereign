var roleGuard = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
            creep.room.memory.guard = creep.name;
            creep.memory.preflight = true;
        }
        if(creep.ticksToLive < 200 && !creep.memory.respawned){
            spawnCreep('guard','8a8m','E28S8',70,{targetRoom:'E30S10',fief:'E28S8',stay:true});
            creep.memory.respawned = true;
        }
        if(!creep.memory.targetRoom) creep.memory.targetRoom = 'E30S10';
        const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        let targetPos = new RoomPosition(44,44,creep.memory.targetRoom);
        if(target && !isFriend(target)) {
            creep.travelTo(target);
            creep.attack(target)
        }
        else if(creep.room.name == 'E0S0' || creep.room.name == 'E0S10'){
            return;
        }
        else if(creep.room.name != creep.memory.targetRoom || creep.pos.getRangeTo(targetPos) > 1){
            creep.travelTo(targetPos,{range:1})
            return;
        }


    }
}

module.exports = roleGuard;