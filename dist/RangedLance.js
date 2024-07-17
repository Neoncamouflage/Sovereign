const Lance = require('Lance')
const registry = require('registry')

//Demo specialist Lance
function RangedLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    this.details = details || {};
    this.lanceType = 'ranged';
    //Body size starts small when not otherwise specified, can be changed later.
    this.bodySize = details.bodySize || 2;
    //Total units intended for this lance
    this.unitsNeeded = details.unitsNeeded || 1;
}

RangedLance.prototype = Object.create(Lance.prototype);
RangedLance.prototype.constructor = RangedLance;

//Orders a creep for the lance
RangedLance.prototype.populate = function(fief,kingdomCreeps,role = 'archer',sev=60){
    let reserve = kingdomCreeps.reserve;
    let foundReserve = false;
    let takeaway = [];
    kingdomCreeps[this.name] = kingdomCreeps[this.name] || [];
    //First check to see if there are any reserves
    if(reserve.length){
        for(let crpID of reserve){
            let crp = Game.getObjectById(crpID);
            //If so, add to the lance, mark that we found them, and push the ID to be removed from reserves
            if(crp.memory.role == role){
                this.addCreep(crp);
                kingdomCreeps[this.name].push(crp)
                crp.memory.lance = this.name;
                takeaway.push(crpID)
            }
            if(kingdomCreeps[this.name].length >= this.unitsNeeded){
                foundReserve = true;
                break;
            }
        }
    }

    //Update reserve units if we found them.
    if(takeaway.length){
        global.heap.army.reserve = global.heap.army.reserve.filter(resID => !takeaway.includes(resID));
    }
    //If we didn't find enough to fill, order a creep
    if(!foundReserve){
        registry.requestCreep({sev:sev,bodySize:this.bodySize,memory:{role:role,job:'archer',lance:this.name,fief:fief,status:'spawning',preflight:false}});
    }
    

}

//Executes creep orders. Moving to target positions and demolishing target objects
RangedLance.prototype.runCreeps = function(myCreeps){
    for(let creep of myCreeps){
        let creepID = creep.id;
        let targetPos = this.targetPos[creepID];
        let target = Game.getObjectById(this.target[creepID]);
        console.log(creep.name,"has target",target,"and pos",JSON.stringify(targetPos))
        //If no target or position, do nothing
        if(!target && !targetPos) return;
        //If we have a target position, we travel
        if(targetPos){
            console.log(creep,"travelling")
            let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range});
            console.log(JSON.stringify(x))
        }
        //If the target is in range, we dismantle
        if(target){
            if(creep.pos.getRangeTo(target) <=3){
                creep.rangedAttack(target);
            }
            //If target but no specific place to stand, just travel towards it until range 3
            else if(!targetPos){
                creep.travelTo(target,{range:3})
            }
        }
    }
}

global.RangedLance = RangedLance;
module.exports = RangedLance;