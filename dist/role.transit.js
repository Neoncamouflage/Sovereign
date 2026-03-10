const supplyDemand = require('supplyDemand')
const helper = require('functions.helper')
//const roleUpgrader = require('role.upgrader');
const roleTransit = {
    /** @param {Creep} creep **/
    run: function(creep) {
        let targetRoom = creep.memory.targetRoom;
        let targetPos;
        if(!targetRoom || !creep.memory.holdRole){
            console.log("Transit creep",creep,"missing targetRoom or holdRole.");
            return;
        }
        if(Game.rooms[targetRoom]){
            targetPos = Game.rooms[targetRoom].controller.pos;
        }
        else{
            targetPos = new RoomPosition(25,25,targetRoom);
        }

        //Travel to target room if not there
        if(creep.room.name != creep.memory.targetRoom){
            creep.travelTo(targetPos,{range:15})
        }
        //Transfer ownership if we can
        else if(Memory.kingdom.fiefs[targetRoom]){
            creep.memory.role = creep.memory.holdRole;
            creep.memory.fief = targetRoom;
        }
        //Otherwise just hang out in the room
        else{
            creep.travelTo(targetPos,{range:15})
        }
        return;
    }
};

module.exports = roleTransit;