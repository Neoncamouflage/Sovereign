// TODO
// Set up universal scoring system
// Ensure it uses the global normalizeWeights function
// 
const profiler = require('screeps-profiler');

function scoreBlock(){

}

const architectPlanner = {
    pickWatershedRegion: function(config,roomData,planData,watershedBlock){
        let [maxSize, maxController, maxSource, maxExit, maxBorder] = [0, 0, 0, 0, 0];
        let [minSize, minController, minSource, minExit, minBorder] = [Infinity, Infinity, Infinity, Infinity, Infinity];
        //Watershed genes
        //Region size, prefer larger watershed region
        const [GENE_REGIONSIZE, GENE_CONTROLLER, GENE_SOURCE, GENE_EXIT, GENE_BORDER] = normalizeWeights(watershedBlock);
        let watershedData = roomData.watershedData;
        let scores = []
        //minMaxNormalize()
        let regionIDs = Object.keys(watershedData);
        //Pick preferred region based on weighted selection
        for(let regionID of regionIDs){
            let region = watershedData[regionID];
            if(region.tiles.length > maxSize) maxSize = region.tiles.length;
            if(region.tiles.length < minSize) minSize = region.tiles.length;
            if(region.controllerDistance > maxController) maxController = region.controllerDistance;
            if(region.controllerDistance < minController) minController = region.controllerDistance;
            if(region.sourceDistance > maxSource) maxSource = region.sourceDistance;
            if(region.sourceDistance < minSource) minSource = region.sourceDistance;
            if(region.exitDistance > maxExit) maxExit = region.exitDistance;
            if(region.exitDistance < minExit) minExit = region.exitDistance;
            if(region.borderSize > maxBorder) maxBorder = region.borderSize;
            if(region.borderSize < minBorder) minBorder = region.borderSize;
            
        }
        //Normalize scores, inverting when smaller scores are better, and apply weights
        for(let regionID of regionIDs) {
            let scoredRegion = {id:regionID}
            let r = watershedData[regionID];
            scoredRegion.normSize = minMaxNormalize(r.tiles.length, maxSize, minSize);
            scoredRegion.normController = minMaxNormalize(
                r.controllerDistance,
                maxController,
                minController
            );

            scoredRegion.normSource = minMaxNormalize(
                r.sourceDistance,
                maxSource,
                minSource
            );

            scoredRegion.normExit = minMaxNormalize(
                r.exitDistance,
                maxExit,
                minExit
            );

            scoredRegion.normBorder = minMaxNormalize(
                r.borderSize,
                maxBorder,
                minBorder
            );
            scoredRegion.totalScore = 
                scoredRegion.normSize * GENE_REGIONSIZE
                + invertScore(scoredRegion.normController) * GENE_CONTROLLER
                + invertScore(scoredRegion.normSource) * GENE_SOURCE
                + scoredRegion.normExit * GENE_EXIT
                + invertScore(scoredRegion.normBorder) * GENE_BORDER
            scores.push(scoredRegion);
        }
        //Sort by score and select highest as our core location
        scores.sort((a,b) => b.totalScore-a.totalScore)
        return scores[0].id;
    },
    planCore: function(config,roomData,planData,coreBlock){
        /**
            [0.1,10.0],     //CORE - Exit range, prefer to stay away from exits
            [0.1,10.0],     //CORE - Controller range, prefer closeness to controller
            [0.1,10.0],     //CORE - Source range, prefer to minimize average range to sources
            [0.1,10.0],     //CORE - Distance transform, prefer distance from walls
         */
        const NORMALIZED_COREBLOCK = normalizeWeights(coreBlock);
        const matrixData = {
            distance:   { matrix: roomData.distanceCM,   min: Infinity,  max: -Infinity, geneIndex: 3, invert: false , defaultMax: roomData.distanceCMMax},
            source:     { matrix: roomData.sourceCM,     min: Infinity,  max: -Infinity, geneIndex: 2, invert: true , defaultMax: roomData.sourceCMMax  },
            exit:       { matrix: roomData.exitCM,       min: Infinity,  max: -Infinity, geneIndex: 0, invert: false , defaultMax: roomData.exitCMMax },
            controller: { matrix: roomData.controllerCM, min: Infinity,  max: -Infinity, geneIndex: 1, invert: true , defaultMax: roomData.controllerCMMax  },
        };
        let winningTile = {score:0}
        if (planData.isWatershed){
            let coreRegion = roomData.regionData[planData.region];
            //Loop over all tiles in the selected region to get the min/max for each CM
            for(let tile of coreRegion.tiles){
                for(let cmType of Object.keys(matrixData)){
                    let cmPick = matrixData[cmType];
                    let cmScore = cmPick.matrix.get(tile.x,tile.y);
                    if(cmScore > cmPick.max) cmPick.max = cmScore;
                    if(cmScore < cmPick.min) cmPick.min = cmScore;
                }
            }
            //Now that we have the min/max values, loop over them again to get the winning score and tile
            for(let tile of coreRegion.tiles){
                //Get scores for this tile
                let scores = {}
                for(let cmType of Object.keys(matrixData)){
                    let cmPick = matrixData[cmType];
                    let cmScore = cmPick.matrix.get(tile.x,tile.y);
                    scores[cmType] = minMaxNormalize(cmScore,cmPick.max,cmPick.min);
                    if(cmPick.invert) scores[cmType] = 1-scores[cmType];
                }
                //Total up the weighted scores
                let tileScore = 0;
                for(let scoreType of Object.keys(scores)){
                    tileScore += scores[scoreType] * NORMALIZED_COREBLOCK[matrixData[scoreType].geneIndex];
                }
                //Replace winner if larger
                if(tileScore > winningTile.score) winningTile = {tile:tile,score:tileScore}       
            }
            //Return the winner
            return {x:winningTile.tile.x,y:winningTile.tile.y}
        }

        //If not watershed, we calculate the score of each tile and return the winner normally
        for(let x=0;x<50;x++){
            for(let y=0;y<50;y++){
                //Skip if terrain wall
                if(roomData.terrain.get(x,y) == TERRAIN_MASK_WALL) continue;
                //Get scores for this tile
                let scores = {}
                for(let cmType of Object.keys(matrixData)){
                    let cmPick = matrixData[cmType];
                    let cmScore = cmPick.matrix.get(x,y);
                    //We normalize with 1 as the minimum because all distance CMs start at 1
                    scores[cmType] = minMaxNormalize(cmScore,cmPick.defaultMax,1);
                    if(cmPick.invert) scores[cmType] = 1-scores[cmType];
                }
                //Total up the weighted scores
                let tileScore = 0;
                for(let scoreType of Object.keys(scores)){
                    tileScore += scores[scoreType] * NORMALIZED_COREBLOCK[matrixData[scoreType].geneIndex];
                }
                //Replace winner if larger
                if(tileScore > winningTile.score) winningTile = {tile:{x:x,y:y},score:tileScore}   
            }
        }
        return {x:winningTile.tile.x,y:winningTile.tile.y} 
        
    },
    planStructureBlob: function(config,roomData,planData,blobBlock){
        /*        // ----Structure Blob Genes---- //
            [1.0,5.0],      //BLOB - Blob size, prefer larger tile counts
            [0,1.0],     //BLOB - Distance transform, prefer to expand the blob away from walls
            [0,1.0],     //BLOB - Exit range, prefer to expand the blob away from exits
            [0,1.0],     //BLOB - Source range, prefer to expand the blob towards sources
            [0,1.0],     //BLOB - Controller range, prefer to expand the blob towards the controller
        */
        const GENE_BLOBSIZE = blobBlock[0];
        //0 is undefined
        //Buildable is 1
        //Road is 2
        //Reserved is 3
        const BLOB_START = []
        const MIN_BLOB = 100 * GENE_BLOBSIZE; //Minimum buildable area for our blob, weighted by the size gene
        const NORMALIZED_BLOBBLOCK = normalizeWeights(blobBlock.slice(1, 5));
        const matrixData = {
            distance:   { matrix: roomData.distanceCM,   geneIndex: 0, invert: false, defaultMax: roomData.distanceCMMax },
            exit:       { matrix: roomData.exitCM,       geneIndex: 1, invert: false, defaultMax: roomData.exitCMMax },
            source:     { matrix: roomData.sourceCM,     geneIndex: 2, invert: true,  defaultMax: roomData.sourceCMMax },
            controller: { matrix: roomData.controllerCM, geneIndex: 3, invert: true,  defaultMax: roomData.controllerCMMax },
        };
        //Create the blobCM and a score CM, and set our core
        let blobCM = new PathFinder.CostMatrix();
        let scoreBigCM = new BigCostMatrix(); //We use a custom big costmatrix for this because scores might be large
        blobCM.set(planData.coreSpot.x,planData.coreSpot.y,1)
        //If we're watershed, we apply those initial tiles as the blob
        if(planData.isWatershed){
            const regionData = roomData.regionData[planData.region];
            for(let tile of regionData.tiles){
                blobCM.set(tile.x,tile.y,1);
            }
            //If that's enough tiles to meet our minimum, go ahead and exit
            if(regionData.tiles.length >= MIN_BLOB) return blobCM;
            //If not we add all tiles to the queue
            BLOB_START.push(...regionData.tiles)
        }
        //If not watershed, we just add the core to the start tiles
        else{BLOB_START.push(planData.coreSpot)}
        //Get a combined score matrix
        for(let x=0;x<50;x++){
            for(let y=0;y<50;y++){
                if(roomData.terrain.get(x,y) == TERRAIN_MASK_WALL) continue;
                //Get scores for this tile
                let scores = {};
                for(let cmType of Object.keys(matrixData)){
                    let cmPick = matrixData[cmType];
                    let cmScore = cmPick.matrix.get(x,y);
                    //We normalize with 1 as the minimum because all distance CMs start at 1
                    scores[cmType] = minMaxNormalize(cmScore,cmPick.defaultMax,1);
                    if(cmPick.invert) scores[cmType] = 1-scores[cmType];
                }
                //Total up the weighted scores
                let tileScore = 0;
                for(let scoreType of Object.keys(scores)){
                    tileScore += scores[scoreType] * NORMALIZED_BLOBBLOCK[matrixData[scoreType].geneIndex];
                }
                //Apply the final score to the CM
                scoreBigCM.set(x,y,tileScore)
            }
        }
        //Build a frontier array for all tiles we might expand to
        let frontier = [];
        let visited = new Set();
        for(let tile of BLOB_START){
            for(let each of DIRECTIONS_8){
                let newx = tile.x+each[0];
                let newy = tile.y+each[1];
                let key = newx*50 + newy;
                if(visited.has(key))continue;
                if (newx < 0 || newx > 49 || newy < 0 || newy > 49) continue;
                if (roomData.terrain.get(newx, newy) === TERRAIN_MASK_WALL) continue;
                visited.add(key);
                frontier.push({x:newx,y:newy,score:scoreBigCM.get(newx,newy)});
            }
        }

        let blobCount = BLOB_START.length;
        //Expand outward into the frontier based on tile score
        while (blobCount < MIN_BLOB && frontier.length){
            //Pick best frontier tile
            let bestIdx = 0;
            for(let i = 1; i < frontier.length; i++) {
                if (frontier[i].score > frontier[bestIdx].score) bestIdx = i;
            }
            const best = frontier.splice(bestIdx, 1)[0];
            const { x, y } = best;

            if (x < 0 || x > 49 || y < 0 || y > 49) continue;
            if (roomData.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

            //Ignore if we're already in the blob somehow
            const cur = blobCM.get(x, y);
            if (cur != 0) continue;

            //Add to blob
            blobCM.set(x, y, 1);
            blobCount++;

            for (const [dx, dy] of DIRECTIONS_8) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx > 49 || ny < 0 || ny > 49) continue;

                const nKey = nx*50 + ny;
                if (visited.has(nKey)) continue;
                if (roomData.terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                const nCur = blobCM.get(nx, ny);
                if (nCur === 1 || nCur === 2 || nCur === 3) continue;
                visited.add(nKey);
                frontier.push({ x: nx, y: ny, score: scoreBigCM.get(nx, ny) });
            }
        }

        return blobCM;
        
        

    },
    planRoads: function(config,roomData,planData,roadBlock,mineralRoads,remoteRoads){
        /**
                 // ----Road Expansion Genes---- //
            [0,1.0],     //ROAD - Road exploration, prefer roads that maximize new adjacent tiles
            [0,1.0],     //ROAD - Diagonal bias, prefer roads to expand diagonally
            [0,1.0],     //ROAD - Core range, prefer roads close to the core
            [0,1.0],     //ROAD - Exit range, prefer roads away from exits
         */
        const NORMALIZED_ROADBLOCK = normalizeWeights(roadBlock);
        const matrixData = {
            distance:   { matrix: roomData.distanceCM,   min: Infinity,  max: -Infinity, geneIndex: 3, invert: false , defaultMax: roomData.distanceCMMax},
            source:     { matrix: roomData.sourceCM,     min: Infinity,  max: -Infinity, geneIndex: 2, invert: true , defaultMax: roomData.sourceCMMax  },
            exit:       { matrix: roomData.exitCM,       min: Infinity,  max: -Infinity, geneIndex: 0, invert: false , defaultMax: roomData.exitCMMax },
            controller: { matrix: roomData.controllerCM, min: Infinity,  max: -Infinity, geneIndex: 1, invert: true , defaultMax: roomData.controllerCMMax  },
        };
        //Can hardcode this if we need to shave CPU but best not to assume
        const STRUCTURES_NEEDED = (() => {
            let totalStructs = 0;
            for(const struct of Object.keys(CONTROLLER_STRUCTURES)){
                if([STRUCTURE_ROAD,STRUCTURE_WALL,STRUCTURE_CONTAINER,STRUCTURE_RAMPART].includes(struct)) continue;
                totalStructs += CONTROLLER_STRUCTURES[struct][8];
            }
            return totalStructs;
        });
        let roadCM = new PathFinder.CostMatrix;
        let sourcePaths = {};
        let roadTiles = [];
        //Wrap the core location in roads.
        for(let x=-1;x<=1;x++){
            for(let y=-1;y<=1;y++){
                if(x==0 && y==0)continue;
                let newX = planData.coreSpot.x + x;
                let newY = planData.coreSpot.y + y;
                if(roomData.terrain.get(newX,newY) == TERRAIN_MASK_WALL) continue;
                addRoad(newX,newY);
            }
        }
        roadCM.set(planData.coreSpot.x,planData.coreSpot.y,255);
        //Route roads to the source(s) and controller
        let corePos = new RoomPosition(planData.coreSpot.x,planData.coreSpot.y,roomData.roomName);
        let targets = [...roomData.sources,roomData.controller]
        for(const source of targets){
            let res = PathFinder.search(corePos,{pos:new RoomPosition(source.x,source.y,roomData.roomName),range:1},{
                plainCost:2,
                swampCost:2,
                roomCallback:function() {
                    return roadCM;
                    }
            });
            for(const spot of res.path){
                addRoad(spot.x,spot.y);
            }
            //If it has an ID it's a controller, so we add it to the source paths
            if(source.id){
                sourcePaths[source.id] = res.path;
            }
        }
        //Route road to mineral and remote sources

        //Count available structure tiles and expand

        function addRoad(x,y){
            //Only add unset roads, no duplicates
            if(roadCM.get(x,y) == 0){
                roadCM.set(x,y,1);
                roadTiles.push({x,y});
            }
        }
    },
    planStructureAssignment: function(config,roomData,planData,assignBlock){

    },
    planMincut: function(config,roomData,planData,mincutBlock,customMincut,rampartController){

    }
}

module.exports = architectPlanner;
profiler.registerObject(architectPlanner, 'architect.planner');