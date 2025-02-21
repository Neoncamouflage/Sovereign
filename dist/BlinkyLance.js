const Lance = require('Lance')
const registry = require('registry')
const helper = require('functions.helper')
const profiler = require('screeps-profiler');
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
BlinkyLance.prototype.runCreeps = function(myCreeps,hostiles){
    let injured = myCreeps.filter(crp => crp.hits < crp.hitsMax);
    for(let creep of myCreeps){
        let creepID = creep.id;
        let targetPos = this.targetPos[creepID];
        let target = Game.getObjectById(this.target[creepID]);
        //console.log(creep.name,"has target",target,"and pos",JSON.stringify(targetPos))
        let remoteHealing = false;
        let injuredFar = false;
        let closest;
        if(!target && hostiles && hostiles.length){
            target = creep.pos.findClosestByRange(hostiles)
        }
        if(injured.length){
            //console.log("INJ",injured)
            closest = creep.pos.findClosestByRange(injured);
            if(!closest){
                creep.heal(creep)
            }
            else if(creep.pos.getRangeTo(closest)<=1){
                creep.heal(closest)
                remoteHealing = true;
            }
            else if(creep.pos.getRangeTo(closest) > 3){
                injuredFar = true;
            }   
            else if(closest.hits < closest.hitsMax){
                creep.rangedHeal(closest)
            }
        }
        //If no target or position, defend self and heal
        if(!target && !targetPos){
            let structTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL
            });
            if(structTargets.length){
                let stTarget = creep.pos.findClosestByRange(structTargets);
                if(creep.pos.getRangeTo(stTarget) <=1){
                    creep.rangedMassAttack();
                }
                else if(creep.pos.getRangeTo(stTarget) <=3){
                    creep.rangedAttack(stTarget);
                }
                else{
                    creep.moveTo(stTarget)
                }
            }
            else{
                if(injuredFar && closest){
                    creep.moveTo(closest)
                }
            }

        }
        if(target){
            //console.log("target found",target,creep.pos.getRangeTo(target))
            if(!remoteHealing) creep.heal(creep)
            if(creep.pos.getRangeTo(target) <=3){
                //console.log("Range to creep <=3")
                if(creep.pos.getRangeTo(target) <=1){
                    creep.rangedMassAttack();
                }
                else{
                    creep.rangedAttack(target);
                }
                if(injuredFar && closest){
                    creep.moveTo(closest)
                }
                else if(helper.isSoldier(target)){
                    let oppositeDirection = creep.pos.getDirectionTo(target);
                    let moveDirection = (oppositeDirection + 3) % 8 + 1;
                    creep.move(moveDirection);
                }

            }
            //If target but no specific place to stand, just travel towards it until range 3
            else{
                if(!hostiles || !hostiles.length){
                    if(targetPos){
                         let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range,military:true});
                     }
                }
                else{
                    creep.travelTo(target,{military:true})
                }

            }
        }
        else if(targetPos){
            console.log("TARGETPOS",JSON.stringify(targetPos))
           // console.log(creep,"travelling")
            let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range || 1,military:true});
            //console.log(JSON.stringify(x))
        }
        //If the target is in range, we dismantle

    }
}
profiler.registerObject(BlinkyLance, 'BlinkyLance');
global.BlinkyLance = BlinkyLance;
module.exports = BlinkyLance;