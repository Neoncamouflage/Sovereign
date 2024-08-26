const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const registry = require('registry');
const supplyDemand = require('supplyDemand');
const marshal = require('marshal');
var holdingManager = {
    /** @param {Room} room **/
    run: function(kingdomCreeps){
        let holdings = Memory.kingdom.holdings;


       // console.log("HOLDINGS")
        for(const holding in holdings){
            //If no live homeFief
            //console.log("CHECKHOLD",holding)
            kingdomCreeps[holdings[holding].homeFief] = kingdomCreeps[holdings[holding].homeFief] || []
            let fCreeps = kingdomCreeps[holdings[holding].homeFief];
            //console.log("FCREEP",JSON.stringify(fCreeps))
            //No point in running holdings that don't have a home room
            if(holdings[holding].homeFief && Game.rooms[holdings[holding].homeFief]) this.runHolding(holding,fCreeps);
        }
    },
    runHolding: function(holdingName,fiefCreeps) {
        //console.log("RUNHOLD")
        let remote = Game.rooms[holdingName]
        let holding = Memory.kingdom.holdings[holdingName];
        let fief = holding.homeFief;
        let data = global.heap.scoutData;
        global.heap.fiefs[fief] = global.heap.fiefs[fief] || {};
        let fiefHeap = global.heap.fiefs[fief];
        let isReserved = remote && remote.controller.reservation && remote.controller.reservation.username == Memory.me;
        let enemyReserve = remote && remote.controller.reservation && remote.controller.reservation.username != Memory.me;

        let roomMissions = global.heap && global.heap.missionMap && global.heap.missionMap[holdingName] || []
        //------Initial Checks------//
        //Do we have source data for the room
        if(!holding.sources){

            //Do we have scout data (we should, more a safety check for later modifications)
            if(data[holdingName]){
                //If so, record the sources and controller
                holding.sources = data[holdingName].sources.reduce((obj,source) =>{
                    obj[source.id] = {
                        id:source.id,
                        x:source.x,
                        y:source.y,
                        standby:true,
                        openSpots:helper.getOpenSpots(new RoomPosition(source.x,source.y,holdingName))
                    };
                    return obj;
                },{});
                holding.controller = {
                    x: data[holdingName].controller.x,
                    y: data[holdingName].controller.y
                }
            }
            //If not, see if we can use vision
            else if(remote){
                //If so, record the sources and controller
                holding.sources = remote.find(FIND_SOURCES).reduce((obj,source) =>{
                    obj[source.id] = {
                        id:source.id,
                        x:source.pos.x,
                        y:source.pos.y,
                        standby:true,
                        openSpots:helper.getOpenSpots(new RoomPosition(source.x,source.y,holdingName))
                    };
                    return obj;
                },{});
                holding.controller = {
                    x: remote.controller.pos.x,
                    y: remote.controller.pos.y
                }
            }
            //Else log an error, once we have proper scouting we can submit a request to intelManager
            else{
              //  console.log(`Holding ${holdingName} has no scout data or vision to find sources`)
                return;
            }


        }
        
        //If no home fief room plan, this is as far as we go
        if(!Memory.kingdom.fiefs[fief].roomPlan) return

        //If no CM/road plan, get them if our fief has a room plan
        if(!holding.costMatrix){
            let newCM = new PathFinder.CostMatrix;
            //Add 1 tile buffers around controller/sources
            let bufferSpots = Object.values(holding.sources);
            bufferSpots.push(holding.controller)
            for(let each of bufferSpots){
                let bufferOpen = helper.getOpenSpots(new RoomPosition(each.x,each.y,holdingName))
                for(let openSpot of bufferOpen){
                    newCM.set(openSpot.x,openSpot.y,25)
                }
            }

            //Grab the storage position
            let storePos = Game.rooms[fief].storage ? Game.rooms[fief].storage.pos : new RoomPosition(Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].x,Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].y,fief)
            //Make sure we have a heap for the home fief sources
            let closestSources = fiefHeap.closestSources;
            
            /*for(source in holding.sources){
                let sourcePos = new RoomPosition(holding.sources[source].x,holding.sources[source].y,holdingName)
                //This is the initial non-roaded path, so we go with standard opts
                let route = PathFinder.search(storePos,{pos:sourcePos,range:1},{
                    maxOps:20000
                })

                if(route.incomplete){
                    //LOGGING
                   // console.log("Incomplete route in",holdingName);
                    if(!holding.routeFlag){
                        holding.routeFlag = Game.time;
                    }
                    else if(Game.time - holding.routeFlag > 50){
                        delete holding.homeFief
                    }
                    return;
                }
                //Save the path to the source and distance to the fief data
                holding.sources[source].path = route.path
                let globalSource = {
                    distance:route.path.length,
                    id:source,
                    holding:holdingName
                }

                let index = closestSources.findIndex(s => s.distance > globalSource.distance);
                if (index === -1) {
                    // If no larger element is found, push to the end
                    closestSources.push(globalSource);
                } else {
                    // Otherwise, insert at the found index
                    closestSources.splice(index, 0, globalSource);
                }
            }*/
            holding.costMatrix = newCM.serialize();
        }

        // -- FIX --
        //Cost matrix is calculated after the fief gets its room plan, make sure it's there
        //Tick limit so we don't reoute a million of these at once
        if(fief && !holding.remoteRoute && Memory.kingdom.fiefs[fief].costMatrix && Game.cpu.tickLimit-Game.cpu.getUsed() > Game.cpu.tickLimit/2){
            //Get storage position or pull from plan if not available
            let storePos = Game.rooms[fief].storage ? Game.rooms[fief].storage.pos : new RoomPosition(Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].x,Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].y,fief);       
            //Create an array of room position objects for the road planner
            let sourcePos = []
            for(let source of Object.values(holding.sources)){
                sourcePos.push(new RoomPosition(source.x,source.y,holdingName))
            }
            let holdingPositions = {
                sources:sourcePos,
                controller:new RoomPosition(holding.controller.x,holding.controller.y,holdingName)
            };
            remoteRoute = this.routeRemoteRoad(holdingPositions,storePos);

            //Update holding CM
            //Keep track of other room CMs we're updating
            let thisCM = PathFinder.CostMatrix.deserialize(holding.costMatrix)
            let otherCM;
            let otherRoom;
            let otherRoomType;
            let fiefPlan;
            if(!remoteRoute) console.log("BAD ROUTE FOR",holdingName)
                else{
                    holding.remoteRoute = remoteRoute;
                    remoteRoute.forEach(spot =>{
                        if(spot.roomName == holdingName){
                            thisCM.set(spot.x,spot.y,1)
                        }
                        //If it isn't this holding, see if we can update another room's CM
                        //See if we've already got it
                        else if(otherRoom && otherCM && spot.roomName == otherRoom){
                            //Update the existing other room's CM if not already set
                            if(otherCM.get(spot.x,spot.y) == 0){
                                otherCM.set(spot.x,spot.y,1)
                                //Update fief room plan if needed
                                if(otherRoomType == 'fiefs'){
                                    fiefPlan.push({x:spot.x,y:spot.y})
                                }
                            }
                        }
                        //If we don't already have it, or it's a different room, get it
                        //Check holdings
                        else if(Memory.kingdom.holdings[spot.roomName]){
                            //First, submit the other room's CM if need be
                            if(otherRoom){
                                Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                            }
                            //Set our tracking for the other room
                            otherRoom = spot.roomName
                            otherRoomType = 'holdings'
                            //Get the other CM
                            otherCM = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[spot.roomName].costMatrix);
                            //Set the cost we found
                            if(otherCM.get(spot.x,spot.y) == 0){
                                otherCM.set(spot.x,spot.y,1)
                            }
        
                        }
                        //Same for fiefs
                        else if(Memory.kingdom.fiefs[spot.roomName]){
                            if(otherRoom){
                                Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                            }
                            otherRoom = spot.roomName
                            otherRoomType = 'fiefs'
                            fiefPlan = Memory.kingdom[otherRoomType][otherRoom].roomPlan[Game.rooms[otherRoom].controller.level][STRUCTURE_ROAD]
                            otherCM = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[spot.roomName].costMatrix);
                            if(otherCM.get(spot.x,spot.y) == 0){
                                otherCM.set(spot.x,spot.y,1)
                                //Add the road to their room plan for the current level
                                fiefPlan.push({x:spot.x,y:spot.y})
                            }
                        }
                        
                    })
                    //Submit CM for our holding and for the other room if we have one
                    holding.costMatrix = thisCM.serialize();
                    if(otherCM){
                        Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                    }
            }

        }

        //Only recalculate distance paths once we're at a certain fief level for roads, 4 likely
        /*Object.keys(holding.sources).forEach(source =>{
            //If there is no route, or it's only a controller route, calculate
            //Route if storage
            if(!holding.sources[source].route && holding.costMatrix){
                let newPath;
                let storePos = Game.rooms[fief].storage ? Game.rooms[fief].storage.pos : new RoomPosition(Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].x,Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].y,fief)
                let sourcePos = new RoomPosition(holding.sources[source].x,holding.sources[source].y,holdingName)
                newPath = PathFinder.search(storePos,{pos:sourcePos,range:1},{
                    plainCost:10,
                    swampCost:12,
                    maxOps:14000,
                    ignoreCreeps:true,
                    roomCallback: function(roomName){
                        let room = Game.rooms[roomName];
                        let costs;
                        if(Memory.kingdom.fiefs[roomName] && Memory.kingdom.fiefs[roomName].costMatrix){
                            costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                        }
                        //Check holdings
                        else if(Memory.kingdom.holdings[roomName] && Memory.kingdom.holdings[roomName].costMatrix){
                            costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                        }else{
                            costs = new PathFinder.CostMatrix
                        }
                         //- Shouldn't need this bit
                        if(room){
                            room.find(FIND_STRUCTURES).forEach(function(struct) {
                                if (struct.structureType === STRUCTURE_ROAD) {
                                    // Favor roads over plain tiles
                                    costs.set(struct.pos.x, struct.pos.y, 1);
                                }
                                });
                        };                            
                        return costs;
                    },
                });

                let endSite = newPath.path[newPath.path.length-1];
                //Assign path to source route
                holding.sources[source].route = newPath.path;
                
            }
            // -- Come back to this for holding construction
            else if(false){
                //Else, periodically make sure we have roads if home level and energy can support it
                if(Game.time % 80 && !holding.sources[source].standby && Game.rooms[room] && (homeStorage && homeLevel >= 4 && homeStorage.store[RESOURCE_ENERGY] >=roadBuildLimit)){
                    holding.sources[source].route.forEach(spot => {
                        //Build site unless it's the last one, don't need a road under the can
                        if(Game.rooms[spot.roomName] && spot != holding.sources[source].route[holding.sources[source].route.length-1]) {
                            let spotStruct = Game.rooms[spot.roomName].lookForAt(LOOK_STRUCTURES,spot.x,spot.y);
                            let spotSite = Game.rooms[spot.roomName].lookForAt(LOOK_CONSTRUCTION_SITES,spot.x,spot.y);
                            if((!spotStruct.length && !spotSite.length) && (spot.x > 0 && spot.x < 49 && spot.y > 0 && spot.y < 49)){
                                let x = Game.rooms[spot.roomName].createConstructionSite(spot.x,spot.y,STRUCTURE_ROAD);
                                console.log("SITE5",spot.roomName)
                            }
                        }
                    })
                }
            }
        })*/
        
        
        
        //------Room Operation------//
        if(holding.standby){
            return;
        }



        if(Game.time % 3 == 0){
            if(!enemyReserve){
                //-- Harvester --
                //Check each source for open space and harvester need
                //console.log("RUNNING HOLDING SPAWN")
                //console.log("Sources",JSON.stringify(holding.sources))
                let targetSources = Object.keys(holding.sources).reduce((obj,key) =>{
                    obj[key] = {harvs:0,power:0,ttlFlag:false};
                    return obj;
                },{});
                if(!fiefCreeps.miner) fiefCreeps.miner = [];
                let fiefMiners = fiefCreeps.miner.filter(creep => creep.memory.holding == holdingName)
                //console.log("TARGET SOURCES",JSON.stringify(targetSources))
                if(fiefMiners){
                    fiefMiners.forEach(creep =>{
                        //console.log("MINER MEMORY",JSON.stringify(creep.memory))
                        creepSource = creep.memory.target;
                        targetSources[creepSource].harvs++;
                        targetSources[creepSource].power += creep.getActiveBodyparts(WORK) * HARVEST_POWER;
                    })
                }

                //For each source, see if we have enough harvest power or enough space for a new harvester
                Object.entries(holding.sources).forEach(([sourceID,source])=>{
                    //If there's no room, or if we have enough harvest power, return

                    if((source.openSpots <= targetSources[sourceID].harvs || targetSources[sourceID].power >= (isReserved ? SOURCE_ENERGY_CAPACITY : SOURCE_ENERGY_NEUTRAL_CAPACITY)/ENERGY_REGEN_TIME)) return;

                    //If not enough strength and we have room, order a new harvester. Higher sev if it's closest.
                    let sev = 30
                    if(source.closest) sev+= 15
                    //console.log("Adding remote harv to spawnQueue")
                    registry.requestCreep({sev:sev,memory:{role:'miner',fief:fief,target:sourceID,holding:holdingName,status:'spawning',preflight:false}})
                    
                });
            }
            

            //If we have the energy capacity in our home fief and we need a reservation, ask for a claim creep if needed
            //We want vision for this
            if(remote){
                let reserverSet = false
                if(fiefCreeps.claimer){
                    for(creep of fiefCreeps.claimer){
                        if(creep.memory.holding == holdingName && creep.memory.job == 'reserver'){
                            reserverSet = true;
                        }
                    }
                }
                
                if(!reserverSet && Game.rooms[fief].energyCapacityAvailable >= 1300){
                    let spots = helper.getOpenSpots(remote.controller.pos,true);
                    //See if we have a mission already

                    if(!spots.length){
                        let hasMission = false;
                        if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                            for(let mission of global.heap.missionMap[holdingName]){
                                if(mission.type == 'demo') hasMission = true;
                                break;
                            }
                        }
                        //If no open spots, get a path from a source to the controller(just so we know it won't take a lot of CPU) and clear it out.
                        if(false && !hasMission){
                            let spotsPath = PathFinder.search(Game.getObjectById(Object.keys(holding.sources)[0]).pos,{pos:remote.controller.pos,range:1},{
                                plainCost:1,
                                swampCost:2,
                                maxRooms:1,
                                roomCallback: function(roomName){
                                    console.log(roomName)
                                    let room = Game.rooms[roomName];
                                    let costs = new PathFinder.CostMatrix;
                                    room.find(FIND_STRUCTURES).forEach(function(struct) {
                                        //Find unwalkable structures in the room, set their cost to 30 so it doesn't want to path through them but we still find the controller
                                        if (struct.structureType !== STRUCTURE_CONTAINER && struct.structureType !== STRUCTURE_ROAD) {
                                          costs.set(struct.pos.x, struct.pos.y, 30);
                                        }
                                      });
                                      
                                    return costs;
                                }
                            });
                            let structs = [];
                            for(let spot of spotsPath.path){
                                //Get the first index because only one unwalkable can be on each spot
                                let find = spot.look().filter(item => item.type == 'structure' && OBSTACLE_OBJECT_TYPES.includes(item.structure.structureType));
                                if(!find.length) continue;
                                structs = structs.concat(find[0]['structure']);
                                //Now we submit a mission for our list of structures
                                //roomName, priority, type, targets
                                
                            }
                            marshal.addMission({roomName:holdingName,type:'demo',targets:structs.map(st => st.id)});
                        }
                    }
                    
                   // console.log("Reserver checks")
                   // console.log(`For remote: ${remote.name}. Reserver set:${reserverSet},fiefCreep role:${fiefCreeps.claimer},isReserved:${isReserved},spots:${spots}`)
                    if((!(isReserved) || remote.controller.reservation.ticksToEnd <= CONTROLLER_RESERVE_MAX/2) && spots.length){
                        registry.requestCreep({sev:20,memory:{role:'claimer',job:'reserver',fief:fief,target:{x:remote.controller.pos.x,y:remote.controller.pos.y,id:remote.controller.id},holding:holdingName,status:'spawning',preflight:false}})
                    }
                }
            }
            
        }

        //Check for dropped resources and submit tasks as needed
        if(remote){
            let droppedResources = remote.find(FIND_DROPPED_RESOURCES);
            //console.log("Checking drops in",remote.name,"and found",droppedResources.length)
            //Retrieve current tasks to check against
            droppedResources.forEach(resource => {
                const { id, amount, resourceType } = resource;
        
                //Details object for the addRequest call
                let details = {
                    type: 'pickup',
                    targetID: id,
                    amount: amount,
                    resourceType: resourceType,
                    international : true,
                    priority: 5
                };
                //console.log("Attempting to add",JSON.stringify(details))
                const taskID = supplyDemand.addRequest(Game.rooms[holding.homeFief], details);
                //console.log('Holding added new task:', taskID);
            });
        }
        
        

        return;
        //If we have vision, do things
        if(remote){
            let roomBaddies = remote.find(FIND_HOSTILE_CREEPS);
            let roomCores = remote.find(FIND_HOSTILE_STRUCTURES);
            let roomSites = remote.find(FIND_MY_CONSTRUCTION_SITES);
            //console.log(roomBaddies.length)
            //Set alarm false before re-running check
            holding.alarm = false;
            //Check for enemies and raise alarm
            if(roomBaddies.some(creep => !helper.isScout(creep) && !Memory.diplomacy.allies.includes(creep.owner.username))){
                //console.log("YES")
                //Check each hostile to make sure they aren't all allies
                for(let each of roomBaddies){
                        //Mark invader if it is
                        if(each.owner.username == "Invader"){
                            holding.alarm = true;
                            holding.alarmType = 'Invader';
                        }
                        //See if it's just a scout
                        else if(!helper.isScout(each)){
                            holding.alarm = true;
                            holding.alarmType = 'Invader';
                        }

                        //Set defense mission if hostile creeps are detected and they're not scouts
                        if(!Memory.kingdom.missions.defend[room]){
                            missionManager.createMission('defend',room,{invader:true,hostileCreeps:roomBaddies,core:roomCores.length >0})
                        }
                    }
            }
            if(roomCores.length && !holding.alarm){
                holding.alarm = true;
                holding.alarmType = 'Core';
            }
            //Check reservation status and request claimer if needed, if homeroom can support it
            if(!remote.controller || !remote.controller.reservation || remote.controller.reservation.ticksToEnd < 2000 || remote.controller.reservation.username == 'Invader'){
                //Check if a claimer is already assigned and alive, or queued. Add to homeroom spawn queue if not
                let claimBody = [MOVE,CLAIM];
                let claimCost = 650;
                let mult = Math.floor(homeEnergy/claimCost);
                let newBod = [].concat(...Array(Math.min(mult, 5)).fill(claimBody));
                if(homeEnergy >= 1300 && (!holding.claimer || (!Game.creeps[holding.claimer] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.claimer]))){
                    let newName = 'Baron '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:newBod,
                        memory:{role:'claimer',job:'reserver',homeRoom:homeRoom,fief:homeRoom,holding:room,targetRoom:room,controllerPos:{x:remote.controller.pos.x,y:remote.controller.pos.y},preflight:false}}
                    holding.claimer = newName;                    
                }
            }


            let cSiteWork = 0;
            remote.find(FIND_MY_CONSTRUCTION_SITES).forEach(site => {
                cSiteWork += site.progressTotal;
            });
            //console.log(cSiteWork,' Total Work in ',room)
            //If there are construction sites, submit builder request to homeroom spawn if one isn't around already
            if((!holding.standby && !builder || (!Game.creeps[builder] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[builder])) && roomSites.length && homeEnergy >= 650){
                let newName = 'Engineer '+helper.getName()+' of House '+room;
                Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                    sev:2,body:[MOVE,CARRY,WORK,MOVE,CARRY,WORK,MOVE,WORK,WORK],
                    memory:{role:'builder',job:'remoteBuilder',homeRoom:room,holding:room,fief:homeRoom,preflight:false}}
                holding.builder = newName;   
            }
        }
        
        
        //All other operations that don't require vision
        //If alarm and no defender alive/queued
        //Expand this later for more robust defense options
        if(homeEnergy >= 1300 && holding.alarm && (!holding.remoteDefender || (!Game.creeps[holding.remoteDefender] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.remoteDefender]))){
            let defenderBody;
            let dJob = holding.alarmType
            let dName;
            switch(holding.alarmType){
                case 'Invader':
                    defenderBody = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL];
                    dName = 'Archer '
                    break;
                case 'Core':
                    defenderBody = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                    dName = 'Pikeman'
                    break;
            }
            let newName = dName+helper.getName()+' of House '+room;
            Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                sev:8,body:defenderBody,
                memory:{role:'remoteDefender',job:dJob,targetRoom:room,holding:room,fief:homeRoom,preflight:false}}
            holding.remoteDefender = newName;  
        }else if(holding.alarm && (!holding.remoteDefender || (!Game.creeps[holding.remoteDefender] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.remoteDefender]))){
            //holding.standby = true;
        }
        
        //Loop through sources
        for(let source in holding.sources){
            let each = holding.sources[source];
            
            //Start source info for room status
            //roomStatus += ('\nSource '+each.id+':');
            
            //If source is on standby or no route yet, skip
            if(each.standby || !each.route){
                //console.log("STANDBY SOURCE");
                break;
            }
            //Can sites
            if(!each.x || !each.y){

                each.x = each.route[each.route.length-1].x;
                each.y = each.route[each.route.length-1].y;
            }
            
            //Check if can ID doesn't exist or if we have vision and can confirm the can isn't active. If either, request builder and set up a CSite for a new can.
            //No cans until home is able to support
            if(homeLevel >= 4 && (!each.can || (remote && !Game.getObjectById(each.can)))){
                let justBuilt = false;
                //Make sure we haven't just built a can
                if(remote){
                    let spot = remote.lookForAt(LOOK_STRUCTURES,each.x,each.y);
                    //console.log(spot)
                    //If we found stuff
                    if(spot.length){
                        //Check each thing on the tile and see if it's a container
                        for(let every of spot){
                            if(every.structureType == STRUCTURE_CONTAINER){
                                //If we have, assign its ID
                                each.can = every.id
                                justBuilt = true;
                                //If we have a trucker, tell them to use the can
                                if(Game.creeps[each.trucker]){
                                    Game.creeps[each.trucker].memory.canID = every.id
                                }
                            }
                        }
                        
                    }
                }
                if(!justBuilt && homeStorage && homeStorage.store[RESOURCE_ENERGY] > canBuildLimit){
                    //If we haven't just built a can, add can request to status feed if homeroom can support.
                    //roomStatus += ('\nMissing Can');

                    //If we have vision, and if no CSite for the can exists, create one

                    if(remote && !remote.lookForAt(LOOK_CONSTRUCTION_SITES,each.x,each.y).length){
                        remote.createConstructionSite(each.x,each.y,STRUCTURE_CONTAINER);
                        console.log("SITE6")
                    }
                }
            }
            //console.log(!Game.creeps[each.miner],'test')
            //Check to see if miner is assigned/alive/queued. If not, request from homeroom.
            let minerBody = [MOVE,MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK]
            //If storage, slightly bigger body to save on intents and can repair
            if(homeEnergy >= 1000 ) minerBody = [MOVE,MOVE,MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK]
            if(!holding.alarm && homeEnergy >= 1300 && (!each.miner || ((!Game.creeps[each.miner] || (each.route && Game.creeps[each.miner].ticksToLive < 30 + each.route.length)) && !Memory.kingdom.fiefs[homeRoom].spawnQueue[each.miner]))){
                let newName = 'Yeoman '+helper.getName()+' of House '+room;
                Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                    sev:4,body:minerBody,
                    memory:{role:'miner',homeRoom:room,fief:homeRoom,holding:room,harvestSpot:{x:each.x,y:each.y,id:each.id,can:each.can},routeLength:each.route.length,preflight:false}}
                each.miner = newName;
                //console.log('miner')
            }
            //Check to see if trucker is assigned/alive. If not, request from homeroom. Only if there's an active can and home storage
            //Trucker only happens if theres a can so no energy check - Bad logic means we do need a check for now
            if(homeStorage && homeEnergy >= 1300 && !holding.alarm){
                
                //Array of truckers
                //delete each.truckers;
                //return
                if(!each.truckers) each.truckers = [];
                let trucks = [];
                each.truckers.forEach(t => {
                    trucks.push(t);
                });
                //(!each.trucker || ((!Game.creeps[each.trucker] || Game.creeps[each.trucker].ticksToLive < 800) && !Memory.kingdom.fiefs[homeRoom].spawnQueue[each.trucker]))
                //Short fix for now
                if(!each.route) return;
                //Calculate the body needed based on path distance plus a buffer
                let parts = [MOVE,CARRY,CARRY];
                let partsCost = 150;
                //Times 2 for round trip, times 10 for energy per tick, 2 for transferring, plus 10 for buffer
                let carryNeeded = ((each.route.length*2)*10)+2+10;
                //How many arrays we need
                let mult = Math.ceil(carryNeeded/100);
                //Max arrays the room can support, subtracting 150 from energy for work/move array
                let maxMult = Math.floor((homeEnergy-150)/partsCost)

                //Fix maxMult if it's too large, can support 16 arrays of current parts
                if(maxMult > 16){
                    maxMult = 16
                }


                //Total trucks we need for this route
                let totalTrucks = Math.ceil(mult/maxMult);
                //Arrays per truck
                let totalMult = mult/Math.ceil(mult/maxMult);
                /*if(room == 'W44S12' && source == '65a70dc534fa299b8cef8081'){
                    console.log('Total carry needed: ',carryNeeded)
                    console.log('Total arrays needed: ',mult)
                    console.log('Total trucks we need for the route: ',totalTrucks,'\nWith ',totalMult,' arrays each')
                    console.log('Total cost per truck: ',(totalMult*150)+150)

                }*/
                
                //Live truck counter
                let liveTrucks = [];
                //See how many trucks we have right now
                //console.log(trucks)
                trucks.forEach(truck => {
                    if(Game.creeps[truck] || Memory.kingdom.fiefs[homeRoom].spawnQueue[truck]){
                        liveTrucks.push(truck);
                    }
                    //console.log(liveTrucks)
                })
                //console.log("REMOTE ",room,' needs ',totalTrucks,'total trucks. ',liveTrucks.length,' live trucks. ');
                //console.log(liveTrucks.length < totalTrucks)
                //console.log(liveTrucks,' ',room)
                if(liveTrucks.length < totalTrucks){
                    //console.log('mult: ',mult,' totalTrucks: ',totalTrucks)
                    let truckerBody = [].concat(...Array(Math.ceil(totalMult)).fill(parts));
                    truckerBody.push(WORK,MOVE);
                    let newName = 'Caravaner '+helper.getName()+' of House '+room;
                    //console.log(truckerBody);
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:truckerBody,
                        memory:{role:'trucker',homeRoom:room,fief:homeRoom,holding:room,pickupSpot:[each.x,each.y],sourceID:each.id,canID:each.can,homeRoom:homeRoom,targetRoom:room,routeLength:each.route.length,preflight:false}}
                    liveTrucks.push(newName);
                }
                each.truckers = liveTrucks;

                /*liveTrucks.forEach(k => {
                    each.truckers.push(k)
                })*/
                //console.log(each.truckers)
                //console.log(liveTrucks,' LIVE')
                

            }
            //Check if no home storage to send remote generalists instead
            /*else if(homeEnergy >= 700 && homeEnergy < 1300){
                
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                if(genCount < totalNeed){
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,WORK,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }
            else if(!homeStorage && homeEnergy >= 550){
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                
                if(genCount < totalNeed){
                    console.log(room)
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }else if(!homeStorage && homeEnergy < 550){
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                
                if(genCount < totalNeed){
                    console.log(room)
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,CARRY,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }*/
            
        }
        
        
        if(!holding.alarm){
            holding.standby = false;
        }

        //Visualize paths
        /*Object.keys(holding.sources).forEach(source => {
            holding.sources[source].route.forEach(spot => {
                new RoomVisual(spot.roomName).circle(spot);
            })
        })*/

        //Do something with room status, for now console
        //console.log(roomStatus)
    },
    findPathCenterpoint: function(positions,entryPoint){
        let keySites = [...positions]
        keySites.push(entryPoint)
        //Assignments
        let orbitPaths = [];
        let newOrbit = []
        let midPoints = []
        let targetFlag = false;
        let orbitCount = 0;
        let safetyCatch = 0;
        let pathOpts = {
            // Same cost for everything because we're finding a centerpoint
            plainCost: 1,
            swampCost: 1,
            maxOps:10000,
            roomCallback: function(roomName) {
      
                let room = Game.rooms[roomName];
                let costs = new PathFinder.CostMatrix;    
                if (room){
                  room.find(FIND_STRUCTURES).forEach(function(struct) {
                      if (struct.structureType === STRUCTURE_ROAD) {
                        // Set roads the same as plain tiles for now
                        costs.set(struct.pos.x, struct.pos.y, 1);
                      } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                 (struct.structureType !== STRUCTURE_RAMPART ||
                                  !struct.my)) {
                        // Can't walk through non-walkable buildings
                        costs.set(struct.pos.x, struct.pos.y, 255);
                      }
                    });
                }
                return costs;
              }
        }
        



        console.log("Orbit key sites:\n",JSON.stringify(keySites))
        //Get initial paths between all key sites and store them in the newOrbit array
        for(let i = 0; i < keySites.length ; i++){
            if(i+1 == keySites.length){
                let orPath = PathFinder.search(keySites[i], {pos:keySites[0],range:1},pathOpts)
                //if(orPath.incomplete){
                    //console.log("INCOMPLETE ORBIT")
                    //console.log(orPath.path)
                    //console.log('Keysite1:',JSON.stringify(keySites[i]),'Keysite2:',JSON.stringify(keySites[0]))
                //}
                newOrbit.push(orPath.path)
            }
            else{
                let orPath2 = PathFinder.search(keySites[i], {pos:keySites[i+1],range:1},pathOpts)
                //if(orPath2.incomplete){
                    //console.log("INCOMPLETE ORBIT")
                    //console.log(orPath2.path)
                    //console.log('Keysite1:',JSON.stringify(keySites[i]),'Keysite2:',JSON.stringify(keySites[i+1]))
                //}
                newOrbit.push(orPath2.path)
            }
            
        }
        //console.log("Orbit:",JSON.stringify(newOrbit))
        //Push this orbit to the main array
        orbitPaths.push(newOrbit)
        //Loop around making more paths until we are close enough to find a target
        while(!targetFlag){
            //Clear old midpoints of the paths and get new ones
            midPoints = [];
            orbitPaths[safetyCatch].forEach(path => {
                midPoints.push(path[Math.floor(path.length/2)]);
            })
            //Check to see if ranges are good. If any one isn't, flip the flag back to false
            targetFlag = true;
            //Remove duplicate midpoints first
            const seen = new Set();
            //console.log("POS",JSON.stringify(pos))
            let bar = midPoints.filter(pos => {
                
                const serialized = pos.x + ',' + pos.y + ',' + pos.roomName;
                if (seen.has(serialized)) {
                    return false;
                }
                seen.add(serialized);
                return true;
            });
            midPoints = bar;
            midPoints.forEach(spot1 => {
                midPoints.forEach(spot2 => {
                    try{
                        if(!spot1.inRangeTo(spot2,1)){
                            targetFlag = false;
                        }
                        //console.log(spot1,spot2)
                    }
                    catch(e){
                        console.log('Error',e)
                        console.log(midPoints)
                        console.log(spot1)
                        console.log(spot2)
                        targetFlag = true
                    }
                })
            })

            //Safety catch so we don't loop infinitely and serves as an index for orbitPaths above
            if(targetFlag || safetyCatch == 10) break;
            safetyCatch++;

            //At this point ranges aren't good and we're still in the safe loop count, so we path another set
            //Clear the newOrbit array
            newOrbit = []
            for(let i = 0; i < midPoints.length ; i++){
                if(i+1 == midPoints.length){
                    newOrbit.push(PathFinder.search(midPoints[i],midPoints[0],pathOpts).path);
                }
                else{
                    newOrbit.push(PathFinder.search(midPoints[i],midPoints[i+1],pathOpts).path);
                }
                
            }
            //Push the new round of paths to the main array
            orbitPaths.push(newOrbit)
        }
        //Now we have the midpoints within an acceptable range, so we average the coordinates to get the center point.
        let sumX = 0;
        let sumY = 0;
        for (const pos of midPoints) {
            sumX += pos.x;
            sumY += pos.y;
        }
        return {
            paths:orbitPaths,
            centerX:Math.floor(sumX / midPoints.length),
            centerY:Math.floor(sumY / midPoints.length)
        };

    },
    interpolateColors: function(start, end, progress) {
        // Interpolate each RGB component separately
        const r = Math.round(start.r + (end.r - start.r) * progress);
        const g = Math.round(start.g + (end.g - start.g) * progress);
        const b = Math.round(start.b + (end.b - start.b) * progress);

        return { r, g, b };
    },
    routeRemoteRoad: function(holdingPositions,entryPoint){
        let startCPU = Game.cpu.getUsed();
        let roomName = holdingPositions.controller.roomName;
        let keySites = holdingPositions.sources;
        keySites.push(holdingPositions.controller)
        let sources = holdingPositions.sources;
        //console.log(keySites[1] instanceof RoomPosition)
        //console.log("Keysites",keySites)
        //Assignments
        //All routes
        let totalRoutes = {}
        //Current route we're working on
        let thisRoute = []
        let thisRouteSet = new Set();
        //Array of targets for this run
        let thisTargets = []        
        let midRoute = []
        let roomOpts ={
            plainCost: 10,
            swampCost: 11,
            maxOps:10000,
            roomCallback: function(roomName) {
              let room = Game.rooms[roomName];
              let isFief = false
              let costs;
              if(Memory.kingdom.fiefs[roomName] && Memory.kingdom.fiefs[roomName].costMatrix){
                costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix).clone()
                isFief = true;
              }
              else if(Memory.kingdom.holdings[roomName] && Memory.kingdom.holdings[roomName].costMatrix){
                costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix).clone()
              }
              else{
                costs = new PathFinder.CostMatrix;;
              }
              if (room && !isFief){
                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                      costs.set(struct.pos.x, struct.pos.y, 9);
                    }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_RAMPART ||
                         !struct.my)) {
                    // Can't walk through non-walkable buildings
                    costs.set(struct.pos.x, struct.pos.y, 255);
                    }
                  });
              };
              for(let spot of thisRoute){
                if(spot.roomName == roomName) costs.set(spot.x,spot.y,9)
              }
              return costs;
            },
        };

        let midpoint = this.findPathCenterpoint(keySites,entryPoint)

        //console.log(JSON.stringify(midpoint))
        let midTarget = new RoomPosition(midpoint.centerX,midpoint.centerY,roomName)
        
        //If midpoint isn't in terrain, run its check
        let terrain = Game.map.getRoomTerrain(roomName)
        let tile = terrain.get(midpoint.centerX,midpoint.centerY);
        if(tile != TERRAIN_MASK_WALL){
            midRoute = PathFinder.search(entryPoint,midTarget,roomOpts).path;
        }

        //If we have a valid midpoint, run a set using it
        if(midRoute.length){
            
            //Set the route
            for(let each of midRoute){
                let spotKey = `${each.x},${each.y}${each.roomName}`
                if(!thisRouteSet.has(spotKey)){
                    thisRouteSet.add(spotKey)
                    thisRoute.push(each)
                }
            }
            //Secondary pathfinds
            keySites.forEach(target =>{
                let keyPath = PathFinder.search(entryPoint, {pos:target,range:1},roomOpts).path
                //Remove the end
                keyPath.pop();
                for(let spot of keyPath){
                    let spotKey = `${spot.x},${spot.y}${spot.roomName}`
                    if(!thisRouteSet.has(spotKey)){
                        thisRouteSet.add(spotKey)
                        thisRoute.push(spot)
                    }
                }
                
                
            })


            //Add to total routes
            totalRoutes.midPoint = thisRoute
            //Clear route for this site
            thisRoute = []
            thisRouteSet = new Set();
            //console.log("Midpoint route:")
            //console.log(totalRoutes)
        }
        //console.log("Keysites 2",keySites)
        keySites.forEach(site => {
            //For each key site position
            //Clear list of targets for this site
            thisTargets = [];
            //Clear route for this site
            thisRoute = []
            thisRouteSet = new Set();
            
            
            //Get all secondary targets for this site
            keySites.forEach(target=>{
                //If it isn't the current main site, add it to targets
                if(!site.isEqualTo(target)){
                    thisTargets.push(target);
                }
            })
            
            let roundRoute = PathFinder.search(entryPoint, {pos:site,range:1},roomOpts).path;
            //console.log("Route for",site,"to",entryPoint,"\n",roundRoute)
            //Remove the end
            roundRoute.pop();
            for(let spot of roundRoute){
                let spotKey = `${spot.x},${spot.y}${spot.roomName}`
                if(!thisRouteSet.has(spotKey)){
                    thisRouteSet.add(spotKey)
                    thisRoute.push(spot)
                }
            }

            //All other secondary pathfinds
            thisTargets.forEach(target =>{
                roundRoute = PathFinder.search(entryPoint, {pos:target,range:1},roomOpts).path
                //Remove the end
                roundRoute.pop();
                for(let spot of roundRoute){
                    let spotKey = `${spot.x},${spot.y}${spot.roomName}`
                    if(!thisRouteSet.has(spotKey)){
                        thisRouteSet.add(spotKey)
                        thisRoute.push(spot)
                    }
                }
            })


            //Add to total routes
            if(site.isEqualTo(holdingPositions.controller)){
                totalRoutes.controller = thisRoute;
            }
            else if(totalRoutes.source){
                totalRoutes.source2 = thisRoute;
            }else{
                totalRoutes.source = thisRoute;
            }
            
            
        });
        //console.log("All routes:\n")
        //console.log("ALL ROUTES JSON")
        //console.log(JSON.stringify(totalRoutes))
        //Get shortest
        let shortestRoute = [];
        let shortestLen = Infinity;
        for(let route of Object.values(totalRoutes)){
            if(route.length < shortestLen){
                shortestLen = route.length;
                shortestRoute = route;
            }
        }
        Memory.remoteRoadTest = totalRoutes;
        return shortestRoute;
        //Why

    }
};

function getDistanceFF(roomName,origin){
    let terrain = Game.map.getRoomTerrain(roomName)
    let lowestScore = Infinity;
    let highestScore = 0;
    let costMatrix = new PathFinder.CostMatrix;
    let queue = [];
    
    queue.push({pos: origin, distance: 80});
    costMatrix.set(origin.x, origin.y, 80);

    while (queue.length > 0) {
        let tile = queue.shift();
        let adjacentTiles = findAdjacentTiles(tile.pos);
        
        adjacentTiles.forEach(({x, y}) => {
            
            if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                let currentDistance = costMatrix.get(x, y);
                if (currentDistance === 0 || currentDistance < tile.distance - 1) {
                    costMatrix.set(x, y, tile.distance - 1);
                    queue.push({pos: new RoomPosition(x, y, roomName), distance: tile.distance - 1});
                }
            }
        });
    }
    function findAdjacentTiles(pos) {
        const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
        let tiles = [];
        //Get tiles in all directions
        directions.forEach(direction => {
            let x = pos.x + direction[0];
            let y = pos.y + direction[1];
            //If the tile is valid, return it
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                tiles.push({x: x, y: y});
            }
        });
        return tiles;
    }
    //console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
    return costMatrix
}

module.exports = holdingManager;
global.remoteRoad = holdingManager.routeRemoteRoad;
profiler.registerObject(holdingManager, 'holdingManager');