const supplyDemand = require('supplyDemand')
const helper = require('functions.helper')
//const roleUpgrader = require('role.upgrader');
const roleRepair = {
    /** @param {Creep} creep **/
    run: function(creep) {
        let target = Game.getObjectById(creep.memory.target)
        let targetRoom = creep.memory.targetRoom;
        if(global.heap.alarms[creep.memory.holding]){     
            if(creep.room.name != creep.memory.fief){
                creep.memory.stay = false;
                creep.memory.status = 'flee';
                creep.drop(RESOURCE_ENERGY)
                creep.travelTo(Game.rooms[creep.memory.fief].controller)
                let words = helper.getSay({symbol:`${Game.time % 2 == 0 ? '🚨' : '📢'}`});
                creep.say(words.join(''))
            }
            else{
                //console.log("AYE")
                if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                    creep.travelTo(Game.rooms[creep.memory.fief].controller);
                }
            }
            return;
        }
        else if(creep.hits < creep.hitsMax && Memory.kingdom.holdings[creep.room.name]){
            let hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(crp => (helper.isSoldier(crp) || crp.getActiveBodyparts(CLAIM) > 0) && !isFriend(crp));
            if(hostiles.length && !global.heap.alarms[creep.room.name] && (!heap.wardens || !heap.wardens[Memory.kingdom.holdings[creep.room.name].homeFief])){
                setAlarm({roomName:creep.room.name,alarmType:hostiles[0].owner.username == 'Invader' ? 'invader' : 'creep',hostiles:hostiles,origin:'role.repair'})
            }
            if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                creep.travelTo(Game.rooms[creep.memory.fief].controller);
            }
            return;
        }

        //Set default target room if needed
        if(!targetRoom){
            targetRoom = creep.room.name;
            creep.memory.targetRoom = creep.room.name;
        }
        //First check is if we need to travel to target room
        if(creep.room.name != targetRoom && !creep.memory.target){
            creep.travelTo(new RoomPosition(25,25,targetRoom),{range:25});
            return;
        }
        //Check if we need to replace the target
        if(target && target.hits >= target.hitsMax){
            delete creep.memory.target
            target = null;
        }
        //console.log("T",JSON.stringify(creep.memory))
        //Get a new target
        if(!creep.memory.target){
            //console.log('T1')
            //If there are roads in this room then find the closest
            let badRoads = [];
            if(Memory.kingdom.fiefs[creep.room.name] || !Memory.kingdom.holdings[creep.room.name]){
                badRoads = [...creep.room.find(FIND_STRUCTURES).filter(str=>(creep.room.name == creep.memory.fief && str.structureType == STRUCTURE_CONTAINER && str.hits < str.hitsMax * 0.7) || (str.structureType == STRUCTURE_ROAD && str.hits < str.hitsMax * 0.8) || (![STRUCTURE_CONTAINER,STRUCTURE_ROAD,STRUCTURE_WALL,STRUCTURE_RAMPART].includes(str.structureType) && str.hits < str.hitsMax))];
                //console.log("REP1",Array.isArray(badRoads),badRoads)
            }
            else{
                let holding = Memory.kingdom.holdings[creep.room.name];
                for(let source of Object.values(holding.sources)){
                    for(let spot of source.path.filter(spt => ![0,49].includes(spt.x) && ![0,49].includes(spt.y))){
                        if(Game.rooms[spot.roomName] == creep.room.name){
                            let spotCheck = Game.rooms[spot.roomName].lookForAt(LOOK_STRUCTURES,spot.x,spot.y).filter(spt => spt.structureType == STRUCTURE_ROAD);
                            if(spotCheck[0] && spotCheck[0].hits < spotCheck[0].hitsMax * 0.8){
                                badRoads.push(spotCheck[0]);
                            }
                        }
                    }
                }
                //console.log("REP2",Array.isArray(badRoads), badRoads)
            }
            
            if(badRoads.length){
                target = creep.pos.findClosestByRange(badRoads);
                if(!target) target = [badRoads[0]]
                creep.memory.target = target.id;
            }
            //Else find a new room and mark this one repaired if needed
            else{
                //console.log('T2')
                if(Memory.kingdom.holdings[creep.room.name] && Memory.kingdom.holdings[creep.room.name].roadRep) Memory.kingdom.holdings[creep.room.name].roadRep = false;
                let roomFound = false;
                for(let holdingName of Object.keys(Memory.kingdom.holdings)){
                    holding = Memory.kingdom.holdings[holdingName];
                    if(holding.roadRep && creep.memory.fief == holding.homeFief && !heap.alarms[holdingName]){
                        creep.memory.targetRoom = holdingName;
                        creep.travelTo(new RoomPosition(25,25,holdingName),{range:25});
                        roomFound = true;
                        break;
                    };
                }
                //console.log('T3')
                //If we didn't find a new room, no reps are needed. Mark everything repaired and go home.
                if(!roomFound){
                    //console.log('T4')
                    Memory.kingdom.fiefs[creep.memory.fief].repRequest = false;
                    //If home, help build if needed, otherwise repair stuff at 90%
                    if(creep.room.name == creep.memory.fief){
                        let buildTarget;
                        if(creep.memory.buildTarget) buildTarget = Game.getObjectById(creep.memory.buildTarget)
                        if(!buildTarget){
                            let buildTargets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                            buildTarget = creep.pos.findClosestByRange(buildTargets)
                            if(buildTarget){creep.memory.buildTarget = buildTarget.id}
                        }
                        if(buildTarget && creep.store.getUsedCapacity() > 0) {
                            if(creep.pos.getRangeTo(buildTarget) > 3){
                                creep.travelTo(buildTarget);
                            }
                            else{
                                creep.build(buildTarget);
                            }    
                            return;                
                        }
                        let badRoads = creep.room.find(FIND_STRUCTURES).filter(str=>(creep.room.name == creep.memory.fief && str.structureType == STRUCTURE_CONTAINER && str.hits < str.hitsMax * 0.9) || (str.structureType == STRUCTURE_ROAD && str.hits < str.hitsMax * 0.9) || (![STRUCTURE_CONTAINER,STRUCTURE_ROAD,STRUCTURE_WALL,STRUCTURE_RAMPART].includes(str.structureType) && str.hits < str.hitsMax));
                        if(badRoads.length){
                            target = creep.pos.findClosestByRange(badRoads);
                            creep.memory.target = target.id;
                        }
                        else{
                            let anyRoads = creep.room.find(FIND_STRUCTURES).filter(str=>(creep.room.name == creep.memory.fief && str.structureType == STRUCTURE_CONTAINER && str.hits < str.hitsMax * 0.9) || (![STRUCTURE_CONTAINER,STRUCTURE_WALL,STRUCTURE_RAMPART].includes(str.structureType) && str.hits < str.hitsMax));
                            if(anyRoads.length){
                                target = creep.pos.findClosestByRange(anyRoads);
                                creep.memory.target = target.id;
                            }
                        }
                    }
                    else{
                        if(creep.memory.fief != creep.memory.targetRoom) creep.memory.targetRoom = creep.memory.fief
                        //else{

                        //}
                    }
                }
                return;
            }
        }

        //Flagging for now so we don't do two Travel calls, if we need to walk to storage
        let tRange = creep.pos.getRangeTo(target);
        if(tRange > 3) creep.travelTo(target)
        else{
            creep.repair(target);
        }
        if(creep.store.getFreeCapacity() > 0){
            let storeRange = creep.pos.getRangeTo(creep.room.storage);
            if(creep.room.storage && storeRange < 5){
                //console.log('T5')
                if(creep.store.getUsedCapacity()==0)creep.travelTo(creep.room.storage);
                if(storeRange == 1) creep.withdraw(creep.room.storage,RESOURCE_ENERGY)
            }
            else if(target && target.structureType == STRUCTURE_CONTAINER && target.store[RESOURCE_ENERGY] > 0){
                if(tRange <=1) creep.withdraw(target,RESOURCE_ENERGY);
                else{creep.travelTo(target)}
            }
            else{
                //console.log('T6')
                let orderDetails = {
                    targetID:creep.id,
                    amount:creep.store.getCapacity()*2,
                    resourceType:RESOURCE_ENERGY,type:'dropoff'
                };
                supplyDemand.addRequest(creep.room,orderDetails);
            }
        }
    }
};

module.exports = roleRepair;