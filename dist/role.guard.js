var roleGuard = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
            creep.room.memory.guard = creep.name;
            creep.memory.preflight = true;
        }
        if(creep.ticksToLive < (creep.memory.targetRoom == 'E30S20' ? 600 : 200) && !creep.memory.respawned){
            spawnCreep('guard','10a11m1h','E28S8',70,{targetRoom:creep.memory.targetRoom,fief:'E28S8',stay:true});
            creep.memory.respawned = true;
        }
        if(!creep.memory.targetRoom) creep.memory.targetRoom = 'E30S10';
        const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        let targetPos = creep.memory.targetRoom == 'E30S0' ? new RoomPosition(44,5,creep.memory.targetRoom) : new RoomPosition(35,48,creep.memory.targetRoom);
        if(creep.room.name == 'E0S0' || creep.room.name == 'E0S10'){
            return;
        }
        else if(creep.pos.isEqualTo(targetPos)){
            creep.travelTo(new RoomPosition(25,25,creep.room.name))
        }
        else if(target && !isFriend(target)) {
            if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y))creep.travelTo(target);
            creep.attack(target)
        }
        else if(creep.room.name != creep.memory.targetRoom || creep.pos.getRangeTo(targetPos) > 1){
            creep.travelTo(targetPos,{range:1})
            return;
        }
        if(!target){
            if(creep.hits < creep.hitsMax) creep.heal(creep)
        }


    }
}

module.exports = roleGuard;