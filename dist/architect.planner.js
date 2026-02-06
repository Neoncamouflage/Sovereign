function invertScore(v){
    return 1-v;
}

const architectPlanner = {
    planWatershed: function(config,roomData,planData,watershedBlock){
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
        planData.region = scores[0].id;
        return planData;
    },
    planCore: function(config,roomData,planData,coreBlock){
        if (planData.isWatershed){

        }
        else{

        }
        return planData;
    },
    planStructureBlob: function(config,roomData,planData,blobBlock){

    },
    planRoads: function(config,roomData,planData,roadBlock,mineralRoads,remoteRoads){

    },
    planStructureAssignment: function(config,roomData,planData,assignBlock){

    },
    planMincut: function(config,roomData,planData,mincutBlock,customMincut,rampartController){

    }
}

module.exports = architectPlanner;