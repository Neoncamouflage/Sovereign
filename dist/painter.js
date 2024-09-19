if(!Memory.visuals) Memory.visuals = {};
const profiler = require('screeps-profiler');
const painter = {
    //Paints visuals based on flags set in memory
    run: function(kingdomCreeps){
        let visuals = Memory.visuals;
        let fiefs = Memory.kingdom.fiefs;
        let holdings = Memory.kingdom.holdings;

        //Loop through fiefs and holdings since some visuals are specific to those
        if(visuals.drawFiefCM || visuals.drawFiefPlan){
            for(let fief in fiefs){
                if(visuals.drawFiefCM) this.drawFiefCM(fief)
                if(visuals.drawFiefPlan) this.drawFiefPlan(fief)
            }
        }
        if(visuals.drawLoot) this.drawLoot();
        if(visuals.drawMilitary) this.drawMilitary(kingdomCreeps);
        if(visuals.drawIntel) this.drawIntel();
        if(visuals.drawTest) this.drawTest();
        if(visuals.drawRoomPlan) this.drawRoomPlan(visuals.drawRoomPlan)
        
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
    drawRoomPlan: function(roomName){
        let plans = JSON.parse(RawMemory.segments[1]);
        let plan
        let ramps
        if(plans[roomName]){
            [plan, ramps] = plans[roomName]
        }
        //let ramps = Memory.kingdom.fiefs[roomName].rampartPlan;
        if(!plan || !ramps){
            new RoomVisual(roomName).text("NO FIEF PLAN",25,25, {color:'#ffa500',font:'3 Bridgnorth'});
            return;
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
    drawIntel(){
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
        for([holdingName,holding] of Object.entries(Memory.kingdom.holdings)){
            if(holding.sources){
                for(source of Object.values(holding.sources)){
                    if(source.path){
                        Game.map.visual.poly(source.path)
                        Game.map.visual.text(source.path.length, new RoomPosition(source.path[source.path.length-1].x,source.path[source.path.length-1].y,holdingName), {color: '#FFFFF', fontSize: 6});
                    }
                }
                if(!holding.standby){
                    Game.map.visual.text("🌾", new RoomPosition(49,6,holdingName), {color: '#FFFFF', fontSize: 6,align:'right'});
                }
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
    drawTest(){
        // -- REMOTE ROAD TEST --
        for(let holding of Object.values(Memory.kingdom.holdings)){
            if(!holding.remoteRoute) continue;
            Game.map.visual.poly(holding.remoteRoute)
        }
        if(Memory.remoteRoadTest){
            let names = Object.keys(Memory.remoteRoadTest);
            let tickPick = Game.time % names.length;
            let route = Memory.remoteRoadTest[names[tickPick]];
            let holding = route[route.length-1].roomName
            let roomVis = new RoomVisual(holding)
            for(let spot of route){
                if(spot.roomName == holding) roomVis.structure(spot.x,spot.y,STRUCTURE_ROAD)
            }
            roomVis.connectRoads()
            new RoomVisual(holding).text(names[tickPick].toLowerCase(),25,25,{color:'#ffa500',font:'1 Bridgnorth'})
            
        }


        // -- TEST CM - USE THIS FOR ANY CM DRAWING --
        /*let testCM = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings.E46N38.costMatrix);
        for (let x = 0; x <= 49; x += 1) {
            for (let y = 0; y <= 49; y += 1) {
                let weight = testCM.get(x,y);
                if(weight == 0) continue;
                new RoomVisual('E46N38').text(weight,x,y+0.25,{font:0.25});
                //new RoomVisual('E46N38').rect(x - 0.5, y - 0.5, 1, 1, {
                    //fill: `hsl(${200}${weight * 10}, 100%, 60%)`,
                    //opacity: 0.4,
                //})
            }
        }*/
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