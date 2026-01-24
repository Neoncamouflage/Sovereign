const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const registry = require('registry');
const supplyDemand = require('supplyDemand');
const marshal = require('marshal');

//How often we adjust holdings
const ADD_REMOVE_INTERVAL = 100
var holdingManager = {

    run: function(kingdomCreeps){
        //Clear out tracked holdings
        if(heap.fiefs){
            for(let each of Object.values(heap.fiefs)){
                each.holdingDist = 0
            }
        }
        //Clear recorded kingdomholdings every time we check for spawns, because that's when it updates.
        if(Game.time % GLOBAL_SPAWN_INTERVAL == 0) heap.kingdomStatus.activeHoldings = []
        const CPU_ADD_LIMIT = Game.cpu.limit * 0.8 //Add if we're below 80%
        const CPU_REMOVE_LIMIT = Game.cpu.limit * 0.9 //Remove if we're above 90%
        for(let ck of Object.keys(Memory.kingdom.holdings)){
            let hold = Memory.kingdom.holdings[ck];
            if(!Memory.kingdom.fiefs[hold.homeFief]) delete Memory.kingdom.holdings[ck]
        }
        //If no CPU, skip
        if(!Memory.trailingCPU || !global.cpuAverage) return;
        let avCPU  = global.cpuAverage;
        //Sort and save holdings, check to make sure we aren't short any that have been added
        if(!heap.sortedHoldings || heap.sortedHoldings.length != Object.keys(Memory.kingdom.holdings).length){
            heap.sortedHoldings = Object.keys(Memory.kingdom.holdings).sort((a, b) => {
                let distanceA = Memory.kingdom.holdings[a].distance;
                let distanceB = Memory.kingdom.holdings[b].distance;
                
                if (Memory.kingdom.holdings[a].sources) {
                    if(Object.keys(Memory.kingdom.holdings[a].sources).length === 1)distanceA *= 2.5;
                    else if(Object.keys(Memory.kingdom.holdings[a].sources).length === 3)distanceA *= 0.3;
                }
                
                if (Memory.kingdom.holdings[b].sources) {
                    if(Object.keys(Memory.kingdom.holdings[b].sources).length === 1)distanceB *= 2.5;
                    else if(Object.keys(Memory.kingdom.holdings[b].sources).length === 3)distanceB *= 0.3;
                }
                
                return distanceA - distanceB;
            });
        }
        let holdings = heap.sortedHoldings;
        //No remote stuff for rooms under attack
        if(heap.wardens && Object.keys(heap.wardens).length) holdings = holdings.filter(rm => !Object.keys(heap.wardens).includes(rm))
        //console.log("All",holdings)
        //Second array of only active holdings
        let activeHoldings = []
        for(let key of holdings){
            let data = getScoutData(key);
            if(data.roomType == 'fief'){
                delete Memory.kingdom.holdings[key]
                continue;
            }
            //console.log("CHECKING",key,"STANDBY: ",Memory.kingdom.holdings[key].standby)
            if(!Memory.kingdom.holdings[key].standby && (Game.rooms[Memory.kingdom.holdings[key].homeFief].controller.level >=7 || describeRoom(key) != ROOM_SOURCE_KEEPER)){
                activeHoldings.push(key)
            }
            //if(Memory.kingdom.holdings[key].standby){
                //First we check to see if we should consider this a real standby addition. If not, we continue so the loop keeps going

                //If overridden, continue
                //if(Memory.kingdom.holdings[key].override) continue;
                //If the room is at or over 90% spawn use then just ignore this one
                //if(Memory.kingdom.fiefs[Memory.kingdom.holdings[key].homeFief].combinedSpawnUse >= 90) continue;

                //If we have the spare CPU, activate it - only check this every so often, less often for higher GCL
                //if(avCPU < CPU_ADD_LIMIT && Game.time % (ADD_REMOVE_INTERVAL*Game.rooms[Memory.kingdom.holdings[key].homeFief].controller.level) == 0){
                    //Memory.kingdom.holdings[key].standby = false;
                    //If we add it to actives, break so we stop considering them.
                    //activeHoldings.push(key);
                    //break;
                //}
                //Else we're done looking
                //else{
                    //break;
                //}
            //}
            //else{
                //console.log("Adding to active holdings")
                //activeHoldings.push(key)
            //}
        }
        //console.log("Active holdings!",activeHoldings)
        //If we're above the cpu limit, pop a remote off the end
        //if(avCPU > CPU_REMOVE_LIMIT && Game.time % (ADD_REMOVE_INTERVAL*5) == 0){
            //let remove = activeHoldings.pop()
            //Memory.kingdom.holdings[remove].standby = true;
        //}

        //console.log("HOLDINGS")
        
        for(const each of holdings){
            //We call base work for every holding
            let holding = Memory.kingdom.holdings[each]
            if(!Memory.kingdom.fiefs[holding.homeFief].roadsDone)Memory.kingdom.fiefs[holding.homeFief].roadsDone={}
            //If not aleady in the roadsDone object, add and mark with a zero
            if(!Memory.kingdom.fiefs[holding.homeFief].roadsDone[each])Memory.kingdom.fiefs[holding.homeFief].roadsDone[each]=0;
            //No point in running holdings that don't have a home room
            if(holding && holding.homeFief && Game.rooms[holding.homeFief]) this.baseWork(each);
        }
        //Now we run operations for each active holding
        //Map of all home fiefs so we prioritize their spawns
        let fiefMap = {}

        //Update kingdomStatus with holdings
        heap.kingdomStatus.totalHoldings = activeHoldings.length
        let spawnSkip = []
        for(const each of activeHoldings){
            if(Game.time % GLOBAL_SPAWN_INTERVAL != 0) break
            //If we're about to hit CPU limit, check bucket and abandon if needed
            if(Game.cpu.bucket < 7000){
                if(avCPU > Game.cpu.limit*0.95){
                    //console.log("Abandoning holdings due to CPU",Game.cpu.getUsed())
                    break;
                }
                //Stricter check if lower bucket
                else if(Game.cpu.bucket < 4000 && avCPU > Game.cpu.limit*0.8){
                    break;
                }
                
            }
            //Fief spawn utilization check in here somewhere
            let holding = Memory.kingdom.holdings[each]
            if(spawnSkip.includes(holding.homeFief))continue;
            //No home fief, move on
            if(!holding || !holding.homeFief) continue
            //Increment our home fief's spawning impact
            fiefMap[holding.homeFief] = (fiefMap[holding.homeFief] || 0) + 1;
            //console.log("FiefMap: ",holding.homeFief,fiefMap[holding.homeFief])
            //If combined spawn use (plus some pad for already run holdings) is too high then we skip (90 for now plus 5 per holding run)
            let skipCheck = 105-(fiefMap[holding.homeFief]*2);
            if(Memory.kingdom.fiefs[holding.homeFief].combinedSpawnUse > skipCheck){
                //console.log("Holding",each,"failed skipcheck.",Memory.kingdom.fiefs[holding.homeFief].combinedSpawnUse,"spawn use is more than",skipCheck)
                continue;
            }
            //If we have limited storage room, cut remotes
            let storeSpace = Game.rooms[holding.homeFief].storage && Game.rooms[holding.homeFief].storage.store.getFreeCapacity()
            let termSpace =  Game.rooms[holding.homeFief].terminal && Game.rooms[holding.homeFief].terminal.store.getFreeCapacity()
            let totalSpace = storeSpace+termSpace
            if(totalSpace < 100000) continue;
            kingdomCreeps[holding.homeFief] = kingdomCreeps[holding.homeFief] || []
            let fCreeps = kingdomCreeps[holding.homeFief];
            if(holding.homeFief && Game.rooms[holding.homeFief]){
                
                let needSpawns = this.runHolding(each,fCreeps,fiefMap[holding.homeFief]);
                heap.kingdomStatus.activeHoldings.push(each)
                //If one holding needs spawns, stop processing more
                if(needSpawns) spawnSkip.push(holding.homeFief)
            }
        }
    },
    baseWork: function(holdingName) {
        //console.log("RUNHOLD",holdingName)
        let remote = Game.rooms[holdingName]
        let holding = Memory.kingdom.holdings[holdingName];
        let fief = holding.homeFief;
        let data = getScoutData(holdingName)
        global.heap.fiefs[fief] = global.heap.fiefs[fief] || {};
        let fiefHeap = global.heap.fiefs[fief];

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
            //Fetch an existing costmatrix from heap or make a new one if needed
            let newCM = heap.matrixes[holdingName] ? heap.matrixes[holdingName] : new PathFinder.CostMatrix;
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
            heap.matrixes[holdingName] = newCM
            heap.matrixUpdate = true;
        }

        //Cost matrix is calculated after the fief gets its room plan, make sure it's there
        //Tick limit so we don't reoute a million of these at once
        let scoutCheck = !Object.values(heap && heap.scoutList || {}).length
        if(fief && !holding.remoteRoute && (!holding.remoteRouteFail || holding.remoteRouteFail < 3) && Memory.kingdom.fiefs[fief].costMatrix &&
        Game.cpu.tickLimit-Game.cpu.getUsed() > Game.cpu.tickLimit/2 && (scoutCheck || Game.map.findRoute(fief,holdingName).length == 1)){
            //Get storage position or pull from plan if not available
            let storePos = Game.rooms[fief].storage && Game.rooms[fief].storage.my ? Game.rooms[fief].storage.pos : new RoomPosition(Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].x,Memory.kingdom.fiefs[fief].roomPlan[4].storage[0].y,fief);       
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
                holding.distance = 0;
                for(let [id,route] of Object.entries(remoteRoute)){
                    holding.sources[id].path = route.filter(spt => ![0,49].includes(spt.x) && ![0,49].includes(spt.y));
                    totalRoute.push(...route)
                    holding.distance += route.length;
                }
                
            }
            else{
                holding.remoteRouteFail = (holding.remoteRouteFail || 0)+1
            }
            //Update holding CM
            //Keep track of other room CMs we're updating
            let thisCM = PathFinder.CostMatrix.deserialize(holding.costMatrix)
            let otherCM;
            let otherRoom;
            let otherRoomType;
            let fiefPlan;
            if(remoteRoute){
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
                            heap.matrixes[otherRoom] = otherCM
                            heap.matrixUpdate = true;
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
                            heap.matrixes[otherRoom] = otherCM
                            heap.matrixUpdate = true;
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
                heap.matrixes[holdingName] = thisCM
                heap.matrixUpdate = true;
                if(otherCM){
                    Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                    heap.matrixes[otherRoom] = otherCM
                    heap.matrixUpdate = true;
                }
            }

        }
        //Check for dropped resources and submit tasks as needed, only if not hostile
        if(remote && data.roomType != 'fief'){
            let reserveCheck = remote.controller && remote.controller.reservation && isMe(remote.controller.reservation.username)
            let resTime = reserveCheck ? remote.controller.reservation.ticksToEnd : false
            //Check for hostiles
            let hostiles = remote.find(FIND_HOSTILE_STRUCTURES).filter(struct => struct.structureType == STRUCTURE_INVADER_CORE)
            if(hostiles.length && Game.rooms[holding.homeFief].controller.level > 2){
                let hasMission = false;
                if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                    for(let mission of global.heap.missionMap[holdingName]){
                        if(mission.type == 'destroyCore') hasMission = true;
                        break;
                    }
                }
                if(!hasMission){
                    chronicle.log(`Invader core detected in holding ${holdingName}.`,'holdingManager',3)
                    marshal.destroyCore(holdingName,hostiles[0].id,resTime);
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
                if(source.can && (!Game.getObjectById(source.can) || Game.getObjectById(source.can).structureType != STRUCTURE_CONTAINER) ) delete source.can
                if(source.can && Game.getObjectById(source.can) && Game.getObjectById(source.can).store.getUsedCapacity() > 100) cans.push(source.can)
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
        let needSpawns = false
        let remote = Game.rooms[holdingName]
        let holding = Memory.kingdom.holdings[holdingName];
        
        let fief = holding.homeFief;
        let data = getScoutData(holdingName)
        global.heap.fiefs[fief] = global.heap.fiefs[fief] || {};
        let fiefHeap = global.heap.fiefs[fief];
        let hasController = remote && remote.controller
        let isReserved = remote && remote.controller && remote.controller.reservation && isMe(remote.controller.reservation.username) || false;
        let enemyReserve = remote && remote.controller && remote.controller.reservation && !isMe(remote.controller.reservation.username) || false;
        //If no data, why are we here
        if(!data)return;
        //If owned by an enemy, no actions until we're strong enough to claim
        if(data.ownerType && data.ownerType == 'enemy' && Game.rooms[fief].energyCapacityAvailable < 650){
            //console.log(holdingName,'ENEMY OWNER');
            return needSpawns;
        }
        if(!holding.remoteRoute) return;
        //Keep track of how many holdings we're actively processing
        fiefHeap.holdingDist = (fiefHeap.holdingDist || 0) + (holding.distance || 0)
        //console.log("MAINHOLD",holdingName)
        //console.log("SPAWNPAD",spawnPad)
        //Spawn Time
        if(Game.time % GLOBAL_SPAWN_INTERVAL == 0){
            if(!enemyReserve && !global.heap.alarms[holdingName]){
                //-- Harvester --
                //Check each source for open space and harvester need
                //console.log("RUNNING HOLDING SPAWN")
                let targetSources = Object.keys(holding.sources).reduce((obj,key) =>{
                    obj[key] = {harvs:0,power:0,ttlFlag:false};
                    return obj;
                },{});
                if(!fiefCreeps.miner) fiefCreeps.miner = [];
                let fiefMiners = fiefCreeps.miner.filter(creep => creep.memory.holding == holdingName && (creep.spawning ||creep.ticksToLive > ((creep.body.length * CREEP_SPAWN_TIME) + (holding.sources[creep.memory.target].path || []).length)+50 ))
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

                    if((source.openSpots.length <= targetSources[sourceID].harvs || targetSources[sourceID].power >= (isReserved ? SOURCE_ENERGY_CAPACITY : hasController ? SOURCE_ENERGY_NEUTRAL_CAPACITY: SOURCE_ENERGY_KEEPER_CAPACITY)/ENERGY_REGEN_TIME)) return;
                    let sev = 30
                    //console.log("Adding remote harv to spawnQueue")
                    registry.requestCreep({sev:sev-spawnPad,memory:{role:'miner',fief:fief,target:sourceID,holding:holdingName,status:'spawning',preflight:false}})
                    needSpawns = true;
                });
            }
            

            //If we have the energy capacity in our home fief and we need a reservation, ask for a claim creep if needed
            //We want vision for this
            if(remote){

                let hostiles = remote.find(FIND_HOSTILE_CREEPS).filter(crp => (helper.isSoldier(crp) || crp.getActiveBodyparts(CLAIM) > 0) && !isFriend(crp))
                if(hostiles.length && !global.heap.alarms[holdingName] && (!heap.wardens || !heap.wardens[fief])){
                    setAlarm({roomName:holdingName,alarmType:hostiles[0].owner.username == 'Invader' ? 'invader' : 'creep',hostiles:hostiles,origin:'holdingManager'})
                    let hasMission = false;
                    if(global.heap.missionMap && global.heap.missionMap[holdingName]){
                        for(let mission of global.heap.missionMap[holdingName]){
                            if(mission.type == 'defend') hasMission = true;
                            break;
                        }
                    }
                    if(!hasMission && Game.rooms[holding.homeFief].controller.level > 2){
                        marshal.defend(holdingName);
                    }
                }else{
                    if(!hostiles.length){
                        if(heap.alarms[holdingName]){
                            delete heap.alarms[holdingName];
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
                        //Periodic check to make sure there's no lingering missions
                        if(Game.time % (GLOBAL_SPAWN_INTERVAL*100) == 0){
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
                }
                //Get controller spots if we don't
                if(remote.controller && !holding.controllerSpots) holding.controllerSpots = helper.getOpenSpots(remote.controller.pos).length

                let reserverPower = 0;
                let claimers = 0;
                let tickend = false;
                if(fiefCreeps.claimer){
                    for(creep of fiefCreeps.claimer){
                        if(creep.memory.holding == holdingName && creep.memory.job == 'reserver' && (creep.spawning || creep.ticksToLive > (holding.distance/Object.keys(holding.sources).length))){
                            claimers ++;
                            reserverPower+= creep.getActiveBodyparts(CLAIM);
                        }
                    }
                }
                
                if(remote.controller && reserverPower < 2 && Game.rooms[fief].energyCapacityAvailable >= 650){
                    //let spots = helper.getOpenSpots(remote.controller.pos,true);
                    //See if we have a mission already
                   // console.log("Reserver checks")
                   // console.log(`For remote: ${remote.name}. Reserver set:${reserverSet},fiefCreep role:${fiefCreeps.claimer},isReserved:${isReserved},spots:${spots}`)
                   if(hasController && (!(isReserved) || remote.controller.reservation.ticksToEnd <= CONTROLLER_RESERVE_MAX*0.8) && claimers < holding.controllerSpots){
                        registry.requestCreep({sev:30.1-spawnPad,memory:{role:'claimer',job:'reserver',fief:fief,target:{x:remote.controller.pos.x,y:remote.controller.pos.y,id:remote.controller.id},holding:holdingName,status:'spawning',preflight:false}})
                        needSpawns = true;
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

                //Every ~900 ticks check for roads that need repaired
                if(Game.time % GLOBAL_SPAWN_INTERVAL*300 == 0){
                    let roadRep = false;
                    roadLoop:
                    for(let source of Object.values(holding.sources)){
                        if(!source.path){
                            console.log("No path to source!",holdingName,source.id)
                        }
                        for(let spot of source.path){
                            let road = remote.lookForAt(LOOK_STRUCTURES,spot.x,spot.y).filter(str=>str.structureType == STRUCTURE_ROAD && str.hits < str.hitsMax * 0.7)[0]
                            if(road){
                                roadRep = true;
                                break roadLoop;
                            }
                        }
                    }
                    Memory.kingdom.holdings[holdingName].roadRep = roadRep;
                    if(roadRep) Memory.kingdom.fiefs[holding.homeFief].repRequest = true;
                }
                
            }
            
        }

        //With Vision
        if(remote){//Game.rooms[fief].storage && Game.rooms[fief].storage.my && Game.rooms[fief].storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000
            let timeCheck = Game.rooms[holding.homeFief].controller.level >=5 ? 200 : 30
            //Only build over swamps til RCL5 to speed up room development
            let swampsOnly = Game.rooms[holding.homeFief].controller.level <4;
            //If we're RCL4 or less and this is a later remote, we need much more frequent construction checks 
            if(Game.rooms[holding.homeFief].controller.level <=4 && heap.sortedHoldings && heap.sortedHoldings.indexOf(holdingName) > 1) timeCheck = 1;
            if(Game.time % (GLOBAL_SPAWN_INTERVAL*timeCheck) == 0 && Game.rooms[holding.homeFief].controller.level >=3 && Object.keys(Game.constructionSites).length < 40){
                //console.log("Construction check in ",holdingName)
                //Set remote build based on whether we have active sites
                //This section was previously inside if(spawnPad == 1){} and I don't know why. If this breaks things and we come back to revert, comment why
                if(remote.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType == STRUCTURE_ROAD).length){
                    Memory.kingdom.fiefs[fief].remoteBuild = holdingName;
                }
                else if(Memory.kingdom.fiefs[fief].remoteBuild == holdingName){
                    Memory.kingdom.fiefs[fief].remoteBuild = false;
                }
                //console.log("REMOTEBUILD",Memory.kingdom.fiefs[fief].remoteBuild)
                //If no active sites, check if any are needed and build if so
                if(!Memory.kingdom.fiefs[fief].remoteBuild || (Memory.kingdom.fiefs[fief].remoteBuild == holdingName && remote.find(FIND_MY_CONSTRUCTION_SITES).filter(site => site.structureType == STRUCTURE_ROAD).length < 20)){
                    let buildCount = 0;
                    for(let source of Object.values(holding.sources)){
                        for(let spot of source.path.filter(spt => ![0,49,source.x].includes(spt.x) && ![0,49,source.y].includes(spt.y))){
                            let terrain = new Room.Terrain(spot.roomName)
                            if(Game.rooms[spot.roomName]){
                                let spotCheck = Game.rooms[spot.roomName].lookForAt(LOOK_STRUCTURES,spot.x,spot.y).filter(spt => spt.structureType == STRUCTURE_ROAD);
                                if(!spotCheck.length){
                                    if(swampsOnly && terrain.get(spot.x,spot.y) != TERRAIN_MASK_SWAMP)continue;
                                    Game.rooms[spot.roomName].createConstructionSite(spot.x,spot.y,STRUCTURE_ROAD);
                                    buildCount++;
                                }
                                if(buildCount >= 20) break;
                            }

                        }
                        if(buildCount >= 20) break;
                    }
                    if(buildCount > 0) Memory.kingdom.fiefs[fief].remoteBuild = holdingName;
                    else{
                        //Roads done marker for haulers later on
                        if(!swampsOnly){
                            Memory.kingdom.fiefs[fief].roadsDone = Memory.kingdom.fiefs[fief].roadsDone || {};
                            if(!Memory.kingdom.fiefs[fief].roadsDone[holdingName])Memory.kingdom.fiefs[fief].roadsDone[holdingName] = 1;
                        }
                    }
                }
            }
        }        
        

        return needSpawns;
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
        



        //console.log("Orbit key sites:\n",JSON.stringify(keySites))
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
                        //console.log('Error',e)
                        //console.log(midPoints)
                        //console.log(spot1)
                        //console.log(spot2)
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
                      costs.set(struct.pos.x, struct.pos.y, 1);
                    }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_RAMPART ||
                         !struct.my)) {
                    // Can't walk through non-walkable buildings
                    costs.set(struct.pos.x, struct.pos.y, 255);
                    }
                  });
              };
              if(describeRoom(roomName) == ROOM_SOURCE_KEEPER){
                let roomData = getScoutData(roomName);
                if(!roomData) return false;
                let checks = roomData.sources;
                checks.push(roomData.mineral)
                let skTerrain = new Room.Terrain(roomName);
                for(let each of checks){
                    for(x=-4;x<=4;x++){
                        for(y=-4;y<=4;y++){
                            //If on the check, continue
                            if(x==0&&y==0)continue;
                            let newX = each.x+x;
                            let newY = each.y+y;
                            //If we're out of bounds, continue
                            if(newX>49||newY>49)continue;
                            if(newX<0||newY<0)continue;
                            //If not a wall, block off for roads
                            if(skTerrain.get(newX,newY) != TERRAIN_MASK_WALL){
                                costs.set(newX,newY,255)
                            }
                        }
                    }
                }
              }
              for(let spot of thisRoute){
                if(spot.roomName == roomName) costs.set(spot.x,spot.y,1)
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
       //console.log("PATHS")
       //console.log(JSON.stringify(paths))
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
        //console.log("SHRT ROUTE")
        //console.log(JSON.stringify(shortestRoute))
        chronicle.log(`Remote road route calculated for ${roomName}. Length: ${shortestLen}.`,'holdingManager',3)
        return shortestRoute;

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