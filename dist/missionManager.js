const roleScout = require('role.scout');
const helper = require('functions.helper');
const fiefPlanner = require('fiefPlanner');
const missionManager = {
    run:function(milCreeps){
        // - Assignments -
        //Set up missions if needed
        if(!Memory.kingdom.missions){
            Memory.kingdom.missions = {
                scout:{}, //Scout target room
                defend: {}, //Defend target room vs hostile creeps
                harass: {} //Harass target enemy's remotes
            };
        };
        if(!Memory.kingdom.missions.scout) Memory.kingdom.missions.scout = {};
        if(!Memory.kingdom.missions.defend) Memory.kingdom.missions.defend = {};
        if(!Memory.kingdom.missions.harass) Memory.kingdom.missions.harass = {};
        if(!Memory.kingdom.missions.settle) Memory.kingdom.missions.settle = {};
        // Refs
        // Mission type - {targetRoom,targetPos,creep,complete}
        //return;
        // - Actions - 
        //this.handleScoutMissions();
        //this.handleDefenseMissions();
        Object.entries(Memory.kingdom.missions).forEach(([type,missions]) =>{
            switch(type){
                case 'scout':
                    Object.entries(missions).forEach(([targetRoom,mission]) =>{
                        this.handleScoutMission(targetRoom,mission);
                    })
                    break;
                case 'defend':
                    break;
                case 'harass':
                    break;
                case 'settle':
                    Object.entries(missions).forEach(([targetRoom,mission]) =>{
                        this.handleSettleMission(targetRoom,mission);
                    })
                    break;
            };
        });
        //Run military creep roles
        for(creep of milCreeps){
            switch(creep.memory.role){
                case 'scout':
                    roleScout.run(creep);
            }
        }
        
    },
    createMission: function(missionType,targetRoom,details=null){
        //If no details, create a blank mission
        if(!details){
            Memory.kingdom.missions[missionType][targetRoom] = {creeps:[],complete:false}
        }
        //If details, add all to data and create mission
        else{
            let data = {creeps:[],complete:false};
            Object.keys(details).forEach(item =>{
                data[item] = details[item];
            });
            Memory.kingdom.missions[missionType][targetRoom] = data;
        }
        Memory.kingdom.missions[missionType][targetRoom].tick = Game.time;
        
    },
    handleAttackMissions: function(){

    },
    handleDefenseMissions: function(){
        //Get all fiefs and see who is closest, linear distance and find route both maybe
        //If there are nearby fiefs who can help support, have them do so
        let defend = Memory.kingdom.missions.defend;
        //Check all scouting missions and, if no creeps are alive or queued, request them.
        Object.keys(defend).forEach(mission => {
            if(defend[mission].complete){
                delete defend[mission];
                return;
            }
            else if(Game.rooms[mission] && Game.rooms[mission].find(FIND_HOSTILE_CREEPS).length == 0){
                defend[mission].complete = true;
                return;
            }
            //If we have vision
            else if(Game.rooms[mission]){
                let hostileCreeps = Game.rooms[mission].find(FIND_HOSTILE_CREEPS)
                let bodyNeeded = this.generateSquad(hostileCreeps,mission)
            }
            //Else, try to go off the creeps we saw before
            else{
                let bodyNeeded = this.generateSquad(defend[mission].hostileCreeps,mission)
            }
        })
        
    },
    handleDepositMission: function(targetRoom,mission){
        //Assign miner
        //Assign haulers
    },
    handlePowerMission: function(targetRoom,mission){

    },
    handleScoutMission: function(targetRoom,mission){
        //Check all scouting missions and, if no creeps are alive or queued, request them.
        if(mission.complete){
            delete Memory.kingdom.missions.scout[targetRoom];
        }
        //Game tick mod to account for delay in processing through the queue
        else if(Game.time % 2 == 0 && (!mission.scoutCreep || (!Game.creeps[mission.scoutCreep] && !Memory.kingdom.fiefs[mission.homeRoom].spawnQueue[mission.scoutCreep]))){
            //console.log("Length",mission.creeps.length)
            //console.log(!Game.creeps[mission.creeps[0]] && !Memory.kingdom.fiefs[mission.homeRoom].spawnQueue[mission.creeps[0]])
            let newName = 'Pilgrim '+helper.getName()+' of House '+mission.homeRoom;
            Memory.kingdom.fiefs[mission.homeRoom].spawnQueue[newName] = {
                sev:50,body:[MOVE],
                memory:{role:'scout',job:'scout',homeRoom:mission.homeRoom,targetRoom:targetRoom,preflight:false}}
            mission.scoutCreep = newName;   
            mission.creeps.push(newName)
        }

    },
    handleHarassMissions: function(){

    },
    handleSettleMission: function(targetRoom,mission){
        //Settle missions involve scouting a wanted room (if necessary), generating a base plan, and claiming the room

        //Check if the room is claimed yet. If so we mark it as a supported room of the home fief and end the mission
        if(Game.rooms[targetRoom] && Game.rooms[targetRoom].controller.my && Memory.kingdom.fiefs[targetRoom]){
            //If the home fief isn't set, find it. This should be done earlier, this check is just in case
            if(!mission.homeRoom){
                Object.keys(Memory.kingdom.fiefs).forEach(fief => {
                    let dist = Game.map.getRoomLinearDistance(targetRoom, fief);
                    if(dist < pickNum){
                        pick = fief;
                        pickNum = dist;
                    }
                });
                mission.homeRoom = pick;
            }
            //Assign the homeroom to the new settlement's support and end the mission
            Memory.kingdom.fiefs[targetRoom].support = mission.homeRoom;
            delete Memory.kingdom.missions.settle[targetRoom];
            return;
        }

        //If not claimed, we start by checking if the room is scouted yet (this is only an issue with manual requests/scout data bugs, 
        //automatic expansion should never try to settle an unscouted room)
        if(!global.heap.scoutData[targetRoom]){
            //If not scouted, create a mission if there isn't one. Return as without scouting data we can't move forward.
            if(!Memory.kingdom.missions.scout[targetRoom]){
                //Get the closest room to send a scout from, include it as the homeRoom
                let pick;
                let pickNum = 99;
                Object.keys(Memory.kingdom.fiefs).forEach(fief => {
                    let dist = Game.map.getRoomLinearDistance(targetRoom, fief);
                    if(dist < pickNum){
                        pick = fief;
                        pickNum = dist;
                    }
                });
                this.createMission('scout',targetRoom,{homeRoom:pick});
            }
            
            return;
        }
        //With scout data, start planning for this settle mission if we need
        if(!mission.planned){
            //Check to make sure we aren't overlapping planning requests
            //Request plan only if there's no planner at all yet, or if the fiefPlanner stage is zero and the room requested isn't ours
            if(!global.heap.fiefPlanner || (global.heap.fiefPlanner.stage == 0 && global.heap.fiefPlanner.roomName != targetRoom)){
                fiefPlanner.getFiefPlan(targetRoom);
                return;
            }
            //Else, if the planner is at stage 0 (complete) and the planned room is ours, then we're good to go
            else if(global.heap.fiefPlanner && global.heap.fiefPlanner.stage == 0 && global.heap.fiefPlanner.roomName == targetRoom) {
                mission.planned = true;
            }
            //Else we're still waiting on the room to plan
            else{
                return;
            }
        }
        
        //Now that we're scouted and the room is planned, request a claim creep from the new fief's support room if we haven't done so yet
        //If no support room is set, assign one
        if(!mission.homeRoom){
            Object.keys(Memory.kingdom.fiefs).forEach(fief => {
                let dist = Game.map.getRoomLinearDistance(targetRoom, fief);
                if(dist < pickNum){
                    pick = fief;
                    pickNum = dist;
                }
            });
            mission.homeRoom =
            pick;
        }
        //Game tick delay to account for the transition through the spawn queue
        if(Game.time % 2 == 0 && (!mission.claimCreep || (!Game.creeps[mission.claimCreep] && !Memory.kingdom.fiefs[mission.homeRoom].spawnQueue[mission.claimCreep]))){
            let newName = 'Viscount '+helper.getName()+' of House '+mission.homeRoom;
            Memory.kingdom.fiefs[mission.homeRoom].spawnQueue[newName] = {
                sev:50,body:[MOVE,CLAIM],
                memory:{role:'claimer',job:'claimer',homeRoom:mission.homeRoom,targetRoom:targetRoom,preflight:false}}
            mission.claimCreep = newName;
            mission.creeps.push(newName);   
        }

    },
    generateSquad: function(enemyCreeps,targetRoom){
        //Generate a squad of soldiers based on the enemy creeps

        //Get total healing and damage of creeps
        let totals ={};

        //For each creep
        enemyCreeps.forEach(creep =>{
            //Each part on each creep
            creep.body.forEach(part=>{
                //Get boost and type
                let boost = part.boost;
                let type = part.type;

                //If boosted, add the boosted amount
                if(boost){
                    switch(type){
                        case ATTACK:
                            totals[type] = (totals[type] || 0) + BOOSTS[type][boost][type];
                            break;
                        case HEAL:
                            totals[type] = (totals[type] || 0) + BOOSTS[type][boost][type];
                            break;
                        case RANGED_ATTACK:
                            totals[type] = (totals[type] || 0) + BOOSTS[type][boost]['rangedAttack'];
                            break;
                        
                    };
                }
                //If not, add the part
                else{
                    switch(type){
                        case ATTACK:
                            totals[type] = (totals[type] || 0) + 1;
                            break;
                        case HEAL:
                            totals[type] = (totals[type] || 0) + 1;
                            break;
                        case RANGED_ATTACK:
                            totals[type] = (totals[type] || 0) + 1;
                            break;
                        
                    };
                }


            });
        });

        console.log(targetRoom,JSON.stringify(totals))

        //Now we need to get the closest rooms to the target
        // Precompute and cache the distances of each room to the targetRoom
        let fiefs = Object.keys(Memory.kingdom.fiefs)
        const distanceCache = fiefs.reduce((acc, roomName) => {
            acc[roomName] = Game.map.getRoomLinearDistance(roomName, targetRoom);
            return acc;
        }, {});

        // Use the cached distances for sorting
        fiefs.sort((a, b) => distanceCache[a] - distanceCache[b]);
        console.log("Closest rooms to defend",targetRoom,":\n",fiefs)
    },
    clearMissions: function(type){
        //Wipes all missions. If no type is specified, wipes the entire missions object
        if(!type){
            delete Memory.kingdom.missions
            return;
        }
        //If a type is specified, delete those specific missions or return an error
        let missionTypes = Object.keys(Memory.kingdom.missions);
        if(missionTypes.includes(type)){
            delete Memory.kingdom.missions[type];
        }
        else{
            console.log("Invalid mission type")
            return -1;
        }
    }
}

module.exports = missionManager;

global.createMission = missionManager.createMission;