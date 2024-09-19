const fiefManager = require('fiefManager');
const holdingManager = require('holdingManager');
const roleGeneralist = require('role.generalist');
const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleClaimer = require('role.claimer');
const roleMiner = require('role.miner')
const roleRemotedefender = require('role.remoteDefender');
const roleGuard = require('role.guard');
const roleDiver = require('role.diver');
const roleRaider =  require('role.raider')
const roleBait = require('role.bait');
const roleDuo = require('role.duo')
const statusManager = require('statusManager');
const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const supplyDemand = require('supplyDemand');
const registry = require('registry');
const granary = require('granary');
const intelManager = require('intelManager');
const painter = require('painter');
const marshal = require('marshal');
const kingdomManager = {
    run:function(){
        // - Assignments -
        //Status object for room visuals

        //Military Management
        //Lance - S of creeps with the same task (quad, duo, hauler convoy, etc.)
        //Troupe - Group of Lances with the same objective but different tasks (melee duo + ranged support, duo + hauler convoy for power banks, etc.)
        //ArmyManager - Strategic logic vs tactical for Lances/Troupes, mission management level. Handles strength calculations, Lance/Troupe requests/assignments, attack/retreat, etc.
        //SiegeManager - Handles room defense in the event of a siege. Takes control of all room elements, including army units.


        //Assign creeps to their fiefs and sort by role
        kingdomCreeps = sortCreeps();
        global.heap.army.reserve = kingdomCreeps.reserve || [];
        //console.log("Kingdom creeps!")
        //console.log(JSON.stringify(kingdomCreeps))
        // - Actions - 
        //Run scouting
        intelManager.run(kingdomCreeps.scouts ? kingdomCreeps.scouts : [],Object.keys(Memory.kingdom.fiefs))
        //Loop through all fiefs and holdings and run their respective manager
        //Holdings first so we can run the registry for each fief in the same loop
        marshal.run(kingdomCreeps);
        holdingManager.run(kingdomCreeps);
        //Every 300 ticks, check for a funnel target
        if(false && Game.time % 300 == 0){
            let funnels = Object.values(Game.rooms).filter(rm => rm.controller && rm.controller.my && rm.controller.level == 6)
            let fRoom = funnels.reduce((maxRoom, room) => {
                return (maxRoom === null || room.controller.progress > maxRoom.controller.progress) ? room : maxRoom;
            }, null);
            global.heap.funnelTarget = fRoom == null ? null : fRoom.name;
        }

        global.heap.stock = { ...global.heap.kingdomStatus.wares };
        global.heap.kingdomStatus.wares = {};
        for(const fief in Memory.kingdom.fiefs){
            supplyDemand.prepShipping(fief);
            kingdomCreeps[fief] = kingdomCreeps[fief] || [];
            //Make sure fief is live, remove if not
            if(!Game.rooms[fief] || !Game.rooms[fief].controller.my){
                console.log("Removing dead fief ",fief);
                delete Memory.kingdom.fiefs[fief];
                continue;
            }
            
            global.heap.kingdomStatus[fief] = fiefManager.run(Game.rooms[fief],kingdomCreeps[fief]);
            //Manage shipping tasks
            supplyDemand.manageShipping(fief,kingdomCreeps[fief]['hauler'] || []);
            //Run spawn logic every 3 ticks
            registry.calculateSpawns(Game.rooms[fief],kingdomCreeps[fief]);
        }

        
        /*for(const settle in Memory.kingdom.settlements){
            return;
            //Figure this out for future settlements
            let settler = Memory.kingdom.settlements[settle]['settler'];
            if(!Game.creeps[settler] &&)
        }*/

        runRoles(Game.creeps);
        
        //Run the painter for visuals if we have the cpu - Use painter estimate if we've recorded one, otherwise default 2
        if(Game.cpu.limit-Game.cpu.getUsed() > Memory.painterEstimate ? Memory.painterEstimate : 2){
            painter.run(kingdomCreeps);
        }

        //Run status manager to draw room visuals
        //Separate from painter as it must be last thing run in kingdom for accurate details
        if(Memory.visuals.drawStatus)statusManager.run();
    }
}

module.exports = kingdomManager;
profiler.registerObject(kingdomManager, 'kingdomManager');
function runRoles(kingdomCreeps){
    let cRoles = {};
    for(creep in kingdomCreeps){
        let myCreep = Game.creeps[creep];
        let creepTotal = 0;
        let creepRole = '';
        
        

        switch(Game.creeps[creep].memory.role){
            case 'harvester':
                roleHarvester.run(myCreep);
                creepRole = '⛏️';
                break;
            case 'soldier':
                roleSoldier.run(myCreep);
                creepRole = '👮';
                break;
            case 'fastFiller':
                roleFiller.run(myCreep);
                creepRole = '✉️';
                break;
            case 'remoteDefender':
                roleRemotedefender.run(myCreep);
                creepRole = '🛡️';
                break;
            case 'guard':
                roleGuard.run(myCreep);
                creepRole = '🛡️';
                break;
            case 'upgrader':
                roleUpgrader.run(myCreep);
                creepRole = '⏫';
                break;
            case 'gunner':
                roleGunner.run(myCreep);
                creepRole = '💥';
                break;
            case 'boost':
                roleBoost.run(myCreep);
                creepRole = '⏫';
                break;
            case 'runner':
                roleRunner.run(myCreep);
                creepRole = '🚚';
                break;
            case 'harvGrader':
                roleHarvgrader.run(myCreep);
                creepRole = '⛏️';
                break;
            case 'marauder':
                roleMarauder.run(myCreep);
                creepRole = '🏴‍☠️';
                break;
            case 'claimer':
                roleClaimer.run(myCreep);
                creepRole = '📌';
                break;
            case 'trucker':
                roleTrucker.run(myCreep);
                creepRole = '🛢️';
                break;
            case 'generalist':
                roleGeneralist.run(myCreep);
                creepRole = '🚚';
                break;
            case 'hunter':
                roleHunter.run(myCreep);
                creepRole = '⚔️';
                break;
            case 'ranger':
                roleRanger.run(myCreep);
                creepRole = '🏹';
                break;
            case 'miner':
                roleMiner.run(myCreep);
                creepRole = '⛏️';
                break;
            case 'diver':
                roleDiver.run(myCreep);
                creepRole = '☢️';
                break;
            case 'bait':
                roleBait.run(myCreep);
                creepRole = '☢️';
                break;
            case 'duo':
                roleDuo.run(myCreep);
                creepRole = '👮';
                break;
            case 'settler':
                roleGeneralist.run(myCreep);
                creepRole = '🚚';
                break;
            case 'manager':
                roleManager.run(myCreep);
                creepRole = '🗃️';
                break;
            case 'extractor':
                roleExtractor.run(myCreep);
                creepRole = '👮';
                break;
            case 'raider':
                roleRaider.run(myCreep);
                break;
        }
        cRoles[Game.creeps[creep].memory.role] = creepRole
    }
}

function sortCreeps(){
    let kingdomCreeps={reserve:[],}
    let milRoles = [
        'sapper',
        'archer',
        'pikeman',
        'skirmisher',
        'halberdier'
    ]
    for(let creepName in Game.creeps){
        let creep = Game.creeps[creepName];
        let fief = creep.memory.fief;
        let role = creep.memory.role
        if(role == 'scout'){
            kingdomCreeps.scouts = kingdomCreeps.scouts || []
            kingdomCreeps.scouts.push(creep);
        }
        //If we find a military creep with a bad lance
        else if(milRoles.includes(role)){

            //If military and no existing lance, you go in the reserve
            if(!global.heap.army.lances[creep.memory.lance]){
                kingdomCreeps.reserve.push(creep.id);
            }
            //If your lance does exist, you go to it
            else{
                kingdomCreeps[creep.memory.lance] = kingdomCreeps[creep.memory.lance] || [];
                kingdomCreeps[creep.memory.lance].push(creep)
            }
        }
        else{
            if (!kingdomCreeps[fief]) {
                kingdomCreeps[fief] = {};
            }
            if (!kingdomCreeps[fief][role]) {
                kingdomCreeps[fief][role] = [];
            }
            kingdomCreeps[fief][role].push(creep);
        }
    }
    return kingdomCreeps;
}

addHolding = profiler.registerFN(runRoles, 'runRoles');