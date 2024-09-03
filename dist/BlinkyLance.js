const Lance = require('Lance')
const registry = require('registry')

//Blinky Lance
function BlinkyLance(name,details){
    //Inherit from lance
    Lance.call(this,name,details);
    this.details = details || {};
    this.lanceType = 'blinky';
    //Total units intended for this lance, max 3
    this.unitsNeeded = details.unitsNeeded || 1;
}

BlinkyLance.prototype = Object.create(Lance.prototype);
BlinkyLance.prototype.constructor = BlinkyLance;

//Orders a creep for the lance
BlinkyLance.prototype.populate = function(fief,kingdomCreeps,role = 'skirmisher',sev=60){
    let reserve = kingdomCreeps.reserve;
    let foundReserve = false;
    let takeaway = [];
    kingdomCreeps[this.name] = kingdomCreeps[this.name] || [];
    //First check to see if there are any reserves
    console.log(kingdomCreeps[this.name])
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
            console.log("target found",target)
            if(!remoteHealing) creep.heal(creep)
            if(creep.pos.getRangeTo(target) <=3){
                let g = creep.rangedAttack(target);
                let oppositeDirection = creep.pos.getDirectionTo(target);
                let moveDirection = (oppositeDirection + 3) % 8 + 1;
                creep.move(moveDirection);
            }
            //If target but no specific place to stand, just travel towards it until range 3
            else{
                creep.travelTo(target)
            }
        }
        else if(targetPos){
            console.log(creep,"travelling")
            let x = creep.travelTo(new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName),{range:targetPos.range});
            console.log(JSON.stringify(x))
        }
        //If the target is in range, we dismantle

    }
}

global.BlinkyLance = BlinkyLance;
module.exports = BlinkyLance;