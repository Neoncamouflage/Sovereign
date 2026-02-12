const granary = require('granary');
const registry = require('registry');
const Traveler = require('Traveler')
/*
Prototype ToDO
take - Withdraws a resource from a structure, defaults to all
give - Transfer a resource to a structure, defaults to all
store = Transfer a resource to closest room storage (terminal/storage/maybe cans), defaults to all
navTo - Travel to a room without picking a random spot inside it that might be in a wall
return - Return and recycle/sucide into FF can
*/

//Make Creep.say() public by default
Creep.prototype._say = Creep.prototype.say;
Creep.prototype.say = function(message, public = true) {
    return this._say(message, public);
};

//#region Granary Modifications
//#endregion

if (!Creep.prototype._harvest) {

    //Store the original method so we can call it after our custom logic
    Creep.prototype._harvest = Creep.prototype.harvest;

    //Create our new function
    Creep.prototype.harvest = function(target) {
        //Store whatever is lower, total energy of target or our total harvest
        let tEnergy = 0;
        if(target && target.energy) tEnergy= Math.min(target.energy,(this.getActiveBodyparts(WORK) * HARVEST_POWER))

        //Call the real harvest
        let harvCall = this._harvest(target);

        //If success, register the income
        if(harvCall == OK) granary.adjustIncome(this,tEnergy)

        return harvCall
    }

}

if (!Creep.prototype._build) {
    //Store the original method
    Creep.prototype._build = Creep.prototype.build;

    //Create our new function
    Creep.prototype.build = function(target) {
        //Store whatever is lower, progress left to build or our build cost
        let tEnergy = 0;
        if(target && target.progress) tEnergy= Math.min((target.progressTotal-target.progress),(this.getActiveBodyparts(WORK) * BUILD_POWER))
        tEnergy = tEnergy*-1
        //Call the actual build
        let buildCall = this._build(target);
        //If success, register the expense
        if(buildCall == OK) granary.adjustIncome(this,tEnergy)

        return buildCall
    }
}

if (!Creep.prototype._transfer) {
    //Store the original method
    Creep.prototype._transfer = Creep.prototype.transfer;

    //Create our new function
    Creep.prototype.transfer = function(target, resourceType, amount) {
        //If we're refilling energy then update the maps
        if (target instanceof Structure && [STRUCTURE_EXTENSION, STRUCTURE_SPAWN].includes(target.structureType)) {
            const fiefData = heap.fiefs[this.room.name];
            
            if (fiefData && fiefData.extensionMap && fiefData.extensionMap.has(target.id)) {
                const updateSpots = fiefData.extensionMap.get(target.id);
                
                //Loop through all spots and remove the extensions from their maps
                for (let spot of updateSpots) {
                    // Check both maps and handle consistently
                    const maps = [
                        { name: 'sourceRefills', map: fiefData.sourceRefills },
                        { name: 'otherRefills', map: fiefData.otherRefills }
                    ];
                    
                    for (const mapData of maps) {
                        if (mapData.map && mapData.map.has(spot)) {
                            const extensions = mapData.map.get(spot);
                            extensions.delete(target.id);
                            
                            //If the set is now empty just delete the key from the map entirely
                            if (extensions.size === 0) {
                                mapData.map.delete(spot);
                                
                                //Clear creep memory if this was the target spot
                                if (this.memory.refillTarget === spot) {
                                    delete this.memory.refillTarget;
                                }
                            } else {
                                mapData.map.set(spot, extensions);
                            }
                        }
                    }
                }
            }
        }
        
        //Call the actual transfer
        let transferCall;
        //Only include amount if it was included originally
        if (amount !== undefined) {
            transferCall = this._transfer(target, resourceType, amount);
        } else {
            transferCall = this._transfer(target, resourceType);
        }
        
        //Return the response
        return transferCall;
    }
}

if (!Creep.prototype._upgradeController) {
    //Store the original method
    Creep.prototype._upgradeController = Creep.prototype.upgradeController;

    //Create our new function
    Creep.prototype.upgradeController = function(target) {
        //Store upgrade power
        let tEnergy = this.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER
        tEnergy = tEnergy*-1
        //Call the actual upgrade
        let upCall = this._upgradeController(target);
        //If success, register the expense
        if(upCall == OK) granary.adjustIncome(this,tEnergy)

        return upCall
    }
}




//#region New Prototypes

//#endregion

//Gets applicable boosts for body
Creep.prototype.getBoostOptions = function(){
    const boosts = {};
    //Object containing unboosted bodypart counts
    const bodyParts = {};
    for (const part of this.body) {
        
        if (!bodyParts[part.type]) {
            bodyParts[part.type] = 0;
        }
        if (!part.boost) {
            bodyParts[part.type]++;
        }
    }

    for (const partType of Object.keys(bodyParts)) {
        //Get all boosts for the part type
        if (BOOSTS[partType]) {
            const count = bodyParts[partType];
            
            //Add possible boosts to object
            for (const boostType in BOOSTS[partType]) {
                if (!boosts[boostType]) {
                    boosts[boostType] = 0;
                }
                boosts[boostType] += count;
            }
        }
    }
    return boosts;
}

//Respawns creep
Creep.prototype.respawn = function({ticks=250,sev=50} = {}) {
    if(Game.time % 3 == 0 && this.ticksToLive <= ticks && !this.memory.respawn) {
        const memoryCopy = JSON.parse(JSON.stringify(this.memory));
        registry.requestCreep({
            sev: sev,
            body: this.body.map(part => part.type),
            memory: memoryCopy,
            respawn: this.id
        });
    }
}
//Gets a resource up to a target amount
//If unspecified, resource is energy, amount is full carry
Creep.prototype.goGet = function (target,resourceType, amount) {
    resourceType = resourceType || RESOURCE_ENERGY;
    amount = amount || this.store.getCapacity();
    //If we're too far away, go to the target
    if(this.pos.getRangeTo(target) > 1){
        this.travelTo(target);
    }
    //Otherwise, see if free capacity is enough to get us up to the amount
    //We do this in case we're carrying other things we don't want to lose
    else if(this.store.getFreeCapacity() >= amount - this.store.getUsedCapacity(resourceType)){
        //If so, take it
        this.withdraw(target,resourceType,amount - this.store.getUsedCapacity(resourceType))
    }
    //If not, see if we would have enough but there's other stuff
    //else if(this.store.getCapacity() >= amount){

    //}
};

//Empties store into storage or terminal
Creep.prototype.emptyStore = function () {
    let storage = this.room.storage;
    let terminal = this.room.terminal;
    let fief = Game.rooms[this.memory.fief];
    /*if(Memory.kingdom.fiefs[this.room.name] && this.store.getUsedCapacity(RESOURCE_ENERGY) > 0){
        let fills = this.room.find(FIND_MY_STRUCTURES,{filter: 
            (structure) => [STRUCTURE_SPAWN,STRUCTURE_EXTENSION].includes(structure.structureType) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        let target = this.pos.getClosestByTileDistance(fills);
        if(target){
            if(this.pos.getRangeTo(target) == 1){
                this.transfer(target,RESOURCE_ENERGY)
            }
            else{
                this.travelTo(target)
            }
            return;
        }
    }*/

    if(!Memory.kingdom.fiefs[this.room.name] && (fief.storage || fief.terminal)){

        if(fief.storage){
            this.travelTo(fief.storage)
        }
        else if(fief.storage){
            this.travelTo(fief.storage)
        }
    }
    //If we're just chilling with energy, see what we can fill
    else if(this.room.name != this.memory.fief){
        this.travelTo(new RoomPosition(25,25,this.memory.fief))
    }
    else if(Object.keys(this.store)[0] != RESOURCE_ENERGY){
        if(terminal && terminal.store.getFreeCapacity() > 0){
            if(this.pos.getRangeTo(terminal) > 1){
                this.travelTo(terminal);
                this.canRelay = true;
            }
            else{
                for(const thisType in this.store) {
                    let g = this.transfer(terminal, thisType)
                    break;
                }
            }
        }
        else if(storage && storage.store.getFreeCapacity() > 0){
            if(this.pos.getRangeTo(storage) > 1){
                this.travelTo(storage);
                this.canRelay = true;
            }
            else{
                for(const thisType in this.store) {
                    this.transfer(storage, thisType);
                    break;
                }
            }
        }
        else{
            this.drop(Object.keys(this.store)[0])
        }
    }
    else if(storage || terminal){
        if(storage && storage.store.getFreeCapacity() > 0){
            if(this.pos.getRangeTo(storage) > 1){
                this.travelTo(storage);
                this.canRelay = true;
            }
            else{
                for(const thisType in this.store) {
                    this.transfer(storage, thisType);
                    break;
                }
            }
        }
        else if(terminal && terminal.store.getFreeCapacity() > 0){
            if(this.pos.getRangeTo(terminal) > 1){
                this.travelTo(terminal);
                this.canRelay = true;
            }
            else{
                for(const thisType in this.store) {
                    let g = this.transfer(terminal, thisType)
                    break;
                }
            }
        }
    }
};

//Dumps creep inventory except for specified resource, to be used with terminal/storage
Creep.prototype.dumpAndGet = function (target,resourceType) {
    resourceType = resourceType || RESOURCE_ENERGY;
    //If we're too far away, go to the target
    if(this.pos.getRangeTo(target) > 1){
        this.travelTo(target);
    }
    //Otherwise, see if we're carrying more stuff than our target resource
    else if(this.store.getUsedCapacity() > this.store.getUsedCapacity(resourceType)){
        //If so, dump whatever isn't our target
        for(const thisType in this.store) {
            if (thisType != resourceType) {
                this.transfer(target, thisType)
                return 'transfer'
            }
        }
    }
    //If we're good, withdraw up to whatever we need
    else{
        this.withdraw(target,resourceType)
        this.memory.state = 'dropoff'
        return 'withdraw'
    }
};

//Attempts to shove the target creep. Returns creep at the end of the shove chain
Creep.prototype.shove = function(targetCreep,originSpace,depth=0){
    depth++
    if(depth > 10){
        console.log("SHOVE ERROR, DEPTH EXCEEDED")
        return false;
    }
    let secondPos;
    let secondCheck;
    //Reference for how far/close creeps want to be from their target
    const rangeRef = {
        'builder':3,
        'upgrader':3,
        'repair':3,
        'miner':1,
        'harvester':1,
        'claimer':1,
        'diver':3
    }
    //Check for travel data to avoid just shoving along the path it wants to go next
    let travelData = this.memory._trav
    if (!originSpace && travelData && travelData.path && travelData.path.length > 1) {
        secondPos = Traveler.positionAtDirection(targetCreep.pos,Number(travelData.path[1]));
    }

    //If no origin space, this is the first shove, so we set it
    if(!originSpace)originSpace = this.pos
    //Priority spots we try first, the other of the rest
    let priorityCreepSpots = []
    let otherSpots = []
    let otherCreepSpots = []
    //chronicle.log(`${creep} pushing ${targetCreep} - Origin ${originSpace} - Depth ${depth}`,'Creep.shove',4)
    if(!targetCreep){
        console.log("BAD PUSH, NO CREEP",this.name,this.pos,depth);
        return false;
    }
    //Creeps that want to stay in a specific area have a target in memory.
    let otherTarget = targetCreep.memory && Game.getObjectById(targetCreep.memory.target);
    let preferredRange = rangeRef[targetCreep.memory.role] || 3

    //Fill arrays with every available space around the target creep
    for(let x=-1;x<=1;x++){
        tileLoop:
        for(let y=-1;y<=1;y++){
            if((x==0 && y==0))continue;
            let newX = targetCreep.pos.x+x;
            let newY = targetCreep.pos.y+y;
            //No moving to room edges
            if(newX < 1 || newY < 1 || newX > 48 || newY > 48)continue;
            //console.log(x,newX,y,newY,this.room.name)
            let newPos = new RoomPosition(newX,newY,this.room.name)
            
            
            let tileStuff = this.room.lookAt(newX,newY);
            let tileCreep;
            for(let each of tileStuff){
                //Skip walls
                if(each.type == 'terrain' && each.terrain == 'wall')continue tileLoop;
                //If it's a non-origin space creep and it was already shoved, we can't move there, so skip
                if(each.type == 'creep' && !newPos.isEqualTo(originSpace) && each.creep.shoved)continue tileLoop;
                //If it's a fatigued creep, we can't move there, so we skip
                if(each.type == 'creep' && each.creep.fatigue != 0)continue tileLoop;
                //If it's a structure we can't walk on, skip
                if (each.type === 'structure') {
                    const st = each.structure.structureType;
                    if (st === STRUCTURE_ROAD || st === STRUCTURE_CONTAINER) {
                        //These are always fine
                    } else if (st === STRUCTURE_RAMPART) {
                        //Ramparts block if not mine and not public
                        if (!each.structure.my && !each.structure.isPublic) continue tileLoop;
                    } else {
                        continue tileLoop;
                    }
                }
                //If it's a non-origin space creep and it was not shoved, assign the creep if it'sm ine
                if(each.type == 'creep' && each.creep.my && !newPos.isEqualTo(originSpace)) tileCreep = each.creep;
            }
            //If it's the next step in the shover's path, avoid for now
            if(secondPos && newPos.isEqualTo(secondPos)){
                secondCheck = tileCreep || 'empty';
                continue;
            }
            
            //Add to arrays based on range and creep presence. Creep arrays get an object so we can sort by tileCreep priority
            if(otherTarget && newPos.getRangeTo(otherTarget) > preferredRange){
                if(tileCreep && !Traveler.getMovementIntent(tileCreep.name)){
                    otherCreepSpots.push(tileCreep)
                }
                else{
                    otherSpots.push(newPos)
                }
            }
            else{
                //If we find a priority spot with no creep or the creep intends to move, we just move to it.
                //Otherwise we add it to the list
                if(tileCreep && !Traveler.getMovementIntent(tileCreep.name)){
                    priorityCreepSpots.push(tileCreep)
                }
                else{
                    //console.log("Priority spot found, moving to it",newPos,targetCreep)
                    //Update shoved status, move this creep and the target, and return the shoved creep
                    this.move(this.pos.getDirectionTo(targetCreep.pos))
                    targetCreep.move(targetCreep.pos.getDirectionTo(newPos));
                    targetCreep.shoved = true;
                    return targetCreep;
                }
            }
        }
    }
    //Sort the creep arrays by priority in ascending order
    priorityCreepSpots.sort((a, b) => (a.memory.priority || PRIORITY_REF[a.memory.role] || 0) - (b.memory.priority || PRIORITY_REF[b.memory.role] || 0))
    otherCreepSpots.sort((a, b) => (a.memory.priority || PRIORITY_REF[a.memory.role] || 0) - (b.memory.priority || PRIORITY_REF[b.memory.role] || 0))
    //Try to shove the priority creeps
    for(let priorityCreep of priorityCreepSpots){
        let shoveResult = targetCreep.shove(priorityCreep,originSpace,depth);
        //If we got a result, the targetCreep shoved and moved. We update the target's shove status and move this creep
        if(shoveResult){
            this.move(this.pos.getDirectionTo(targetCreep.pos))
            targetCreep.shoved = true;
            return shoveResult;
        }
    }
    //If all failed, we check for other open spots to move to
    //If available, just pick the first one
    if(otherSpots.length){
        //console.log("Other open spot found, moving to it",targetCreep.pos,targetCreep)
        targetCreep.move(targetCreep.pos.getDirectionTo(otherSpots[0]))
        this.move(this.pos.getDirectionTo(targetCreep.pos))
        targetCreep.shoved = true;
        return targetCreep;
    }
    //Finally, we check for other creeps to shove
    for(let otherCreep of otherCreepSpots){
        //console.log("Shove found",otherCreep,targetCreep)
        let shoveResult = targetCreep.shove(otherCreep,originSpace,depth);
        //If we got a result, the targetCreep shoved and moved. We update the target's shove status and move this creep
        if(shoveResult){
            this.move(this.pos.getDirectionTo(targetCreep.pos))
            targetCreep.shoved = true;
            return shoveResult;
        }
    }
    //Failed to shove anywhere
    //Final check to see if we can go to the next in the path, if that was a delayed option
    if(secondCheck){
        //console.log("Next in path open spot found, moving to it",secondPos,targetCreep)
        if(secondCheck == 'empty'){
            targetCreep.move(targetCreep.pos.getDirectionTo(secondPos))
            targetCreep.shoved = true;
            return targetCreep;
        }
        else{
            //console.log("Next in path shove found",secondCheck,targetCreep)
            let shoveResult = targetCreep.shove(secondCheck,originSpace,depth);
            //If we got a result, the targetCreep shoved and moved. We update the target's shove status and move this creep
            if(shoveResult){
                this.move(this.pos.getDirectionTo(targetCreep.pos))
                targetCreep.shoved = true;
                return shoveResult;
            }
        }
    }
    return false
}

//Tows another creep to a target location
Creep.prototype.tow = function (targetCreep,targetLocation) {
    let isObject = targetLocation instanceof RoomObject;
    let RoomPosition = targetLocation instanceof RoomPosition;
    if(this.pos.getRangeTo(targetCreep)==1){
        //If it's an object, then we just want to be in range 1 of it:
        if(isObject){
            //If we're at the spot, try to swap places with the target creep
            if(this.pos.getRangeTo(targetLocation) == 1){
                this.move(this.pos.getDirectionTo(targetCreep))
            }
            //Else keep going
            else{
                this.travelTo(targetLocation,{ignoreCreeps:false})
            }
        }
        //If not, we're going to the spot itself
        else{   
            //If we're at the spot, try to swap places with the target creep
            if(this.pos.isEqualTo(targetLocation)){
                this.move(this.pos.getDirectionTo(targetCreep))
                
            }
            //Else keep going
            else{
                this.travelTo(targetLocation,{ignoreCreeps:false,range:0})
            }
        }
        targetCreep.move(targetCreep.pos.getDirectionTo(this));
        this.pull(targetCreep);
    }
    //If not in range, go to the target creep
    else{
        this.travelTo(targetCreep)
    }
};