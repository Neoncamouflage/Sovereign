const Lance = require('Lance')
const registry = require('registry')

//Demo specialist Lance
function MeleeDuoLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    this.details = details || {};
    this.lanceType = 'ranged';
    //Total units intended for this lance, max 3
    console.log("DLance details:",JSON.stringify(details))
    this.unitsNeeded = details.unitsNeeded || 1;
}

MeleeDuoLance.prototype = Object.create(Lance.prototype);
MeleeDuoLance.prototype.constructor = MeleeDuoLance;

//Orders a creep for the lance
MeleeDuoLance.prototype.populate = function(fief,kingdomCreeps,role = 'sapper',sev=60){
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
        registry.requestCreep({sev:sev,memory:{role:role,lance:this.name,fief:fief,status:'spawning',preflight:false}});
    }
    

}

//Executes creep orders. Moving to target positions and demolishing target objects
MeleeDuoLance.prototype.runCreeps = function(myCreeps){
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

global.MeleeDuoLance = MeleeDuoLance;
module.exports = MeleeDuoLance;