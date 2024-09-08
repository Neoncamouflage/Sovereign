const helper = require('functions.helper');
const registry = require('registry')
//Base Lance prototype and functions
function Lance(name,details){
    this.name = name;
    this.details = details || {};
    this.target = {};
    this.targetRoom = details.targetRoom
    this.targetPos = {};

    global.heap.army.lances[this.name] = this;

}

//Sets a target for the creep.
Lance.prototype.setTarget = function(creep,target) {
    if(!target || !target.id){
        console.log("Cannot set target for creep",creep.name,", target is invalid or has no ID");
        return;
    }
    this.target[creep.id] = target.id;
};
//Sets a target pos for the creep.
Lance.prototype.setTargetPos = function(creep,targetPos) {
    //If not a room position, save the x and y with the creep's room as a default if needed
    if(!targetPos instanceof RoomPosition){
        //If no x and y, return
        if(!targetPos.x || !targetPos.y){
            console.log("Cannot set target position for",creep.name,", target position is not a RoomPosition and has no x/y");
            return false;
        }
        this.targetPos[creep.id] = {x:targetPos.x,y:targetPos.y,roomName:targetPos.roomName || creep.room.name};
        return;
    }
    //If it is a room position, save it
    this.targetPos[creep.id] = {x:targetPos.x,y:targetPos.y,roomName:targetPos.roomName}
};

//Removes a creep's target
Lance.prototype.removeTarget = function(creep) {
    if(this.target[creep.id]) delete this.target[creep.id]
};
//Removes a creep's target pos
Lance.prototype.removeTargetPos = function(creep) {
    if(this.targetPos[creep.id]) delete this.targetPos[creep.id]
};

//Adds a creep to the Lance
Lance.prototype.addCreep = function(creep) {
    creep.memory.lance = this.name;
};

//Disbands the lance
Lance.prototype.disband = function() {
    delete this.troupe[this.name]
    delete global.heap.army.lances[this.name]
};

//Removes a creep as well as their target and targetPos assignments
Lance.prototype.removeCreep = function(creep) {
    if (this.target && this.target[creep.id]) {
        delete this.target[creep.id];
    }
    if (this.targetPos && this.targetPos[creep.id]) {
        delete this.targetPos[creep.id];
    }
};

Lance.prototype.populate = function(fief,kingdomCreeps,role){
    let roleRef = {
        'blinky':'skirmisher',
        'demo'  :'sapper',
        'melee' :'pikeman'
    }
    //How far away a creep can be and be allowed to join as a reserve
    let distanceRef = {
        'pikeman':4,
        'skirmisher':2
    }
    let sev = 60;
    if(role == 'pikeman') sev = 30;
    let rolePick = role || roleRef[this.lanceType] || 'generic'
    let reserve = kingdomCreeps.reserve;
    let foundReserve = false;
    let takeaway = [];
    kingdomCreeps[this.name] = kingdomCreeps[this.name] || [];
    //First check to see if there are any reserves
    console.log(kingdomCreeps[this.name])
    if(reserve.length){
        //Convert to creeps and sort by linear distance
        reserve = reserve.map(crpID => Game.getObjectById(crpID)).filter(crp => crp.memory.role == rolePick && crp.ticksToLive > distanceRef[rolePick]*100 && Game.map.getRoomLinearDistance(crp.room.name, this.targetRoom) <= distanceRef[rolePick]).sort((a, b) => {
            let distanceA = Game.map.getRoomLinearDistance(a.room.name, this.targetRoom);
            let distanceB = Game.map.getRoomLinearDistance(b.room.name, this.targetRoom);
            return distanceA - distanceB;
        });

        for(let crp of reserve){
            let crpID = crp.id
            //If so, add to the lance, mark that we found them, and push the ID to be removed from reserves
            if(crp.memory.role == rolePick){
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
        registry.requestCreep({sev:sev,memory:{role:rolePick,lance:this.name,fief:fief,status:'spawning',preflight:false}});
    }
    

}

module.exports = Lance;