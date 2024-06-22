var roleRaider = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
        }
        var targetRoom = creep.memory.targetRoom;
        let target;
        const baddie = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS,{filter: (att) => {
            return  att.body.length > 1 && !Memory.diplomacy.allies.includes(att.owner.username)
        }});
        let allies = creep.room.find(FIND_MY_CREEPS,{filter: (ally) => {
            return ally.hits < ally.hitsMax;
        }});
        const core = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
        if(baddie) target = baddie
        else if(core && creep.room.name == targetRoom){target = core}
        if(target){
            if(creep.pos.getRangeTo(target) > 2){
                creep.travelTo(target,{ignoreRoads:true});
            }
            creep.rangedAttack(target);
            creep.heal(creep);

        }
        else if(allies.length){
            let healTarget = creep.pos.findClosestByRange(allies);
            if(creep.pos.getRangeTo(healTarget) > 1){
                creep.travelTo(healTarget);
            }
            else{
                creep.heal(healTarget);
                creep.say('🩹',true)
            }
            
        }
        else if(creep.room.name != targetRoom){
            creep.travelTo(new RoomPosition(25,25,targetRoom),{ignoreRoads:true,range:20});              
        }

        else if(creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }
}

module.exports = roleRaider;