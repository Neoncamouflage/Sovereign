const profiler = require('screeps-profiler');

/*
By default this module references an object stored in global that is updated by the rest of the bot.
The object must conform to the following schema.
kingdomStatus: {
    wares: {resourceType:amount,resourceType2:amount ...},
    'roomName' : {
        totalCreeps: totalCreeps,
        fiefCreeps: fiefCreeps,
        hostileCreeps: roomBaddies,
        controllerProgress: room.controller.progress,
        safeMode: room.controller.safeMode,
        spawnUse: fief.combinedSpawnUse,
        currentlySpawning: Object.values(Game.spawns).filter(spawn => spawn.spawning && spawn.room.name == room.name).map(spawn => Game.creeps[spawn.spawning.name].memory.role),
        storageLevel: storageLevel
    }
}


*/

// --Constants --
//These values can be changed to adjust the appearance of the scrolls

//Base scroll dimensions and colors
const ROLL_OPACITY = 1;
const MIDDLE_OPACITY = 0.5;
const SCROLL_WIDTH = 6.25;
const SCROLL_LENGTH = 0.75;
const SCROLL_FILL_COLOR = '#c99157';
const SCROLL_END_COLOR = '#ffdd8a';
//Max fiefs to display before it has to cycle
//Lower this to take up less space, increasing past 7 causes it to extend past the bottom of the room
const MAXIMUM_FIEFS_DISPLAYED = 7;

//Icons
const RCL_ICONS = {
    0:'0️⃣',
    1:'1️⃣',
    2:'2️⃣',
    3:'3️⃣',
    4:'4️⃣',
    5:'5️⃣',
    6:'6️⃣',
    7:'7️⃣',
    8:'8️⃣'
};
const STORAGE_ICONS = {
    0:'🌑', //No Storage
    1:'🌘', //Less than 1/4 full
    2:'🌗', //Less than half full
    3:'🌖', //Less than 3/4 full
    4:'🌕' //More than 3/4 full
};
const STATUS_ICONS = {
    0:'👍', //Good
    1:'⚔️', //Hostiles in room
    2:'🛡️'  //Safemode
};
//How many ticks before the scroll changes to a new view
const SCROLL_CYCLE_TICKS = 5;
const statusManager = {

    run: function() {
        //The overall status object. As long as this is properly assigned, all the rest will work as-is.
        let kingdomStatus = global.heap.kingdomStatus;
        //Take a custom cycleTicks value from the status object, or default to the constant
        let cycleTicks = kingdomStatus.cycleTicks || SCROLL_CYCLE_TICKS;
        let rVis = new RoomVisual();
        //Cycle the scrolls based on the cycle constant. Wares scroll will cycle through:
        //Boosts - T1/T2/T3
        //Base minerals and energy
        //Factory commodities
        let cycleOptions = ['Basic','T1','T2','T3','Factory']


        drawScrolls();
        return;
        //Loop through status of each fief for wares
        Object.keys(kingdomStatus.fiefs).forEach(fief => {
            //There's a better way to do this, fix at some point
            if(kingdomStatus.fiefs[fief]){
                //Add each ware from the fief to the wares object
                for (const resourceType in kingdomStatus.fiefs[fief].wares) {
                    kingdomWares[resourceType] = (kingdomWares[resourceType] || 0) + kingdomStatus.fiefs[fief].wares[resourceType];
                }
            }
            
        });
        //If a total is 0, remove it. Otherwise we get 0s for room minerals we haven't mined yet.
        Object.entries(kingdomWares).forEach(([ware,total]) =>{
            if(total == 0) delete kingdomWares[ware]
        })
        
        //Extend scroll length as needed based on the amount of wares
        if(kingdomWares && Object.keys(kingdomWares).length > 0) SCROLL_LENGTH += Object.keys(kingdomWares).length;
        else{SCROLL_LENGTH +=1;}
        //console.log(Object.keys(roomWares).length)
        
        //Banner dimensions
        let bannerWidth = 15
        let bannerLength = 1
        if(SCROLL_LENGTH == 0) SCROLL_LENGTH +=1;
        //Build banner flag
        rVis.poly([[49.5,-0.5],[49.5 - bannerWidth - 1,-0.5],[49.5- bannerWidth,bannerLength/2 - 0.5],[49.5 - bannerWidth - 1,bannerLength-0.5],[49.5,bannerLength-0.5]], {
            fill: '#FFBA4B',
            opacity:0.6,
            stroke:'black'
        }); 
         
        

        
        //Kingdom text array holds each line inserted for the fief
        let kingdomText = [];

        //Current line text
        let fiefStatus = ''
        //Storage variable
        let storePart;
        //Loop through all fiefs in the status object to fill out their details
        
        Object.keys(kingdomStatus.fiefs).forEach(fief => {
            //Trade Flag Details
            let tradeFlagPoleWidth = 7
            let tradeFlagLength = 0

            //Get trade flag content
            let fiefShipping = global.heap.shipping[fief].requests;
            //Text array
            let tradeText = []
            let tradeVis = [];
            fiefShipping.forEach(task =>{
                //Get what kind of target submitted the request
                let taskTarget = Game.getObjectById(task.targetID);
                let taskTargetType;
                let tradeLine = '';
                if(taskTarget instanceof Creep){
                    taskTargetType = 'creep';
                }
                else if(taskTarget instanceof Structure){
                    taskTargetType = taskTarget.structureType;
                }
                //Task type reference
                let taskTypeIcon = {
                    'pickup':'📤',
                    'dropoff':'📥'
                }

                //Extend the trade flag length and push the new line
                //Need to draw the resource type and target
                tradeVis.push([task.resourceType,taskTargetType])
                tradeLine += taskTypeIcon[task.type]+task.amount
                tradeFlagLength += 1
                tradeText.push(tradeLine)
            });

            //Build trade flag pole
            new RoomVisual(fief).poly([[50,0.6],[50-tradeFlagPoleWidth,0.6],[50-tradeFlagPoleWidth-0.5,0.7],[50-tradeFlagPoleWidth,0.8],[50,0.8]], {
                fill: '#FFBA4B',
                opacity:0.8,
                stroke:'black'
            }); 
            //Change this later to use the length/width constants
            new RoomVisual(fief).poly([
                [49.2,1], //Start
                [49,1],[49,0.6],[48,0.6],[48,1],   //Flag bumps
                [47,1],[47,0.6],[46,0.6],[46,1],
                [45,1],[45,0.6],[44,0.6],[44,1],
                [43.8,1],                            //End Bumps
                [43.8,3.5+tradeFlagLength], //Left corner

                [44.48,2.5+tradeFlagLength],[45.16,3.5+tradeFlagLength],   //Left angle
                [45.83,2.5+tradeFlagLength],[46.51,3.5+tradeFlagLength],[47.18,2.5+tradeFlagLength],         //Bottom
                [47.86,3.5+tradeFlagLength],[48.53,2.5+tradeFlagLength],  //Right angle


                [49.2,3.5+tradeFlagLength], // Right corner
                [49.2,1] //Back to start
            ], {
                fill: '#CC3514',
                opacity:0.6,
                stroke:'black'
            }); 
            let textCount = 0;
            for(i=0;i<tradeText.length;i++){
                let line = tradeText[i];
                let targetType = tradeVis[i][1];
                new RoomVisual(fief).text(line, 50+3.6-tradeFlagPoleWidth,2+textCount, {color: 'black', font: 'bold 0.6 Bridgnorth',align:'left'});
                new RoomVisual(fief).resource(tradeVis[i][0], 50+3-tradeFlagPoleWidth, 1.8+textCount, 0.35)
                //Switch to dictate what we draw for the requester
                if(targetType == 'creep'){
                    //Draw a creep?
                }
                else if([STRUCTURE_TOWER,STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_POWER_SPAWN,STRUCTURE_NUKER,STRUCTURE_FACTORY,STRUCTURE_TERMINAL,STRUCTURE_STORAGE,STRUCTURE_LAB].includes(targetType)){
                    //Draw structure
                    new RoomVisual(fief).structure(50+1.8-tradeFlagPoleWidth, 1.8+textCount,targetType);
                }
                textCount++;
            }

            // -- End trade flag details

            




            //Breaker line after each fief
            if(kingdomText.length){
                fiefStatus = '------------------------'
                kingdomText.push(fiefStatus)
            }



            //Set the fief name
            fiefStatus = fief
            //status reference
            let details = kingdomStatus.fiefs[fief];
            //Max spawn queue icons before it shows as '+n' for additional creeps
            let maxIcons = 6;
            if(!details){
                kingdomText.push(fiefStatus+' '+'👶');
                return;
            }
            //Storage status
            else if(details.storageLevel){
                storePart = (details.storageLevel/1000000)*100

                if(storePart<25){
                    fiefStatus+=storeIcon[1];
                }
                else if(storePart <50){
                    fiefStatus+=storeIcon[2];
                }
                else if(storePart <75){
                    fiefStatus+=storeIcon[3];
                }
                else{
                    fiefStatus+=storeIcon[4];
                }
            }
            //No storage 
            else{
                fiefStatus+=storeIcon[0];
            }
            //Alert status
            if(details.safeMode){
                fiefStatus+=statusIcons[2];
            }
            else if(details.hostileCreeps.length){
                fiefStatus+=statusIcons[1]
            }
            else{
                fiefStatus+=statusIcons[0]
            }
            //Upgrade progress
            fiefStatus += roomLevelIcons[details.roomLevel];
            //No upgrade progress for RCL 8
            if(details.roomLevel != 8){
                fiefStatus+=((details.controllerProgress/CONTROLLER_LEVELS[details.roomLevel])*100).toFixed(0)+'%';
            }
            //Spawn queue and status
            //Sort queue based on priority - Pretty sure the queue arrives presorted, so likely unnecessary
            let fiefQueue = Object.keys(details.spawnQueue).sort((a, b) => details.spawnQueue[b].sev - details.spawnQueue[a].sev)
            let queueStatus = ''
            //Push line and reset for spawn queue
            kingdomText.push(fiefStatus);
            fiefStatus='';

            let spawnStatus = []
            let isSpawning = false;
            let useTotal = 0;
            //For each spawn in spawn utilization object
            Object.keys(details.spawnUse).forEach(spawn =>{
                //Each spawn subtracts 1 from max icons
                maxIcons--;
                let eachSpawn = Game.getObjectById(spawn);
                //Only show individual spawn utilization for sub-RCL8
                if(details.roomLevel == 8){
                    useTotal += details.spawnUse[spawn]
                    //console.log(details.spawnUse[spawn])
                }else{
                    fiefStatus += eachSpawn.name+' ';
                    fiefStatus += details.spawnUse[spawn].toFixed(2)+'%'
                    spawnStatus.push(fiefStatus)
                }
                //If spawning, push the relevant icon to queue status
                if(eachSpawn.spawning){
                    queueStatus += Memory.icons[Game.creeps[eachSpawn.spawning.name].memory.role]
                    isSpawning = true;
                }
                //Else the resting icon
                else{
                    queueStatus += '😴';
                }
                //console.log(JSON.stringify(eachSpawn.spawning))
                //Reset fief status for next spawn
                fiefStatus = ''
                
            });
            //Add separater after actively spawning creeps
            queueStatus += '|';

            //RCL8s only
            if(details.roomLevel == 8){
                fiefStatus += 'All Spawns ';
                //console.log(useTotal)
                //console.log(Object.keys(details.spawnUse))
                //console.log(Object.keys(details.spawnUse).length)
                fiefStatus += Math.round(useTotal/Object.keys(details.spawnUse).length).toFixed(2)+'%';
                spawnStatus.push(fiefStatus)
            }
            if(fiefQueue.length){
                //Max 6 icons in queue for current scroll dimensions
                let icons = 0;
                fiefQueue.forEach(creep =>{
                //console.log(JSON.stringify(details.spawnQueue[creep].memory))
                //console.log(details.spawnQueue[creep].memory.role)
                //console.log(Memory.icons[details.spawnQueue[creep].memory.role])
                //Add icons up to limit
                if(icons < maxIcons){
                    queueStatus+= Memory.icons[details.spawnQueue[creep].memory.role];
                }
                icons +=1;
                });
                if(icons > maxIcons){
                    queueStatus += '+'+(icons-maxIcons)
                }
            }
            //Push spawn queue status
            kingdomText.push(queueStatus);
            //Push spawn status
            spawnStatus.forEach(x=>{
                kingdomText.push(x)
            })
        });
        

        //Banner Flag Stats 
        //CPU
        let bannerText = Game.cpu.getUsed().toFixed(2)+'/'+Game.cpu.limit
        //Kingdom creeps
        //Only approximate due to deaths/spawning/periodic garbage collection
        //No real need for exactness
        bannerText += ' Population: '+Object.keys(Memory.creeps).length

        //Write banner
        let bannerDist = 49 - (bannerWidth-0.75)
        rVis.text(bannerText, bannerDist, 0.25, {color: 'black', font: 'bold 0.8 Bridgnorth', align:'left'});



        //Scroll Labels ----------------------//
        rVis.text('📦Wares', SCROLL_WIDTH/2, 0.5, {color: 'black', font: 'bold 1 Bridgnorth'});
        rVis.text('🏰Fiefs '+Object.keys(Memory.kingdom.fiefs).length+'/'+Game.gcl.level, SCROLL_WIDTH/2, SCROLL_LENGTH+0.3, {color: 'black', font: 'bold 1 Bridgnorth'});
        //Room inventory
        try{
            let waresCount = 0;
            let waresText = '';
            Object.keys(kingdomWares).forEach(ware =>{
                //console.log(ware)
                waresText = ware.charAt(0).toUpperCase() + ware.slice(1)+': '+kingdomWares[ware].toLocaleString();
                rVis.text(waresText, 0, 1.7+waresCount, {color: 'black', font: 'bold 0.75 Bridgnorth',align:'left'});
                waresCount+=1;
            });
            
        }
        catch(error){
            //console.log(error.message);
        }


        return;

        function drawScrolls(){
            
            //Minimum length of 1 if empty, otherwise extend the scroll up to the maximum
            let totalFiefLength = SCROLL_LENGTH + Math.min(MAXIMUM_FIEFS_DISPLAYED,Math.max(9,Object.keys(kingdomStatus.fiefs).length))
            let totalWaresLength = SCROLL_LENGTH + 5
            let fiefStart = totalWaresLength + 3
            //Build wares scroll top
            rVis.circle(SCROLL_WIDTH-.4,0.20,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, -0.5,SCROLL_WIDTH, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,0.22,{
                radius: .73,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });

            //Middle of wares scroll
            rVis.rect(-0.5, 0.9, SCROLL_WIDTH+0.2, totalWaresLength,{
                opacity: MIDDLE_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 

            //Bottom of wares scroll
            rVis.circle(SCROLL_WIDTH-.4,totalWaresLength+1,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, totalWaresLength+0.25,SCROLL_WIDTH, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,totalWaresLength+1,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });

            //Build fief scroll below wares
            //Top of scroll
            rVis.circle(SCROLL_WIDTH-.4,fiefStart,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: 1,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart-0.79,SCROLL_WIDTH, 1.59,{
                opacity: 1,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,fiefStart,{
                radius: .75,
                fill:SCROLL_END_COLOR,
                opacity: 1,
                stroke: SCROLL_FILL_COLOR
            });
            
            //Middle of scroll
            rVis.rect(-0.5, fiefStart+0.75, SCROLL_WIDTH+0.2, totalFiefLength+1,{
                opacity: 0.5,
                fill:SCROLL_FILL_COLOR
            }); 
            //Bottom of scroll
            rVis.circle(SCROLL_WIDTH-.4,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart+totalFiefLength+1.25,SCROLL_WIDTH, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
        }
    }
}

module.exports = statusManager;
profiler.registerObject(statusManager, 'statusManager');