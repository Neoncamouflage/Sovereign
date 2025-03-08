const helper = require('functions.helper');

var roleGuard = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.preflight){
            creep.room.memory.guard = creep.name;
            creep.memory.preflight = true;
        }
        if(randomInt(29) == 13 && (!heap.say || heap.say != Game.time)){
            heap.say = Game.time;
            let symbolPick = ['⛔','🚷','👮‍♂️','❌','✋']
            let words = helper.getSay({symbol:`${symbolPick[Game.time%symbolPick.length]}`});
            creep.say(words.join(''))
        }
        if(!creep.memory.respawnMe && creep.ticksToLive < (creep.memory.targetRoom == 'E30S20' ? 600 : 300) && !creep.memory.respawned){
            spawnCreep('guard','20m18a2h','E28S8',70,{targetRoom:creep.memory.targetRoom,fief:'E28S8',stay:true});
            creep.memory.respawned = true;
        }
        if(!creep.memory.targetRoom) creep.memory.targetRoom = 'E30S10';
        const creeps = creep.room.find(FIND_CREEPS);
        let hostileCreeps = [];
        let allyCreeps = [];
        for(let crp of creeps){
            if(crp.my)continue;
            if(isFriend(crp))allyCreeps.push(crp)
            else hostileCreeps.push(crp)
        }
        let target = creep.pos.findClosestByRange(hostileCreeps)
        let targetPos = creep.memory.targetRoom == 'E30S0' ? new RoomPosition(44,5,creep.memory.targetRoom) : new RoomPosition(44,44,creep.memory.targetRoom);
        if(creep.room.name == 'E0S0' || creep.room.name == 'E0S10'){
            return;
        }
        else if(creep.pos.isEqualTo(targetPos)){
            creep.travelTo(new RoomPosition(25,25,creep.room.name))
        }
        else if(target && !isFriend(target)) {
            if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y) && !target.pos.isEqualTo(targetPos))creep.travelTo(target);
            creep.attack(target)
        }
        else if(creep.room.name != creep.memory.targetRoom || creep.pos.getRangeTo(targetPos) > 1){
            creep.travelTo(targetPos,{range:1})
            return;
        }
        else if(allyCreeps.length){
            let closeAlly = creep.pos.findClosestByRange(allyCreeps);
            if(creep.pos.isNearTo(closeAlly) && creep.pos.isNearTo(targetPos))creep.move(closeAlly)
        }
        if(!target){
            if(creep.hits < creep.hitsMax) creep.heal(creep)
        }
    }
}

module.exports = roleGuard;