const spinup = {
    run: function(){
        global.heap = {};
        Memory.globalReset = Game.time;
        Memory.me = 'NeonCamouflage';
        Memory.diplomacy = {allies:[], ceasefire:[], outlaws:[],ledger:[]}
        Memory.kingdom = {};
        Memory.kingdom.holdings = {};
        Memory.kingdom.fiefs = {};
        Memory.kingdom;
        Memory.hardSpawns;
        Memory.kingdom.army = {troupes:[],missions:{},reserve:[]};
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

        Memory.structureFromNumReference = {
            100:STRUCTURE_RAMPART,
            15:STRUCTURE_NUKER,
            14:STRUCTURE_FACTORY,
            13:STRUCTURE_POWER_SPAWN,
            12:STRUCTURE_LINK,
            11:STRUCTURE_LAB,
            10:STRUCTURE_TERMINAL,
            9:STRUCTURE_WALL,
            8:STRUCTURE_TOWER,
            7:STRUCTURE_EXTRACTOR,
            6:STRUCTURE_EXTENSION,
            5:STRUCTURE_OBSERVER,
            4:STRUCTURE_STORAGE,
            3:STRUCTURE_SPAWN,
            2:STRUCTURE_CONTAINER,
            1:STRUCTURE_ROAD,
        };
        Memory.structureToNumReference = {
            [STRUCTURE_RAMPART]:100,
            [STRUCTURE_NUKER]:15,
            [STRUCTURE_FACTORY]:14,
            [STRUCTURE_POWER_SPAWN]:13,
            [STRUCTURE_LINK]:12,
            [STRUCTURE_LAB]:11,
            [STRUCTURE_TERMINAL]:10,
            [STRUCTURE_WALL]:9,
            [STRUCTURE_TOWER]:8,
            [STRUCTURE_EXTRACTOR]:7,
            [STRUCTURE_EXTENSION]:6,
            [STRUCTURE_OBSERVER]:5,
            [STRUCTURE_STORAGE]:4,
            [STRUCTURE_SPAWN]:3,
            [STRUCTURE_CONTAINER]:2,
            [STRUCTURE_ROAD]:1,
        }
    }
}

module.exports = spinup;