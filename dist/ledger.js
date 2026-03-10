const profiler = require('screeps-profiler');
const ledger = {
    standingNameRef : {
        'unaligned':0,
        'peace':1,
        'ally':2
    },
    standingNumRef:{
        0:'Unaligned',
        1:'Peace',
        2:'Ally'
    },
    readLedger: function(username=false){
        let readList = [];
        if(!username) readList = Object.keys(Memory.ledger);
        else readList.push(username);
        let logMessage = '';
        for(const player of readList){
            let playerData = Memory.ledger[player];
            if(!playerData){
                logMessage+=`\n -----${player}----- \nNO RECORDS`
                continue;
            }
            logMessage+=`\n\n -----${player}-----\nStanding: ${this.standingNumRef[playerData.standing]}`
            logMessage+=`\nBounty: ${playerData.bounty}\nDanger: ${playerData.danger}`
            logMessage+=`\nKnown Rooms: ${Object.keys(playerData.rooms)}\nKnown Remotes: ${Object.keys(playerData.remotes)}`
        }
        chronicle.log(logMessage,'ledger',3);
    },
    addPlayer: function(username,options={}){
        let entry = {name:username};
        //Assigned a number when they enter the ledger
        let entryNumber = Math.max(Object.keys(Memory.ledger),0) + 1;
        //Higher bounty encourages attacks on the player
        //Perhaps have house-specific bounties?
        entry.bounty = options.bounty || 0;
        //Higher danger indicates we're likely to lose a fair fight. 1-100 scale, 10 is standard.
        entry.danger = options.danger || 10;
        //Relationship status. 0 is normal, 1 is whitelist, 2 is ally.
        entry.standing = options.standing || 0;
        //For now, rooms and remotes are just the name as the key and true as the value
        //Simply so we can add/remove based on key lookup
        entry.rooms = options.rooms || {};
        entry.remotes = options.remotes || {};

        //Insert the entry and add the name:number to the reverse reference
        Memory.ledger[username] = entry;
        //We store the entry number in things like scouting data, so we need a reverse lookup
        Memory.ledgerRef[entryNumber] = username;
        chronicle.log(`Player ${username} added to ledger.`,'ledger',3)
    },
    changeRoom: function(username,change,type,room,options={}){
        let changeType;
        if(!Memory.ledger[username]) this.addPlayer(username);
        if(['holding','remotes','remote','holdings',].includes(type)) changeType = 'remotes';
        else if(['fief','rooms','fiefs','room',].includes(type)) changeType = 'rooms';
        else{
            console.log("Wrong type for ledger room change");
            return;
        }
        if(change == 'add'){
            Memory.ledger[username][type][room] = true;
        }
        if(change == 'remove'){
            delete Memory.ledger[username][type][room];
        }
        chronicle.log(`Room update for ${username}: ${changeType} ${room}.`,'ledger',3);
    },
    changeDanger: function(username,amount,options={}){
        if(!Memory.ledger[username]) this.addPlayer(username);
        Memory.ledger[username].danger += amount;
        chronicle.log(`Danger update for ${username}: ${amount}. New danger: ${Memory.ledger[username].danger}.`,'ledger',3);
    },
    changeBounty: function(username,amount,options={}){
        if(!Memory.ledger[username]) this.addPlayer(username);
        Memory.ledger[username].bounty += amount;
        chronicle.log(`Bounty update for ${username}: ${amount}. New bounty: ${Memory.ledger[username].bounty}.`,'ledger',3);
    },
    setStanding: function(username,standing,options={}){
        if(!Memory.ledger[username]) this.addPlayer(username);
        //If we were given a name, flip it to the number
        if(this.standingNameRef[standing])standing = this.standingNameRef[standing]
        Memory.ledger[username].standing = standing;
        chronicle.log(`Standing update for ${username}. Changed to: ${this.standingNumRef[standing]}.`,'ledger',3);
    },
    //Initial population of ledger from existing scout data. Console specific.
    populateLedger: function(){
        for(const room of Object.keys(heap.scoutData)){
            let roomData = getScoutData(room);
            if(roomData.roomType == 'fief'){
                this.changeRoom(roomData.owner,'add','rooms',room);
            }
        }
    }

}

module.exports = ledger;
profiler.registerObject(ledger, 'ledger');