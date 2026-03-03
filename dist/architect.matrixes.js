const minCut = require('minCut');
const profiler = require('screeps-profiler');
const architectMatrixes = {
    getWatershed: function(distanceCM,distanceMax,terrain,exitCM,MIN_PEAK = 2,MERGE_RADIUS = 6,MIN_SIZE = 90,MAX_MERGE=25){
        //Lower min peak
        //console.log("Watershed running with min peak",MIN_PEAK,"Merge radius",MERGE_RADIUS,"Min size",MIN_SIZE)
        
        let seedQueue = getWatershedSeeds(distanceCM)
        seedQueue = mergeSeeds(seedQueue)
        let watershedCM = runWatershed(seedQueue,distanceCM,terrain,distanceMax,exitCM);
        //Merge up to 20 times
        for(let i = 0; i < MAX_MERGE; i++){
            let res = mergeSmallRegions(watershedCM, terrain);
            watershedCM = res.out;
            if(!res.merged){
                chronicle.log(`Watershed merged ${i} times.`,'architect.matrixes',4);
                break;
            }
        }
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
                    for(const direction of DIRECTIONS_4){
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
        function runWatershed(seeds, distanceTransform,terrain,maxDist,exitCM) {
            const BORDER = 255
            if (!seeds.length) return new PathFinder.CostMatrix();
            const regionCM = new PathFinder.CostMatrix();
            //for(let each of seeds){
                //console.log(JSON.stringify(each))
            //}
            // region ids start at 1
            for(let i = 0; i < seeds.length; i++) seeds[i].region = i + 1;

            // Bucketed priority queue: buckets[d] holds tiles with priority d
            const buckets = Array.from({ length: maxDist + 1 }, () => []);

            function pushIfCandidate(x, y, region,exitCM) {
                if (x <= 0 || x >= 49 || y <= 0 || y >= 49) return;
                const d = distanceTransform.get(x, y);
                if (d <= 0) return;
                if (terrain.get(x,y) === TERRAIN_MASK_WALL) return;
                if (regionCM.get(x, y) !== 0) return;          //Already labeled
                if (exitCM.get(x,y) == 1) return; //1 distance tiles from exit can't be built on and aren't included
                const pr = Math.min(d, maxDist);
                buckets[pr].push({ x, y, region });
            }

            // Seed initialization: label seeds and enqueue their neighbors
            for (const s of seeds) {
                regionCM.set(s.x, s.y, s.region);
                for (const [dx, dy] of DIRECTIONS_4) {
                    pushIfCandidate(s.x + dx, s.y + dy, s.region,exitCM);
                }
            }
            let safety = 0
            while (true){
                safety++;
                if(safety>3000){console.log("SAFETYBREAK-WATERSHED");break;}
                // Process from high to low distance
                for(let d = maxDist; d >= 1; d--) {
                    const bucket = buckets[d];
                    while (bucket.length) {
                        const tile = bucket.pop();

                        // might have been labeled since enqueue
                        if (regionCM.get(tile.x, tile.y) !== 0) continue;

                        // check already-labeled neighbors
                        let found = 0;
                        let conflict = false;

                        for (const [dx, dy] of DIRECTIONS_4) {
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
                        for (const [dx, dy] of DIRECTIONS_4) {
                            pushIfCandidate(tile.x + dx, tile.y + dy, assignRegion,exitCM);
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
            const BORDER = 255;

            // 1) Count region sizes
            const size = Object.create(null);

            for(let x = 1; x < 49; x++) {
                for(let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    const r = regionCM.get(x, y);
                    if (r === 0 || r === BORDER) continue;
                    size[r] = (size[r] || 0) + 1;
                }
            }

            // 2) Build adjacency THROUGH border tiles
            const adj = Object.create(null);

            for(let x = 1; x < 49; x++) {
                for(let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (regionCM.get(x, y) !== BORDER) continue;

                    const around = [];
                    const seen = new Set();

                    for (const [dx, dy] of DIRECTIONS_4) {
                        const r = regionCM.get(x + dx, y + dy);
                        if (r === 0 || r === BORDER) continue;
                        if (!seen.has(r)) { seen.add(r); around.push(r); }
                    }

                    for(let i = 0; i < around.length; i++) {
                        for(let j = i + 1; j < around.length; j++) {
                            const a = around[i], b = around[j];
                            if (!adj[a]) adj[a] = Object.create(null);
                            if (!adj[b]) adj[b] = Object.create(null);
                            adj[a][b] = (adj[a][b] || 0) + 1;
                            adj[b][a] = (adj[b][a] || 0) + 1;
                        }
                    }
                }
            }

            // 3) Decide merges
            const mergeTo = Object.create(null);
            let merged = false;

            for (const rStr of Object.keys(size)) {
                const r = Number(rStr);
                if (size[r] >= MIN_SIZE) continue;

                const neighbors = adj[r];
                if (!neighbors) continue;

                let best = null;
                let bestEdge = -1;
                let bestSize = -1;

                for (const nStr of Object.keys(neighbors)) {
                    const n = Number(nStr);
                    const edge = neighbors[n];
                    const nSize = size[n] || 0;

                    // enforce direction: only merge into a region that is >= in size
                    // tie-break on ID to keep deterministic and avoid mutual merges
                    const allowed =
                        (nSize > size[r]) ||
                        (nSize === size[r] && n < r);

                    if (!allowed) continue;

                    if (edge > bestEdge || (edge === bestEdge && nSize > bestSize)) {
                        best = n;
                        bestEdge = edge;
                        bestSize = nSize;
                    }
                }

                if (best != null) {
                    mergeTo[r] = best;
                    merged = true;
                }
            }

            // resolve chains (A->B->C => A->C) and avoid cycles defensively
            function resolve(id) {
                let cur = id;
                const seen = new Set([cur]);
                while (mergeTo[cur] != null) {
                    cur = mergeTo[cur];
                    if (seen.has(cur)) break; // cycle guard (shouldn't happen with rules above)
                    seen.add(cur);
                }
                return cur;
            }

            const out = new PathFinder.CostMatrix();
            for(let x = 0; x < 50; x++) {
                for(let y = 0; y < 50; y++) {
                    const v = regionCM.get(x, y);
                    // only resolve real region IDs
                    out.set(x, y, (v !== 0 && v !== BORDER) ? resolve(v) : v);
                }
            }

            return { out, merged };
        }


        function fillBorderTiles(regionCM, terrain) {
            const BORDER = 255;
            const out = new PathFinder.CostMatrix();

            // copy everything first
            for(let x = 0; x < 50; x++) {
                for(let y = 0; y < 50; y++) {
                    out.set(x, y, regionCM.get(x, y));
                }
            }

            for(let x = 1; x < 49; x++) {
                for(let y = 1; y < 49; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (regionCM.get(x, y) !== BORDER) continue;

                    const counts = Object.create(null);
                    let bestRegion = 0;
                    let bestCount = 0;

                    for (const [dx, dy] of DIRECTIONS_4) {
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
        let max = -Infinity;
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
                    if(value > max){
                        max = value;
                    }
                }
            }
        }
        return {distCM,max};
    },
    getDistanceMap: function(terrain,queue){
        let max = -Infinity;
        let distanceMap = new PathFinder.CostMatrix();
        let qi = 0;
        queue = queue.map(p => ({ x: p.x, y: p.y, distance: 0 }));
        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                distanceMap.set(x, y, 255);
            }
        }
        for(let each of queue){
            distanceMap.set(each.x,each.y,0)
        }
        while(qi < queue.length){
            let tile = queue[qi];
            qi++;
            for(let direction of DIRECTIONS_8){
                let newX = tile.x+direction[0];
                let newY = tile.y+direction[1];
                if(newX>49 || newX<0 || newY>49 || newY<0) continue;
                if(terrain.get(newX,newY) == TERRAIN_MASK_WALL) continue;
                let newTileValue = distanceMap.get(newX,newY);
                let newDistance = tile.distance+1;
                if(newTileValue != 255 && newDistance >= newTileValue) continue;
                distanceMap.set(newX,newY,newDistance);
                if(newDistance > max) max = newDistance;
                let newTile = {x:newX,y:newY,distance:newDistance};
                queue.push(newTile);
            }
        }
        return [distanceMap, max];
    },
    getWatershedData: function (watershedCM, roomData) {
        const regions = Object.create(null);
        const terrain = new Room.Terrain(roomData.roomName);

        const ensureRegion = (id) => {
            if (!regions[id]) {
                regions[id] = {
                    tiles: [],
                    sourceDistance: 0,
                    controllerDistance: 0,
                    exitDistance: 0,
                    borderSize: 0,
                    neighbors: new Set(),
                };
            }
            return regions[id];
        };

        for(let x = 0; x < 50; x++) {
            for(let y = 0; y < 50; y++) {
                const id = watershedCM.get(x, y);
                if (id === 0 || id === 255) continue;

                const r = ensureRegion(id);

                r.tiles.push({ x, y });
                r.sourceDistance += roomData.sourceCM.get(x, y);
                r.controllerDistance += roomData.controllerCM.get(x, y);
                r.exitDistance += roomData.exitCM.get(x, y);

                //Check borders and neighbors
                for (const [dx, dy] of DIRECTIONS_8) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx > 49 || ny < 0 || ny > 49) continue;
                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;

                    const nid = watershedCM.get(nx, ny);
                    if (nid === 0 || nid === 255 || nid === id) continue;

                    r.neighbors.add(String(nid));
                    ensureRegion(nid).neighbors.add(String(id));

                    r.borderSize++;
                    break;
                }
            }
        }

        // Finalize averages + convert neighbor Sets to arrays
        for (const regionID of Object.keys(regions)) {
            const region = regions[regionID];
            region.sourceDistance = Math.round(region.sourceDistance / region.tiles.length);
            region.controllerDistance = Math.round(region.controllerDistance / region.tiles.length);
            region.exitDistance = Math.round(region.exitDistance / region.tiles.length);

            region.neighbors = Array.from(region.neighbors);
        }

        return regions;
    }

}
module.exports = architectMatrixes;
profiler.registerObject(architectMatrixes, 'architect.matrixes');

global.testWT = function testWT(roomName,a=2,b=6,c=90,d=25){
    chronicle.log(`Attempting test watershed`,'architect.matrixes',4)
    let terrain = new Room.Terrain(roomName);
    let dt = architectMatrixes.getDistanceTransform(terrain)[0];
    let g = architectMatrixes.getWatershed(dt,terrain,a,b,c,d);
    if(g) Memory.test.testCM = g.serialize();
    chronicle.log(`Test Complete`,'architect.matrixes',4)
}
global.testDT = function testWT(roomName){
    chronicle.log(`Attempting test distanceCM`,'architect.matrixes',4)
    let terrain = new Room.Terrain(roomName);
    let dt = architectMatrixes.getDistanceTransform(terrain)[0];
    if(dt.distCM) Memory.test.testCM = dt.distCM.serialize();
    chronicle.log(`Test Complete`,'architect.matrixes',4)
}

global.testDM = function testDM(roomName){
    let terrain = new Room.Terrain(roomName)
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
    chronicle.log(`Attempting test distanceMap`,'architect.matrixes',4)
    let [map,max] = architectMatrixes.getDistanceMap(terrain,exits);
    console.log("MAX",max)
    if(map)Memory.test.testCM = map.serialize();
    else{console.log("NOMAP")}
    chronicle.log(`Test Complete`,'architect.matrixes',4)
}