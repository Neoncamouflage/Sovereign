const granary = require('granary');
/*
Prototype ToDO
take - Withdraws a resource from a structure, defaults to all
give - Transfer a resource to a structure, defaults to all
store = Transfer a resource to closest room storage (terminal/storage/maybe cans), defaults to all
navTo - Travel to a room without picking a random spot inside it that might be in a wall
return - Return and recycle/sucide into FF can
*/

//#region Granary Modifications
//#endregion

if (!Creep.prototype._harvest) {

    //Store the original method
    Creep.prototype._harvest = Creep.prototype.harvest;

    //Create our new function
    Creep.prototype.harvest = function(target) {
        //Store whatever is lower, total energy of target or our total harvest
        let tEnergy = 0;
        if(target.energy) tEnergy= Math.min(target.energy,(this.getActiveBodyparts(WORK) * HARVEST_POWER))

        //Call the actual harvest
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
        if(target.progress) tEnergy= Math.min((target.progressTotal-target.progress),(this.getActiveBodyparts(WORK) * BUILD_POWER))
        tEnergy = tEnergy*-1
        //Call the actual harvest
        let buildCall = this._build(target);
        //If success, register the expense
        if(buildCall == OK) granary.adjustIncome(this,tEnergy)

        return buildCall
    }
}

if (!Creep.prototype._upgradeController) {
    //Store the original method
    Creep.prototype._upgradeController = Creep.prototype.upgradeController;

    //Create our new function
    Creep.prototype.upgradeController = function(target) {
        //Store whatever is lower, progress left to build or our build cost
        let tEnergy = this.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER
        tEnergy = tEnergy*-1
        //Call the actual harvest
        let upCall = this._upgradeController(target);
        //If success, register the expense
        if(upCall == OK) granary.adjustIncome(this,tEnergy)

        return upCall
    }
}




//#region New Prototypes

//#endregion
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

    if(storage && storage.store.getFreeCapacity() > 0){
        if(this.pos.getRangeTo(storage) > 1){
            this.travelTo(storage);
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
        }
        else{
            for(const thisType in this.store) {
                let g = this.transfer(terminal, thisType)
                break;
            }
        }
    }
};

//Dumps creep inventory except for specified resource, to be used with terminal/storage
Creep.prototype.dumpAndGet = function (target,resourceType, amount) {
    resourceType = resourceType || RESOURCE_ENERGY;
    amount = amount || this.store.getCapacity();
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
        this.withdraw(target,resourceType,amount - this.store.getUsedCapacity(resourceType))
        return 'withdraw'
    }
};