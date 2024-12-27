const helper = require('functions.helper');
const minCut = require('minCut');
const profiler = require('screeps-profiler');

//Get base location
//Fill out structure area if we're using that
//
/**
100:STRUCTURE_RAMPART,
15:STRUCTURE_NUKER,
14:STRUCTURE_FACTORY,
13:STRUCTURE_POWER_SPAWN,
12:STRUCTURE_LINK,
11:STRUCTURE_LAB,
10:STRUCTURE_TERMINAL,
9:STRUCTURE_WALL,
8:STRUCTURE_TOWER,
7:STRUCTURE_EXTRACTOR,
6:STRUCTURE_EXTENSION,
5:STRUCTURE_OBSERVER,
4:STRUCTURE_STORAGE,
3:STRUCTURE_SPAWN,
2:STRUCTURE_CONTAINER,
1:STRUCTURE_ROAD,
 */

function minMaxNormalize(value, max, min) {
    if (max - min == 0){
        console.log("Attempting to divide by zero, max and min are both 0 with a value of",value);
        return 0; // Prevent division by zero
    }
    return (value - min) / (max - min);
}

const GENE_LIMITS = [
    [0.1,10.0],     //Core - Exit range weight
    [0.1,10.0],     //Core - Controller range weight
    [0.1,10.0],     //Core - Source range weight
    [0.1,10.0],     //Core - Distance transform weight
    [0.1,10.0],     //Blob - Tile density weight
    [0.1,10.0],     //Blob - Core range weight
    [0.1,10.0],     //Blob - Exit range weight
    [0.1,10.0],     //Assn - Exit range weight
    [0.1,10.0],     //Assn - Core range weight
    [0.1,10.0],     //MinC - Core range weight
    [0.1,10.0],     //MinC - Exit range weight
    [0.1,10.0],     //MinC - Distance transform weight
    [0.1,10.0],     //MinC - Include Controller
    [0.1,10.0],     //MinC - Flat Weight
];
const DEFAULT_GENES = {
    eWeight:1,
    cWeight:2,
    sWeight:0.5,
    dWeight:1.2,
    blobTWeight:1,
    blobCWeight:1,
    blobEWeight:1,
    assnEWeight:1,
    assnCWeight:1,
    minCCWeight:1,
    minCEWeight:1,
    minCDWeight:1,
    minCIWeight:1,
    minCFWeight:1
};
const EXIT_BUFFER_DISTANCE = 3;
const EXIT_BUFFER_STRENGTH = 26;
const SOURCE_BUFFER_DISTANCE = 1;
const SOURCE_BUFFER_STRENGTH = 26;
const MINERAL_BUFFER_DISTANCE = 1;
const MINERAL_BUFFER_STRENGTH = 26;
const CONTROLLER_BUFFER_DISTANCE = 1;
const CONTROLLER_BUFFER_STRENGTH = 56;
const CORE_DISTANCE_TRANSFORM_MINIMUM = 1;


function minMaxNormalize(value, max, min) {
    if (max - min == 0){
        console.log("Attempting to divide by zero, max and min are both 0 with a value of",value);
        return 0; // Prevent division by zero
    }
    return (value - min) / (max - min);
}

function getStructureMap(roomName,terrain,basePlanCM,coreSpot,exitTileCM,alpha = 1.5,beta = 2.6, romeo = 1.8,roads){

    /**
     * All road tiles are scored based on their range from storage and how many adjacent tiles are available for structures.
     * Shorter ranges and more structures increase the score.
     */

    //This is extra large right now to ensure there are viable exit points from the base.
    const STRUCTS_NEEDED = 900; //85 Actual structures - (60 Extensions, 10 Labs, 6 Towers, 3 Spawns, 1 Nuker, 1 Factory, 1 Link, 1 Terminal, 1 Power Spawn, 1 Observer)
    const ALPHA = alpha; //Multiplier to tile weight - Higher multipliers make high weight tiles more valuable
    const BETA = beta;  //Multiplier to tile range - Higher multipliers make close range tiles more valuable
    const ROMEO = romeo; //Multiplier to exit distance - Higher multipliers make tiles further from exits more valuable
    let roadTiles = [];
    let maxRange = 0;
    let minRange = 999;
    let maxAdjacent = 0;
    let minAdjacent = 99;
    let minExit = 999;
    let maxExit = 0;
    let connectedStructures = 0;
    let storagePos = new RoomPosition(coreSpot.x,coreSpot.y,roomName);
    let structureBlobCM = basePlanCM.clone();
    //Normalization
    function normalize(value, min, max) {
        return (max - min) != 0 ? Math.round(((value - min) / (max - min))*100) : 0;
    }

    //Get all road tiles and add valid adjacent positions to connectedStructures
    //Change score in blob CM for connected structures
    for(let road in roads){
        let spot = structureBlobCM.get(road.x,road.y);
        if(spot == 1){
            //Get all adjacent structures
            let [adjacentStructs,adjacentCount] = findAdjacentStructs(road,structureBlobCM,terrain);
            //Get the range
            let tileRange = PathFinder.search(storagePos,{pos:new RoomPosition(road.x,road.y,roomName)}).path.length
            //Increase connected structures by adjacent count
            connectedStructures += adjacentStructs.length;
            //Exit
            let exitRange = exitTileCM.get(x,y)
            //Set the min/maxes
            if(minRange > tileRange) minRange = tileRange;
            if(minAdjacent > adjacentCount) minAdjacent = adjacentCount;
            if(maxRange < tileRange) maxRange = tileRange;
            if(maxAdjacent < adjacentCount) maxAdjacent = adjacentCount;
            if(maxExit < exitRange) maxExit = exitRange;
            if(minExit < exitRange) minExit = exitRange;

            //Add this tile to road tiles, with a weight according to how many were adjacent and range to storage
            roadTiles.push({x:x,y:y,weight:adjacentCount,range:tileRange,exit:exitRange})
            //Mark all new tiles in the blob CM as adjacent
            adjacentStructs.forEach(spot =>{
                structureBlobCM.set(spot.x,spot.y,50);
            })
        }
    }
    for(let y = 0; y < 50; y++) {
        for(let x = 0; x < 50; x++) {
            let planTile = structureBlobCM.get(x,y);
            //If the tile in the plan is a road
            if(planTile == 1){
                //Get all adjacent structures
                let [adjacentStructs,adjacentCount] = findAdjacentStructs({x:x,y:y},structureBlobCM,terrain);
                //Get the range
                let tileRange = PathFinder.search(storagePos,{pos:new RoomPosition(x,y,roomName)}).path.length
                //Increase connected structures by adjacent count
                connectedStructures += adjacentStructs.length;
                //Exit
                let exitRange = exitTileCM.get(x,y)
                //Set the min/maxes
                if(minRange > tileRange) minRange = tileRange;
                if(minAdjacent > adjacentCount) minAdjacent = adjacentCount;
                if(maxRange < tileRange) maxRange = tileRange;
                if(maxAdjacent < adjacentCount) maxAdjacent = adjacentCount;
                if(maxExit < exitRange) maxExit = exitRange;
                if(minExit < exitRange) minExit = exitRange;

                //Add this tile to road tiles, with a weight according to how many were adjacent and range to storage
                roadTiles.push({x:x,y:y,weight:adjacentCount,range:tileRange,exit:exitRange})
                //Mark all new tiles in the blob CM as adjacent
                adjacentStructs.forEach(spot =>{
                    structureBlobCM.set(spot.x,spot.y,50);
                })
            }
        }
    }

    //Sort the road tiles by weight, then range
    roadTiles.sort((a, b) => {
    //Get normalized scores for A
    let normalizedWeightA = normalize(a.weight,minAdjacent,maxAdjacent);
    let normalizedRangeA = normalize(a.range,minRange,maxRange)
    let normalizedExitA = normalize(a.exit,minExit,maxExit)

    //Get normalized scores for B
    let normalizedWeightB = normalize(b.weight,minAdjacent,maxAdjacent);
    let normalizedRangeB = normalize(b.range,minRange,maxRange);
    let normalizedExitB = normalize(b.exit,minExit,maxExit);

    //Calculate and return
    let scoreA = (normalizedWeightA * ALPHA) - (normalizedRangeA * BETA) + (normalizedExitA * ROMEO);
    let scoreB = (normalizedWeightB * ALPHA) - (normalizedRangeB * BETA) + (normalizedExitB * ROMEO);
      
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
                    //Update normalization stuff if needed
                    let tileRange = PathFinder.search(storagePos,{pos:new RoomPosition(nextRoad.x+x,nextRoad.y+y,roomName)}).path.length;
                    let exitRange = exitTileCM.get(nextRoad.x+x,nextRoad.y+y)
                    if(minRange > tileRange) minRange = tileRange;
                    if(minAdjacent > nextCount) minAdjacent = nextCount;
                    if(maxRange < tileRange) maxRange = tileRange;
                    if(maxAdjacent < nextCount) maxAdjacent = nextCount;
                    if(maxExit < exitRange) maxExit = exitRange;
                    if(minExit < exitRange) minExit = exitRange;

                    newRoad = {x:nextRoad.x+x,y:nextRoad.y+y,weight:nextCount,range:tileRange,exit:exitRange};
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
        //Get normalized score
        let normalizedWeight = normalize(newRoad.weight,minAdjacent,maxAdjacent);
        let normalizedRange = normalize(newRoad.range,minRange,maxRange)
        let normalizedExit = normalize(newRoad.exit,minExit,maxExit)
        let newItemScore = (normalizedWeight * ALPHA) - (normalizedRange * BETA) + (normalizedExit * ROMEO);
        let position = roadTiles.findIndex(item => {
            // Normalize each component of the current item
            let normalizedWeightItem = normalize(item.weight, minAdjacent, maxAdjacent);
            let normalizedRangeItem = normalize(item.range, minRange, maxRange);
            let normalizedExitItem = normalize(item.exit, minExit, maxExit);
        
            // Calculate the score for the current item
            let itemScore = (normalizedWeightItem * ALPHA) - (normalizedRangeItem * BETA) + (normalizedExitItem * ROMEO);
        
            // Compare to the newItemScore
            return itemScore < newItemScore;
        });
        
        if (position === -1) {
          // If no such position exists, the new item has the lowest score, so add it to the end
          roadTiles.push(newRoad);
        } else {
          // Otherwise, insert the new item at the found position
          roadTiles.splice(position, 0, newRoad);
        }
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


}

function generateStarterPlan(roomData,zoneCM,coreSpot,terrain){
    let basePlanCM = new PathFinder.CostMatrix;
    let roadCM = new PathFinder.CostMatrix;
    let roads = [];
    //let basePlan = {1:{},2:{},3:{},4:{[STRUCTURE_ROAD]:[],[STRUCTURE_STORAGE]:[coreSpot]},5:{},6:{},7:{},8:{}};

    //Set storage and wrap in roads
    basePlanCM.set(coreSpot.x,coreSpot.y,convertStructure(STRUCTURE_STORAGE));
    roadCM.set(coreSpot.x,coreSpot.y,255);
    for(let y=-1;y<=1;y++){
        for(let x=-1;x<=1;x++){
            if(coreSpot.x+x > 0 && coreSpot.x+x < 49 && coreSpot.y+y > 0 && coreSpot.y+y < 49){
                if(terrain.get(coreSpot.x+x,coreSpot.y+y) != TERRAIN_MASK_WALL){
                    if(!(x==0 && y==0)){
                        //console.log("RECORDING",coreSpot.x+x,coreSpot.y+y,convertStructure(STRUCTURE_ROAD))
                        basePlanCM.set(coreSpot.x+x,coreSpot.y+y,convertStructure(STRUCTURE_ROAD));
                        roadCM.set(coreSpot.x+x,coreSpot.y+y,convertStructure(STRUCTURE_ROAD));
                        roads.push({x:coreSpot.x+x,y:coreSpot.y+y})
                        //basePlan[4][convertStructure(STRUCTURE_ROAD)].push({x:coreSpot.x+x,y:coreSpot.y+y})
                    }
                }
            }
        }
    }
    //Controller path, only if it's farther than 4 away
    let cPath = PathFinder.search(new RoomPosition(coreSpot.x,coreSpot.y,roomData.roomName),{range:3,pos:new RoomPosition(roomData.controller.x,roomData.controller.y,roomData.roomName)}).path;
    if(cPath.length > 3){
        for(let spot of cPath){
            basePlanCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
            roadCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
            roads.push({x:spot.x,y:spot.y})
        }
    }
    //Mineral path
    let mPath = PathFinder.search(new RoomPosition(roomData.mineral.x,roomData.mineral.y,roomData.roomName),{range:1,pos:new RoomPosition(coreSpot.x,coreSpot.y,roomData.roomName)},{
        plainCost: 10,
        swampCost: 11,
        maxRooms:1,
        roomCallback: function() {
          return roadCM;
        },
    }).path;
    for(let spot of mPath){
        basePlanCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
        roadCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
        roads.push({x:spot.x,y:spot.y})
    }
    //Source paths
    for(let source of roomData.sources){
        let sPath = PathFinder.search(new RoomPosition(source.x,source.y,roomData.roomName),{range:1,pos:new RoomPosition(coreSpot.x,coreSpot.y,roomData.roomName)},{
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return roadCM;
            },
        }).path;
        for(let spot of sPath){
            basePlanCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
            roadCM.set(spot.x,spot.y,convertStructure(STRUCTURE_ROAD));
            roads.push({x:spot.x,y:spot.y})
        }
    }

    return [basePlanCM,roads]
}

function getCoreLocation(zoneCM,terrain,roomData,distData,exitData,genes){
    const EXIT_WEIGHT = genes.eWeight;
    const CONTROLLER_WEIGHT = genes.cWeight;
    const SOURCE_WEIGHT = genes.sWeight;
    const DISTANCE_WEIGHT = genes.dWeight;
    //Exit flood fill
    let [exitMatrix,exitHighest,exitLowest] = exitData;
    let [distCM,distHighest,distLowest] = distData;

    //Controller flood fill
    let [controllerMatrix,controllerHighest,controllerLowest] = generateDistanceFloodFill(terrain,[roomData.controller]);

    //Source flood fill

    let [sourceMatrix,sourceHighest,sourceLowest] = generateDistanceFloodFill(terrain,roomData.sources);

    //Track top scores and locations
    let topSpot = null;
    let scoreLocations = [];
    let combinedScoreMatrix = new PathFinder.CostMatrix  //For testing and review
    //Combine all score CMs into one
    let cTop = 0;
    let cBottom = Infinity;
    for (let y = 2; y < 48; y++) {
        for (let x = 2; x < 48; x++) {
            let exitScore = exitMatrix.get(x, y);
            let controllerScore = controllerMatrix.get(x, y);
            let sourceScore = sourceMatrix.get(x,y);
            let distanceScore = distCM.get(x,y);
            //console.log("CHECKING",x,y,"DIST",distanceScore)
            //If distance score is less than what we need for a core, skip
            if(distanceScore < CORE_DISTANCE_TRANSFORM_MINIMUM) continue;
            //console.log("ZONE",zoneCM.get(x,y))
            //If the core location is in a restricted area of any kind, skip
            if(zoneCM.get(x,y) > 0) continue;
            //Combined score is all ranges added together
            //Also subtracting distance transform score to prefer open areas
            //Lowest score wins
            //console.log("Exit:",exitScore,"\nController:",controllerScore,"\nSource:",sourceScore,"\nDistance:",distanceScore)
            let normalizedExit = (minMaxNormalize(exitScore,exitHighest,exitLowest) * 1000 );
            let normalizedController = (minMaxNormalize(controllerScore,controllerHighest,controllerLowest) * 1000 );
            let normalizedSource = (minMaxNormalize(sourceScore,sourceHighest,sourceLowest) * 1000 );
            let normalizedDistance = (minMaxNormalize(distanceScore,distHighest,distLowest) * 1000 );
            //console.log("(Normalized) Exit:",normalizedExit,"\nController:",normalizedController,"\nSource:",normalizedSource,"\nDistance:",normalizedDistance)
            let combinedScore =(normalizedExit * EXIT_WEIGHT)
            -  (normalizedController * CONTROLLER_WEIGHT)
            -  (normalizedSource * SOURCE_WEIGHT)
            +  (normalizedDistance *DISTANCE_WEIGHT);
            combinedScoreMatrix.set(x,y,combinedScore)
            //Record highest and lowest scores
            if(cTop < combinedScore){
                cTop = combinedScore;
                topSpot = {x:x,y:y}
            }
            if(cBottom > combinedScore) cBottom = combinedScore;
            scoreLocations.push({x:x,y:y,combinedScore});
        }
    }
    

    //For testing --- We loop through and normalize all scores in the CM. We can remove this at the end --- TESTING
    //Or better yet, set up a toggle to turn these testing features on and off via Memory
    for(let score of scoreLocations){
        combinedScoreMatrix.set(score.x,score.y,(minMaxNormalize(score.combinedScore,cTop,cBottom) * 255 ))
    }
    Memory.testCM1 = combinedScoreMatrix.serialize()
    //console.log("SOURCES",roomData.sources)
    return topSpot;
}

function generateDistanceFloodFill(terrain,origins){
    let lowestScore = Infinity;
    let highestScore = 0;
    let costMatrix = new PathFinder.CostMatrix;
    let queue = [];
    
    origins.forEach(exit => {
        queue.push({pos: exit.pos ? exit.pos : exit, distance: 1});
        costMatrix.set(exit.x, exit.y, 1);
    });
    while (queue.length > 0) {
        let tile = queue.shift();
        let adjacentTiles = findAdjacentTiles(tile.pos);
        
        adjacentTiles.forEach(({x, y}) => {
            
            if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                let currentDistance = costMatrix.get(x, y);
                if (currentDistance === 0 || currentDistance > tile.distance + 1) {
                    costMatrix.set(x, y, tile.distance + 1);
                    if(tile.distance+1 > highestScore) highestScore = tile.distance+1;
                    if(tile.distance+1 < lowestScore) lowestScore = tile.distance+1
                    queue.push({pos:{x:x,y:y}, distance: tile.distance + 1});
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
    return [costMatrix,highestScore,lowestScore];
}

//Sets buffer zone around targets with basic flood fill
function updateBufferZone(zoneCM,terrain,queue,depthMax,bufferStrength){
    //console.log("Updating zone! Queue:",queue,"MAX",depthMax)
    let costMatrix = new PathFinder.CostMatrix;
    for(spot of queue){
        spot.distance = 0;
        if(!spot.pos){
            if(spot.x && spot.y){
                spot.pos = {x:spot.x,y:spot.y}
            }
            else{
                console.log("UPDATEBUFFERZONE HAS NO X,Y");
                continue;
            }
        }
    }
    while (queue.length > 0) {
        let tile = queue.shift();
        console.log("TILE",JSON.stringify(tile))
        //console.log("Checking tile:",JSON.stringify(tile))
        let adjacentTiles = findAdjacentTiles(tile.pos);
        
        adjacentTiles.forEach(({x, y}) => {
            if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                let tileScore = costMatrix.get(x, y);
                if (tileScore === 0 || tileScore > tile.distance+1) {
                    costMatrix.set(x, y);
                    //console.log("SETTING",x,y)
                    zoneCM.set(x,y,bufferStrength);
                    let newTile = {pos: {x,y},distance:tile.distance+1};
                    if(newTile.distance < depthMax){
                        queue.push(newTile);
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
            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                tiles.push({x: x, y: y});
            }
        });
        return tiles;
    }
}

function getDistanceTransform(terrain){
	//Create the distance transform cost matrix and set default values for highest/lowest
	let distCM = new PathFinder.CostMatrix;
    let distHighest = 0;
    let distLowest = 999
	//Loop through every x,y coordinate and mark all floor tiles with an initial high distance of 255 unless it's a terrain wall
	for(let y = 0; y < 50; y++) {
		for(let x = 0; x < 50; x++) {
			const tile = terrain.get(x, y);
			if(tile != TERRAIN_MASK_WALL){
				distCM.set(x, y, 255);
			}
		}
	}

	//Initialize variables
	let top;
	let left;
	let bottom;
	let right;
    let value;

	//First we do a pass from top left to bottom right in the room
	//This sets our distance scores based on how far the top and left edges are from a wall
	for (x = 0; x <= 49; x += 1) {
		for (y = 0; y <= 49; y += 1) {
			//Get the distance value of the top and left tiles
			top = distCM.get(x, y - 1);
			left = distCM.get(x - 1, y);
			value = Math.min(Math.min(top, left) + 1, distCM.get(x, y));
			//Set either the current value of the tile or 1 larger than the top or left, whichever is smaller
			distCM.set(x, y, value);
		}
	}

	//Now we do a second pass from the bottom right to the top left
	//This catches any shorter distances to walls on the bottom or right sides and updates the tiles accordingly
	for (x = 49; x >= 0; x -= 1) {
		for (y = 49; y >= 0; y -= 1) {
			//Get bottom and right tile distance
			bottom = distCM.get(x, y + 1);
			right = distCM.get(x + 1, y);
            value = Math.min(Math.min(bottom, right) + 1, distCM.get(x, y));
			//Again set the value to the smaller of the current distance or the bottom/right tile plus one
			distCM.set(x, y,value);
            //Update highest/lowest for non wall tiles
            if(value < 255){
                if(value > distHighest){
                    distHighest = value;
                }
                if(value < distLowest){
                    distLowest = value;
                }
            }
		}
	}

	//Return our now complete distance transform cost matrix and the highest/lowest
	return [distCM,distHighest,distLowest];
}

function generatePopulation(totalPop){
    let pop = [];
    for(let i = 0;i<totalPop;i++){
        let chromosome = [];
        for(let j = 0; j < GENE_LIMITS.length; j++){
            // Generate a random value between the min and max for each gene
            let min = GENE_LIMITS[j][0];
            let max = GENE_LIMITS[j][1];
            //Rounding to ensure no more than 2 decimals
            let gene = Math.round((Math.random() * (max - min) + min) * 100) / 100;
            chromosome.push(gene);
        }
        pop.push(chromosome);
    }
    return pop;
}

function finalizePlan(){

}

function updateGeneration(){

}


//Main Planner Object
const fiefPlanner = {
    //Data for the room being planned
    data: {},
    //Planner config for the genetic algorithm
    config: {},

    //Called to start a new plan process
    startFiefPlan: function(roomName,{totalPop=25, maxIterations=10,mutationRate=0.01,maxSpecies=3}={}){
        let roomData = getScoutData(roomName)
        if(!roomData){
            console.log("No room data for the room planner");
                return [-1,-1,-1];                                       // !! Make sure this returns a valid error code for the new function
        }
        //Set a fresh planner object
        this.config = {
            roomName:roomName,
            stage:1,
            subject:0,
            totalCPU:0,
            step:0,
            bestScore:Infinity,
            secondScore:Infinity,
            thirdScore:Infinity,
            startTick:Game.time,
            rankedPop:[],
            mutationRate:mutationRate,
            population:generatePopulation(totalPop),
            iterations:maxIterations
        };
        //Set planner data for the room
        const {sources,mineral,controller} = roomData;
        this.data = {
            sources:sources,
            mineral:mineral,
            controller:controller
        }
    },

    //Called to continue an ongoing plan process
    continueFiefPlan: function(roomName,genes){
        //If we're at the end of the generation
        if(fiefPlanner.subject < fiefPlanner.population.length){
            //Generate a new one if needed, else finish
            if(fiefPlanner.stage >= fiefPlanner.iterations){
                finalizePlan();
                return;
            }
            else updateGeneration();
        }
        else{
            this.generateFiefPlan(roomName,genes)
        }
    },

    //Generates a single plan based on provided genes
    generateFiefPlan: function(roomName,opts){
        //General plan data that will be useful if we decide to keep it
        let planData = {
        }
        if(!opts) genes = DEFAULT_GENES;
        else{
            genes = {
                eWeight:opts[0],
                cWeight:opts[1],
                sWeight:opts[2],
                dWeight:opts[3],
                blobTWeight:opts[4],
                blobCWeight:opts[5],
                blobEWeight:opts[6],
                assnEWeight:opts[7],
                assnCWeight:opts[8],
                minCCWeight:opts[9],
                minCEWeight:opts[10],
                minCDWeight:opts[11],
                minCIWeight:opts[12],
                minCFWeight:opts[13]
            }
        }
        //-------Room Plan Generation--------
        //Assignments
        let startCPU = Game.cpu.getUsed();
        let roomData = getScoutData(roomName); //Remember that the data is supposed to be in the object, added getScoutData() here for testing, remove later and use this.data
        let sources = roomData.sources;
        let mineral = roomData.mineral;
        let controller = roomData.controller;
        let terrain = Game.map.getRoomTerrain(roomName);
        let exits = [];
        //Get exits from terrain data
        for(i = 1;i<48;i++){
            //X going across
            if(terrain.get(i,0) != TERRAIN_MASK_WALL){
                exits.push({x:i,y:0})
            }
            if(terrain.get(i,49) != TERRAIN_MASK_WALL){
                exits.push({x:i,y:49})
            }
            //Y going down
            if(terrain.get(0,i) != TERRAIN_MASK_WALL){
                exits.push({x:0,y:i})
            }
            if(terrain.get(49,i) != TERRAIN_MASK_WALL){
                exits.push({x:49,y:i})
            }
        }
        let distData = getDistanceTransform(terrain);
        let exitData = generateDistanceFloodFill(terrain,exits)

        //Create zoneCM and add buffer zones around source, mineral, controller
        let zoneCM = new PathFinder.CostMatrix;
        //At some point change this to just do all of the buffers in one function call.
        //Also have it automatically calculate strength, such as if there's only 1 open spot, that buffer gets 250 or so
        updateBufferZone(zoneCM,terrain,[...sources],SOURCE_BUFFER_DISTANCE,SOURCE_BUFFER_STRENGTH);
        updateBufferZone(zoneCM,terrain,[mineral],MINERAL_BUFFER_DISTANCE,MINERAL_BUFFER_STRENGTH);
        updateBufferZone(zoneCM,terrain,[controller],CONTROLLER_BUFFER_DISTANCE,CONTROLLER_BUFFER_STRENGTH);

        //At this point we have a zone CM with 25s in all buffer zones
        //Calculate core location
        let coreSpot = getCoreLocation(zoneCM,terrain,roomData,distData,exitData,genes);

        //Set storage to core spot, wrap in roads, and create paths to sources and the mineral.
        //This starts off our actual baseplan CM
        let [basePlanCM,roads] = generateStarterPlan(roomData,zoneCM,coreSpot,terrain);
        Memory.testCM1 = basePlanCM.serialize()

        //Now we carve into the empty space, designating all empty tiles bordering roads as structures.
        getStructureMap(roomName,terrain,basePlanCM,coreSpot,exitData,genes.blobTWeight,genes.blobCWeight,genes.blobEWeight,roads)

    }
}

module.exports = fiefPlanner;
profiler.registerObject(fiefPlanner, 'fiefPlanner');
global.testFiefPlan = fiefPlanner.generateFiefPlan;