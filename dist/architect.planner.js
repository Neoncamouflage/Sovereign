function invertScore(v){
    return 1-v;
}

const architectPlanner = {
    pickWatershedRegion: function(config,roomData,planData,watershedBlock){
        let [maxSize, maxController, maxSource, maxExit, maxBorder] = [0, 0, 0, 0, 0];
        let [minSize, minController, minSource, minExit, minBorder] = [Infinity, Infinity, Infinity, Infinity, Infinity];
        //Watershed genes
        //Region size, prefer larger watershed region
        const GENE_REGIONSIZE = watershedBlock[0];
        //Controller range, prefer the controller be in or near the region
        const GENE_CONTROLLER = watershedBlock[1];
        //Source range, prefer sources be in or near the region
        const GENE_SOURCE = watershedBlock[2];
        //Exit range, prefer regions away from exits
        const GENE_EXIT = watershedBlock[3];
        //Border size, prefer regions with smaller borders
        const GENE_BORDER = watershedBlock[4];
        let watershedData = roomData.watershedData;
        let watershedCM = roomData.watershedCM;
        let chosenRegion;
        let scores = []
        //minMaxNormalize()
        //Pick preferred region based on weighted selection
        for(let regionID of watershedData){
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
        for (let regionID of Object.keys(watershedData)) {
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
                r.normSize * GENE_REGIONSIZE
                + r.normController * GENE_CONTROLLER
                + r.normSource * GENE_SOURCE
                + r.normExit * GENE_EXIT
                + invertScore(r.normBorder) * GENE_BORDER
            scores.push(scoredRegion);
        }
        //Sort by score and select highest as our core location
        scores.sort((a,b) => b-a)
        return scores[0].id;
    },
    planCore: function(config,roomData,planData,coreBlock){
        /**
            [0.1,10.0],     //CORE - Exit range, prefer to stay away from exits
            [0.1,10.0],     //CORE - Controller range, prefer closeness to controller
            [0.1,10.0],     //CORE - Source range, prefer to minimize average range to sources
            [0.1,10.0],     //CORE - Distance transform, prefer distance from walls
         */
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
                    tileScore += scores[scoreType] * coreBlock[matrixData[scoreType].geneIndex];
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
                    tileScore += scores[scoreType] * coreBlock[matrixData[scoreType].geneIndex];
                }
                //Replace winner if larger
                if(tileScore > winningTile.score) winningTile = {tile:tile,score:tileScore}   
            }
        }
        return {x:winningTile.tile.x,y:winningTile.tile.y} 
        
    },
    planStructureBlob: function(config,roomData,planData,blobBlock){
        /*        // ----Structure Blob Genes---- //
            [1.0,5.0],      //BLOB - Blob size, prefer larger tile counts
            [0.1,10.0],     //BLOB - Distance transform, prefer to expand the blob away from walls
            [0.1,10.0],     //BLOB - Exit range, prefer to expand the blob away from exits
            [0.1,10.0],     //BLOB - Source range, prefer to expand the blob towards sources
            [0.1,10.0],     //BLOB - Controller range, prefer to expand the blob towards the controller
        */
        const [GENE_BLOBSIZE,GENE_DISTANCE,GENE_EXIT,GENE_SOURCE] = blobBlock;
        //0 is undefined
        //Buildable is 1
        //Road is 2
        //Reserved is 3
        const BLOB_START = []
        const MIN_BLOB = 100 * GENE_BLOBSIZE; //Minimum buildable area for our blob, weighted by the size gene
        const matrixData = {
            distance:   { matrix: roomData.distanceCM,   min: Infinity,  max: -Infinity, geneIndex: 1, invert: false , defaultMax: roomData.distanceCMMax},
            source:     { matrix: roomData.sourceCM,     min: Infinity,  max: -Infinity, geneIndex: 3, invert: true , defaultMax: roomData.sourceCMMax  },
            exit:       { matrix: roomData.exitCM,       min: Infinity,  max: -Infinity, geneIndex: 2, invert: false , defaultMax: roomData.exitCMMax },
            controller: { matrix: roomData.controllerCM, min: Infinity,  max: -Infinity, geneIndex: 4, invert: true , defaultMax: roomData.controllerCMMax  },
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
                    tileScore += scores[scoreType] * coreBlock[matrixData[scoreType].geneIndex];
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
                let key = `${newx},${newy}`;
                if(visited.has(key))continue;
                visited.add(key);
                frontier.push({x:newx,y:newy,score:scoreBigCM.get(newx,newy)});
            }
        }

        let blobCount = BLOB_START.length;
        //Expand outward into the frontier based on tile score
        while (blobCount < MIN_BLOB && frontier.length){
            //Pick best frontier tile
            let bestIdx = 0;
            for (let i = 1; i < frontier.length; i++) {
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

                const nKey = `${nx},${ny}`;
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
        
    },
    planStructureAssignment: function(config,roomData,planData,assignBlock){

    },
    planMincut: function(config,roomData,planData,mincutBlock,customMincut,rampartController){

    }
}

module.exports = architectPlanner;