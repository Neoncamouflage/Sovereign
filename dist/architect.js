const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const fiefPlanner = require('fiefPlanner');
const architectPlanner = require('architect.planner')
const architectMatrixes = require('architect.matrixes')

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





const scoreWeights = {
    extensionsOnRoad:1,
    extensionDist:2,
    extensionMax:1,
    extensionMissing:8,
    extensionsInFF:1,
    rampTiles:1,
    rampGroups:1,
    rampDist:0.7,
    storagePrimeRange:25,
    storageControllerDist:3,
    storageSourceDist:0.3,
    towerMinDamage:1,
    towerAvgDamage:1,
    controllerFound:100,
    sourceFound:25,
    structureFound:500
}
//SPECIES   -     Subjects that all share the same SPEC genes and primarily breed within that group.
//PHENOTYPE -     The physical layout generated from a genome by the planner.
//NICHE     -     A fitness-based subgroup formed based on score categories.

//Genes are separated into blocks based on their area of influence. A higher value is a greater preference.
//Species genes act as switches to express significantly different behavior if active, and will never mutate. Cross-species breeding is limited.
//Mode genes are also switches but do not have enough impact to restrict breeding.
const GENE_LIMITS = {
    species:[
        // ----Species Genes---- //
        [0,1],          //SPEC - Watershed, use watershed regions instead of structure blob for buildable area
        [0,1],          //SPEC - FastFill, place fastfiller stamps before filling out extensions normally
        [0,1],          //SPEC - Custom Mincut, use the MINC genes to modify the standard mincut CM
    ],
    mode:[
        // ----Mode Genes---- //
        [0,1],          //MODE - Mincut controller, require mincut to rampart the controller
        [0,1],          //MODE - Mineral roads, include the mineral in core RCL3 roads
        [0,1],          //MODE - Remote roads, include remotes in core RCL3 roads
    ],
    gene:[
        // ----Watershed Genes---- // (ONLY IF SPEC1 IS ACTIVE)
        [0.1,10.0],     //WATR - Region size, prefer larger watershed region
        [0.1,10.0],     //WATR - Controller range, prefer the controller be in or near the region
        [0.1,10.0],     //WATR - Source range, prefer sources be in or near the region
        [0.1,10.0],     //WATR - Exit range, prefer regions away from exits
        [0.1,10.0],     //WATR - Border size, prefer regions with smaller borders
        // ----Core Placement Genes---- //
        [0.1,10.0],     //CORE - Exit range, prefer to stay away from exits
        [0.1,10.0],     //CORE - Controller range, prefer closeness to controller
        [0.1,10.0],     //CORE - Source range, prefer to minimize average range to sources
        [0.1,10.0],     //CORE - Distance transform, prefer distance from walls
        // ----Structure Blob Genes---- // (ONLY IF SPEC1 IS INACTIVE)
        [0.1,10.0],     //BLOB - Blob size, prefer larger tile counts
        [0.1,10.0],     //BLOB - Distance transform, prefer to expand the blob away from walls
        [0.1,10.0],     //BLOB - Exit range, prefer to expand the blob away from exits
        [0.1,10.0],     //BLOB - Source range, prefer to expand the blob towards sources
        // ----Road Expansion Genes---- //
        [0.1,10.0],     //ROAD - Road exploration, prefer roads that maximize new adjacent tiles
        [0.1,10.0],     //ROAD - Diagonal bias, prefer roads to expand diagonally
        [0.1,10.0],     //ROAD - Core range, prefer roads close to the core
        [0.1,10.0],     //ROAD - Exit range, prefer roads away from exits
        // ----Structure Assignment Genes---- //
        [0.1,10.0],     //ASSN - Remote extensions, prefer extensions to be placed on remote roads
        [0.1,10.0],     //ASSN - Spawn range, prefer spawns to be placed next to the core
        [0.1,10.0],     //ASSN - Spawn distance, prefer spawns to be placed away from each other
        [0.1,10.0],     //ASSN - Lab range, prefer labs to be close to the core
        [0.1,10.0],     //ASSN - Tower range, prefer towers to be close to the core
        [0.1,10.0],     //ASSN - Tower distance, prefer towers to be placed away from each other
        [0.1,10.0],     //ASSN - Terminal range, prefer terminal to be close to the controller
        // ----Mincut Rampart Genes---- // (ONLY IF SPEC3 IS ACTIVE)
        [0.1,10.0],     //MINC - Core range, prefer ramparts close to the core
        [0.1,10.0],     //MINC - Exit range, prefer ramparts farther from exits
        [0.1,10.0],     //MINC - Distance transform, prefer ramparts on tiles close to walls, encouraging chokepoints
    ]    
};
//Indexes of the first and last gene in each block
const GENE_BLOCKS ={
    'SPEC':[0,2],
    'MODE':[3,5],
    'WATR':[6,10],
    'CORE':[11,14],
    'BLOB':[15,18],
    'ROAD':[19,22],
    'ASSN':[23,29],
    'MINC':[30,32]
}





function getRCLPlan(basePlan,newPlanCM,extensionDistances){
    Memory.test.testBasePlan = basePlan
    //{rcl:{building:[spot,spot,spot]}}
    let roomDetails = {sourceLabs:[]};
    //plannedRoads tracks roads already placed
    let plannedRoads = new Set();
    let rclTrack={}; // Tracks the structure type and how many we've placed so we can gauge RCL
    let visited = new Set();
    extensionSet = new Set();
    let queue = [basePlan.storage];
    //Set up the room plan object along with single instance structures
    let rclPlan = {
        1:{},
        2:{},
        3:{},
        4:{[convertStructure(STRUCTURE_STORAGE)]:[{x:basePlan.x,y:basePlan.y}]},
        5:{},
        6:{[convertStructure(STRUCTURE_EXTRACTOR)]:[{x:basePlan.extractor.x,y:basePlan.extractor.y}],[convertStructure(STRUCTURE_LAB)]:[]},
        7:{},
        8:{[convertStructure(STRUCTURE_OBSERVER)]:[{x:basePlan.observer.x,y:basePlan.observer.y}],[convertStructure(STRUCTURE_POWER_SPAWN)]:[{x:basePlan.powerSpawn.x,y:basePlan.powerSpawn.y}],
            [convertStructure(STRUCTURE_NUKER)]:[{x:basePlan.nuker.x,y:basePlan.nuker.y}]}
    };
    //Fill in source labs because they need built first no matter what
    //Also add them to room details so we can tell the fief which labs are sources
    for(let each of Object.values(basePlan.sourceLabs)){
        rclPlan[6][convertStructure(STRUCTURE_LAB)].push(each);
        roomDetails.sourceLabs.push(each)
    }
    //Get all primary roads that will be built at RCL 3
    //These are core,controller, and source roads
    rclPlan[3][STRUCTURE_ROAD] = []
    for(let road of basePlan.roads.core){
        let key = `${road.x},${road.y}`;
        if(!plannedRoads.has(key)){
            plannedRoads.add(key);
            rclPlan[3][convertStructure(STRUCTURE_ROAD)].push({x:road.x,y:road.y})
        }
    }
    for(let road of basePlan.roads.controller){
        let key = `${road.x},${road.y}`;
        if(!plannedRoads.has(key)){
            plannedRoads.add(key);
            rclPlan[3][convertStructure(STRUCTURE_ROAD)].push({x:road.x,y:road.y})
        }
    }
    for(let source in basePlan.roads.sources){
        for(let road of basePlan.roads.sources[source]){
            let key = `${road.x},${road.y}`;
            if(!plannedRoads.has(key)){
                plannedRoads.add(key);
                rclPlan[3][convertStructure(STRUCTURE_ROAD)].push({x:road.x,y:road.y})
            }
        }
    }
    //Walk the planCM and add structures to the RCL plan as they're encountered
    while (queue.length > 0) {
        //Set up for the next tile
        let {x, y} = queue.shift();
        let key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        //If it's a structure except a rampart, add to the RCL plan. Ramparts aren't tied to RCL
        if(Memory.roomPlanReference[newPlanCM.get(x,y)] && newPlanCM.get(x,y) != 100){
            addToRCL(Memory.roomPlanReference[newPlanCM.get(x,y)],rclTrack,rclPlan,{x,y},extensionSet);
        }

        //If the current tile is a non-road structure, we continue, as we want to follow the roads. Also exempt storage since we start there.
        if(Memory.roomPlanReference[newPlanCM.get(x,y)] && ![99,98].includes(newPlanCM.get(x,y))) continue;

        [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        let newX = x + dx, newY = y + dy;
        
        // Ensure the new tile is within bounds, not already visited, and not a wall
        if (newX >= 0 && newX < 50 && newY >= 0 && newY < 50 && !visited.has(`${newX},${newY}`) && terrain.get(newX,newY) != TERRAIN_MASK_WALL) {
            
            queue.push({x: newX, y: newY});
        }
        });
    }

    return rclPlan;


    //Adds building to RCL plan
    function addToRCL(structure,tracker,plan,spot,extensionSet){
        //If this is the first one, add it to the tracker object
        if(!tracker[structure]) tracker[structure] = 0;
        //Loop through RCLs
        for(let rcl = 1;rcl <= 8;rcl++){
            //If the number allowed at this RCL is greater than how many we have so far, increment the tracker and add it
            if(structure != STRUCTURE_ROAD && CONTROLLER_STRUCTURES[structure][rcl] > tracker[structure]){
                tracker[structure]++;
                //Add the location to the structure
                if(!plan[rcl][structure]) plan[rcl][structure] = [];
                plan[rcl][structure].push(spot)
                return;
            }
            else if(structure == STRUCTURE_ROAD && CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl] > tracker[STRUCTURE_EXTENSION]){
                //Check key
                let key = `${spot.x},${spot.y}`;
                if(!extensionSet.has(key)){
                    continue;
                }
                //Add the location to the structure
                if(!plan[rcl][structure]) plan[rcl][structure] = [];
                plan[rcl][structure].push(spot)
                return;
            }
        }
    }    
    //Now we fill out RCL 4 roads, which are rampart routes
    rclPlan[4][STRUCTURE_ROAD] = []
    for(let road of basePlan.roads.rampart){
        let key = `${road.x},${road.y}`;
        if(!roadSet.has(key)){
            roadSet.add(key);
            rclPlan[4][convertStructure(STRUCTURE_ROAD)].push({x:road.x,y:road.y})
        }
    }
    //Finally, we fill in RCL 6 roads to the mineral
    rclPlan[6][STRUCTURE_ROAD] = []
    for(let road of basePlan.roads.mineral){
        let key = `${road.x},${road.y}`;
        if(!roadSet.has(key)){
            roadSet.add(key);
            rclPlan[6][convertStructure(STRUCTURE_ROAD)].push({x:road.x,y:road.y})
        }
    }
}


//UPDATE TO NORMALIZE SCORING WITHIN SPECIES
//One species may naturally score lower than another, even before evolution
//Normalize scoring so they have a chance to compete
//Select elites for niches based on their within-species normalized traits
//Otherwise a niche will become dominated by a single species
//Phase 1: In early-mid generations we normalize species separately and enforce minimum populations per species
//Phase 2: In later generations we reduce normalization and allow the inferior species to die out 
/**
Imagine both modes are equally capable in principle of satisfying your design goals, but their mechanics differ:

Watershed produces long perimeter walls → more ramparts.

Blob produces compact shapes → fewer ramparts.

If your objective says:

“Minimize total ramparts”

then watershed is intrinsically worse at that objective unless it compensates elsewhere.

If the real design intent is actually:

“Use ramparts efficiently while covering entrances and protecting assets,”

then “total ramparts” is only a proxy—and a proxy that happens to penalize watershed more than blob.

In that case, raw scores are encoding algorithmic style, not quality.
 */
function scorePlan(roomName,newPlanCM,newPlan,config){
    let roomData = getScoutData(roomName)
    //console.log(JSON.stringify(Object.keys(newPlan)))
    //console.log(JSON.stringify(newPlan.ramparts))
    //console.log(JSON.stringify(newPlan.roads))
    //With pareto fronts we score on multiple objectives. Due to the number, sub objectives will combine into a total category score
    /**
     * -----Score Objectives-----
     * Extensions
     *  -Is extension adjacent to a remote road (bonus points if so due to ad hoc refilling from haulers)
     *  -Distance to furthest extension from storage
     *  -Average distance to all extensions from storage
     *  -Is extension missing (massive penalty if so, only keeping viable for rare rooms)
     *  -Total extensions in FastFillers
     * 
     * Ramparts
     *  -Total ramparts
     *  -Total rampart groups
     *  -Average distance to ramparts
     * 
     * Storage
     *  -Is storage within range 4 of controller (bonus points if so due to upgraders self-filling)
     *  -Distance from storage to controller
     *  -Distance from storage to all sources
     *  
     * Towers
     *  -Minimum damage to rampart adjacent tiles
     *  -Average damage to rampart adjacent tiles
     * 
     * Access
     *  -Is controller outside of rampart tiles
     *  -Are sources outside of rampart tiles (penalty for each in-room source if so)
     */
    let scores = {
        extensions:0,
        ramparts:0,
        storage:0,
        towers:0,
        access:0
    }
    if(!newPlan.storage){
        chronicle.log(`No storage location to score. Scoring plan data:${JSON.stringify(newPlan)}.`,'architect',1)
        return false;
    }
    //{x:21, y:21, dist:6}
    let extensionDistances = {}
    let storePos = new RoomPosition(newPlan.storage.x,newPlan.storage.y,roomName);
    //let walkCM = newPlanCM.clone();
    let terrain = Game.map.getRoomTerrain(roomName);
    //Get a distance map based on walkable distance from storage
    let distMap = getDistanceMap(newPlanCM,storePos,terrain)
    Memory.test.testCM = distMap.serialize()
    // -----Extension Scoring-----
    let extAdjacent = 0;
    let extMax = 0;
    let extAvg = 0;
    let extFF = 0;
    let remoteRoads = new Set();
    let totalDist = 0;
    for(let source of newPlan.roads.sources){
        for(let spot of source){
            remoteRoads.add(`${spot.x},${spot.y}`);
        }
    }

    
    for(let extension of newPlan.extension){
        //Distance scoring
        let extDistance = distMap.get(extension.x,extension.y)
        //If 255 then the BFS walk never made it there
        if(extDistance == 255){
            console.log("INCOMPLETE EXT")
        }
        if(extDistance > extMax) extMax = extDistance;
        totalDist += extDistance;

        //Adjacency scoring
        extLoop:
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(x ==0 && y == 0) continue;
                if(remoteRoads.has(`${extension.x+x},${extension.y+y}`)){
                    extAdjacent++;
                    break extLoop;
                }
            }
        }
    }
    extAvg = totalDist/newPlan.extension.length
    //console.log("EXTENSIONS\nRemoteRoadAdjacent:",extAdjacent,"MaxDist:",extMax,"AvgDist:",extAvg,"FFs:",extFF);
    scores.extensions = Math.round(
        500+
        (extAdjacent * scoreWeights.extensionsOnRoad) -
        (extAvg * scoreWeights.extensionDist) -
        (extMax * scoreWeights.extensionMax) +
        (extFF * scoreWeights.extensionsInFF)
    )
    // -----Rampart Scoring-----
    let rampTotal = newPlan.ramparts.length;
    let rampGroups = newPlan.rampGroups;
    let rampAvg = 0;

    //Walk every route
    totalDist = 0
    for(let ramp of newPlan.ramparts){
        let rampDist = distMap.get(ramp.x,ramp.y)
        if(rampDist == 255){
            console.log("INCOMPLETE RAMP")
        }
        totalDist+= rampDist;
    }
    rampAvg = totalDist/newPlan.ramparts.length
    //console.log("RAMPARTS\nAvg:",rampAvg,"Total:",rampTotal,"Groups:",rampGroups)
    scores.ramparts = Math.round(
        1000 -
        (rampTotal * scoreWeights.rampTiles) -
        //(rampGroups * scoreWeights.rampGroups) -
        (rampAvg * scoreWeights.rampDist)
    )

    // -----Storage Scoring-----
    //-Is storage within range 4 of controller (bonus points if so due to upgraders self-filling)
    //-Distance from storage to controller
    let storageControllerDist = newPlan.roads.controller.length;
    let storageIn4 = storageControllerDist <=4 ? 1 : 0;
    let storageSourceDist = 0;

    for(let source of newPlan.roads.sources){
        storageSourceDist += source.length;
    }
    //console.log("STORAGE\nController:",storageControllerDist,"In4:",storageIn4,"Sources:",storageSourceDist)
    scores.storage = Math.round(
        1000 -
        (storageControllerDist * scoreWeights.storageControllerDist) +
        (storageIn4 * scoreWeights.storagePrimeRange) -
        (storageSourceDist * scoreWeights.storageSourceDist)
    )


    // -----Towers Scoring-----
    //Flood fill from storage out to ramparts to get all base tiles
    let towerCM = towerFF(newPlanCM,storePos,terrain);
    Memory.testCM1 = towerCM.serialize();
    let towerTargets = new Set();
    let towerMin = Infinity;
    let towerAvg = 0;
    let towerTotal = 0;
    //Get all target tiles
    for(let ramp of newPlan.ramparts){
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(x==0 && y==0) continue;
                if(ramp.x+x>49 || ramp.x+x<0 || ramp.y+y > 49 || ramp.y+y < 0) continue
                if(towerCM.get(ramp.x+x,ramp.y+y) != 1){
                    towerTargets.add(`${ramp.x+x},${ramp.y+y}`)
                }
            }
        }
    }
    //For each tower, get tile damage and add it to the list
    //TODO
    //Track damage for each tower (average, minimum, something) to determine build order
    for(let tile of towerTargets){
        let [x,y] = tile.split(',').map(Number);
        let spot = {x,y};
        let tileTotal = 0;
        for(let tower of newPlan.tower){
            let amount = TOWER_POWER_ATTACK;
            let dist = Math.max(Math.abs(spot.x-tower.x),Math.abs(spot.y-tower.y))
            if(dist > TOWER_OPTIMAL_RANGE) {
                if(dist > TOWER_FALLOFF_RANGE) {
                    dist = TOWER_FALLOFF_RANGE;
                }
                amount -= amount * TOWER_FALLOFF * (dist - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
            }
            amount = Math.floor(amount);
            tileTotal += amount;
        }
        towerTotal+=tileTotal
        if(tileTotal < towerMin)towerMin = tileTotal
    }
    towerAvg = towerTotal/towerTargets.size;
    //console.log("TOWERS\nMinimum:",towerMin,"Avg:",towerAvg)
    scores.towers = Math.round(
        (towerAvg * scoreWeights.towerAvgDamage) +
        (towerMin * scoreWeights.towerMinDamage)
    )
    
    // -----Access Scoring-----
    let controllerInside = 1;
    let sourcesInside = roomData.sources.length;
    cLoop:
    for(let x=-1;x<=1;x++){
        for(let y=-1;y<=1;y++){
            if(towerCM.get(newPlan.controller.x+x,newPlan.controller.y+y) != 1 && terrain.get(newPlan.controller.x+x,newPlan.controller.y+y) != TERRAIN_MASK_WALL){
                controllerInside = 0;
                break cLoop;
            };
        }
    }
    sLoop:
    for(let source of roomData.sources){
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(towerCM.get(source.x+x,source.y+y) != 1 && terrain.get(source.x+x,source.y+y) != TERRAIN_MASK_WALL){
                    sourcesInside -=1;
                    continue sLoop;
                };
            }
        }
    }

    //console.log("Access\nControllerIn:",controllerInside,"SourcesIn:",sourcesInside)
    scores.access = Math.round(
        (controllerInside * scoreWeights.controllerFound) +
        (sourcesInside * scoreWeights.sourceFound)
    )

    //console.log("Scores",JSON.stringify(scores));
/**
 *         Memory.scoreWeights = {
            rampTileWeight:2,
            rampDistWeight:0.2,
            controllerDistWeight:3,
            sourceDistWeight:0.3,
            extensionDistWeight:2,
            extensionMaxWeight:1,
            extensionMissingWeight:8,
            controllerFoundWeight:100,
            sourceFoundWeight:25,
            structureFoundWeight:500
        }
 */
    //Get total weighted score for overall fitness
    //Just current total for now, will test to try different weights
    let total = 0;
    for(let num of Object.values(scores)){
        total += num;
    }
    scores.total = total;
    return [scores,extensionDistances];

}


//This uses the old room plan reference!
//Update once we fully convert over and do room planning in architect
function getDistanceMap(newPlanCM,storePos,terrain){
    let queue = [storePos];
    let visited = new Set();
    //Create cost matrix and fill with 255
    //Anything still 255 in the end will be considered unreachable
    let distanceCM = new PathFinder.CostMatrix()
    distanceCM._bits.fill(255)
    visited.add(`${storePos.x},${storePos.y}`)
    distanceCM.set(storePos.x,storePos.y,0)
    let distance;
    let qi = 0
    while(qi < queue.length){
        let tile = queue[qi];
        qi++;
        distance = distanceCM.get(tile.x,tile.y)
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(x==0 && y==0) continue;
                if(visited.has(`${tile.x+x},${tile.y+y}`)) continue;
                //console.log(`Visiting tile: (${tile.x+x}, ${tile.y+y})`);
                if(tile.x+x > 49 || tile.x+x < 0 || tile.y+y > 49 || tile.y+y < 0)continue;
                //Add one exception to the wall check, as extractors are built on walls
                let planTile = newPlanCM.get(tile.x+x,tile.y+y)     //USES ROOM PLAN REFERENCE< UPDATE TO CONVERTSTRUCTURE()
                if(!(planTile == 87 || terrain.get(tile.x+x,tile.y+y) != TERRAIN_MASK_WALL)) continue;

                tileStruct = Memory.roomPlanReference[planTile]
                if(tileStruct && ![STRUCTURE_CONTAINER,STRUCTURE_ROAD,STRUCTURE_EXTRACTOR].includes(tileStruct)) continue

                queue.push({x:tile.x+x,y:tile.y+y,});
                visited.add(`${tile.x+x},${tile.y+y}`);
                distanceCM.set(tile.x+x,tile.y+y,distance+1)
                
            }
        }
    }
    return distanceCM;
}

function towerFF(newPlanCM,storePos,terrain){
    let queue = [storePos];
    let visited = new Set();
    let towerCM = newPlanCM.clone()
    visited.add(`${storePos.x},${storePos.y}`)
    towerCM.set(storePos.x,storePos.y,1)
    //console.log("Running tower FF")
    let qi = 0
    while(qi < queue.length){
        let tile = queue[qi];
        qi++;
        //console.log("Tile",tile,"taken from queue")
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(x==0 && y==0) continue;
                if(!visited.has(`${tile.x+x},${tile.y+y}`)){
                    //console.log(`Visiting tile: (${tile.x+x}, ${tile.y+y})`);
                    visited.add(`${tile.x+x},${tile.y+y}`)
                    if(tile.x+x > 49 || tile.x+x < 0 || tile.y+y > 49 || tile.y+y < 0) continue;
                    if(newPlanCM.get(tile.x+x,tile.y+y) != 100 && terrain.get(tile.x+x,tile.y+y) != TERRAIN_MASK_WALL){
                        queue.push({x:tile.x+x,y:tile.y+y});
                        towerCM.set(tile.x+x,tile.y+y,1)
                    }
                }
            }
        }
    }
    return towerCM;
}

function generatePopulation(totalPop){
    let species = speciesCombos();
    //Shuffle species semi-randomly to be fair in long-term performance
    species = species.sort(() => Math.random() - 0.5);
    //Organize population by species
    let pop = {}
    for(let i = 0;i<totalPop;i++){
        //Start genome off with species genes, using mod to loop through the options
        let speciesGenes = species[i % species.length]
        console.log("SPECIESGENES",speciesGenes.toString())
        let genome = [...speciesGenes];
        //Mode genes
        for(let j = 0; j < GENE_LIMITS.mode.length; j++){
            let max = GENE_LIMITS.mode[j][1];
            //Mode genes are always integers. Generate a random int up to the max gene limit
            gene = randomInt(max);
            genome.push(gene);
        }
        //General genes
        for(let j = 0; j < GENE_LIMITS.gene.length; j++){
            // Generate a random value between the min and max for each gene
            let min = GENE_LIMITS.gene[j][0];
            let max = GENE_LIMITS.gene[j][1];
            //Rounding to ensure no more than 2 decimals
            let gene = Math.round((Math.random() * (max - min) + min) * 100) / 100;
            genome.push(gene);
        }
        if(!pop[speciesGenes.toString()]) pop[speciesGenes.toString()] = [genome]
        else{pop[speciesGenes.toString()].push(genome)};
    }
    //chronicle.log(`Chromosomes generated for population. ${pop}`,'architect',4)
    return pop;

    function speciesCombos() {
        const n = GENE_LIMITS.species.length;

        return Array.from({ length: 1 << n }, (_, i) =>
            Array.from({ length: n }, (_, b) =>
                (i >> (n - b - 1)) & 1
            )
        );
    }

}

function finalizePlan(config){
    config.running = false;
    if(!config.elite){
        let plans = config.currentPlans.map(plan => {
            return {scores:plan[2],genes:plan[1],roomPlan:plan[3]}
        })
        config.elite = plans.slice().sort((a,b) => b.scores['total'] - a.scores['total'])
    } 
    config.bestPlan = config.elite[0].roomPlan
    config.bestScores = config.elite[0].scores
    getRCLPlan(config.bestPlan)

}


//UPDATE TO INCLUDE SPECIES GENES
// -- New breeding methodology -- //
//Breed best pairs within the same species, once per species
//Breed random pairs, with 5-20% allowed to migrate and breed across species
//Breed niche elites within each species
//Keep (at least) one elite per species, as well as (at least) one global elite
//Cross-species breeding should consider these:
/**
    Crossing two individuals with different species often creates children where some blocks were never under selection pressure (because they were inactive under that mode), so recombination produces noise.

    Use one of these methods to prevent that:
        Mode-anchored inheritance: child inherits MODE bits from one parent entirely, and only mixes compatible continuous blocks.

        Blockwise crossover with mode-aware reinit: if child’s MODE activates a block that neither parent had “active,” reinitialize that block (or heavily mutate it) so it’s not garbage.
 */
function updateGeneration(config){
    chronicle.log(`Generation ${config.stage} complete. Breeding new population.`,'architect',3)
    
    //Need to append history and write back once we figure out what format and data to include
    let history = JSON.parse(RawMemory.segments[SEGMENT_PLAN_GENERATIONS]);
    
    let plans = config.currentPlans.map(plan => {
        return {scores:plan[2],genes:plan[1],roomPlan:plan[3]}
    })
    //Update stage and reset subject
    config.stage++;
    config.subject = 0;
    //This function utilizes manually niched breeding into each category
    breedMNiche(plans)

    //Reset our current plans to empty
    config.currentPlans = [];


    //--- Functions for breeding ---//

    function breedMNiche(plans){
        const NICHE_CAP_PERCENT = 15;
        const ELITE_CAP_PERCENT = 20;
        //Sort plans by their scores
        //Objects to hold our niches. The top scoring of each will be niched together
        let scoreTypes = ['extensions', 'ramparts', 'storage', 'towers', 'access']
        let topScores = {};
        let newPop = [];
        let newElite = plans.slice().sort((a,b) => b.scores['total'] - a.scores['total']).slice(0,Math.max(2,Math.floor(plans.length/ELITE_CAP_PERCENT)))
        scoreTypes.forEach(type => {
            topScores[type] = plans
              .slice() // Create a shallow copy so the original array isn't modified
              .sort((a, b) => b.scores[type] - a.scores[type]) // Sort descending
              .slice(0, Math.max(2,Math.floor(plans.length/NICHE_CAP_PERCENT))); // Keep only the top 10
          });
        if(config.elite){
            let combinedElite = config.elite.concat(newElite);
            combinedElite.sort((a, b) => b.scores.total - a.scores.total);
            config.elite = combinedElite.slice(0, Math.max(2,Math.floor(plans.length/ELITE_CAP_PERCENT)));
        }
        else{
            config.elite = newElite;
        }
        //console.log("SCORES")
        //console.log(JSON.stringify(topScores))
        let popStep = 0;
        //let cycleAlt = false;
        let p1;
        let p2;
        let o1;
        //console.log("PLAN GENES:")
        for(let o of plans) console.log(JSON.stringify(o.genes))
        //console.log("ELITE GENES")
        for(let o of config.elite) console.log(JSON.stringify(o.genes))
        //Breed new pairs until we have as many as the old population.
        while(newPop.length < config.totalPop){
            //One each for score types
            if(popStep < scoreTypes.length){
                //console.log("popStep",popStep,"scoreTypes",JSON.stringify(scoreTypes),'topScores keys',Object.keys(topScores))
                let pick = scoreTypes[popStep];
                let niche = topScores[pick];
                p1 = randomChoice(niche);
                p2 = randomChoice(niche);
                o1 = blockCross(p1,p2)
                //console.log("Breeding from niche",pick)
                popStep++;
            }
            //Again for random pairings across niches
            else if(popStep < scoreTypes.length*2){
                let niches = Object.keys(topScores);
                let niche1 = randomChoice(niches)
                let niche2 = randomChoice(niches)
                p1 = randomChoice(topScores[niche1]);
                p2 = randomChoice(topScores[niche2]);
                //console.log("Breeding from niches",niche1, niche2)
                o1 = blockCross(p1,p2)
                popStep++;
            }
            //Elite breeding
            else if(popStep <= (scoreTypes.length*2)+1){
                if(popStep == scoreTypes.length*2){
                    let pick = randomChoice(scoreTypes)
                    let niche = topScores[pick];
                    p1 = randomChoice(niche);
                    p2 = randomChoice(config.elite);
                    o1 = blockCross(p1,p2)
                }
                else{
                    p1 = randomChoice(config.elite);
                    p2 = randomChoice(config.elite);
                    o1 = blockCross(p1,p2)
                }
                popStep++;
            }
            else{
                //Reset the counter and flip the cycle flag
                popStep = 0;
                //cycleAlt = !cycleAlt;
            }
            if(o1) newPop.push(o1)
        }
        config.population = newPop;
        //chronicle.log(`Breeding round:\nParent 1: ${JSON.stringify(p1)}\nParent2: ${JSON.stringify(p2)}\nOffspring: ${JSON.stringify(o1)}`,'architect',4)

        //Sort into niches based on top score (10% of total pop allowed per niche)
        //Top 20% of current generation+global elite make up the new global elite pool
        //Iterate over pairings until we fill the needed population
        //Pairings: 2 random within niche, 2 random across niches, 1 random niche and a global elite, 2 random global elites
        //Last two only happen every other iteration to encourage niche breeding
        
    }

    //This breeding function preserves gene blocks
    function blockCross(p1,p2){
        //console.log("Breeding:\n",JSON.stringify(p1),'\n',JSON.stringify(p2))
        //blockLimits are the index of the last gene in each block
        let blockLimits = [3,6,8,13];
        let p1Genes = p1.genes;
        let offspring = [];
        let currentBlock = 0;
        let currentParent = randomInt(1);
        for (let i = 0; i < p1Genes.length; i++) {
            //If we've passed the boundary for the current block, move to the next block.
            if (currentBlock < blockLimits.length && i > blockLimits[currentBlock]) {
              currentBlock++;
              currentParent = randomInt(1);
            }
            
            //const gene = genes[i];
            //console.log("Taking", gene, "from parent", currentParent+1);
            //offspring[gene] = (currentParent === 0) ? p1.genes[gene] : p2.genes[gene];
            offspring[i] = (currentParent === 0) ? p1.genes[i] : p2.genes[i];
        }
          return offspring;
    }

    function mutateGenes(){
        const { mutationRate, maxMutationMagnitude } = config;

        const blockLimits = [3, 6, 8, 13];
        const blocks = [
            [0, blockLimits[0]],
            [blockLimits[0] + 1, blockLimits[1]],
            [blockLimits[1] + 1, blockLimits[2]],
            [blockLimits[2] + 1, blockLimits[3]],
        ];

        const blockMutationRate = 0.10;
        const resetRate = 0.005; 

        function clampGene(i, gene) {
            const [min, max] = GENE_LIMITS[i];
            if (gene < min) gene = min;
            else if (gene > max) gene = max;
            return Math.round(gene * 100) / 100;
        }
        //Random base for mutation scaling, -1 or 1
        function randombase() {
            return (Math.random() * 2) - 1;
        }


        //Small chance to mutate all genes in a random block
        if (Math.random() < blockMutationRate) {
            const [start, end] = blocks[Math.floor(Math.random() * blocks.length)];
            for (let i = start; i <= end; i++) {
                const [min, max] = GENE_LIMITS[i];
                const range = max - min;
                const delta = randombase() * range * maxMutationMagnitude;
                genes[i] = clampGene(i, genes[i] + delta);
            }
        }

        //Small chance for any gene to be mutated
        for (let i = 0; i < genes.length; i++) {
            if (Math.random() >= mutationRate) continue;

            const [min, max] = GENE_LIMITS[i];
            const range = max - min;

            //Very small chance to fully reseed the gene
            //Helps to avoid being trapped in a locally optimal basin
            if (Math.random() < resetRate) {
                genes[i] = clampGene(i, min + Math.random() * range);
                continue;
            }

            //Squaring the scale means small mutations are much more likely than large
            const scale = Math.pow(Math.random(), 2);
            const delta = randombase() * range * maxMutationMagnitude * scale;

            genes[i] = clampGene(i, genes[i] + delta);
        }

        return genes;
    }

}

//Room Plan Function
//Calls functions from architect submodules to build the room plan
function generateRoomPlan(config,roomData){
    let subject = config.population[config.subject];
    let speciesBlock = subject.slice(GENE_BLOCKS.SPEC[0],GENE_BLOCKS.SPEC[1]+1);
    let modeBlock = subject.slice(GENE_BLOCKS.MODE[0],GENE_BLOCKS.MODE[1]+1);
    let planData = {};
    //If watershed gene is active, we first select our region
    let watershedGene = subject[0];
    if(watershedGene){
        let watershedBlock = subject.slice(GENE_BLOCKS.WATR[0],GENE_BLOCKS.WATR[1]+1);
        planData = architectPlanner.planWatershed(config,roomData,planData,watershedBlock);
    }

    //Select our core location
    let coreBlock = subject.slice(GENE_BLOCKS.CORE[0],GENE_BLOCKS.CORE[1]+1);
    planData = architectPlanner.planCore(config,roomData,planData,coreBlock);
    
    //If we didn't use watershed, get our structure blob
    if(!watershedGene){
        let blobBlock = subject.slice(GENE_BLOCKS.BLOB[0],GENE_BLOCKS.BLOB[1]+1);
        planData = architectPlanner.planStructureBlob(config,roomData,planData,blobBlock);
    }

    //Expand roads
    let roadBlock = subject.slice(GENE_BLOCKS.ROAD[0],GENE_BLOCKS.ROAD[1]+1);
    let mineralRoads = modeBlock[1];
    let remoteRoads = modeBlock[2];
    planData = architectPlanner.planRoads(config,roomData,planData,roadBlock,mineralRoads,remoteRoads);

    //Assign structures
    let assignBlock = subject.slice(GENE_BLOCKS.ASSN[0],GENE_BLOCKS.ASSN[1]+1);
    planData = architectPlanner.planStructureAssignment(config,roomData,planData,assignBlock);

    //Mincut
    let mincutBlock = subject.slice(GENE_BLOCKS.MINC[0],GENE_BLOCKS.MINC[1]+1);
    let customMincut = speciesBlock[2];
    let rampartController = modeBlock[0];
    planData = architectPlanner.planMincut(config,roomData,planData,mincutBlock,customMincut,rampartController);

    return planData;

}

function getExits(terrain){
    let exits = [];
    for(let i = 0;i<50;i++){
        let x1 = terrain.get(i,0);
        let x2 = terrain.get(i,49);
        if(x1 != TERRAIN_MASK_WALL) exits.push({x:i,y:0})
        if(x2 != TERRAIN_MASK_WALL) exits.push({x:i,y:49})
        if(i>0 && i<49){
            let y1 = terrain.get(0,i);
            let y2 = terrain.get(49,i);
            if(y1 != TERRAIN_MASK_WALL) exits.push({x:0,y:i})
            if(y2 != TERRAIN_MASK_WALL) exits.push({x:49,y:i})
        }
    }
    return exits;
}

//Main Architect Object
const architect = {
    //Persistent names for each species configuration
    /**
        Eventually set up something like this to track long-term persistent stats:
        Memory.sovereign.plannerSpecies[key].stats = {
            runs: 42,
            wins: 9,
            avgFitness: 128.4,
            bestFitness: 173.9,
            swampRooms: { runs: 10, wins: 4 },
            centerController: { runs: 12, wins: 1 }
        };
     */
    //When visualizing, can use the resource icons instead of names for easier reference and tracking.
    //Even already comes with separate colors
    //Rename creeps to a format something like the below, based on which house won the room planning:
    //Serf 𒊶𒃒 of E44N18, House Ghodium
    //Serf 𒊶𒃒 of House Utrium, Fief E44N18
    SPECIES_NAMES : {
        "0,0,0": "HYDROGEN",
        "0,1,0":"OXYGEN",
        "1,0,0":"UTRIUM",
        "1,1,0":"LEMERGIUM",
        "0,0,1":"KEANIUM",
        "0,1,1":"ZYNTHIUM",
        "1,0,1":"CATALYST",
        "1,1,1":"GHODIUM"
    },
    //Data for the room being planned
    data: {},

    //Called to start a new plan process
    startPlan: function(roomName,{totalPop, maxIterations,mutationRate,maxMutationMagnitude}={}){
        chronicle.log(`Generating room plan data/config - ${roomName}.`,'architect',4)
        let roomData = getScoutData(roomName)
        if(!roomData){
            chronicle.log(`No room data available for ${roomName}.`,'architect',4);
            return false;
        }
        //Set a fresh planner object
        this.config = {
            roomName:roomName,
            highs:{},
            lows:{},
            stage:1,
            subject:0,
            totalCPU:0,
            niches:{},
            elite:[],
            bestScore:Infinity,
            secondScore:Infinity,
            thirdScore:Infinity,
            startTick:Game.time,
            currentPlans:[], ////`Stage,Subject identifier`, subject genes, scores
            mutationRate:mutationRate,
            maxMutationMagnitude:maxMutationMagnitude,
            totalPop:totalPop,
            population:generatePopulation(totalPop), //- Minimum population of 64, 8 per species. Randomize all non-species genes.(totalPop),
            iterations:maxIterations,
            running:true

        };
        for(let score of ['extensions', 'ramparts', 'storage', 'towers', 'access','total']){
            this.config.highs[score] = 0;
            this.config.lows[score] = Infinity;
        }
        //Set planner data for the room
        const {sources,mineral,controller} = roomData;
        this.data = {
            roomName:roomName,
            sources:sources.map(s => ({ x: s.x, y: s.y ,id:s.id})),
            mineral:{x:mineral.x,y:mineral.y},
            controller:{x:controller.x,y:controller.y}
        }
        let terrain = new Room.Terrain(roomName);
        this.data.exits = getExits(terrain);
        this.data.distanceCM = architectMatrixes.getDistanceTransform(terrain)
        this.data.controllerCM = architectMatrixes.getDistanceMap(terrain,[this.data.controller])
        this.data.exitCM = architectMatrixes.getDistanceMap(terrain,this.data.exits)
        if(this.data.sources.length > 1){
            let finalSourceMatrix = new PathFinder.CostMatrix();
            let matrixes = [];
            let totalDist = 0;
            for(let each of this.data.sources){
                matrixes.push(architectMatrixes.getDistanceMap(terrain,[each]));
            }
            
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    totalDist = 0;
                    for(let each of matrixes){
                        totalDist += each.get(x,y);
                    }
                    finalSourceMatrix.set(x,y,Math.round(totalDist/matrixes.length))
                }
            }
            this.data.sourceCM = finalSourceMatrix;
        }
        else{
            this.data.sourceCM = architectMatrixes.getDistanceMap(terrain,this.data.sources)
        }
        let watershedCM = architectMatrixes.getWatershed(this.data.distanceCM,terrain);
        this.data.watershedData = architectMatrixes.getWatershedData(watershedCM,this.data)
        this.data.watershedCM = watershedCM;
        //Clear the segment - This is where we will write a compact history of all plans to visualize
        RawMemory.segments[SEGMENT_PLAN_GENERATIONS] = '{}'
        return true;
    },

    //Continues the current room plan process
    run: function(roomName,{totalPop=50, maxIterations=10,mutationRate=0.01,maxMutationMagnitude=0.5}={}){
        //---- No Config, Start New Process ----//
        if(this.config && this.config.running && roomName && roomName != this.config.roomName){
            chronicle.log(`Room plan request for ${roomName} rejected. Already generating a plan for ${this.config.running}.`,'architect',1)
        }
        if(!this.config || !this.config.running){
            if(!roomName){
                chronicle.log(`No room name provided for run function and no existing plan to continue.`,'architect',1)
                return;
            }
            let start = this.startPlan(roomName,{totalPop:totalPop,maxIterations:maxIterations,mutationRate:mutationRate,maxMutationMagnitude:maxMutationMagnitude});
            if(!start) return;
        }
        //--------------------------------------//
        // -- UPDATE TO SCORING AND GENERATIONS
        // Minimum population of 64, 8 per species
        // Batch size of 8 or 16 per generation, picking best pairs from within the same species and niche, with limited crossover
        // Every tick evaluate 1 candidate. Every batch done perform selection/breed replacements
        if(!roomName) roomName = this.data.roomName
        //If we're at the end of the generation
        if(this.config.subject == this.config.population.length){
            //Generate a new one if needed, else finish
            if(this.config.stage >= this.config.iterations){
                chronicle.log(`Room generation complete.`,'architect',4)
                finalizePlan(this.config);
                return;
            }
            else updateGeneration(this.config);
        }

        //If not at the end of a generation, process a new plan
        else{
            //chronicle.log(`Generating room plan - ${roomName}. Genes: ${JSON.stringify(this.config.population[this.config.subject])}`,'architect',4)
            let results = generateRoomPlan(this.config,this.data);
            if(!results){
                chronicle.log(`Error generating room plan, no results. Skipping.`,'architect',1)
                this.config.subject++;
                return;
            }
            let [newPlanCM,newPlan,newPlanCPU] = results;
            //chronicle.log(`Results received. Plan cost ${Math.round(newPlanCPU)} CPU.`,'architect',4)
            
            //Get the plan scores and add it and the genes to the current scores array
            
            let newPlanScores = scorePlan(roomName,newPlanCM,newPlan,this.config);
            let newRCLPlan = getRCLPlan(roomName,newPlanCM)
            if(!newPlanScores){
                chronicle.log(`No scores available.`,'architect',4)
                return;
            }
            //Update highs/lows if new ones are found
            for(let niche of Object.keys(newPlanScores)){
                let score = newPlanScores[niche];
                if(score > this.config.highs[niche]) this.config.highs[niche] = score;
                if(score < this.config.lows[niche]) this.config.lows[niche] = score;
            }
            //chronicle.log(`Room plan scored - ${roomName}.\n${JSON.stringify(newPlanScores)}\nStage: ${this.config.stage}, Subject: ${this.config.subject}`,'architect',4)
            //Stage,Subject identifier, subject genes, scores 
            this.config.currentPlans.push([`${this.config.stage},${this.config.subject}`,this.config.population[this.config.subject],newPlanScores,newPlan])
            //Update CPU and increment the subject
            this.config.totalCPU += newPlanCPU;
            this.config.subject++;
        }
    }
}

module.exports = architect;
//profiler.registerObject(architect, 'architect');
global.testFiefPlan = function testFiefPlan(roomName,{totalPop=2, maxIterations=2,mutationRate=0.01,maxMutationMagnitude=0.5}={}){
    chronicle.log(`Attempting test plan`,'architect',4)
    architect.run(roomName,{totalPop:totalPop,maxIterations:maxIterations,mutationRate:mutationRate,maxMutationMagnitude:maxMutationMagnitude});
    chronicle.log(`Test Complete`,'architect',4)
}
global.tempTest = function tempTest(tPop=10){
    let pop = generatePopulation(tPop)
    console.log(JSON.stringify(pop))
    for(let species of Object.keys(pop)){
        console.log(species, architect.SPECIES_NAMES[species])
        for(let subject of pop[species]){
            console.log(subject)
        }
    }
}
/**
 * global.testFiefPlan = function testFiefPlan(roomName){
    let chromosome = JSON.parse(JSON.stringify(DEFAULT_GENES))
    let j = 0;
    for(let key of Object.keys(chromosome)){
        // Generate a random value between the min and max for each gene
        let min = GENE_LIMITS[j][0];
        let max = GENE_LIMITS[j][1];
        //Rounding to ensure no more than 2 decimals
        let gene = Math.round((Math.random() * (max - min) + min) * 100) / 100;
        chromosome[key] = gene;
        j++;
    }
    console.log("Genes",JSON.stringify(chromosome))
    console.log("S1")
    let [newCM,newPlan,newCPU] = fiefPlanner.generateRoomPlan(roomName,chromosome);
    console.log("S2")
    let scores = scorePlan(roomName,newCM,newPlan);
    console.log(JSON.stringify(scores))
    //Memory.testCM1 = newCM.serialize();
}
 */