const Lance = require('Lance.js')

//Demo specialist Lance
function DemoLance(name, type){
    //Inherit from lance
    Lance.call(this, name, type);
}

DemoLance.prototype = Object.create(Lance.prototype);
DemoLance.prototype.constructor = DemoLance;

//Executes creep orders. Moving to target positions and demolishing target objects
DemoLance.prototype.runCreeps = function(){
    for(let creepID of this.creeps){
        let creep = Game.getObjectById(creepID);
        let targetPos = this.targetPos[creepID];
        let target = this.target[creepID];
        //If no target or position, do nothing
        if(!target && !targetPos) return;
        //If we have a target position, we travel
        if(targetPos){
            creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomname));
        }
        //If the target is in range, we dismantle
        if(target){
            if(creep.pos.getRangeTo(target) == 1){
                creep.dismantle(target);
            }
        }
    }
}

module.exports = DemoLance;