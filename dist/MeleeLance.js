const Lance = require('Lance')
const registry = require('registry')

//Blinky Lance
function MeleeLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    //Why are we assigning the whole object? Remove this at some point
    this.details = details || {};
    this.lanceType = 'melee';
    //Total units intended for this lance, max 3
    this.unitsNeeded = details.unitsNeeded || 1;
}

MeleeLance.prototype = Object.create(Lance.prototype);
MeleeLance.prototype.constructor = MeleeLance;

//Executes creep orders.
MeleeLance.prototype.runCreeps = function(myCreeps){
    for(let creep of myCreeps){
        let creepID = creep.id;
        let targetPos = this.targetPos[creepID];
        let target = Game.getObjectById(this.target[creepID]);
        console.log(creep.name,"has target",target,"and pos",JSON.stringify(targetPos))
        //If no target or position, do nothing
        if(!target && !targetPos) return;
        if(target){
            if(creep.pos.getRangeTo(target) == 1){
                let g = creep.attack(target);
            }
            //If target but no specific place to stand, just travel towards it until range 3
            else if(creep.room.name == target.room.name){
                creep.travelTo(target,{military:true,range:1,maxRooms:1})
            }
            else{
                creep.travelTo(target,{military:true,range:1})
            }
        }
        else if(targetPos){
            console.log(creep,"travelling")
            let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range,military:true});
            console.log(JSON.stringify(x))
        }
        if(creep.getActiveBodyparts(HEAL) > 0 && (!target || creep.pos.getRangeTo(target) > 1)){
            if(creep.hits < creep.hitsMax ){
                creep.heal(creep)
            }else{
                let injured = creep.room.find(FIND_MY_CREEPS).filter(crp => crp.hits < crp.hitsMax);
                if(injured.length && creep.getActiveBodyparts(HEAL) > 1){
                    creep.travelTo(injured[0])
                    if(creep.pos.getRangeTo(injured[0]) > 1){
                        creep.rangedHeal(injured[0])
                    }else{
                        creep.heal(injured[0])
                    }
                }
            }
        }
        //If the target is in range, we dismantle

    }
}

global.MeleeLance = MeleeLance;
module.exports = MeleeLance;