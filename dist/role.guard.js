var roleGuard = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
            creep.room.memory.guard = creep.name;
            creep.memory.preflight = true;
        }

            const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                if(target && !Memory.diplomacy.allies.includes(target.owner.username)) {
                    let x =creep.rangedAttack(target)
                    
                    
                    let y = creep.travelTo(target);
                    creep.attack(target)
                    creep.heal(creep);
                }

    }
}

module.exports = roleGuard;