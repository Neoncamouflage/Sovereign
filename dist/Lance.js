function Lance(name,type){
    this.name = name;
    this.type = type;
    this.creeps = [];
    //target keys are creep IDs, values are gameobject IDs to attack
    //targetPos keys are creep IDs, values are positions to be at
    this.target = {}
    this.targetPos = {}
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
    this.creeps.push(creep.id);
};

//Removes a creep as well as their target and targetPos assignments
Lance.prototype.removeCreep = function(creep) {
    this.creeps = this.creeps.filter(creepId => creepId !== creep.id);
    if (this.target && this.target[creep.id]) {
        delete this.target[creep.id];
    }
    if (this.targetPos && this.targetPos[creep.id]) {
        delete this.targetPos[creep.id];
    }
};

module.exports = Lance;