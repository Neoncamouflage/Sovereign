const profiler = require('screeps-profiler');
const ledger = {
    addPlayer: function(player,options={}){
        let entry = {name:player};
        let entryNumber = Math.max(Object.keys(Memory.ledger),0) + 1;
 
        //Higher bounty encourages attacks on the player
        entry.bounty = options.bounty || 0;
        //Higher danger indicates we're likely to lose a fair fight. 1-100 scale, 10 is standard.
        entry.danger = options.danger || 10;
        //Relationship status. 0 is normal, 1 is ally, 2 is hostile.
        entry.standing = options.standing || 0;

        //Insert the entry and add the name:number to the reverse reference
        Memory.ledger[entryNumber] = entry;
        Memory.ledgerRef[player] = entryNumber;
    },
}

module.exports = ledger;
profiler.registerObject(ledger, 'ledger');