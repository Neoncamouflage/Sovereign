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
            if(creep)
            if(creep.memory.type == 'portal'){
                //console.log('T1',JSON.stringify(creep.memory))
                if(creep.room.name != 'E0S0') creep.travelTo(new RoomPosition(44,44,'E30S10'));
                else{
                    let targetPos = new RoomPosition(5,5,'E0S0')
                    //console.log('T2',targetPos)
                    if(creep.pos.isEqualTo(targetPos)){

                        creep.memory.type = creep.memory.changeType
                    }
                    else{
                        creep.travelTo(targetPos)
                    }
                    
                }
            }
            if(creep.memory.type == 'ranged'){
                if(creep.memory.harass && (!creep.memory.targetRoom || (creep.memory.tickPick && creep.memory.tickPick < Game.time - 150))){
                    creep.memory.targetRoom = randomChoice(['E1S1','E3S1','E4S3','E5S2','E2S3','E3S3','E2S4','E2S1'])
                    creep.memory.tickPick = Game.time
                }
                if(creep.pos.isEqualTo(new RoomPosition(5,5,'E0S0'))){
                    creep.move(BOTTOM)
                    return;
                }
                let targets = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp))
                let priorityTargets = targets.filter(crp => helper.isSoldier(crp))
                let roomTargets = targets.filter(crp => ![0,49].includes(crp.pos.x) && ![0,49].includes(crp.pos.y))
                let target;
                let soldierFlag = false;
                let damaged = creep.hits < creep.hitsMax;
                if(creep.room.controller && creep.room.controller.safeMode){
                    targets = [];
                    priorityTargets = [];
                    roomTargets = []
                }
                if(priorityTargets.length){
                    target = creep.pos.findClosestByRange(priorityTargets)
                    soldierFlag = true;
                }
                else{
                    target = roomTargets.length ? creep.pos.findClosestByRange(roomTargets) : creep.pos.findClosestByRange(targets)
                }
                if(target && (creep.room.name == targetRoom || (creep.pos.getRangeTo(target) < 4 && target.owner != 'Source Keeper'))) {
                    let targetRange = creep.pos.getRangeTo(target);
                    if(((creep.pos.getRangeTo(healer) <= 1 || targetRange <=3) || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) && healer.fatigue == 0){
                    if(targetRange <= 1){
                        
                        creep.rangedMassAttack();
                        if(soldierFlag){
                            if(creep.room.name == creep.memory.targetRoom){
                                if(creep.memory.harass)creep.memory.targetRoom = randomChoice(['E1S1','E3S1','E4S3','E5S2','E2S3','E3S3','E2S4','E2S1']);
                                creep.memory.tickPick = Game.time
                            }
                            let res = PathFinder.search(healer.pos, {pos:target.pos,range:5}, {flee:true})
                            let resPath = res.path;
                            creep.travelTo(healer)
                            //console.log("Fleeing!","Ranged",resPath[0],)
                            if(creep.pos.getRangeTo(healer) == 1 && creep.fatigue == 0){
                                healer.override = true;
                                healer.travelTo(resPath[0])
                                //console.log("Fleeing!","Healer:",resPath[1])
                            }
                            return;
                        }


                    }
                    else if(targetRange<=3){
                        creep.rangedAttack(target)
                        if(soldierFlag){
                            if(creep.room.name == creep.memory.targetRoom){
                                if(creep.memory.harass)creep.memory.targetRoom = randomChoice(['E1S1','E3S1','E4S3','E5S2','E2S3','E3S3','E2S4','E2S1']);
                                creep.memory.tickPick = Game.time
                            }
                            let res = PathFinder.search(healer.pos, {pos:target.pos,range:5}, {flee:true})
                            let resPath = res.path;
                            creep.travelTo(healer)
                            //console.log("Fleeing!","Ranged",resPath[0],)
                            if(creep.pos.getRangeTo(healer) == 1 && creep.fatigue == 0){
                                healer.override = true;
                                healer.travelTo(resPath[0])
                                //console.log("Fleeing!","Healer:",resPath[1])
                            }
                            return;
                        }
                    }
                    //If we're damaged and the other creep is bigger, keep fleeing
                    else if(targetRange<=5 && damaged && target.body.length > creep.body.length){
                        if(soldierFlag){
                            if(creep.room.name == creep.memory.targetRoom){
                                if(creep.memory.harass)creep.memory.targetRoom = randomChoice(['E1S1','E3S1','E4S3','E5S2','E2S3','E3S3','E2S4','E2S1']);
                                creep.memory.tickPick = Game.time
                            }
                            let res = PathFinder.search(healer.pos, {pos:target.pos,range:5}, {flee:true})
                            let resPath = res.path;
                            creep.travelTo(healer)
                            //console.log("Fleeing!","Ranged",resPath[0],)
                            if(creep.pos.getRangeTo(healer) == 1 && creep.fatigue == 0){
                                healer.override = true;
                                healer.travelTo(resPath[0])
                                //console.log("Fleeing!","Healer:",resPath[1])
                            }
                            return;
                        }
                    }
                    //If the target is on the edge of the room, move using range 1
                    if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y)){
                        if(creep.memory.edgeFight){
                            creep.memory.edgeFight = false;
                            creep.travelTo(target,{ignoreRoads:true});
                        }
                        else{
                            creep.travelTo(target,{ignoreRoads:true});
                        }
                        
                    }
                    else{
                        creep.travelTo(target,{ignoreRoads:true,range:1});
                        creep.memory.edgeFight = true;
                    }
                    }
                }
                else if(targetRoom && creep.room.name != targetRoom){
                    if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                        creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true});
                    }
                }
                else if(targetRoom && creep.room.name == targetRoom && healer.fatigue == 0){
                    creep.travelTo(creep.room.controller,{range:7,ignoreRoads:true})
                }
                else{
                    if(creep.memory.harass)creep.memory.targetRoom = randomChoice(['E1S1','E3S1','E4S3','E5S2','E2S3','E3S3','E2S4','E2S1'])
                    creep.memory.tickPick = Game.time;
                }
                let structTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => (!structure.owner || !isFriend(structure)) && structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL&& structure.structureType != STRUCTURE_CONTAINER
                });
                let myRoom = Object.keys(Memory.kingdom.holdings).includes(creep.room.name) || Object.keys(Memory.kingdom.fiefs).includes(creep.room.name);
                let targetStruct = creep.pos.findClosestByRange(structTargets);
                if(!target && creep.room.name == targetRoom && !myRoom){
                    
                    if(targetStruct && creep.pos.getRangeTo(targetStruct) > 3 && creep.pos.getRangeTo(healer) <= 1){
                        let y = creep.travelTo(targetStruct,{ignoreRoads:true});
                    }
                    else if(targetStruct){
                        creep.rangedAttack(targetStruct);
                    }
                    else{
                        let cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                        if(cSites.length){
                            let cTarget = creep.pos.findClosestByRange(cSites);
                            creep.travelTo(cTarget)
                        }

                    }
                }
                else if(!myRoom && creep.pos.getRangeTo(target) > 3){
                    if(creep.pos.getRangeTo(targetStruct) <= 3)creep.rangedAttack(targetStruct);
                }
            }
            if(creep.memory.type == 'melee'){
                let targets = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp))
                let priorityTargets = targets.filter(crp => helper.isSoldier(crp))
                let roomTargets = targets.filter(crp => ![0,49].includes(crp.pos.x) && ![0,49].includes(crp.pos.y))
                let target;
                if(creep.room.controller && creep.room.controller.safeMode){
                    targets = [];
                    priorityTargets = [];
                    roomTargets = []
                }
                if(priorityTargets.length){
                    target = creep.pos.findClosestByRange(priorityTargets)
                }
                else{
                    target = roomTargets.length ? creep.pos.findClosestByRange(roomTargets) : creep.pos.findClosestByRange(targets)
                }
                if(target && (creep.room.name == targetRoom || creep.pos.getRangeTo(target) < 3)) {
                    let targetRange = creep.pos.getRangeTo(target);
                    if(((creep.pos.getRangeTo(healer) <= 1 || targetRange == 1) || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) && healer.fatigue == 0){
                        if(targetRange <= 1){
                            creep.attack(target);
                        }
                        //If the target is on the edge of the room, move using range 1
                        if(![0,49].includes(target.pos.x) && ![0,49].includes(target.pos.y)){
                            if(creep.memory.edgeFight){
                                creep.memory.edgeFight = false;
                                creep.travelTo(target,{ignoreRoads:true});
                            }
                            else{
                                creep.travelTo(target,{ignoreRoads:true});
                            }
                            
                        }
                        else{
                            creep.travelTo(target,{ignoreRoads:true,range:1});
                            creep.memory.edgeFight = true;
                        }
                    }
                }
                else if(targetRoom && creep.room.name != targetRoom){
                    if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                        creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true});
                    }
                }
                else if(targetRoom && creep.room.name == targetRoom && (([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) || ([0,49].includes(healer.pos.x) || [0,49].includes(healer.pos.y)))&& healer.fatigue == 0){
                    creep.travelTo(new RoomPosition(25,25,creep.room.name),{ignoreRoads:true})
                }
                let structTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_POWER_BANK&& structure.structureType != STRUCTURE_WALL&& structure.structureType != STRUCTURE_CONTAINER
                });
                let myRoom = Object.keys(Memory.kingdom.holdings).includes(creep.room.name) || Object.keys(Memory.kingdom.fiefs).includes(creep.room.name);
                let targetStruct = creep.pos.findClosestByRange(structTargets);
                if(!target && creep.room.name == targetRoom && !myRoom){
                    
                    if(targetStruct && creep.pos.getRangeTo(targetStruct) > 1 && creep.pos.getRangeTo(healer) <= 1){
                        let y = creep.travelTo(targetStruct,{ignoreRoads:true});
                    }
                    else if(targetStruct){
                        creep.attack(targetStruct);
                    }
                    else{
                        let cSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                        if(cSites.length){
                            let cTarget = creep.pos.findClosestByRange(cSites);
                            creep.travelTo(cTarget)
                        }

                    }
                }
                else if(!myRoom && creep.pos.getRangeTo(target) > 1){
                    if(creep.pos.getRangeTo(targetStruct) <= 1)creep.attack(targetStruct);
                }
            }
            else if(creep.memory.type == 'directDemo'){
                let demoTarget = Game.getObjectById(creep.memory.killID)
                if(targetRoom && creep.room.name != targetRoom){
                    if((creep.pos.getRangeTo(healer) <= 1 || [0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y))&& healer.fatigue == 0){
                        if(targetRoom == 'E2S3')creep.travelTo(new RoomPosition(1, 29, targetRoom),{ignoreRoads:true});
                        else creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true});
                    }
                }
                else if(targetRoom && creep.room.name == targetRoom && creep.room.controller.safeMode){
                    creep.memory.targetRoom = creep.memory.backupRoom;
                }
                else if(targetRoom && creep.room.name == targetRoom && (([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) || ([0,49].includes(healer.pos.x) || [0,49].includes(healer.pos.y)))&& healer.fatigue == 0){
                    if(targetRoom == 'E2S3')creep.travelTo(new RoomPosition(1, 29, targetRoom),{ignoreRoads:true});
                    else creep.travelTo(new RoomPosition(25, 25, targetRoom),{ignoreRoads:true});
                }
                else if(targetRoom && creep.room.name == targetRoom && creep.pos.getRangeTo(healer) <= 1&& healer.fatigue == 0){
                    if(demoTarget){
                        if(creep.pos.getRangeTo(demoTarget) > 1 ){
                            creep.travelTo(demoTarget);
                        }
                        else{
                            creep.dismantle(demoTarget);
                        }
                    }
                    else{
                        let structTargets = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => [STRUCTURE_SPAWN,STRUCTURE_TOWER].includes(structure.structureType)
                        });
                        let targetStruct = creep.pos.findClosestByRange(structTargets);     
                        if(targetStruct){
                            if(creep.pos.getRangeTo(targetStruct) > 1 ){
                                creep.travelTo(targetStruct,{ignoreRoads:true,allowHostile:false});
                            }
                            else{
                                creep.dismantle(targetStruct);
                            }
                        }               
                    }

                }
            }
            
    }




        //HEALER
        if(creep.memory.job == 'healer'){
            let attacker = Game.getObjectById(creep.memory.attacker);
            if(!attacker){
                let attCheck = creep.room.find(FIND_MY_CREEPS,{filter: (att) => {
                    return att.memory.role == 'duo' && !att.spawning && !att.checked && att.memory.job == 'attacker' && (att.memory.healer == creep.id || !att.memory.healer);
                }})[0];
                if(attCheck){
                    attacker = attCheck;
                    attacker.checked
                    creep.memory.attacker = attCheck.id;
                }else{
                    return;
                }
            }
            let portalling = false;
            if(attacker.room.name != creep.room.name){
                if(Game.map.getRoomLinearDistance(creep.room.name,attacker.room.name) >5){
                    
                    let portals = creep.room.find(FIND_STRUCTURES).filter(str=>str.structureType == STRUCTURE_PORTAL);
                    for(let each of portals){
                        if(each.destination.roomName == attacker.room.name){
                            portalling = true;
                            if(!creep.override)creep.travelTo(each);
                            break;
                        }
                    }
                }
            }
            if(!portalling && !creep.override)creep.travelTo(attacker)
            let targets = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp))
            if(creep.hits == creep.hitsMax && attacker.hits == attacker.hitsMax){
                if(targets.length)creep.heal(attacker);
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