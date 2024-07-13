
//Gets the value of all lootable resources in a room
//Can optionally split the results based on rampart protection
Room.prototype.getLoot = function (consideRamparts=false) {
    if(this.memory.loot && this.memory.loot.tick < Game.time - 50){
        return this.memory.loot;
    }
    //Set up loot object and split room structures into lootables and ramparts
    let loot ={totalCredit:0,structures:{},resources:{}};
    let [lootStructs,ramps] = this.find(FIND_STRUCTURES).reduce((pair,each) => {
        if(each.store){
            pair[0].push(each)
        }
        else if(each.structureType == STRUCTURE_RAMPART){
            pair[1].push(each)
        }
        return pair;
    },[[],[]]);

    for(let each of lootStructs){
        loot.structures[each.id] = loot.structures[each.id] || {};
        for([resource,resourceAmount] of Object.entries(each.store)){
            let lootbag = loot.structures[each.id];
            let money = getPrice(resource);
            console.log(money)
            lootbag[resource] = {amount:resourceAmount,credits:money*resourceAmount}
            if(money) loot.totalCredit += Number(money*resourceAmount);
            loot.resources[resource] = (loot.resources[resource] || 0) + resourceAmount;
        }
    }
    this.memory.loot = loot;
    return loot;

    function getPrice(resource){
        let avgs = Game.market.getHistory(resource);
        let total = 0;
        console.log("GETPRICE TOTAL",total)
        if(!avgs.length) return 0;
        for(av of avgs){
            total+=av.avgPrice;
        }
        console.log("GETPRICE END",total,avgs.length,total/avgs.length)
        return total/avgs.length
    }
}