const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const registry = require('registry');
const supplyDemand = require('supplyDemand');
const marshal = require('marshal');

//How often we adjust holdings
const ADD_REMOVE_INTERVAL = 500
var holdingManager = {

    /** @param {Room} room **/
    run: function(kingdomCreeps){
            //Limits at which we add or remove holdings
        const CPU_ADD_LIMIT = Game.cpu.limit * 0.8 //Add if we're below 80%
        const CPU_REMOVE_LIMIT = Game.cpu.limit * 0.9 //Remove if we're above 90%
        //If no CPU, skip
        if(!Memory.trailingCPU || !global.cpuAverage) return;
        let avCPU  = global.cpuAverage;
        console.log(`Holding check. Average CPU: ${avCPU}, Add limit: ${CPU_ADD_LIMIT}`)
        let holdings = Object.keys(Memory.kingdom.holdings).sort((a, b) => 
            Memory.kingdom.holdings[a].distance - Memory.kingdom.holdings[b].distance
        );
        //console.log("All",holdings)
        //Second array of only active holdings
        let activeHoldings = []
        
        for(let key of holdings){
            if(Memory.kingdom.holdings[key].standby){
                //If we have the spare CPU, activate it - only check this every so often
                if(avCPU < CPU_ADD_LIMIT && Game.time % ADD_REMOVE_INTERVAL == 0){
                    //If the room is at or over 90% spawn use then just ignore this one
                    if(Memory.kingdom.fiefs[Memory.kingdom.holdings[key].homeFief].combinedSpawnUse >= 90) continue;
                    //If it's a fief, skip it
                    let data = getScoutData(key);
                    if(data.roomType == 'fief') continue;
                    Memory.kingdom.holdings[key].standby = false;
                    activeHoldings.push(key);
                    break;
                }
                //Else we're done looking
                else{
                    break;
                }
            }
            else{
                activeHoldings.push(key)
            }
        }
        //console.log("Active",activeHoldings)
        //If we're above the cpu limit, pop a remote off the end
        if(avCPU > CPU_REMOVE_LIMIT && Game.time % ADD_REMOVE_INTERVAL == 0){
            let remove = activeHoldings.pop()
            Memory.kingdom.holdings[remove].standby = true;
        }

        //console.log("HOLDINGS")
        for(const each of holdings){
            //We call base work for every holding
            let holding = Memory.kingdom.holdings[each]
            //No point in running holdings that don't have a home room
            if(holding.homeFief && Game.rooms[holding.homeFief]) this.baseWork(each);
        }
        //Now we run operations for each active holding
        //Map of all home fiefs so we prioritize their spawns
        let fiefMap = {}
        for(const each of activeHoldings){
            //If we're about to hit CPU limit, just abandon
            if(Game.cpu.getUsed() > Game.cpu.limit*0.95) break;
            //Fief spawn utilization check in here somewhere
            let holding = Memory.kingdom.holdings[each]
            //Increment our home fief's spawning impact
            fiefMap[holding.homeFief] = (fiefMap[holding.homeFief] || 0) + 1;
            //console.log("FiefMap: ",holding.homeFief,fiefMap[holding.homeFief])
            //If combined spawn use (plus some pad for already run holdings) is too high then we skip (90 for now plus 5 per holding run)
            let skipCheck = 100//93-(fiefMap[holding.homeFief]*2);
            if(Memory.kingdom.fiefs[holding.homeFief].combinedSpawnUse > skipCheck){
                console.log("Holding",each,"failed skipcheck.",Memory.kingdom.fiefs[holding.homeFief].combinedSpawnUse,"spawn use is more than",skipCheck)
                continue;
            }
            kingdomCreeps[holding.homeFief] = kingdomCreeps[holding.homeFief] || []
            let fCreeps = kingdomCreeps[holding.homeFief];
            if(holding.homeFief && Game.rooms[holding.homeFief]) this.runHolding(each,fCreeps,fiefMap[holding.homeFief]);
        }
    },
    baseWork: function(holdingName) {
        //console.log("RUNHOLD")
        let remote = Game.rooms[holdingName]
        let holding = Memory.kingdom.holdings[holdingName];
        let fief = holding.homeFief;
        let data = getScoutData(holdingName)
        global.heap.fiefs[fief] = global.heap.fiefs[fief] || {};
        let fiefHeap = global.heap.fiefs[fief];
        let isReserved = remote && remote.controller.reservation && remote.controller.reservation.username == Memory.me;
        let enemyReserve = remote && remote.controller.reservation && remote.controller.reservation.username != Memory.me;

        let roomMissions = global.heap && global.heap.missionMap && global.heap.missionMap[holdingName] || []
        //------Initial Checks------//
        //Do we have source data for the room
        if(!holding.sources){

            //Do we have scout data (we should, more a safety check for later modifications)
            if(data){
                //If so, record the sources and controller
                holding.sources = data.sources.reduce((obj,source) =>{
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
                    x: data.controller.x,
                    y: data.controller.y
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
            holding.costMatrix = newCM.serialize();
        }

        //Cost matrix is calculated after the fief gets its room plan, make sure it's there
        //Tick limit so we don't reoute a million of these at once
        if(fief && !holding.remoteRoute && Memory.kingdom.fiefs[fief].costMatrix && Game.cpu.tickLimit-Game.cpu.getUsed() > Game.cpu.tickLimit/2){
            //Get storage position or pull from plan if not available
            let storePos = Game.rooms[fief].storage ? Game.rooms[fief].storage.pos : new RoomPosition(Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].x,Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].y,fief);       
            //Create an array of room position objects for the road planner
            let sourcePos = []
            for(let source of Object.values(holding.sources)){
                let rP = new RoomPosition(source.x,source.y,holdingName);
                rP.id = source.id
                sourcePos.push(rP)
            }
            let holdingPositions = {
                sources:sourcePos,
                controller:new RoomPosition(holding.controller.x,holding.controller.y,holdingName)
            };
            remoteRoute = this.routeRemoteRoad(holdingPositions,storePos);
            let totalRoute = []
            if(remoteRoute){
                holding.remoteRoute = true;
                let maxDist = 200;
                let kill = []
                for(let [id,route] of Object.entries(remoteRoute)){
                    if(route.length > maxDist || route[route.length-1].roomName != holdingName){
                        delete Memory.kingdom.holdings[holdingName].sources[id];
                        kill.push(id)
                    }
                }
                kill.forEach(route => { delete remoteRoute[route]})

                //If there are no routes, kill the holding
                if(!Object.keys(remoteRoute).length){
                    delete Memory.kingdom.holdings[holdingName];
                    return;
                }
                //Otherwise set the path routes
                for(let [id,route] of Object.entries(remoteRoute)){
                    holding.sources[id].path = route;
                    totalRoute.push(...route)
                }
                holding.distance = Object.keys(holding.sources).length == 2 ? totalRoute.length : totalRoute.length * 2;
            } 
            //Update holding CM
            //Keep track of other room CMs we're updating
            let thisCM = PathFinder.CostMatrix.deserialize(holding.costMatrix)
            let otherCM;
            let otherRoom;
            let otherRoomType;
            let fiefPlan;
            if(!remoteRoute) console.log("BAD ROUTE FOR",holdingName)
                else{

                    //holding.remoteRoute = remoteRoute;
                    totalRoute.forEach(spot =>{
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
                                    //fiefPlan.push({x:spot.x,y:spot.y})
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
                                //fiefPlan.push({x:spot.x,y:spot.y})
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
        //Check for dropped resources and submit tasks as needed, only if not hostile
        if(remote){
            //Check for hostiles
            let hostiles = remote.find(FIND_HOSTILE_STRUCTURES)
            if(hostiles.length){
                let hasMission = false;
                if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                    for(let mission of global.heap.missionMap[holdingName]){
                        if(mission.type == 'destroyCore') hasMission = true;
                        break;
                    }
                }
                if(!hasMission){
                    marshal.destroyCore(holdingName);
                }
            }
        }
        if(remote && !global.heap.alarms[holdingName] && data.ownerType != 'enemy'){
            
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
                    priority: 5//amount < 1000 ? 5 : 6
                };
                //console.log("Attempting to add",JSON.stringify(details))
                const taskID = supplyDemand.addRequest(Game.rooms[holding.homeFief], details);
                //console.log('Holding added new task:', taskID);
            });
            //Seasonal check for score
            if(Game.shard.name == 'shardSeason' && Game.rooms[holding.homeFief].storage){
                let scoreCans = remote.find(FIND_SCORE_CONTAINERS);
                if(scoreCans.length){
                    for(let can of scoreCans){
                        if(can.ticksToDecay < 100) continue;
                        addSupplyRequest(Game.rooms[holding.homeFief],{type:'pickup',resourceType:RESOURCE_SCORE,amount:can.store.getUsedCapacity(RESOURCE_SCORE),targetID:can.id,international:true,priority:6})
                    }
                }
            }
            const droppedTombstones = remote.find(FIND_TOMBSTONES);
            droppedTombstones.forEach(stone =>{
                Object.entries(stone.store).forEach(([resource,amount]) => {
                    let details = {
                        type: 'pickup',
                        targetID: stone.id,
                        amount: amount,
                        resourceType: resource,
                        priority: 6
                    };
                    supplyDemand.addRequest(Game.rooms[holding.homeFief], details);
                });
            });
            let cans = []
            for(let source of Object.values(holding.sources)){
                if(source.can && Game.getObjectById(source.can) && Game.getObjectById(source.can).store.getUsedCapacity() > 100) cans.push(source.can)
                if(source.can && !Game.getObjectById(source.can) ) delete source.can
            }
            for(let canID of cans){
                let can = Game.getObjectById(canID)
                for(let resType in can.store){
                    let details = {
                        type: 'pickup',
                        targetID: canID,
                        amount: can.store[resType],
                        resourceType: resType,
                        priority: 5,
                        international:true
                    };
                    supplyDemand.addRequest(Game.rooms[holding.homeFief], details);
                }
            }
        }
        
        
    },
    
    runHolding: function(holdingName,fiefCreeps,spawnPad){
        let remote = Game.rooms[holdingName]
        let holding = Memory.kingdom.holdings[holdingName];
        let fief = holding.homeFief;
        let data = getScoutData(holdingName)
        global.heap.fiefs[fief] = global.heap.fiefs[fief] || {};
        let fiefHeap = global.heap.fiefs[fief];
        let isReserved = remote && remote.controller.reservation && remote.controller.reservation.username == Memory.me || false;
        let enemyReserve = remote && remote.controller.reservation && remote.controller.reservation.username != Memory.me || false;
        //console.log(`Holding ${holdingName} running operations. Is Reserved: ${isReserved}. Enemy Reserve: ${enemyReserve}. spawnPad: ${spawnPad}`)
        if(data.ownerType && data.ownerType == 'enemy') return;

        
        if(Game.time % 3 == 0){
            if(!enemyReserve && !global.heap.alarms[holdingName]){
                //-- Harvester --
                //Check each source for open space and harvester need
                //console.log("RUNNING HOLDING SPAWN")
                //console.log("Sources",JSON.stringify(holding.sources))
                let targetSources = Object.keys(holding.sources).reduce((obj,key) =>{
                    obj[key] = {harvs:0,power:0,ttlFlag:false};
                    return obj;
                },{});
                if(!fiefCreeps.miner) fiefCreeps.miner = [];
                let fiefMiners = fiefCreeps.miner.filter(creep => creep.memory.holding == holdingName && (creep.spawning ||creep.ticksToLive > (creep.body.length * CREEP_SPAWN_TIME) + holding.sources[creep.memory.target].path.length))
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

                    if((source.openSpots.length <= targetSources[sourceID].harvs || targetSources[sourceID].power >= (isReserved ? SOURCE_ENERGY_CAPACITY : SOURCE_ENERGY_NEUTRAL_CAPACITY)/ENERGY_REGEN_TIME)) return;
                    let sev = 30
                    //console.log("Adding remote harv to spawnQueue")
                    registry.requestCreep({sev:sev-spawnPad,memory:{role:'miner',fief:fief,target:sourceID,holding:holdingName,status:'spawning',preflight:false}})
                    
                });
            }
            

            //If we have the energy capacity in our home fief and we need a reservation, ask for a claim creep if needed
            //We want vision for this
            if(remote){

                let hostiles = remote.find(FIND_HOSTILE_CREEPS).filter(crp => helper.isSoldier(crp) && !Memory.diplomacy.allies.includes(crp.owner.username) && !Memory.diplomacy.ceasefire.includes(crp.owner.username))
                if(hostiles.length && !global.heap.alarms[holdingName]){
                    global.heap.alarms[holdingName] = {tick:Game.time}
                    let hasMission = false;
                    //Heals don't get one yet
                    let hasHeal = false
                    for(let host of hostiles){
                        if(host.getActiveBodyparts(HEAL) > 0) hasHeal = true;
                    }
                    if(hasHeal) return;
                    if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                        for(let mission of global.heap.missionMap[holdingName]){
                            if(mission.type == 'defend') hasMission = true;
                            break;
                        }
                    }
                    if(!hasMission){
                        marshal.defend(holdingName);
                    }
                }else{
                    if(!hostiles.length && global.heap.alarms[holdingName]){
                        delete global.heap.alarms[holdingName];
                        let myMission;
                        if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                            for(let mission of global.heap.missionMap[holdingName]){
                                if(mission.type == 'defend') myMission = mission;
                                break;
                            }
                        }
                        if(myMission){
                            myMission.complete();
                        }
                    }
                }
                //Get controller spots if we don't
                if(!holding.controllerSpots) holding.controllerSpots = helper.getOpenSpots(remote.controller.pos).length

                let reserverPower = 0;
                let claimers = 0;
                let tickend = false;
                if(fiefCreeps.claimer){
                    for(creep of fiefCreeps.claimer){
                        if(creep.memory.holding == holdingName && creep.memory.job == 'reserver' && creep.ticksToLive > holding.distance){
                            claimers ++;
                            reserverPower+= creep.getActiveBodyparts(CLAIM);
                        }
                    }
                }
                
                if(reserverPower < 2 && Game.rooms[fief].energyCapacityAvailable >= 650){
                    //let spots = helper.getOpenSpots(remote.controller.pos,true);
                    //See if we have a mission already
                   // console.log("Reserver checks")
                   // console.log(`For remote: ${remote.name}. Reserver set:${reserverSet},fiefCreep role:${fiefCreeps.claimer},isReserved:${isReserved},spots:${spots}`)
                   if((!(isReserved) || remote.controller.reservation.ticksToEnd <= CONTROLLER_RESERVE_MAX*0.8) && claimers < holding.controllerSpots){
                        registry.requestCreep({sev:30.1-spawnPad,memory:{role:'claimer',job:'reserver',fief:fief,target:{x:remote.controller.pos.x,y:remote.controller.pos.y,id:remote.controller.id},holding:holdingName,status:'spawning',preflight:false}})
                    }
                    if(false && !spots.length){
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
                    

                }
            }
            
        }


        
        

        return;
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
            maxRooms:32,
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
                if(!pos) return false;
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
        let paths = []
        let thisRouteSet = new Set();
        //Array of targets for this run
        let thisTargets = []        
        let midRoute = []
        let roomOpts ={
            plainCost: 10,
            swampCost: 11,
            maxOps:20000,
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
            let midpathObj = {}
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
                if(target.id){
                    midpathObj[target.id] = keyPath
                }
                //Remove the end
                //keyPath.pop();
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
            paths.push(midpathObj)
        }
        //console.log("Keysites 2",keySites)
        keySites.forEach(site => {
            let sitepathObj = {}
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
            if(site.id){
                sitepathObj[site.id] = roundRoute
            }
            //console.log("Route for",site,"to",entryPoint,"\n",roundRoute)
            //Remove the end
            //roundRoute.pop();
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
                if(target.id){
                    sitepathObj[target.id] = roundRoute
                }
                //Remove the end
                //roundRoute.pop();
                for(let spot of roundRoute){
                    let spotKey = `${spot.x},${spot.y}${spot.roomName}`
                    if(!thisRouteSet.has(spotKey)){
                        thisRouteSet.add(spotKey)
                        thisRoute.push(spot)
                    }
                }
            })

            paths.push(sitepathObj)
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
        let shortestRoute;
        let shortestLen = Infinity;
        /*for(let route of Object.values(totalRoutes)){
            if(route.length < shortestLen){
                shortestLen = route.length;
                shortestRoute = route;
            }
        }*/
       console.log("PATHS")
       console.log(JSON.stringify(paths))
       for(let each of paths){
            let total = 0;
            for(let [id,path] of Object.entries(each)){
                total += path.length
            }
            if(total < shortestLen){
                shortestLen = total;
                shortestRoute = each;
            }
       }
        //Memory.remoteRoadTest = totalRoutes;
        console.log("SHRT ROUTE")
        console.log(JSON.stringify(shortestRoute))
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