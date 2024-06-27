//const roomPlanner = require('roomPlanner');
const helper = require('functions.helper');
const fiefPlanner = require('fiefPlanner');
const roleStarters = require('role.starters');
require('roomVisual');
const profiler = require('screeps-profiler');
const missionManager = require('missionManager');
const supplyDemand = require('supplyDemand');
const fiefManager = {
    run:function(room,fiefCreeps){
        let cpuStart = Game.cpu.getUsed();
        //Set Reference
        let restartFlag = false;
        let fief = Memory.kingdom.fiefs[room.name];
        let factory = room.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_FACTORY}})[0];
        let fiefHeap = global.heap[room.name];
        if(!fief.builders)fief.builders = [];
        if(!fief.upgraders)fief.upgraders = [];
        //Check if mineral data set up at all. If not, create and assign mineral
        if(!fief.mineral) fief.mineral = {id:room.find(FIND_MINERALS)[0].id}
        // - Assignments -
        let roomBaddies = room.find(FIND_HOSTILE_CREEPS);
        let spawnQueue = fief.spawnQueue;
        let roomLevel = room.controller.level;

        let spawns = fief.spawns;
        let cSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        let starterCreeps = []
        let mySpawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.id);
        let roadReady = false;
        let swampNeed = false;
        fief.spawns = mySpawns
        let stage2 = (room.energyCapacityAvailable == 550);
        let stage3 = (room.energyCapacityAvailable == 800);
        let stage4;
        if(room.storage) stage4 = true;
        //SEASONAL, maybe keep
        //List of buildings we don't want made while rushing eco
        let nonEco = [
            STRUCTURE_LAB,
            STRUCTURE_TERMINAL,
            STRUCTURE_OBSERVER,
            STRUCTURE_NUKER,
            STRUCTURE_POWER_SPAWN,
            STRUCTURE_FACTORY
        ];

        //Create harvest spot if none exists
        if(!fief.sources || !fief.sources.length){
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
                    //If we don't have a spawn, just assign whatever
                    if(!spawns ||!spawns.length){
                        let harvestSpot = openSpots[0];
                        fief.sources[source.id] = {spotx:harvestSpot.x,spoty:harvestSpot.y,can:'',harvester:'',hauler:''};
                    }
                    //Else get the closest to spawn
                    else{
                        //Convert spots to room positions
                        let openPositions = [];
                        openSpots.forEach(every =>{
                            openPositions.push(new RoomPosition(every.x,every.y,room.name));
                        });
                        let mySpawn = Game.getObjectById(spawns[0]);
                        let harvestSpot = mySpawn.pos.findClosestByPath(openPositions);
                        fief.sources[source.id] = {spotx:harvestSpot.x,spoty:harvestSpot.y,can:'',harvester:'',hauler:''};
                    }
                    //Record total open spots for baby harvs
                    fief.sources[source.id].openSpots = openSpots.length;
                }
            })
        }

        //If no spawns in the room, check for settlers and request from our support room if needed
        if(!spawns || !spawns.length){
            //Sanity check for a support room
            if(!fief.support){
                console.log(room.name,'has no supporting fief to provide settlers');
                return;
            }
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

        if(Game.time % 100 == 0 && fief.roomPlan && !cSites.length){
            console.log("Checking for new constructions.")
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
                                    name = helper.getName(3)+' Keep';
                                }
                                else if(!manorSpawn){
                                    name = helper.getName(3)+' Manor';
                                }else if(!hallSpawn){
                                    name = helper.getName(3)+' Hall';
                                }else{
                                    console.log(room.name,"unable to name spawn, all types found")
                                }
    
                                let l = room.createConstructionSite(coordinate.x,coordinate.y,building,name)
                                //console.log("SITE1")
                                Memory.spawnBuild = l
                            }
                            else{
                                room.createConstructionSite(coordinate.x,coordinate.y,building)
                                //console.log("SITE2",building,room.name,':',coordinate.x,coordinate.y)
                            }
                            
                        }
                    };
                }
            }
            

            //Swamp road check
            
            if((stage3 || stage4) && fief.paths){
                Object.keys(fief.paths).forEach(path => {
                    if(path != 'closest'){
                        Object.keys(fief.paths[path]).forEach(spot => {
                            //console.log(fief.paths[path][spot])
                            let roadCheck = room.lookForAt(LOOK_STRUCTURES,fief.paths[path][spot].x,fief.paths[path][spot].y)
                            let siteCheck = room.lookForAt(LOOK_CONSTRUCTION_SITES,fief.paths[path][spot].x,fief.paths[path][spot].y)
                            let floor = room.lookForAt(LOOK_TERRAIN,fief.paths[path][spot].x,fief.paths[path][spot].y);
                            //If we want a road, make sure there isn't a road already there and a cSite already there, and only build swamp roads
                            if(floor == 'swamp'){
                                if(!siteCheck.length){
                                    if(!roadCheck.length){
                                        //console.log(fief.paths[path][spot].x,fief.paths[path][spot].y)
                                        //Mark flag if there's no road or site
                                        swampNeed = true;
                                        room.createConstructionSite(fief.paths[path][spot].x,fief.paths[path][spot].y,STRUCTURE_ROAD);
                                        //console.log("SITEROAD")
                                    }
                                    
                                }else if(siteCheck.length){
                                    //Mark flag if we're still working on sites
                                    //console.log(fief.paths[path][spot].x,fief.paths[path][spot].y)
                                    swampNeed = true;
                                }
                            }
                            
                        })
                    }
                    
                });
                //If no swamp roads are needed
                if(!swampNeed){
                
                    Object.keys(fief.paths).forEach(path => {
                        if(path != 'closest'){
                            Object.keys(fief.paths[path]).forEach(spot => {
                                //console.log(fief.paths[path][spot])
                                let roadCheck = room.lookForAt(LOOK_STRUCTURES,fief.paths[path][spot].x,fief.paths[path][spot].y)
                                let siteCheck = room.lookForAt(LOOK_CONSTRUCTION_SITES,fief.paths[path][spot].x,fief.paths[path][spot].y)
                                //If we want a road, make sure there isn't a road already there and a cSite already there, and also make sure we don't have 10 cSites already
                                if(!roadCheck.length && !siteCheck.length & !(cSites.length > 10)){
                                    room.createConstructionSite(fief.paths[path][spot].x,fief.paths[path][spot].y,STRUCTURE_ROAD);
                                    //console.log("SITEROAD")
                                }
                                
                            })
                        }
                        
                    })
                    //First step is to hit stage 3 and build swamp roads
                }
            }
            
            
        }
        //console.log("To fiefcreep check")
        //Check all room creeps and add starters to the array for later
        for(myCreep of fiefCreeps){
            if(myCreep.memory.role == 'starter') starterCreeps.push(myCreep);
        }
        // - Memory checks -
        //Create base unit priorities if none exist, higher priority spawns first
        if(!fief.sevList){
            fief.sevList = {
                'default':50,
                'generalist':50,
                'canHarvest':50,
                'canHauler':50,
                'refiller':70,
                'upgrader':20,
                'homeBuilder':30,
                'fastFiller':75,
                'crasher':999,
                'guard':100,
                'manager':85
            }
        }
        
        //Create room plan, spawns, and spawn queue if none exists, then return
        //

        if(!fief.roomPlan || fief.roomPlan == 'null'){
            //restartFlag = true;
            let roomPlans = JSON.parse(RawMemory.segments[1]);
            let toss = null;
            if(roomPlans[room.name]){
                [fief.roomPlan, toss] = roomPlans[room.name]
            }
            else if(global && global.heap && (!global.heap.fiefPlanner || !global.heap.fiefPlanner.stage ||global.heap.fiefPlanner.stage == 0)){
                fiefPlanner.getFiefPlan(room.name);
                console.log("Getting plan for room")
            }
            //fief.roomPlanLevel = room.controller.level;
            //console.log(`${room.name} has no room plan!`)
        }

        //Set minimum hits for ramparts
        //if(!fief.rampartPlan.innerMin) fief.rampartPlan.innerMin = 50000
        //if(!fief.rampartPlan.outerMin) fief.rampartPlan.outerMin = 100000



        //Gather things for reference


        
        if(!fief.spawnQueue) {
            fief.spawnQueue = {};
            restartFlag = true;
        }
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


            if(fief.paths){
                Object.keys(fief.paths).forEach(path =>{
                    fief.paths[path].forEach(spot=>{
                        //Double check to make sure it's in our room, always
                        if(spot.roomName == room.name){
                            if(thisCM.get(spot.x,spot.y) > 1){
                                console.log("BAD PATH",spot.x,spot.y)
                                console.log(spot)
                            }
                            else{
                                thisCM.set(spot.x,spot.y,1)
                            }
                            
                        }
                    })
                });
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


        //SEASONAL MANAGER INSTEAD OF FF
        if(fief.managerSpot && ((!Game.creeps[fief.manager] || Game.creeps[fief.manager].ticksToLive < 70) && !spawnQueue[fief.manager])){
            let newName = 'Merchant '+helper.getName()+' of House '+room.name;
            spawnQueue[newName] = {
                sev:6,body:getBody('manager',room.name,''),
                memory:{role:'manager',job:'manager',managerSpot:fief.managerSpot,preflight:false}}
            fief.manager = newName;
        }



        //Create FF spots if needed
        /*if(!fief.fastFiller || Object.keys(fief.fastFiller).length != spawns.length){
            //console.log('FFDOWN')
            if(!fief.fastFiller) fief.fastFiller = {};
            spawns.forEach(spawn =>{
                //For each spawn, if not in fastFiller get open spots
                if(!fief.fastFiller[spawn]){
                    let ffSpots = roomPlanner.getFF(spawn);
                    
                    //console.log(JSON.stringify(ffSpots))
                    //If can is built, assign
                    //console.log(JSON.stringify(ffSpots))
                    if(ffSpots && ffSpots.can){
                        fief.fastFiller[spawn] = {can:ffSpots.can,coords:[{x:ffSpots.coords[0][0],y:ffSpots.coords[0][1],filler:''},{x:ffSpots.coords[1][0],y:ffSpots.coords[1][1],filler:''}]}
                    }
                }
            })
        }*/
        //delete fief.fastFiller.mobile
        //If RCL 5, create mobile spots
        //Temporary, likely to be removed or changed
        if(room.controller.level >= 4 && room.storage && room.storage.store[RESOURCE_ENERGY] > 6000 && !fief.ffMobile){
            //Mobile can based on spawn position
            //let ffSpawn = Game.getObjectById(spawns[0]);
            //console.log(ffSpawn,room.name)
            //let cStuff = room.lookForAt(LOOK_STRUCTURES,ffSpawn.pos.x+9,ffSpawn.pos.y);
            //console.log(cStuff)
            //let ffCan = cStuff.filter(structure => structure.structureType === STRUCTURE_CONTAINER)[0];
            //console.log(ffCan)
            //FF spots based on can position
            //if(ffCan)fief.ffMobile = {can:ffCan.id,coords:[{x:ffCan.pos.x+1,y:ffCan.pos.y-1,filler:''},{x:ffCan.pos.x,y:ffCan.pos.y+1,filler:''}]};

        }
        if(!fief.links){
            fief.links = {};
        }
        //Starting at RCL 5, set up links

        //Remove ff mobile if not needed
        if(room.controller.level == 8 && fief.ffMobile && spawns.length >= 2){
            delete fief.ffMobile
        }

        //Track spawn uptime
        //console.log(JSON.stringify(fief.spawnUptime))

        if(!fief.spawnUptime){
            //console.log("Makin it fresh")
            fief.spawnUptime = {};
        }
        let spawnUse = {};
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
            spawnUse[spawn] = ((totalSpawn / 3000) * 100);
            //console.log("Spawn Utilization for",Game.getObjectById(spawn).name+':\n',((totalSpawn / 3000) * 100).toFixed(2)+'%');
        });
        
        //Create road plans if none exist or if we're on starter plan with storage
        if(room.storage && (!fief.paths || !fief.paths.length)){
            fief.paths = {};
            //Probably don't need these but will keep for redundancy
            /*Object.keys(fief.sources).forEach(source => {
                //Get path to each source
                fief.paths[source] = PathFinder.search(storagePos,{pos:new RoomPosition(fief.sources[source].spotx,fief.sources[source].spoty,room.name),range:1},{
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
                            //Update roads only if they're not in an exclusion zone
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
                fief.paths[source].forEach(spot =>{
                    //Double check to make sure it's in our room, always
                    if(spot.roomName == room.name){
                        if(cm.get(spot.x,spot.y) > 1){
                            console.log("BAD PATH",spot.x,spot.y)
                            console.log(spot)
                        }
                        else{
                            cm.set(spot.x,spot.y,1)
                        }
                        
                    }
                    
                });
                fief.costMatrix = cm.serialize();
            });*/

            //Create upgrade can path
            let path = PathFinder.search(storagePos,{pos:room.controller.pos,range:1},{
                plainCost: 10,
                swampCost: 11,
                maxOps:6000,
                maxRooms: 1,
                roomCallback: function(roomName) {
                    let room = Game.rooms[roomName];
                    //Use our costmatrix because we're staying in the room.
                    if(Memory.kingdom.fiefs[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                    }else{
                        costs = new PathFinder.CostMatrix
                    }
                    /*if (room){
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
                    }*/
                    return costs;
                },
            }).path;
            //Get 2nd to last position
            if(path.length > 1){
                second = path[path.length-2];
                fief.upCanx = second.x;
                fief.upCany = second.y;
            }
            //Record path to can
            fief.paths.upCan = path;
            //Save path to cost matrix
            let cm = PathFinder.CostMatrix.deserialize(fief.costMatrix)
            fief.paths.upCan.forEach(spot =>{
                //Double check to make sure it's in our room, always
                if(spot.roomName == room.name && cm.get(spot.x,spot.y) == 0){
                    cm.set(spot.x,spot.y,1)
                }
                
            });
            //Save cost matrix
            fief.costMatrix = cm.serialize()            
        }
        //Road plans with no storage, starter set - must have spawn
        else if((!fief.paths || !Object.keys(fief.paths).length) && spawns.length){
            //console.log("No storage, secondary path creation")
            fief.paths = {}
            let shortestSource;
            let shortestPath = 99;
            let cm = PathFinder.CostMatrix.deserialize(fief.costMatrix)
            Object.keys(fief.sources).forEach(source => {
                console.log("Logging source")
                fief.paths[source] = PathFinder.search(Game.getObjectById(spawns[0]).pos,{pos:new RoomPosition(fief.sources[source].spotx,fief.sources[source].spoty,room.name),range:1},{
                    plainCost: 10,
                    swampCost: 11,
                    maxOps:6000,
                    maxRooms: 1,
                    roomCallback: function(roomName) {
                      let room = Game.rooms[roomName];
                      let costs;
                      //Use our costmatrix if we aren't leaving the room for some reason
                      if(Memory.kingdom.fiefs[roomName]){
                        costs = cm;
                      }
                      else{
                        costs = new PathFinder.CostMatrix;
                      }
                      /*if (room){
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
                      };*/
                      return costs;
                    },
                }).path;

                //Save path to cost matrix
                fief.paths[source].forEach(spot =>{
                    //Double check to make sure it's in our room, always
                    if(spot.roomName == room.name){
                        cm.set(spot.x,spot.y,1)
                    }
                    
                });
                //Save cost matrix
                fief.costMatrix = cm.serialize()
                //Find shortest
                if(fief.paths[source].length < shortestPath){
                    shortestPath = fief.paths[source].length;
                    shortestSource = source;
                }
            });
            //Mark shortest path for easy grab later
            fief.sources.closest = shortestSource;
            //Create upgrade can spot if none exists
            //Get the route from storage to controller
            /*let path = PathFinder.search(roomPlanner.getStoragePos(room),{pos:room.controller.pos,range:1},{
                plainCost: 10,
                swampCost: 11,
                maxOps:6000,
                maxRooms: 1,
                roomCallback: function(roomName) {
                  let room = Game.rooms[roomName];
                  let costs;
                  //Use our costmatrix if we aren't leaving the room for some reason
                  if(Memory.kingdom.fiefs[roomName]){
                    costs = cm;
                  }
                  else{
                    costs = new PathFinder.CostMatrix;
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
                  };
                  return costs;
                },
            }).path;
            //Get 2nd to last position
            if(path.length > 1){
                second = path[path.length-2];
                fief.upCanx = second.x;
                fief.upCany = second.y;
            }
            //Record path to can
            fief.paths.upCan = path;
            //Save path to cost matrix
            fief.paths.upCan.forEach(spot =>{
                //Double check to make sure it's in our room, always
                if(spot.roomName == room.name){
                    cm.set(spot.x,spot.y,1)
                }
                
            });*/
            //Save cost matrix
            fief.costMatrix = cm.serialize()
        }
        
        // -- Actions --
        // - All Levels - 
        //Early RCL steps
        //Only process if nothing is spawning and nothing is queued
        //Stage2 is when we are fully built in RCL2
        
        //console.log("Spawn logic: ",fief.sources && fief.sources.length && Object.keys(fief.sources).length && spawns.length && !spawns[0].spawning && !Object.keys(spawnQueue).length && !stage4)
        //console.log(!fief.sources)
        //console.log(fief.sources.length)
        //console.log(spawns.length)
        //console.log(!spawns[0].spawning)
        //console.log(!Object.keys(spawnQueue).length)
        //console.log(!stage4)
        //Spinup operations
        if(!Object.keys(spawnQueue).length && fief.sources && Object.keys(fief.sources).length && spawns.length && !spawns[0].spawning && !stage4){
            let totalSpawnParts = 0;
            let closeSource;
            let closeDistance = 99
            let ffCan;
            if(fief.fastFiller && Object.keys(fief.fastFiller).length){
                //If ff spawn exists, get the can ID
                ffCan = Game.getObjectById(fief.fastFiller[Object.keys(fief.fastFiller)[0]]['can']);
            }
            //Starter memory on sources if needed, also assignments and checks per source
            Object.keys(fief.sources).forEach(key =>{
                let livingBHarvs = [];
                let livingBHauls = [];
                //Set up arrays to track baby haulers and harvesters
                //If arrays already exist, update them
                /*console.log("Checking baby")
                console.log("Source: ",key)
                console.log(JSON.stringify(fief.sources[key]))
                console.log(fief.sources[key]['babyHarvs'])
                if(!fief.sources[key]['babyHarvs']){
                    console.log("NOPE!")
                    fief.sources[key]['babyHarvs'] = [];
                }else{
                    livingBHarvs = [];
                    //Check if baby is alive or queued, if so add to living array
                    fief.sources[key]['babyHarvs'].forEach(baby =>{
                        console.log("Checking baby",baby)
                        if(Game.creeps[baby] || fief.spawnQueue[baby]){
                            livingBHarvs.push(baby);
                            console.log("Baby alive")
                        }
                    });
                    fief.sources[key]['babyHarvs'] = livingBHarvs;
                }

                if(!fief.sources[key]['babyHauls']){
                    fief.sources[key]['babyHauls'] = [];
                }else{
                    livingBHauls = [];
                    //Check if baby is alive or queued, if so add to living array and update memory
                    fief.sources[key]['babyHauls'].forEach(baby =>{
                        if(Game.creeps[baby] || fief.spawnQueue[baby]){
                            livingBHauls.push(baby);
                        }
                    });
                    fief.sources[key]['babyHauls'] = livingBHauls;
                }
*/
                if(closeDistance > fief.paths[key].length){
                    closeDistance = fief.paths[key].length;
                    closeSource = key;
                }
            });
            //Baby harvester spawns first, then baby hauler 50 ticks later when energy regens
            let babyHarvesterBody = [MOVE,WORK,WORK];
            let babyHaulerBody = [MOVE,CARRY];
            let babyUpgraderBody = [MOVE,MOVE,WORK,CARRY];
            let starterBuilderBody = [MOVE,CARRY,WORK,WORK];

            //Update hauler body once we're out of the first bit
            if(starterCreeps.length > 3){
                babyHaulerBody = [MOVE,MOVE,CARRY,CARRY];
                babyHarvesterBody = [MOVE,MOVE,WORK,WORK];
            }
            if(starterCreeps.length > 6){
                babyHaulerBody = [MOVE,MOVE,MOVE,CARRY,CARRY,CARRY];
            }
            if(stage2 || stage3){
                babyUpgraderBody = [MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK,WORK];
            }

            //Check haulers first, see if we have enough to match harvesters working on each source. If so, check if we need another harvester.
            let totalHarv = 0;
            let totalHaul = 0;

            //Triggers for subsequent spawns
            let closestGood = false;
            let readyUp = false;
            let farSource;
            fiefSources.forEach(each =>{
                if(each != closeSource) farSource = each;
            })
            //Get total harvesting per tick
            //console.log(JSON.stringify(fief.sources[fief.sources.closest]));
            let closeHarvs = 0
            starterCreeps.forEach(boo => {
                console.log(boo.memory.role,boo.memory.target)
                if(boo.memory.job != 'babyHarvest' || boo.memory.target !=  closeSource) return
                //Pull the work parts based on where it is
                boo = boo.name
                console.log("Checking",boo)
                console.log(Game.creeps[boo])
                if(Game.creeps[boo]){
                    //console.log("Living creep")
                    closeHarvs++
                    Game.creeps[boo].body.forEach(part => {
                        totalSpawnParts += 1;
                        if(part.type == WORK) totalHarv += 2;
                    })
                }else if(spawnQueue[boo]){
                    //console.log("Spawning creep")
                    closeHarvs++
                    spawnQueue[boo].body.forEach(part => {
                        totalSpawnParts += 1;
                        if(part.type == WORK) totalHarv += 2;
                    })
                }
            });
            //If we're big enough, we'll construct full size harvesters. So just set total harvest to that.
            if(stage2 || roomLevel >=3){
                if(Game.creeps[fief.sources[closeSource].harvester] || spawnQueue[fief.sources[closeSource].harvester]){
                    
                    totalHarv = 10;
                }
            }
            //Get total hauling per tick
            
            starterCreeps.forEach(boo => {
                if(boo.memory.job != 'babyHaul' || boo.memory.target !=  closeSource) return
                boo = boo.name
                //Pull the work parts based on where it is
                if(Game.creeps[boo]){
                    Game.creeps[boo].body.forEach(part => {
                        totalSpawnParts += 1;
                        if(part.type == CARRY) totalHaul += 50;
                    })
                }else if(spawnQueue[boo]){
                    spawnQueue[boo].body.forEach(part => {
                        totalSpawnParts += 1;
                        if(part.type == CARRY) totalHaul += 50;
                    })
                }
            });
            //See if we have enough haulers for the work parts
            //Double length of the source path to get total distance
            let dist = fief.paths[closeSource].length*2;
            //Get how much we can haul per tick
            let perTick = totalHaul/dist;
            console.log("Per tick:",perTick)
            console.log("Total Haul",totalHaul)
            console.log("Total Harv",totalHarv)
            console.log("Downcheck",perTick < Math.min(totalHarv,10))
            //If we're hauling less than we're harvesting per tick, spawn a hauler. Min of total or 10 as sources only do up to 10/tick.
            if(perTick < Math.min(totalHarv,10)){
                console.log("Spawning")
                newName = 'Wagon '+helper.getName()+' of House '+room.name;
                spawnQueue[newName] = {
                    sev:6,body:babyHaulerBody,
                    memory:{role:'starter',job:'babyHaul',target:closeSource,fief:room.name,preflight:false}}
            }
            //If we're good on haulers, see if we need harvesters
            //If we aren't harvesting the max energy, and there's room for another
            //Check for stage2 to skip because we have full harvesters
            else if(!stage2 && totalHarv < 10 && fief.sources[closeSource].openSpots > closeHarvs){
                let newName = 'Peon '+helper.getName()+' of House '+room.name;
                spawnQueue[newName] = {
                    sev:8,body:babyHarvesterBody,
                    memory:{role:'starter',job:'babyHarvest',fief:room.name,target:closeSource,preflight:false}}
            }
            //Else set up for a check on the farthest
            else{
                closestGood = true;
            }
            /*console.log("Total harvested per tick:",totalHarv);
            console.log("Total haul per tick:",perTick);
            console.log("Ready for next source:",closestGood);
            console.log("Queue length",Object.keys(spawnQueue).length);
            console.log("Far source",farSource)*/
            //If we're all good on closest source, do the same checks for the farthest if it exists. Spawn creeps with a lower priority
            if(closestGood && farSource && !spawns[0].spawning){
                totalHarv = 0;
                totalHaul = 0;
                //console.log(farSource)
                let farHarvs = 0;
                starterCreeps.forEach(boo => {
                    if(boo.memory.job != 'babyHarvest' || boo.memory.target ==  closeSource) return
                    boo = boo.name
                    //Pull the work parts based on where it is
                    if(Game.creeps[boo]){
                        farHarvs++
                        Game.creeps[boo].body.forEach(part => {
                            totalSpawnParts += 1;
                            if(part.type == WORK) totalHarv += 2;
                        })
                    }else if(spawnQueue[boo]){
                        farHarvs++
                        spawnQueue[boo].body.forEach(part => {
                            totalSpawnParts += 1;
                            if(part.type == WORK) totalHarv += 2;
                        })
                    }
                });
                if(stage2 || roomLevel >=3){
                    if(Game.creeps[fief.sources[farSource].harvester] || spawnQueue[fief.sources[farSource].harvester]){
                        totalHarv = 10;
                    }
                }
                //Get total hauling per tick
                starterCreeps.forEach(boo => {
                    if(boo.memory.job != 'babyHaul' || boo.memory.target ==  closeSource) return
                    boo = boo.name
                    //Pull the work parts based on where it is
                    if(Game.creeps[boo]){
                        Game.creeps[boo].body.forEach(part => {
                            totalSpawnParts += 1;
                            if(part.type == CARRY) totalHaul += 50;
                        })
                    }else if(spawnQueue[boo]){
                        spawnQueue[boo].body.forEach(part => {
                            totalSpawnParts += 1;
                            if(part.type == CARRY) totalHaul += 50;
                        })
                    }
                });
                //See if we have enough haulers for the work parts
                //Double length of the source path to get total distance
                dist = fief.paths[farSource].length*2;
                //Get how much we can haul per tick
                perTick = totalHaul/dist;
                //If we're hauling less than we're harvesting per tick, spawn a hauler. Min of total or 10 as sources only do up to 10/tick.
                console.log("FAR CHECK")
                console.log("Per tick:",perTick)
                console.log("Total Haul",totalHaul)
                console.log("Total Harv",totalHarv)
                console.log("Downcheck",perTick < Math.min(totalHarv,10))
                if(perTick < Math.min(totalHarv,10)){
                    newName = 'Wagon '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:6,body:babyHaulerBody,
                        memory:{role:'starter',job:'babyHaul',target:farSource,fief:room.name,preflight:false}}
                }
                //If we're good on haulers, see if we need harvesters
                //If we aren't harvesting the max energy, and there's room for another
                else if(!stage2 && totalHarv < 10 && fief.sources[farSource].openSpots > farHarvs){
                    let newName = 'Peon '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:8,body:babyHarvesterBody,
                        memory:{role:'starter',job:'babyHarvest',fief:room.name,target:farSource,preflight:false}}
                }
                else{
                    readyUp = true;
                }
                //console.log("Total2 harvested per tick:",totalHarv);
                //console.log("Total2 haul per tick:",perTick);
            }else if(!farSource){
                readyUp = true;
            }

            //If we're at RCL 2, check if we need to get to building
            if(roomLevel <=4 && readyUp && !spawns[0].spawning && cSites.length){
                //Spawn builders
                let babyBuilderBody = [MOVE,CARRY,WORK,WORK];
                let possibleBlds = (500-totalSpawnParts)/babyBuilderBody.length;
                let stupidCap = 8;
                //Make memory slot if needed
                if(!fief.builders) fief.builders = [];
                //Count living upgraders
                let liveBuilders = []
                fief.builders.forEach(up => {
                    //Track the live ones
                    if (Game.creeps[up] || spawnQueue[up] ){
                        liveBuilders.push(up)
                    }
                });
                if(liveBuilders.length < possibleBlds && liveBuilders.length < stupidCap && (!ffCan || ffCan.store[RESOURCE_ENERGY] > 1000)){
                    //console.log('UP ',liveUpgraders.length,' Need ',upgradersNeeded)
                    let newName = 'Bricklayer '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:3,body:babyBuilderBody,
                        memory:{role:'starter',job:'babyBuilder',fief:room.name,preflight:false}}
                    liveBuilders.push(newName);
                }
                //console.log(room.name,' has ',liveUpgraders.length,' upgraders. Needs ',upgradersNeeded)
                fief.builders = liveBuilders;
                readyUp = false;

            }

            //Spawn upgraders if all harvesters/haulers are good and we're not currently spawning
            //Do not spawn upgraders if we're at RCL 2 and not done building
            if(readyUp && !spawns[0].spawning && (roomLevel != 2 || stage2)){
                let possibleUps = (500-totalSpawnParts)/babyUpgraderBody.length;
                let stupidCap = 8;
                if(fief.fastFiller && Object.keys(fief.fastFiller).length){
                    //If ff spawn exists, get the can ID
                    ffCan = Game.getObjectById(fief.fastFiller[Object.keys(fief.fastFiller)[0]]['can']);
                }

                if(stage2 || stage3){
                    if(ffCan && ffCan.store[RESOURCE_ENERGY] < 1500){
                        stupidCap = 4
                    }
                    else if(ffCan && ffCan.store[RESOURCE_ENERGY] == 2000){
                        stupidCap = 12
                    }
                    
                }
                //Make memory slot if neede
                if(!fief.upgraders) fief.upgraders = [];
                //Basic logic, upgrader for every x energy
                //Count living upgraders
                let liveUpgraders = []
                fief.upgraders.forEach(up => {
                    //Track the live ones
                    if (Game.creeps[up] || spawnQueue[up] ){
                        liveUpgraders.push(up)
                    }
                });
                //Get upgrader if needed and make sure we stay under a stupid cap
                //console.log(liveUpgraders.length,stupidCap)
                if(liveUpgraders.length < possibleUps && liveUpgraders.length < stupidCap){
                    //console.log('UP ',liveUpgraders.length,' Need ',upgradersNeeded)
                    let newName = 'Scrivener '+helper.getName()+' of House '+room.name;
                    spawnQueue[newName] = {
                        sev:3,body:babyUpgraderBody,
                        memory:{role:'starter',job:'babyUpgrader',fief:room.name,preflight:false}}
                    liveUpgraders.push(newName);
                }
                //console.log(room.name,' has ',liveUpgraders.length,' upgraders. Needs ',upgradersNeeded)
                fief.upgraders = liveUpgraders;
            }
        }

        //Stage 2 checks - harvesters, haulers, and fastfillers
        if(stage2 || roomLevel >= 3){
            sources = fief.sources
            
            Object.keys(sources).forEach(key =>{
                //Build a can if there isn't one, only if there are no other construction sites and we have extensions
                
                if(!sources[key].link &&stage4 && !Game.getObjectById(sources[key]['can']) && cSites.length == 0){
                    let spotStruct = room.lookForAt(LOOK_STRUCTURES,sources[key]['spotx'],sources[key]['spoty']);
                    if(spotStruct.length){
                        fief.sources[key]['can'] = spotStruct[0].id;
                    } else{
                        room.createConstructionSite(sources[key]['spotx'],sources[key]['spoty'],STRUCTURE_CONTAINER);
                        //console.log("SITE3")
                    }
                    
                }
                //Else check if we need harvester/hauler - Generalists will haul prior to storage
                    
                    if((!Game.creeps[sources[key]['harvester']] || Game.creeps[sources[key]['harvester']].ticksToLive < 30) && !spawnQueue[sources[key]['harvester']]){
                        let newName = 'Serf '+helper.getName()+' of House '+room.name;
                        spawnQueue[newName] = {
                            sev:getSev('canHarvest',room.name),body:getBody('harvester',room.name,'canHarvest'),
                            memory:{role:'harvester',job:'canHarvest',harvestSpot:{x:sources[key]['spotx'],y:sources[key]['spoty'],id:key},homeRoom:room.name,target:key,preflight:false}}
                        fief.sources[key]['harvester'] = newName;
                    }
                    if(stage4 && !Game.creeps[sources[key]['hauler']] && !spawnQueue[sources[key]['hauler']] &&!sources[key].link){
                        if(sources[key].can){
                            let newName ='Porter '+helper.getName()+' of House '+room.name;
                            spawnQueue[newName] = {
                                sev:getSev('canHauler',room.name),body:getBody('hauler',room.name,'canHauler',key),
                                memory:{role:'hauler',job:'canHauler',source:key,preflight:false}}
                            fief.sources[key]['hauler'] = newName;
                        }
                        else{
                            let newName ='Porter '+helper.getName()+' of House '+room.name;
                        spawnQueue[newName] = {
                            sev:getSev('canHauler',room.name),body:getBody('hauler',room.name,'canHauler',key),
                            memory:{role:'hauler',job:'canHauler',source:key,homeRoom:room.name,preflight:false}}
                        fief.sources[key]['hauler'] = newName;
                        }
                        
                    }
            });

            //Check for and spawn a single FF if needed
            let bottomQM = false;
            let topQM = false;
            if(stage2) bottomQM = true;
            if(stage3) topQM = true;

        }
        //Stage 4 - Once storage is set up. Standard room operations.
        if(stage4 && (room.storage.store[RESOURCE_ENERGY] > 5000 || room.energyAvailable < 500)){

            roadReady = true;
            // - Refiller Check -
            if((!Game.creeps[fief.refiller] && !spawnQueue[fief.refiller]) || (Game.creeps[fief.refiller] && Game.creeps[fief.refiller].ticksToLive < 350)){
                let newName = 'Steward '+helper.getName()+' of House '+room.name;
                spawnQueue[newName] = {
                    sev:getSev('refiller',room.name),body:getBody('hauler',room.name,'refiller'),
                    memory:{role:'hauler',fief:room.name,preflight:false}}
                fief.refiller = newName;
            }
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
            //Check for mobile filler
            /*if(fief.ffMobile){
                fief.ffMobile.coords.forEach(spot => {
                    if((!Game.creeps[spot.filler] && !spawnQueue[spot.filler])){
                        let newName = 'Quartermaster '+helper.getName()+' of House '+room.name;
                        //console.log(JSON.stringify(spot), 'spot')
                        spawnQueue[newName] = {
                            sev:getSev('fastFiller',room.name),body:getBody('fastFiller',room.name,'mobile'),
                            memory:{role:'fastFiller',job:'mobile',homeRoom:room.name,preflight:false,can:fief.ffMobile.can,spotx:spot.x,spoty:spot.y}}
                        spot.filler = newName;
                    }
                });
            }*/
        } 

        //RCL 5 checks - Link control
        if(roomLevel >= 5){
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
            if(coreLink && !fief.managerSpot){
                newPos = roomPlanner.getManagerPos(room);
                fief.managerSpot = {x:newPos.x,y:newPos.y}
            }

           
            //If uplink is ready to receive
            if(upLink && upLink.store[RESOURCE_ENERGY] == 0){
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
            else{
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
            if(manager && !managerBusy){
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
            if(Game.time % 70 == 0){
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
        if(roomLevel >= 6){
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

            
            if(!fief.mineral.can){
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
        

        //Crash detection and gen spawn
        let crashCheck = fiefCreeps.filter(cr => !['fastFiller'].includes(cr.memory.role))
        //console.log(crashCheck)
        if(roomLevel >= 3 && (fiefCreeps.length == 0 || crashCheck.length == 0) && !spawnQueue[fief.crasher]){
            spawnQueue = {};
            if(!Game.getObjectById(spawns[0]).spawning){
                //console.log("AYE")
                let newName = 'Undertaker '+helper.getName()+' of House '+room.name;
                let z = Game.getObjectById(spawns[0]).spawnCreep(getBody('generalist',room.name,'crasher'),newName,{memory:{role:'generalist',job:'crasher',fief:room.name,targetRoom:'None',preflight:false}})
                if(z == 0)fief.crasher = newName
            }

        }
        //console.log(JSON.stringify(spawnQueue))
        // -- Final Actions --
        //If there are starters, run starter code
        if(starterCreeps.length) roleStarters.run(starterCreeps,room);
        

        //Sort spawn queue
        const finalQueue = Object.keys(spawnQueue).sort((a, b) => spawnQueue[b].sev - spawnQueue[a].sev);
        //Gather all idle spawns
        //console.log(finalQueue)
        let freeSpawns = [];
        for(each of spawns){
            if(!Game.getObjectById(each).spawning) freeSpawns.push(each);
        }
        //console.log(freeSpawns)
        //Spawn based on priority
        //Need a good system here but for now we just go down the list

        //First, grab all extensions so we can prioritize those with fastfillers
        let allExts = room.find(FIND_MY_STRUCTURES,{
            filter:{structureType: STRUCTURE_EXTENSION}
        });
        //Get all current extension IDs with an active FF
        let ffExts = fiefCreeps.reduce((acc, creep) => {
            if (Array.isArray(creep.memory.refills)) { // Check if refills is an array
              return [...acc, ...creep.memory.refills];
            } else {
              return acc; // If not an array, just return the accumulator as is
            }
          }, []);
        //If an extension has a FF, remove it from the list. Remainders go into filteredExts
        let filteredExts = allExts.filter(ext => !ffExts.includes(ext.id));
        //Convert IDs to gameobjects in the final array to push to spawn
        let spawnExts = ffExts.map(id => Game.getObjectById(id));
        //Add filtered extensions to the end of the ff list
        //Pass it to spawnCreep so it's only added if we are spawning
        spawnExts.push(...filteredExts);
        

        for(let i = 0; i < finalQueue.length; i++){
            //Grab preferred spawn and use that if we can
            let each = finalQueue[i];
            let body = spawnQueue[each].body;
            let cost = 0;
            for(every of body){
                cost += BODYPART_COST[every];
            }
            let preferredSpawn = spawnQueue[each].memory.spawner;
            //console.log(preferredSpawn,' ',each)
            //Check if it's a holding creep and if so, check for alarm. Skip if alarmed.
            /*if(spawnQueue[each].memory.holding && Memory.kingdom.holdings[spawnQueue[each].memory.holding].alarm){
                //Only spawn defenders assigned to the defense mission of that holding
                if(Memory.kingdom.missions.defense.holding && Memory.kingdom.missions.defense.holding.creeps.includes(each)){
                        if(room.energyAvailable >= cost){
                        let nextSpawn = freeSpawns.shift();
                        spawnCreep(Game.getObjectById(nextSpawn),each,spawnQueue[each],spawnExts)
                        finalQueue.splice(i,1);
                        i--;
                        delete spawnQueue[each];
                    }   
                }
            }*/
            //If there is a preferred spawn and it's in the spawner list
            if(preferredSpawn && freeSpawns.includes(preferredSpawn)){
                //console.log("WEIN")
                //Check if there's energy
                //console.log(each)
                if(room.energyAvailable >= cost){
                    //console.log("YEP")
                    spawnCreep(Game.getObjectById(preferredSpawn),each,spawnQueue[each],spawnExts);
                    freeSpawns = freeSpawns.filter(spawnID => spawnID !== preferredSpawn);
                    finalQueue.splice(i,1);
                    i--;
                    //console.log("Firing")
                    delete spawnQueue[each];
                }
                
            //If there isn't a preferred spawn and we have a free spawner
            } else if (!preferredSpawn && freeSpawns.length > 0){
                //Check if spawn has energy
                if(room.energyAvailable >= cost){
                    let nextSpawn = freeSpawns.shift();
                    spawnCreep(Game.getObjectById(nextSpawn),each,spawnQueue[each],spawnExts)
                    finalQueue.splice(i,1);
                    i--;
                    delete spawnQueue[each];
                }
                
            }
        }
        //Set defense mission if hostile creeps are detected and they're not scouts
        if(roomBaddies.some(creep => !helper.isScout(creep)&& !Memory.diplomacy.allies.includes(creep.owner.username))){
            //Create defend mission if one isn't already active
            if(!Memory.kingdom.missions.defend[room.name]){
                missionManager.createMission('defend',room.name,{hostileCreeps:roomBaddies.filter(creep =>{!Memory.diplomacy.allies.includes(creep.owner.username)})})
            }
        }

        //Military manager needed for this stuff
        if(fief.rampsActive && Game.time % 50 == 0 && cSites.length < 10){
            console.log("RAMPS?")
            if(fief.rampartPlan){
                console.log("RAMPS!")
                let count = 0;
                fief.rampartPlan.outer.forEach(ramp =>{
                    let spot = room.lookForAt(LOOK_STRUCTURES,ramp.x,ramp.y);
                    let spotSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,ramp.x,ramp.y);
                    let floor = room.lookForAt(LOOK_TERRAIN,ramp.x,ramp.y);
                    //console.log('Ramp check',spot.some(element => element.structureType == STRUCTURE_RAMPART))
                    //console.log('Floor check',floor)
                    //console.log('site check',!spotSite.length)
                    if(count >= 10-cSites.length) return;
                    if((!spot.length || !spot.some(element => element.structureType == STRUCTURE_RAMPART)) && floor != 'wall' && !spotSite.length){
                        let x = room.createConstructionSite(ramp.x,ramp.y,STRUCTURE_RAMPART);
                        if(x == 0)count++
                    }

                });
                if(count == 0){
                    fief.rampartPlan.inner.forEach(ramp =>{
                        let spot = room.lookForAt(LOOK_STRUCTURES,ramp.x,ramp.y);
                        let spotSite = room.lookForAt(LOOK_CONSTRUCTION_SITES,ramp.x,ramp.y);
                        let floor = room.lookForAt(LOOK_TERRAIN,ramp.x,ramp.y);
                        //console.log('Ramp check',spot.some(element => element.structureType == STRUCTURE_RAMPART))
                        //console.log('Floor check',floor)
                        //console.log('site check',!spotSite.length)
                        if(count >= 10-cSites.length) return;
                        if((!spot.length || !spot.some(element => element.structureType == STRUCTURE_RAMPART)) && floor != 'wall' && !spotSite.length){
                            let x = room.createConstructionSite(ramp.x,ramp.y,STRUCTURE_RAMPART);
                            if(x == 0)count++
                        }
    
                    });
                }
            }
        }


        /*let ramps = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.hits < fief.rampartPlan.outerMin && structure.structureType == STRUCTURE_RAMPART)
        });
        let babyRamps = ramps.filter(structure=> structure.hits <=1000);
        if(ramps.length && !Game.creeps[fief.ramper] && !spawnQueue[fief.ramper]){
            let newName = 'Fortifier '+helper.getName()+' of House '+room.name;
                spawnQueue[newName] = {
                    sev:getSev('homeBuilder',room.name),body:getBody('builder',room.name,'fortBuilder'),
                    memory:{role:'builder',job:'fortBuilder',fief:room.name,homeRoom:room.name,preflight:false}}
                fief.ramper = newName;
        }*/


        towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
    _.forEach(towers, function(tower) {
        var damagedStructures = tower.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.hits < structure.hitsMax*0.8 && (structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART))
        });
        damagedStructures.push(...babyRamps)
        var damagedCreeps = tower.room.find(FIND_MY_CREEPS, {
            filter: (creep) => (creep.hits < creep.hitsMax)
        });
        
        damagedStructures.sort((a, b) => a.hits - b.hits);
        damagedCreeps.sort((a, b) => a.hits - b.hits);
        //console.log(room.name)
        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (closestHostile != null && closestHostile != undefined) {
                //console.log(closestHostile)
                tower.attack(closestHostile);
        }
        else if(tower.energy > 400){
            if (damagedCreeps.length > 0){
                tower.heal(damagedCreeps[0])
            }
            else if (damagedStructures.length > 0) {
                tower.repair(damagedStructures[0]);
            }
        }
    });

    //Guard
    if(towers.length == 0 && roomBaddies.length > 0 && (!Game.creeps[fief.guard] && !spawnQueue[fief.guard])){
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
        return {
            roomLevel:roomLevel,
            cSites: cSites.length,
            wares: totalWares(room),
            totalCreeps: fiefCreeps.length,
            fiefCreeps: fiefCreeps,
            hostileCreeps: roomBaddies,
            controllerProgress: room.controller.progress,
            safeMode: room.controller.safeMode,
            spawnUse: spawnUse,
            cpuUsed: (Game.cpu.getUsed() - cpuStart).toFixed(2),
            spawnQueue: spawnQueue,
            storageLevel: storageLevel
        };
        

    }
};

module.exports = fiefManager;
profiler.registerObject(fiefManager, 'fiefManager');
function getSev(job,room){
    let jobSev = Memory.kingdom.fiefs[room].sevList[job];
    if(jobSev){
        return jobSev;
    }else{
        return Memory.kingdom.fiefs[room].sevList['default']
    }
}

function spawnCreep(spawner,name,plan,exts=[]){
    //console.log("PLAN: "+spawner+' '+name+' '+plan)
    //console.log(JSON.stringify(plan))
    let spawnDir = plan.dir;
    let switchDir = plan.dir;
    //console.log("Spawning with "+switchDir);
    switch(switchDir){
        case 'TOP_LEFT':
            spawnDir = [TOP_LEFT];
            //console.log("TOP_LEFT SPAWN DIR");
            break;
        case 'TOP_RIGHT':
            spawnDir = [TOP_RIGHT];
            //console.log("TOP_RIGHT SPAWN DIR");
            break;
        case 'BOTTOM':
            spawnDir = [BOTTOM];
            //console.log("BOTTOM SPAWN DIR");
            break;
        case 'BOTTOM_LEFT':
            spawnDir = [BOTTOM_LEFT];
            break;
        case 'LEFT':
            spawnDir = [LEFT];
            break;
        case 'TOP':
            spawnDir = [TOP];
            break;
        case 'RIGHT':
            spawnDir = [RIGHT];
            break;
        case 'BOTTOM_RIGHT':
            spawnDir = [BOTTOM_RIGHT];
            break;
        default:
            [LEFT,RIGHT,TOP,BOTTOM,TOP_LEFT,TOP_RIGHT,BOTTOM_LEFT,BOTTOM_RIGHT];
            
    }
    //console.log(spawnDir)
    //console.log(JSON.stringify(plan))
    if(spawner != null && spawner != undefined){
        //console.log(spawner)
        exts.unshift(spawner);
        //console.log(exts)
        //Fat creeps get a marker to help Traveler
        let movePart = 0;
        let nonMove = 0;
        plan.body.forEach(part=>{
            if(part == MOVE){
                movePart++;
            }
            else{
                nonMove++;
            }
        });
        //Only mark them fat if they're road fat
        if(nonMove>movePart*2){
            plan.memory['fat'] = true;
        }
        try{
            var x = spawner.spawnCreep(plan.body, name,{memory:plan.memory,directions:spawnDir,energyStructures:exts});
            
        }
        catch(e){
            console.log(name+'spawn error '+e)
        }
        //Track spawn uptime by logging the spawn call
        if(x == 0){
            //console.log("SUCCESS")
            //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
            Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id].push({gameTime:Game.time,bodySize:plan.body.length});
            //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
        }
        //console.log(name+'\n'+)
        //console.log(x)
    }
}
//#region Spawning

//#endregion
function getBody(role,roomName,job='default',target='default'){
    let parts;
    let mult;
    let newBod;
    switch(role){
        case 'starter':
            switch(job){
                case 'babyHauler':
                    return [MOVE,CARRY]
                    break;
                case 'hauler':
                    parts = [MOVE,CARRY];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Get available room energy
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable;
                    //Get the size needed for the trip
                    let canDist= Game.rooms[roomName].storage.pos.getRangeTo(Game.getObjectById(Memory.kingdom.fiefs[roomName].sources[target]['can']))*2;
                    //Add 2 for pickup/dropoff ticks, plus 5 for small buffer                 
                    canDist +=7;                    
                    let energyNeeded = canDist*10
                    let sizeMult = Math.ceil(energyNeeded/100)
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(mult)
                    newBod = [].concat(...Array(Math.min(mult, sizeMult)).fill(parts));
                    //console.log(newBod)
                    return newBod;
            }
            break;
        case 'harvester':
            switch(job){
                case 'mineralHarvester':
                    parts = [MOVE,WORK,WORK,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    mult = Math.floor(engAvail/partsCost)
                    //Max number of arrays so we don't pass 50 parts
                    let arrMax = Math.floor(50/parts.length)
                    //Fill new body with either the multiple we can afford or the max, whichever is smaller
                    newBod = [].concat(...Array(Math.min(mult,arrMax)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                    break;
                case 'canHarvest':
                    if(Game.rooms[roomName].energyCapacityAvailable> 550){
                        return [MOVE,CARRY,WORK,WORK,WORK,WORK,WORK];
                    }else{
                        return [MOVE,WORK,WORK,WORK,WORK,WORK]
                    }
                default:
                    switch(roomName){
                        case 'W29N25':
                            return [CARRY,CARRY,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK];
                            break;
                        case 'W28N25':
                            return [MOVE,MOVE,WORK,WORK,WORK,WORK,WORK]
                            break;
                        default:
                            return [MOVE,WORK,WORK,WORK,WORK,WORK];
                    }       
                    break;
            }
            break;
        case 'remoteDefender':
            switch(roomName){
                case 'W29N25':
                    switch(job){
                        case 'remoteDefender':
                            return [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK];
                            break;
                        case 'core':
                            return [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                            break;
                    }
                case 'W28N25':
                    switch(job){
                        case 'remoteDefender':
                            return [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK];
                            break;
                        case 'core':
                            return [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                            break;
                    }
                default:
                    return [MOVE,MOVE,WORK,WORK];
            }       
            break;
        case 'guard':
            return [MOVE,MOVE,ATTACK,ATTACK]
        case 'fastFiller':
            let roomLevel = Game.rooms[roomName].controller.level;
            switch(job){
                //Switch for fast fillers and mobiles
                case 'fastFiller':
                    //Room level switch. Fill 100 by default, 200 at lvl 7, and 400 at 8. 
                    switch(roomLevel){
                        case 7:
                            return [CARRY,CARRY,CARRY,CARRY];
                            break;
                        case 8:
                            return [CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [CARRY,CARRY];
                    }
                case 'mobile':
                    switch(roomLevel){
                        case 7:
                            return [CARRY,CARRY,CARRY,CARRY,MOVE,MOVE];
                            break;
                        default:
                            return [CARRY,CARRY,MOVE];
                    }
                default:
                    return [CARRY,CARRY];
            }       
            break;
        case 'generalist':
            switch(job){
                case 'generalist':
                    parts = [MOVE,CARRY,MOVE,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(mult)
                    newBod = [].concat(...Array(mult).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'crasher':
                    console.log("Crash firing")
                    parts = [MOVE,MOVE,CARRY,WORK];
                    let partsCost2 = 0;
                    for(each of parts){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail2 = Game.rooms[roomName].energyAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail2/partsCost2)
                    //console.log('CRASH MULT', mult)
                    //console.log(mult)
                    newBod = [].concat(...Array(mult).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'remote':
                    switch(roomName){
                        case 'W28N24':
                            return [MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK];
                            break;
                        case 'W17N27':
                            return [MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK]
                            break;
                        case 'W29N21':
                            return [MOVE,MOVE,MOVE,CARRY,CARRY,MOVE,WORK,WORK]
                            break;
                        case 'W24N19':
                            return [MOVE,MOVE,MOVE,CARRY,CARRY,MOVE,WORK,WORK]
                            break;
                        case 'W19N23':
                            return [MOVE,MOVE,MOVE,CARRY,MOVE,CARRY,MOVE,WORK,WORK,WORK]
                            break;
                        case 'W18N26':
                            return [MOVE,MOVE,MOVE,CARRY,WORK,WORK]
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,WORK];
                    }       
                    break;
            }      
            break;    
        case 'manager':
            return [MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY];
        case 'claimer':
            switch(job){
                case 'reserver':
                    switch(roomName){
                        case 'W39N46':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        case 'W46N42':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        default:
                            return [MOVE,CLAIM];
                    }       
                    break;
                case 'attacker':
                    switch(roomName){
                        case 'W39N46':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        case 'W46N42':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        default:
                            return [MOVE,CLAIM];
                    }       
                    break;
            }
        case 'upgrader':
            parts = [MOVE,CARRY,WORK,WORK,WORK,WORK,WORK];
            let partsCost = 0;
            for(each of parts){
                partsCost += BODYPART_COST[each];
            }
            let engAvail = Game.rooms[roomName].energyCapacityAvailable
            mult = Math.floor(engAvail/partsCost)
            //console.log(mult)
            newBod = [].concat(...Array(Math.min(mult,6)).fill(parts));
            //If mult is 2 or more, stuff however many more work parts we can
            if(mult >= 2){
                //Get the total cost of the body
                let totalCost = 0;
                newBod.forEach(b => {
                    totalCost += BODYPART_COST[b];
                });
                //Get how many work parts we can fit in the difference
                let gapParts = Math.floor((engAvail-totalCost)/100);
                newBod = newBod.concat(Array(Math.min(gapParts,50-newBod.length)).fill(WORK));
            }

            //console.log("BODLENGTH",newBod.length)
            return newBod;
        case 'miner':
            switch(roomName){
                case 'W39N46':
                    return [MOVE,MOVE,WORK,WORK,WORK,WORK,WORK];
                    break;
                case 'W46N42':
                    return [MOVE,MOVE,CARRY,CARRY,WORK];
                    break;
                default:
                    return [MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK];
            }
            break;
        case 'trucker':
            switch(roomName){
                case 'W39N46':
                    switch(job){
                        case 'linkHauler':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        case 'canHauler':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,WORK,WORK];
                    }
                    
                default:
                    return [MOVE,CARRY,WORK,WORK];
            }
            break;
        case 'hauler':
            switch(job){
                case 'canHauler':
                    parts = [MOVE,CARRY,CARRY];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Get available room energy
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable;
                    //Get the size needed for the trip
                    let canDist= Game.rooms[roomName].storage.pos.getRangeTo(new RoomPosition(Memory.kingdom.fiefs[roomName].sources[target]['spotx'],Memory.kingdom.fiefs[roomName].sources[target]['spoty'],roomName))*2;
                    //Add 2 for pickup/dropoff ticks, plus 5 for small buffer                 
                    canDist +=7;                    
                    //console.log(canDist)
                    let energyNeeded = canDist*10
                    let sizeMult = Math.ceil(energyNeeded/100)
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(sizeMult)
                    newBod = [].concat(...Array(Math.min(mult, sizeMult)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                    break;
                case 'mineralHauler':
                    let parts2 = [MOVE,CARRY,CARRY];
                    let partsCost2 = 0;
                    for(each of parts2){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Get available room energy
                    let engAvail2 = Game.rooms[roomName].energyCapacityAvailable;
                    //Get the size needed for the trip
                    let canDist2= Game.rooms[roomName].storage.pos.getRangeTo(new RoomPosition(Memory.kingdom.fiefs[roomName].mineral.spot.x,Memory.kingdom.fiefs[roomName].mineral.spot.y,roomName))*2;
                    //Add 2 for pickup/dropoff ticks, plus 5 for small buffer                 
                    canDist2 +=7;                    
                    //console.log(canDist)
                    let energyNeeded2 = canDist2*10
                    let sizeMult2 = Math.ceil(energyNeeded2/100)
                    let mult2 = Math.floor(engAvail2/partsCost2)
                    //console.log(sizeMult)
                    newBod = [].concat(...Array(Math.min(mult2, sizeMult2)).fill(parts2));
                    //console.log(newBod)
                    return newBod;
                case 'refiller':
                    parts = [MOVE,CARRY,CARRY];
                    let total = parts.length*50;
                    let cap = Math.max(Game.rooms[roomName].energyAvailable, 1800);
                    mult = Math.floor(Game.rooms[roomName].energyAvailable/total);
                    newBod = [].concat(...Array(mult).fill(parts));
                    if(newBod.length > 50){
                        newBod.splice(50);
                    }
                    return newBod
                    /*switch(roomName){
                        case 'W29N25':
                            return [MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY];
                            break;
                        case 'W28N25':
                            return [MOVE,CARRY,CARRY];
                            break;
                        case 'W46N42':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,CARRY,MOVE,CARRY];
                    }*/ 
                    break;
            }
            break;
        case 'builder':
            switch(job){
                case 'homeBuilder':
                    parts = [MOVE,MOVE,CARRY,CARRY,WORK,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(mult)
                    newBod = [].concat(...Array(Math.min(mult,4)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'fortBuilder':
                    parts = [MOVE,CARRY,WORK,WORK,WORK,WORK,WORK];
                    let partsCost2 = 0;
                    for(each of parts){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail2 = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail2/partsCost2)
                    //console.log(mult)
                    newBod = [].concat(...Array(Math.min(mult,7)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'remoteBuilder':
                    switch(roomName){
                        case 'W39N46':
                            //console.log("REMOTE")
                            return [MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,CARRY,MOVE,CARRY];
                    } 
                    break;
            }
            break;
    }
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