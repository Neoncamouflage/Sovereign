const helper = require('functions.helper');
const minCut = require('minCut');
const fiefPlanner = {
    //Generates a distance transform for a room and sets it to test memory
    distanceTransform: function(terrain){
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
    },
    //High level room plan function
    //Generates multiple room/rampart plans with varying weights
    //Runs scoring on all plans
    //Returns CM and object for best plan
    //Stores rejected plans in heap
    getFiefPlan: function(roomName,totalPop = 20, maxIterations=10,mutationRate=0.01){
        // 2.3,0.69,2.28,1.91,2.74,0.44,2.5,2.84,0.46,0.37,1.88,2.45
        //Set up weight minimums and maximums for the genetic algorithm
        let geneLimits = [
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
        //We generate fief plans using a genetic algorithm to build multiple, improving plans
        //Setting up the planner object. Stage 1, Step 0, subject and CPU both start at 0,best scores start at infinity
        global.heap.fiefPlanner = {
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
            geneLimits:geneLimits,
            mutationRate:mutationRate
        };
        let fiefPlanner = global.heap.fiefPlanner;
        //global.heap.fiefPlanner.stage = 0;
        
        //Set up our initial population of random genes
        let population = [];
        for(let i = 0;i<totalPop;i++){
            let chromosome = [];
            for(let j = 0; j < geneLimits.length; j++){
                // Generate a random value between the min and max for each gene
                let min = geneLimits[j][0];
                let max = geneLimits[j][1];
                //Rounding to ensure no more than 2 decimals
                let gene = Math.round((Math.random() * (max - min) + min) * 100) / 100;
                chromosome.push(gene);
            }
            population.push(chromosome);
        }
        //Now that we have our population, we save it to heap
        fiefPlanner.population = population;
        //Now we set the planner stage to 1, since it's the first round
        fiefPlanner.stage = 1;
        //We set the subject to 0, to start with the first in our population
        fiefPlanner.subject = 0
        //Plan details
        fiefPlanner.roomName = roomName;
        fiefPlanner.iterations = maxIterations;

    },
    continueFiefPlan: function(){
        //Continue generating a fief plan
        let fiefPlanner = global.heap.fiefPlanner;
        //First we check the step, 1 for scoring and 0 for planning
        if(fiefPlanner.step == 0){
            //We run the plan until subjects equals our population length, then we're done with this stage
            if(fiefPlanner.subject < fiefPlanner.population.length){
                //Get our current set of genes and pass it to the planner
                let genes = fiefPlanner.population[fiefPlanner.subject]
                let [basePlanCM,basePlan,planCPU] = this.generateRoomPlan(fiefPlanner.roomName,{
                    eWeight:genes[0],
                    cWeight:genes[1],
                    sWeight:genes[2],
                    dWeight:genes[3],
                    blobTWeight:genes[4],
                    blobCWeight:genes[5],
                    blobEWeight:genes[6],
                    assnEWeight:genes[7],
                    assnCWeight:genes[8],
                    minCCWeight:genes[9],
                    minCEWeight:genes[10],
                    minCDWeight:genes[11],
                    minCIWeight:genes[12],
                    minCFWeight:genes[13]
                });
                //Returning negative 1 means bad genes.
                if(basePlanCM == -1){
                    fiefPlanner.totalCPU += planCPU;
                    fiefPlanner.currentPlan = basePlan;
                    fiefPlanner.currentCM = basePlanCM;
                }
                else{
                    //Assign the plan and CM for scoring, and set the step
                    fiefPlanner.currentPlan = basePlan;
                    fiefPlanner.currentCM = basePlanCM.serialize();
                    //Add cpu
                    fiefPlanner.totalCPU += planCPU;
                }
                fiefPlanner.step = 1;
                    
                
            }
            //If the stage is over, move on
            else{
                //If we've completed all stages, set the stage to 0 as we're finished
                if(fiefPlanner.stage >= fiefPlanner.iterations){
                    fiefPlanner.stage = 0;
                    console.log("Plan evolution complete. Generated",fiefPlanner.iterations*fiefPlanner.population.length,"plans over",fiefPlanner.iterations,"generations in",Game.time-fiefPlanner.startTick,"ticks\nTotalCPU:",fiefPlanner.totalCPU,"\nBest score:",fiefPlanner.bestScore,"\n2nd Place:",fiefPlanner.secondScore,"\n3rd Place:",fiefPlanner.thirdScore)
                    //Set the best plan to memory
                    let rclPlan = this.getRCLPlan();
                    Memory.testBasePlan = fiefPlanner.bestPlan;
                    Memory.testBasePlanCM = fiefPlanner.bestPlanCM;
                    Memory.testScoreTracker = fiefPlanner.bestScoreTracker;
                    //Save the plan in our segment and room
                    global.heap.roomPlans = JSON.parse(RawMemory.segments[1]);
                    global.heap.roomPlans[fiefPlanner.roomName] = [rclPlan,fiefPlanner.bestPlanCM];
                    RawMemory.segments[1] = JSON.stringify(global.heap.roomPlans)
                    //Save the RCL plan
                    Memory.testRCLPlan = rclPlan;
                }
                //Else we move to the next generation
                else{
                    //Check if all 3 top scores are within 1%. If so, we've converged.
                    if(fiefPlanner.bestScore - fiefPlanner.secondScore <= fiefPlanner.bestScore *0.01 && fiefPlanner.secondScore - fiefPlanner.thirdScore <= fiefPlanner.thirdScore * 0.01){
                        console.log("Plan evolution complete due to score convergence. Generated",fiefPlanner.iterations*fiefPlanner.population.length,"plans over",fiefPlanner.iterations,"generations in",Game.time-fiefPlanner.startTick,"ticks\nTotalCPU:",fiefPlanner.totalCPU,"\nBest score:",fiefPlanner.bestScore,"\n2nd Place:",fiefPlanner.secondScore,"\n3rd Place:",fiefPlanner.thirdScore)
                        fiefPlanner.stage = 0;
                        let rclPlan = this.getRCLPlan();
                        Memory.testBasePlan = fiefPlanner.bestPlan;
                        Memory.testBasePlanCM = fiefPlanner.bestPlanCM;
                        Memory.testScoreTracker = fiefPlanner.bestScoreTracker;
                        //Save the plan in our segment
                        global.heap.roomPlans = JSON.parse(RawMemory.segments[1]);
                        global.heap.roomPlans[fiefPlanner.roomName] = [rclPlan,fiefPlanner.bestPlanCM];
                        RawMemory.segments[1] = JSON.stringify(global.heap.roomPlans)
                        //Save the RCL plan
                        Memory.testRCLPlan = rclPlan;
                        return;
                    }
                    console.log("Generation",fiefPlanner.stage,"complete. Breeding population for generation",fiefPlanner.stage+1+".")
                    //Reset subject and increment stage
                    fiefPlanner.stage++;
                    fiefPlanner.subject = 0;

                    //Breed new generation, then reset ranked population
                    let newPop = [];
                    let topRank = [];
                    //Since we save top scores there's no risk of losing them, so no elitism
                    /*
                    //Move 10% of the current population over as-is
                    topRank.unshift(...fiefPlanner.rankedPop.slice(0,Math.ceil(fiefPlanner.rankedPop.length * 0.1)))
                    //For each of the top ranked, grab the subject
                    for(each of topRank){
                        newPop.push(fiefPlanner.population[each.subject]);
                    }
                    */
                    //Now we breed a new population until newPop hits our target population, which is the length of the old array
                    //We pair off from the top of the ranked population down
                    let counter = 0;
                    while(newPop.length < fiefPlanner.population.length){
                        let firstParentIndex = counter % fiefPlanner.rankedPop.length;
                        let secondParentIndex = (counter + 1) % fiefPlanner.rankedPop.length;

                        let firstParent = fiefPlanner.rankedPop[firstParentIndex].subject;
                        let secondParent = fiefPlanner.rankedPop[secondParentIndex].subject;
                        //Get the new offspring of our parents
                        let offspring = breedSubjects(fiefPlanner.population[firstParent], fiefPlanner.population[secondParent]);
                        //Allow for possible mutation
                        for (let child of offspring) {
                            //Push child to newPop array
                            newPop.push(mutateSubject(child,fiefPlanner.mutationRate));
                        }
                        counter++;
                    }           
                    //Reset the ranked population and replace the old subjects with the new
                    fiefPlanner.rankedPop = [];
                    fiefPlanner.population = newPop;
                }
            }
        }
        else if(fiefPlanner.step == 1){
            //Pull plan details and get a score for the plan
            let basePlan = fiefPlanner.currentPlan;
            let basePlanCM = fiefPlanner.currentCM == -1 ? -1 : PathFinder.CostMatrix.deserialize(fiefPlanner.currentCM);
            let score;
            let scoreTracker;
            //-1 means bad genes
            if(basePlan == -1 || basePlanCM == -1){
                score = Infinity;
            }else{
                [score,scoreTracker] = this.scoreFiefPlan(basePlan,basePlanCM);
            }
            
            //console.log("Base plan",JSON.stringify(basePlan))
            //Update scores
            if(score < fiefPlanner.bestScore){
                // New best score, shift down the others
                fiefPlanner.thirdScore = fiefPlanner.secondScore;
                fiefPlanner.thirdPlan = fiefPlanner.secondPlan;
                fiefPlanner.thirdPlanCM = fiefPlanner.secondPlanCM;
                fiefPlanner.thirdScoreTracker = fiefPlanner.secondScoreTracker;

                fiefPlanner.secondScore = fiefPlanner.bestScore;
                fiefPlanner.secondPlan = fiefPlanner.bestPlan;
                fiefPlanner.secondPlanCM = fiefPlanner.bestPlanCM;
                fiefPlanner.secondScoreTracker = fiefPlanner.bestScoreTracker;
            
                fiefPlanner.bestScore = score;
                fiefPlanner.bestPlan = basePlan;
                fiefPlanner.bestPlanCM = basePlanCM.serialize();
                fiefPlanner.bestScoreTracker = scoreTracker;
            } else if(score < fiefPlanner.secondScore){
                // New second-best score
                fiefPlanner.thirdScore = fiefPlanner.secondScore;
                fiefPlanner.thirdPlan = fiefPlanner.secondPlan;
                fiefPlanner.thirdPlanCM = fiefPlanner.secondPlanCM;
                fiefPlanner.thirdScoreTracker = fiefPlanner.secondScoreTracker;

                fiefPlanner.secondScore = score;
                fiefPlanner.secondPlan = basePlan;
                fiefPlanner.secondPlanCM = basePlanCM.serialize();
                fiefPlanner.secondScoreTracker = scoreTracker;
            } else if(score < fiefPlanner.thirdScore){
                // New third-best score
                fiefPlanner.thirdScore = score;
                fiefPlanner.thirdPlan = basePlan;
                fiefPlanner.thirdPlanCM = basePlanCM.serialize();
                fiefPlanner.thirdScoreTracker = scoreTracker;
            }

            //Set step to plan
            fiefPlanner.step = 0;

            //Record this subject and its score, maintaining an ascending order
            let index = fiefPlanner.rankedPop.findIndex(item => item.score > score);
            if (index === -1) {
                fiefPlanner.rankedPop.push({ subject: fiefPlanner.subject, score: score });
            } else {
                fiefPlanner.rankedPop.splice(index, 0, { subject: fiefPlanner.subject, score: score });
            }

            //Increase the subject
            fiefPlanner.subject++;

        }

        function mutateSubject(subject, mutationRate = 0.01) {
            let fiefPlanner = global.heap.fiefPlanner;
            for (let i = 0; i < subject.length; i++) {
                if (Math.random() < mutationRate) {
                    let geneMin = fiefPlanner.geneLimits[i][0];
                    let geneMax = fiefPlanner.geneLimits[i][1];

                    let mutationAmount = Math.random() * 2.0 - 0.1;
                    //Apply mutation and round to 2 decimals
                    console.log("Mutating",subject[i],'to',(Math.round((subject[i] + mutationAmount) * 100) / 100))
                    subject[i] += mutationAmount;
                    subject[i] = Math.round(subject[i] * 100) / 100;
                    //Ensure mutated gene stays within bounds
                    subject[i] = Math.min(Math.max(subject[i], geneMin), geneMax);
                }
            }
            return subject;
        }

        function breedSubjects(parent1,parent2){
            //Breeding method previously depended on game tick, now going with uniform swap
            
            //console.log("Breeding via uniform swap")
            //Uniform swap, 50/50 chance of swapping any given gene
            let offspring1 = [];
            let offspring2 = [];
            for (let i = 0; i < parent1.length; i++) {
                if (Math.random() > 0.5) { // Swap genes with 50% probability
                    offspring1.push(parent1[i]);
                    offspring2.push(parent2[i]);
                } else {
                    offspring1.push(parent2[i]);
                    offspring2.push(parent1[i]);
                }
            }
            //console.log("Parents\n",parent1,'\n',parent2)
            //console.log("Children\n",offspring1,'\n',offspring2)
            return [offspring1, offspring2];
            //if(Game.time % 2 == 0){}
            /*else{
                console.log("Breeding via single point swap")
                //Single point swap, picks a point and trades everything after
                let crossoverPoint = Math.floor(Math.random() * parent1.length);
                let offspring1 = parent1.slice(0, crossoverPoint).concat(parent2.slice(crossoverPoint));
                let offspring2 = parent2.slice(0, crossoverPoint).concat(parent1.slice(crossoverPoint));
                console.log("Parents\n",parent1,'\n',parent2)
                console.log("Children\n",offspring1,'\n',offspring2)
                return [offspring1, offspring2];
            }*/
            
        }
        
    },
    //Generates a room plan and returns a room plan CM and room plan object
    generateRoomPlan: function(roomName,opts){
        /*
        Need to find a way that saves some blocks for stuff like avoidance zones
        Think I'm currently using 25 or something like that

        
        Cost Matrix Blocks
        100    Rampart
        200    ~Unassigned~
        0-9    ~Unassigned~
        10-18  Roads
        20-28  Extensions
        30-38  Spawn
        40-48  Link
        50-58  Tower
        60-68  Container
        70-78  Lab
        80-88  ~Unassigned~
        90-98  ~Unassigned~
        */
        //Default weights
        if(!opts){
            opts = {
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
            }
        }
        //CONSTANTS
        const CORE_DISTANCE_TRANSFORM_MINIMUM = 2;
        const CORE_ZONE_RADIUS = 1;
        const CONTROLLER_BUFFER_RADIUS = 1;
        const EXIT_BUFFER_RADIUS = 5;
        const EXIT_BUFFER_COST = 26;
        const EXIT_WEIGHT = opts.eWeight;
        const CONTROLLER_WEIGHT = opts.cWeight;
        const SOURCE_WEIGHT = opts.sWeight;
        const DISTANCE_WEIGHT = opts.dWeight;
        let roomData = global.heap.scoutData[roomName];
        //If no room data, we're likely in spinup. Log and return
        if(!roomData){
            console.log("No room data for the room planner");
            return;
        }
        let sources = roomData.sources;
        let mineral = roomData.mineral;
        let exits = [];
        let startCPU = Game.cpu.getUsed();
        let terrain = Game.map.getRoomTerrain(roomName);
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
        //Base plan object, organized by RCL
        //Structure is basePlan = {1:{STRUCTURE_EXTENSION:[{x:23,y:34},{x:22,y:45}],STRUCTURE_SPAWN:[{x:23,y:34},{x:22,y:45}]}}
        let basePlan = {}
        
        //Get distance transform to look for large open areas
        let [distCM,distCMHighest,distCMLowest] = this.distanceTransform(terrain);
        //Base plan CM
        let basePlanCM = new PathFinder.CostMatrix;
        let baseRoadsCM = new PathFinder.CostMatrix;
        //Exclusion zones for base planning
        //Controller exclusion - using flood fill so it doesn't cross walls
        fiefPlanner.generateBufferFloodFill(roomName,terrain,[roomData.controller],basePlanCM,CONTROLLER_BUFFER_RADIUS)

        //Record wall groups
        let wallGroups = this.getWallGroups(roomName);
        Memory.test4 = wallGroups
        //Record convex hulls for all groups
        //let hulls = test.getConvexHulls(wallGroups)
        //Memory.test5 = hulls
        //Record perimeter tiles for all groups
        let perimeterGroups = {};
        Object.keys(wallGroups).forEach(key=>{
            perimeterGroups[key] = this.findPerimeterTiles(wallGroups[key])
        });
        Memory.test6 = perimeterGroups;
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
                        if(terrain.get(tileX,tileY) != TERRAIN_MASK_WALL && basePlanCM.get(tileX,tileY) != 255){
                            basePlanCM.set(tileX, tileY, EXIT_BUFFER_COST);
                        }
                    }
                }
            }
        })
        
        let sourceSpots = {};
        sources.forEach(source =>{
            sourceSpots[source.id] = [];
            for(let x = -1; x <= 1; x++) {
                for(let y = -1; y <= 1; y++) {
                    // Skip the source tile itself
                    if(x === 0 && y === 0) continue;
            
                    const tileX = source.x + x;
                    const tileY = source.y + y;
            
                    // Make sure we don't go out of bounds (0-49 for both x and y)
                    if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
                        //Make sure it isn't a wall, add to source spots array
                        if(terrain.get(tileX,tileY) != TERRAIN_MASK_WALL){
                            sourceSpots[source.id].push({x:tileX,y:tileY})
                        }
                    }
                }
            }
        })

        //Exit flood fill
        let [exitMatrix,exitHighest,exitLowest] = fiefPlanner.generateDistanceFloodFill(roomName,terrain,exits)
        Memory.test7 = exitMatrix.serialize();

        //Controller flood fill
        let [controllerMatrix,controllerHighest,controllerLowest] = fiefPlanner.generateDistanceFloodFill(roomName,terrain,[roomData.controller]);
        Memory.test8 = controllerMatrix.serialize();

        //Source flood fill
        let [sourceMatrix,sourceHighest,sourceLowest] = fiefPlanner.generateDistanceFloodFill(roomName,terrain,sources);

        //console.log(room.find(FIND_SOURCES))
        Memory.sourceMatrix = sourceMatrix.serialize();
        //Generate weighted cost matrix
        let combinedScoreMatrix = new PathFinder.CostMatrix
        //Track top scores and locations
        let topScore = 0;
        let bottomScore = Infinity;
        let scoreLocations = [];

        function minMaxNormalize(value, max, min) {
            if (max - min == 0){
                console.log("Attempting to divide by zero, max and min are both 0 with a value of",value);
                return 0; // Prevent division by zero
            }
            return (value - min) / (max - min);
        }
        

        for (let y = 2; y < 48; y++) {
            for (let x = 2; x < 48; x++) {
                let exitScore = exitMatrix.get(x, y);
                let controllerScore = controllerMatrix.get(x, y);
                let sourceScore = sourceMatrix.get(x,y);
                let distanceScore = distCM.get(x,y);
    
                //If distance score is less than what we need for a core, skip
                if(distanceScore < CORE_DISTANCE_TRANSFORM_MINIMUM) continue;

                //If the core location is in a restricted area, skip
                if(basePlanCM.get(x,y) == 25 || basePlanCM.get(x,y) == 26) continue;
                //Combined score is all ranges added together
                //Also subtracting distance transform score to prefer open areas
                //Lowest score wins
                //console.log("Exit:",exitScore,"\nController:",controllerScore,"\nSource:",sourceScore,"\nDistance:",distanceScore)
                let normalizedExit = (minMaxNormalize(exitScore,exitHighest,exitLowest) * 100 );
                let normalizedController = (minMaxNormalize(controllerScore,controllerHighest,controllerLowest) * 100 );
                let normalizedSource = (minMaxNormalize(sourceScore,sourceHighest,sourceLowest) * 100 );
                let normalizedDistance = (minMaxNormalize(distanceScore,25,1) * 100 );
                //console.log("(Normalized) Exit:",normalizedExit,"\nController:",normalizedController,"\nSource:",normalizedSource,"\nDistance:",normalizedDistance)
                let combinedScore = 50
                +  (normalizedExit * EXIT_WEIGHT)
                +  (normalizedController * CONTROLLER_WEIGHT)
                +  (normalizedSource * SOURCE_WEIGHT)
                -  (normalizedDistance *DISTANCE_WEIGHT);
                //Replace top score and locations if lower, if tied then add to top locations
                //console.log(x,y,"score is",combinedScore);
                if(combinedScore < bottomScore){
                    bottomScore = combinedScore;
                    scoreLocations = [{x:x,y:y}]
                }else if(combinedScore == bottomScore){
                    scoreLocations.push({x:x,y:y})
                }else if(combinedScore > topScore){
                    topScore = combinedScore;
                }
            }
        }

        //Now that we have highest and lowest combined scores, we can loop once and set them all
        //Was only for testing, not actually used anywhere so not fixing it
        //combinedScoreMatrix.set(x, y,Math.round(minMaxNormalize(combinedScore,bottomScore,topScore)*100));


        //console.log("Lowest score is",bottomScore,'at the following:\n',scoreLocations)
        //console.log("Highest score is",topScore)
        let coreLocation;
        //Take top location if only one, otherwise shortest distance
        let controllerPos = new RoomPosition(roomData.controller.x,roomData.controller.y,roomName)
        if(scoreLocations.length == 1){
            coreLocation = scoreLocations[0];
        }else{
            let shortestScore = Infinity;
            let shortestSpot;
            let thisRange;
            let spares = []
            
            //For each spot, get the total distance to controller/sources
            scoreLocations.forEach(spot=>{
                thisRange = 0;
                thisRange += getDistance(controllerPos,new RoomPosition(spot.x,spot.y,roomName))[0];
                sources.forEach(source=>{
                    thisRange += getDistance(new RoomPosition(source.x,source.y,roomName),new RoomPosition(spot.x,spot.y,roomName))[0];
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
                    thisRange = getDistance(controllerPos,new RoomPosition(spot.x,spot.y,roomName))[0];
                    if(thisRange < shortestScore) shortestSpot = spot;
                });
                coreLocation = shortestSpot;

            }



        }




        if(!coreLocation) return [-1,-1,-1]


        //Path roads
        //Wrap roads around storage and add to base plan
        basePlan.roads = {};
        basePlan.roads.core = [];
        for(let ny=-1;ny<=1;ny++){
            for(let nx=-1;nx<=1;nx++){
                if(coreLocation.x+nx > 0 && coreLocation.x+nx < 49 && coreLocation.y+ny > 0 && coreLocation.y+ny < 49){
                    if(terrain.get(coreLocation.x+nx,coreLocation.y+ny) != TERRAIN_MASK_WALL){
                        if(!(nx==0 && ny==0)){
                            basePlanCM.set(coreLocation.x+nx,coreLocation.y+ny,99);
                            baseRoadsCM.set(coreLocation.x+nx,coreLocation.y+ny,1);
                            basePlan.roads.core.push({x:coreLocation.x+nx,y:coreLocation.y+ny})
                        }
                    }
                }
                
            }
        }
        basePlanCM.set(coreLocation.x,coreLocation.y,98)
        baseRoadsCM.set(coreLocation.x,coreLocation.y,255)
        basePlan.storage={x:coreLocation.x,y:coreLocation.y};
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);
        let sourcePaths = [];
        let controllerPath = PathFinder.search(storagePos,{pos:controllerPos,range:1},{
            // Same cost for everything because we're finding a centerpoint
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return baseRoadsCM;
            },
        }).path;
        controllerPath.forEach(spot=>{
            if(basePlanCM.get(spot.x,spot.y) == 0){
                basePlanCM.set(spot.x,spot.y,99)
            }
            baseRoadsCM.set(spot.x,spot.y,1)
        });
        basePlan.roads.controller = controllerPath;
        sources.forEach(source => {
            let sourcePath = PathFinder.search(storagePos,{pos:new RoomPosition(source.x,source.y,roomName),range:1},{
                // Same cost for everything because we're finding a centerpoint
                plainCost: 10,
                swampCost: 11,
                maxRooms:1,
                roomCallback: function() {
                  return baseRoadsCM;
                },
            }).path;
            //Remove the last spot in the path
            let lastSpot = sourcePath.pop();
            //Assign a value of 25 to mark it as a harvest spot.
            if(lastSpot){
                basePlanCM.set(lastSpot.x,lastSpot.y,25)
                baseRoadsCM.set(lastSpot.x,lastSpot.y,255)
            }
            else{
                //console.log("No last spot for source",source.x,source.y)
                //console.log(sourcePath)
                //Return negatives
                return [-1,-1,-1]
            }
            sourcePath.forEach(spot=>{
                if(basePlanCM.get(spot.x,spot.y) == 0){
                    basePlanCM.set(spot.x,spot.y,99)
                }
                baseRoadsCM.set(spot.x,spot.y,1)
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
                    if(terrain.get(lastSpot.x+nx,lastSpot.y+ny) != TERRAIN_MASK_WALL && basePlanCM.get(lastSpot.x+nx,lastSpot.y+ny) != 1){
                        //If not the source itself
                        if(!(nx==0 && ny==0)){
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
            baseRoadsCM.set(sourceLinkSpot.x,sourceLinkSpot.y,255);
            //console.log('Setting spot',sourceLinkSpot.x,sourceLinkSpot.y,'as link')
        });
        basePlan.roads.sources = sourcePaths;
        let mineralPath = PathFinder.search(storagePos,{pos:new RoomPosition(mineral.x,mineral.y,roomName),range:1},{
            // Same cost for everything because we're finding a centerpoint
            plainCost: 10,
            swampCost: 11,
            maxRooms:1,
            roomCallback: function() {
              return baseRoadsCM;
            },
        }).path;
        //Remove the last spot in the path
        let lastSpot = mineralPath.pop();
        //Assign a value of 25 to mark it as a harvest spot.
        basePlanCM.set(lastSpot.x,lastSpot.y,25)
        baseRoadsCM.set(lastSpot.x,lastSpot.y,255)
        mineralPath.forEach(spot=>{
                basePlanCM.set(spot.x,spot.y,99)
                baseRoadsCM.set(spot.x,spot.y,1)
        });
        basePlan.roads.mineral = mineralPath;

        basePlan.controller = controllerPos;
        basePlan.sources = sources
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

        //distCM = fiefPlanner.distanceTransform(roomName,secondDist);
        //Memory.test2 = distCM.serialize();

        


        


        let structureBlobCM = fiefPlanner.generateStructureFloodFill(roomName,terrain,coreRoomPositions,basePlanCM);
        //Possible structure positions, excluding planned roads and the core
        
        //Get the structure blob
        fiefPlanner.connectStructures(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitMatrix,opts.blobTWeight,opts.blobCWeight,opts.blobEWeight)
        //Convert potential structure locations to assigned structures for first pass using a temporary CM
        let assignedStructureBlobCM = structureBlobCM.clone();
        //This temporary CM gets structures assigned, passing 10 spares so we can replace some with roads later
        fiefPlanner.assignStructures(roomName,terrain,basePlanCM,assignedStructureBlobCM,basePlan,exitMatrix,10,opts.assnEWeight,opts.assnCWeight);
        //Set weights for the core
        assignedStructureBlobCM.set(basePlan.storage.x,basePlan.storage.y,98);
        structureBlobCM.set(basePlan.storage.x,basePlan.storage.y,98);

        //Get mincut cm
        //50/50 chance we use a plain CM or get weird with it
        let fifty = opts.minCFWeight < 8;
        //Function specifically for mincut CM scores, scaling in a range of 1 - 254
        function scaleScore(value, min, max) {
            if (max - min == 0) return 1; // Avoid division by zero, default to lowest cost if all scores are equal
            // Scale the normalized value to 1-254 range
            return 1 + Math.round(((value - min) / (max - min)) * 253);
        }
        let mincutCM = new PathFinder.CostMatrix;
        let [coreDistCM,coreDistHighest,coreDistLowest] = fiefPlanner.generateDistanceFloodFill(roomName,terrain,[storagePos])
        let minTileHighest = 0;
        let minTileLowest = 999;
        let scoresCache = [];
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                if(terrain.get(x, y) == TERRAIN_MASK_WALL){
                    mincutCM.set(x,y,255);
                }
                else{
                    if(fifty){
                        mincutCM.set(x,y,distCM.get(x,y))
                    }
                    else{
                        //Normalize all scores
                        let normCoreDist = minMaxNormalize(coreDistCM.get(x,y),coreDistHighest,coreDistLowest);
                        let normExitDist = minMaxNormalize(exitMatrix.get(x,y),exitHighest,exitLowest)
                        let normDistTrans = minMaxNormalize(distCM.get(x,y),distCMHighest,distCMLowest)
                        //Calculate the tile score by multiplying the normalized scores with the weights
                        let tileScore = (normDistTrans*opts.minCDWeight) + (normCoreDist*opts.minCCWeight) - (normExitDist*opts.minCEWeight)
                        //Update highest/lowest
                        if(tileScore > minTileHighest){
                            minTileHighest = tileScore;
                        }
                        if(tileScore < minTileLowest){
                            minTileLowest = tileScore;
                        }
                        //Save the score for the second pass
                        scoresCache.push([tileScore,x,y])
                    }
                    
                }
            }
        }
        //Now that we have the highest and lowest, loop through the saved scores and apply them if needed
        if(fifty){
            for(score of scoresCache){
                let scaledScore = scaleScore(score[0], minTileLowest, minTileHighest);
                mincutCM.set(score[1],score[2],scaledScore)
            }
        }
        
        Memory.minCutCM = mincutCM.serialize();
        //Get a rampart plan based on the blob CM with spare extensions
        let minCutIncludeController = false;
        if(opts.minCIWeight > 5){
            minCutIncludeController = true;
        }
        let [rampartSpots,rampartCPU] = minCut.planRamparts(roomName,assignedStructureBlobCM,mincutCM,minCutIncludeController)
        //Trim extra ramparts
        let trimmedRamps = this.trimRamparts(rampartSpots,terrain,[basePlan.storage]);
        //Path to each rampart group
        let rampGroups = this.getRampartGroups(trimmedRamps);
        let walkCM = new PathFinder.CostMatrix;
        for(x=1;x<49;x++){
            for(y=1;y<49;y++){
                //If it's 99 in the blob plan, that's a road. Set cost to 5 so we prefer planned roads over plains (10) unless it only saves us a couple tiles.
                if(assignedStructureBlobCM.get(x,y) == 99){
                    walkCM.set(x,y,5)
                }
                //Copy over 255  and 25 scores for terrain and buffers
                else if(basePlanCM.get(x,y) == 255 || basePlanCM.get(x,y) == 25){
                    walkCM.set(x,y,basePlanCM.get(x,y))
                }
            }
        }
        //Loop through all trimmed rampart spots and make them unwalkable for rampart pathing
        for(ramp in trimmedRamps){
            walkCM.set(ramp.x,ramp.y,255)
        }
        //Set up rampart roads array and add the rampart spots themselves
        basePlan.roads.rampart = [...trimmedRamps]
        for(let group of rampGroups){
            //console.log(JSON.stringify(rampGroups))
            //console.log(JSON.stringify(group))
            let rampPath = PathFinder.search(storagePos,group.map(tile => ({
                pos: new RoomPosition(tile.x, tile.y, roomName),
                range: 1
            })),
            {
                plainCost: 10,
                swampCost: 11,

                roomCallback: function(roomName) {
                    let costs = walkCM;
                    return costs;
                },
            }).path;

            //For each spot in the path
            for(spot of rampPath){
                //See if we're walking over 
                //Add path roads to base plan and the permanent blob CM
                basePlan.roads.rampart.push(spot);
                basePlanCM.set(spot.x,spot.y,99);
                structureBlobCM.set(spot.x,spot.y,99)
            }
        };
        //Now that we have rampart roads included, get actual structure assignments for the blob
        //First we need to mark everything within 3 spaces of a rampart as score 199, so we don't convert those structures
        //We use the untrimmed rampart array so we don't build where trimmed ramparts would have been protecting us
        let markedTiles = new Set();
        for(let ramp of trimmedRamps){            
            //Mark the rampart so we don't build under it
            structureBlobCM.set(ramp.x,ramp.y,199)
            for(let x=-2;x<3;x++){
                for(let y=-2;y<3;y++){
                    let rampKey = `${ramp.x+x},${ramp.y+y}`
                    if(!markedTiles.has(rampKey) && ramp.x+x >= 0 && ramp.x+x < 50 && ramp.y+y >= 0 && ramp.y+y < 50){
                        markedTiles.add(rampKey);
                        structureBlobCM.set(ramp.x+x,ramp.y+y,199)
                    }
                }
            }
        }
        //Mark spots in basePlanCM
        for(let ramp of trimmedRamps){
            basePlanCM.set(ramp.x,ramp.y,100)
        }
        Memory.testStructureBlobCM = structureBlobCM.serialize();
        //Now assign structures
        fiefPlanner.assignStructures(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitMatrix,0,opts.assnEWeight,opts.assnCWeight);
        //Assign labs
        fiefPlanner.assignLabs(roomName,terrain,basePlanCM,structureBlobCM)
        
        //Array for extension roads before we fill it
        basePlan.roads.extensions = []
        //Fill base plan and base plan CM with assigned structure blob buildings
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                let blobSpot = structureBlobCM.get(x,y);
                if(Memory.roomPlanReference[blobSpot]){
                    //Don't copy storage (98) and roads/labs get a separate check below
                    let thisStruct = Memory.roomPlanReference[blobSpot];
                    if(![98,99,75,76].includes(blobSpot)){
                        basePlanCM.set(x,y,blobSpot);
                        //If not in the base plan, add
                        if(!basePlan[thisStruct]){
                            basePlan[thisStruct] = [];
                        }
                        basePlan[thisStruct].push({x:x,y:y})
                    }
                    else if([75,76].includes(blobSpot)){
                        //Set labs
                        if(!basePlan[thisStruct]){
                            basePlan[thisStruct] = [];
                        }
                        basePlanCM.set(x,y,blobSpot);
                        basePlan[thisStruct].push({x:x,y:y,type:blobSpot})
                    }
                    //Don't replace ramparts
                    else if(blobSpot == 99 && basePlanCM.get(x,y) != 100){
                        //99 marked roads are for extensions, add if not marked in base plan already
                        basePlanCM.set(x,y,blobSpot);
                        basePlan.roads.extensions.push({x:x,y:y})
                    }
                }
                
            }
        }

        //Emergency check for no extensions, reject and save for review
        if(!basePlan.extension){
            Memory.brokenBasePlanCM = basePlanCM.serialize();
            Memory.brokenBasePlan = basePlan
            return [-1,-1,-1]
        }

        Memory.testBasePlanCM = basePlanCM.serialize();
        

        basePlan.ramparts = trimmedRamps
        Memory.minCutResult = trimmedRamps;
        [Memory.testScore,Memory.testScoreTracker] = this.scoreFiefPlan(basePlan,basePlanCM);
        return [basePlanCM,basePlan,Game.cpu.getUsed()-startCPU+rampartCPU]

    },
    generateDistanceFloodFill: function(roomName,terrain,origins){
        let lowestScore = Infinity;
        let highestScore = 0;
        let costMatrix = new PathFinder.CostMatrix;
        let queue = [];
        
        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit, distance: 1});
            costMatrix.set(exit.x, exit.y, 1);
        });
        while (queue.length > 0) {
            //Pull the next tile in the queue and fetch adjacent tiles
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos);
            
            //For each valid adjacent tile
            adjacentTiles.forEach(({x, y}) => {
                
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    let currentDistance = costMatrix.get(x, y);
                    if (currentDistance === 0 || currentDistance > tile.distance + 1) {
                        costMatrix.set(x, y, tile.distance + 1);
                        if(tile.distance+1 > highestScore) highestScore = tile.distance+1;
                        if(tile.distance+1 < lowestScore) lowestScore = tile.distance+1
                        queue.push({pos: new RoomPosition(x, y, roomName), distance: tile.distance + 1});
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
    },
    generateStructureFloodFill: function(roomName,terrain,origins,basePlanCM){
        let startCPU = Game.cpu.getUsed();
        let costMatrix = new PathFinder.CostMatrix;
        const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]];
        let queue = [];
        let totalTiles = 0;
        let targetTiles = 1200;
        let structurePositions = [];
        
        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit});
        });
    
        while (queue.length > 0 && totalTiles < targetTiles) {
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos); // Now implemented
            adjacentTiles.forEach(({x, y}) => {
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    
                    let tileScore = costMatrix.get(x, y);
                    //If tile isn't scored yet
                    if(tileScore === 0){
                        //If 0 in the base plan, set to 1 as a buildable tile
                        if (basePlanCM.get(x,y) == 0) {
                            costMatrix.set(x, y,1);
                            queue.push({pos: new RoomPosition(x, y, roomName)});
                            totalTiles++;
                        }
                        //Else if 1 in the base plan, include in the blob as a planned road
                        else if (basePlanCM.get(x,y) == 1 || basePlanCM.get(x,y) == 99) {
                            costMatrix.set(x, y,99);
                            queue.push({pos: new RoomPosition(x, y, roomName)});
                            totalTiles++;
                        }
                        //Else if 95, include it as a link
                        else if(basePlanCM.get(x,y) == 95){
                            costMatrix.set(x, y,95);
                            queue.push({pos: new RoomPosition(x, y, roomName)});
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
        //console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
        return costMatrix;
    },
    generateBufferFloodFill: function(roomName,terrain,origins,basePlanCM,loopMax=3){
        let startCPU = Game.cpu.getUsed();
        let costMatrix = new PathFinder.CostMatrix;
        let queue = [];
        let loop = 0;

        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            queue.push({pos: exit, distance: 0});
        });
    
        while (queue.length > 0 && loop <= loopMax) {
            let tile = queue.shift();
            let adjacentTiles = findAdjacentTiles(tile.pos); // Now implemented
    
            adjacentTiles.forEach(({x, y}) => {
                
                // Ensure we only process tiles within the room boundaries and are not already processed with a lower distance
                if (terrain.get(x,y) != TERRAIN_MASK_WALL && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    let tileScore = costMatrix.get(x, y);
                    if (tileScore === 0 && basePlanCM.get(x,y) == 0) {
                        costMatrix.set(x, y, tile.distance + 1);
                        basePlanCM.set(x,y,25);
                        queue.push({pos: new RoomPosition(x, y, roomName), distance: tile.distance + 1});
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
        //console.log("Flood fill CPU cost",Game.cpu.getUsed()-startCPU)
        return costMatrix;
    },
    connectStructures: function(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitTileCM,alpha = 1.5,beta = 2.6, romeo = 1.8){
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
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);

        //Normalization
        function normalize(value, min, max) {
            return (max - min) != 0 ? Math.round(((value - min) / (max - min))*100) : 0;
        }
    
        //Get all road tiles and add valid adjacent positions to connectedStructures
        //Change score in blob CM for connected structures
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                let planTile = basePlanCM.get(x,y);
                //If the tile is a preplanned structure
                if(planTile == 255) structureBlobCM.set(x,y,255)
                //If the tile in the plan is a road
                if(planTile == 1 || planTile == 99){
                    //Mark 99 in the blob so we can see it
                    //99 is for full roads, which planned roads are
                    structureBlobCM.set(x,y,99)
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
    assignStructures: function(roomName,terrain,basePlanCM,structureBlobCM,basePlan,exitTileCM,spareCount=0,alpha=1,bravo=1){
        let ALPHA = alpha; //Exit tile weight, higher pushes away from exits
        let BRAVO = bravo; //Range from core weight, higher prioritizes core distance
        let structures = [33,94,95,97,96,33,88,88,88,88,88,88,33]
        let distantStructs = [44,45]
        let storagePos = new RoomPosition(basePlan.storage.x,basePlan.storage.y,roomName);
        let count = 0;
        let secondCount = 0;
        let extCount = 60+spareCount; //Add spareCount, which we call to get spare extensions on the first pass.
        let labCount = 10;
        let visited = new Set(); // Track visited positions as a string "x,y"
        let toVisit = [{ pos: storagePos, score: exitTileCM.get(storagePos.x, storagePos.y) }]
        let directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 },                   { dx: 1, dy: 0 },
            { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
        ];
        
        while (toVisit.length > 0 && count + secondCount < structures.length + extCount + labCount + distantStructs.length) {
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
                    //Scoring
                    let score = exitTileCM.get(newX, newY)*ALPHA;
                    score -= storagePos.getRangeTo(newPos)*BRAVO;
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
                        }else if (count < structures.length + extCount + labCount){
                            structureBlobCM.set(newX,newY,60);
                            count++;
                        }else{
                            structureBlobCM.set(newX,newY,distantStructs[secondCount]);
                            secondCount++;
                        }

                        //If this is a temporary road, confirm it as a real one since we're building next to it
                        //Only do this on the second pass, when sparecount is zero
                        if (spareCount == 0 && structureBlobCM.get(currentPos.x,currentPos.y) === 89){
                            structureBlobCM.set(currentPos.x,currentPos.y,99)
                        }
        
                    }
                }
            });
        }
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
    getRampartGroups: function(ramparts){
        //With the new ramparts planned, we path roads to each group.
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let rampGroups = [];
        let checkedRamps = new Set();
        //Register all rampart keys to let us do quick checks
        let rampartLookup = new Set(ramparts.map(ramp => `${ramp.x},${ramp.y}`));

        //Look through every rampart. If it isn't in the set of checked ramps, we find all its neighbors and put them in a group.
        for (let each of ramparts){
            //Get the key for this rampart and skip the loop if it's already been found
            let rampKey = `${each.x},${each.y}`;
            if(checkedRamps.has(rampKey)){
                //console.log("Has the key, skipping")
                continue;
            };
            let currentGroup = [];
            //We haven't visited it yet so add it to the set and find the other tiles
            groupRamps(each.x, each.y, currentGroup);
            if (currentGroup.length > 0) {
                rampGroups.push(currentGroup);
            }
        }

        function groupRamps(x, y, currentGroup) {
            let key = `${x},${y}`;
            // If this rampart is not in rampartLookup or already checked, return
            if (!rampartLookup.has(key) || checkedRamps.has(key)) return;
            // Mark as checked and add to current group
            checkedRamps.add(key);
            currentGroup.push({x, y});
    
            // Explore all directions
            for (let [dx, dy] of directions) {
                groupRamps(x + dx, y + dy, currentGroup);
            }
        }
        return rampGroups;
    },
    scoreFiefPlan: function(basePlan,basePlanCM){
        //Scores a room plan based on a number of factors
        /**
         * Score will take into account:
         * Max extension range from storagex
         * Average extension range from storagex
         * Total rampart tiles x
         * Total rampart groups ?
         * Average range from rampart tile to storage x
         * Range from storage to controller x
         * Range from storage to sources x
         * Sources/mineral/controller? outside of ramparts
         * Lowest score is best
         */
        let scoreTracker = {};
        //Pull score weights from memory.
        let scoreWeights = Memory.scoreWeights;
        //Base score so we can increase and decrease
        let totalScore = 0;
        //Increase score based on total rampart tiles
        totalScore += basePlan.ramparts.length*scoreWeights.rampTileWeight;
        scoreTracker.rampartAmountScore = basePlan.ramparts.length*scoreWeights.rampTileWeight
        //Increase score based on total range from ramparts to storage
        scoreTracker.rampartRangeScore = 0;
        for(ramp of basePlan.ramparts){
            //console.log('Ramp test',JSON.stringify(ramp))
            //console.log(JSON.stringify(basePlan.storage))
            totalScore += getDistance(ramp,basePlan.storage)*scoreWeights.rampDistWeight;
            scoreTracker.rampartRangeScore += Math.round(getDistance(ramp,basePlan.storage)*scoreWeights.rampDistWeight);
        }
        //Increase score based on total range from storage to controller/sources
        totalScore += getDistance(basePlan.storage,basePlan.controller)*scoreWeights.controllerDistWeight;
        scoreTracker.controllerDistanceScore = getDistance(basePlan.storage,basePlan.controller)*scoreWeights.controllerDistWeight;
        scoreTracker.sourceDistanceScore = 0;
        for(source of basePlan.sources){
            //console.log("Source test",source)
            totalScore += getDistance(basePlan.storage,source)*scoreWeights.sourceDistWeight;
            scoreTracker.sourceDistanceScore += Math.round(getDistance(basePlan.storage,source)*scoreWeights.sourceDistWeight);
        }
        //Increase score based on total range and max ranges for extensions. Max range should eventually use pathing
        //If there are fewer than 60 extensions, increase score for each extension missing
        let maxExt = 0;
        let total = 0;
        for(ext of basePlan.extension){
            let thisDist = getDistance(basePlan.storage,ext);
            total += thisDist;
            if(thisDist > maxExt) maxExt = thisDist;
        }
        totalScore += Math.round((total/basePlan.extension.length))*scoreWeights.extensionDistWeight;
        scoreTracker.extensionDistanceScore = Math.round((total/basePlan.extension.length))*scoreWeights.extensionDistWeight;
        totalScore += maxExt * scoreWeights.extensionMaxWeight;
        scoreTracker.extensionMaxDistanceScore = maxExt * scoreWeights.extensionMaxWeight;
        if(basePlan.extension.length < 60){
            totalScore += (60-basePlan.extension.length) * scoreWeights.extensionMissingWeight
            scoreTracker.extensionMissingScore = (60-basePlan.extension.length) * scoreWeights.extensionMissingWeight
        }

        //Flood fill from exits to check if controller, sources, mineral, or any buildings are outside ramparts
        let exits = [];
        let terrain = Game.map.getRoomTerrain(global.heap.fiefPlanner.roomName);
        for(i = 1;i<50;i++){
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
        let [controllerFound,sourceFound,structureFound] = this.generateScoreFloodFill(terrain,exits,basePlanCM);
        //If we found any, increase the score accordingly
        scoreTracker.controllerFoundScore = 0;
        scoreTracker.sourceFoundScore = 0;
        scoreTracker.structureFoundScore = 0;
        if(controllerFound){
            totalScore += scoreWeights.controllerFoundWeight;
            scoreTracker.controllerFoundScore = scoreWeights.controllerFoundWeight;
        }
        if(sourceFound){
            totalScore += scoreWeights.sourceFoundWeight;
            scoreTracker.sourceFoundScore = scoreWeights.sourceFoundWeight;
        }
        if(structureFound){
            totalScore += scoreWeights.structureFoundWeight;
            scoreTracker.structureFoundScore = scoreWeights.structureFoundWeight
        }

        //Return the score
        return [totalScore,scoreTracker];
        

        function getDistance(point1, point2) {
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            return Math.round(Math.sqrt(dx * dx + dy * dy));
        }



    },
    generateScoreFloodFill: function(terrain,origins,basePlanCM){
        let roomName = global.heap.fiefPlanner.roomName
        let controllerFound = false;
        let sourceFound = false;
        let structureFound = false;
        let controller = global.heap.scoutData[roomName].controller
        let sources = global.heap.scoutData[roomName].sources
        let queue = [];
        let visited = new Set();
        let testCM = new PathFinder.CostMatrix;
        
        //Origins is always an array, even when there's only one
        origins.forEach(exit => {
            let exitKey = `${exit.x},${exit.y}`;
            visited.add(exitKey); // Mark origins as visited
            queue.push(exit);
        });
    
        while (queue.length > 0) {
            let tile = queue.shift();

            let adjacentTiles = findAdjacentTiles(tile);
            adjacentTiles.forEach(({x, y}) => {
                if (terrain.get(x,y) == TERRAIN_MASK_WALL) {
                    //If it's a terrain wall, see if it's the controller or a source
                    if(x == controller.x && y == controller.y){
                        testCM.set(x,y,100)
                        controllerFound = true
                    }
                    else{
                        for(each of sources){
                            if(x == each.x && y == each.y){
                                sourceFound = true;
                                testCM.set(x,y,200)
                            }
                            else{
                                testCM.set(x,y,2)
                            }
                        }
                    }
                    //We don't push to the queue as we don't want to go deeper into the walls                 
                }
                //If not a wall, check if there's a structure there and push it to the queue
                else{
                    //Flag on any building that's not a link, road, or rampart
                    if(Memory.roomPlanReference[basePlanCM.get(x,y)] && ![99,95].includes(basePlanCM.get(x,y))){
                        testCM.set(x,y,80)
                        structureFound = true;
                        //console.log("Structure found",Memory.roomPlanReference[basePlanCM.get(x,y)],'at',x,y)
                    }
                    else{
                        testCM.set(x,y,1)
                    }
                    
                    queue.push({x, y});
                }
            });
        }

        function findAdjacentTiles(pos) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            for(let direction of directions) {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                let key = `${x},${y}`;
                if (visited.has(key)) { 
                    continue;
                }
                visited.add(key);
                if (x >= 0 && x < 50 && y >= 0 && y < 50) { //Check if within bounds
                    //If it's  rampart, set the test CM and move to next loop
                    if(basePlanCM.get(x,y) == 100){
                        testCM.set(x,y,110);
                        continue;
                    }
                    //Otherwise push the tile
                    tiles.push({x: x, y: y});
                }
            };
            return tiles;
        }
        Memory.testScoreFloodCM = testCM.serialize();
        return [controllerFound,sourceFound,structureFound];
    },
    getRCLPlan: function(){
        let rclTrack={}; // Tracks the structure type and how many we've placed so we can gauge RCL
        let rclPlan = {
            1:{},
            2:{},
            3:{},
            4:{},
            5:{},
            6:{},
            7:{},
            8:{}

        };
        let fiefPlanner = global.heap.fiefPlanner;
        let basePlan = fiefPlanner.bestPlan;
        let extensionSet = new Set();
        let rcl3Set = new Set();
        let rcl4Set = new Set();
        let rcl6Set = new Set();
        let basePlanCM = PathFinder.CostMatrix.deserialize(fiefPlanner.bestPlanCM);
        let terrain = Game.map.getRoomTerrain(global.heap.fiefPlanner.roomName);
        //Saves the current best room plan from the planner algorithm
        //Process the base plan object for saving
        let queue = [basePlan.storage];
        let visited = new Set();

        //First we get all primary roads that will be built at RCL 3
        //These are core,controller, and source roads
        rclPlan[3][STRUCTURE_ROAD] = []
        for(let road of basePlan.roads.core){
            let key = `${road.x},${road.y}`;
            if(!rcl3Set.has(key)){
                rcl3Set.add(key);
                rclPlan[3][STRUCTURE_ROAD].push({x:road.x,y:road.y})
            }
        }
        for(let road of basePlan.roads.controller){
            let key = `${road.x},${road.y}`;
            if(!rcl3Set.has(key)){
                rcl3Set.add(key);
                rclPlan[3][STRUCTURE_ROAD].push({x:road.x,y:road.y})
            }
        }
        for(let source in basePlan.roads.sources){
            for(let road of basePlan.roads.sources[source]){
                let key = `${road.x},${road.y}`;
                if(!rcl3Set.has(key)){
                    rcl3Set.add(key);
                    rclPlan[3][STRUCTURE_ROAD].push({x:road.x,y:road.y})
                }
            }
        }

        //Now we fill out RCL 4 roads, which are rampart routes
        //We exclude all RCL 3 roads since they're built at a prior level
        rclPlan[4][STRUCTURE_ROAD] = []
        for(let road of basePlan.roads.rampart){
            let key = `${road.x},${road.y}`;
            if(!rcl3Set.has(key) && !rcl4Set.has(key)){
                rcl4Set.add(key);
                rclPlan[4][STRUCTURE_ROAD].push({x:road.x,y:road.y})
            }
        }

        //Finally, we fill in RCL 6 roads to the mineral
        rclPlan[6][STRUCTURE_ROAD] = []
        for(let road of basePlan.roads.mineral){
            let key = `${road.x},${road.y}`;
            if(!rcl3Set.has(key) && !rcl4Set.has(key)&& !rcl6Set.has(key)){
                rcl6Set.add(key);
                rclPlan[6][STRUCTURE_ROAD].push({x:road.x,y:road.y})
            }
        }

        //Only now do we fill in the extension roads, excluding all others
        for(let road of basePlan.roads.extensions){
            //console.log("Road",JSON.stringify(road))
            let key = `${road.x},${road.y}`;
            if(!extensionSet.has(key) && !rcl3Set.has(key) && !rcl4Set.has(key)&& !rcl6Set.has(key)){
                extensionSet.add(key);
            }
        }
        //console.log(extensionSet)
        //console.log(JSON.stringify(extensionSet))
        //First we get all extension roads so we know what we should mark
        //for(road in basePlan.roads.extensions){
            //let key = `${road.x},${road.y}`;
            //if(!extensionSet.has(key)){
                //extensionSet.add(key);
            //}
        //}
        
        while (queue.length > 0) {
            //Set up for the next tile
            let {x, y} = queue.shift();
            let key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            //If it's a structure except a rampart, add to the RCL plan. Ramparts aren't tied to RCL
            if(Memory.roomPlanReference[basePlanCM.get(x,y)] && basePlanCM.get(x,y) != 100){
                addToRCL(Memory.roomPlanReference[basePlanCM.get(x,y)],rclTrack,rclPlan,{x,y},extensionSet);
            }

            //If the current tile is a non-road structure, we continue, as we want to follow the roads. Also exempt storage since we start there.
            if(Memory.roomPlanReference[basePlanCM.get(x,y)] && ![99,98].includes(basePlanCM.get(x,y))) continue;

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
    },
    trimRamparts: function(ramparts,terrain,origins){
        let allRamparts = new Set();
        let goodRamparts = new Set();
        let queue = [];
        let visited = new Set();
        let testCM = new PathFinder.CostMatrix;
        
        //Origins is always an array, even when there's only one
        origins.forEach(origin => {
            let originKey = `${origin.x},${origin.y}`;
            visited.add(originKey); // Mark origins as visited
            queue.push(origin);
        });
        //Get a list of all ramparts for reference
        for(ramp of ramparts){
            let rampKey = `${ramp.x},${ramp.y}`;
            allRamparts.add(rampKey);
        }
        while (queue.length > 0) {
            let tile = queue.shift();

            let adjacentTiles = findAdjacentTiles(tile);
            adjacentTiles.forEach(({x, y}) => {
                //Don't go through walls
                if (terrain.get(x,y) != TERRAIN_MASK_WALL) {
                    //Check if it's a rampart. If so, add to the list of good ramparts but don't push to queue          
                    let rampKey = `${x},${y}`;
                    if(allRamparts.has(rampKey) && !goodRamparts.has(rampKey)){
                        goodRamparts.add(rampKey);
                    }
                    else{
                        queue.push({x:x,y:y})
                    }
                }
            });
        }

        function findAdjacentTiles(pos) {
            const directions = [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]];
            let tiles = [];
            for(let direction of directions) {
                let x = pos.x + direction[0];
                let y = pos.y + direction[1];
                let key = `${x},${y}`;
                if (visited.has(key)) { 
                    continue;
                }
                visited.add(key);
                if (x >= 0 && x < 50 && y >= 0 && y < 50) { //Check if within bounds
                    //Push the tile if not already visited
                    tiles.push({x: x, y: y});
                }
            };
            return tiles;
        }
        return Array.from(goodRamparts).map(key=>{
            // Split the key by the comma to separate the x and y values
            const [x, y] = key.split(',').map(Number); // Convert strings to numbers
            // Return an object for each key
            return { x, y };
        });
    },
    testFill: function(){
        let exits = [];
        let terrain = Game.map.getRoomTerrain('W55N11');
        for(i = 1;i<50;i++){
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
        let [controllerFound,sourceFound,structureFound] = fiefPlanner.generateScoreFloodFill(terrain,exits,PathFinder.CostMatrix.deserialize(Memory.testBasePlanCM))
    }
}

module.exports = fiefPlanner;
global.testGetFiefPlan = fiefPlanner.getFiefPlan;
global.testGenerateRoomPlan = fiefPlanner.generateRoomPlan.bind(fiefPlanner);
global.testRampartGroups = fiefPlanner.getRampartGroups;
global.testFill = fiefPlanner.testFill;