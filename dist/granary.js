const granary = {
    GRAN_MAX: 12,
    //Calculates planned and trailing average energy income/expense for a room
    getIncome: function(fief){
        if(!global.heap.granary[fief] || !global.heap.granary[fief].length) return [0,0]
        let fiefList = global.heap.granary[fief];
        let plannedNet = fiefList[0].total
        let averageNet = fiefList.reduce((sum,item) => sum+item.total,0) / fiefList.length;

        //Check how long the list is and trim if below our max
        if(fiefList.length > this.GRAN_MAX) fiefList.length = this.GRAN_MAX

        return [plannedNet,averageNet]
    },
    //Registers income/expense for a room
    adjustIncome: function(source,amount){
        // -- To Add --
        //Repair
        //Upgrade
        //Spawn
        if(!global.heap.granary){
            console.log("NO GRANARY!");
            return;
        }
        //If a room object, get its room name. Otherwise it's a creep, so get its fief.
        let fief = source instanceof RoomObject ? source.room.name : source.memory.fief;
        if(!global.heap.granary[fief]) global.heap.granary[fief] = []
        let track = global.heap.granary[fief];
        //Pulls track[0] if it's from this tick, otherwise makes a new one
        let thisTrack = track && track[0] && track[0].tick == Game.time && track.shift() || {tick:Game.time,total:0};

        //For now just track an integer for that tick, may want to get more granular down the road
        thisTrack.total += amount;

        //Pop it to the front of the queue
        track.unshift(thisTrack)
        

    },
}

module.exports = granary;