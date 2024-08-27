const granary = require('granary');


//For Granary
if (!StructureSpawn.prototype._spawnCreep) {
    StructureSpawn.prototype._spawnCreep = StructureSpawn.prototype.spawnCreep;

    StructureSpawn.prototype.spawnCreep = function(body,name,opts = {}) { 
        let cost = body.reduce((total,part) => total + BODYPART_COST[part],0)

        let spawnCall = this._spawnCreep(body, name, opts);
        if(spawnCall == OK) granary.adjustIncome(this,cost*-1)
        return spawnCall;
    };
}