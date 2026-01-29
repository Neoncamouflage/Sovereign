if(!Memory.visuals) Memory.visuals = {};
const profiler = require('screeps-profiler');
const architect = require('architect')
const painter = {
    //Paints visuals based on flags set in memory
    run: function(kingdomCreeps){
        let visuals = Memory.visuals;
        let fiefs = Memory.kingdom.fiefs;
        let holdings = Memory.kingdom.holdings;
        if(!visuals) Memory.visuals = {}
        //Color has to be the first one, as it caches the roomvisual data
        if(visuals.drawColor) this.drawColor();
        //Loop through fiefs and holdings since some visuals are specific to those
        if(visuals.drawFiefCM || visuals.drawFiefPlan){
            for(let fief in fiefs){
                if(visuals.drawFiefCM) this.drawFiefCM(fief)
                if(visuals.drawFiefPlan) this.drawFiefPlan(fief)
            }
        }
        if(visuals.drawLoot) this.drawLoot();
        if(visuals.drawMilitary) this.drawMilitary(kingdomCreeps);
        if(visuals.drawIntel) this.drawIntel(kingdomCreeps);
        if(visuals.drawTest) this.drawTest();
        if(visuals.drawRoomPlan) this.drawRoomPlan(visuals.drawRoomPlan);
        if(visuals.drawScores) this.drawScores(architect.config);
        if(visuals.drawAllies) this.drawAllies();
        if(visuals.drawStartup) this.drawStartup();
        
    },
    setVisual: function(vis,setting='default'){
        //Do we have this visual
        if(Memory.visuals[vis]){
            //If so, set it to the setting or flip it if one wasn't provided
            Memory.visuals[vis] = typeof setting == 'boolean' ? setting : !Memory.visuals[vis];
        }
        //Else create it
        else{
            //Default to true if no setting given
            Memory.visuals[vis] = typeof setting == 'boolean' ? setting : true;
        }
    },
    //Debugging visuals for colony startup
    drawStartup(){
        let roomVis =  new RoomVisual();
        let fiefs = Object.keys(Memory.kingdom.fiefs)
        if(!fiefs.length)return;
        let fief = Memory.kingdom.fiefs[fiefs[0]];
        let room = Game.rooms[fiefs[0]];
        let stats = [];

        stats.push(`Scouting list: ${JSON.stringify(heap.scoutList)}`);
        let count = 0;
        for(let each of stats){
            roomVis.text(each,35,25+count, {color:'#ffa500',font:'1 Bridgnorth'});
            count++;
        }


    },
    drawAllies(){
        let reports = []
        let roomVis =  new RoomVisual();
        for(let ally of Object.keys(heap.simpleAllies)){
            let allyReport = [ally];
            let data = heap.simpleAllies[ally];
            let rooms = {}
            //console.log(ally,JSON.stringify(data))
            if(!data.requests)continue;
            for(let reqType of Object.keys(data.requests)){
                let reqData = data.requests[reqType]
                for(let each of reqData){
                    if(reqType == 'resource'){
                        rooms[each.roomName] = rooms[each.roomName] || {};
                        let thisReq = rooms[each.roomName];
                        thisReq.resources = thisReq.resources || {};
                        thisReq.resources[each.resourceType] = {amount:each.amount,priority:each.priority }
                    }
                    else if(reqType == 'funnel'){
                        continue;
                        rooms[each.roomName] = rooms[each.roomName] || {};
                        let thisReq = rooms[each.roomName];
                        thisReq.funnel = thisReq.funnel || {};
                        thisReq.funnel = {amount:each.maxAmount}
                    }

                }
            }
            for(let room of Object.keys(rooms)){
                allyReport.push(room)
                if(!rooms[room].resources)continue;
                for(let each of Object.keys(rooms[room].resources)){
                    let info = rooms[room].resources[each];
                    let pri = '';
                    if(info.priority < 0.25) pri = '🟢'
                    else if(info.priority < 0.5) pri = '🟡'
                    else if(info.priority < 0.75) pri = '🟠'
                    else if(info.priority < 1) pri = '🔴'
                    allyReport.push(`${each} : ${info.amount} ${pri}`)
                }
            }
            reports.push(allyReport)
        }
        let lineCount = 0
        //console.log(JSON.stringify(reports))
        for(let report of reports){
            for(let line of report){
                roomVis.text(line,25,25+lineCount, {color:'#ffa500',font:'1 Bridgnorth'});
                lineCount++;
            }
        }

    },
    drawRoomPlan: function(roomName){
        let plans = JSON.parse(RawMemory.segments[1]);
        let heapPlan = heap.roomPlans && heap.roomPlans[roomName]
        let plan
        let ramps
        if(heap.fiefPlanner && heap.fiefPlanner.roomName == roomName && heap.fiefPlann.stage != 0){
            heapPlan
        }
        if(heapPlan){
            [plan, ramps] = heapPlan;
        }
        //let ramps = Memory.kingdom.fiefs[roomName].rampartPlan;
        if(!heapPlan && !plans[roomName]){
            new RoomVisual(roomName).text("NO FIEF PLAN",25,25, {color:'#ffa500',font:'3 Bridgnorth'});
            return;
        }
        else{
            [plan,ramps] = plans[roomName];
        }
        let roomVis =  new RoomVisual(roomName);
        let holdingArray = []
        for(let [rcl,buildings] of Object.entries(plan)){
            for(let [building,spots] of Object.entries(buildings)){
                for(let spot of spots){
                    //Store buildings in an array to draw after roads
                    if(building == STRUCTURE_ROAD){
                        roomVis.structure(spot.x,spot.y,building);
                    }
                    holdingArray.push([spot.x,spot.y,building,rcl]);
                    
                }
            }
        }
        roomVis.connectRoads()
        for(let ele of holdingArray){
            if(ele[2] != STRUCTURE_ROAD) roomVis.structure(ele[0],ele[1],ele[2]);
            roomVis.text(ele[3],ele[0],ele[1], {color:'#ffa500',font:'0.5 Bridgnorth'});
        }
        for(let ramp of ramps){
            roomVis.circle(ramp.x,ramp.y,{fill:'green',radius:0.5});
        }
    },
    drawFiefPlan: function(fief){
        let plan = Memory.kingdom.fiefs[fief].roomPlan;
        let ramps = Memory.kingdom.fiefs[fief].rampartPlan;
        if(!plan || !ramps){
            new RoomVisual(fief).text("NO FIEF PLAN",25,25, {color:'#ffa500',font:'3 Bridgnorth'});
            return;
        }
        let roomVis =  new RoomVisual(fief);
        let holdingArray = []
        for(let [rcl,buildings] of Object.entries(plan)){
            for(let [building,spots] of Object.entries(buildings)){
                for(let spot of spots){
                    //Store buildings in an array to draw after roads
                    if(building == STRUCTURE_ROAD){
                        roomVis.structure(spot.x,spot.y,building);
                    }
                    holdingArray.push([spot.x,spot.y,building,rcl]);
                    
                }
            }
        }
        roomVis.connectRoads()
        for(let ele of holdingArray){
            if(ele[2] != STRUCTURE_ROAD) roomVis.structure(ele[0],ele[1],ele[2]);
            roomVis.text(ele[3],ele[0],ele[1], {color:'#ffa500',font:'0.5 Bridgnorth'});
        }
        for(let ramp of Memory.kingdom.fiefs[fief].rampartPlan){
            roomVis.circle(ramp.x,ramp.y,{fill:'green',radius:0.5});
        }
    },
    drawScores: function(config){
        if(!config){
            //chronicle.log(`No config available in the architect.`,'painter',4)
            return;
        }
        let plan;
        let scores
        if(!config.running){
            if(!config.bestPlan) return;
            [plan,scores] = config.best;
        }
        else if(config.currentPlans.length){
            let planData = config.currentPlans[config.currentPlans.length-1];
            plan = planData[3];
            scores = planData[2];
        }
        else{
            return;
        }
        let roomVis = new RoomVisual(config.roomName);
        
        
        if(!plan || ! scores) return;
        //chronicle.log(`Plan found. ${Object.keys(plan)}.`,'painter',4)
        for(let key of Object.keys(plan.roads)){
            let rds = plan.roads[key];
            if(key=='sources'){
                for(let source of plan.roads[key]){
                    for(let spot of source){
                        roomVis.structure(spot.x,spot.y,STRUCTURE_ROAD);
                    }
                }
            }
            else{
                for(let spot of rds){
                    roomVis.structure(spot.x,spot.y,STRUCTURE_ROAD);
                }
            }
        }
        roomVis.connectRoads()
        for(let key of Object.keys(plan)){
            if(Object.keys(CONTROLLER_STRUCTURES).includes(key)){
                if(key == STRUCTURE_STORAGE) roomVis.structure(plan[key].x,plan[key].y,key);
                else{
                    for(let spot of plan[key]){
                        roomVis.structure(spot.x,spot.y,key);
                    }
                }

            }
        }
        for(let ramp of plan.ramparts){
            roomVis.circle(ramp.x,ramp.y,{fill:'green',radius:0.5});
        }
        //chronicle.log(`Plan data: ${JSON.stringify(plan)}`,'painter',4)
        let scoreText = ['Plan Scores:'];
        for(let type of Object.keys(scores)){
            let score = scores[type];
            scoreText.push(`${type}: ${score}`);
        }
        let count = 0;
        for(let line of scoreText){
            roomVis.text(line,48,13+count,{color: 'white', fontSize: 10,align:'right'});
            count++
        }
        

    },
    drawFiefCM: function(fief){
        let matrix = Memory.kingdom.fiefs.costMatrix
        if(!matrix) return;
        let fiefCM = PathFinder.CostMatrix.deserialize(matrix);
        for (let x = 0; x <= 49; x += 1) {
            for (let y = 0; y <= 49; y += 1) {
                let weight = fiefCM.get(x,y);
                if(weight == 0) continue;
                new RoomVisual().text(weight,x,y+0.25);
            }
        }
        return;
    },
    drawIntel(kingdomCreeps){
        let scoutData = global.heap.scoutData;
        if(!scoutData) return;
        Object.entries(scoutData).forEach(([roomName,data])=>{
            //Scout data/fief markings
            if(Memory.kingdom.fiefs[roomName]){
                Game.map.visual.text("🏰", new RoomPosition(49,6,roomName), {color: '#FFFFF', fontSize: 6,align:'right'});
            }
            if(Game.time-data.l == 0){
                Game.map.visual.text("👁", new RoomPosition(0,6,roomName), {color: '#ffffff ', fontSize: 6, fontFamily: 'Bridgnorth',align:'left'});
            }
            else{
                Game.map.visual.text("👁"+(Game.time-data.l), new RoomPosition(0,6,roomName), {color: '#ffa500 ', fontSize: 6, fontFamily: 'Bridgnorth',align:'left'});
            }
        });
        let activeHoldings = new Set(heap.kingdomStatus.activeHoldings)
        let holdingCount = 1;
        if(heap.sortedHoldings && heap.sortedHoldings.length){
            for(let holdingName of heap.sortedHoldings){
                let holding = Memory.kingdom.holdings[holdingName]
                if(holding && holding.sources){
                    for(source of Object.values(holding.sources)){
                        if(source.path){
                            Game.map.visual.poly(source.path)
                            Game.map.visual.text(source.path.length, new RoomPosition(source.path[source.path.length-1].x,source.path[source.path.length-1].y,holdingName), {color: '#FFFFFF', fontSize: 6});
                        }
                    }
                    Game.map.visual.text(`${holdingCount}${activeHoldings.has(holdingName) ? "🌾" : ""}`, new RoomPosition(49,6,holdingName), {color: '#FFFFF', fontSize: 6,align:'right'});
                }
                holdingCount++;
            }
        }

        //Draw military/scout creeps and missions
        let scouts = kingdomCreeps.scouts || [];
        let missions = Object.keys(heap.missions) || [];
        if(scouts.length){
            for(let scout of scouts){
                Game.map.visual.text("🕵️‍♂️", scout.pos, {color: '#FFFFF', fontSize: 6});
            }
        }
        if(missions.length){
            for(let missionID of missions){
                let mission = heap.missions[missionID];
                Game.map.visual.text(`⚠ ${mission.type}`, new RoomPosition(25,25,mission.room), {color: '#edbe2f', fontSize: 6});
            }
        }
    },
    drawLoot(){
        for(let room of Object.values(Game.rooms)){
            if(!room.memory.loot) continue;
            let loot = room.memory.loot;
            //console.log("LOOT"+JSON.stringify(room.memory.loot))
            let corePos = {x:room.controller.pos.x,y:room.controller.pos.y}
            new RoomVisual(room.name).text(`¤${(loot.totalCredit/1000).toFixed(2)}`,corePos.x,corePos.y-1, {color:'#5AF414',font:'1 Comic Sans MS'});
            
            for(let [structID,resources] of Object.entries(loot.structures)){
                //console.log(structID,resources)
                let building = Game.getObjectById(structID);
                let total = 0;
                for(let [resType,details] of Object.entries(resources)){
                    //console.log(resType,details.amount)
                    total += Number(details.credits)
                }
                if(total !=0) new RoomVisual(room.name).text('¤'+(total/1000).toFixed(0),building.pos.x,building.pos.y-1.2, {color:'#5AF414',font:'0.5 Comic Sans MS'});
            }
        }
    },
    drawColor(){
        if(!heap.colorGroups) heap.colorGroups = {};
        let colorRooms = [
            ...Object.keys(Memory.kingdom.fiefs),
        ];
        for(let roomName of colorRooms){
            let perimeters = {};
            let rVis = new RoomVisual(roomName);
            if(!heap.colorGroups[roomName]){
                let groups = getWallGroups(roomName);
                for(let id of Object.keys(groups)){
                    let group = groups[id]
                    perimeters[id] = findPerimeterTiles(group)
                }
                //Perimeter tiles
                /*for(let groupID of Object.keys(groups)){
                    let group = groups[groupID]
                    for(let spot of group){
                        if(edgeDone.has(`${spot.x},${spot.y}`))continue;
                        rVis.circle(spot.x,spot.y,{fill:'black'});
                    };
                };*/

                heap.colorGroups[roomName] = perimeters;
            }
            else{
                perimeters = heap.colorGroups[roomName];
            }
            let perimeterTiles = Object.keys(perimeters);
            let totalGroups = perimeterTiles.length;
            for(let perID of perimeterTiles){
                let groupTiles = perimeters[perID]
                let hue = (360 / totalGroups) * perimeterTiles.indexOf(perID);
                for(let spot of groupTiles){
                    rVis.circle(spot.x,spot.y,{fill: `hsl(${hue}, 100%, 50%)`});
                }
            }
        }
        function findPerimeterTiles(wallGroup){
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
        }
        function getWallGroups(roomName){
            let terrain = Game.map.getRoomTerrain(roomName);
            const processed = Array(50).fill().map(() => Array(50).fill(false));
            const wallGroups = {};
            let currentGroupId = 0;
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    if (!processed[x][y] && terrain.get(x, y) === TERRAIN_MASK_WALL) {
                        wallGroups[currentGroupId] = [];
                        floodFill(x, y);
                        currentGroupId++;
                    }
                }
            }

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
            return wallGroups
        }
        
    },
    drawTest(){
        if(Memory.test.testCM){
            let testCM = PathFinder.CostMatrix.deserialize(Memory.test.testCM)
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = testCM.get(x,y);
                    //if(weight == 0) continue;
                    new RoomVisual().text(weight,x,y+0.25);
                }
            }
        }
        if(Memory.test.testBigCM){
            let testCM = BigCostMatrix.deserialize(Memory.test.testBigCM)
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = testCM.get(x,y);
                    //if(weight == 0) continue;
                    new RoomVisual().text(weight,x,y+0.25,{font:'0.3'});
                }
            }
        }
    },
    drawMilitary(kingdomCreeps){
        let reserve = global.heap.army.reserve;
        //Label Troupe mission targets
        for(let troupe of global.heap.army.troupes){
            if(troupe.mission && troupe.mission.targets){
                //console.log("Painting targets",JSON.stringify(troupe.mission.targets))
                if(troupe.mission.type == 'skMining'){
                    let liveTargets = [];
                    for(let target of troupe.mission.targets){
                        let targetObj = Game.getObjectById(target);
                        if(targetObj){
                            liveTargets.push(targetObj)
                            new RoomVisual(targetObj.room.name).circle(targetObj.pos.x,targetObj.pos.y,{fill: 'transparent', radius: 0.5, stroke: 'red'});
                            new RoomVisual(targetObj.room.name).line(targetObj.pos.x-0.4,targetObj.pos.y-0.4, targetObj.pos.x+0.4,targetObj.pos.y+0.4,{color: 'red'});
                            new RoomVisual(targetObj.room.name).line(targetObj.pos.x+0.4,targetObj.pos.y-0.4, targetObj.pos.x-0.4,targetObj.pos.y+0.4,{color: 'red'});
                        }
                    }
                    let mineral = Game.rooms[troupe.mission.room] ? Game.rooms[troupe.mission.room].find(FIND_MINERALS)[0].pos : {x:25,y:25};
                    if(troupe.remoteHarvester && Game.getObjectById(troupe.remoteHarvester)){
                        let h = Game.getObjectById(troupe.remoteHarvester);
                        new RoomVisual(h.room.name).text(troupe.name.split(' ')[1]+' Support',h.pos.x,h.pos.y-1, {color:'#ffa500',font:'0.5 Bridgnorth'})
                        new RoomVisual(h.room.name).text('Delver',h.pos.x,h.pos.y-0.5, {color:'#ffa500',font:'0.5 Bridgnorth'})
                    }
                    if(troupe.remoteBuilder && Game.getObjectById(troupe.remoteBuilder)){
                        let h = Game.getObjectById(troupe.remoteBuilder);
                        new RoomVisual(h.room.name).text(troupe.name.split(' ')[1]+' Support',h.pos.x,h.pos.y-1, {color:'#ffa500',font:'0.5 Bridgnorth'})
                        new RoomVisual(h.room.name).text('Carpenter',h.pos.x,h.pos.y-0.5, {color:'#ffa500',font:'0.5 Bridgnorth'})
                    }
                    
                    new RoomVisual(troupe.mission.room).text('Mine SK Mineral',mineral.x,mineral.y-2, {color:'#ffa500',font:'0.5 Bridgnorth'});
                    new RoomVisual(troupe.mission.room).text(troupe.name,mineral.x,mineral.y-1.5, {color:'#ffa500',font:'0.5 Bridgnorth'});

                    continue;
                }
                let liveTargets = [];
                for(let target of troupe.mission.targets){
                    let targetObj = Game.getObjectById(target);
                    if(targetObj){
                        liveTargets.push(targetObj)
                        new RoomVisual(targetObj.room.name).circle(targetObj.pos.x,targetObj.pos.y,{fill: 'transparent', radius: 0.5, stroke: 'red'});
                        new RoomVisual(targetObj.room.name).line(targetObj.pos.x-0.4,targetObj.pos.y-0.4, targetObj.pos.x+0.4,targetObj.pos.y+0.4,{color: 'red'});
                        new RoomVisual(targetObj.room.name).line(targetObj.pos.x+0.4,targetObj.pos.y-0.4, targetObj.pos.x-0.4,targetObj.pos.y+0.4,{color: 'red'});
                    }
                }
                let objCentroid = calculateCentroid(liveTargets);
                new RoomVisual(troupe.mission.room).text(troupe.name,objCentroid.x,objCentroid.y-0.5, {color:'#ffa500',font:'0.5 Bridgnorth'});
            }
        }
        //Label reserve creeps
        for(let crpID of reserve){
            let creep = Game.getObjectById(crpID)
            new RoomVisual(creep.room.name).text("Reserve",creep.pos.x,creep.pos.y-0.5, {color:'#ffa500',font:'0.5 Bridgnorth'})
        }
        //Label active duty creeps
        for(let lance of Object.keys(global.heap.army.lances)){
            if(!kingdomCreeps[lance]) continue;
            for(let creep of kingdomCreeps[lance]){
                new RoomVisual(creep.room.name).text(creep.memory.lance,creep.pos.x,creep.pos.y-1, {color:'#ffa500',font:'0.5 Bridgnorth'})
                new RoomVisual(creep.room.name).text(creep.memory.role[0].toUpperCase() + creep.memory.role.slice(1),creep.pos.x,creep.pos.y-0.5, {color:'#ffa500',font:'0.5 Bridgnorth'})
            }
        }

    }
}

function calculateCentroid(targets) {
    if(!targets.length) return {x:25,y:25}
    const sum = targets.reduce((acc, target) => {
        acc.x += target.pos.x;
        acc.y += target.pos.y;
        return acc;
    }, {x: 0, y: 0});

    const count = targets.length;
    return {
        x: sum.x / count,
        y: sum.y / count
    };
}

module.exports = painter;    
profiler.registerObject(painter, 'painter');