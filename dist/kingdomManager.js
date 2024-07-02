const fiefManager = require('fiefManager');
const missionManager = require('missionManager')
const holdingManager = require('holdingManager');
const roleGeneralist = require('role.generalist');
const roleHarvester = require('role.harvester');
const roleHauler = require('role.hauler');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleFiller = require('role.filler');
const roleClaimer = require('role.claimer');
const roleMiner = require('role.miner')
const roleScout = require('role.scout');
const roleRemotedefender = require('role.remoteDefender');
const roleTrucker = require('role.trucker');
const roleManager = require('role.manager');
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
const kingdomManager = {
    run:function(){
        // - Assignments -
        //Status object for room visuals
        let kingdomStatus = {fiefs:{},holdings:{}}
        //Assign creeps to their fiefs and sort by role
        fiefCreeps = sortCreeps();
        // - Actions - 
        //Loop through all fiefs and holdings and run their respective manager
        //Holdings first so we can run the registry for each fief in the same loop
        for(const holding in Memory.kingdom.holdings){
            kingdomStatus.holdings[holding] = holdingManager.run(holding);
            helper.drawVisuals(holding,'holding')
        }
        for(const fief in Memory.kingdom.fiefs){
            supplyDemand.prepShipping(fief);
            //Assignments
            let fiefResults;
            fiefCreeps[fief] = fiefCreeps[fief] || [];
            //Make sure fief is live, remove if not
            if(!Game.rooms[fief] || !Game.rooms[fief].controller.my){
                console.log("Removing dead fief ",fief);
                delete Memory.kingdom.fiefs[fief];
                continue;
            }
            
            fiefResults = fiefManager.run(Game.rooms[fief],fiefCreeps[fief]);
            //Manage shipping tasks
            supplyDemand.manageShipping(fief,fiefCreeps[fief]['hauler'] || []);
            //Cache the status to display next tick
            kingdomStatus.fiefs[fief] = fiefResults;
            //Run spawn logic every 3 ticks
            //if(Game.time % 3 == 0) kingdomStatus.fiefs[fief].spawnQueue = 
            registry.calculateSpawns(Game.rooms[fief]);
            helper.drawVisuals(fief,'fief')
            console.log(granary.getIncome(fief))
        }

        
        /*for(const settle in Memory.kingdom.settlements){
            return;
            //Figure this out for future settlements
            let settler = Memory.kingdom.settlements[settle]['settler'];
            if(!Game.creeps[settler] &&)
        }*/

        runRoles(Game.creeps);
        

        //Run status manager to draw room visuals
        //Must be last thing run in kingdom for accurate details
        //if(Memory.statusVisuals)statusManager.run(kingdomStatus);
    }
}

module.exports = kingdomManager;

function runRoles(kingdomCreeps){
    let milCreeps = [];
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
            case 'builder':
                roleBuilder.run(myCreep);
                creepRole = '👷';
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
                roleSettler.run(myCreep);
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
            case 'scout':
                //roleScout.run(myCreep);
                milCreeps.push(myCreep);
                creepRole = '🧭';
                break
        }
        cRoles[Game.creeps[creep].memory.role] = creepRole
    }
    missionManager.run(milCreeps);
}

function sortCreeps(){
    let fiefCreeps={}
    for(let creepName in Game.creeps){
        let creep = Game.creeps[creepName];
        let fief = creep.memory.fief;
        let role = creep.memory.role
        if (!fiefCreeps[fief]) {
            fiefCreeps[fief] = {};
        }
        if (!fiefCreeps[fief][role]) {
            fiefCreeps[fief][role] = [];
        }
        fiefCreeps[fief][role].push(creep);
    }
    return fiefCreeps;
}

addHolding = profiler.registerFN(runRoles, 'runRoles');