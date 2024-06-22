const helper = require('functions.helper');
const MinCut = require('minCut');
const test = {
    //Calculates the centerpoint for room paths by pathing between all sources/controller/optional room positions, then pathing between their midpoints, and repeating until range <=2
    //room is a room name, optionalPositions is an array of RoomPositions
    findPathCenterpoint: function(room,optionalPositions = null,getRoomSites = true){
        //Determine if we have vision. If not, check if we have optional positions. If so, run using only those. If not, return error.
        let keySites = []
        if(!Game.rooms[room] || getRoomSites == false){
            if(!optionalPositions.length){
                return undefined;
            }else{
                keySites = keySites.concat(optionalPositions);
            }
        }
        else{
            let sources = Game.rooms[room].find(FIND_SOURCES).map(source => source.pos);
            let controller = Game.rooms[room].controller.pos
            if(optionalPositions)keySites = keySites.concat(sources,optionalPositions,controller);
            else{
                keySites = keySites.concat(sources,controller);
            }
        }

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
                      costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                  });
              }
              return costs;
            },
        }



        //console.log(keySites)
        //Get initial paths between all key sites and store them in the newOrbit array
        for(let i = 0; i < keySites.length ; i++){
            if(i+1 == keySites.length){
                //Check for path length 0. If found, skip path. Find a better fix later.
                let aPath = PathFinder.search(keySites[i], {pos:keySites[0],range:1},pathOpts).path
                if(aPath.length == 0){
                    continue;
                }
                else{
                    newOrbit.push(aPath)
                }
                
            }
            else{
                let bPath = PathFinder.search(keySites[i], {pos:keySites[i+1],range:1},pathOpts).path
                if(bPath.length == 0){
                    continue;
                }
                else{
                    newOrbit.push(bPath)
                }
                
            }
            
        }


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
            //console.log(midPoints)
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
            //room:room,
            //paths:orbitPaths,
            x:Math.floor(sumX / midPoints.length),
            y:Math.floor(sumY / midPoints.length)
        };

    },
    interpolateColors: function(start, end, progress) {
        // Interpolate each RGB component separately
        const r = Math.round(start.r + (end.r - start.r) * progress);
        const g = Math.round(start.g + (end.g - start.g) * progress);
        const b = Math.round(start.b + (end.b - start.b) * progress);

        return { r, g, b };
    },
    routeRemoteRoad: function(room,entryPoint){
        let startCPU = Game.cpu.getUsed();
        let keySites = []
        let sources = []
        if(!Game.rooms[room]){
            return null
        }
        else{
            sources = Game.rooms[room].find(FIND_SOURCES);
            let controller = Game.rooms[room].controller
            keySites = keySites.concat(sources);
            keySites.push(controller)
        }
        //Assignments
        //All routes
        let totalRoutes = []
        //Current route we're working on
        let thisRoute = []
        //Array of targets for this run
        let thisTargets = []        
        let midRoute = []
        /*return {
            room:room,
            paths:orbitPaths,
            centerX:Math.floor(sumX / midPoints.length),
            centerY:Math.floor(sumY / midPoints.length)
            };*/
            //Midpoint pathfind
            let midpoint = this.findPathCenterpoint(room,entryPoint)
            //console.log(JSON.stringify(midpoint))
            let midTarget = new RoomPosition(midpoint.centerX,midpoint.centerY,midpoint.room)
            
            //If midpoint isn't in terrain, run its check
            let tile = Game.rooms[room].lookForAt(LOOK_TERRAIN,midpoint.centerX,midpoint.centerY);
            if(tile[0].terrain != 'wall'){
                midRoute = PathFinder.search(entryPoint,midTarget,{
                    plainCost: 10,
                    swampCost: 11,
                    maxOps:5000,
                    roomCallback: function(roomName) {
                      let room = Game.rooms[roomName];
                      let isFief = false
                      let costs;
                      if(Memory.kingdom.fiefs[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                        isFief = true;
                      }
                      else if(Memory.kingdom.holdings[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                      }
                      else{
                        costs = new PathFinder.CostMatrix;
                      }
                      if (room && !isFief){
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
            }

        //For each key point, path from entry point to it. Then addthose roads to costmatrix, and path to other key points.
        //Take shortest total paths
        //Use center point as an option too?

        //For each key site we're targeting
        //console.log(keySites)
        
        
        
        keySites.forEach(site => {
            //For each key site position
            //Clear list of targets for this site
            thisTargets = [];
            //Clear route for this site
            thisRoute = []

            //If we have a valid midpoint, run a second set based on those checks
            if(midRoute.length){
                    //Get all secondary targets for this site
                keySites.forEach(target=>{
                    //If it isn't the current main site, add it to targets
                    if(!site.pos.isEqualTo(target.pos)){
                        thisTargets.push(target.pos);
                    }
                })
                //Initial pathfind for this site
                //Range 4 from controller so we try to keep from blocking traffic and don't pull too hard on pathfinding
                //Range 2 from sources so we try not to plan roads under cans.
                //let range = site.structureType === STRUCTURE_CONTROLLER ? 4 : 2;
                thisRoute.push(PathFinder.search(entryPoint, {pos:site.pos,range:1},{
                    // Minor plains preference
                    plainCost: 10,
                    swampCost: 11,
                    maxOps:5000,
                    roomCallback: function(roomName) {
                    let isFief = false;
                    let room = Game.rooms[roomName];
                    let costs;
                      if(Memory.kingdom.fiefs[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                        isFief = true;
                      }
                      else if(Memory.kingdom.holdings[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                      }
                      else{
                        costs = new PathFinder.CostMatrix;
                      }
                    //console.log("Calculating cost matrix for room",roomName)
                    if (room && !isFief){
                        //Set a buffer around controller and source
                        let sources = room.find(FIND_SOURCES);
                        sources.push(room.controller)
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
                                        if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall'){
                                            costs.set(tileX, tileY, 25);
                                        }
                                        
                                    }
                                }
                            }
                        })
                        
                        room.find(FIND_STRUCTURES).forEach(function(struct) {
                            if (struct.structureType === STRUCTURE_ROAD) {
                            // Strong roads preference
                            costs.set(struct.pos.x, struct.pos.y, 1);
                            }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                (struct.structureType !== STRUCTURE_RAMPART ||
                                 !struct.my)) {
                            // Can't walk through non-walkable buildings
                            costs.set(struct.pos.x, struct.pos.y, 0xff);
                            }
                        });
                    };
                    midRoute.forEach(spot =>{
                        if(spot.roomName == roomName){
                            costs.set(spot.x, spot.y, 1);
                        }
                    })
                    return costs;
                    },
                }).path);

                //All other secondary pathfinds
                thisTargets.forEach(target =>{
                    //let tRange = target.structureType === STRUCTURE_CONTROLLER ? 4 : 2;
                    thisRoute.push(PathFinder.search(entryPoint, {pos:target,range:1},{
                        // Minor plains preference
                        plainCost: 10,
                        swampCost: 11,
                        maxOps:5000,
                        roomCallback: function(roomName) {
                        let isFief = false;
                        let room = Game.rooms[roomName];
                        let costs;
                        if(Memory.kingdom.fiefs[roomName]){
                            costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                            isFief = true;
                        }
                        else if(Memory.kingdom.holdings[roomName]){
                            costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                          }
                        else{
                            costs = new PathFinder.CostMatrix;
                        }
                        if (room && !isFief){
                            //Set a buffer around controller and source
                            let sources = room.find(FIND_SOURCES);
                            sources.push(room.controller)
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
                                            if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall'){
                                                costs.set(tileX, tileY, 25);
                                            }
                                        }
                                    }
                                }
                            })
                            room.find(FIND_STRUCTURES).forEach(function(struct) {
                                if (struct.structureType === STRUCTURE_ROAD) {
                                // Strong roads preference
                                costs.set(struct.pos.x, struct.pos.y, 1);
                                }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                    (struct.structureType !== STRUCTURE_RAMPART ||
                                     !struct.my)) {
                                // Can't walk through non-walkable buildings
                                costs.set(struct.pos.x, struct.pos.y, 0xff);
                                }
                            });
                        };
                        
                        

                        //Add previously planned roads to route
                        thisRoute.forEach(route => {
                            route.forEach(spot =>{
                                if(spot.roomName == roomName){
                                    costs.set(spot.x, spot.y, 1);
                                }
                                
                            })
                        })
                        midRoute.forEach(spot =>{
                            if(spot.roomName == roomName){
                                costs.set(spot.x, spot.y, 1);
                            } 
                        })
                        return costs;
                        },
                    }).path);
                })


                //Add to total routes
                totalRoutes.push(thisRoute)
                thisTargets = [];
                //Clear route for this site
                thisRoute = []
            }
            
            //Get all secondary targets for this site
            keySites.forEach(target=>{
                //If it isn't the current main site, add it to targets
                if(!site.pos.isEqualTo(target.pos)){
                    thisTargets.push(target.pos);
                }
            })
            //console.log(site,"targeting",thisTargets)
            //Initial pathfind for this site
            //console.log("Routing from",entryPoint,"to",site.pos)
            thisRoute.push(PathFinder.search(entryPoint, {pos:site.pos,range:1},{
                // Minor plains preference
                plainCost: 10,
                swampCost: 11,
                maxOps:5000,
                roomCallback: function(roomName) {
                let isFief = false;
                let room = Game.rooms[roomName];
                let costs;
                if(Memory.kingdom.fiefs[roomName]){
                    costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                    isFief = true;
                }
                else if(Memory.kingdom.holdings[roomName]){
                    costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                  }
                else{
                    costs = new PathFinder.CostMatrix;
                }
                //console.log("Calculating cost matrix for room",roomName)
                if (room && !isFief){
                    //Set a buffer around controller and source
                    let sources = room.find(FIND_SOURCES);
                    sources.push(room.controller)
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
                                    if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall'){
                                        costs.set(tileX, tileY, 25);
                                    }
                                }
                            }
                        }
                    })
                    room.find(FIND_STRUCTURES).forEach(function(struct) {
                        if (struct.structureType === STRUCTURE_ROAD) {
                          // Strong roads preference
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
            }).path);

            //All other secondary pathfinds
            thisTargets.forEach(target =>{
                thisRoute.push(PathFinder.search(entryPoint, {pos:target,range:1},{
                    // Minor plains preference
                    plainCost: 10,
                    swampCost: 11,
                    maxOps:5000,
                    roomCallback: function(roomName) {
                      let isFief = false;
                      let room = Game.rooms[roomName];
                      let costs;
                    if(Memory.kingdom.fiefs[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                        isFief = true;
                    }
                    else if(Memory.kingdom.holdings[roomName]){
                        costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                      }
                    else{
                        costs = new PathFinder.CostMatrix;
                    }
                      if (room && !isFief){
                        //Set a buffer around controller and source
                        let sources = room.find(FIND_SOURCES);
                        sources.push(room.controller)
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
                                        if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall'){
                                            costs.set(tileX, tileY, 25);
                                        }
                                    }
                                }
                            }
                        })
                        room.find(FIND_STRUCTURES).forEach(function(struct) {
                            if (struct.structureType === STRUCTURE_ROAD) {
                              // Strong roads preference
                              costs.set(struct.pos.x, struct.pos.y, 1);
                            }else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                (struct.structureType !== STRUCTURE_RAMPART ||
                                 !struct.my)) {
                            // Can't walk through non-walkable buildings
                            costs.set(struct.pos.x, struct.pos.y, 0xff);
                            }
                          });
                      };
                      //Add previously planned roads to route
                      thisRoute.forEach(route => {
                        route.forEach(spot =>{
                            if(spot.roomName == roomName){
                                costs.set(spot.x, spot.y, 1);
                            }
                        })
                      })
                      return costs;
                    },
                }).path);
            })


            //Add to total routes
            totalRoutes.push(thisRoute)
            
        });

        //Tracking total shortest route
        let totalShortest = 999;
        let totalShortestRoute;
        //Tracking shortest to sources
        let sourceShortest = 999;
        let sourceShortestRoute;
        //Tracking shortest total of all in case of multiple shortest for sources
        let combinedShortest = 999;
        let combinedShortestRoute;

        //Calculate shortest route
        totalRoutes.forEach(set =>{
            let thisLength = 0;
            let thisSourceLength = 0;
            let short = false;
            //Set of sources that we have paths to
            let sourceSet = new Set()
            set.forEach(route =>{
                //Add length to total
                thisLength+= route.length;
                //If source path, add length to total. Also count sources and make sure we're hitting all of them
                sources.forEach(source =>{
                   if(source.pos.inRangeTo(route[route.length-1],1)){
                    thisSourceLength+= route.length;
                    sourceSet.add(source)
                   }
                })
            })
            //If shortest, record it
            if(thisLength < totalShortest){
                totalShortest = thisLength;
                totalShortestRoute = set;
                short = true;
            }
            //console.log("SOURCE LENGTH",thisSourceLength)
            //If shortest source route and it includes all sources, record it
            if(thisSourceLength < sourceShortest && sourceSet.size == sources.length){
                sourceShortest = thisSourceLength;
                sourceShortestRoute = set;
                //If also the shortest total route
                if(short){
                    combinedShortest = thisLength;
                    combinedShortestRoute = set;
                }
            }
        })
        let mLength=0;
        if(false && midRoute.length){
            midRoute.forEach(route =>{
                mLength += route.length;
            })
        }
        let endCPU = Game.cpu.getUsed() - startCPU;
        console.log("CPU Used",endCPU)
        
        Memory.testModule.routeRoad = {
            totalRoutes:totalRoutes,
            shortest:totalShortestRoute,
            sourceShortest:sourceShortestRoute,
            combinedShortest:combinedShortestRoute,
            shortestLength:combinedShortest
        }

        let returnArray = []
        //Each route in full array
        combinedShortestRoute.forEach(route =>{
            //Each spot in the route
            route.forEach(spot =>{
                returnArray.push(spot);
            })

        })
        return returnArray;
        /*Memory.testModule.routeRoad = {
            totalRoutes:totalRoutes,
            shortest:totalShortestRoute,
            sourceShortest:sourceShortestRoute,
            combinedShortest:combinedShortestRoute,
            shortestLength:combinedShortest,
            midRoute:midRoute,
            midLength:mLength,
            midpoint:midTarget
        }*/
        //Why

    },
    //Generates a distance transform for a room and sets it to test memory
    distanceTransform: function(roomName,initialCM = null){
        let distRoom = Game.rooms[roomName]
        let distCM = distRoom.distanceTransform(initialCM);
        
        return distCM;
        //Memory.test2 = distCM.serialize();
    },
    //Generates a room plan and sets it to test memory
    generateRoomPlan: function(roomName){
        //1 - 



        //CONSTANTS
        const CORE_DISTANCE_TRANSFORM_MINIMUM = 2;
        const CORE_ZONE_RADIUS = 1;
        const CONTROLLER_BUFFER_RADIUS = 1;
        const EXIT_BUFFER_RADIUS = 2;
        const EXIT_BUFFER_COST = 25;
        const CONTROLLER_BUFFER_COST = 25;
        const SOURCE_BUFFER_RADIUS = 1;
        const SOURCE_BUFFER_COST = 25;
        const MINERAL_BUFFER_RADIUS = 1;
        const MINERAL_BUFFER_COST = 25;

        const EXIT_WEIGHT = 1.5;
        const CONTROLLER_WEIGHT = 1.2;
        const SOURCE_WEIGHT = 0.5;
        const DISTANCE_WEIGHT = 1.2;

        Memory.testRoomPlanReference = {
            99:STRUCTURE_ROAD,
            88:STRUCTURE_TOWER,
            75:STRUCTURE_LAB,
            76:STRUCTURE_LAB,
            60:STRUCTURE_EXTENSION,
            33:STRUCTURE_SPAWN,
            44:STRUCTURE_NUKER,
            45:STRUCTURE_OBSERVER,
            98:STRUCTURE_STORAGE,
            97:STRUCTURE_FACTORY,
            96:STRUCTURE_POWER_SPAWN,
            95:STRUCTURE_LINK,
            94:STRUCTURE_TERMINAL
        };

        let roomPlanStage = Memory.roomPlanStage || 0;
        let room = Game.rooms[roomName];
        let sources = room.find(FIND_SOURCES);
        let exits = room.find(FIND_EXIT);
        let mineral = room.find(FIND_MINERALS)[0];
        let coreHub = [[STRUCTURE_POWER_SPAWN,STRUCTURE_FACTORY,STRUCTURE_TERMINAL],
        [STRUCTURE_ROAD,'hubFF',STRUCTURE_SPAWN],
        [STRUCTURE_STORAGE,STRUCTURE_ROAD,STRUCTURE_LINK]
        ];
        let ffStamp = [[STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,null],
        [STRUCTURE_EXTENSION,null,STRUCTURE_EXTENSION,null],
        [STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_CONTAINER,STRUCTURE_LINK],
        [null,STRUCTURE_EXTENSION,null,STRUCTURE_EXTENSION],
        [null,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION]];
        let startCPU = Game.cpu.getUsed();

        //Base plan object, organized by RCL
        //Structure is basePlan = {1:{STRUCTURE_EXTENSION:[{x:23,y:34},{x:22,y:45}],STRUCTURE_SPAWN:[{x:23,y:34},{x:22,y:45}]}}
        let basePlan = {}
        //Get distance transform to look for large open areas
        let distCM = Game.rooms[roomName].distanceTransform();
        //Empty CM to fill with region scores
        let regionCM = new PathFinder.CostMatrix;
        //Base plan CM
        let basePlanCM = new PathFinder.CostMatrix;
        //Get midpoint for a central location
        let midPoint = test.findPathCenterpoint(roomName)
        //Get controller weighted midpoint
        //let weightedPath = PathFinder.search(midPoint, {pos:Game.rooms[roomName].controller.pos,range:1},{plainCost:1,swampCost:1}).path;
        //let weightedMidPoint = weightedPath[Math.floor(weightedPath/2)]
        //Set to test 2 and 3 to see what we're working with
        Memory.test2 = distCM.serialize();
        Memory.test3 = midPoint;
        //Get wall groups
        //Record wall groups
        let wallGroups = test.getWallGroups(roomName);
        Memory.test4 = wallGroups
        //Record convex hulls for all groups
        //let hulls = test.getConvexHulls(wallGroups)
        //Memory.test5 = hulls
        //Record perimeter tiles for all groups
        let perimeterGroups = {};
        Object.keys(wallGroups).forEach(key=>{
            perimeterGroups[key] = test.findPerimeterTiles(wallGroups[key])
        });
        Memory.test6 = perimeterGroups;
        let terrain = Game.map.getRoomTerrain(roomName);

        //Exclusion zones for base planning
        //Controller exclusion - using flood fill so it doesn't cross walls
        test.generateBufferFloodFill(roomName,terrain,[room.controller.pos],basePlanCM,CONTROLLER_BUFFER_RADIUS)
        //Exit tile exclusion
        exits.forEach(exit =>{
            let pos = exit
            for(let x = -EXIT_BUFFER_RADIUS; x <= EXIT_BUFFER_RADIUS; x++) {
                for(let y = -EXIT_BUFFER_RADIUS; y <= EXIT_BUFFER_RADIUS; y++) {
                    // Skip the source tile itself
                    if(x === 0 && y === 0) continue;
            
                    const tileX = pos.x + x;
                    const tileY = pos.y + y;
            
                    // Make sure we don't go out of bounds (0-49 for both x and y)
                    if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                        //Make sure it isn't a wall
                        if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && basePlanCM.get(tileX,tileY) != 255){
                            basePlanCM.set(tileX, tileY, EXIT_BUFFER_COST);
                        }
                    }
                }
            }
        })
        //Mineral exclusion
        /*for(let x = -MINERAL_BUFFER_RADIUS; x <= MINERAL_BUFFER_RADIUS; x++) {
            for(let y = -MINERAL_BUFFER_RADIUS; y <= MINERAL_BUFFER_RADIUS; y++) {
                // Skip the mineral tile itself
                if(x === 0 && y === 0) continue;
        
                const tileX = mineral.pos.x + x;
                const tileY = mineral.pos.y + y;
        
                // Make sure we don't go out of bounds (0-49 for both x and y)
                if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                    //Make sure it isn't a wall and it isn't already set as a building
                    if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && basePlanCM.get(tileX,tileY) != 255){
                        basePlanCM.set(tileX, tileY, MINERAL_BUFFER_COST);
                    }
                }
            }
        }*/
        //Record open source spots
        let sourceSpots = {};
        sources.forEach(source =>{
            sourceSpots[source.id] = [];
            let pos = source.pos
            for(let x = -1; x <= 1; x++) {
                for(let y = -1; y <= 1; y++) {
                    // Skip the source tile itself
                    if(x === 0 && y === 0) continue;
            
                    const tileX = pos.x + x;
                    const tileY = pos.y + y;
            
                    // Make sure we don't go out of bounds (0-49 for both x and y)
                    if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                        //Make sure it isn't a wall, add to source spots array
                        if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall'){
                            sourceSpots[source.id].push({x:tileX,y:tileY})
                        }
                    }
                }
            }
        })





        //Find defects - Abandoning idea for now, became too complex for too little reward as all it was going to do was split wall groups.
        //Memory.test7 = test.findConvexDefects(hulls,perimeterGroups,terrain)

        //Exit flood fill
        let exitMatrix = test.generateDistanceFloodFill(roomName,terrain,exits)
        Memory.test7 = exitMatrix.serialize();

        //Controller flood fill
        let controllerMatrix = test.generateDistanceFloodFill(roomName,terrain,[room.controller.pos]);
        Memory.test8 = controllerMatrix.serialize();

        //Source flood fill
        console.log(room.find(FIND_SOURCES))
        let sourceMatrix = test.generateDistanceFloodFill(roomName,terrain,sources.map(source => source.pos));
        Memory.sourceMatrix = sourceMatrix.serialize();

        //Generate weighted cost matrix
        let combinedScoreMatrix = new PathFinder.CostMatrix
        //Track top scores and locations
        let topScore = 0;
        let topScoreLocations = [];

        //This whole thing needs to be a function that, if it doesn't return a location, messes with the weights
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                let exitScore = exitMatrix.get(x, y);
                let controllerScore = controllerMatrix.get(x, y);
                let sourceScore = sourceMatrix.get(x,y);
                let distanceScore = distCM.get(x,y);
    
                //If distance score is less than what we need for a core, skip
                if(distanceScore < CORE_DISTANCE_TRANSFORM_MINIMUM) continue;

                //If the core location is in a restricted area, skip
                if(basePlanCM.get(x,y) == 25) continue;

                //Combined score is the exit score minus controller score
                //Also adding distance transform score to prefer open areas

                //Maybe increase controller cost every 10 tiles away or so, making further bases increasingly negative
                let combinedScore = (exitScore*EXIT_WEIGHT) - (controllerScore*CONTROLLER_WEIGHT) - (sourceScore*SOURCE_WEIGHT) + (distanceScore*DISTANCE_WEIGHT);
                //Replace top score and locations if higher, if tied then add to top locations
                if(combinedScore > topScore){
                    topScore = combinedScore;
                    topScoreLocations = [{x:x,y:y}]
                }else if(combinedScore == topScore){
                    topScoreLocations.push({x:x,y:y})
                }
    
                combinedScoreMatrix.set(x, y, combinedScore);
            }
        }
        let coreLocation;
        //Take top location if only one, otherwise shortest distance
        console.log(topScoreLocations)
        if(topScoreLocations.length == 1){
            coreLocation = topScoreLocations[0];
        }else{
            let shortestScore = Infinity;
            let shortestSpot;
            let thisRange;
            let spares = []
            //For each spot, get the total distance to controller/sources
            topScoreLocations.forEach(spot=>{
                thisRange = 0;
                thisRange += getDistance(room.controller.pos,new RoomPosition(spot.x,spot.y,roomName))[0];
                sources.forEach(source=>{
                    thisRange += getDistance(source.pos,new RoomPosition(spot.x,spot.y,roomName))[0];
                });
                //If shortest, update
                if(thisRange < shortestScore){
                    shortestScore = thisRange;
                    shortestSpot = spot;
                    spares = []
                }
                //If tied, push to spares
                else if(thisRange == shortestScore){
                    spares.push(spot);
                }
            });

            if(!spares.length){
                coreLocation = shortestSpot;
            }else{
                //Tiebreaker
                //Group with the rest
                spares.push(shortestSpot);
                shortestScore = Infinity;

                spares.forEach(spot=>{
                    //Straight closest to controller wins. No care for ties
                    thisRange = getDistance(room.controller.pos,new RoomPosition(spot.x,spot.y,roomName))[0];
                    if(thisRange < shortestScore) shortestSpot = spot;
                });
                coreLocation = shortestSpot;

            }



        }





        //Wrap roads around storage
        for(let ny=-1;ny<=1;ny++){
            for(let nx=-1;nx<=1;nx++){
                if(coreLocation.x+nx > 0 && coreLocation.x+nx < 49 && coreLocation.y+ny > 0 && coreLocation.y+ny < 40){
                    if(terrain.get(coreLocation.x+nx,coreLocation.y+ny) != TERRAIN_MASK_WALL){
                        if(!(nx==0 && ny==0))basePlanCM.set(coreLocation.x+nx,coreLocation.y+ny,1);
                    }
                }
                
            }
        }
        basePlanCM.set(coreLocation.x,coreLocation.y,255)
        basePlan.storage={x:coreLocation.x,y:coreLocation.y};

        //Path roads
        basePlan.roads = {};
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);
        let sourcePaths = [];
        let controllerPath = PathFinder.search(storagePos,{pos:room.controller.pos,range:1},{
            // Same cost for everything because we're finding a centerpoint
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return basePlanCM;
            },
        }).path;
        controllerPath.forEach(spot=>{
            if(basePlanCM.get(spot.x,spot.y) == 0){
                basePlanCM.set(spot.x,spot.y,1)
            }
        });
        basePlan.roads.controller = controllerPath;
        sources.forEach(source => {
            let sourcePath = PathFinder.search(storagePos,{pos:source.pos,range:1},{
                // Same cost for everything because we're finding a centerpoint
                plainCost: 10,
                swampCost: 11,
                maxRooms:1,
                roomCallback: function() {
                  return basePlanCM;
                },
            }).path;
            //Remove the last spot in the path
            let lastSpot = sourcePath.pop();
            //Assign a value of 25 to mark it as a harvest spot.
            basePlanCM.set(lastSpot.x,lastSpot.y,25)
            sourcePath.forEach(spot=>{
                if(basePlanCM.get(spot.x,spot.y) == 0){
                    basePlanCM.set(spot.x,spot.y,1)
                }
            });
            //Push the path
            sourcePaths.push(sourcePath);
            //Designate link spot next to harvest spot. Checking within available tiles first.
            let sourceLinkSpot;
            let someSpot;

            sourceLoop:
            for(let ny=-1;ny<=1;ny++){
                for(let nx=-1;nx<=1;nx++){
                    //If not wall and not road
                    console.log("Is spot terrain",lastSpot.x+nx,lastSpot.y+ny,terrain.get(lastSpot.x+nx,lastSpot.y+ny))
                    console.log("Base plan score",lastSpot.x+nx,lastSpot.y+ny,basePlanCM.get(lastSpot.x+nx,lastSpot.y+ny))
                    if(terrain.get(lastSpot.x+nx,lastSpot.y+ny) != TERRAIN_MASK_WALL && basePlanCM.get(lastSpot.x+nx,lastSpot.y+ny) != 1){
                        //If not the source itself
                        if(!(nx==0 && ny==0)){
                            console.log("Testing source spot",lastSpot.x+nx,lastSpot.y+ny)
                            console.log(!someSpot,'for if there is a somespot')
                            //Somespot is our backup. If nothing assigned yet, and this space is valid, assign it
                            if(!someSpot) someSpot = {x:lastSpot.x+nx,y:lastSpot.y+ny}
                            //Otherwise, we try to find one that's also 1 space from the link to keep things compact
                            sourceSpots[source.id].forEach(sourceSpot =>{
                                if(sourceSpot.x == lastSpot.x+nx && sourceSpot.y == lastSpot.y+ny && !sourceLinkSpot){
                                    sourceLinkSpot = {x:lastSpot.x+nx,y:lastSpot.y+ny};
                                }
                            });
                            //If we found a match, break out
                            if(sourceLinkSpot) break sourceLoop;
                        }
                    }
                }
            }
            //If no link spot, assign some spot
            if(!sourceLinkSpot && someSpot) sourceLinkSpot = someSpot;
            //Mark in CM
            basePlanCM.set(sourceLinkSpot.x,sourceLinkSpot.y,95);
            console.log('Setting spot',sourceLinkSpot.x,sourceLinkSpot.y,'as link')
        });
        basePlan.roads.sources = sourcePaths;
        let mineralPath = PathFinder.search(storagePos,{pos:room.find(FIND_MINERALS)[0].pos,range:1},{
            // Same cost for everything because we're finding a centerpoint
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return basePlanCM;
            },
        }).path;
        //Remove the last spot in the path
        let lastSpot = mineralPath.pop();
        //Assign a value of 25 to mark it as a harvest spot.
        basePlanCM.set(lastSpot.x,lastSpot.y,25)
        mineralPath.forEach(spot=>{
            if(basePlanCM.get(spot.x,spot.y) == 0){
                basePlanCM.set(spot.x,spot.y,1)
            }
        });
        basePlan.roads.mineral = mineralPath;


        //Array of RoomPosition objects for the flood fill
        let coreRoomPositions = [];

        Memory.testBasePlan = basePlan;
        Memory.test9 = combinedScoreMatrix.serialize();
        Memory.test10 = coreLocation;

        let secondDist = new PathFinder.CostMatrix();
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                const tile = terrain.get(x, y);
                const weight =
                    tile === TERRAIN_MASK_WALL  ? 255 : // wall  => unwalkable
                    tile === TERRAIN_MASK_SWAMP ?   5 : // swamp => weight:  5
                                                    1 ; // plain => weight:  1
                secondDist.set(x, y, weight);
            }
        }

        //Set distance transform weight to 255 for the hub zone and get another cost matrix
        //Also using this to generate room positions
        for (let x=-CORE_ZONE_RADIUS; x<=CORE_ZONE_RADIUS; x++){
            for (let y=-CORE_ZONE_RADIUS;y<=CORE_ZONE_RADIUS;y++){
                secondDist.set(coreLocation.x+x,coreLocation.y+y,255)
                coreRoomPositions.push(new RoomPosition(coreLocation.x+x,coreLocation.y+y,roomName))
            }
        }

        distCM = test.distanceTransform(roomName,secondDist);
        Memory.test2 = distCM.serialize();

        


        Memory.testBasePlanCM = basePlanCM.serialize();


        let structureBlobCM = test.generateStructureFloodFill(roomName,terrain,coreRoomPositions,basePlanCM);
        //Possible structure positions, excluding planned roads and the core
        

        test.connectStructures(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitMatrix)
        

        
        //test.assignSpawns(roomName,terrain,basePlanCM,structureBlobCM)
        //test.assignTowers(roomName,terrain,basePlanCM,structureBlobCM)
        //test.assignRemainingStructures(roomName,terrain,basePlanCM,structureBlobCM,basePlan)
        test.assignStructures(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitMatrix);
        test.assignLabs(roomName,terrain,basePlanCM,structureBlobCM)
        
        //Set weights for the core
        structureBlobCM.set(basePlan.storage.x,basePlan.storage.y,98);
        //structureBlobCM.set(basePlan.factory.x,basePlan.factory.y,97);
        //structureBlobCM.set(basePlan.powerSpawn.x,basePlan.powerSpawn.y,96);
        //structureBlobCM.set(basePlan.link.x,basePlan.link.y,95);
        //structureBlobCM.set(basePlan.terminal.x,basePlan.terminal.y,94);
        //structureBlobCM.set(basePlan.spawn.x,basePlan.spawn.y,33);

        //Get mincut cm
        let mincutCM = new PathFinder.CostMatrix;
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                if(terrain.get(x, y) == TERRAIN_MASK_WALL){
                    mincutCM.set(x,y,255);
                }
                else{
                    mincutCM.set(x,y, (50 + distCM.get(x,y) - exitMatrix.get(x,y)) )
                }
            }
        }

        testMinCut(roomName,structureBlobCM,mincutCM)

        Memory.testStructureBlobCM = structureBlobCM.serialize();

        //After initial structure connection, will need to generate more paths to make sure everything is connected
        //Then go back and gather any more structures we might need


        //Next steps
        //Droid's method for lab stamps after structure placement
        //Flood fill for structure placement
        // - Minimum spanning tree type method for roads:
        //Get all structure sites connected to a road, add them to array `connected`, all others to array `disconnected`
        //Take all roads and weight them based on how many structures are connected to them, 0-7
        //Starting at the highest weight, check all surrounding tiles to see if we connect with any disconnected structures and 0 other roads.
        //If so, take highest number of structure additions and make that a new road tile. If tied, prefer not converting a structure.
        //Update weights on roads. The original road tile we branched from loses 1 weight if we converted a structure, add weight and tile for the new one.
        //Repeat until our total connected structures meets the total number of structures required (80 - 60 Extensions, 10 Labs, 6 Towers, 3 Spawns, 1 Nuker)


        

        //Log the CPU used
        console.log("CPU Used:",Game.cpu.getUsed()-startCPU);
        //Save a flag to commence stage 2
        Memory.roomPlanComplete = false;
        Memory.roomPlanRoomName = roomName;
    },
    generateRoomPlanStage2: function(roomName){
        Memory.roomPlanComplete = true; //Assuming we're just doing 2 stages for now.
        //Final plan should have each step increment the progress by 1, and the progress number dictates what we do
        let room = Game.rooms[roomName];
        let sources = room.find(FIND_SOURCES);
        let mineral = room.find(FIND_MINERALS)[0];
        let terrain = Game.map.getRoomTerrain(roomName);
        let basePlan = Memory.testBasePlan;

        let startPos = [basePlan.storage]
        
        startPos = room.find(FIND_MY_STRUCTURES,{
            filter: (structure) => [STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_LAB,STRUCTURE_TOWER].includes(structure.structureType)
        }).map(struct => struct.pos)
        //Flood fill from key structures. 0s if no adjacent terrain. If wall, is adjacent it becomes 1. If another flood fill hits and sees that 1, then the 1 becomes 2 and that spot
        //in the second flood fill becomes 1.
        //Keep flood filling until it finds no more 0s
        let scoreCM = test.floodFillWithScores(startPos,roomName,terrain);
        //floodCM = repeatFloodFill(roomName,terrain,basePlan.storage,scoreCM);
        //repeatFloodFill(roomName,terrain,basePlan.storage,scoreCM);
        Memory.rampartTestCM = scoreCM.serialize();



    },
    getClosestDTScore: function(startX,startY,distCM,terrain,targetScore){
        const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]]; // 8-directional movement
        let queue = [[startX, startY]];
        let visited = new Set([`${startX},${startY}`]);
        let score;
        
        score = distCM.get(startX, startY); // Initialize starting point score
      
        while (queue.length > 0) {
          let [x, y] = queue.shift();
          
          
          for (let [dx, dy] of directions) {
            let nx = x + dx, ny = y + dy;
            
            if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && !visited.has(`${nx},${ny}`) && terrain.get(nx,ny) != TERRAIN_MASK_WALL) { // Check if tile is valid for movement
              visited.add(`${nx},${ny}`);
              if(distCM.get(nx, ny) >= targetScore) return [nx, ny]
              queue.push([nx, ny]);
            }
          }
        }
        return -1
    },
    getWallGroups: function(roomName){
        let startCPU = Game.cpu.getUsed();
        //Flood fill room to get all groups of wall terrain
        //Use Graham Scan convex hull algorithm to map perimeter around all wall groups
        //Each wall group is treated as a single point, so will need to find closest points between each.
        //Pathfinder with inverted cost matrix should be able to do this

        //Get room terrain for flood fill
        let terrain = Game.map.getRoomTerrain(roomName);
        //Set up assignments for tiles and wall groups
        const processed = Array(50).fill().map(() => Array(50).fill(false));
        const wallGroups = {};
        let currentGroupId = 0;

        //Flood fill
        function floodFill(x, y) {
            if (x < 0 || x >= 50 || y < 0 || y >= 50) return; // Out of bounds
            if (processed[x][y] || terrain.get(x, y) !== TERRAIN_MASK_WALL) return; // Already processed or not wall
    
            processed[x][y] = true; // Mark as processed
            wallGroups[currentGroupId].push({x, y});
    
            // Explore neighboring cells
            floodFill(x+1, y);
            floodFill(x-1, y);
            floodFill(x, y+1);
            floodFill(x, y-1);
        }
    
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (!processed[x][y] && terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    wallGroups[currentGroupId] = [];
                    floodFill(x, y);
                    currentGroupId++;
                }
            }
        }
        
        



        //console.log(Object.keys(wallGroups))
        //Log the CPU used
        //console.log("CPU Used:",Game.cpu.getUsed()-startCPU);
        return wallGroups;
    },
    getConvexHulls: function(wallGroups){
        
        function getConvexHull(points) {
            // Find the point with the lowest y (and then x) coordinate
            const start = points.reduce((lowest, point) => {
                return (point.y < lowest.y || (point.y === lowest.y && point.x < lowest.x)) ? point : lowest;
            }, points[0]);
        
            // Sort points by the angle with the start point
            points.sort((a, b) => {
                const angleA = Math.atan2(a.y - start.y, a.x - start.x);
                const angleB = Math.atan2(b.y - start.y, b.x - start.x);
                if (angleA === angleB) {
                    // If the angles are the same, sort by distance from 'start'
                    return (a.x - start.x) ** 2 + (a.y - start.y) ** 2 - (b.x - start.x) ** 2 - (b.y - start.y) ** 2;
                }
                return angleA - angleB;
            });
        
            // The main step of the Graham Scan algorithm
            const hull = [start];
            for (let i = 1; i < points.length; i++) {
                let top = hull[hull.length - 1];
                while (hull.length >= 2 && crossProduct(hull[hull.length - 2], top, points[i]) < 0) {
                    hull.pop(); // Pop the last point because it's not part of the convex hull
                    top = hull[hull.length - 1];
                }
                hull.push(points[i]);
            }
            // Ensure the hull is closed by adding the start point if necessary
            if (!hull.includes(start)) {
                hull.push(start);
            }
        
            return hull;
        }

        function crossProduct(p1, p2, p3) {
            return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
        }
        
        //wallGroups object structure
        //wallGroups = {
            //1:[{x:14,y:18},{x:14,y:19},{x:15,y:19}],
            //2:[{x:24,y:28},{x:24,y:29},{x:25,y:29}],
        //};
        
        let convexHulls = {};
        for (let groupId in wallGroups) {
            convexHulls[groupId] = getConvexHull(wallGroups[groupId]);
        }
        return convexHulls;
    },
    findPerimeterTiles: function(wallGroup){
        const isWallTile = (x, y) => wallGroup.some(tile => tile.x === x && tile.y === y);
        const perimeterTiles = [];
    
        const directions = [
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 },  // Down
            // Uncomment below for diagonal checks
            { dx: -1, dy: -1 }, // Top-left
            { dx: 1, dy: -1 },  // Top-right
            { dx: -1, dy: 1 },  // Bottom-left
            { dx: 1, dy: 1 },   // Bottom-right
        ];
    
        wallGroup.forEach(tile => {
            for (const { dx, dy } of directions) {
                const neighborX = tile.x + dx;
                const neighborY = tile.y + dy;
                if (!isWallTile(neighborX, neighborY) && (neighborX>=0 && neighborX<=49) && (neighborY>=0 && neighborY<=49)) {
                    perimeterTiles.push(tile);
                    break; // Break since one non-wall neighbor is enough to confirm it's a perimeter tile
                }
            }
        });
    
        return perimeterTiles;
    },
    findConvexDefects: function(hulls,perimeterGroups,terrain){

        let hullDefects = {};
        for(let groupId in hulls){
            hullDefects[groupId] = floodFillFromHullWithConstraint(hulls[groupId],perimeterGroups[groupId],terrain)
        }
        return hullDefects;

        function getBoundingBox(points) {
            let minX = 999, maxX = -999, minY = 999, maxY = -999;
        
            //1 tile border so the flood fill can maneuver around
            points.forEach(point => {
                if (point.x < minX) minX = point.x;
                if (point.x > maxX) maxX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.y > maxY) maxY = point.y;
            });
        
            // The bounding box can be represented by the top-left and bottom-right corners
            //console.log("Bounding box is",minX,minY,maxX,maxY)
            return {
                topLeft: { x: minX, y: minY },
                bottomRight: { x: maxX, y: maxY }
            };
        }

        function isPointWithinBoundingBox(point, boundingBox) {
            return point.x >= boundingBox.topLeft.x && point.x <= boundingBox.bottomRight.x &&
                   point.y >= boundingBox.topLeft.y && point.y <= boundingBox.bottomRight.y;
        }

        function floodFillFromHull(hullPoints, perimeterTiles, terrain) {
            let defectDistances = new Map(); // Key: `${x},${y}`, Value: distance
            const directions = [
                {dx: 1, dy: 0}, {dx: -1, dy: 0}, // Horizontal
                {dx: 0, dy: 1}, {dx: 0, dy: -1}, // Vertical
            ];
            let boundingBox = getBoundingBox(hullPoints);
        
            hullPoints.forEach(hullPoint => {
                let queue = [{ ...hullPoint, distance: 0 }];
                let visited = new Set([`${hullPoint.x},${hullPoint.y}`]);
        
                while (queue.length > 0) {
                    let { x, y, distance } = queue.shift();
        
                    directions.forEach(({ dx, dy }) => {
                        let nx = x + dx, ny = y + dy;
                        let key = `${nx},${ny}`;
                        //console.log("Checking",nx,ny,"- Visited:",visited.has(key),"- Within bounding box:",isPointWithinBoundingBox({ x: nx, y: ny }, boundingBox))
                        if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && !visited.has(key) && isPointWithinBoundingBox({ x: nx, y: ny }, boundingBox)) {
                            if (terrain.get(nx,ny) != TERRAIN_MASK_WALL) { // Assuming 'terrain' indicates tile types
                                visited.add(key);
                                queue.push({ x: nx, y: ny, distance: distance + 1 });
        
                                // If this is a perimeter tile, update its recorded distance if this path is shorter
                                let existingDistance = defectDistances.get(key);
                                if (/*perimeterTiles.some(t => t.x === nx && t.y === ny) && */(existingDistance === undefined || distance + 1 < existingDistance)) {
                                    defectDistances.set(key, distance + 1);
                                }
                            }
                        }
                    });
                }
            });
        
            // Convert defectDistances to a more usable format, if necessary
            let defectTiles = [];
            defectDistances.forEach((distance, key) => {
                let [x, y] = key.split(',').map(Number);
                defectTiles.push({x, y, distance});
            });
            return defectTiles; // Each tile now has an associated minimum distance from the convex hull
        }

        //Flood Fill Restraint Functions Below, Original Flood Fill Functions Above
        function isPointInsideHull(point, hull) {
            let intersections = 0;
            for (let i = 0; i < hull.length; i++) {
                let start = hull[i];
                let end = hull[(i + 1) % hull.length]; // Ensure the hull is closed by wrapping around
        
                // Check if the line segment from start to end intersects with a ray to the right from the point
                if ((start.y > point.y) !== (end.y > point.y)) { // One endpoint is above the point, and one is below
                    // Compute the X coordinate of the intersection
                    let intersectX = start.x + (point.y - start.y) * (end.x - start.x) / (end.y - start.y);
                    if (point.x < intersectX) { // The intersection is to the right of the point
                        intersections++;
                    }
                }
            }
        
            return intersections % 2 === 1; // Inside if odd, outside if even
        }

        function floodFillFromHullWithConstraint(hull,perimeterTiles, terrain) {
            let visited = new Set();
            let fillArea = [];
        
            hull.forEach(hullPoint => {
                let queue = [{ ...hullPoint, distance: 0 }];
                visited.add(`${hullPoint.x},${hullPoint.y}`);
        
                while (queue.length > 0) {
                    let { x, y, distance } = queue.shift();
        
                    // Check orthogonal directions
                    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                        let nx = x + dx, ny = y + dy;
                        let key = `${nx},${ny}`;
                        //Allowing a buffer distance of 2 tiles (starting at 0) to ensure we wrap all the way around
                        if (!visited.has(key) && (distance < 2 || isPointInsideHull({x: nx, y: ny}, hull)) && terrain.get(nx,ny) != TERRAIN_MASK_WALL) {
                            visited.add(key);
                            queue.push({ x: nx, y: ny, distance: distance + 1 });
                            fillArea.push({ x: nx, y: ny, distance });
                        }
                    });
                }
            });
        
            return fillArea; // Points within the hull area with their distances from the starting hull points
        }


        ////Attempt 2

        /*function calculateDistance(pointA, pointB) {
            return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2));
        }
        function pointToLineSegmentDistance(point, segmentStart, segmentEnd) {
            const l2 = Math.pow(segmentEnd.x - segmentStart.x, 2) + Math.pow(segmentEnd.y - segmentStart.y, 2); // Length of the line segment squared
            if (l2 === 0) return calculateDistance(point, segmentStart); // The segment is just a point
            
            let t = ((point.x - segmentStart.x) * (segmentEnd.x - segmentStart.x) + (point.y - segmentStart.y) * (segmentEnd.y - segmentStart.y)) / l2;
            t = Math.max(0, Math.min(1, t)); // Clamp t to the range [0, 1]
            
            const projection = { // Projection of the point onto the line (or its closest point within the segment)
                x: segmentStart.x + t * (segmentEnd.x - segmentStart.x),
                y: segmentStart.y + t * (segmentEnd.y - segmentStart.y)
            };
            
            return calculateDistance(point, projection);
        }
        function findMinDistancesToHullLines(perimeterGroup, hull) {
            let minDistances = perimeterGroup.map(tile => {
                let minDistance = Infinity;
        
                for (let i = 0; i < hull.length; i++) {
                    const start = hull[i];
                    const end = hull[(i + 1) % hull.length]; // Ensure the hull is closed by connecting the last point to the first
                    
                    const distance = pointToLineSegmentDistance(tile, start, end);
                    minDistance = Math.min(minDistance, distance);
                }
        
                return { tile, distance: minDistance };
            });
        
            return minDistances;
        }
        function findFurthestDefectTiles(minDistances) {
            let maxDistance = Math.max(...minDistances.map(item => item.distance));
            return minDistances.filter(item => item.distance === maxDistance).map(item => item.tile);
        }

        let defectTiles = {}

        // Assuming defectTiles is structured similarly to your other objects, with group IDs as keys
        Object.keys(perimeterGroups).forEach(groupId => {
            const hull = hulls[groupId]; // Assuming 'hulls' is available and contains the convex hulls
            const perimeterGroup = perimeterGroups[groupId];

            const minDistances = findMinDistancesToHullLines(perimeterGroup, hull);
            const furthestTiles = findFurthestDefectTiles(minDistances);
            defectTiles[groupId] = furthestTiles;
            //console.log(`Group ${groupId} furthest defect tiles from hull lines:`, furthestTiles);
        });

        return defectTiles;*/

        //////Attempt 1

        /*function calculateDistance(pointA, pointB) {
            return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2));
        }
        function findMinDistancesToHull(perimeterTiles, hull) {
            let minDistances = perimeterTiles.map(perimeterTile => {
                let minDistance = Infinity;
        
                hull.forEach(hullPoint => {
                    const distance = calculateDistance(perimeterTile, hullPoint);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                });
        
                return { tile: perimeterTile, distance: minDistance };
            });
        
            return minDistances;
        }
        function findFurthestPerimeterTiles(minDistances) {
            let maxDistance = Math.max(...minDistances.map(item => item.distance));
            return minDistances.filter(item => item.distance === maxDistance).map(item => item.tile);
        }

        let defectTiles = {}

        Object.keys(wallGroups).forEach(groupId => {
            const hull = hulls[groupId];
            const perimeterTiles = perimeterGroups[groupId];
        
            const minDistances = findMinDistancesToHull(perimeterTiles, hull);
            const furthestTiles = findFurthestPerimeterTiles(minDistances);
            defectTiles[groupId] = furthestTiles;
        });

        return defectTiles;*/

    },
    minCut: function(roomName,testObject){
        const sources = [Game.getObjectById(testObject)];
        //const sinks = [x3, y3, x4, y4 /* ... */ ];

        const data = new PathFinder.CostMatrix();
        // ... set data CostMatrix values
        
        // create minCut
        const minCut = new MinCut(
            (x, y) => data.get(x, y) !== UNPATHABLE, // isPathableCallback
            50, 50, // width, height
            sources//, sinks // sources (optional), sinks (optional)
        );
        // add sources and sinks if necessary
        //minCut.addSource(x5, y5);
        //minCut.addSink(x6, y6);

        // run minCut
        const maxFlow = minCut.run();
        console.log('maxFlow:', maxFlow);

        // get label for coords. MINCUT_UNPATHABLE | MINCUT_SINK | MINCUT_SOURCE | MINCUT_FREE
        const label = minCut.getLabel(x, y);

        // visualize
        const visual = new RoomVisual(roomName);
        for (let x = 0; x <= 49; x++) {
            for (let y = 0; y <= 49; y++) {
                const label = minCut.getLabel(x, y);
                if (label !== MINCUT_UNPATHABLE) { // 255
                    let color = 'white';
                    if (label === MINCUT_SINK) { // 2
                        color = '#ff4232';
                    } else if (label === MINCUT_SOURCE) { // 1
                        color = 'yellow';
                    }
                    visual.circle(x, y, {radius: 0.2, fill: color, opacity: 0.6});
                }
            }
        }

    },
    generateDistanceFloodFill: function(roomName,terrain,origins){
        let startCPU = Game.cpu.getUsed();
        let costMatrix = new PathFinder.CostMatrix;
        let room = Game.rooms[roomName];
        const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]];
        let queue = [];
        
        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit, distance: 1});
            costMatrix.set(exit.x, exit.y, 1);
        });
    
        while (queue.length > 0) {
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos, room); // Now implemented
    
            adjacentTiles.forEach(({x, y}) => {
                
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    let currentDistance = costMatrix.get(x, y);
                    if (currentDistance === 0 || currentDistance > tile.distance + 1) {
                        costMatrix.set(x, y, tile.distance + 1);
                        queue.push({pos: new RoomPosition(x, y, room.name), distance: tile.distance + 1});
                    }
                }
            });
        }

        function findAdjacentTiles(pos) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            directions.forEach(direction => {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                if (x >= 0 && x < 50 && y >= 0 && y < 50) { // Check if within bounds
                    tiles.push({x: x, y: y});
                }
            });
            return tiles;
        }
        console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
        return costMatrix;
    },
    generateStructureFloodFill: function(roomName,terrain,origins,basePlanCM){
        let startCPU = Game.cpu.getUsed();
        let costMatrix = new PathFinder.CostMatrix;
        let room = Game.rooms[roomName];
        const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]];
        let queue = [];
        let totalTiles = 0;
        let targetTiles = 700;
        let structurePositions = [];
        
        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit});
        });
    
        while (queue.length > 0 && totalTiles < targetTiles) {
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos, room); // Now implemented
    
            adjacentTiles.forEach(({x, y}) => {
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    
                    let tileScore = costMatrix.get(x, y);
                    //If tile isn't scored yet
                    if(tileScore === 0){
                        //If 0 in the base plan, set to 1 as a buildable tile
                        if (basePlanCM.get(x,y) == 0) {
                            costMatrix.set(x, y,1);
                            queue.push({pos: new RoomPosition(x, y, room.name)});
                            totalTiles++;
                        }
                        //Else if 1 in the base plan, include in the blob as a planned road
                        else if (basePlanCM.get(x,y) == 1) {
                            costMatrix.set(x, y,99);
                            queue.push({pos: new RoomPosition(x, y, room.name)});
                            totalTiles++;
                        }
                        //Else if 95, include it as a link
                        else if(basePlanCM.get(x,y) == 95){
                            costMatrix.set(x, y,95);
                            queue.push({pos: new RoomPosition(x, y, room.name)});
                            totalTiles++;
                        }
                    }
                    
                }
            });
        }

        function findAdjacentTiles(pos) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            directions.forEach(direction => {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                if (x >= 0 && x < 50 && y >= 0 && y < 50) { // Check if within bounds
                    tiles.push({x: x, y: y});
                }
            });
            return tiles;
        }
        console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
        return costMatrix;
    },
    generateBufferFloodFill: function(roomName,terrain,origins,basePlanCM,loopMax=3){
        let startCPU = Game.cpu.getUsed();
        let costMatrix = new PathFinder.CostMatrix;
        let room = Game.rooms[roomName];
        let queue = [];
        let loop = 0;

        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit, distance: 0});
        });
    
        while (queue.length > 0 && loop <= loopMax) {
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos, room); // Now implemented
    
            adjacentTiles.forEach(({x, y}) => {
                
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    let tileScore = costMatrix.get(x, y);
                    if (tileScore === 0 && basePlanCM.get(x,y) == 0) {
                        costMatrix.set(x, y, tile.distance + 1);
                        basePlanCM.set(x,y,25);
                        queue.push({pos: new RoomPosition(x, y, room.name), distance: tile.distance + 1});
                    }
                }
            });
            loop++;
        }

        function findAdjacentTiles(pos) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            directions.forEach(direction => {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                if (x >= 0 && x < 50 && y >= 0 && y < 50) { // Check if within bounds
                    tiles.push({x: x, y: y});
                }
            });
            return tiles;
        }
        console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
        return costMatrix;
    },
    connectStructures: function(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitTileCM){
        const STRUCTS_NEEDED = 600; //85 Actual structures - (60 Extensions, 10 Labs, 6 Towers, 3 Spawns, 1 Nuker, 1 Factory, 1 Link, 1 Terminal, 1 Power Spawn, 1 Observer)
        const ALPHA = 1.5; //Multiplier to tile weight - Higher multipliers make high weight tiles more valuable
        const BETA = 2.6;  //Multiplier to tile range - Higher multipliers make close range tiles more valuable
        const ROMEO = 1.8; //Multiplier to exit distance - Higher multipliers make tiles further from exits more valuable
        let roadTiles = [];
        let connectedStructures = 0;
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);
    
        //Get all road tiles and add valid adjacent positions to connectedStructures
        //Change score in blob CM for connected structures
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                let planTile = basePlanCM.get(x,y);
                //If the tile is a preplanned structure
                if(planTile == 255) structureBlobCM.set(x,y,255)
                //If the tile in the plan is a road
                if(planTile == 1){
                    //Mark 99 in the blob so we can see it
                    //99 is for full roads, which planned roads are
                    structureBlobCM.set(x,y,99)
                    //Get all adjacent structures
                    let [adjacentStructs,adjacentCount] = findAdjacentStructs({x:x,y:y},structureBlobCM,terrain);
                    //Increase connected structures by adjacent count
                    connectedStructures += adjacentStructs.length;
                    //Add this tile to road tiles, with a weight according to how many were adjacent and range to storage
                    roadTiles.push({x:x,y:y,weight:adjacentCount,range:storagePos.findPathTo(x,y).length})
                    //Mark all new tiles in the blob CM as adjacent
                    adjacentStructs.forEach(spot =>{
                        structureBlobCM.set(spot.x,spot.y,50);
                    })
                }
            }
        }

        //Sort the road tiles by weight, then range
        roadTiles.sort((a, b) => {
            let scoreA = (a.weight * ALPHA) - (BETA * a.range) + (ROMEO * exitTileCM.get(a.x, a.y));
            let scoreB = (b.weight * ALPHA) - (BETA * b.range) + (ROMEO * exitTileCM.get(a.x, a.y));
          
            return scoreB - scoreA; // For descending order
          });
        //Start looking through the highest weighted road tiles to find the most new adjacencies possible
        let nextRoad;
        let highestCount = 0;
        let highestStructs;
        let highestPick;
        let roadCount = 0;
        let safety = 0;
        let nextStructs = [];
        let nextCount = 0;
        while(connectedStructures < STRUCTS_NEEDED && safety < 400){
            safety++
            //Reset counts
            highestCount = 0;
            newRoad = null;
            highestSTructs = [];
            highestPick = null;
            nextStructs = [];
            nextCount = 0;
            //Pop off the highest weight road
            nextRoad = roadTiles.shift();
            if(!nextRoad) break;
            //For all adjacent tiles, get the total structures added and keep track of the best one
            for (let x=-1; x<=1; x++){
                for (let y=-1;y<=1;y++){
                    //nextStructs is an array of all the new structures
                    //nextCount is a list of total surrounding structures
                    [nextStructs,nextCount] = findAdjacentStructs({x:nextRoad.x+x,y:nextRoad.y+y},structureBlobCM,terrain);
                    //Compare nextStructs length, as we care about new structures, not total
                    if(nextStructs.length > highestCount){
                        newRoad = {x:nextRoad.x+x,y:nextRoad.y+y,weight:nextCount,range:storagePos.findPathTo(nextRoad.x+x,nextRoad.y+y).length};
                        highestCount = nextStructs.length;
                        highestStructs = nextStructs;
                        highestPick = { x:nextRoad.x+x, y:nextRoad.y+y, score:structureBlobCM.get(nextRoad.x+x,nextRoad.y+y) }
                    }
                }
            }

            //If this was a bad tile and we have nothing new, continue
            if(newRoad == null) continue;

            //With the best option found, convert everything.
            //First, if the tile we picked was a structure, turn it into a temporary road and decrease the counter by 1
            //Temporary roads get 89
            if(highestPick.score == 50){
                structureBlobCM.set(highestPick.x,highestPick.y,89);
                connectedStructures--;
            }
            //Set all new structure positions and increase the counter by how many new structures we have
            highestStructs.forEach(spot=>{
                structureBlobCM.set(spot.x,spot.y,50);
            });
            connectedStructures += highestCount;
            //Add the new road tile to the array in proper position
            let newItemScore = (newRoad.weight * ALPHA) - (BETA * newRoad.range) + (ROMEO * exitTileCM.get(newRoad.x, newRoad.y));
            let position = roadTiles.findIndex(item => ((item.weight * ALPHA) - (BETA * item.range) + (ROMEO * exitTileCM.get(item.x, item.y))) < newItemScore);
            
            if (position === -1) {
              // If no such position exists, the new item has the lowest score, so add it to the end
              roadTiles.push(newRoad);
            } else {
              // Otherwise, insert the new item at the found position
              roadTiles.splice(position, 0, newRoad);
            }
            
            
            
            //let pos = roadTiles.findIndex(x => x.weight < newRoad.weight);
  
            // If pos is -1, item.weight is less than all values (or array is empty),
            // so we push it. Otherwise, we splice it in at the found position.
            //if (pos === -1) roadTiles.push(newRoad);
            //else {roadTiles.splice(pos, 0, newRoad);}
        
            //console.log('Road picked',JSON.stringify(nextRoad));
            //console.log('Structures added ',highestCount)
            //console.log(highestStructs)
            //highestStructs.forEach(spot=>{
                //console.log(JSON.stringify(spot))
            //});
            //if(safety == 4)break;
        
        
        
        }

        function findAdjacentStructs(pos,structureBlobCM,terrain) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            let count = 0;
            directions.forEach(direction => {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) { // Check if within bounds
                    if(![0,255,99,89,95].includes(structureBlobCM.get(x,y))){
                        //If it's the first call, only push to tiles if it's actually new and needs marked in the CM, otherwise just up count
                        if(structureBlobCM.get(x,y) != 50){
                            tiles.push({x: x, y: y});
                        }
                        count++
                    }
                    //Return nothing if one of the adjacent tiles is a road
                    //if(structureBlobCM.get(x,y) == 99) return[[],0]
                }
            });
            return [tiles,count];
        }


    },
    assignLabs: function(roomName,terrain,basePlanCM,structureBlobCM){
        //Second source lab spots
        let sourceOptions = [
            [1,0],[2,0],[3,0],
            [-1,1],[0,1],[1,1],
            [0,2],[0,3]
        ];
        let labs = [];
        let sourceLabs = [];
        //Go through every extension tile in structureBlobCM and see if we can make its group a lab
        labLoop:
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                let planTile = structureBlobCM.get(x,y);
                if(planTile == 60){
                    //See if any of our source options work for the second source
                    //If so, calculate the rest
                    for(let i=0;i<sourceOptions.length;i++){
                        let source=sourceOptions[i];
                        if(structureBlobCM.get(x+source[0],y+source[1]) == 60){
                            labs = labMatch({x:x,y:y}, {x:x+source[0],y:y+source[1]}, structureBlobCM);
                            //console.log('L1',x,y,'L2',x+source[0],y+source[1]);
                            let log = '';
                            labs.forEach(lab=>{log+='Lab '+lab.x+' '+lab.y+'\n'})
                            //console.log(log)
                            if(labs.length == 8){
                                sourceLabs.push({x:x,y:y}, {x:x+source[0],y:y+source[1]} )
                                break labLoop;
                            }
                        }
                    }
                }
            }
        }

        //Now we have the labs needed
        labs.forEach(lab =>{
            //console.log(JSON.stringify(lab))
            structureBlobCM.set(lab.x,lab.y,75);
        })
        sourceLabs.forEach(lab =>{
            //console.log(JSON.stringify(lab))
            structureBlobCM.set(lab.x,lab.y,76);
        })

        return structureBlobCM;

        function labMatch(source1,source2,structureBlobCM){
            let labCount = 0
            let labs = [];
            let overlaps = findOverlappingTiles(source1, source2);
            overlaps.forEach(spot =>{
                if(structureBlobCM.get(spot.x,spot.y) == 60){
                    labs.push(spot)
                    labCount++;
                }
                if(labs.length == 8) return;
                
            });

            return labs;
        }

        function findOverlappingTiles(source,source2, radius = 2) {
            let tiles = [];
            for (let x = source.x - radius; x <= source.x + radius; x++) {
              for (let y = source.y - radius; y <= source.y + radius; y++) {
                //Don't add sources themselves
                if(!(x == source.x && y == source.y) && !(x == source2.x && y == source2.y)){
                    if(calculateDistance(x,y,source2.x,source2.y) <= 2){
                        tiles.push({ x, y });
                    }
                }
              }
            }
            //console.log(tiles.length)
            return tiles;
          }

          function calculateDistance(x1, y1, x2, y2) {
            return Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)));
        }

    },
    assignStructures: function(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitTileCM){
        let structures = [33,94,95,97,96,33,88,88,88,88,88,88,33,44,45]
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);
        let count = 0;
        let extCount = 60;
        let labCount = 10
        let visited = new Set(); // Track visited positions as a string "x,y"
        let toVisit = [{ pos: storagePos, score: exitTileCM.get(storagePos.x, storagePos.y) }]
        let directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 },                   { dx: 1, dy: 0 },
            { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
        ];
        
        while (toVisit.length > 0 && count < structures.length + extCount + labCount) {
            let current = toVisit.shift(); // Remove the first element, now an object
            let currentPos = current.pos;
            let currentKey = `${currentPos.x},${currentPos.y}`;
            if (visited.has(currentKey)) continue; // Skip if already visited
            visited.add(currentKey); // Mark as visited
            //console.log("Looping for",currentKey)
    
            // Add adjacent positions to toVisit if they haven't been visited and they're a road
            directions.forEach(({dx, dy}) => {
                let newX = currentPos.x + dx;
                let newY = currentPos.y + dy;
                let newPos = new RoomPosition(newX, newY, roomName);
                let newPosKey = `${newX},${newY}`;
    
                if (!visited.has(newPosKey) && newX >= 0 && newX < 50 && newY >= 0 && newY < 50) {
                    //Exit score
                    let score = exitTileCM.get(newX, newY);
                    //console.log("Not visited tile",newX,newY)
                    //If it's a road or temporary road, add it to tiles to visit
                    if(structureBlobCM.get(newX,newY) == 99 || structureBlobCM.get(newX,newY) == 89){
                        //Sorted insert to focus on tiles further from the exit
                        let index = toVisit.findIndex(item => item.score < score);
                        if (index === -1) {
                            toVisit.push({ pos: newPos, score: score });
                        } else {
                            toVisit.splice(index, 0, { pos: newPos, score: score });
                        }
                    }
                    //Else, if it's a structure tile, convert it and make temp roads permanent if needed
                    else if (structureBlobCM.get(newX,newY) === 50) {
                        //Found a tile with score 50, so we convert the slot to a building
                        //First the core buildings, then the rest as extensions
                        if(count < structures.length){
                            structureBlobCM.set(newX,newY,structures[count]);
                            count++;
                        }else{
                            structureBlobCM.set(newX,newY,60);
                            count++;
                        }

                        //If this is a temporary road, confirm it as a real one since we're building next to it
                        if (structureBlobCM.get(currentPos.x,currentPos.y) === 89){
                            structureBlobCM.set(currentPos.x,currentPos.y,99)
                        }
        
                    }
                }
            });
        }
    },
    floodFillWithScores: function(startPos,roomName,terrain) {
        let room = Game.rooms[roomName]
        let costMatrix = new PathFinder.CostMatrix();
        let toVisit = [...startPos];
        let visited = new Set();
        let currentScore = 1;
        let pos;
        let key;
        // First pass to mark tiles adjacent to walls
        while (toVisit.length > 0) {
            pos = toVisit.shift();
            key = pos.x + "," + pos.y;
            if (visited.has(key)) continue;
            visited.add(key);
    
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx == 0 && dy == 0) continue; // Skip the current tile
                    let newPos = { x: pos.x + dx, y: pos.y + dy };
                    //If the neighboring tile is within bounds
                    if(newPos.x >= 0 && newPos.x < 50 && newPos.y >= 0 && newPos.y < 50){
                        //If the neighboring tile is a wall, set the current tile's score to 1
                        if (terrain.get(newPos.x,newPos.y) == TERRAIN_MASK_WALL) {
                            costMatrix.set(pos.x, pos.y, 1);
                        }
                        //Else if not a wall, push to the visit queue
                        else{
                            toVisit.push(newPos);
                        }
                    }
                }
            }
        }
        
        // Subsequent passes to expand scores
        // keepRunning will be set to True each time we make it to an exit tile
        let keepRunning = false;
        let toChange = new Set();
        let changeKey;
        do {
            console.log("Filling")
            toChange = new Set();
            keepRunning = false;
            toVisit = [...startPos];
            console.log(toVisit)
            visited = new Set();
            while(toVisit.length > 0){
                pos = toVisit.shift();
                key = pos.x + "," + pos.y;
                if (visited.has(key)) continue;
                visited.add(key);

                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx == 0 && dy == 0) continue; // Skip the current tile
                        let newPos = { x: pos.x + dx, y: pos.y + dy };
                        //If the neighboring tile is within bounds
                        if(newPos.x >= 0 && newPos.x < 50 && newPos.y >= 0 && newPos.y < 50){
                            //If the neighboring tile already has a score, add it and the current tile to the set for incrementing
                            //We don't add it to the queue because we want these tiles to slowly build a wall that cuts us off from the exit tiles
                            if (costMatrix.get(newPos.x,newPos.y) != 0) {
                                //Set the position to a string format
                                changeKey = newPos.x+","+newPos.y;
    
                                //If the set doesn't have either the new or current position, add whichever is missing
                                if(!toChange.has(changeKey)){
                                    toChange.add(changeKey)
                                }
    
                                changeKey = pos.x+","+pos.y;
                                if(!toChange.has(changeKey)){
                                    toChange.add(changeKey)
                                }
                                costMatrix.set(pos.x, pos.y, 1);
                                costMatrix.set(newPos.x,newPos.y, costMatrix.get(newPos.x,newPos.y)+1);
                            }
                            //Else if it doesn't have a score, check if it's an exit tile and push it to the queue for continuing the fill
                            else{
                                //If the new tile is on a 0 or 49, and we already know it isn't a wall, then it's an exit tile
                                if(newPos.x == 0 || newPos.x == 49 || newPos.y == 0 || newPos.y == 49){
                                    console.log("Setting flag")
                                    keepRunning = true;
                                }
                                toVisit.push(newPos);
                            }
                        }
                    }
                }
            }
            //Now that we have all the tiles that need changing, increment all of them by 1. New tiles go from 0 to 1, tiles with only 1 previous visit go to 2, and so on.
            toChange.forEach(tile=>{
                //Split x and y coordinates from the set
                let [x,y] = tile.split(',');
                //set the value of x and y to whatever it is, plus 1
                costMatrix.set(x,y, costMatrix.get(x,y)+1)
            })
        } while (keepRunning);
    
        return costMatrix;
    }
}

module.exports = test;

global.findPathCenterpoint = test.findPathCenterpoint;
global.routeRemoteRoad = test.routeRemoteRoad;
global.testDistanceTransform = test.distanceTransform;
global.testGetWallGroups = test.getWallGroups;