const Lance = require('Lance')
const registry = require('registry')

const MAX_DEMOS = 3;

//Demo specialist Lance
function DemoLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    this.details = details || {};
    this.lanceType = 'demo';
    //Total units intended for this lance, max 3
    this.unitsNeeded = (details && details.targetHits && details.targetHits > 0) ? Math.min(Math.ceil(details.targetHits / 500000), MAX_DEMOS) : 0;
}

DemoLance.prototype = Object.create(Lance.prototype);
DemoLance.prototype.constructor = DemoLance;

//Executes creep orders. Moving to target positions and demolishing target objects
DemoLance.prototype.runCreeps = function(myCreeps){
    for(let creep of myCreeps){
        let creepID = creep.id;
        let targetPos = this.targetPos[creepID];
        let target = Game.getObjectById(this.target[creepID]);
        //If no target or position, do nothing
        if(!target && !targetPos) return;
        //If we have a target position, we travel
        if(targetPos){
            creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName));
        }
        //If the target is in range, we dismantle
        if(target){
            if(creep.pos.getRangeTo(target) == 1){
                creep.dismantle(target);
            }
            //If target but no specific place to stand, just travel towards it
            else if(!targetPos){
                creep.travelTo(target)
            }
        }
    }
}

global.DemoLance = DemoLance;
module.exports = DemoLance;