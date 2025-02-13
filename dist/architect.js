const helper = require('functions.helper');
const minCut = require('minCut');
const profiler = require('screeps-profiler');
const fiefPlanner = require('fiefPlanner');
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



const scoreWeights = {
    extensionsOnRoad:1,
    extensionDist:2,
    extensionMax:1,
    extensionMissing:8,
    extensionsInFF:1,
    rampTiles:2,
    rampGroups:1,
    rampDist:0.2,
    storagePrimeRange:25,
    storageControllerDist:3,
    storageSourceDist:0.3,
    towerMinDamage:1,
    towerAvgDamage:1,
    controllerFound:100,
    sourceFound:25,
    structureFound:500
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

function minMaxNormalize(value, max, min) {
    if (max - min == 0){
        console.log("Attempting to divide by zero, max and min are both 0 with a value of",value);
        return 0; // Prevent division by zero
    }
    return (value - min) / (max - min);
}

function scorePlan(roomName,newPlanCM,newPlan){
    let roomData = getScoutData(roomName)
    console.log(JSON.stringify(Object.keys(newPlan)))
    console.log(JSON.stringify(newPlan.ramparts))
    console.log(JSON.stringify(newPlan.roads))
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
     * Misc
     *  -Is controller outside of rampart tiles
     *  -Are sources outside of rampart tiles (penalty for each in-room source if so)
     */
    let scores = {
        extensions:0,
        ramparts:0,
        storage:0,
        towers:0,
        misc:0
    }
    let storePos = new RoomPosition(newPlan.storage.x,newPlan.storage.y,roomName);
    let walkCM = newPlanCM.clone();
    let terrain = Game.map.getRoomTerrain(roomName);
    //Set buildings to impassable and ramparts to roads
    for(let y = 0; y < 50; y++) {
        for(let x = 0; x < 50; x++) {
            let tile = walkCM.get(x,y);
            if([99,100].includes(tile)){
                walkCM.set(x,y,1);
                continue;
            }
            if(![0,12,25,26,255].includes(tile)){
                walkCM.set(x,y,255)
            }
        }
    }
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
        let targetExt = new RoomPosition(extension.x,extension.y,roomName)
        //Distance scoring
        let srch = PathFinder.search(storePos,{pos:targetExt,range:1},{
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return walkCM;
            }
        });
        //Check for no path
        if(srch.incomplete){
            console.log("INCOMPLETE")
        }
        if(srch.path.length > extMax) extMax = srch.path.length;
        totalDist += srch.path.length;

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
        (extAdjacent * scoreWeights.extensionsOnRoad) +
        (extAvg * scoreWeights.extensionDist) +
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
        let targetRamp = new RoomPosition(ramp.x,ramp.y,roomName);
        //console.log("Search from",storePos,"to",targetRamp)
        let srch = PathFinder.search(storePos,{pos:targetRamp},{
            // Same cost for everything because we're finding a centerpoint
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return walkCM;
            }
        });
        //Should check for incomplete at some point
        totalDist+= srch.path.length;
        //console.log("Ramp length:",srch.path.length)
    }
    rampAvg = totalDist/newPlan.ramparts.length
    //console.log("RAMPARTS\nAvg:",rampAvg,"Total:",rampTotal,"Groups:",rampGroups)
    scores.ramparts = Math.round(
        (rampTotal * scoreWeights.rampTiles) +
        (rampGroups * scoreWeights.rampGroups) +
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
        (storageControllerDist * scoreWeights.storageControllerDist) +
        (storageIn4 * scoreWeights.storagePrimeRange) +
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
                if(towerCM.get(ramp.x+x,ramp.y+y) != 1){
                    towerTargets.add(`${ramp.x+x},${ramp.y+y}`)
                }
            }
        }
    }
    //For each tower, get tile damage and add it to the list
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
    
    // -----Misc Scoring-----
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
    for(source of roomData.sources){
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(towerCM.get(source.x+x,source.y+y) != 1 && terrain.get(source.x+x,source.y+y) != TERRAIN_MASK_WALL){
                    sourcesInside -=1;
                    continue sLoop;
                };
            }
        }
    }

    //console.log("Misc\nControllerIn:",controllerInside,"SourcesIn:",sourcesInside)
    scores.misc = Math.round(
        (controllerInside * scoreWeights.controllerFound) +
        (sourcesInside * scoreWeights.sourceFound)
    )

    //console.log("Scores",JSON.stringify(scores));

    return scores;

}

function towerFF(newPlanCM,storePos,terrain){
    
    let queue = [storePos];
    let visited = new Set();
    let towerCM = newPlanCM.clone()
    visited.add(`${storePos.x},${storePos.y}`)
    towerCM.set(storePos.x,storePos.y,1)
    //console.log("Running tower FF")
    while(queue.length > 0){
        let tile = queue.shift();
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

function updateGeneration(config){
    let history = RawMemory.segments[SEGMENT_PLAN_GENERATIONS];
    let done = false;
    
}



//Main Planner Object
const architect = {
    //Flag to indicate if the planner is currently running
    running: false,
    //Data for the room being planned
    data: {},

    //Called to start a new plan process
    startPlan: function(roomName,{totalPop=25, maxIterations=10,mutationRate=0.01}={}){
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
            fronts:[],
            currentPlans:[],
            mutationRate:mutationRate,
            population:generatePopulation(totalPop),
            iterations:maxIterations,

        };
        //Set planner data for the room
        const {sources,mineral,controller} = roomData;
        this.data = {
            roomName:roomName,
            sources:sources,
            mineral:mineral,
            controller:controller
        }
        //Clear the segment
        RawMemory.segments[SEGMENT_PLAN_GENERATIONS] = '{}'
    },

    //Continues the current room plan process
    run: function(roomName){
        //If no plan
        if(!this.config){
            this.startPlan(roomName);
        }
        //If we're at the end of the generation
        if(fiefPlanner.subject == fiefPlanner.population.length){
            //Generate a new one if needed, else finish
            if(fiefPlanner.stage >= fiefPlanner.iterations){
                finalizePlan(this.config);
                return;
            }
            else updateGeneration(this.config);
        }

        //If not at the end of a generation, process a new plan
        else{
            let [newPlanCM,newPlan,newPlanCPU] = fiefPlanner.generateRoomPlan(roomName,this.config.population[this.config.subject]);
            //Update CPU and increment the subject
            this.config.totalCPU += newPlanCPU;
            this.config.subject++;
            
            //Get the plan scores and add it and the genes to the current scores array
            let newPlanScores = scorePlan(newPlanCM,newPlan);
            //Stage-Subject identifier, subject genes, scores 
            this.config.currentPlans.push([`${this.config.stage},${this.config.subject}`,this.config.subject,newPlanScores])
        }
    }
}

module.exports = architect;
profiler.registerObject(architect, 'architect');
global.testFiefPlan = function testFiefPlan(roomName){
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
    console.log("Genes",chromosome)
    console.log("S1")
    let [newCM,newPlan,newCPU] = fiefPlanner.generateRoomPlan(roomName,chromosome);
    console.log("S2")
    let scores = scorePlan(roomName,newCM,newPlan);
    console.log(JSON.stringify(scores))
    //Memory.testCM1 = newCM.serialize();
}