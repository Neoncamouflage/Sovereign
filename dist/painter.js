if(!Memory.visuals) Memory.visuals = {};
const painter = {
    //Paints visuals based on flags set in memory
    run: function(){
        let visuals = Memory.visuals;
        let fiefs = Memory.kingdom.fiefs;
        let holdings = Memory.kingdom.holdings;

        //Loop through fiefs and holdings since some visuals are specific to those
        for(let fief in fiefs){
            if(visuals.drawFiefCM) this.drawFiefCM(fief)
            if(visuals.drawFiefPlan) this.drawFiefPlan(fief)
        }
        if(visuals.drawIntel) this.drawIntel()
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
    drawFiefPlan: function(fief){
        return;
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
            //Scout data markings
            Game.map.visual.text(roomName+"👁"+(Game.time-data.lastRecord), new RoomPosition(25,6,roomName), {color: '#FFFFF', fontSize: 6});
        });
    }
}

module.exports = painter;    

/**
 * 
 * drawVisuals: function(fief,fiefType=null){
        //Return if no visuals
        if(!Memory.rotatingVisuals) return;
        //Drawing shifts per game tick
        //Keep track of what is used which tick or this is a mess

        let type = fiefType;
        //Number of visuals we cycle though. Must manually update each time.
        let tickMod = 2
        if(!type){
            return -1;
        }

        //Draw visuals based on what tick
        switch(Game.time % tickMod){

            //Holding Remote Roads
            case 0:
                if(type == 'holding'){
                    let holding = Memory.kingdom.holdings[fief];
                    if(holding.remoteRoad){
                        for(let i = 0; i < holding.remoteRoad.length-1; i++){
                            const startPos = holding.remoteRoad[i];
                            const endPos = holding.remoteRoad[i + 1];
                        
                            // Draw a line between each pair of adjacent positions
                            if(startPos.fiefName == endPos.fiefName){
                                new FiefVisual(startPos.fiefName).line(startPos, endPos, { color: 'blue', width: 0.2 });
                            }
                        }
                    }
                }
                break;
            //Established roads and structures according to Cost Matrix
            case 1:
                let cm;
                if(type == 'fief'){
                    cm = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[fief].costMatrix);
                }else if(type == 'holding'){
                    cm = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[fief].costMatrix);
                }
                if(!cm) return -1;
                for(let x=0;x<50;x++){
                    for(let y=0;y<50;y++){
                        //new FiefVisual(fief).text(cm.get(x,y),x,y+0.25)
                        let score = cm.get(x,y);
                        if(score == 1){
                            new FiefVisual(fief).circle(x,y,{fill:'red'})
                        }else if(score == 255){
                            new FiefVisual(fief).circle(x,y,{fill:'black'})
                        }else if(score == 25){
                            new FiefVisual(fief).circle(x,y,{fill:'orange'})
                        }
                    }
                }
                break;
            
            //Fief Fief Plans
            case 2:
                if(type == 'fief'){
                    //Visuals
                    //Pull plan and split into array
                    let plan = JSON.parse(Memory.kingdom.fiefs[fief].fiefPlan)
                    for(let building in plan){
                        if(Array.isArray(plan[building])){
                            plan[building].forEach(coordinate => {
                                Game.fiefs[fief].visual.structure(coordinate.x,coordinate.y,building);
                            });
                        }
                    }
                }
                break;
        }
        
        
    }
 */