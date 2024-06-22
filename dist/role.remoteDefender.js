var roleRemotedefender = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
        }
        var targetRoom = creep.memory.targetRoom;
        if(creep.room.name != targetRoom){
            const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(target && !Memory.diplomacy.allies.includes(target.owner.username)) {
                let x =creep.rangedAttack(target)
                creep.attack(target)
                
                
                //console.log(x)
                let y = creep.travelTo(target);
                if (y == -2){
                    creep.travelTo(25,25)
                }
                creep.heal(creep);
            }
            else{
                creep.travelTo(new RoomPosition(25, 25, targetRoom));
            }
                
            
        }
        else{
            const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            const core = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
                if(target && !Memory.diplomacy.allies.includes(target.owner.username)) {
                    let x =creep.rangedAttack(target)
                    creep.attack(target)
                    
                    //console.log(x)
                    if(creep.pos.getRangeTo(target) > 2){
                        y = creep.travelTo(target);
                    }
                    creep.heal(creep);
                }
                else if(core){
                    let x =creep.attack(core)
                    creep.rangedAttack(core)
                    //console.log(x)
                    let y = creep.travelTo(core);
                    if (y == -2){
                        creep.travelTo(25,25)
                    }
                    creep.heal(creep);
                }
                else{
                    const friend = creep.pos.findClosestByRange(FIND_MY_CREEPS,{
                        filter: (friend) => {
                            return friend.hits < friend.hitsMax && friend.name != creep.name;
                        }
                    });
                    if(friend){
                        if(creep.heal(friend) == ERR_NOT_IN_RANGE){
                            creep.travelTo(friend)
                        }
                    }
                }
        }
    }
}

module.exports = roleRemotedefender;