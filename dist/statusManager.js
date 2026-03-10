const profiler = require('screeps-profiler');

/**
 * TODO
 * 
 * Have the width automatically calculate based on the icons and amounts for each row, using
 * either the max width or minimum default scroll width
 * 
 */

/*
This module requires the RoomVisuals
By default this module references an object stored in global that is updated by the rest of the bot.
The object must conform to the format shown in this example. Optional keys are stated as such and may be excluded without issue.
Adding information or removing any non-optional information will require an adjustment to the visuals themselves.

kingdomStatus: {
    lastReset: 123456,                         //Game.time of the last global reset
    activeHoldings: ['E2N1','E3N2'],           //Array of active remote room names
    totalHoldings: 2,                          //Number of total remotes, active and inactive
    cpuAverage: 14.5,                          //Average CPU used by the bot. Value can be calculated however is preferred.
    displayAll: true,                          //Optional value to set whether we want to display all resources even with zero quantities
    cycleTicks: 5,                             //Optional value to set how frequently the visual cycles
    wares: {'OH':27000,'utrium_bar':900 ...},  //Amounts for every resource type in storages/containers/terminals/whatever you want counted
    fiefs: {
        E1N1 : {
            roomStatus: 'OK',                  //Optional value to indicate room status
            fiefCreeps: 80,                    //Total creeps associated with the room
            hostileCreeps: true,               //If hostile creeps are present in the room
            spawnUse: 82.77,                   //Current spawn utilization as a percentage from 0-100
            energyUse: 19.9,                   //Average energy income for this room, calculated as preferred
            shippingOrders: 45                 //Total supply/demand orders currently active for this room's haulers
            shippingUse: 45                    //Current hauler utilization as a percentage from 0-100
        }
    }
}

*/

// --Constants --

//Base scroll dimensions and colors
const ROLL_OPACITY = 1;
const MIDDLE_OPACITY = 0.5;
const SCROLL_WIDTH = 7.25;
const WARES_SCROLL_WIDTH = 23;
const FIEFS_SCROLL_WIDTH = 7.25;
const SCROLL_LENGTH = 0.75;
const WARES_SCROLL_MAX_LENGTH = 18;
const WARES_LINE_HEIGHT = 1.5;
const WARES_LINE_WIDTH = 4.5;
const SCROLL_FILL_COLOR = '#c99157';
const SCROLL_END_COLOR = '#ffdd8a';
const BANNER_WIDTH = 20;
const BANNER_LENGTH = 1;
const BOOSTS_END_INDEX = 42;
//Max fiefs to display before it has to cycle
//Lower this to take up less space, increasing past 7 causes it to extend past the bottom of the room
const MAXIMUM_FIEFS_DISPLAYED = 5;

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
const SCROLL_CYCLE_TICKS = 2;
//Which tick we're on out of the current cycle.
let current_cycle_tick = 1;
//Cycle the scrolls based on the cycle constant. Wares scroll will cycle through base minerals and boost tiers, no commodities at this time.
let cycleOptions = ['Basic','T1','T2','T3']
//Ranges for checking resources types with RESOURCES_ALL
let resourceRanges = {
    'Basic':[0,8],
    'T1':[10,22],
    'T2':[23,32],
    'T3':[33,42]
}
//Which ware selection we're currently displaying.
let current_ware = 0;
const statusManager = {

    run: function() {

        //The overall status object. As long as this is properly assigned, all the rest will work as-is.
        let kingdomStatus = global.heap.kingdomStatus;
        //console.log("ALLSTATUS",JSON.stringify(kingdomStatus))
        //true  - Display all minerals and boosts, even with 0 quantity
        //false - Display only minerals and boosts with a positive quantity, skip displaying resource sets with none of any in stock
        //const DISPLAY_ALL = kingdomStatus.displayAll || true;

        //Take a custom cycleTicks value from the status object, or default to the constant
        let cycleTicks = kingdomStatus.cycleTicks || SCROLL_CYCLE_TICKS;
        current_cycle_tick++;
        let rVis = new RoomVisual();


        //Process the current tick
        if(current_cycle_tick > cycleTicks){
            current_cycle_tick = 1;
            current_ware++;
        }

        //Get the current ware selection and update them, moving to the next type if we have none of the current cycle type
        //We bypass this if the DISPLAY_ALL option is set to true, since we don't care if we display zeroes in that case
        let hasWares = Object.keys(kingdomStatus.wares).length
        let wareSet = [];
        /*if(!DISPLAY_ALL && hasWares){
            let safety = 0
            while(safety < 6){
                safety++
                //console.log("Ware check! Safety is at",safety)
                if(current_ware >= cycleOptions.length){
                    current_ware = 0;
                }
                //console.log("Current ware is",current_ware,cycleOptions[current_ware])
                //Check if any of our wares are of the type we need
                //let [startIndex, endIndex] = resourceRanges[cycleOptions[current_ware]];
                let wareKeys = Object.keys(kingdomStatus.wares);
                //let resourcesInRange = RESOURCES_ALL.slice(startIndex, endIndex + 1);
                let wareCheck = wareKeys.some(ware => RESOURCES_ALL.includes(ware));
                //console.log("Check result:",wareCheck)
                if(wareCheck){
                    wareSet = Object.entries(kingdomStatus.wares)
                    .filter(([key]) => RESOURCES_ALL.includes(key))
                    .map(([key, value]) => [key, value]);
                    break;
                }
                else{
                    //console.log("NO WARES, NEXT");
                    current_cycle_tick = 1;
                    current_ware++;
                }
            }
        }
        else if(DISPLAY_ALL){*/
        if(current_ware >= cycleOptions.length){
            current_ware = 0;
        }
        //let [startIndex, endIndex] = resourceRanges[cycleOptions[current_ware]];
        //Only basic through T3, other resources don't yet have icons
        let resourcesInRange = RESOURCES_ALL.slice(0, BOOSTS_END_INDEX + 1);
        for(let resType of resourcesInRange){
            if(kingdomStatus.wares[resType]) wareSet.push([resType,kingdomStatus.wares[resType]]);
        }
        //}
        //Draw the base decorations
        drawScrolls(wareSet.length);
        drawBanners();

        //Update kingdom wares if applicable
        if(hasWares)updateWares(wareSet);
        //console.log("PREFUNCTION",JSON.stringify(kingdomStatus),Object.keys(kingdomStatus.fiefs))
        //Update fiefs
        if (Object.keys(kingdomStatus.fiefs).length) updateFiefs()
        
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
                fiefStatus = '------------------------------------'
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

        function formatNum(number) {
            if (number >= 1000000) {
                return (number / 1000000).toFixed(1) + 'M';
            } else if (number >= 10000) {
                return (number / 1000).toFixed(1) + 'K';
            } else{
                return number.toLocaleString();
            }
        }

        function updateFiefs(){
            let fiefText = [];
            for(let fiefName of Object.keys(kingdomStatus.fiefs)){
                //Add a breaker line if not the first fief
                if(fiefText.length)fiefText.push('--------------------------');

                //console.log("STATUS FIEF",fiefName,JSON.stringify(kingdomStatus.fiefs[fiefName]))
                let fief = kingdomStatus.fiefs[fiefName];
                let room = Game.rooms[fiefName]
                //Start off the text status for this room with the name
                let fiefStatus = fiefName;
                //Get storage icon
                if(room.storage){
                    let storePart = room.storage.store.getUsedCapacity()/10000
                    if(storePart<25){
                        fiefStatus+=STORAGE_ICONS[1];
                    }
                    else if(storePart <50){
                        fiefStatus+=STORAGE_ICONS[2];
                    }
                    else if(storePart <75){
                        fiefStatus+=STORAGE_ICONS[3];
                    }
                    else{
                        fiefStatus+=STORAGE_ICONS[4];
                    }
                }
                else{
                    fiefStatus+=STORAGE_ICONS[0];
                }

                //Get room status from fief object
                if(fief && fief.roomStatus){
                    if(fief.roomStatus == 'SAFEMODE'){
                        fiefStatus += STATUS_ICONS[2]
                    }
                    else if(fief.roomStatus == 'ATTACK'){
                        fiefStatus += STATUS_ICONS[1]
                    }
                    else{
                        fiefStatus += STATUS_ICONS[0]
                    }
                }
                //If not available in fief object, determine room status based on hostiles and safemode
                else{
                    if(room.controller.safeMode){
                        fiefStatus += STATUS_ICONS[2]
                    }
                    else if(fief && fief.hostileCreeps && fief.hostileCreeps.length){
                        fiefStatus += STATUS_ICONS[1]
                    }
                    else{
                        fiefStatus += STATUS_ICONS[0]
                    }
                }

                //RCL and and % if not fully upgraded
                fiefStatus += RCL_ICONS[room.controller.level]
                fiefStatus+=room.controller.level == 8 ? '' : ((room.controller.progress/CONTROLLER_LEVELS[room.controller.level])*100).toFixed(0)+'%';
                //Push first line
                fiefText.push(fiefStatus)
                
                fiefStatus =  `📈${fief ? fief.energyUse : 0}🕑${fief ? fief.spawnUse : 0}%🚚${fief ? fief.shippingUse : 0}%`  //📝${fief ? fief.shippingOrders : 0}
                fiefText.push(fiefStatus)

            }
            
            let lineCount = 0;
            for(let line of fiefText){
                rVis.text(line, -0.4, statusManager.fiefTextStart+lineCount, {color: 'black', align:'left',font: 'bold 0.75 Bridgnorth'});
                lineCount++;
            }
            

        }

        function updateWares(wares){
            //console.log("WARES",JSON.stringify(wares))
            //if(Object.keys(wares).length == 0) return
            let wareY = 2
            let textOffset = 1
            let iconOffset = 0.5
            let wareX=0
            let wareCount = 0;
            //Wider boost icons need text adjustment
            /*if(cycleOptions[current_ware] == 'T2'){
                textOffset += 0.25;
                iconOffset += 0.25;
            }
            else if(cycleOptions[current_ware] == 'T3'){
                textOffset += 0.5;
                iconOffset += 0.5;
            }*/
            for(let each of wares){
                //Skip if we don't have any of that resource
                if(each[1] == 0) continue;
                //Fill out wares til the bottom of the scroll. Then move over a column.
                if(wareCount*WARES_LINE_HEIGHT >= WARES_SCROLL_MAX_LENGTH){
                    wareX += WARES_LINE_WIDTH;
                    wareY = 2;
                    wareCount = 0;
                }
                rVis.resource(each[0],wareX+iconOffset,wareY-0.25,0.45);
                rVis.text(formatNum(each[1]), wareX+iconOffset+textOffset, wareY, {color: 'black', font: 'bold 0.8 Bridgnorth',align: 'left'});
                
                //if(wareX == 0){
                    /*if(cycleOptions[current_ware] == 'T3'){
                        wareX = 4;
                    }
                    else{
                        wareX = 3.5;
                    }*/
                //}
                //else{
                //    wareX = 0;
                wareY += WARES_LINE_HEIGHT;
                //}

                wareCount++;
            }
        }

        function drawBanners(){
            //Add length to banner as lastReset time increases, since this is highly variable
            let kingdomTime = Game.time- kingdomStatus.lastReset;
            let totalBannerWidth = BANNER_WIDTH + Math.floor(kingdomTime.toString().length);
            rVis.poly([[49.5,-0.5],[49.5 - totalBannerWidth - 1,-0.5],[49.5- totalBannerWidth,BANNER_LENGTH/2 - 0.5],[49.5 - totalBannerWidth - 1,BANNER_LENGTH-0.5],[49.5,BANNER_LENGTH-0.5]], {
                fill: '#FFBA4B',
                opacity:0.6,
                stroke:'black'
            }); 
            let heap = Game.cpu.getHeapStatistics();
            rVis.text(`CPU:${(kingdomStatus.cpuAverage || 0)}/${Game.cpu.limit}  |  Pop:${Object.values(Game.creeps).length}  |  🌾 ${kingdomStatus.activeHoldings.length||'-'}/${kingdomStatus.totalHoldings||'-'}  |  ⏱ ${kingdomTime}  |  💾${((heap.used_heap_size/heap.heap_size_limit)*100).toFixed(2)}%`, 50 - totalBannerWidth, 0.25, {color: 'black', align:'left', font: 'bold 0.75 Bridgnorth'});
        }

        function drawScrolls(wareSet){
            let totalWaresLength = Math.min(WARES_SCROLL_MAX_LENGTH,(WARES_LINE_HEIGHT*wareSet));
            let waresWidth = Math.ceil((WARES_LINE_HEIGHT*wareSet)/WARES_SCROLL_MAX_LENGTH)*WARES_LINE_WIDTH;
            //console.log("Total length:",totalWaresLength,WARES_LINE_HEIGHT*wareSet)
            //Minimum length of 1 if empty, otherwise extend the scroll up to the maximum
            let fiefCount = Math.min(MAXIMUM_FIEFS_DISPLAYED,Object.keys(kingdomStatus.fiefs).length)
            //Fiefs take 2 lines of information, so we multiple the count by 2 for the length, then add length for breaker lines
            let totalFiefLength = SCROLL_LENGTH + (fiefCount*2) + (fiefCount > 1 ? (fiefCount-1) : 0) - 1
            //let totalWaresLength = WARES_SCROLL_LENGTH// + (Math.ceil(wareLength/2)*1.5)
            let fiefStart = totalWaresLength + 4.5
            //let wareWidth = SCROLL_WIDTH-1
            //T3 boosts need more width
            /*if(cycleOptions[current_ware] == 'T2'){
                WARES_SCROLL_WIDTH += 0.5
            }
            else if(cycleOptions[current_ware] == 'T3'){
                WARES_SCROLL_WIDTH += 1
            }*/



            //Build wares scroll top
            rVis.circle(waresWidth-.4,0.20,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, -0.5,waresWidth, 1.5,{
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
            rVis.rect(-0.5, 0.9, waresWidth+0.2, totalWaresLength+1,{
                opacity: MIDDLE_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 

            //Bottom of wares scroll
            rVis.circle(waresWidth-.4,totalWaresLength+2,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, totalWaresLength+1.25,waresWidth, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,totalWaresLength+2,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });

            //Build fief scroll below wares
            //Top of scroll
            rVis.circle(SCROLL_WIDTH-.2,fiefStart,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: 1,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart-0.79,SCROLL_WIDTH+0.2, 1.59,{
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
            rVis.rect(-0.5, fiefStart+0.75, SCROLL_WIDTH+0.4, totalFiefLength+1,{
                opacity: 0.5,
                fill:SCROLL_FILL_COLOR
            }); 
            //Bottom of scroll
            rVis.circle(SCROLL_WIDTH-.2,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart+totalFiefLength+1.25,SCROLL_WIDTH+0.2, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            //Since the text start varies based on wares length, set the property for our fief statuses to track
            statusManager.fiefTextStart = fiefStart+1.7;

            //Scroll Labels ----------------------//
            rVis.text('📦Wares', (waresWidth/2)+0.2, 0.5, {color: 'black', font: 'bold 1 Bridgnorth'});
            rVis.text('🏰Fiefs '+Object.keys(Memory.kingdom.fiefs).length+'/'+Game.gcl.level, SCROLL_WIDTH/2, fiefStart+0.25, {color: 'black', font: 'bold 1 Bridgnorth'});
        }
    }
}

module.exports = statusManager;
profiler.registerObject(statusManager, 'statusManager');