const Lance = require('Lance')
const registry = require('registry')

//Blinky Lance
function BlinkyLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    //Why are we assigning the whole object? Remove this at some point
    this.details = details || {};
    this.lanceType = 'blinky';
    //Total units intended for this lance, max 3
    this.unitsNeeded = details.unitsNeeded || 1;
}

BlinkyLance.prototype = Object.create(Lance.prototype);
BlinkyLance.prototype.constructor = BlinkyLance;

//Executes creep orders.
BlinkyLance.prototype.runCreeps = function(myCreeps){
    let injured = myCreeps.filter(crp => crp.hits < crp.hitsMax);
    for(let creep of myCreeps){
        let creepID = creep.id;
        let targetPos = this.targetPos[creepID];
        let target = Game.getObjectById(this.target[creepID]);
        console.log(creep.name,"has target",target,"and pos",JSON.stringify(targetPos))
        let remoteHealing = false;
        if(creep.hits == creep.hitsMax){
            let closest = creep.pos.findClosestByRange(injured);
            if(creep.pos.getRangeTo(closest) <= 3){
                creep.heal(closest)
                remoteHealing = true;
            }   
        }else{
            creep.heal(creep)
        }
        //If no target or position, do nothing
        if(!target && !targetPos) return;
        if(target){
            console.log("target found",target,creep.pos.getRangeTo(target))
            if(!remoteHealing) creep.heal(creep)
            if(creep.pos.getRangeTo(target) <=3){
                console.log("Range to creep <=3")
                let g = creep.rangedAttack(target);
                let oppositeDirection = creep.pos.getDirectionTo(target);
                let moveDirection = (oppositeDirection + 3) % 8 + 1;
                creep.move(moveDirection);
            }
            //If target but no specific place to stand, just travel towards it until range 3
            else{
                creep.travelTo(target,{military:true})
            }
        }
        else if(targetPos){
            console.log(creep,"travelling")
            let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range,military:true});
            console.log(JSON.stringify(x))
        }
        //If the target is in range, we dismantle

    }
}

global.BlinkyLance = BlinkyLance;
module.exports = BlinkyLance;