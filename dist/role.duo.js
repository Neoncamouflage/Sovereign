const helper = require('functions.helper');
var roleDuo = {

    /** @param {Creep} creep **/
    run: function(creep) {
        /*
        -- Creep Memory -- 
        




        */

        //Initial checks and whatnot here
        if(!creep.memory.preflight){
            //Do preflight stuff
            creep.memory.preflight = true;
        }


        //ATTACKER
        if(creep.memory.job == 'attacker'){
            //Allows for manual or other code logic to direct until it's boosted
            if(creep.memory.needBoost && !creep.memory.boosted){
                return;
            }
            if(creep.memory.respawn && creep.ticksToLive < 400 && !creep.memory.respawnDone){
                //addCreep('W56N12','Squire',[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL],{role:'duo',job:'healer'});
                //addCreep('W56N12','Knight',[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK],{role:'duo',job:'attacker',respawn:true,type:'melee',targetRoom:creep.memory.targetRoom});
                creep.memory.respawnDone = true;
            }
            if(!creep.memory.stay) creep.memory.stay = true;

            var targetRoom = creep.memory.targetRoom;
            let healer = Game.getObjectById(creep.memory.healer);
            if(!creep.memory.healer){
                let healCheck = creep.room.find(FIND_MY_CREEPS,{filter: (heal) => {
                    return heal.memory.role == 'duo' && heal.memory.job == 'healer' && (heal.memory.attacker == creep.id || !heal.memory.attacker);
                }})[0];
                if(healCheck){
                    healer = healCheck;
                    creep.memory.healer = healCheck.id;
                }else{
                    return;
                }
            }
            else if(!healer){
                creep.memory.healer = creep.id;
                healer = Game.getObjectById(creep.memory.healer)
            }
            if(creep.memory.type == 'melee'){
                const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS,{filter: (att) => {
                    return  att.body.length > 1 && !Memory.diplomacy.allies.includes(att.owner.username)
                }});
                if(target && (creep.room.name == targetRoom || creep.pos.getRangeTo(target) < 5)) {
                    let targetRange = creep.pos.getRangeTo(target);
                    if(((creep.pos.getRangeTo(healer) <= 1 || targetRange == 1) || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) && healer.fatigue == 0){
                        if(targetRange == 1){
                            creep.attack(target);
                        }
                        //If the target is on the edge of the room, move using range 1
                        if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y)){
                            creep.travelTo(target,{ignoreRoads:true,allowHostile:false});
                        }
                        else{
                            creep.travelTo(target,{ignoreRoads:true,allowHostile:false,range:1});
                        }
                    }
                }
                else if(targetRoom && creep.room.name != targetRoom){
                    if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                        creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true,allowHostile:false});
                    }
                }
                else if(targetRoom && creep.room.name == targetRoom && (([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) || ([0,49].includes(healer.pos.x) || [0,49].includes(healer.pos.y)))&& healer.fatigue == 0){
                    creep.travelTo(new RoomPosition(25,25,creep.room.name),{ignoreRoads:true,allowHostile:false})
                }
                let structTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL
                });
                let targetStruct = creep.pos.findClosestByRange(structTargets);
                if(!target && creep.room.name == targetRoom && !Object.keys(Memory.kingdom.holdings).includes(creep.room.name) && !Object.keys(Memory.kingdom.fiefs).includes(creep.room.name)){
                    
                    if(creep.pos.getRangeTo(targetStruct) > 1 && creep.pos.getRangeTo(healer) <= 1){
                        let y = creep.travelTo(targetStruct,{ignoreRoads:true,allowHostile:false});
                    }
                    else{
                        creep.attack(targetStruct);
                    }
                }
                else if(creep.pos.getRangeTo(target) > 1){
                    if(creep.pos.getRangeTo(targetStruct) == 1)creep.attack(targetStruct);
                }
            }
            else if(creep.memory.type == 'dismantle'){
                if(targetRoom && creep.room.name != targetRoom){
                    if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                        creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true,allowHostile:false});
                    }
                }
                else if(targetRoom && creep.room.name == targetRoom && (([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) || ([0,49].includes(healer.pos.x) || [0,49].includes(healer.pos.y)))&& healer.fatigue == 0){
                    creep.travelTo(new RoomPosition(25,25,creep.room.name),{ignoreRoads:true,allowHostile:false})
                }
                else if(targetRoom && creep.room.name == targetRoom && creep.pos.getRangeTo(healer) <= 1&& healer.fatigue == 0){
                    let structTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => [STRUCTURE_SPAWN,STRUCTURE_TOWER].includes(structure.structureType)
                });
                    let targetStruct = creep.pos.findClosestByRange(structTargets);                    
                    if(creep.pos.getRangeTo(targetStruct) > 1 ){
                        creep.travelTo(targetStruct,{ignoreRoads:true,allowHostile:false});
                    }
                    else{
                        creep.dismantle(targetStruct);
                    }
                }
            }
            
    }




        //HEALER
        if(creep.memory.job == 'healer'){
            let attacker = Game.getObjectById(creep.memory.attacker);
            if(!attacker){
                let attCheck = creep.room.find(FIND_MY_CREEPS,{filter: (att) => {
                    return att.memory.role == 'duo' && att.memory.job == 'attacker' && (att.memory.healer == creep.id || !att.memory.healer);
                }})[0];
                if(attCheck){
                    attacker = attCheck;
                    creep.memory.attacker = attCheck.id;
                }else{
                    return;
                }
            }
            creep.travelTo(attacker)
            if(creep.hits == creep.hitsMax && attacker.hits == attacker.hitsMax){
                creep.heal(attacker);
            }
            else{
                if(creep.hitsMax - creep.hits > attacker.hitsMax - attacker.hits){
                    creep.heal(creep)
                }
                else{
                    creep.heal(attacker)
                }
            }
        }
    }
};

module.exports = roleDuo;