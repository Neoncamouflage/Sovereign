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

function getRCLPlan(plan){
    //{rcl:{building:[spot,spot,spot]}}
    let roomDetails = {sourceLabs:[]};
    let roomPlan = {
        1:{},
        2:{},
        3:{},
        4:{[convertStructure(STRUCTURE_STORAGE)]:[{x:basePlan.x,y:basePlan.y}]},
        5:{},
        6:{[convertStructure(STRUCTURE_EXTRACTOR)]:[{x:plan.extractor.x,y:plan.extractor.y}],[convertStructure(STRUCTURE_LAB)]:[]},
        7:{},
        8:{}
    };
    for(let each of Object.values(basePlan.sourceLabs)){
        roomPlan[6][STRUCTURE_LAB].push(each);
        roomDetails.sourceLabs.push(each)
    }
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
    if(!newPlan.storage){
        chronicle.log(`No storage location to score. Scoring plan data:${JSON.stringify(newPlan)}.`,'architect',1)
        return false;
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
    //chronicle.log(`Chromosomes generated for population. ${pop}`,'architect',4)
    return pop;
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
    getRCLPlan(bestPlan)

}

function updateGeneration(config){
    chronicle.log(`Generation ${config.stage} complete. Breeding new population.`,'architect',3)
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
        let scoreTypes = ['extensions', 'ramparts', 'storage', 'towers', 'misc']
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
        //chronicle.log(`Breeding round:\nParent 1: ${JSON.stringify(p1)}\nParent2: ${JSON.stringify(p2)}\nOffspring: ${JSON.stringify(o1)}`,'architect',4)

        //Sort into niches based on top score (10% of total pop allowed per niche)
        //Top 20% of current generation+global elite make up the new global elite pool
        //Iterate over pairings until we fill the needed population
        //Pairings: 2 random within niche, 2 random across niches, 1 random niche and a global elite, 2 random global elites
        //Last two only happen every other iteration to encourage niche breeding
        
    }

    //This breeding functioon preserves gene blocks
    function blockCross(p1,p2){
        //console.log("Breeding:\n",JSON.stringify(p1),'\n',JSON.stringify(p2))
        let blockLimits = [3,6,8,13];
        let genes = p1.genes;
        let offspring = [];
        let currentBlock = 0;
        let currentParent = randomInt(1);
        for (let i = 0; i < genes.length; i++) {
            //If we've passed the boundary for the current block, move to the next block.
            if (currentBlock < blockLimits.length && i > blockLimits[currentBlock]) {
              currentBlock++;
              currentParent = randomInt(1);
            }
            
            const gene = genes[i];
            //console.log("Taking", gene, "from parent", currentParent+1);
            offspring[gene] = (currentParent === 0) ? p1.genes[gene] : p2.genes[gene];
          }
          return offspring;
    }

    function mutate(){

    }

}



//Main Planner Object
const architect = {
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
            totalPop:totalPop,
            population:generatePopulation(totalPop),
            iterations:maxIterations,
            running:true

        };
        for(let score of ['extensions', 'ramparts', 'storage', 'towers', 'misc','total']){
            this.config.highs[score] = 0;
            this.config.lows[score] = Infinity;
        }
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
        return true;
    },

    //Continues the current room plan process
    run: function(roomName,{totalPop=50, maxIterations=10,mutationRate=0.01,maxMutationMagnitude=0.5}={}){
        //If no plan config
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
        if(!roomName) roomName = this.data.roomName
        //If we're at the end of the generation
        if(this.config.subject == this.config.population.length){
            //Generate a new one if needed, else finish
            if(this.config.stage >= this.config.iterations){
                finalizePlan(this.config);
                return;
            }
            else updateGeneration(this.config);
        }

        //If not at the end of a generation, process a new plan
        else{
            //chronicle.log(`Generating room plan - ${roomName}. Genes: ${JSON.stringify(this.config.population[this.config.subject])}`,'architect',4)
            let results = fiefPlanner.generateRoomPlan(roomName,this.config.population[this.config.subject]);
            if(!results){
                chronicle.log(`Error generating room plan, no results. Skipping.`,'architect',1)
                this.config.totalCPU += newPlanCPU;
                this.config.subject++;
                return;
            }
            [newPlanCM,newPlan,newPlanCPU] = results;
            //chronicle.log(`Results received. Plan cost ${Math.round(newPlanCPU)} CPU.`,'architect',4)
            
            //Get the plan scores and add it and the genes to the current scores array
            let newPlanScores = scorePlan(roomName,newPlanCM,newPlan,config);
            if(!newPlanScores){
                chronicle.log(`No scores available.`,'architect',4)
                return;
            }
            //Update highs/lows if new ones are found
            for(let niche of Object.keys(newPlanScores)){
                let score = newPlanScores[niche];
                if(score > config.highs[niche]) config.highs[niche] = score;
                if(score < config.lows[niche]) config.lows[niche] = score;
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
global.testFiefPlan = function testFiefPlan(roomName,{totalPop=50, maxIterations=10,mutationRate=0.01,maxMutationMagnitude=0.5}={}){
    architect.run(roomName,{totalPop:totalPop,maxIterations:maxIterations,mutationRate:mutationRate,maxMutationMagnitude:maxMutationMagnitude});
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