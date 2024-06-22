const helper = require('functions.helper');
var roleDiver = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let lab;
        if(!creep.memory.boosted){
            console.log("AYE")
            lab = Game.getObjectById('6605cfe8670173b7ce3154ef')
            if(!lab.mineralType || lab.store[lab.mineralType] < 30){
                creep.memory.boosted = true;
            }
            else{
                let x = lab.boostCreep(creep);
                if(x == ERR_NOT_IN_RANGE){
                    creep.travelTo(lab);
                    return;
                }else if(x == OK){
                    creep.memory.boosted = true;
                }
            }

        }
        if(creep.memory.job == 'attacker' && !creep.memory.boosted2){
            lab = Game.getObjectById('65ec08e381284a13d36fe235')
            if(!lab.mineralType || lab.store[lab.mineralType] < 30){
                creep.memory.boosted2 = true;
            }
            else{
                let x = lab.boostCreep(creep);
                if(x == ERR_NOT_IN_RANGE){
                    creep.travelTo(lab);
                    return;
                }else if(x == OK){
                    creep.memory.boosted2 = true;
                }
            }
        }

        if(creep.memory.job == 'attacker'){
            //Allows for manual or other code logic to direct until it's boosted
            if(creep.memory.respawn && creep.ticksToLive < 600 && !creep.memory.respawnDone){
                //addCreep('W56N12','Surgeon',[TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL],{role:'diver',job:'healer'});
                //addCreep('W56N12','Sapper',[TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,RANGED_ATTACK],{role:'diver',job:'attacker',respawn:true,targetRoom:'W57N17'});
                //addCreep('W56N12','Sapper',[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,RANGED_ATTACK],{role:'bait',job:'sapper'})
                creep.memory.respawnDone = true;
            }
            if(!creep.memory.stay) creep.memory.stay = true;

            var targetRoom = creep.memory.targetRoom;
            let healer = Game.getObjectById(creep.memory.healer);
            if(!healer){
                let healCheck = creep.room.find(FIND_MY_CREEPS,{filter: (heal) => {
                    return heal.memory.role == 'diver' && heal.memory.job == 'healer' && (heal.memory.attacker == creep.id || !heal.memory.attacker);
                }})[0];
                console.log(healCheck)
                if(healCheck){
                    healer = healCheck;
                    creep.memory.healer = healCheck.id;
                }else{
                    return;
                }
            }
            if(targetRoom && creep.room.name != targetRoom){
                if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                    creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true,allowHostile:false});
                }
            }
            else if(targetRoom && creep.room.name == targetRoom && (([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) || ([0,49].includes(healer.pos.x) || [0,49].includes(healer.pos.y)))&& healer.fatigue == 0){
                creep.travelTo(new RoomPosition(25,25,creep.room.name),{ignoreRoads:true,allowHostile:false})
            }
            else if(targetRoom && creep.room.name == targetRoom && creep.pos.getRangeTo(healer) <= 1&& healer.fatigue == 0){
                let targetStruct = Game.getObjectById('65b8dac3a4e21f3bff574e53');
                if(!targetStruct){
                    structTargets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => [STRUCTURE_SPAWN].includes(structure.structureType)
                    });
                        targetStruct = creep.pos.findClosestByRange(structTargets);   
                }
                if(!targetStruct){
                    let structTargets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => [STRUCTURE_EXTENSION,STRUCTURE_TOWER].includes(structure.structureType)
                    });
                        targetStruct = creep.pos.findClosestByRange(structTargets);   
                }
                if(creep.pos.getRangeTo(targetStruct) > 1 ){
                    creep.travelTo(targetStruct,{ignoreCreeps:false,ignoreRoads:true,allowHostile:false});
                }
                else{
                    creep.dismantle(targetStruct);
                }
            }
            const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS,3);
            for(each of targets){
                if(each.pos.y != 25){
                    creep.rangedAttack(each);
                    break;
                }
            }
            
    }




        //HEALER
        if(creep.memory.job == 'healer'){
            let attacker = Game.getObjectById(creep.memory.attacker);
            if(!attacker){

                let attCheck = creep.room.find(FIND_MY_CREEPS,{filter: (att) => {
                    return att.memory.role == 'diver' && att.memory.job == 'attacker' && (att.memory.healer == creep.id || !att.memory.healer);
                }})[0];
                console.log(attCheck)
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

module.exports = roleDiver;

