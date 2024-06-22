const profiler = require('screeps-profiler');

const helper = {
    //Generates a name
    getName: function(limit = 8){
        let letters = ['𐌰','𐌱','𐌲','𐌳','𐌴','𐌵','𐌶','𐌷','𐌸','𐌹','𐌺','𐌻','𐌼','𐌽','𐌾','𐌿','𐍀','𐍁','𐍂','𐍃','𐍄','𐍅','𐍆','𐍇','𐍈','𐍉','𐍊'];//𐌽𐍅𐌰
        let repeatCount = 0;
        let nameLen = Math.floor(Math.random() * (limit - 3 + 1)) + 3;//
        let name = ''
        let lastChar = '';

        for (let i = 0; i < nameLen; i++){
            let randomChar = letters[Math.floor(Math.random() * letters.length)];
            if(randomChar === lastChar){
                repeatCount ++;
                if(repeatCount > 1){
                    while (randomChar === lastChar) {
                        randomChar = letters[Math.floor(Math.random() * letters.length)];
                    }
                    repeatCount = 0; // Reset repeat count for the new character
                } else{
                    repeatCount = 0;
                }
            }

            name += randomChar;
            lastChar= randomChar;
        }
        return name;
    },
    //Returns a sentence for creep say
    getSentence: function(){
        let letters = ['𐌰','𐌱','𐌲','𐌳','𐌴','𐌵','𐌶','𐌷','𐌸','𐌹','𐌺','𐌻','𐌼','𐌽','𐌾','𐌿','𐍀','𐍁','𐍂','𐍃','𐍄','𐍅','𐍆','𐍇','𐍈','𐍉','𐍊'];
        let punct = ['‽','⸮','⸖','⸘','⸙','⸛','.','!','...'];
        let repeatCount = 0;
        let nameLen = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
        let name = ''
        let lastChar = '';
        for (let i = 0; i < nameLen; i++){
            let randomChar = letters[Math.floor(Math.random() * letters.length)];
            if(randomChar === lastChar){
                repeatCount ++;
                if(repeatCount > 1){
                    while (randomChar === lastChar) {
                        randomChar = letters[Math.floor(Math.random() * letters.length)];
                    }
                    repeatCount = 0; // Reset repeat count for the new character
                } else{
                    repeatCount = 0;
                }
            }

            name += randomChar;
            lastChar= randomChar;
        }
        name+=punct[Math.floor(Math.random() * punct.length)];
        //console.log(name)
        return name
    },
    //Gets the open spots next to a target room position
    getOpenSpots: function(targetPosition){
        let targetRoom = Game.rooms[targetPosition.roomName];
        let area = targetRoom.lookForAtArea(LOOK_TERRAIN,
            source.pos.y - 1, source.pos.x - 1,
            source.pos.y + 1, source.pos.x + 1,
            true);
        let openSpots = area.filter(spot => spot.terrain !== 'wall');

        //Returns an array of open roomPositions
        return openSpots
    },
    //Returns true/false if a creep is considered a scout
    isScout: function(creep){
        let scoutFlag = true;
        let badParts = [WORK,ATTACK,RANGED_ATTACK,HEAL]
        creep.body.forEach(part => {
            if(badParts.includes(part.type)){
                scoutFlag = false;
            }
        });
        return scoutFlag;
    },
    findPathCenterpoint: function(room,optionalPositions){
        //Determine if we have vision. If not, check if we have optional positions. If so, run using only those. If not, return error.
        let keySites = []
        if(!Game.rooms[room]){
            if(!optionalPositions.length){
                return undefined;
            }else{
                keySites = keySites.concat(optionalPositions);
            }
        }
        else{
            let sources = Game.rooms[room].find(FIND_SOURCES).map(source => source.pos);
            let controller = Game.rooms[room].controller.pos
            keySites = keySites.concat(sources,optionalPositions);
            keySites.push(controller)
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




        //Get initial paths between all key sites and store them in the newOrbit array
        for(let i = 0; i < keySites.length ; i++){
            if(i+1 == keySites.length){
                newOrbit.push(PathFinder.search(keySites[i], {pos:keySites[0],range:1},pathOpts).path)
            }
            else{
                newOrbit.push(PathFinder.search(keySites[i], {pos:keySites[i+1],range:1},pathOpts).path)
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
            room:room,
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
    drawVisuals: function(room,roomType=null){
        //Return if no visuals
        if(!Memory.rotatingVisuals) return;
        //Drawing shifts per game tick
        //Keep track of what is used which tick or this is a mess

        let type = roomType;
        //Number of visuals we cycle though. Must manually update each time.
        let tickMod = 2
        if(!type){
            return -1;
        }

        //Draw visuals based on what tick
        switch(Game.time % tickMod){

            //Holding Remote Roads
            case 0:
                if(type == 'holding'){
                    let holding = Memory.kingdom.holdings[room];
                    if(holding.remoteRoad){
                        for(let i = 0; i < holding.remoteRoad.length-1; i++){
                            const startPos = holding.remoteRoad[i];
                            const endPos = holding.remoteRoad[i + 1];
                        
                            // Draw a line between each pair of adjacent positions
                            if(startPos.roomName == endPos.roomName){
                                new RoomVisual(startPos.roomName).line(startPos, endPos, { color: 'blue', width: 0.2 });
                            }
                        }
                    }
                }
                break;
            //Established roads and structures according to Cost Matrix
            case 1:
                let cm;
                if(type == 'fief'){
                    cm = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[room].costMatrix);
                }else if(type == 'holding'){
                    cm = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[room].costMatrix);
                }
                if(!cm) return -1;
                for(let x=0;x<50;x++){
                    for(let y=0;y<50;y++){
                        //new RoomVisual(room).text(cm.get(x,y),x,y+0.25)
                        let score = cm.get(x,y);
                        if(score == 1){
                            new RoomVisual(room).circle(x,y,{fill:'red'})
                        }else if(score == 255){
                            new RoomVisual(room).circle(x,y,{fill:'black'})
                        }else if(score == 25){
                            new RoomVisual(room).circle(x,y,{fill:'orange'})
                        }
                    }
                }
                break;
            
            //Fief Room Plans
            case 2:
                if(type == 'fief'){
                    //Visuals
                    //Pull plan and split into array
                    let plan = JSON.parse(Memory.kingdom.fiefs[room].roomPlan)
                    for(let building in plan){
                        if(Array.isArray(plan[building])){
                            plan[building].forEach(coordinate => {
                                Game.rooms[room].visual.structure(coordinate.x,coordinate.y,building);
                            });
                        }
                    }
                }
                break;
        }
        
        
    },
    getRoomType: function(room){
        //Returns room type and owner type
        if(!room.controller){
            return ['neutral',null,null];
        }
        if(room.controller.owner){
            if(Memory.diplomacy.allies.includes(room.controller.owner.username)){
                return ['holding','ally',room.controller.owner.username]
            }else{
                return ['fief','enemy',room.controller.owner.username]
            }
        }
        if(room.controller.reservation && room.controller.reservation.username != Memory.me){
            if(Memory.diplomacy.allies.includes(room.controller.reservation.username)){
                return ['holding','ally',room.controller.reservation.username]
            }else{
                return ['holding','enemy',room.controller.reservation.username]
            }
        }
        return ['neutral',null,null];
    },
    simpleFloodFill: function(basePlanCM, origins, action) {
        // Initialize a queue with the starting tiles
        let queue = [...origins];
        // Set to keep track of visited tiles
        let visited = new Set();
      
        while (queue.length > 0) {
          let {x, y} = queue.shift(); // Dequeue the next tile
          let key = `${x},${y}`;
      
          // Skip this tile if it has already been visited
          if (visited.has(key)) continue;
      
          visited.add(key); // Mark this tile as visited
      
          // Perform your action based on the cost matrix value of the current tile
          // The 'action' function can be any custom logic you want to apply
          action(x, y, basePlanCM.get(x, y));
      
          // Find and enqueue all adjacent tiles that should be visited
          // You may want to adjust the conditions based on your game's logic
          // For example, you might only want to continue filling if the cost is below a certain threshold
          [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            let newX = x + dx, newY = y + dy;
            
            // Ensure the new tile is within bounds and not already visited
            if (newX >= 0 && newX < 50 && newY >= 0 && newY < 50 && !visited.has(`${newX},${newY}`)) {
              queue.push({x: newX, y: newY});
            }
          });
        }
      }
}

module.exports = helper;    

global.getRemoteRoad = helper.routeRemoteRoad;
profiler.registerObject(helper, 'functions.helper');