//const roomPlanner = require('roomPlanner');
const helper = require('functions.helper');
const fiefPlanner = require('fiefPlanner');
require('roomVisual');
const profiler = require('screeps-profiler');
const supplyDemand = require('supplyDemand');
const granary = require('granary');
const registry = require('registry');
const buildRole = require('role.builder');
const Warden = require('Warden');
const fiefManager = {
    run:function(room,fiefCreeps){
        const getStoredResources = (resourceType) => {
            return (room.storage ? room.storage.store[resourceType] || 0 : 0) + 
                   (room.terminal ? room.terminal.store[resourceType] || 0 : 0);
        };

        heap.fiefs[room.name].buildQueue = heap.fiefs[room.name].buildQueue || {}
        let buildQueue = heap.fiefs[room.name].buildQueue
        let warden;
        //Set Reference
        let fief = Memory.kingdom.fiefs[room.name];
        let factory = room.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_FACTORY}})[0];
        if(!fief.rclTimes){
            fief.rclTimes = {tick:Game.time};
        }
        //Check if mineral data set up at all. If not, create and assign mineral
        if(!fief.mineral) fief.mineral = {id:room.find(FIND_MINERALS)[0].id}
        if(!fief.refills){
        }
        // - Assignments -
        let roomBaddies = room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp));
        let roomLevel = room.controller.level;
        if(!fief.rclTimes[roomLevel]){
            fief.rclTimes[roomLevel] = Game.time - fief.rclTimes.tick;
            //If we were the funnel target and we leveled up, reset it
            if(roomLevel == 7 && room.name == heap.funnelTarget) heap.funnelTarget = null;
        }
        if(!fief.rclTimes['storage'] && room.storage) fief.rclTimes['storage'] = Game.time - fief.rclTimes.tick
        if(!fief.rampTarget) fief.rampTarget = 15000;
        
        let cSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        let mySpawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.id);
        let storagePos = fief.roomPlan ? new RoomPosition(fief.roomPlan[4].storage[0].x,fief.roomPlan[4].storage[0].y,room.name) : null;
        let rampartMinimums = {
            4:10000,
            5:50000,
            6:200000,
            7:400000,
            8:800000
        }
        let extractor = room.find(FIND_MY_STRUCTURES).filter(str => str.structureType == STRUCTURE_EXTRACTOR).length;
        //Hardcoded nobuild array, plus pull from fief
        const noBuild = [STRUCTURE_NUKER].concat(
            fief.noBuild ? (Array.isArray(fief.noBuild) ? fief.noBuild : [fief.noBuild]) : []
        );

        fief.spawns = mySpawns;
        let spawns = fief.spawns;
        let [plannedNet,averageNet] = granary.getIncome(room.name);
        //Create harvest spot if none exists
        //console.log(room.name,"income",plannedNet,averageNet)

        if(!fief.roomPlan || fief.roomPlan == 'null'){
            let roomPlans = JSON.parse(RawMemory.segments[SEGMENT_ROOM_PLANS] ? RawMemory.segments[SEGMENT_ROOM_PLANS] : '{}'); //Fix this at some point to make sure it exists on tick 1
            if(roomPlans[room.name]){
                [fief.roomPlan, fief.rampartPlan] = roomPlans[room.name]
            }
            else if(global && heap && (!heap.fiefPlanner || !heap.fiefPlanner.stage ||heap.fiefPlanner.stage == 0)){
                fiefPlanner.getFiefPlan(room.name);
                //console.log("Getting plan for room")
            }
            //If no spawn, kick us out til the plan is done
            if((!spawns ||!spawns.length)) return;

            //fief.roomPlanLevel = room.controller.level;
            //console.log(`${room.name} has no room plan!`)
        }
        

        if(!fief.sources || !Object.keys(fief.sources).length){
            //console.log("NO SOURCES")
            fief.sources = {};
            let sources = room.find(FIND_SOURCES);
            sources.forEach(source => {
                let area = source.room.lookForAtArea(LOOK_TERRAIN,
                    source.pos.y - 1, source.pos.x - 1,
                    source.pos.y + 1, source.pos.x + 1,
                    true);
                let openSpots = area.filter(spot => spot.terrain !== 'wall');
                if(openSpots.length > 0){
                    //If we don't have a spawn and we have a plan, assign the first in the room plan
                    if((!spawns ||!spawns.length) && fief.roomPlan){
                        let openPositions = [];
                        openSpots.forEach(every =>{
                            openPositions.push(new RoomPosition(every.x,every.y,room.name));
                        });
                        let spawnPos = new RoomPosition(fief.roomPlan[1].spawn[0].x,fief.roomPlan[1].spawn[0].y,room.name);
                        let harvestSpot = spawnPos.findClosestByPath(openPositions);
                        fief.sources[source.id] = {spotx:harvestSpot.x,spoty:harvestSpot.y,can:''};
                    }
                    //Else get the closest to spawn
                    else if(spawns && spawns.length){
                        //Convert spots to room positions
                        let openPositions = [];
                        openSpots.forEach(every =>{
                            openPositions.push(new RoomPosition(every.x,every.y,room.name));
                        });
                        let mySpawn = Game.getObjectById(spawns[0]);
                        let harvestSpot = mySpawn.pos.findClosestByPath(openPositions) || mySpawn.pos.findClosestByRange(openPositions);
                        console.log(room.name,"SPOT",harvestSpot,"OPEN",openSpots,"POSITIONS",openPositions)
                        if(harvestSpot) fief.sources[source.id] = {spotx:harvestSpot.x,spoty:harvestSpot.y,can:''};
                        else{
                            chronicle.log(`${room.name} - harvestSpot error - ${harvestSpot}}.`,'fiefManager',1);
                        }
                        
                    }
                    //Record total open spots for baby harvs
                    fief.sources[source.id].openSpots = openSpots.length;
                }
            });
            //Set closest source
            let sourceIDs = Object.keys(fief.sources);
            if(sourceIDs.length == 1) fief.sources[sourceIDs[0]].closest = true;
            else{
                let rangeStart;
                if((!spawns || !spawns.length) && fief.roomPlan){
                    rangeStart = new RoomPosition(fief.roomPlan[1].spawn[0].x,fief.roomPlan[1].spawn[0].y,room.name)
                }
                else{
                    rangeStart = Game.getObjectById(spawns[0]).pos;
                }
                if(rangeStart.getRangeTo(Game.getObjectById(sourceIDs[0])) > rangeStart.getRangeTo(Game.getObjectById(sourceIDs[1]))){
                    fief.sources[sourceIDs[1]].closest = true;
                }
                else{
                    fief.sources[sourceIDs[0]].closest = true;
                }
            }
        }

        //If no spawns in the room, check for settlers and request from our support room if needed
        if(!spawns || !spawns.length){
            //console.log("NO SPAWNS")
            let spawnSite = fief.roomPlan[1][STRUCTURE_SPAWN][0]
            let spotInfo = room.lookAt(spawnSite.x,spawnSite.y);
            let hasSpawn = spotInfo.find(s => s.structure && s.structure.structureType === STRUCTURE_SPAWN);
            let hasConstructionSite = spotInfo.some(s => s.constructionSite);
            if(!hasSpawn && !hasConstructionSite){
                //console.log("SPAWNSITE",JSON.stringify(spawnSite))
                let spawnName = helper.getName({isSpawn:true})+' Keep';
                //console.log("Spawnname",spawnName)
                //console.log("X",spawnSite.x)
                //console.log("Y",spawnSite.y)
                let y = room.createConstructionSite(spawnSite.x,spawnSite.y,STRUCTURE_SPAWN,spawnName);
                //console.log(y)
                return;
            }


        }

        if(!fief.controllerSpots || !fief.controllerSpots.base || (fief.controllerSpots && fief.controllerSpots.rcl < room.controller.level && ((roomLevel == 6 && room.terminal) || (roomLevel == 4 && room.storage) || ![4,6].includes(roomLevel)))){
            if(fief.roomPlan){
                let results = getControllerSpots(room,fief);
                fief.controllerSpots = results
                fief.controllerSpots.rcl = room.controller.level
            }

        }

        if(room.controller.level < 8 && (!heap.travelMatrixes[room.name] || heap.matrixUpdate) && fief.roomPlan){
            getTravelMatrix(room)
        }

        //if(!fief.chainSpots && room.storage && room.storage.pos.getRangeTo(room.controller) <4){
            //fief.chainSpots = getChainSpots(room);
        //}
        //If we have some controller progress for a buffer, check if we need to build the next site
        if(Object.keys(buildQueue).length && !cSites.length){
            let toBuild;
            //Spawns > Storage > Towers > Extensions > Roads > Labs
            let structOrder = [STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_STORAGE,STRUCTURE_TOWER,STRUCTURE_ROAD,STRUCTURE_LAB,STRUCTURE_CONTAINER,STRUCTURE_LINK,STRUCTURE_EXTRACTOR,STRUCTURE_OBSERVER,STRUCTURE_TERMINAL,STRUCTURE_FACTORY,STRUCTURE_POWER_SPAWN,STRUCTURE_NUKER]
            for(let each of structOrder){
                //console.log("Checking to build:",each)
                if(buildQueue[each]){
                    //console.log(each,'found!')
                    //Safety check to make sure it's not empty
                    if(!buildQueue[each].length){
                        delete buildQueue[each];
                        continue;
                    }
                    //Specific check for origin spawn
                    let firstSpawn = room.find(FIND_MY_SPAWNS)[0];
                    if(each == STRUCTURE_SPAWN && mySpawns.length == 1 && firstSpawn && !firstSpawn.pos.isEqualTo(fief.roomPlan[1].spawn[0].x,fief.roomPlan[1].spawn[0].y)){
                        //console.log("Origin spawn detected")
                        //If we're replacing the origin spawn but aren't ready with energy, skip it
                        if(room.controller.level <= 3 || !room.storage || !room.storage.my || room.storage.store[RESOURCE_ENERGY] < 20000){
                            
                            continue;
                        }
                        console.log("Storage pass")
                        //If we're ready with energy but no builder, get the builder, otherwise we're good
                        if(fiefCreeps.builder && fiefCreeps.builder.some(crp => crp.ticksToLive > 1200 && !['remoteBuilder','fortifier'].includes(crp.memory.job))){
                            //Blow it up
                            firstSpawn.destroy();
                        }
                        else{
                            console.log("Need builder")
                            if(!Memory.hardSpawns) Memory.hardSpawns = {};
                            if(!Memory.hardSpawns[room.name]) Memory.hardSpawns[room.name] = [];
                            //If there isn't a builder already requested, get one.
                            if(!Memory.hardSpawns[room.name].some(req => req.memory && req.memory.originMove !== undefined)){
                                Memory.hardSpawns[room.name].push({sev:45,hardSpawn:true,memory:{role:'builder',fief:room.name,status:'spawning',preflight:false,originMove:true}});
                            }
                            continue;
                            
                        }
                    }
                    toBuild = [each,buildQueue[each].pop()]
                    break;
                }
            }
            //console.log("toBuild",toBuild)
            if(toBuild){
                //console.log("Building valid!")
                //Check if whatever we're building was the last. If so, remove the key
                if(!buildQueue[toBuild[0]].length){
                    delete buildQueue[toBuild[0]];
                }
                //Build
                let [building,coordinate] = toBuild;
                //If it isn't a spawn, just build it.
                //console.log("Attempting to place",building,"at",coordinate.x,coordinate.y)
                if(building != STRUCTURE_SPAWN){
                    let g = room.createConstructionSite(coordinate.x,coordinate.y,building)
                    //console.log("Result:",g)
                }
                //If a spawn, get name and check for moving
                else{
                    let keepSpawn;
                    let manorSpawn;
                    let hallSpawn;
                    let roomSpawns = room.find(FIND_MY_SPAWNS);
                    if(roomSpawns.length > 0){
                        for(let spawn of roomSpawns){
                            let spawnType = spawn.name.split(" ")[1];
                            switch(spawnType){
                                case 'Keep':
                                    keepSpawn = true;
                                    break;
                                case 'Manor':
                                    manorSpawn = true;
                                    break;
                                case 'Hall':
                                    hallSpawn = true;
                                    break;
                            }
                            
                        }
                    };
                    let name = ''
                    if(!keepSpawn){
                        name = helper.getName({isSpawn:true})+' Keep';
                    }
                    else if(!manorSpawn){
                        name = helper.getName({isSpawn:true})+' Manor';
                    }else if(!hallSpawn){
                        name = helper.getName({isSpawn:true})+' Hall';
                    }else{
                        //console.log(room.name,"unable to name spawn, all types found")
                    }

                    let l = room.createConstructionSite(coordinate.x,coordinate.y,building,name)
                    //console.log("SITE1")
                    Memory.spawnBuild = l
                }
            }
            
        }

        //Every 100 ticks, check to see if we need to fill the build queue
        if(Game.time % 100 == 0 && fief.roomPlan && !fief.standby){
            buildQueue = {}
            //console.log("Checking for new constructions.")
            let cCount = 0;
            let plan = fief.roomPlan
            let roadsDone = Object.values(Memory.kingdom.fiefs[room.name].roadsDone||{}).reduce((sum,each)=>sum+each,0) >= Math.min(Object.values(Memory.kingdom.fiefs[room.name].roadsDone||{}).length,3);
            for(let rcl = 1;rcl <= roomLevel;rcl++){
                for(let building in plan[rcl]){
                    if(noBuild.includes(building)) continue;
                    for(coordinate of plan[rcl][building]){
                        let spot = room.lookForAt(LOOK_STRUCTURES,coordinate.x,coordinate.y);
                        let spotSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,coordinate.x,coordinate.y);
                        let floor = room.lookForAt(LOOK_TERRAIN,coordinate.x,coordinate.y);
                        if((!spot.length || !spot.some(element => element.structureType == building)) && (floor != 'wall' || building == STRUCTURE_EXTRACTOR) && !spotSite.length){
                            //Towers don't need to go up if we're in safeMode
                            if(building == STRUCTURE_TOWER && room.controller.level <=4 && room.controller.safeMode && room.controller.safeMode > 2000){
                                continue;
                            }
                            //If it's a road we don't build until room level 3, then only on swamps til remote roads are done or RCL5.
                            if(building == STRUCTURE_ROAD){
                                if(roomLevel < 3)continue;
                                if(!roadsDone && floor != TERRAIN_MASK_SWAMP && room.controller.level <4)continue;
                            }
                            
                            if(buildQueue[building]){
                                buildQueue[building].push({x:coordinate.x,y:coordinate.y});
                            }
                            else{
                                buildQueue[building] = [{x:coordinate.x,y:coordinate.y}]
                            }
                            cCount++;
                            
                            
                            
                            //console.log("SITE2",building,room.name,':',coordinate.x,coordinate.y)
                            
                        }
                    };
                }
            }
            //If no new sites, do further checks
            if(cCount == 0){
                //If no source containers and no construction sites, make containers
                for(let source of Object.values(fief.sources)){
                    //console.log(JSON.stringify(source))
                    if(!source.can && room.storage && room.storage.my){
                        //console.log("Nocan")
                        let spotInfo = room.lookAt(source.spotx,source.spoty);
                        let hasCan = spotInfo.find(s => s.structure && s.structure.structureType === STRUCTURE_CONTAINER);
                        let hasConstructionSite = spotInfo.some(s => s.constructionSite);
                        if (!hasCan && !hasConstructionSite){
                            //room.createConstructionSite(source.spotx,source.spoty,STRUCTURE_CONTAINER);
                            if(buildQueue[STRUCTURE_CONTAINER]){
                                buildQueue[STRUCTURE_CONTAINER].push({x:source.spotx,y:source.spoty});
                            }
                            else{
                                buildQueue[STRUCTURE_CONTAINER] = [{x:source.spotx,y:source.spoty}]
                            }
                        }
                        else if(hasCan){
                            source.can = hasCan.structure.id;
                        }
                    }
                }
            }
            heap.fiefs[room.name].buildQueue = buildQueue;
        }
        
        //Create room plan, spawns, and spawn queue if none exists, then return
        //
        
        if(!fief.costMatrix && fief.roomPlan){
            //Get new cost matrix
            let thisCM = new PathFinder.CostMatrix;
            let sources = room.find(FIND_SOURCES);

            for(let rcl in fief.roomPlan){
                for(let building in fief.roomPlan[rcl]){
                    fief.roomPlan[rcl][building].forEach(coordinate => {
                        if(building == STRUCTURE_ROAD){
                            //Make roads walkable
                            thisCM.set(coordinate.x,coordinate.y,1);
                        }else if(building != STRUCTURE_CONTAINER && building != STRUCTURE_RAMPART){
                            //Make planned buildings unwalkabe
                            thisCM.set(coordinate.x,coordinate.y,255)
                        }
                    });
                }
            }

            //Set higher cost 3 tile border around the controller to try and avoid pathing next to it and the can
            //Only if not already set
            for(let x = -3; x <= 3; x++) {
                for(let y = -3; y <= 3; y++) {
                    // Skip the source tile itself
                    if(x === 0 && y === 0) continue;
            
                    const tileX = room.controller.pos.x + x;
                    const tileY = room.controller.pos.y + y;
            
                    // Make sure we don't go out of bounds (0-49 for both x and y)
                    if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                        //Make sure it isn't a wall and it isn't already set as a building
                        if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && thisCM.get(tileX,tileY) != 255){
                            thisCM.set(tileX, tileY, 25);
                        }
                    }
                }
            }
            Object.keys(fief.sources).forEach(x=>{
                //console.log("Before source! isFinite",JSON.stringify(fief.sources[x]))
            })
            //Set 1 tile higher cost border around sources
            sources.forEach(source =>{
                let pos = source.pos
                for(let x = -1; x <= 1; x++) {
                    for(let y = -1; y <= 1; y++) {
                        // Skip the source tile itself
                        if(x === 0 && y === 0) continue;
                
                        const tileX = pos.x + x;
                        const tileY = pos.y + y;
                
                        // Make sure we don't go out of bounds (0-49 for both x and y)
                        if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                            //Make sure it isn't a wall
                            if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && thisCM.get(tileX,tileY) != 255){
                                thisCM.set(tileX, tileY, 25);
                            }
                        }
                    }
                }
            })
            

            //Save cost matrix
            fief.costMatrix = thisCM.serialize();
        }
        let fiefSources = Object.keys(fief.sources);

        if(!fief.links){
            fief.links = {};
        }

        if(!fief.spawnUptime){
            //console.log("Makin it fresh")
            fief.spawnUptime = {};
        }
        let spawnUse = {};
        let combinedSpawnUse = 0;
        spawns.forEach(spawn => {
            //console.log(spawn)
            if(!fief.spawnUptime[spawn]){
                fief.spawnUptime[spawn] = [];
            }
            //Calculate spawn uptime over past 3000 ticks
            let totalSpawn = 0;
            //Filter out anything older than 3000 ticks
            fief.spawnUptime[spawn] = fief.spawnUptime[spawn].filter(item => {
                return Game.time - item.gameTime <= 3000;
            });
            //Now calculate
            fief.spawnUptime[spawn].forEach(item => {
                //Increment 3 ticks per body part spawned.
                totalSpawn += 3*item.bodySize
            });
            //Record spawn utilization
            let ute = ((totalSpawn / 3000) * 100);
            spawnUse[spawn] = ute;
            combinedSpawnUse += ute;
            //console.log("Spawn Utilization for",Game.getObjectById(spawn).name+':\n',((totalSpawn / 3000) * 100).toFixed(2)+'%'+'---'+combinedSpawnUse +'---'+);
        });
        if(spawns.length)fief.combinedSpawnUse = Math.round(combinedSpawnUse/spawns.length);
        //console.log("SPUSE",fief.combinedSpawnUse)
        //#region Room Operation
        //#endregion
        //console.log("Spawn use:",combinedSpawnUse)

        //Check every tick to see if we need to process extensions for refilling
        if(room.energyAvailable < room.energyCapacityAvailable && fief.roomPlan) getRefillMaps(room,fief);
        //else if(heap.fiefs[room.name].refillers) delete heap.fiefs[room.name].refillers;


        //Add any scouted domain rooms to holdings, longer standing fiefs have a longer wait. If we're on our spawn-in room startup, it's every tick
        if((Game.time - Memory.spawnTick) < 5000 || !fief.domain || Game.time % (150*room.controller.level) == 0){
            //Get scouted domain rooms, exclude SK for now
            let domainRooms = getDomainRooms(room.name)
            //No SK rooms for remotes. Only check unscouted rooms except for extremely periodic checks
            let fDomain = domainRooms.filter(dRoom => !Memory.kingdom.holdings[dRoom] && (!dRoom.scouted || Game.time % (1000*Object.keys(Memory.kingdom.fiefs).length) == 0));
            //console.log("D",domainRooms)
            //console.log("F",fDomain)
            for(let dRoom of fDomain){
                
                let dData = getScoutData(dRoom.roomName);
                if(!dData){
                    heap.scoutList[dRoom.roomName] = room.name;
                    continue;
                }
                //If scouted, add to holdings and mark scouted in the domain
                dRoom.scouted = true;
                if(!Memory.kingdom.holdings[dRoom.roomName] && dData.roomType != 'fief'){
                    Memory.kingdom.holdings[dRoom.roomName] = {standby:false,homeFief:room.name};
                }
            }
        }
        let ramps = room.find(FIND_MY_STRUCTURES).filter(str => str.structureType == STRUCTURE_RAMPART);
        //Check for hostiles to activate warden, only once we're RCL4
        if(room.controller.level >= 4){
            
            //console.log("WARDEN CHECK",room.name,heap.wardens ? Object.keys(heap.wardens) : [])
            let hostiles = room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp) && !helper.isScout(crp));
            warden = heap.wardens && heap.wardens[room.name];
            if(hostiles.length && (!room.controller.safeMode || room.controller.safeMode < 300)){
                
                //console.log("Hostiles")
                //Run our warden if it already exists, else create one
                if(warden){
                    warden.run(hostiles,fiefCreeps);
                }
                else{
                    //let ramps = room.find(FIND_MY_STRUCTURES).filter(str => str.structureType == STRUCTURE_RAMPART);
                    if(fief.rampsOpen){
                        for(let ramp of ramps){
                            ramp.setPublic(false)
                        }
                        fief.rampsOpen = false;
                    }
                    warden = new Warden(room);
                    if(!heap.wardens) heap.wardens = {};
                    heap.wardens[room.name] = warden;
                    warden.run(hostiles,fiefCreeps);
                }
            }
            else if(warden && warden.lastActive){

                if(!fief.rampsOpen){
                    for(let ramp of ramps){
                        ramp.setPublic(true)
                    }
                    fief.rampsOpen = true;
                }
                if(Game.time-warden.lastActive > 10){
                    chronicle.log(`${room.name} - Warden watch period expired. Room control returned.`,'fiefManager',3);
                    delete heap.wardens[room.name]
                }
                
            }
            else{
                if(!fief.rampsOpen){
                    for(let ramp of ramps){
                        ramp.setPublic(true)
                    }
                    fief.rampsOpen = true;
                }

            }
        }
        
        
        //Check if we have enough harvesters by gathering total harvest strength from live creeps
        //let harvStrength = fiefCreeps['harvester'] && fiefCreeps['harvester'].reduce((sum,item) => sum+((item.body.getActiveBodyparts(WORK) * HARVEST_POWER)));

        //Add requests for dropped resources
        if(!roomBaddies.length)manageResourceCollection(room)

        //Set repair request if needed
        let damagedStructures = room.find(FIND_STRUCTURES).filter(str=>(str.structureType == STRUCTURE_CONTAINER && str.hits < str.hitsMax * 0.7) || (str.structureType == STRUCTURE_ROAD && str.hits < str.hitsMax * 0.8) || (![STRUCTURE_CONTAINER,STRUCTURE_ROAD,STRUCTURE_WALL,STRUCTURE_RAMPART].includes(str.structureType) && str.hits < str.hitsMax));
        //No pavers til 4
        if(room.controller.level >= 4 && damagedStructures.length && !fief.repRequest){
            fief.repRequest = true;
            //console.log(JSON.stringify(damagedStructures))
            chronicle.log(`${room.name} -  Repair requested for ${damagedStructures.length} structures.`,'fiefManager',3);
        }

        //Spawn queue check every 3 ticks
        if(Game.time % GLOBAL_SPAWN_INTERVAL == 0){
            //Support rooms
            if(fief.support){
                //console.log("SUPPORTING!",fief.support)
                let settlement = Game.rooms[fief.support];
                if(settlement){
                    //If the room has a spawn, we cut our support
                    if(settlement.find(FIND_MY_SPAWNS).length){
                        delete fief.support;
                    }
                    else{
                        let settlers = fiefCreeps.settler ? fiefCreeps.settler.filter(crp => crp.memory.targetRoom == fief.support && (crp.ticksToLive > 400 || crp.spawning)) : [];
                        //console.log("SETTLERS!",settlers,settlers.length)
                        //console.log("SETTLERS",settlers.length, "S1",Object.keys(Memory.kingdom.fiefs[fief.support].sources).length * 2,"S2",settlement.find(FIND_SOURCES).length * 2,"S3",settlers.length < (Memory.kingdom.fiefs[fief.support].sources ? Memory.kingdom.fiefs[fief.support].sources.length * 2 : settlement.find(FIND_SOURCES).length * 2))
                        if(settlers.length < (Memory.kingdom.fiefs[fief.support].sources ? Object.keys(Memory.kingdom.fiefs[fief.support].sources).length * 2 : settlement.find(FIND_SOURCES).length * 2)){
                            let opts = {sev:settlers.length < 1 ? 38 : 28.5,memory:{role:'settler',fief:room.name,targetRoom:fief.support,preflight:false}}
                            registry.requestCreep(opts);
                            //console.log("REQUESTING")
                        }
                    }
                }

            }
            //-- Harvester --
            //Check each source for open space and harvester need
            let noHarvs = false;
            let creepSource;
            let targetSources = Object.keys(fief.sources).reduce((obj,key) =>{
                obj[key] = {harvs:0,power:0,ttlFlag:false};
                return obj;
            },{});
            if(fiefCreeps.harvester){
                fiefCreeps.harvester.forEach(creep =>{
                    if(creep.memory.job == 'mineralHarvester' || creep.memory.job == 'remoteHarvest') return;
                    creepSource = creep.memory.target;
                    targetSources[creepSource].harvs++;
                    targetSources[creepSource].power += creep.getActiveBodyparts(WORK) * HARVEST_POWER;
                    let srcObj = Game.getObjectById(creepSource);
                    if(storagePos && srcObj){
                        let srcObjRange = storagePos.getRangeTo(srcObj) 
                        let creepSpawnLead = CREEP_SPAWN_TIME*creep.body.length
                        if (creep.ticksToLive < srcObjRange + creepSpawnLead && !creep.memory.respawn){
                            targetSources[creepSource].ttlFlag = creep.id;
                        }
                    };
                })
            }
            else{
                noHarvs = true;
                //console.log("Noharvs!")
            }

            //For each source, see if we have enough harvest power or enough space for a new harvester
            Object.entries(fief.sources).forEach(([sourceID,source])=>{
                //console.log("CHECKING",sourceID,"Open spots",source.openSpots,'Harvs',targetSources[sourceID].harvs,'Power',targetSources[sourceID].power,'Flag',targetSources[sourceID].ttlFlag)
                //If there's no room, or if we have enough harvest power, return

                if((source.openSpots <= targetSources[sourceID].harvs || targetSources[sourceID].power >= SOURCE_ENERGY_CAPACITY/ENERGY_REGEN_TIME) && !targetSources[sourceID].ttlFlag) return;

                //If not enough strength and we have room, order a new harvester. Higher sev if it's closest.
                let sev = noHarvs == true ? 80 : 55;
                if(source.closest) sev+= 1
                let opts = {sev:sev,memory:{role:'harvester',job:'energyHarvester',harvestSpot:{x:source.spotx,y:source.spoty,id:sourceID},fief:room.name,target:sourceID,status:'spawning',preflight:false}}
                if(targetSources[sourceID].ttlFlag) opts.respawn = targetSources[sourceID].ttlFlag
                //console.log("Adding harv to spawnQueue. Opts:")
                //console.log(JSON.stringify(opts))
                registry.requestCreep(opts)
                
            });

            //-- Upgrader --
            let upMax = 0;
            if(fief.controllerSpots){
                if(fief.controllerSpots.storage && room.storage && room.storage.store[RESOURCE_ENERGY] > 10000){
                    for(let each of Object.values(fief.controllerSpots.storage)){
                        if(Array.isArray(each)) upMax+=each.length;
                    }
                }
                else if(fief.controllerSpots.terminal && room.terminal && room.terminal.store[RESOURCE_ENERGY] > 10000){
                    for(let each of Object.values(fief.controllerSpots.terminal)){
                        if(Array.isArray(each)) upMax+=each.length;
                    }
                }
                else{
                    for(let each of Object.values(fief.controllerSpots.base)){
                        if(Array.isArray(each)) upMax+=each.length;
                    }
                }
            }
            else{
                upMax = 0;
            }

            //If we need a remote builder and there isn't one or it's dead, request one
            if(fief.remoteBuild){
                //If we don't have vision in the room, no building it for now
                let remo = fiefCreeps.builder || [];
                //Check for remote builders that aren't part of the army
                remo = remo.filter(crp => crp.memory.job == 'remoteBuilder' && !crp.memory.troupe)
                if(!remo.length) registry.requestCreep({sev:33,memory:{role:'builder',job:'remoteBuilder',fief:room.name,targetRoom:fief.remoteBuild,status:'spawning',preflight:false}})
                
            }

            //Remote reps
            if(fief.repRequest){
                if(room.controller.level >= 4 && !fiefCreeps.repair || !fiefCreeps.repair.length){
                    registry.requestCreep({sev:37,memory:{role:'repair',fief:room.name,status:'spawning',preflight:false}})
                }
                //else if(fiefCreeps.repair.length == 1 && damagedStructures.length && damagedStructures.length > ){
                    //registry.requestCreep({sev:20,memory:{role:'repair',fief:room.name,status:'spawning',preflight:false}})
                //}
            }
            let totalEnergy = getStoredResources(RESOURCE_ENERGY)

            //Spawn operations when storage is available
            if(room.storage && room.storage.my){
                let upgradersNeeded;
                if(roomLevel == 8 || fief.holdUpgrade || totalEnergy < 10000){
                    //console.log("Upgrade held",room.name)
                    if(!fiefCreeps.upgrader && room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[roomLevel]/2) registry.requestCreep({sev:35,body:[MOVE,CARRY,WORK,MOVE,WORK],memory:{role:'upgrader',fief:room.name,status:'spawning',preflight:false}})
                }
                else if([6,7].includes(roomLevel) && heap.funnelTarget && heap.funnelTarget != room.name && room.controller.ticksToDowngrade > CONTROLLER_DOWNGRADE[roomLevel]/2){
                    //No upgrading if we're helping funnel and aren't in downgrade alert
                    //console.log("Funneling, no upgrade",room.name)
                    upgradersNeeded = 0;
                }
                else{
                    let storageLevel = room.controller.level == 4 ? 25000 : 100000;
                    //Chaining significantly reduces the upgraders required
                    if(fief.controllerSpots && room.name != heap.funnelTarget && (fief.controllerSpots.storage || fief.controllerSpots.terminal)){
                        upgradersNeeded = Math.min(upMax,Math.ceil(totalEnergy/(storageLevel*1.5)));
                    }
                    else{
                        upgradersNeeded = Math.min(upMax,Math.ceil(totalEnergy/storageLevel));
                    }
                    //console.log("Ups needed",upgradersNeeded)
                }
                if(upgradersNeeded > 0 && (!fiefCreeps.upgrader || fiefCreeps.upgrader.length < upgradersNeeded)){
                    registry.requestCreep({sev:35,memory:{role:'upgrader',fief:room.name,status:'spawning',preflight:false}})
                }
                let fortFlag = false;
                //Builder logic
                //We no longer split the sites since our tower builds them up to minimum levels
                if(cSites.length && fiefCreeps.builder){
                    let builds = fiefCreeps.builder.filter(crp => !['fortifier','remoteBuild'].includes(crp.memory.job))
                    if(!builds.length)registry.requestCreep({sev:32,memory:{role:'builder',fief:room.name,status:'spawning',preflight:false}})
                }
                /*if(cSites.length){
                    //Split sites into ramparts and others
                    let [rampSites,buildings] = cSites.reduce((arr,site) => {
                        site.structureType == STRUCTURE_RAMPART ? arr[0].push(site) : arr[1].push(site);
                        return arr
                    },[[],[]]);
                    if(buildings.length && (!fiefCreeps.builder || !fiefCreeps.builder.some(crp => crp.memory.job != 'fortifier'))){
                        registry.requestCreep({sev:32,memory:{role:'builder',fief:room.name,status:'spawning',preflight:false}})
                    }
                    if(rampSites.length) fortFlag = true;
                }*/
                let hurtRamps = room.find(FIND_MY_STRUCTURES).filter(st => st.structureType == STRUCTURE_RAMPART && st.hits < fief.rampTarget)
                if(hurtRamps.length) fortFlag = true;
                //Don't repair if we're below energy
                if(fortFlag && room.storage && room.storage.store[RESOURCE_ENERGY] > RAMPART_REPAIR_MINIMUM_ENERGY){
                    let forts = fiefCreeps.builder || [];
                    forts = forts.filter(crp => crp.memory.job == 'fortifier')
                    let fortsNeed = room.controller.level > 4 ? 1 : 2;
                    if(heap.wardens && heap.wardens[room.name]) fortsNeed = 4;
                    if(forts.length < fortsNeed){
                        registry.requestCreep({sev:31,memory:{role:'builder',job:'fortifier',fief:room.name,status:'spawning',preflight:false}})
                    }
                }              


                if(roomLevel >=6 && extractor){
                    if(fief.mineral.can){
                        let mineral = Game.getObjectById(fief.mineral.id)
                        if(!Memory.kingdom.mineralNeed) Memory.kingdom.mineralNeed = {};
                        let mineralNeed = Memory.kingdom.mineralNeed[mineral.mineralType] || DEFAULT_MINERAL_NEED
                        if(!mineral.ticksToRegeneration && room.storage.store.getFreeCapacity() > STORAGE_SPACE_FOR_MINERAL_HARVEST && (heap.stock[mineral.mineralType] < mineralNeed || mineral.mineralAmount < 10000)){
                            if(!fiefCreeps.harvester || !fiefCreeps.harvester.filter(crp => crp.memory.target == mineral.id).length){
                                registry.requestCreep({sev:33,memory:{role:'harvester',job:'mineralHarvester',fief:room.name,target:mineral.id,status:'spawning',preflight:false}})
                            }
                        }
                    }
                    else{
                        if(fief.mineral.harvestSpot){
                            let spot = room.lookForAt(LOOK_STRUCTURES,fief.mineral.harvestSpot.x,fief.mineral.harvestSpot.y).filter(str=> str.structureType == STRUCTURE_CONTAINER)[0];
                            if(spot){
                                fief.mineral.can = spot.id;
                            }
                            else{
                                spot = room.lookForAt(LOOK_CONSTRUCTION_SITES,fief.mineral.harvestSpot.x,fief.mineral.harvestSpot.y).filter(str=> str.structureType == STRUCTURE_CONTAINER)[0];
                                if(!spot){
                                    room.createConstructionSite(fief.mineral.harvestSpot.x,fief.mineral.harvestSpot.y,STRUCTURE_CONTAINER)
                                }
                            }
                        }
                    }

                }



                //Room crash check
                //If no creeps, storage, and energy in storage, get a hauler
                //console.log("OBJKEYS",Object.keys(kingdomCreeps).length)
                //console.log(JSON.stringify(kingdomCreeps))
                //if(!Object.keys(kingdomCreeps).length){
                //    if(room.storage.store[RESOURCE_ENERGY] > 200){
                //        registry.requestCreep({sev:100,memory:{role:'hauler',fief:room.name,preflight:false,state:'idle'}})
                //    }
                //}
            }
            //Don't need to check for harvesters because we use strict priorities now
            else if(!fief.holdUpgrade || room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[roomLevel]/2){
                
                //If no upgraders(who are also builders at this stage), and we're below a default cap
                if(!fiefCreeps.upgrader){
                    if(upMax == 0) return;
                    //Make sure we're good on energy
                    if(plannedNet<=0 || averageNet<=0) return;
                    //If we passed all, request an upgrader
                    registry.requestCreep({sev:(!fiefCreeps.upgrader || fiefCreeps.upgrader.length) ? 35 : 50,memory:{role:'upgrader',job:'starterUpgrader',fief:room.name,status:'spawning',preflight:false}})
                }
                else if(plannedNet > 0 && averageNet > 0){
                    //Make sure they're all doing something. If so we can justify another
                    let workingUps = fiefCreeps.upgrader.filter(up => up.store.getUsedCapacity() > 0);
                    if(workingUps.length == fiefCreeps.upgrader.length && fiefCreeps.upgrader.length < upMax){
                        registry.requestCreep({sev:35,memory:{role:'upgrader',job:'starterUpgrader',fief:room.name,status:'spawning',preflight:false}})
                    }

                }
            }
        }


        //Non-spawn room operations for after storage
        if(room.storage  && room.storage.my){
            //If no construction sites and positive income, start raising the ramp target as long as they're all at the last one
            if(Game.time % (Math.round(roomLevel*1.3)*1000) == 0){
                //If we aren't yet RCL8 and we're over 3M hits, then no raising unless we have a war override
                if(fief.rampTarget < RAMPART_HITS_MAX[room.controller.level] && (fief.rampTarget < RAMPART_LOWRCL_CAP || roomLevel == 8 || fief.rampOverride)){
                    //If we're below the minimum for our RCL, bump it up with a cap of the max hits for our level
                    fief.rampTarget = Math.min(RAMPART_HITS_MAX[room.controller.level],Math.max(fief.rampTarget,rampartMinimums[room.controller.level]))
                    if(averageNet > 0 || room.storage.store[RESOURCE_ENERGY] > 100000){
                        let lowRamps = ramps.filter(struct => struct.structureType == STRUCTURE_RAMPART && struct.hits < fief.rampTarget);
                        //Grow by 10% if there are none
                        if(!lowRamps.length) fief.rampTarget += Math.round(fief.rampTarget*0.1);
                    }
                }
                
            }
            //#region Lab Operation
            //#endregion
            //If we have labs set up, run lab code
            if(fief.labs){
                //First check for boost labs. These labs are ignored when running reactions so creeps can use them to boost
                //Initialize if needed
                if(!fief.labs.boostLabs || Array.isArray(fief.labs.boostLabs)) fief.labs.boostLabs = {};
                //Function to ensure a lab is prepared to boost or run
                const prepareLab = (labID, resourceType, priority = 8) => {
                    const lab = Game.getObjectById(labID);
                    if(!lab) return false;
                    
                    //If wrong mineral, remove it
                    if (lab.mineralType && lab.mineralType !== resourceType) {
                        supplyDemand.addRequest(room, {
                            type: 'pickup',
                            targetID: labID,
                            resourceType: lab.mineralType,
                            amount: lab.store[lab.mineralType],
                            priority
                        });
                        return false;
                    }
                    
                    //If no mineral or needs more, order some
                    if(!lab.mineralType || lab.store[lab.mineralType] < 1500) {
                        const amount = Math.min(3000, getStoredResources(resourceType));
                        if (amount) {
                            supplyDemand.addRequest(room, {
                                type: 'dropoff',
                                targetID: labID,
                                resourceType,
                                amount,
                                priority
                            });
                        }
                    }
                    
                    //Lab is ready if it has the correct mineral
                    return lab.mineralType === resourceType;
                };

                //Handle boost labs
                const boostLabIDs = Object.keys(fief.labs.boostLabs);
                boostLabIDs.forEach(labID => {
                    prepareLab(labID, fief.labs.boostLabs[labID]);
                });
                //Handle reaction labs
                if(fief.labs.sourceLabs && fief.labs.target && REACTION_INGREDIENTS[fief.labs.target]){
                    const ingredients = REACTION_INGREDIENTS[fief.labs.target];
                    const sourceLabIDs = Object.keys(fief.labs.sourceLabs);
                    const occupiedLabIDs = Object.keys(fief.labs.boostLabs || {});

                    //Update source labs with correct ingredients
                    for (let i = 0; i < Math.min(2, sourceLabIDs.length); i++) {
                        fief.labs.sourceLabs[sourceLabIDs[i]] = ingredients[i];
                    }
                    
                    //Find target labs if needed
                    if (!fief.labs.targetLabs || 
                        fief.labs.targetLabs.length + 2 < CONTROLLER_STRUCTURES[STRUCTURE_LAB][room.controller.level]) {
                        fief.labs.targetLabs = room.find(FIND_STRUCTURES)
                            .filter(s => s.structureType === STRUCTURE_LAB && 
                                !sourceLabIDs.includes(s.id))
                            .map(s => s.id);
                    }
                    //Manage source labs
                    let readySources = 0;
                    for(const labID of sourceLabIDs){
                        if(occupiedLabIDs.includes(labID)){
                            continue;
                        }
                        else if(prepareLab(labID, fief.labs.sourceLabs[labID])) {
                            readySources++;
                        }
                    };
                    
                    
                    
                    for (const targetID of fief.labs.targetLabs) {
                        const target = Game.getObjectById(targetID);
                        if (!target) continue;
                        
                        //Skip if lab is used for boosting
                        if (occupiedLabIDs.includes(targetID)) continue;
                        
                        //Empty lab if needed
                        if (target.mineralType && 
                            (target.store[target.mineralType] > 2500 || target.mineralType !== fief.labs.target)) {
                            supplyDemand.addRequest(room, {
                                type: 'pickup',
                                targetID,
                                resourceType: target.mineralType,
                                amount: target.store[target.mineralType],
                                priority: 6
                            });
                        }
                        
                        //Run reaction if possible
                        if (readySources === 2 && !target.cooldown) {
                            const sources = sourceLabIDs.map(id => Game.getObjectById(id));
                            target.runReaction(sources[0], sources[1]);
                        }
                    }
                } 
                //Empty target labs if no active reactions
                else{
                    const occupiedLabIDs = Object.keys(fief.labs.boostLabs || {});
                    if(fief.labs.targetLabs){
                        for (const targetID of fief.labs.targetLabs) {
                            const target = Game.getObjectById(targetID);
                            if (!target || occupiedLabIDs.includes(targetID) || !target.mineralType) continue;
                            
                            supplyDemand.addRequest(room, {
                                type: 'pickup',
                                targetID,
                                resourceType: target.mineralType,
                                amount: target.store[target.mineralType],
                                priority: 8
                            });
                        }
                    }
                    if(fief.labs.sourceLabs){
                        for (const targetID of Object.keys(fief.labs.sourceLabs)) {
                            const target = Game.getObjectById(targetID);
                            if (!target || occupiedLabIDs.includes(targetID) || !target.mineralType) continue;
                            
                            supplyDemand.addRequest(room, {
                                type: 'pickup',
                                targetID,
                                resourceType: target.mineralType,
                                amount: target.store[target.mineralType],
                                priority: 8
                            });
                        }
                    }

                }

                function selectLabTarget() {
                    //First check if we need any tier 1 resources
                    for(const [compound, ingredients] of Object.entries(REACTION_INGREDIENTS)) {
                        //Skip if not tier 1
                        if(getResourceTier(compound) !== 1) continue;
                        
                        const currentAmount = getKingdomResources(compound);
                        if(currentAmount < TIER1_MIN_AMOUNT) {
                            //Check if we have the ingredients
                            if(getKingdomResources(ingredients[0]) > 0 && getKingdomResources(ingredients[1]) > 0) {
                                return compound;
                            }
                        }
                    }
                    
                    //If all tier 1 resources are at minimum, check if we have enough surplus to make tier 2
                    let allTier1AtSurplus = true;
                    for(const compound in REACTION_INGREDIENTS) {
                        if(getResourceTier(compound) === 1) {
                            if(getKingdomResources(compound) < TIER1_MIN_AMOUNT + TIER1_SURPLUS) {
                                allTier1AtSurplus = false;
                                break;
                            }
                        }
                    }
                    
                    //If we have surplus of tier 1, look for tier 2 needs
                    if(allTier1AtSurplus) {
                        for(const [compound, ingredients] of Object.entries(REACTION_INGREDIENTS)) {
                            if(getResourceTier(compound) !== 2) continue;
                            
                            const currentAmount = getKingdomResources(compound);
                            if(currentAmount < TIER2_MIN_AMOUNT) {
                                //Check if we have the ingredients
                                if(getKingdomResources(ingredients[0]) > 0 && getKingdomResources(ingredients[1]) > 0) {
                                    return compound;
                                }
                            }
                        }
                        
                        //If all tier 2 resources are at minimum, check if we have enough surplus to make tier 3
                        let allTier2AtSurplus = true;
                        for(const compound in REACTION_INGREDIENTS) {
                            if(getResourceTier(compound) === 2) {
                                if(getKingdomResources(compound) < TIER2_MIN_AMOUNT + TIER2_SURPLUS) {
                                    allTier2AtSurplus = false;
                                    break;
                                }
                            }
                        }
                        
                        //If we have surplus of tier 2, look for tier 3 needs
                        if(allTier2AtSurplus) {
                            for(const [compound, ingredients] of Object.entries(REACTION_INGREDIENTS)) {
                                if(getResourceTier(compound) !== 3) continue;
                                
                                const currentAmount = getKingdomResources(compound);
                                if(currentAmount < TIER3_MIN_AMOUNT) {
                                    //Check if we have the ingredients
                                    if(getKingdomResources(ingredients[0]) > 0 && getKingdomResources(ingredients[1]) > 0) {
                                        return compound;
                                    }
                                }
                            }
                        }
                    }
                    
                    //If we got here, no pressing needs - could return a default target or null
                    return null;
                }
            }
                

            if(room.terminal){
                //Maintain terminal levels as needed. Default energy amount set if the import manager hasn't assigned anything
                if(!fief.termNeeds) fief.termNeeds = {[RESOURCE_ENERGY]:DEFAULT_TERMINAL_ENERGY};
                let termNeeds = fief.termNeeds;
                //Check every 25 ticks to fill terminal if below any of the needs
                if(Game.time % 25 == 0){
                    for(let resource of Object.keys(termNeeds)){
                        let amount = termNeeds[resource];
                        if(room.terminal.store[resource] < amount){
                            supplyDemand.addRequest(room,{type:'dropoff',amount:50000-room.terminal.store[resource],targetID:room.terminal.id});
                        }
                    }  
                }
            }


            //Funnelcheck - RCL 7 helps funnel to 6 as well
            if(heap.funnelTarget && room.terminal && [6,7].includes(roomLevel)){
                //If we are not the funnel target
                if(room.name != heap.funnelTarget && !cSites.length){
                    if(room.storage.store[RESOURCE_ENERGY] > 50000 && room.terminal.store.getFreeCapacity() > 10000){
                        supplyDemand.addRequest(room,{type:'dropoff',resourceType:'energy',amount:Math.min(room.storage.store[RESOURCE_ENERGY] - 50000,room.terminal.store.getFreeCapacity()),targetID:room.terminal.id,international:false,priority:4})
                    }
                    if(room.terminal.store[RESOURCE_ENERGY] > 50000){
                        let fee = Math.ceil( room.terminal.store[RESOURCE_ENERGY] * ( 1 - Math.exp(-Game.map.getRoomLinearDistance(room.name,heap.funnelTarget,true)/30) ) )
                        room.terminal.send(RESOURCE_ENERGY,room.terminal.store[RESOURCE_ENERGY]-fee,heap.funnelTarget)
                    }
                }
            }
        }

        
        //RCL 5 checks - Link control
        if(roomLevel >= 5){
            //Get the links set up if they aren't
            
            //Links are set up manually for now. Write automated link placement later.
            //Link memory structure: fief.links = {coreLink:linkID,upLink:linkID,remoteLink:linkID}
            //Consider making remoteLink a list of remote links

            //If the link arrays don't exist, create them
            if(!fief.links.sourceLinks) fief.links.sourceLinks = [];
            if(!fief.links.remoteLinks) fief.links.remoteLinks = [];
            if(!fief.links.coreLink) fief.links.coreLink = '';
            if(!fief.links.upLink) fief.links.upLink = '';

            //Detect links
            if(room.storage && !fief.links.coreLink){
                let coreCheck = room.find(FIND_MY_STRUCTURES).filter(str=>str.structureType == STRUCTURE_LINK);
                for(let core of coreCheck){
                    if(core.pos.getRangeTo(room.storage) <= 2){
                        fief.links.coreLink = core.id;
                        break;
                    }
                }
            }
            if(false && !fief.links.upLink){
                let upCheck = room.controller.pos.findInRange(FIND_MY_STRUCTURES,2, {
                    filter: { structureType: STRUCTURE_LINK }
                })[0];
                if(upCheck){
                    fief.links.upLink = upCheck.id;
                }
            }

            //Set up an array of sources test
            




            //If we don't have a link for every source
            if(fief.links.sourceLinks.length != fiefSources.length){
                //For each source, check for link assigned
                fiefSources.forEach(source =>{
                    if(!fief.sources[source].link){
                        //If no link, search for one
                        let sourceCheck = Game.getObjectById(source).pos.findInRange(FIND_MY_STRUCTURES,2, {
                            filter: { structureType: STRUCTURE_LINK }
                        })[0];
                        //If found, and not matching any other link, add to the source info and to the links array
                        //Automated placement may need to account for this
                        if(sourceCheck && (!fief.links.coreLink || sourceCheck.id != fief.links.coreLink) && (!fief.links.upLink || sourceCheck.id != fief.links.upLink)){
                            fief.sources[source].link = sourceCheck.id;
                            //Only add if not already in the list, in case it's shared
                            if(!fief.links.sourceLinks.includes(sourceCheck.id)) fief.links.sourceLinks.push(sourceCheck.id);
                        }
                    }
                    
                    
                })
            }
            if(Game.time % 277 == 0){
                let links = room.find(FIND_MY_STRUCTURES).filter(str=>str.structureType == STRUCTURE_LINK);
                if(links.length > fief.links.sourceLinks.length + fief.links.remoteLinks.length + (fief.links.upLink ? 1 : 0) + (fief.links.coreLink ? 1 : 0)){
                    //Spare links means we have remote links
                    links = links.filter(lk => 
                        ([2,3,47,46].includes(lk.pos.x) || [2,3,47,46].includes(lk.pos.y)) 
                        && !fief.links.sourceLinks.includes(lk.id) 
                        && !fief.links.remoteLinks.includes(lk.id)
                        && lk.id != fief.links.coreLink
                        && lk.id != fief.links.upLink );
                    if(links.length){
                        for(let lk of links){
                            fief.links.remoteLinks.push(lk.id)
                        }
                    }
                }
            }
            //Link transfer logic
            let upLink = Game.getObjectById(fief.links.upLink);
            let coreLink = Game.getObjectById(fief.links.coreLink);
            let remoteLinks = fief.links.remoteLinks.map(id => Game.getObjectById(id));
            let sourceLinks = fief.links.sourceLinks.map(id => Game.getObjectById(id));
            //if(room.name=='E19N11')console.log(managerBusy)
            if(!upLink)fief.links.upLink = false
            if(!coreLink)fief.links.coreLink = false


            if(coreLink && coreLink.store[RESOURCE_ENERGY]>0){
                supplyDemand.addRequest(room,{resourceType:RESOURCE_ENERGY,amount:coreLink.store[RESOURCE_ENERGY],type:'pickup',targetID:fief.links.coreLink,priority:6});
            }
            else{
                let coreTransfer = false;
                for(let link of sourceLinks){
                    if(link &&link.store[RESOURCE_ENERGY] == 800 && !link.cooldown){
                        link.transferEnergy(coreLink)
                        coreTransfer = true;
                        break;
                    }
                }
                if(!coreTransfer){
                    for(let link of remoteLinks){
                        if(!link){
                            fief.links.remoteLinks = fief.links.remoteLinks.filter(id => !!Game.getObjectById(id));
                            break;
                        }
                        if((link && link.store[RESOURCE_ENERGY] == 800 && !link.cooldown) || (link && link.store[RESOURCE_ENERGY] >0 && !link.reserved)){
                            link.transferEnergy(coreLink)
                            coreTransfer = true;
                            break;
                        }
                    }
                }
            }
            


        }
        //#region Factory

        //#endregion
        //Factory logic
        //If we have a commodity specified that we want
        if(factory && fief.factory && fief.factory.orders && factory.cooldown == 0){
            //console.log("HERE")
            let orders = Object.entries(fief.factory.orders);
            let cooking = false;
            for(let [resource,amount] of orders){
                //console.log(resource,amount)
                let cook = true;
                let ingredients = Object.entries(COMMODITIES[resource].components);
                //Go through each ingredient for the order and if we don't have enough of any, mark false
                ingredients.forEach(([item,qty]) =>{
                    if(!factory.store[item] || factory.store[item] < qty){
                        cook = false;
                        //If we have enough to order some, do so
                        if(room.terminal.store[item] + room.storage.store[item] > qty){
                            supplyDemand.addRequest(room,{resourceType:item,amount:Math.min(room.terminal.store[item] + room.storage.store[item],qty*4),type:'dropoff',targetID:factory.id});
                        }
                    }
                });
                if(cook){
                    let cookTry = factory.produce(resource);
                    if(cookTry == OK){
                        cooking = true;
                        fief.factory.orders[resource] -= COMMODITIES[resource].amount;
                        if(fief.factory.orders[resource].amount <= 0) delete fief.factory.orders[resource];
                    }
                    break;
                }
            }

        }

        //Market/room support logic
        if(room.terminal && room.terminal.cooldown == 0){
            //If we have 80k, see if we can send 50 to support
            if(room.terminal.store[RESOURCE_ENERGY] > 80000){
                //For each fief
                Object.keys(Memory.kingdom.fiefs).forEach(fief=>{
                    let fiefRoom = Game.rooms[fief];
                    //If the room has a terminal and is level 6, send energy to help growth
                    if(fief != room.name && fiefRoom.terminal && fiefRoom.terminal.store.getFreeCapacity() > 50000 && fiefRoom.controller.level == 6){
                        //let termSend = room.terminal.send(RESOURCE_ENERGY,50000,fief,'Growth Support Transfer');
                        //console.log(room.name,'sending 50k energy to',fief,'with result',termSend)
                    }
                })
            }
        }

        //RCL 8 checks
        if(roomLevel == 8){

        }
        // -- Final Actions --
        
        //Gather all idle spawns
        //#region Defense
        //#endregion
        //Set defense mission if hostile creeps are detected and they're not scouts
        if(roomBaddies.some(creep => (!helper.isScout(creep) || (creep.pos.getRangeTo(room.controller == 2) && helper.isScout(creep))))){
            //Create defend mission if one isn't already active
            //if(!Memory.kingdom.missions.defend[room.name]){
                //missionManager.createMission('defend',room.name,{hostileCreeps:roomBaddies.filter(creep =>{!Memory.diplomacy.allies.includes(creep.owner.username)})})
            //}
        }

        //If we have storage levels and safemode is over or low, run through rampart check every so often
        let t = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        if(Game.time % 200 == 0 && room.storage && room.storage.store[RESOURCE_ENERGY] > 10000 && (ramps.length || (room.controller.level >=4 && !room.controller.safeMode) || room.controller.safeMode < 3000)){
            if(fief.rampartPlan && t.length){
                //Count the current construction sites, no more than 10 for ramparts
                let count = cSites.length;
                for(let ramp of fief.rampartPlan){
                    if(count >=10) return;

                    let spotInfo = room.lookAt(ramp.x, ramp.y);
                    let hasRampart = spotInfo.some(s => s.structure && s.structure.structureType === STRUCTURE_RAMPART);
                    let hasConstructionSite = spotInfo.some(s => s.constructionSite);
                    let isWall = spotInfo.some(s => s.terrain === 'wall');
                    if (!hasRampart && !hasConstructionSite && !isWall){
                        if(room.createConstructionSite(ramp.x,ramp.y,STRUCTURE_RAMPART) == 0){
                            count++
                        }
                    }
                };
            }
        }
        //Run fortifiers
        
        if(fiefCreeps.builder){
            let fortifiers = [];
            for(let builder of fiefCreeps.builder){
                if(builder.memory.job == 'fortifier') fortifiers.push(builder);
                else{
                    buildRole.run(builder);
                }
            }
            buildRole.runFortifiers(room,fortifiers);
        }


    let towers = room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
    });
    let damageRamps = ramps.filter(r => r.hits <= 1000);
    for(let tower of towers) {

        var damagedCreeps = tower.room.find(FIND_MY_CREEPS, {
            filter: (creep) => (creep.hits < creep.hitsMax)
        }).sort((a, b) => a.hits - b.hits);

        if (damagedCreeps.length > 0 && tower.energy > 400){
            tower.heal(damagedCreeps[0]);
            continue
        }
        
        
        const hostiles = roomBaddies.filter(bad=>(bad.body.length <25) || bad.owner.username == 'Invader');
        
        let closestHostile = randomChoice(hostiles)
        if(damageRamps.length){
            tower.repair(randomChoice(damageRamps))
        }
        else if (closestHostile != null && closestHostile != undefined) {
            tower.attack(closestHostile);
        }
    }
        

        let cm = PathFinder.CostMatrix.deserialize(fief.costMatrix);
        /*for(let x=0;x<50;x++){
            for(let y=0;y<50;y++){
                room.visual.text(cm.get(x,y),x,y+0.25)
            }
        }*/

        //Return data for kingdomStatus
        let storageLevel;
        if(room.storage && room.storage.my){
            storageLevel = room.storage.store.getUsedCapacity();
        }
        let totalCreeps = 0;
        if (fiefCreeps) {
            for (const list of Object.values(fiefCreeps)){
                if(!list) continue
                totalCreeps += list.length;
            }
        }
        return {
            roomLevel:roomLevel,
            wares: totalWares(room,fief),
            totalCreeps: totalCreeps,
            fiefCreeps: fiefCreeps,
            hostileCreeps: roomBaddies,
            controllerProgress: room.controller.progress,
            safeMode: room.controller.safeMode,
            spawnUse: fief.combinedSpawnUse,
            currentlySpawning: Object.values(Game.spawns).filter(spawn => spawn.spawning && spawn.room.name == room.name).map(spawn => Game.creeps[spawn.spawning.name].memory.role),
            storageLevel: storageLevel,
            energyUse: Math.round(averageNet),
            roomStatus:room.controller.safeMode ? 'SAFEMODE' : roomBaddies.length ? "ATTACK" : "OK",
            shippingOrders: heap.shipping[room.name].requests && Object.keys(heap.shipping[room.name].requests).length || 0,
            shippingUse:    heap.shipping[room.name].utilization ? 100-(Math.round(((heap.shipping[room.name].utilization.reduce((acc, num) => acc + num, 0)/heap.shipping[room.name].utilization.length)*100))) : 0
        };
        

    }
};


function getSev(role){
    let sevList = {
        'default':50,
        'generalist':50,
        'canHarvest':50,
        'canHauler':50,
        'refiller':70,
        'upgrader':20,
        'homeBuilder':30,
        'crasher':999,
        'guard':100,
        'manager':85
    }
    return sevList[role] || 50;
}

function totalWares(room,fief) {
    let totalResources = {};
    // Sum resources in storage
    if (room.storage) {
        for (const resourceType in room.storage.store) {
            if (room.storage.store.hasOwnProperty(resourceType)) {
                totalResources[resourceType] = (totalResources[resourceType] || 0) + room.storage.store[resourceType];
                heap.kingdomStatus.wares[resourceType] = (heap.kingdomStatus.wares[resourceType] || 0) + room.storage.store[resourceType];
            }
        }
    }

    // Sum resources in terminal
    if (room.terminal) {
        for (const resourceType in room.terminal.store) {
            if (room.terminal.store.hasOwnProperty(resourceType)) {
                totalResources[resourceType] = (totalResources[resourceType] || 0) + room.terminal.store[resourceType];
                heap.kingdomStatus.wares[resourceType] = (heap.kingdomStatus.wares[resourceType] || 0) + room.terminal.store[resourceType];
            }
        }
    }

    //Add room mineral if not already there
    let mineral = Game.getObjectById(Memory.kingdom.fiefs[room.name].mineral.id);
    if(!totalResources[mineral.mineralType]){
        totalResources[mineral.mineralType] = 0;
        heap.kingdomStatus.wares[mineral.mineralType] = 0;
    }
    if(fief.labs){
        let labIDs = Object.keys(fief.labs.sourceLabs);
        labIDs.push(...fief.labs.targetLabs)
        let labs = labIDs.map(id => Game.getObjectById(id));
        for(let lab of labs){
            if(lab.mineralType){
                totalResources[lab.mineralType] = (totalResources[lab.mineralType] || 0) + lab.store[lab.mineralType];
            }
        }
    }
    return totalResources;
}

function manageResourceCollection(room) {
    //Retrieve all dropped resources in the room
    const droppedResources = room.find(FIND_DROPPED_RESOURCES);
    
    //Retrieve current tasks to check against
    droppedResources.forEach(resource => {
        const { id, amount, resourceType } = resource;
        //Check if this resource is already targeted by an existing task
        if(resourceType==RESOURCE_ENERGY && amount<50) return
        //If no active/usable storage, don't pick up non energy resources
        if(resourceType != RESOURCE_ENERGY && (!room.storage || !room.storage.my)) return

        //Details object for the addRequest call
        let details = {
            type: 'pickup',
            targetID: id,
            amount: amount,
            resourceType: resourceType,
            priority: 6
        };

        const taskID = supplyDemand.addRequest(room, details);
        //console.log('Added new task:', taskID);
    });
    const droppedTombstones = room.find(FIND_TOMBSTONES);
    droppedTombstones.forEach(stone =>{
        Object.entries(stone.store).forEach(([resource,amount]) => {
            if(resource != RESOURCE_ENERGY && (!room.storage || !room.storage.my)) return
            let details = {
                type: 'pickup',
                targetID: stone.id,
                amount: amount,
                resourceType: resource,
                priority: 6
            };
            supplyDemand.addRequest(room, details);
        });
    });
    //Check for mining containers and submit requests for any over 100 full
    let cans = []
    for(let source of Object.values(Memory.kingdom.fiefs[room.name].sources)){
        if(source.can && Game.getObjectById(source.can) &&  Game.getObjectById(source.can).store.getUsedCapacity() > 500) cans.push(source.can)
    }
    if(Memory.kingdom.fiefs[room.name].mineral.can && Game.getObjectById(Memory.kingdom.fiefs[room.name].mineral.can) &&  Game.getObjectById(Memory.kingdom.fiefs[room.name].mineral.can).store.getUsedCapacity() > 500) cans.push(Memory.kingdom.fiefs[room.name].mineral.can)
    for(let canID of cans){
        let can = Game.getObjectById(canID)
        for(let resType in can.store){
            let details = {
                type: 'pickup',
                targetID: canID,
                amount: can.store[resType],
                resourceType: resType,
                priority: 6
            };
            supplyDemand.addRequest(room, details);
        }
    }
}

function getDomainRooms(fief) {
    if(Memory.kingdom.fiefs[fief].domain){
        //console.log("DOMAIN ALREADY HERE");
        return Memory.kingdom.fiefs[fief].domain;
    }
    //BFS for rooms in range
    const MAX_RANGE = 3;
    let queue = [{roomName: fief, depth: 0}];
    let visited = new Set();
    let domainRooms = [];
    //console.log("Starting domain search")
    
    while (queue.length > 0){
        let { roomName, depth } = queue.shift();
        if(visited.has(roomName)) continue;
        //console.log(`Visiting ${roomName} at depth ${depth}`)
        //If we're within range, save the room
        if(depth <= MAX_RANGE) domainRooms.push({roomName:roomName,depth:depth});

        //If we're at max range, continue. Otherwise add neighbors
        if(depth == MAX_RANGE) continue;
        //console.log(`Depth is not at max of ${MAX_RANGE}, adding neighbors`)
        let exits = Game.map.describeExits(roomName);
        if(!exits) continue;
        for(let exitRoom of Object.values(exits)){
            if(!visited.has(exitRoom)){
                queue.push({roomName:exitRoom,depth:depth+1});
            }
        }
        
    }
    let validRooms = []
    let validSet = new Set()
    //Dump highways and crossroads, then record the rest
    for(let thisRoom of domainRooms){
        let type = describeRoom(thisRoom.roomName);
        if(type == ROOM_HIGHWAY || type == ROOM_CROSSROAD || thisRoom.roomName == fief || validSet.has(thisRoom.roomName) || Game.map.getRoomStatus(thisRoom.roomName)=='closed') continue;
        validSet.add(thisRoom.roomName)
        let scouted = !!getScoutData(thisRoom.roomName);
        validRooms.push({roomName:thisRoom.roomName,depth:thisRoom.depth,scouted:scouted,type:type})
        if(!scouted)heap.scoutList[thisRoom.roomName] = fief;
    }
    Memory.kingdom.fiefs[fief].domain = validRooms;
    chronicle.log(`${fief} -  Domain mapped. ${validRooms.length} rooms located.`,'fiefManager',3);
    return validRooms;
}

function getBoostTier(resource){
    if(!resource) return 0;
    
    //Tier 1 compounds
    if(resource.length === 2 || resource === 'ZK' || resource === 'UL') {
        return 1;
    }
    
    //Tier 2 compounds
    if(resource.length === 4) {
        return 2;
    }
    
    //Tier 3 compounds
    if(resource.length === 5) {
        return 3;
    }
    
    return 0; //Unknown or other resources
}

//Builds two maps of road coordinates and their associated extensions
function getRefillMaps(room,fief){
    //console.log(room.name,'getting refills')
    //We shouldn't be calling this function unless we already have an extension map, but check just in case
    if(!heap.fiefs[room.name].extensionMap){
        //console.log("Exension map doesn't exist, building")
        getExtensionMap(room,fief);
    }

    //Fetch the extension map and create the two refill maps if not already there
    let extensionMap = heap.fiefs[room.name].extensionMap;
    let sourceRefills = heap.fiefs[room.name].sourceRefills || new Map();
    let otherRefills = heap.fiefs[room.name].otherRefills || new Map();
    //console.log("Current lengths. extensionMap:",extensionMap.size,'sourceRefills:',sourceRefills.size,'otherRefills:',otherRefills.size)
    //Get all roads that lead to sources
    let sourceRoute = new Set(fief.roomPlan[3].road.map(spot => `${spot.x},${spot.y}`))
    //Go through all extensions and action the empty ones
    for(let extensionID of extensionMap.keys()){
        let thisExt = Game.getObjectById(extensionID);
        //If something doesn't exist anymore we need to redo the extension map
        if(!thisExt){
            delete heap.fiefs[room.name].extensionMap;
            break;
        }
        //If not completely full, add it to the refill sets
        if(thisExt.store.getFreeCapacity(RESOURCE_ENERGY) > 0){
            //Get all road spots tied to this extension
            let someSpots = false
            for(let spot of extensionMap.get(extensionID)){
                //If the road spot is in the source route set, add to source refills map. Otherwise add to other.
                if(sourceRoute.has(spot)){
                    //Get the current set of extensions for this road spot, or make a new one if it doesn't exist
                    let sourceSet = (sourceRefills.get(spot) || new Set());
                    //Add this extension to the set and assign it back to this spot in the map
                    sourceSet.add(extensionID)
                    sourceRefills.set(spot, sourceSet)
                }
                else{
                    //Get the current set of extensions for this road spot, or make a new one if it doesn't exist
                    let otherSet = (otherRefills.get(spot) || new Set());
                    //Add this extension to the set and assign it back to this spot in the map
                    otherSet.add(extensionID)
                    otherRefills.set(spot, otherSet)
                }
            }
        }
    }
    //Check if  both refill maps are empty. If so, that means there are extensions not in the main map and we need to rebuild it
    if(sourceRefills.size+otherRefills.size == 0){
        console.log(room.name,"refills are zero, requesting extension map");
        getExtensionMap(room);
        return;
    }
    //console.log("Presort size",sourceRefills.size,otherRefills.size)
    sourceRefills = sortMapBySetSize(sourceRefills);
    otherRefills = sortMapBySetSize(otherRefills);
    //console.log("Aftersort",sourceRefills.size,otherRefills.size)
    //Assign both of our refill maps back to their places
    heap.fiefs[room.name].sourceRefills = sourceRefills
    heap.fiefs[room.name].otherRefills = otherRefills
    //console.log("Heap check",heap.fiefs[room.name].sourceRefills.size,heap.fiefs[room.name].otherRefills.size)
}

function sortMapBySetSize(map) {
    let entries = Array.from(map.entries());
    entries.sort((a, b) => b[1].size - a[1].size);
    return new Map(entries);
}

//Builds a new travel CostMatrix for the room.
function getTravelMatrix(room){
    console.log("Getting travel matrix",room.name)
    let fiefCM = new PathFinder.CostMatrix;
    let fief = Memory.kingdom.fiefs[room.name];
    let storagePos = new RoomPosition(fief.roomPlan[4][STRUCTURE_STORAGE][0].x,fief.roomPlan[4][STRUCTURE_STORAGE][0].y,room.name);
    let structs = room.find(FIND_STRUCTURES);
    let roads = []
    let oSpawn;
    for(let bld of Object.keys(Memory.kingdom.fiefs[room.name].roomPlan[room.controller.level])){
        if(![STRUCTURE_ROAD,STRUCTURE_CONTAINER].includes(bld)){
            for(let spot of Memory.kingdom.fiefs[room.name].roomPlan[room.controller.level][bld]){
                fiefCM.set(spot.x,spot.y,255)                
            }
        }
    }
    for(let str of structs){
        if(str.structureType == STRUCTURE_ROAD)roads.push(str)
        if(str.structureType == STRUCTURE_SPAWN && str.name && ['Spawn1','Origin Keep'].includes(str.name)) oSpawn = str;
    }
    //Add current roads to matrix
    for(let each of roads){
        fiefCM.set(each.pos.x,each.pos.y,1)
    }
    console.log("STORAGEPOS",storagePos)
    //Path to sources and controller
    for(let source of Object.values(fief.sources)){
        console.log("Getting source")
        console.log("source",JSON.stringify(source))
        let route = PathFinder.search(storagePos,{pos:new RoomPosition(source.spotx,source.spoty,room.name),range:1},{
            plainCost: 5,
            swampCost: 10,
            roomCallback:function(roomName){
                return fiefCM;
            }
        }).path
        console.log("ROUTE!",route.length)
        for(let spot of route){
            fiefCM.set(spot.x,spot.y,1)
        }
    }
    let cRoute = PathFinder.search(storagePos,{pos:room.controller.pos,range:1},{
        plainCost: 5,
        swampCost: 10,
        roomCallback:function(roomName){
            return fiefCM;
        }
    }).path
    console.log("ControllerRoute!",cRoute.length)
    for(let spot of cRoute){
        fiefCM.set(spot.x,spot.y,1)
    }
    if(oSpawn){
        let oRoute = PathFinder.search(storagePos,{pos:oSpawn.pos,range:1},{
            plainCost: 5,
            swampCost: 10,
            roomCallback:function(roomName){
                return fiefCM;
            }
        }).path
        for(let spot of oRoute){
            fiefCM.set(spot.x,spot.y,1)
        }  
    }
    //Add holding roads
    for(let holding of Object.values(Memory.kingdom.holdings)){
        if(holding.homeFief != room.name) continue;
        if(!holding.sources)continue;
        for(let source of Object.values(holding.sources)){
            let route = source.path
            if(!route)continue;
            for(let spot of route){
                if(spot.roomName == room.name)fiefCM.set(spot.x,spot.y,1)
            }
        }
    }
    heap.travelMatrixes[room.name] = fiefCM
}

//Builds the main extension map, which has extension IDs for the keys and string coordinates of adjacent roads for values
function getExtensionMap(room){
    //console.log("Getting extension map for",room.name)
    //Create three array variables to hold structures that we find in the room
    let extensions = room.find(FIND_STRUCTURES).filter(str => [STRUCTURE_EXTENSION,STRUCTURE_SPAWN].includes(str.structureType));
    let roads = [];
    for(let levels of Object.values(Memory.kingdom.fiefs[room.name].roomPlan)){
        if(levels[STRUCTURE_ROAD]){
            roads.push(...levels[STRUCTURE_ROAD].map(rd => {return {'pos':rd}}))
        }
    }
    //console.log(extensions.length,'extensions and',roads.length,'roads')
    let otherRoads = new Set(roads.map(road => `${road.pos.x},${road.pos.y}`));
    //Get the existing map to build on if it exists, otherwise make a new one from scratch
    let extensionRoadMap =  heap.fiefs[room.name].extensionMap || new Map();
    for(let each of extensions){
        //Set up this extension in the map
        if(!extensionRoadMap.has(each.id))extensionRoadMap.set(each.id,new Set())
        let foundSpot = false;
        //Check all adjacent positions
        for(let x = -1;x<=1;x++){
            for(let y = -1;y<=1;y++){
                //skip center
                if(x==0 && y==0)continue
                let checkPos = `${each.pos.x+x},${each.pos.y+y}`
                //If the adjacent coordinate belongs to a road, add that coordinate to the set for this ID
                if(otherRoads.has(checkPos)){
                    foundSpot = true;
                    extensionRoadMap.get(each.id).add(checkPos)
                }
            }
        }
        //If there are no roads we likely have the first spawn or similar that's been disconnected
        if(!foundSpot){
            let spots = helper.getOpenSpots(each.pos)
            if(spots.length){
                for(spot of spots){
                    extensionRoadMap.get(each.id).add(`${spot.x},${spot.y}`)
                }
            }
        }
    }

    //Update the map
    heap.fiefs[room.name].extensionMap = extensionRoadMap
}

function getControllerSpots(room, fief) {
    let controller = room.controller.pos;
    let storage = room.storage ? room.storage.pos : null
    let chain = storage ? storage.getRangeTo(controller) <= 4 : null
    let chainTerm = room.terminal && room.terminal.pos.getRangeTo(controller) <= 4
    let planCM = new PathFinder.CostMatrix();

    // Mark impassable spots from the room plan
    for (let [rcl, buildings] of Object.entries(fief.roomPlan)) {
        if (rcl > room.controller.level) break;
        for (let [building, spots] of Object.entries(buildings)) {
            for(let spot of spots){
                if (building != STRUCTURE_ROAD) planCM.set(spot.x, spot.y, 255);
            }
        }
    }

    let controllerSpots = {
    };
    if(chainTerm){
        controllerSpots.terminal = {
            1: [],
            2: [],
            3: []
        }
        let terrain = new Room.Terrain(room.name);
        let queue = [];
        let visited = new Set();
        let directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
        ];
    
        // Start BFS from the storage position, always include the storage's position itself
        queue.push({ pos: room.terminal.pos, range: 0 });
        visited.add(room.terminal.pos.x + ',' + room.terminal.pos.y);
    
        while (queue.length > 0) {
            let current = queue.shift();
            let { pos, range } = current;
    
            // Skip walls or blocked areas except for the storage position itself
            let terrainType = terrain.get(pos.x, pos.y);
            if (range > 0 && (terrainType === TERRAIN_MASK_WALL || planCM.get(pos.x, pos.y) === 255)) {
                continue;
            }
            // Skip spots unable to hit the controller
            if(range > 0 && new RoomPosition(pos.x,pos.y,room.name).getRangeTo(controller) > 3){
                continue;
            }
    
            // If within range and not a wall, add to the appropriate range list
            if (range > 0 && range <= 3) {
                controllerSpots.terminal[range].push(pos);
            }
    
            // Explore neighboring positions if within range 3
            if (range <= 3) {
                for (let dir of directions) {
                    let newPos = new RoomPosition(pos.x + dir.dx, pos.y + dir.dy, room.name);
                    let posKey = newPos.x + ',' + newPos.y;
    
                    if (!visited.has(posKey)) {
                        visited.add(posKey);
                        queue.push({ pos: newPos, range: range + 1 });
                    }
                }
            }
        }
    }

    // -- Chain Logic
    if(chain){
        controllerSpots.storage = {
            1: [],
            2: [],
            3: []
        }
        let terrain = new Room.Terrain(room.name);
        let queue = [];
        let visited = new Set();
        let directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
        ];
    
        // Start BFS from the storage position, always include the storage's position itself
        queue.push({ pos: storage, range: 0 });
        visited.add(storage.x + ',' + storage.y);
    
        while (queue.length > 0) {
            let current = queue.shift();
            let { pos, range } = current;
    
            // Skip walls or blocked areas except for the storage position itself
            let terrainType = terrain.get(pos.x, pos.y);
            if (range > 0 && (terrainType === TERRAIN_MASK_WALL || planCM.get(pos.x, pos.y) === 255)) {
                continue;
            }
            // Skip spots unable to hit the controller
            if(range > 0 && new RoomPosition(pos.x,pos.y,room.name).getRangeTo(controller) > 3){
                continue;
            }
    
            // If within range and not a wall, add to the appropriate range list
            if (range > 0 && range <= 3) {
                controllerSpots.storage[range].push(pos);
            }
    
            // Explore neighboring positions if within range 3
            if (range <= 3) {
                for (let dir of directions) {
                    let newPos = new RoomPosition(pos.x + dir.dx, pos.y + dir.dy, room.name);
                    let posKey = newPos.x + ',' + newPos.y;
    
                    if (!visited.has(posKey)) {
                        visited.add(posKey);
                        queue.push({ pos: newPos, range: range + 1 });
                    }
                }
            }
        }
    }
    // -- Non Chain Logic
    controllerSpots.base = {
        1: [],
        2: [],
        3: []
    }
    let terrain = new Room.Terrain(room.name);
    let queue = [];
    let visited = new Set();
    let directions = [
        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
    ];

    // Start BFS from the controller position, always include the controller's position itself
    queue.push({ pos: controller, range: 0 });
    visited.add(controller.x + ',' + controller.y);

    while (queue.length > 0) {
        let current = queue.shift();
        let { pos, range } = current;

        // Skip walls or blocked areas except for the controller position itself
        let terrainType = terrain.get(pos.x, pos.y);
        if (range > 0 && (terrainType === TERRAIN_MASK_WALL || planCM.get(pos.x, pos.y) === 255)) {
            continue;
        }

        // If within range and not a wall, add to the appropriate range list
        if (range > 0 && range <= 3) {
            controllerSpots.base[range].push(pos);
        }

        // Explore neighboring positions if within range 3
        if (range <=3) {
            for (let dir of directions) {
                let newPos = new RoomPosition(pos.x + dir.dx, pos.y + dir.dy, room.name);
                let posKey = newPos.x + ',' + newPos.y;

                if (!visited.has(posKey)) {
                    visited.add(posKey);
                    queue.push({ pos: newPos, range: range + 1 });
                }
            }
        }
    }
    
    //Sort all postions by range before returning
    for(let chainSource of Object.values(controllerSpots)){
        for(let layer of Object.values(chainSource)){
            layer.sort((a, b) => {
                //console.log(JSON.stringify(a),JSON.stringify(b))
                const distanceA = room.controller.pos.getRangeTo(a.x, a.y);
                const distanceB = room.controller.pos.getRangeTo(b.x, b.y);
                return distanceA - distanceB;
              });
        }
    }



    return controllerSpots;
}

module.exports = fiefManager;
profiler.registerObject(fiefManager, 'fiefManager');
getControllerSpots = profiler.registerFN(getControllerSpots, 'getControllerSpots');
getExtensionMap = profiler.registerFN(getExtensionMap, 'getExtensionMap');
getTravelMatrix = profiler.registerFN(getTravelMatrix, 'getTravelMatrix');
getRefillMaps = profiler.registerFN(getRefillMaps, 'getRefillMaps');
sortMapBySetSize = profiler.registerFN(sortMapBySetSize, 'sortMapBySetSize');
getDomainRooms = profiler.registerFN(getDomainRooms, 'getDomainRooms');
manageResourceCollection = profiler.registerFN(manageResourceCollection, 'manageResourceCollection');
totalWares = profiler.registerFN(totalWares, 'totalWares');