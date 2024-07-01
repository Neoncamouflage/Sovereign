const granary = {
    GRAN_MAX: 12,
    //Calculates planned and trailing average energy income/expense for a room
    getIncome: function(fief){
        if(!global.heap.granary.fief || !global.heap.granary.fief.length) return [0,0]
        let fiefList = global.heap.granary.fief;
        let plannedNet = fiefList[0].amount
        let averageNet = fiefList.reduce((sum,item) => sum+item.amount,0) / fiefList.length;

        //Check how long the list is and trim if below our max
        if(fiefList.length > this.GRAN_MAX) fiefList.length = this.GRAN_MAX

        return [plannedNet,averageNet]
    },
    //Registers income/expense for a room
    adjustIncome: function(creep,amount){
        // -- To Add --
        //Repair
        //Upgrade
        //Spawn
        if(!global.heap.granary){
            console.log("NO GRANARY!");
            return;
        }
        let fief = creep.memory.fief
        if(!global.heap.granary.fief) global.heap.granary.fief = []
        let track = global.heap.granary.fief;
        //Pulls track[0] if it's from this tick, otherwise makes a new one
        let thisTrack = track[0] && track[0].tick == Game.time && track.shift() || {'fief':fief,tick:Game.time,total:0};

        //For now just track an integer for that tick, may want to get more granular down the road
        thisTrack.total += amount;

        //Pop it to the front of the queue
        track.unshift(thisTrack)
        

    },
}

module.exports = granary;
//Modify prototypes to record energy changes
if (!Creep.prototype._harvest) {

    //Store the original method
    Creep.prototype._harvest = Creep.prototype.harvest;

    //Create our new function
    Creep.prototype.harvest = function(target) {
        //Store whatever is lower, total energy of target or our total harvest
        let tEnergy = 0;
        if(target.energy) tEnergy= Math.min(target.energy,(this.body.getActiveBodyparts(WORK) * HARVEST_POWER))

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
        if(target.progress) tEnergy= Math.min((target.progress-target.progressTotal),(this.body.getActiveBodyparts(WORK) * BUILD_POWER))

        //Call the actual harvest
        let buildCall = this._build(target);

        //If success, register the expense
        if(buildCall == OK) granary.adjustIncome(this,tEnergy*-1)

        return buildCall
    }

}