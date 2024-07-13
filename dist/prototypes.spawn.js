const granary = require('granary');


//For Granary
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
if (!StructureSpawn.prototype._spawnCreep) {
    StructureSpawn.prototype._spawnCreep = StructureSpawn.prototype.spawnCreep;

    StructureSpawn.prototype.spawnCreep = function(body,name,opts = {}) { 
        let cost = body.reduce((total,part) => total + BODYPART_COST[part],0)

        let spawnCall = this._spawnCreep(body, name, opts);
        if(spawnCall == OK) granary.adjustIncome(this,cost)
        return spawnCall;
    };
}