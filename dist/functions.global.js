const registry = require('registry');
const supplyDemand = require('supplyDemand');
const helper = require('functions.helper');

//Update diplomacy
global.setDiplomacy = function setDiplomacy(type,username){
    //Memory.diplomacy = {allies:[], ceasefire:[], outlaws:[],ledger:[]}
    //Update the list based on which type. If ally or enemy, also update scout data
    switch (type) {
        case 'ally':
            updateLists('allies', ['ceasefire', 'outlaws']);
            updateScoutData()
            break;
        case 'ceasefire':
            updateLists('ceasefire', ['allies', 'outlaws']);
            break;
        case 'enemy':
            updateLists('outlaws', ['allies', 'ceasefire']);
            updateScoutData()
            break;
        default:
            console.log("Invalid diplomacy type");
            break;
    }


    function updateLists(addToList, removeFromLists) {
        if (!Memory.diplomacy[addToList].includes(username)) {
            Memory.diplomacy[addToList].push(username);
        }

        removeFromLists.forEach(list => {
            let index = Memory.diplomacy[list].indexOf(username);
            if (index > -1) {
                Memory.diplomacy[list].splice(index, 1);
            }
        });
    }

    function updateScoutData(){
        let scoutData = getScoutData();
        let updatedRooms = [];
        for([roomName,roomData] of Object.entries(scoutData)){
            if(roomData.owner == username){
                roomData.ownerType = type;
                updatedRooms.push(roomName)
            }
        }
        if(updatedRooms.length){
            console.log(`Diplomacy standing updated. Fief status${updatedRooms.length == 1? '' : 'es'} changed to ${type}: ${updatedRooms.join(',')}.`)
        }
        else{
            console.log("Diplomacy standing updated. No known fiefs to update.")
        }
        
    }
}

global.isMe = function isMe(target){
    return target.toLowerCase() == Memory.me.toLowerCase()
}

global.getDiplomacy = function getDiplomacy(username){
    for (let [type,members] of Object.entries(Memory.diplomacy)){
        //Continue if we're not looking at one of the member lists
        if(!['allies','ceasefire','outlaws'].includes(username)) continue;
        //If they're on one of the lists, return their status
        if(members.includes(username)) return type;
    }
    //Not on any list, return neutral
    return 'neutral';
}

global.isFriend = function isFriend(target){
    let checkVal;
    if(target instanceof RoomObject){
        if(target.owner && target.owner.username){
            checkVal = target.owner.username;
        }
        else{
            //If neither of these then something's weird. Log it and return false.
            console.log("Unable to get diplo status of",target)
            return false;
        }
    }
    else if(typeof target === 'string' || target instanceof String){
        checkVal = target;
    }
    else{
        //If neither string or roomobject, something's weird again. Log it and return.
        console.log("Diplo target is neither string nor object",target)
        return false;
    }
    //Get diplo status and return friendly check
    let diplo = getDiplomacy(checkVal);
    if(diplo == 'allies' || diplo == 'ceasefire'){
        return true;
    }
    else{
        return false;
    }
}

global.removeScoutData = function removeScoutData(roomName){
    if(global.heap && global.heap.scoutData && global.heap.scoutData[roomName]) delete global.heap.scoutData[roomName];
}
//Scout Data Getter and Setter - Single is an optional string for a specific property
global.getScoutData = function getScoutData(roomName=false){
        /**
     * roomName: r
     * lastRecord: l
     * roomType: t
     * ownerType: o
     * owner: w
     * controller: c
     * controllerLevel: u
     * towers: y
     * sources: s
     * mineral: m
     * exits: e
     */
    let scoutData = global.heap && global.heap.scoutData;
    //If first tick or no scout data for a specific room, return false
    if(!scoutData || (roomName && !scoutData[roomName])){
        //console.log("No scout data available! Room?",JSON.stringify(roomName))
        return false;
    }
    //No room name means all data
    if(!roomName){
        let roomData = {};
        for(let roomName of Object.keys(scoutData)){
            roomData[roomName] = convertData(roomName);
        }
        return roomData;
    }
    //Else just the requested room
    else{
        return convertData(roomName)
    }

    

    function convertData(roomName){
        const roomData = scoutData[roomName] || {};
        return {
            roomName: roomData.r || '',
            lastRecord: roomData.l || '',
            roomType: roomData.t || '',
            ownerType: roomData.o || '',
            owner: roomData.w || '',
            controller: roomData.c || '',
            controllerLevel: roomData.u || '',
            towers: roomData.y || '',
            sources: roomData.s || '',
            mineral: roomData.m || ''
        };
    }
}
global.setScoutData = function setScoutData(room,data={},force=false){
    //console.log("Setting data for",room,JSON.stringify(data))
    let scoutData = global.heap.scoutData;
    //If first tick and no scout data, return
    if(!scoutData) return;
    //If room is a room name, add custom data directly.
    if(typeof room === 'string'){
        scoutData[room] = data;
        return;
    }
    if(!(room instanceof Room)){
        console.log("Room name or object must be provided for scout data");
        return;
    }

    let [roomType,ownerType,owner] = helper.getRoomType(room);
    let sources = room.find(FIND_SOURCES).map(src => {return {x:src.pos.x,y:src.pos.y,id:src.id}})
    let mineral = room.find(FIND_MINERALS)[0];
    let towerPositions = room.find(FIND_HOSTILE_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}}).map(tow => {return {x:tow.pos.x,y:tow.pos.y}});
    /**
     * roomName: r
     * lastRecord: l
     * roomType: t
     * ownerType: o
     * owner: w
     * controller: c
     * controllerLevel: u
     * towers: y
     * sources: s
     * mineral: m
     * exits: e
     */
    global.heap.scoutData[room.name] = {
        r : room.name || '',
        l : Game.time || '',
        t: roomType || '',
        ...(ownerType && { o: ownerType }),
        ...(ownerType && owner && { w: owner }),
        ...(room.controller && { c: room.controller.pos }),
        ...(roomType === 'fief' && room.controller.level && { u: room.controller.level }),
        ...(towerPositions.length && { y: towerPositions }),
        ...(sources && { s: sources }),
        m: mineral ? {x:mineral.pos.x,y:mineral.pos.y,type:mineral.mineralType} : ''
    }
    if(Game.shard.name == 'shardSeason'){
        //global.heap.scoutData[room.name].scoreCollector = room.find(FIND_SCORE_COLLECTORS).map(coll => {return {x:coll.pos.x,y:coll.pos.y,id:coll.id}})
        //global.heap.scoreCans.push(... room.find(FIND_SCORE_CONTAINERS).map(can => {return {x:can.pos.x,y:can.pos.y,id:can.id}}))
    }
    global.heap.newScoutData = true;

}

//Get calculated tile distance across rooms
global.getTileDistance = function getTileDistance(pos1, pos2) {
    const ROOM_SIZE = 50;
    let posX;
    let posY;
    //Just do basic calculation if in the same room
    if (pos1.roomName === pos2.roomName) {
         posX = pos2.x - pos1.x;
         posY = pos2.y - pos1.y;
        return Math.sqrt(posX * posX + posY * posY);
    }
    const coord1 = parseRoomName(pos1.roomName);
    const coord2 = parseRoomName(pos2.roomName);
    

    const roomDeltaX = (coord2.x - coord1.x) * ROOM_SIZE;
    const roomDeltaY = (coord2.y - coord1.y) * ROOM_SIZE;

    posX = pos2.x + roomDeltaX - pos1.x;
    posY = pos2.y + roomDeltaY - pos1.y;

    return Math.sqrt(posX * posX + posY * posY);
}

//Parse room names into a world coordinate system
global.parseRoomName = function parseRoomName(roomName) {
    const coord = { x: 0, y: 0 };
    const match = /([EW])(\d+)([NS])(\d+)/.exec(roomName);

    if (match) {
        coord.x = parseInt(match[2], 10) * (match[1] === 'E' ? 1 : -1);
        coord.y = parseInt(match[4], 10) * (match[3] === 'N' ? 1 : -1);
    }

    return coord;
}

global.spawnCreep = function spawnCreep(role,body,fief,sev=50,memory = {}){
    if(!Array.isArray(body)) body = parseBody(body)
    memory.role = role
    memory.fief = fief || Memory.kingdom.fiefs[Math.floor(Math.random() * Memory.kingdom.fiefs.length)]
    let plan = {
        sev:sev,
        body:body,
        hardSpawn:true,
        memory:memory
        }
    if(!Memory.hardSpawns) Memory.hardSpawns = {};
    if(!Memory.hardSpawns[fief]) Memory.hardSpawns[fief] = []; 
    Memory.hardSpawns[fief].push(plan)
}

global.parseBody = function parseBody(bodyString){
    const bodyParts = [];
    const regex = /(\d+)([a-z]+)/gi; // Match a number followed by one or more letters
    const partMap = {
        'w': WORK,
        'h': HEAL,
        'm': MOVE,
        'r': RANGED_ATTACK,
        't': TOUGH,
        'c': CARRY,
        'a': ATTACK,
        'p': CLAIM
    };
    if (/^[a-z]+$/i.test(bodyString)) {
        // Map each letter to its corresponding body part and add to the array
        const parts = bodyString.toLowerCase().split('').map(char => partMap[char]);
        bodyParts.push(...parts);
        return bodyParts;
    }
    let match;
    while((match = regex.exec(bodyString)) !== null) {
        const count = parseInt(match[1]); // Get the number of repetitions
        const partSequence = match[2].toLowerCase().split(''); // Split the sequence of letters
        
        // Collect the body parts for the sequence
        const parts = partSequence.map(char => partMap[char]);
        
        // Repeat the entire sequence 'count' times
        for (let i = 0; i < count; i++) {
            bodyParts.push(...parts);
        }
    }
    return bodyParts;
}

global.describeRoom = function describeRoom(name){
    const [EW, NS] = name.match(/\d+/g)
	if (EW%10 == 0 && NS%10 == 0) {
		return ROOM_CROSSROAD
	}
  	else if (EW%10 == 0 || NS%10 == 0) {
		return ROOM_HIGHWAY
	}
	else if (EW%5 == 0 && NS%5 == 0) {
		return ROOM_CENTER
	}
	else if (Math.abs(5 - EW%10) <= 1 && Math.abs(5 - NS%10) <= 1) {
		return ROOM_SOURCE_KEEPER
	}
	else {
		return ROOM_STANDARD
	}
}
