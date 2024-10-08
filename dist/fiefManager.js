//const roomPlanner = require('roomPlanner');
const helper = require('functions.helper');
const fiefPlanner = require('fiefPlanner');
require('roomVisual');
const profiler = require('screeps-profiler');
const supplyDemand = require('supplyDemand');
const granary = require('granary');
const registry = require('registry');
const buildRole = require('role.builder');
const fiefManager = {
    run:function(room,fiefCreeps){
        let cpuStart = Game.cpu.getUsed();
        //Set Reference
        let restartFlag = false;
        let fief = Memory.kingdom.fiefs[room.name];
        let factory = room.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_FACTORY}})[0];
        let fiefHeap = global.heap[room.name];
        if(!fief.builders)fief.builders = [];
        if(!fief.rclTimes){
            fief.rclTimes = {tick:Game.time};
        }
        if(!fief.upgraders)fief.upgraders = [];
        //Check if mineral data set up at all. If not, create and assign mineral
        if(!fief.mineral) fief.mineral = {id:room.find(FIND_MINERALS)[0].id}
        // - Assignments -
        let roomBaddies = room.find(FIND_HOSTILE_CREEPS);
        let spawnQueue = fief.spawnQueue;
        let roomLevel = room.controller.level;
        if(!fief.rclTimes[roomLevel]) fief.rclTimes[roomLevel] = Game.time - fief.rclTimes.tick
        if(!fief.rclTimes['storage'] && room.storage) fief.rclTimes['storage'] = Game.time - fief.rclTimes.tick
        if(!fief.rampTarget) fief.rampTarget = 50000;
        let spawns = fief.spawns;
        let cSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        let starterCreeps = []
        let mySpawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.id);
        let storagePos = fief.roomPlan ? new RoomPosition(fief.roomPlan[4].storage[0].x,fief.roomPlan[4].storage[0].y,room.name) : null;
        let rampartMinimums = {
            4:50000,
            5:100000,
            6:200000,
            7:400000,
            8:800000
        }
        fief.spawns = mySpawns
        let [plannedNet,averageNet] = granary.getIncome(room.name);
        //Create harvest spot if none exists
        console.log(room.name,"income",plannedNet,averageNet)

        if(!fief.roomPlan || fief.roomPlan == 'null'){
            //restartFlag = true;
            let roomPlans = JSON.parse(RawMemory.segments[1]);
            if(roomPlans[room.name]){
                [fief.roomPlan, fief.rampartPlan] = roomPlans[room.name]
            }
            else if(global && global.heap && (!global.heap.fiefPlanner || !global.heap.fiefPlanner.stage ||global.heap.fiefPlanner.stage == 0)){
                fiefPlanner.getFiefPlan(room.name);
                console.log("Getting plan for room")
            }
            //fief.roomPlanLevel = room.controller.level;
            //console.log(`${room.name} has no room plan!`)
        }
        

        if(!fief.sources || !Object.keys(fief.sources).length){
            console.log("NO SOURCES")
            restartFlag = true;
            fief.sources = {}
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
                        let harvestSpot = mySpawn.pos.findClosestByPath(openPositions);
                        fief.sources[source.id] = {spotx:harvestSpot.x,spoty:harvestSpot.y,can:''};
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
            console.log("NO SPAWNS")
            //Sanity check for a support room
            if(!fief.support || room.controller.level > 1){
                let spawnSite = fief.roomPlan[1][STRUCTURE_SPAWN][0]
                let spotInfo = room.lookAt(spawnSite.x,spawnSite.y);
                let hasSpawn = spotInfo.find(s => s.structure && s.structure.structureType === STRUCTURE_CONTAINER);
                let hasConstructionSite = spotInfo.some(s => s.constructionSite);
                if(!hasSpawn && !hasConstructionSite){
                    console.log("SPAWNSITE",JSON.stringify(spawnSite))
                    let spawnName = helper.getName({isSpawn:true})+' Keep';
                    console.log("Spawnname",spawnName)
                    console.log("X",spawnSite.x)
                    console.log("Y",spawnSite.y)
                    let y = room.createConstructionSite(spawnSite.x,spawnSite.y,STRUCTURE_SPAWN,spawnName);
                    console.log(y)
                    return;
                }

            }
            else if (fief.support){
                if(!fief.settlers) fief.settlers = [];
                let liveSettlers = [];
                for(settler of fief.settlers){
                    //If settler is alive or waiting to spawn, add it to the live settler counter
                    if(Game.creeps[settler] || Memory.kingdom.fiefs[fief.support].spawnQueue[settler]){
                        liveSettlers.push(settler);
                    }
                }
                //Swap settler list for the list of confirmed living/spawning settlers
                fief.settlers = liveSettlers;
                //2 settlers per source for the moment. Spawn more if we need
                if(fief.settlers < (Object.keys(fief.sources).length * 2)){
                    let newName = 'Settler '+helper.getName()+' of House '+room.name;
                    Memory.kingdom.fiefs[fief.support].spawnQueue[newName] = {
                        sev:50,body:[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY], //Default body for now, can update later
                        memory:{role:'generalist',job:'remote',fief:room.name,homeRoom:room.name,targetRoom:room.name,preflight:false}}
                    fief.settlers.push(newName);
                }
    
                //Return as there's no room handling past this point until we get a spawn
                return;
            }

        }

        if(Game.time % 100 == 0 && fief.roomPlan && !cSites.length){
            //console.log("Checking for new constructions.")
            let cCount = 0;
            let plan = fief.roomPlan
            for(let rcl = 1;rcl <= roomLevel;rcl++){
                for(let building in plan[rcl]){
                    for(coordinate of plan[rcl][building]){
                        let spot = room.lookForAt(LOOK_STRUCTURES,coordinate.x,coordinate.y);
                        let spotSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,coordinate.x,coordinate.y);
                        let floor = room.lookForAt(LOOK_TERRAIN,coordinate.x,coordinate.y);
                        if((!spot.length || !spot.some(element => element.structureType == building)) && floor != 'wall' && !spotSite.length){
                            //If the structure is a spawn, name it
                            if(building == STRUCTURE_SPAWN){
                                let roomSpawns = room.find(FIND_MY_SPAWNS);
                                //See if it's our first spawn that needs to move
                                if(roomSpawns[0].name == "Origin Keep"){
                                    console.log("Origin spawn detected")
                                    //If we have storage and energy to build a new one
                                    if(room.storage && room.storage.store[RESOURCE_ENERGY] > 30000){
                                        console.log("Storage good")
                                        //If we have at least one builder with TTL to spare
                                        if(fiefCreeps.builder && fiefCreeps.builder.some(crp => crp.ticksToLive > 1000)){
                                            //Blow it up
                                            roomSpawns[0].destroy()
                                        }
                                        //If not, request a builder via hardspawns since this is only every 100 ticks
                                        else{
                                            if(!Memory.hardSpawns) Memory.hardSpawns = {};
                                            if(!Memory.hardSpawns[room.name]) Memory.hardSpawns[room.name] = [];
                                            Memory.hardSpawns[room.name].push({sev:45,hardSpawn:true,memory:{role:'builder',fief:room.name,status:'spawning',preflight:false}})
                                        }
                                    }
                                    continue;
                                }
                                let keepSpawn;
                                let manorSpawn;
                                let hallSpawn;
                                if(roomSpawns.length > 0){
                                    for(spawn of roomSpawns){
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
                                    console.log(room.name,"unable to name spawn, all types found")
                                }
    
                                let l = room.createConstructionSite(coordinate.x,coordinate.y,building,name)
                                cCount++;
                                //console.log("SITE1")
                                Memory.spawnBuild = l
                            }
                            //Else if it's a road we don't build until room level 3
                            else {
                                if(building != STRUCTURE_ROAD || roomLevel >= 3){
                                    room.createConstructionSite(coordinate.x,coordinate.y,building)
                                    cCount++;
                                }
                                
                                //console.log("SITE2",building,room.name,':',coordinate.x,coordinate.y)
                            }
                            
                        }
                    };
                }
            }
            //If no new sites, do further checks
            console.log("CCOUNT",cCount)
            if(cCount == 0){
                //If no source containers and no construction sites, make containers
                for(let source of Object.values(fief.sources)){
                    console.log(JSON.stringify(source))
                    if(!source.ca && room.storage){
                        console.log("Nocan")
                        let spotInfo = room.lookAt(source.spotx,source.spoty);
                        let hasCan = spotInfo.find(s => s.structure && s.structure.structureType === STRUCTURE_CONTAINER);
                        let hasConstructionSite = spotInfo.some(s => s.constructionSite);
                        if (!hasCan && !hasConstructionSite){
                            room.createConstructionSite(source.spotx,source.spoty,STRUCTURE_CONTAINER);
                        }
                        else if(hasCan){
                            source.can = hasCan.structure.id;
                        }
                    }
                }
            }

        }
        
        //Create room plan, spawns, and spawn queue if none exists, then return
        //




        
        if(!fief.spawns || !fief.spawns.length) {
            fief.spawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.id)
            restartFlag = true;
        };
        
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
                console.log("Before source! isFinite",JSON.stringify(fief.sources[x]))
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
            //console.log("Spawn Utilization for",Game.getObjectById(spawn).name+':\n',((totalSpawn / 3000) * 100).toFixed(2)+'%');
        });
        fief.combinedSpawnUse = combinedSpawnUse/spawns.length;
        //#region Room Operation
        //#endregion
        //console.log("Spawn use:",combinedSpawnUse)
        //Every 30 ticks add any scouted domain rooms to holdings
        if(Game.time % 30 == 0){
            //Get scouted domain rooms, exclude SK for now
            let domainRooms = getDomainRooms(room.name).filter(dRoom => !dRoom.scouted && dRoom.type != ROOM_SOURCE_KEEPER);
            for(let dRoom of domainRooms){
                if(!getScoutData(dRoom.roomName)) continue;
                //If scouted, add to holdings and mark scouted in the domain
                dRoom.scouted = true;
                if(!Memory.kingdom.holdings[dRoom.roomName]) Memory.kingdom.holdings[dRoom.roomName] = {standby:true,homeFief:room.name};
            }
        }


        
        //Check if we have enough harvesters by gathering total harvest strength from live creeps
        //let harvStrength = fiefCreeps['harvester'] && fiefCreeps['harvester'].reduce((sum,item) => sum+((item.body.getActiveBodyparts(WORK) * HARVEST_POWER)));

        //Add requests for dropped resources
        manageResourceCollection(room)

        //Spawn queue check every 3 ticks
        if(Game.time % 3 == 0){
            //-- Harvester --
            //Check each source for open space and harvester need
            let noHarvs = false;
            let targetSources = Object.keys(fief.sources).reduce((obj,key) =>{
                obj[key] = {harvs:0,power:0,ttlFlag:false};
                return obj;
            },{});
            if(fiefCreeps.harvester){
                fiefCreeps.harvester.forEach(creep =>{
                    creepSource = creep.memory.target;
                    targetSources[creepSource].harvs++;
                    targetSources[creepSource].power += creep.getActiveBodyparts(WORK) * HARVEST_POWER;
                    if(storagePos && creep.ticksToLive < storagePos.getRangeTo(Game.getObjectById(creepSource)) + (CREEP_SPAWN_TIME*creep.body.length) && !creep.memory.respawn){
                        targetSources[creepSource].ttlFlag = creep.id;

                    };
                })
            }
            else{
                noHarvs = true;
            }

            //For each source, see if we have enough harvest power or enough space for a new harvester
            Object.entries(fief.sources).forEach(([sourceID,source])=>{
                //If there's no room, or if we have enough harvest power, return

                if((source.openSpots <= targetSources[sourceID].harvs || targetSources[sourceID].power >= SOURCE_ENERGY_CAPACITY/ENERGY_REGEN_TIME) && !targetSources[sourceID].ttlFlag) return;

                //If not enough strength and we have room, order a new harvester. Higher sev if it's closest.
                let sev = noHarvs == true ? 80 : 55;
                if(source.closest) sev+= 1
                let opts = {sev:sev,memory:{role:'harvester',job:'energyHarvester',harvestSpot:{x:source.spotx,y:source.spoty,id:sourceID},fief:room.name,target:sourceID,status:'spawning',preflight:false}}
                if(targetSources[sourceID].ttlFlag) opts.respawn = targetSources[sourceID].ttlFlag
                //console.log("Adding harv to spawnQueue")
                registry.requestCreep(opts)
                
            });

            //-- Upgrader --
            const MAX_STARTERS = roomLevel >=2 ? 4 : 5;
            //Pre and post storage logic


            if(room.storage){
                if(Game.shard.name == 'shardSeason' && room.storage){
                    let scoreCans = room.find(FIND_SCORE_CONTAINERS);
                    if(scoreCans.length){
                        for(let can of scoreCans){
                            if(can.ticksToDecay < 100) continue;
                            addSupplyRequest(room,{type:'pickup',resourceType:RESOURCE_SCORE,amount:can.store.getUsedCapacity(RESOURCE_SCORE),targetID:can.id,international:false,priority:7})
                        }
                    }
                }
                let upgradersNeeded;
                if(room.storage.store[RESOURCE_ENERGY] < 50000){
                    upgradersNeeded = 0;
                }
                else{
                    upgradersNeeded = room.controller.level > 5 ? Math.floor(room.storage.store[RESOURCE_ENERGY]/200000) : Math.ceil(room.storage.store[RESOURCE_ENERGY]/100000);
                }
                if(upgradersNeeded > 0 && (!fiefCreeps.upgrader || fiefCreeps.upgrader.length < upgradersNeeded)){
                    registry.requestCreep({sev:35,memory:{role:'upgrader',fief:room.name,status:'spawning',preflight:false}})
                }
                let fortFlag = false;
                //Builder logic
                if(cSites.length){
                    //Split sites into ramparts and others
                    let [rampSites,buildings] = cSites.reduce((arr,site) => {
                        site.structureType == STRUCTURE_RAMPART ? arr[0].push(site) : arr[1].push(site);
                        return arr
                    },[[],[]]);
                    if(buildings.length && (!fiefCreeps.builder || !fiefCreeps.builder.some(crp => crp.memory.job != 'fortifier'))){
                        registry.requestCreep({sev:32,memory:{role:'builder',fief:room.name,status:'spawning',preflight:false}})
                    }
                    if(rampSites.length) fortFlag = true;
                }
                let hurtRamps = room.find(FIND_MY_STRUCTURES).filter(st => st.structureType == STRUCTURE_RAMPART && st.hits < fief.rampTarget)
                if(hurtRamps.length) fortFlag = true;
                //Don't repair if we're below energy
                if(fortFlag && room.storage && room.storage.store[RESOURCE_ENERGY] > 20000){
                    let forts = fiefCreeps.builder || [];
                    forts = forts.filter(crp => crp.memory.job == 'fortifier')
                    if(forts.length < 2){
                        registry.requestCreep({sev:31,memory:{role:'builder',job:'fortifier',fief:room.name,status:'spawning',preflight:false}})
                    }
                }              

            }
            //Don't need to check for harvesters because we use strict priorities now
            else{
                
                //If no upgraders(who are also builders at this stage), and we're below a default cap
                if(!fiefCreeps.upgrader){
                    //Make sure we're good on energy
                    if(plannedNet<=0 || averageNet<=0) return;
                    //If we passed all, request an upgrader
                    registry.requestCreep({sev:(!fiefCreeps.upgrader || fiefCreeps.upgrader.length) ? 35 : 50,memory:{role:'upgrader',job:'starterUpgrader',fief:room.name,status:'spawning',preflight:false}})
                }
                else if(plannedNet > 0 && averageNet > 0){
                    //Make sure they're all doing something. If so we can justify another
                    let workingUps = fiefCreeps.upgrader.filter(up => up.store.getUsedCapacity() > 0);
                    if(workingUps.length == fiefCreeps.upgrader.length){
                        registry.requestCreep({sev:35,memory:{role:'upgrader',job:'starterUpgrader',fief:room.name,status:'spawning',preflight:false}})
                    }

                }
            }
        }

        //Non-spawn room operations for after storage
        if(room.storage){
            //If no construction sites and positive income, start raising the ramp target as long as they're all at the last one
            if(Game.time % (3000) == 0){
                //If we're below the minimum for our RCL, bump it up
                fief.rampTarget = Math.max(fief.rampTarget,rampartMinimums[room.controller.level])
                if(averageNet > 0 || room.storage.store[RESOURCE_ENERGY] > 100000){
                    let ramps = room.find(FIND_MY_STRUCTURES).filter(struct => struct.structureType == STRUCTURE_RAMPART && struct.hits < fief.rampTarget);
                    //Grow by 10% if there are none
                    if(!ramps.length) fief.rampTarget += fief.rampTarget*0.1;
                }
            }

        }
        if(false && room.storage && room.storage.store[RESOURCE_ENERGY] > 5000){

            roadReady = true;
            // - Upgrader Check -
            //Check for upgrader can
            if(!Game.getObjectById(fief.upCan)){
                //console.log("NO UPCAN IN",room.name)
                //If no can, see if it was built
                let spotStruct = room.lookForAt(LOOK_STRUCTURES,fief.upCanx,fief.upCany);
                let spotSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,fief.upCanx,fief.upCany);
                spotStruct = spotStruct.filter(x => x.structureType == STRUCTURE_CONTAINER)
                //console.log(spotStruct.length)
                if(!spotStruct.length && !spotSite.length){
                    //If not built, set cSite
                    room.createConstructionSite(fief.upCanx,fief.upCany,STRUCTURE_CONTAINER);
                    //console.log("SITE4",room.name)
                }else if(spotStruct[0]){
                    //If built, record ID
                    fief.upCan = spotStruct[0].id;
                }
            //If can exists, confirm living/queued upgraders and request as needed
            } else{
                let liveUpgraders = [];
                //console.log(room.name,fief.upCan)
                // if(!Game.creeps[fief.upgrader] && !spawnQueue[fief.upgrader] && room.storage.store[RESOURCE_ENERGY] > 8000)
                //Make upgrader array if needed
                if(!fief.upgraders) fief.upgraders = [];
                //Basic logic, upgrader for every x energy
                let upgradersNeeded = Math.ceil(room.storage.store[RESOURCE_ENERGY]/30000);
                //If level 8, no upgraders except a periodic custom one
                //If we're dead empty on energy, no upgraders   
                if(room.storage.store[RESOURCE_ENERGY] < 6000){
                    upgradersNeeded = 0;
                }
                //If we can make massive upgraders, limit them again
                else if(room.controller.level >= 7){
                    //With larger upgraders, we need a larger energy safety check
                    if(room.storage.store[RESOURCE_ENERGY] > 15000){
                        upgradersNeeded = Math.ceil(room.storage.store[RESOURCE_ENERGY]/300000);
                    }
                    else{
                        upgradersNeeded = 0;
                    }
                }
                //No more than 4
                else if(upgradersNeeded >4) upgradersNeeded = 4;
                fief.upgraders.forEach(up => {
                    //Track the live ones
                    if ( (Game.creeps[up] && (Game.creeps[up].spawning || Game.creeps[up].ticksToLive > (Game.creeps[up].body.length * 3)) )     || spawnQueue[up] ){
                        liveUpgraders.push(up)
                    }
                });
                //Request if needed
                if(liveUpgraders.length < upgradersNeeded && roomLevel != 8){
                    //console.log('UP ',liveUpgraders.length,' Need ',upgradersNeeded)
                    let newName = 'Scribe '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:getSev('upgrader',room.name),body:getBody('upgrader',room.name),
                        memory:{role:'upgrader',job:'upgrader',homeRoom:room.name,preflight:false}}
                    liveUpgraders.push(newName);
                }
                if(roomLevel == 8){
                    if(room.controller.ticksToDowngrade <60000){
                        upgradersNeeded = 1;
                        if(liveUpgraders.length < upgradersNeeded){
                            //console.log('UP ',liveUpgraders.length,' Need ',upgradersNeeded)
                            let newName = 'Scribe '+helper.getName()+' of House '+room.name;
                            spawnQueue[newName] = {
                                sev:getSev('upgrader',room.name),body:[WORK,CARRY,MOVE],
                                memory:{role:'upgrader',job:'upgrader',homeRoom:room.name,preflight:false}}
                            liveUpgraders.push(newName);
                        }
                    }
                }
                //console.log(room.name,' has ',liveUpgraders.length,' upgraders. Needs ',upgradersNeeded)
                fief.upgraders = liveUpgraders;

            }

            // - Builder Check -
            //Check for cSites
            //If there are sites, spawn builder
            if((!Game.creeps[fief.builder] && !spawnQueue[fief.builder]) && cSites.length){
                let newName = 'Mason '+helper.getName()+' of House '+room.name;
                spawnQueue[newName] = {
                    sev:getSev('homeBuilder',room.name),body:getBody('builder',room.name,'homeBuilder'),
                    memory:{role:'builder',job:'homeBuilder',homeRoom:room.name,preflight:false}}
                fief.builder = newName;
            }
        } 

        //RCL 5 checks - Link control
        if(false && roomLevel >= 5){
            //Get the links set up if they aren't
            
            //Links are set up manually for now. Write automated link placement later.
            //Link memory structure: fief.links = {coreLink:linkID,upLink:linkID,remoteLink:linkID}
            //Consider making remoteLink a list of remote links

            //Detect links
            if(!fief.links.coreLink){
                let coreCheck = room.lookForAt(LOOK_STRUCTURES,room.storage.pos.x,room.storage.pos.y-1)[0]
                if(coreCheck){
                    fief.links.coreLink = coreCheck.id;
                }
            }
            if(!fief.links.upLink){
                let upCheck = room.controller.pos.findInRange(FIND_MY_STRUCTURES,2, {
                    filter: { structureType: STRUCTURE_LINK }
                })[0];
                if(upCheck){
                    fief.links.upLink = upCheck.id;
                }
            }

            //Set up an array of sources test
            
            //If the link arrays don't exist, create them
            if(!fief.links.sourceLinks) fief.links.sourceLinks = [];
            if(!fief.links.remoteLinks) fief.links.remoteLinks = [];
            

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
                        if(sourceCheck && sourceCheck.id != fief.links.coreLink && sourceCheck.id != fief.links.upLink){
                            fief.sources[source].link = sourceCheck.id;
                            //Only add if not already in the list, in case it's shared
                            if(!fief.links.sourceLinks.includes(sourceCheck.id)) fief.links.sourceLinks.push(sourceCheck.id);
                        }
                    }
                    
                    
                })
            }
            //Link transfer logic
            let upLink = Game.getObjectById(fief.links.upLink);
            let coreLink = Game.getObjectById(fief.links.coreLink);
            let remoteLinks = fief.links.remoteLinks.map(id => Game.getObjectById(id));
            let manager = Game.creeps[fief.manager]
            let managerBusy = false;
            let coreFlag = false;
            
            //Periodic check for remote links needed, not sure how best to do it
            //Find links close to room edge
            if(Game.time % 20 == 0){
                let totalLinks = 0;
                if(fief.links.coreLink) totalLinks++;
                if(fief.links.upLink) totalLinks++;
                totalLinks += fief.links.sourceLinks.length;
                totalLinks += fief.links.remoteLinks.length;
                //If total links are less than the room level allows, check for remotes
                if(totalLinks < CONTROLLER_STRUCTURES[STRUCTURE_LINK][roomLevel]){
                    //If it's within 3 spaces of a room edge, and isn't assigned to another slot, it's a remote link
                    let roomLinks = room.find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_LINK }
                    });
                    roomLinks.forEach(link =>{
                        //If link is at the edge of the room
                        if(link.pos.x <= 3 || link.pos.x >= 46 || link.pos.y <= 3 || link.pos.y >= 46){
                            //If not matching any assigned link
                            if(link.id != fief.links.coreLink && link.id != fief.links.upLink && !fief.links.sourceLinks.includes(link.id) && !fief.links.remoteLinks.includes(link.id)){
                                //Add ID to links in memory
                                fief.links.remoteLinks.push(link.id)
                                //Add link to current remote links array
                                roomLinks.push(link)
                            }
                        }
                    })
                };
                //If we don't have a queue for all the remote links, create them
                if(!global.heap.remoteQueues) global.heap.remoteQueues = {};
                if(!global.heap.remoteQueues[room.name]) global.heap.remoteQueues[room.name] = {};
                let queues = global.heap.remoteQueues[room.name];
                if(fief.links.remoteLinks.length && Object.keys(queues).length != fief.links.remoteLinks.length){
                    remoteLinks.forEach(link =>{
                        //Create queue if missing
                        if(!queues[link.id]){
                            //Queues parent object holds the actual queue as well as the distance to core link to calculate cooldown
                            //The actual queue object holds the name of the creep queued as the key and the total energy dropoff as the value 
                            queues[link.id] = {queue:{},distance:link.pos.getRangeTo(Game.getObjectById(fief.links.coreLink))}
                        }
                    })
                }

            }
            
            
            //Set up manager spot if we have established at least a core link
            if(false && coreLink && !fief.managerSpot){
                newPos = roomPlanner.getManagerPos(room);
                fief.managerSpot = {x:newPos.x,y:newPos.y}
            }

           
            //If uplink is ready to receive
            if(false &&upLink && upLink.store[RESOURCE_ENERGY] == 0){
                //Prioritize remote link
                if(remoteLinks.length){
                    for(link of remoteLinks){
                        if(link && link.store[RESOURCE_ENERGY] > 0){
                            link.transferEnergy(upLink);
                            break;
                        }
                    }
                    
                    
                }
                    coreFlag = false;
                    //If remote isn't good, check source links
                    fief.links.sourceLinks.forEach(linkID =>{
                        let link = Game.getObjectById(linkID);
    
                        //Check to see if we can transfer
                        if(link.store[RESOURCE_ENERGY] == 800){
                            link.transferEnergy(upLink);
                            coreFlag = true;
                        }
                    });
                    //Else if none, get core link to transfer via manager
                    if(!coreFlag){
                        if(coreLink.store[RESOURCE_ENERGY] == 800){
                            coreLink.transferEnergy(upLink);
                        }
                        else if(manager){
                            //if(room.name=='E19N11')console.log('Manager Coreflag')
                            //If coreLink doesn't have the energy, have manager transfer it or pull if empty
                            managerBusy = true;
                            if(manager.store.getUsedCapacity() == 0){
                                //if(room.name=='E19N11')console.log('Manager flag1')
                                manager.withdraw(room.storage,RESOURCE_ENERGY);
                            }
                            else{
                                if(manager.store[RESOURCE_ENERGY] == 0){
                                    //if(room.name=='E19N11')console.log('Manager flag2')
                                    //if(room.name=='E19N11')console.log(JSON.stringify(creep.store))
                                    for(const resourceType in manager.store) {
                                        //console.log(resourceType)
                                        let x =manager.transfer(room.storage,resourceType);
                                        //console.log(x)
                                        break;
                                    }
                                }
                                else{
                                    //if(room.name=='E19N11')console.log('Manager flag3')
                                    manager.transfer(coreLink,RESOURCE_ENERGY);
                                }
                                
                            }
                        }
                    }
                

                
                
            }
            //Else if uplink isn't ready
            else if(false){
                //Flag if we need to empty coreLink
                fief.links.sourceLinks.forEach(linkID =>{
                    let link = Game.getObjectById(linkID);

                    //Check to see if we need to transfer
                    if(link.store[RESOURCE_ENERGY] == 800){
                        coreFlag = true;
                        if(coreLink.store[RESOURCE_ENERGY] == 0){
                            link.transferEnergy(coreLink);
                        }
                        else if(manager){
                            if(room.name=='E11N12')console.log('Manager EmptyCorelink')
                            managerBusy = true;
                            //Need to empty core link.
                            if(manager.store.getUsedCapacity() == 0){
                                manager.withdraw(coreLink,RESOURCE_ENERGY);
                            }else if(room.storage.store.getFreeCapacity() != 0){
                                for(const resourceType in manager.store) {
                                    manager.transfer(room.storage,resourceType);
                                    break;
                                }
                            }else{
                                for(const resourceType in manager.store) {
                                    manager.transfer(room.terminal,resourceType);
                                    break;
                                }
                            }

                        }
                    }
                });

                //If still no core flag, check remotelink.
                if(!coreFlag && remoteLinks.length){
                    for(link of remoteLinks){
                        if(link.store[RESOURCE_ENERGY] > 0){
                            if(coreLink.store[RESOURCE_ENERGY] == 0){
                                link.transferEnergy(coreLink);
                                break;
                            }
                            else{
                                if(manager){
                                    managerBusy = true;
                                    if(manager.store.getUsedCapacity() == 0){
                                        manager.withdraw(coreLink,RESOURCE_ENERGY);
                                        break;
                                        
                                    }
                                    else{
                                        for(const resourceType in manager.store) {
                                            manager.transfer(room.storage,resourceType);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

            }

            //Transfer and logistics check
            if(false && manager && !managerBusy){
                //Primary amount in storage
                let energyMinimum = 50000;
                let energyTermMax = 200000;
                if(room.storage && room.terminal){
                    //If a growing room, raise the minimum
                    if(roomLevel == 6){
                        energyMinimum = 700000;
                    }

                    //If we have spare energy, dump to terminal
                    if(room.storage.store[RESOURCE_ENERGY] > energyMinimum && room.terminal.store[RESOURCE_ENERGY] <= energyTermMax){
                        managerBusy = true;
                        if(room.name=='E11N12')console.log('Manager dump terminal')
                        if(manager.store.getUsedCapacity() == 0){
                            manager.withdraw(room.storage,RESOURCE_ENERGY);
                        }else{
                            for(const resourceType in manager.store) {
                                manager.transfer(room.terminal,resourceType);
                                break;
                            }
                        }
                    }
                    //If we have reserve energy in terminal and storage gets low, or terminal full, swap. Higher swap point for rooms needing support to grow to 7
                    //1000 buffer on max to stop nonstop swaping back and forth
                    else if(room.terminal.store[RESOURCE_ENERGY] > energyTermMax+1000 && room.storage.store.getFreeCapacity() > 0 ||(((room.storage.store[RESOURCE_ENERGY] < 400000 && roomLevel == 6) || room.storage.store[RESOURCE_ENERGY] < energyMinimum) && room.terminal.store[RESOURCE_ENERGY])){
                        managerBusy = true;
                        if(room.name=='E11N12')console.log('Manager Swap')
                        if(manager.store.getUsedCapacity() == 0){
                            manager.withdraw(room.terminal,RESOURCE_ENERGY);
                        }else{
                            for(const resourceType in manager.store) {
                                manager.transfer(room.storage,resourceType);
                                break;
                            }
                        }
                    }
                    //Else do mineral swap
                    else{
                        for(each of [RESOURCE_UTRIUM,RESOURCE_HYDROGEN,RESOURCE_OXYGEN]){
                            if(room.storage.store[each] > 0){
                                if(room.name=='E11N12')console.log('Manager Mineral')
                                managerBusy = true;
                                if(manager.store.getUsedCapacity() == 0){
                                    manager.withdraw(room.storage,each);
                                }else{
                                    for(const resourceType in manager.store) {
                                        if(room.name=='E11N12')console.log('Manager Mineral Transfer')
                                        let x =manager.transfer(room.terminal,resourceType);
                                        //if(room.name=='E19N11')console.log(x)
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            //If manager is busy, he stays put
            if(manager && !managerBusy){
                manager.memory.stay = false;
                for(const resourceType in manager.store) {
                    manager.transfer(room.storage,resourceType);
                    break;
                }
            }else if(manager){
                manager.memory.stay = true;
            }

            //Labs check -- SEASONAL, REMOVE AND REPLACE WITH REAL LOGIC
            let goLabs = false;
            if(fief.labTargets){
                Object.values(fief.labTargets).forEach(each =>{
                    if(room.storage.store[each]>5 || room.terminal.store[each]>5){
                        goLabs = true;
                    }
                })
            }
            if(fief.labOutput && goLabs){
                //Run reactions
                fief.labOutput.forEach(lab =>{
                    if(Game.getObjectById(lab).cooldown == 0){
                        let inputLabs = Object.keys(fief.labTargets);
                        let x = Game.getObjectById(lab).runReaction(Game.getObjectById(inputLabs[0]),Game.getObjectById(inputLabs[1]));
                    }
                })
                //Spawn alchemist
                if(!Game.creeps[fief.alchemist] && !spawnQueue[fief.alchemist]){
                    let newName ='Alchemist '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:10,body:[MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY],
                        memory:{role:'diver',job:'labs',fief:room.name,preflight:false}}
                    fief.alchemist = newName;
                }
            }
            else if(fief.labTargets && !fief.labOutput){
                let targets = Object.keys(fief.labTargets);
                let outLabs = room.find(FIND_MY_STRUCTURES,{filter: (structure) => {
                    return structure.structureType == STRUCTURE_LAB && !targets.includes(structure.id);
                }}).map(lab => lab.id);
                fief.labOutput = outLabs;
            }

            

            //if(room.name=='E19N11')console.log(managerBusy)





            
            //Periodic RCL5+ Check
            if(false && Game.time % 70 == 0){
                //Linked harvester spots should destroy their cans
                fiefSources.forEach(source =>{
                    let thisSource = fief.sources[source]
                    //If we have both a link and can registered
                    if(thisSource.link && thisSource.can){
                        //Double check they actually both exist. If link exists, see if can is there. If so, destroy. Otherwise just remove the assignment.
                        if(Game.getObjectById(thisSource.link)){
                            if(Game.getObjectById(thisSource.can)){
                                Game.getObjectById(thisSource.can).destroy();
                                delete thisSource.can
                            }
                            else{
                                delete thisSource.can
                            }
                        }
                    }
                })
            }
            


        }
        //RCL 6 checks
        if(false && roomLevel >= 6){
            let mineMineral = false;
            let mineral = Game.getObjectById(fief.mineral.id);
            let mineralTotal = 0;

            let mineralGoal = 0;

            /*switch(mineral.mineralType){
                case RESOURCE_UTRIUM:
                    mineralGoal = 100000;
                    break;
                case RESOURCE_HYDROGEN:
                    mineralGoal = 100000;
                    break;
                case RESOURCE_ZYNTHIUM:
                    mineralGoal = 50000;
                    break;
                case RESOURCE_OXYGEN:
                    mineralGoal = 130000;
                    break;
                default:
                    mineralGoal = 50000;
            }*/


            //Add total mineral mined
            if(room.storage){
                mineralTotal += room.storage.store[mineral.mineralType];
            }
            if(room.terminal){
                mineralTotal += room.terminal.store[mineral.mineralType];
            }

            //If total mined is less than needed, mine more
            if(mineralTotal < mineralGoal){
                mineMineral = true;
            }
            //Need more logic for whether we actually want the mineral. For now, assume we do.
            let exFind = room.lookForAt(LOOK_STRUCTURES,mineral)
            let exSpot = exFind.filter(structure => structure.structureType === STRUCTURE_EXTRACTOR)[0]
            //If no ongoing construction and no extractor, build an extractor
            if(!cSites.length && !exSpot){
                //console.log("NOEX")
                room.createConstructionSite(mineral.pos.x,mineral.pos.y,STRUCTURE_EXTRACTOR);
            }
            //Check if we need to find a spot and can

            
            if(false && !fief.mineral.can){
                //Can only build once we have a free can, so check sources.
                let freeCan = false;
                fiefSources.forEach(source =>{
                    let thisSource = fief.sources[source];
                    //If link and no can, we good
                    if(thisSource.link && !thisSource.can) freeCan = true;
                });
                //console.log("FREE",freeCan)
                //If there's a free can, find a spot and build
                if(freeCan){
                    //If no path, get one and assign canspot to mineral.
                    if(!fief.paths.mineral){
                        fief.paths.mineral = PathFinder.search(room.storage.pos,{pos:Game.getObjectById(fief.mineral.id).pos,range:1},{
                            plainCost: 10,
                            swampCost: 11,
                            maxOps:6000,
                            roomCallback: function(roomName) {
                              let room = Game.rooms[roomName];
                              //Use our costmatrix because we're staying in the room.
                              let costs;
                              if(Memory.kingdom.fiefs[roomName]){
                                costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                              }else{
                                costs = new PathFinder.CostMatrix
                              }
                              if (room){
                                room.find(FIND_STRUCTURES).forEach(function(struct) {
                                    if (struct.structureType === STRUCTURE_ROAD) {
                                      costs.set(struct.pos.x, struct.pos.y, 1);
                                    }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                        (struct.structureType !== STRUCTURE_RAMPART ||
                                         !struct.my)) {
                                    // Can't walk through non-walkable buildings
                                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                                    }
                                  });
                              }else{
                                return;
                              }
                              return costs;
                            },
                        }).path;
                        //Update room cost matrix with new roads
                        let cm = PathFinder.CostMatrix.deserialize(fief.costMatrix)
                        fief.paths.mineral.forEach(spot =>{
                            //Double check to make sure it's in our room, always
                            if(spot.roomName == room.name){
                                cm.set(spot.x,spot.y,1)
                                
                            }
                            
                        });
                        fief.costMatrix = cm.serialize();
                        fief.mineral.spot = fief.paths.mineral[fief.paths.mineral.length-1]
                    }
                    //Check if a can already exists. If not, see if we're building one
                    //If we aren't building a can already, set a cSite
                    let canFind = room.lookForAt(LOOK_STRUCTURES,fief.mineral.spot.x,fief.mineral.spot.y)
                    let canSpot = canFind.filter(structure => structure.structureType === STRUCTURE_CONTAINER)[0]
                    let canSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,fief.mineral.spot.x,fief.mineral.spot.y)[0]
                    if(canSpot){
                        fief.mineral.can = canSpot.id;
                    }
                    //Only build if we have few enough cSites
                    else if(!canSite && cSites.length < 8){
                        room.createConstructionSite(fief.mineral.spot.x,fief.mineral.spot.y,STRUCTURE_CONTAINER);
                    }
                }
            }

            //If we have an extractor, can, and mineral is ready to be mined and wanted. Spawn creeps for it
            //Mess with this when one is regenerating so I know if I actually need all these
            else if(mineMineral && exSpot && mineral && mineral.mineralAmount > 0){
                
                //Spawn worker to go harvest, porter to haul
                if(!Game.creeps[fief.mineral['harvester']] && !spawnQueue[fief.mineral['harvester']]){
                    let newName = 'Gemcutter '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:getSev('mineralHarvester',room.name),body:getBody('harvester',room.name,'mineralHarvester'),
                        memory:{role:'harvester',job:'mineralHarvester',fief:room.name,homeRoom:room.name,target:fief.mineral.id,preflight:false}}
                    fief.mineral['harvester'] = newName;
                }
                if(!Game.creeps[fief.mineral['hauler']] && !spawnQueue[fief.mineral['hauler']]){
                    if(fief.mineral.can){
                        let newName ='Porter '+helper.getName()+' of House '+room.name;
                        spawnQueue[newName] = {
                            sev:getSev('mineralHauler',room.name),body:getBody('hauler',room.name,'mineralHauler',mineral.id),
                            memory:{role:'hauler',job:'mineralHauler',source:fief.mineral.id,preflight:false}}
                        fief.mineral['hauler'] = newName;
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
        if(roomBaddies.some(creep => (!helper.isScout(creep)&& (!Memory.diplomacy.allies.includes(creep.owner.username)) || (creep.pos.getRangeTo(room.controller == 2) && helper.isScout(creep))))){
            //Create defend mission if one isn't already active
            //if(!Memory.kingdom.missions.defend[room.name]){
                //missionManager.createMission('defend',room.name,{hostileCreeps:roomBaddies.filter(creep =>{!Memory.diplomacy.allies.includes(creep.owner.username)})})
            //}
        }

        //If we have storage levels and safemode is over or low, run through rampart check every so often
        if(Game.time % 200 == 0 && room.storage && room.storage.store[RESOURCE_ENERGY] > 20000 && (!room.controller.safeMode || room.controller.safeMode < 3000)){
            if(fief.rampartPlan){
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


        towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
    for(let tower of towers) {
        var damagedStructures = tower.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.hits < structure.hitsMax*0.8 && (structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART))
        });

        var damagedCreeps = tower.room.find(FIND_MY_CREEPS, {
            filter: (creep) => (creep.hits < creep.hitsMax)
        });
        
        damagedStructures.sort((a, b) => a.hits - b.hits);
        damagedCreeps.sort((a, b) => a.hits - b.hits);
        //console.log(room.name)
        
        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS,{filter:(creep) => (!Memory.diplomacy.allies.includes(creep.owner.username))})

        if (closestHostile != null && closestHostile != undefined) {
                //console.log(closestHostile)
                tower.attack(closestHostile);
        }
        else if(tower.energy > 400 || !closestHostile){
            if (damagedCreeps.length > 0){
                tower.heal(damagedCreeps[0])
            }
            else if (damagedStructures.length > 0) {
                tower.repair(damagedStructures[0]);
            }
        }
    }

    //Guard
    if(false && towers.length == 0 && roomBaddies.length > 0 && (!Game.creeps[fief.guard])){
        let newName = 'Centurion '+helper.getName()+' of House '+room.name;
        spawnQueue[newName] = {
            sev:getSev('guard',room.name),body:getBody('guard',room.name,'guard'),
            memory:{role:'guard',job:'guard',fief:room.name,targetRoom:'None',preflight:false}};
            fief.guard = newName
    }

        

        let cm = PathFinder.CostMatrix.deserialize(fief.costMatrix);
        /*for(let x=0;x<50;x++){
            for(let y=0;y<50;y++){
                room.visual.text(cm.get(x,y),x,y+0.25)
            }
        }*/

        //Return data for kingdomStatus
        let storageLevel;
        if(room.storage){
            storageLevel = room.storage.store.getUsedCapacity();
        }
        let totalCreeps = 0;
        if(fiefCreeps && fiefCreeps.length) totalCreeps = fiefCreeps.length;
        return {
            roomLevel:roomLevel,
            cSites: cSites.length,
            wares: totalWares(room),
            totalCreeps: totalCreeps,
            fiefCreeps: fiefCreeps,
            hostileCreeps: roomBaddies,
            controllerProgress: room.controller.progress,
            safeMode: room.controller.safeMode,
            spawnUse: spawnUse,
            cpuUsed: (Game.cpu.getUsed() - cpuStart).toFixed(2),
            //spawnQueue: spawnQueue,
            storageLevel: storageLevel
        };
        

    }
};

module.exports = fiefManager;
profiler.registerObject(fiefManager, 'fiefManager');



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

function totalWares(room) {
    let totalResources = {};

    // Sum resources in storage
    if (room.storage) {
        for (const resourceType in room.storage.store) {
            if (room.storage.store.hasOwnProperty(resourceType)) {
                totalResources[resourceType] = (totalResources[resourceType] || 0) + room.storage.store[resourceType];
            }
        }
    }

    // Sum resources in terminal
    if (room.terminal) {
        for (const resourceType in room.terminal.store) {
            if (room.terminal.store.hasOwnProperty(resourceType)) {
                totalResources[resourceType] = (totalResources[resourceType] || 0) + room.terminal.store[resourceType];
            }
        }
    }

    //Add room mineral if not already there
    let mineral = Game.getObjectById(Memory.kingdom.fiefs[room.name].mineral.id);
    if(!totalResources[mineral.mineralType]){
        totalResources[mineral.mineralType] = 0;
    }
    return totalResources;
}

function manageResourceCollection(room) {
    //Retrieve all dropped resources in the room
    const droppedResources = room.find(FIND_DROPPED_RESOURCES);
    const droppedTombstones = room.find(FIND_TOMBSTONES);
    //Retrieve current tasks to check against
    droppedResources.forEach(resource => {
        const { id, amount, resourceType } = resource;
        //Check if this resource is already targeted by an existing task
        if(resourceType==RESOURCE_ENERGY && amount<50) return

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

    droppedTombstones.forEach(stone =>{
        Object.entries(stone.store).forEach(([resource,amount]) => {
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
        if(source.can && Game.getObjectById(source.can).store.getUsedCapacity() > 100) cans.push(source.can)
    }
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
    if(Memory.kingdom.fiefs[fief].domain) return Memory.kingdom.fiefs[fief].domain;
    //BFS for rooms in range
    const MAX_RANGE = 3;
    let queue = [{roomName: fief, depth: 0}];
    let visited = new Set();
    let domainRooms = [];
    console.log("Starting domain search")
    
    while (queue.length > 0){
        let { roomName, depth } = queue.shift();
        if(visited.has(roomName)) continue;
        console.log(`Visiting ${roomName} at depth ${depth}`)
        //If we're within range, save the room
        if(depth <= MAX_RANGE) domainRooms.push({roomName:roomName,depth:depth});

        //If we're at max range, continue. Otherwise add neighbors
        if(depth == MAX_RANGE) continue;
        console.log(`Depth is not at max of ${MAX_RANGE}, adding neighbors`)
        let exits = Game.map.describeExits(roomName);
        console.log("EXITS:")
        console.log(JSON.stringify(exits))
        for(let exitRoom of Object.values(exits)){
            if(!visited.has(exitRoom)){
                queue.push({roomName:exitRoom,depth:depth+1});
            }
        }
        
    }
    let validRooms = []
    //Dump highways and crossroads, then record the rest
    for(let thisRoom of domainRooms){
        let type = describeRoom(thisRoom.roomName);
        if(type == ROOM_HIGHWAY || type == ROOM_CROSSROAD || thisRoom.roomName == fief) continue;
        validRooms.push({roomName:thisRoom.roomName,depth:thisRoom.depth,scouted:false,type:type})
    }
    Memory.kingdom.fiefs[fief].domain = validRooms;
    return validRooms;
}
    /*let range = 3;
    //Check if already calculated
    if(Memory.kingdom.fiefs[fief].domain) return Memory.kingdom.fiefs[fief].domain;

    //Otherwise, calculate them, then save and return
    const match = fief.match(/([EW])(\d+)([NS])(\d+)/);
    const horizDir = match[1];
    const horizNum = parseInt(match[2], 10);
    const vertDir = match[3];
    const vertNum = parseInt(match[4], 10);

    const rooms = [];

    for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {

            const newHorizNum = horizNum + dx;
            const newVertNum = vertNum + dy;

            let newHorizDir = horizDir;
            let effectiveHorizNum = newHorizNum;
            if (newHorizNum < 0) {
                newHorizDir = horizDir === 'E' ? 'W' : 'E';
                effectiveHorizNum = Math.abs(newHorizNum) - 1;
            }

            let newVertDir = vertDir;
            let effectiveVertNum = newVertNum;
            if (newVertNum < 0) {
                newVertDir = vertDir === 'N' ? 'S' : 'N';
                effectiveVertNum = Math.abs(newVertNum) - 1;
            }

            const newRoomName = `${newHorizDir}${effectiveHorizNum}${newVertDir}${effectiveVertNum}`;
            rooms.push(newRoomName);
        }
    }*/