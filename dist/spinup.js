const spinup = {
    run: function(){
        global.heap = {};
        Memory.globalReset = Game.time;
        Memory.me = 'NeonCamouflage';
        Memory.diplomacy = {allies:[], ceasefire:[], outlaws:[],ledger:[]}
        Memory.kingdom = {};
        Memory.kingdom.holdings = {};
        Memory.kingdom.fiefs = {};
        for(const room in Game.rooms){
            let myRoom = Game.rooms[room];
            if(myRoom.controller && myRoom.controller.my){
                Memory.kingdom.fiefs[myRoom.name] = {};
            }
        }

        Memory.scoreWeights = {
            rampTileWeight:2,
            rampDistWeight:0.2,
            controllerDistWeight:3,
            sourceDistWeight:0.3,
            extensionDistWeight:2,
            extensionMaxWeight:1,
            extensionMissingWeight:8,
            controllerFoundWeight:100,
            sourceFoundWeight:25,
            structureFoundWeight:500
        }

        //Creep speech options
        Memory.creepTalk = {
            'idle':[
                '💤',

            ]
        }
        
        Memory.icons = {
            harvester: '⛏️',
            soldier:'👮',
            fastFiller:'✉️',
            remoteDefender:'🛡️',
            guard: '🛡️',
            upgrader:'⏫',
            gunner:'💥',
            boost: '⏫',
            runner: '🚚',
            harvGrader:'⛏️',
            starter:'👶',
            builder:'👷',
            marauder:'🏴‍☠️',
            claimer:'📌',
            dualHarv:'⛏️',
            hauler:'📦',
            lowHauler:'📦',
            trucker:'🛢️',
            generalist:'🚚',
            hunter:'⚔️',
            ranger:'🏹',
            miner:'⛏️',
            diver:'☢️',
            bait:'☢️',
            duo:'👮',
            settler:'🚚',
            manager:'🗃️',
            extractor:'👮',
            scout:'🧭'
        };

        Memory.roomPlanReference = {
            100:STRUCTURE_RAMPART,
            99:STRUCTURE_ROAD,
            98:STRUCTURE_STORAGE,
            97:STRUCTURE_FACTORY,
            96:STRUCTURE_POWER_SPAWN,
            95:STRUCTURE_LINK,
            94:STRUCTURE_TERMINAL,
            93:STRUCTURE_WALL,
            88:STRUCTURE_TOWER,
            87:STRUCTURE_EXTRACTOR,
            76:STRUCTURE_LAB,
            75:STRUCTURE_LAB,
            60:STRUCTURE_EXTENSION,
            45:STRUCTURE_OBSERVER,
            44:STRUCTURE_NUKER,
            33:STRUCTURE_SPAWN,
            12:STRUCTURE_CONTAINER,
        };
    }
}

module.exports = spinup;