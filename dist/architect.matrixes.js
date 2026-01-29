const minCut = require('minCut');
const profiler = require('screeps-profiler');

const architectMatrixes = {
    getWatershed: function(distanceTransformObj,terrain,MIN_PEAK = 5,MERGE_RADIUS = 3,MIN_SIZE = 30){
        const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let seedQueue = getWatershedSeeds(distanceTransformObj.distCM)
        seedQueue = mergeSeeds(seedQueue)
        let watershedCM = runWatershed(seedQueue,distanceTransformObj.distCM,terrain,distanceTransformObj.distHighest);
        for (let i = 0; i < 5; i++) watershedCM = mergeSmallRegions(watershedCM, terrain);
        watershedCM = fillBorderTiles(watershedCM, terrain);
        return watershedCM;

        function getWatershedSeeds(distanceTransform){
            let seeds = []
            for(let x=1;x<49;x++){
                yLoop:
                for(let y=1;y<49;y++){
                    if (terrain.get(x,y) === TERRAIN_MASK_WALL) continue;
                    let tileValue = distanceTransform.get(x,y);
                    if(tileValue < MIN_PEAK) continue;

                    //Check all directions and skip to next y loop if not the largest
                    for(const direction of DIRECTIONS){
                        let neighborX = x + direction[0];
                        let neighborY = y + direction[1];
                        if(distanceTransform.get(neighborX,neighborY)>tileValue){
                            continue yLoop;
                        }
                    }
                    seeds.push({x:x,y:y,d:tileValue})
                }
            }
            seeds.sort((a, b) => b.d - a.d);
            return seeds;
        }

        function mergeSeeds(seeds){
            let finalQueue = [];
            const r2 = MERGE_RADIUS*MERGE_RADIUS

            for (const s of seeds) {
                let tooClose = false;
                for (const k of finalQueue) {
                    const dx = s.x - k.x;
                    const dy = s.y - k.y;
                    if (dx*dx + dy*dy <= r2) { tooClose = true; break; }
                }
                if (!tooClose) finalQueue.push(s);
            }
            return finalQueue;
        }

        //TODO - If regions are encountered and one is below X tiles, consume it
        function runWatershed(seeds, distanceTransform,terrain,maxDist) {
            const BORDER = 255
            if (!seeds.length) return new PathFinder.CostMatrix();
            const regionCM = new PathFinder.CostMatrix();
            for(let each of seeds){
                console.log(JSON.stringify(each))
            }
            // region ids start at 1
            for (let i = 0; i < seeds.length; i++) seeds[i].region = i + 1;

            // Bucketed priority queue: buckets[d] holds tiles with priority d
            const buckets = Array.from({ length: maxDist + 1 }, () => []);

            function pushIfCandidate(x, y, region) {
                if (x <= 0 || x >= 49 || y <= 0 || y >= 49) return;
                const d = distanceTransform.get(x, y);
                if (d <= 0) return;
                if (terrain.get(x,y) === TERRAIN_MASK_WALL) return;              // skip walls
                if (regionCM.get(x, y) !== 0) return;          // already labeled (or boundary)
                const pr = Math.min(d, maxDist);
                buckets[pr].push({ x, y, region });
            }

            // Seed initialization: label seeds and enqueue their neighbors
            for (const s of seeds) {
                regionCM.set(s.x, s.y, s.region);
                for (const [dx, dy] of DIRECTIONS) {
                    pushIfCandidate(s.x + dx, s.y + dy, s.region);
                }
            }
            let safety = 0
            while (true){
                safety++;
                if(safety>3000){console.log("SAFETYBREAK-WATERSHED");break;}
                // Process from high to low distance
                for (let d = maxDist; d >= 1; d--) {
                    const bucket = buckets[d];
                    while (bucket.length) {
                        const tile = bucket.pop();

                        // might have been labeled since enqueue
                        if (regionCM.get(tile.x, tile.y) !== 0) continue;

                        // check already-labeled neighbors
                        let found = 0;
                        let conflict = false;

                        for (const [dx, dy] of DIRECTIONS) {
                            const v = regionCM.get(tile.x + dx, tile.y + dy);
                            if (v === 0 || v === BORDER) continue;

                            if (found === 0) found = v;
                            else if (v !== found) { conflict = true; break; }
                        }

                        if (conflict) {
                            regionCM.set(tile.x, tile.y, BORDER);
                            continue;
                        }

                        const assignRegion = found || tile.region;
                        regionCM.set(tile.x, tile.y, assignRegion);

                        // expand frontier
                        for (const [dx, dy] of DIRECTIONS) {
                            pushIfCandidate(tile.x + dx, tile.y + dy, assignRegion);
                        }
                    }
                }
                let bucketTotal = 0
                for(let b of Object.values(buckets)){
                    bucketTotal += b.length;
                }
                if(bucketTotal == 0)break;
            }
            return regionCM;
        }

        function mergeSmallRegions(regionCM, terrain) {
            const BORDER = 255
            // 1) Count region sizes
            const size = Object.create(null);

            for (let x = 1; x < 49; x++) {
                for (let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    const r = regionCM.get(x, y);
                    if (r === 0 || r === BORDER) continue;
                    size[r] = (size[r] || 0) + 1;
                }
            }

            // 2) Build adjacency THROUGH border tiles (BORDER separates regions)
            const adj = Object.create(null);

            for (let x = 1; x < 49; x++) {
                for (let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (regionCM.get(x, y) !== BORDER) continue;

                    // distinct region ids touching this border tile
                    const around = [];
                    const seen = new Set();

                    for (const [dx, dy] of DIRECTIONS) {
                        const r = regionCM.get(x + dx, y + dy);
                        if (r === 0 || r === BORDER) continue;
                        if (!seen.has(r)) { seen.add(r); around.push(r); }
                    }

                    // every pair of regions meeting at this border contributes adjacency
                    for (let i = 0; i < around.length; i++) {
                        for (let j = i + 1; j < around.length; j++) {
                            const a = around[i], b = around[j];
                            if (!adj[a]) adj[a] = Object.create(null);
                            if (!adj[b]) adj[b] = Object.create(null);
                            adj[a][b] = (adj[a][b] || 0) + 1;
                            adj[b][a] = (adj[b][a] || 0) + 1;
                        }
                    }
                }
            }

            // 3) Decide merges: small region -> neighbor with strongest contact (tie: larger)
            const mergeTo = Object.create(null);

            for (const rStr of Object.keys(size)) {
                const r = Number(rStr);
                if (size[r] >= MIN_SIZE) continue;

                const neighbors = adj[r];
                if (!neighbors) continue; // no known neighbor via borders

                let best = null;
                let bestEdge = -1;
                let bestSize = -1;

                for (const nStr of Object.keys(neighbors)) {
                    const n = Number(nStr);
                    const edge = neighbors[n];
                    const nSize = size[n] || 0;

                    if (edge > bestEdge || (edge === bestEdge && nSize > bestSize)) {
                        best = n;
                        bestEdge = edge;
                        bestSize = nSize;
                    }
                }

                if (best != null) mergeTo[r] = best;
            }

            // 4) Apply merges (single scan)
            const out = new PathFinder.CostMatrix();

            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    const v = regionCM.get(x, y);
                    const m = mergeTo[v];
                    out.set(x, y, m ? m : v);
                }
            }

            return out;
        }

        function fillBorderTiles(regionCM, terrain) {
            const BORDER = 255;
            const out = new PathFinder.CostMatrix();

            // copy everything first
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    out.set(x, y, regionCM.get(x, y));
                }
            }

            for (let x = 1; x < 49; x++) {
                for (let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (regionCM.get(x, y) !== BORDER) continue;

                    const counts = Object.create(null);
                    let bestRegion = 0;
                    let bestCount = 0;

                    for (const [dx, dy] of DIRECTIONS) {
                        const v = regionCM.get(x + dx, y + dy);
                        if (v === 0 || v === BORDER) continue;
                        const c = (counts[v] = (counts[v] || 0) + 1);
                        if (c > bestCount) { bestCount = c; bestRegion = v; }
                    }

                    if (bestRegion !== 0) out.set(x, y, bestRegion);
                    // else leave it as BORDER (or set to 0 if you prefer)
                }
            }

            return out;
        }
        
    },
    getDistanceTransform: function(terrain){
        //Create the distance transform cost matrix and set default values for highest/lowest
        let distCM = new PathFinder.CostMatrix;
        let distHighest = 0;
        let distLowest = 999
        let top;
        let left;
        let bottom;
        let right;
        let value;
        //Loop through every x,y coordinate and mark all floor tiles with an initial high distance of 255 unless it's a terrain wall
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                const tile = terrain.get(x, y);
                if(tile != TERRAIN_MASK_WALL){
                    distCM.set(x, y, 255);
                }
            }
        }
        //First we do a pass from top left to bottom right in the room
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
        for (x = 49; x >= 0; x -= 1) {
            for (y = 49; y >= 0; y -= 1) {
                bottom = distCM.get(x, y + 1);
                right = distCM.get(x + 1, y);
                value = Math.min(Math.min(bottom, right) + 1, distCM.get(x, y));
                distCM.set(x, y,value);
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
        return {distCM,distHighest,distLowest};
    }
}
module.exports = architectMatrixes;
global.testWT = function testWT(roomName,a=3,b=3,c=30){
    chronicle.log(`Attempting test watershed`,'architect.matrixes',4)
    let terrain = new Room.Terrain(roomName);
    let dt = architectMatrixes.getDistanceTransform(terrain);
    let g = architectMatrixes.getWatershed(dt,terrain,a,b,c);
    if(g) Memory.test.testCM = g.serialize();
    chronicle.log(`Test Complete`,'architect.matrixes',4)
}
global.testDT = function testWT(roomName){
    chronicle.log(`Attempting test distanceCM`,'architect.matrixes',4)
    let terrain = new Room.Terrain(roomName);
    let dt = architectMatrixes.getDistanceTransform(terrain);
    if(dt.distCM) Memory.test.testCM = dt.distCM.serialize();
    chronicle.log(`Test Complete`,'architect.matrixes',4)
}