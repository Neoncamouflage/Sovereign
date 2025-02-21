const registry = require('registry');
const supplyDemand = require('supplyDemand');
const helper = require('functions.helper');


//Functions for a random integer(inclusive) and random array selection
global.randomInt = function(max) {
    return Math.floor(Math.random() * (max + 1));
};
global.randomChoice = function(array) {
    return array[Math.floor(Math.random() * array.length)];
};

//Update diplomacy
global.setDiplomacy = function(type,username){
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

global.isMe = function(target){
    return target.toLowerCase() == Memory.me.toLowerCase()
}

global.getDiplomacy = function(username){
    for (let [type,members] of Object.entries(Memory.diplomacy)){
        //console.log("Type",type,'Members',members)
        //Continue if we're not looking at one of the member lists
        if(!['allies','ceasefire','outlaws'].includes(type)){
            //console.log("Not valid, skip")
            continue;

        }
        //If they're on one of the lists, return their status
        if(members.includes(username)) return type;
    }
    //Not on any list, return neutral
    return 'neutral';
}

global.isFriend = function(target){
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
        if(target == 'me' || isMe(target)) return true;
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

global.removeScoutData = function(roomName){
    if(global.heap && global.heap.scoutData && global.heap.scoutData[roomName]) delete global.heap.scoutData[roomName];
}
//Scout Data Getter and Setter - Single is an optional string for a specific property
global.getScoutData = function(roomName=false){
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
global.setScoutData = function(room,data={},force=false){
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
global.getTileDistance = function(pos1, pos2) {
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
global.parseRoomName = function(roomName) {
    const coord = { x: 0, y: 0 };
    const match = /([EW])(\d+)([NS])(\d+)/.exec(roomName);

    if (match) {
        coord.x = parseInt(match[2], 10) * (match[1] === 'E' ? 1 : -1);
        coord.y = parseInt(match[4], 10) * (match[3] === 'N' ? 1 : -1);
    }

    return coord;
}

global.spawnCreep = function(role,body,fief,sev=50,memory = {}){
    //More robust sawning function needed at some point, to accept quick spawns and full detailed ones
    //let opts = {};
    //If string, get room name
    //if (typeof args === 'string' || args instanceof String){

    //}

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

global.isExit = function(spot){
    if(spot.x % 49 && spot.y % 49)return false;
    return true;
}

global.parseBody = function(bodyString){
    // '2W2M' => WORK,WORK,MOVE,MOVE
    // '2WM'  => WORK,MOVE,WORK,MOVE
    const bodyParts = [];
    const regex = /(\d+)([a-z]+)/gi;
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
    let match;
    if (/^[a-z]+$/i.test(bodyString)) {
        const parts = bodyString.toLowerCase().split('').map(char => partMap[char]);
        bodyParts.push(...parts);
        return bodyParts;
    }
    while((match = regex.exec(bodyString)) !== null) {
        const count = parseInt(match[1]);
        const partSequence = match[2].toLowerCase().split('');
        const parts = partSequence.map(char => partMap[char]);
        for (let i = 0; i < count; i++) {
            bodyParts.push(...parts);
        }
    }
    return bodyParts;
}

global.describeRoom = function(name){
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

global.convertStructure = function convertStructure(structure){
    //console.log("Converting",structure,'LEN',structure.length)
    if(structure.length == 1){
        return Memory.structureFromNumReference[structure];
    }
    return Memory.structureToNumReference[structure]
}

global.BigCostMatrix = function() {
    this._bits = new Uint16Array(2500);
};

BigCostMatrix.prototype.set = function(xx, yy, val) {
    xx = xx|0;
    yy = yy|0;
    this._bits[xx * 50 + yy] = Math.min(Math.max(0, val), 65535);
};

BigCostMatrix.prototype.get = function(xx, yy) {
    xx = xx|0;
    yy = yy|0;
    return this._bits[xx * 50 + yy];
};

BigCostMatrix.prototype.serialize = function(){
    let out = "";
    const bits = this._bits;
    const len = bits.length;
    let i = 0;
    while (i < len) {
        const value = bits[i];
        let run = 1;
        while (i + run < len && bits[i + run] === value) {
            run++;
        }
        if (run === 1) {
            //For a run of 1, simply output the value.
            //No flag is set the top bit remains clear
            out += String.fromCharCode(value);
        } else {
            //For runs longer than 1, set the flag bit in the value, then output the run length in the following character.
            out += String.fromCharCode(value | FLAG_MASK) + String.fromCharCode(run);
        }
        i += run;
    }
    return out;
};

BigCostMatrix.deserialize = function(serializedStr) {
    const matrix = new BigCostMatrix();
    const bits = matrix._bits;
    let idx = 0;
    for (let i = 0; i < serializedStr.length; i++) {
        const charCode = serializedStr.charCodeAt(i);
        if (charCode & FLAG_MASK) {
            //If the top bit is set, then this character is a flagged value.
            //Clear the flag to obtain the actual value.
            const value = charCode & ~FLAG_MASK;
            //The next character contains the run length.
            const run = serializedStr.charCodeAt(++i);
            for (let j = 0; j < run; j++) {
                bits[idx++] = value;
            }
        } else {
            //If the top bit is not set, it's a singleton value.
            bits[idx++] = charCode;
        }
    }
    return matrix;
};

global.bigTest = function(){
    let cp1 = Game.cpu.getUsed();
    let g = helper.getTowerMap(Game.rooms.E6S1);
    let cp2 = Game.cpu.getUsed();
    let l = g.serialize();
    g = BigCostMatrix.deserialize(l);
    let cp3 = Game.cpu.getUsed();
    console.log("TEST RESULTS!")
    console.log("Tower map CPU:",cp2-cp1,"Serialize/Deserialize CPU:",cp3-cp2)
}

global.getDistance = function(pos1,pos2){
    let route = PathFinder.search(pos1,{pos:pos2,range:1},{
        maxOps:20000,
        maxRooms:64,
        roomCallback: function(roomName) {
      
            let room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix;    
            if (room){
              room.find(FIND_STRUCTURES).forEach(function(struct) {
                  if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                  } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !struct.my)) {
                    costs.set(struct.pos.x, struct.pos.y, 255);
                  }
                });
            }
            return costs;
          },
    });
    let dist = route.path.length;
    let incomp = route.incomplete;
    return [dist,incomp]
}

global.purgeOldScoutData = function(amt = 20000){
    let data = global.heap && global.heap.scoutData;
    if(!data) return false;
    for(let [room,roomData] of Object.entries(getScoutData())){
        if(Game.time - roomData.lastRecord > amt) removeScoutData(room)
    }
    RawMemory.segments[SEGMENT_SCOUT_DATA] = JSON.stringify(global.heap.scoutData)
    global.heap.newScoutData = false;
}

global.addHolding = function(room,standby=false,homeRoom=null){
    //Reject if I've screwed up and set a fief or doubled up a holding
    if(Memory.kingdom.fiefs[room] || Memory.kingdom.holdings[room]) return -1;
    let pick;
    let pickNum = 99;
    //If no homeroom provided, loop through fiefs and find the closest room. Linear should generally work.
    if(homeRoom == null){
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            let dist = Game.map.getRoomLinearDistance(room, fief);
            if(dist < pickNum){
                pick = fief;
                pickNum = dist;
            }
        });
        Memory.kingdom.holdings[room] = {homeRoom:pick,standby:standby};
    }else{
        //Else use the homeroom provided
        Memory.kingdom.holdings[room] = {homeRoom:homeRoom,standby:standby};
    }
    
}
global.standby = function(holding){
    //Flip standby flag
    Memory.kingdom.holdings[holding].standby = !Memory.kingdom.holdings[holding].standby
    //Clear spawn queue of homeroom to remove holding creeps
    clearQueue(Memory.kingdom.holdings[holding].homeRoom);
}
global.clearQueue = function(room='all'){
    if(room == 'all'){
        Object.keys(Memory.kingdom.fiefs).forEach(fief =>{
            Memory.kingdom.fiefs[fief].spawnQueue = {};
        });
    }else{
        Memory.kingdom.fiefs[room].spawnQueue = {};
    }
}