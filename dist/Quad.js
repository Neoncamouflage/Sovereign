const helper = require('functions.helper');
const registry = require('registry');
const chronicle = require('./chronicle');
// --States--
//Forming - Form up creeps after spawning, convoying, or being broken
//Idle    - Waiting for direction
//Convoy  - Train formed to travel. p4>p3>p2>p1
//Attack  - Target creeps
//Siege   - Target room
const POSITIONS = {
    p1:{x:0,y:0},
    p2:{x:1,y:0},
    p3:{x:1,y:1},
    p4:{x:0,y:1},
}
let letters = ['𒉌','𒅗','𒍟','𒋲','𒋞','𒋘','𒉼','𒉽','𒉛','𒉃','𒈰','𒈞','𒈓','𒈔','𒈖','𒇸','𒆕','𒅐','𒅒','𒅅',
    '𒂡','𒁹','𒀸','𒀹','𒀺','𒀀','𒀃','𒋀','𒋦','𒋨','𒋧'];
const SAYREF = {
    default:['𒅒','𒈔','𒅄','𒍟','𒋲'],
    convoy:['𒋞','𒈞'],
    attack:['𒋧','𒋦','𒋨']
}
function Quad(details={}){
    this.name = helper.getWarName();
    this.lastRange = 99;
    this.p1 = details.p1;
    this.p2 = details.p2;
    this.p3 = details.p3;
    this.p4 = details.p4;
    this.targetRoom = details.targetRoom;
    this.state = 'startup';
    this.fief = details.fief || Object.keys(Memory.kingdom.fiefs)[0];
    heap.quads[this.name] = this;
}
Quad.prototype.toString = function() {
    return `[quad ${this.name}]`;
};

//Assign creep to the quad. Used by kingdomManager when sorting creeps
Quad.prototype.addCreep = function(creep) {
    let original = creep
    if(!(creep instanceof Creep)) creep = Game.getObjectById(creep);
    if(!creep){
        chronicle.log(`Failed to add creep ${original}.`,this,1)
    }
    let current = [this.p1,this.p2,this.p3,this.p4]
    if(current.includes(creep.id)){
        return false;
    }

    if(!Game.getObjectById(this.p1)){this.p1 = creep.id;}
    else if(!Game.getObjectById(this.p2))this.p2 = creep.id;
    else if(!Game.getObjectById(this.p3))this.p3 = creep.id;
    else if(!Game.getObjectById(this.p4))this.p4 = creep.id;
    else{
        return false;
    }
    creep.memory.quadReserved = this.name;
    return true;
};

Quad.prototype.release = function(){
    delete heap.quads[this.name]
}

Quad.prototype.run = function() {
    //console.log(JSON.stringify(this))
    let creeps = {p1:null,p2:null,p3:null,p4:null}
    let liveCreeps = 0
    for(let quadPos of Object.keys(creeps)){
        let crp = this[quadPos] && Game.getObjectById(this[quadPos]);
        if(!crp && this.state != 'startup'){
            //Dead creep after startup means we've broken
            this.release();
            return;
        }
        else if(crp){
            liveCreeps++;
            creeps[quadPos] = crp;
        }
    }

    //console.log("Live length",liveCreeps.length)
    //If we have missing creeps and we're not in initial startup
    /*if(liveCreeps.length < 4 && this.state != 'startup'){
        for(let creep of liveCreeps){
            creep.memory.role = 'skirmisher'
        }
        //Remove quad
        delete heap.quads[this.name]
        return;
    }
    //If less than 4 in startup, submit spawn request to fief
    else if(liveCreeps.length < 4 && this.state == 'startup'){
        let creepsNeeded = 4-liveCreeps.length;
        //Pick up any creeps available
        //console.log("Res length",heap.army.reserve.length)
        for(let crp of heap.army.quads){
            crp = Game.getObjectById(crp);
            //console.log("Checking crp",crp.room.name == this.fief,['man-at-arms','skirmisher'].includes(crp.memory.role))
            this.addCreep(crp);
            heap.army.reserve = heap.army.reserve.filter(resID => resID != crp.id);
            crp.memory.quadReserved = this.name;
            chronicle.log(`Assigning ${crp.name} from reserves.`,this,3);
            creepsNeeded--;
            
            if(creepsNeeded == 0)break;
        }
        if(Game.time % 3 == 0 && creepsNeeded){
            chronicle.log(`Requesting ${creepsNeeded} creeps.`,this,3);
            for(let i=0;i<creepsNeeded;i++){
                registry.requestCreep({sev:60,memory:{role:'man-at-arms',fief:this.fief,status:'spawning',preflight:false,quadReserved:this.name}})
            }
        }

    }
    else */

    if(liveCreeps == 4 && this.state == 'startup'){
        chronicle.log(`Quad has all creeps, forming up.`,this,3);
        this.state = 'forming'
    }
    else if(this.state == 'startup') return;
    
    if(this.state == 'forming')formUp(this)
    //If fief is still forming then we wait
    if(this.state == 'forming')return;

    //If sitting idle, get the next action. Hostile creeps/structures pulled now
    let room = creeps.p1.room;
    let hostileStructs = room.find(FIND_HOSTILE_STRUCTURES).filter(str => !isFriend(str) && ![STRUCTURE_POWER_BANK,STRUCTURE_CONTROLLER,STRUCTURE_INVADER_CORE].includes(str.structureType));
    let hostileCreeps = room.find(FIND_HOSTILE_CREEPS).filter(crp => !isFriend(crp));
    if(this.state == 'idle')setAction(this,creeps,hostileCreeps,hostileStructs);
    if(this.state == 'convoy')runConvoy(this,creeps,hostileCreeps,hostileStructs);
    if(this.state == 'attack')runAttack(this,creeps,hostileCreeps,hostileStructs);
    if(this.state == 'siege')runSiege(this,creeps,hostileCreeps,hostileStructs);

    quadSay(this,creeps);
};

function runAttack(quad,creeps,hostileCreeps,hostileStructs){
    //If no tower map or moveCM for this room, get it
    if(!quad.roomData || !quad.roomData.towerMap || !quad.roomData.moveCM || !quad.roomData.roomName != creeps.p1.room.name){
        quad.roomData = {
            towerMap:      getTowerMap(creeps.p1.room),
            roomName: creeps.p1.room.name,
            moveCM:   getMoveCM(creeps.p1.room)
        }
    }
    if(!hostileCreeps.length && !hostileStructs.length){
        quad.state = 'idle'
        return;
    }
    let hostileStats = getCombatStats(hostileCreeps);
    let quadStats = getCombatStats(Object.values(creeps));
    let damageMap = getDamageMap(hostileCreeps,hostileStats, quad.roomData.towerMap);
    let peakIncomingDamage = Object.values(creeps).reduce((sum,creep) => sum+(damageMap.get(creep.pos.x,creep.pos.y)));
    let keyStructs = hostileStructs.filter(str=>[STRUCTURE_TOWER,STRUCTURE_SPAWN,STRUCTURE_TERMINAL].includes(str.structureType))
    let soldiers = hostileCreeps.filter(crp => helper.isSoldier(crp))
    let flee = false;
    let totalRanged = 0;
    let totalHeal = 0;
    let totalAttack = 0;
    let totalDemo = 0;
    let closestRange = 99;
    let primary;
    let closestEnemy = {};
    for(let each of Object.values(creeps)){
        closestEnemy[each.id] = each.pos.findClosestByRange(hostileCreeps);
        let foundRange = each.pos.getRangeTo(closestEnemy[each.id]);
        if(closestRange < foundRange || !primary){
            closestRange = foundRange;
            primary = closestEnemy[each.id];
        }
    }
    if(!primary && keyStructs.length){
        for(let each of Object.values(creeps)){
            closestEnemy[each.id] = each.pos.findClosestByRange(keyStructs);
            let foundRange = each.pos.getRangeTo(closestEnemy[each.id]);
            if(closestRange < foundRange || !primary){
                closestRange = foundRange;
                primary = closestEnemy[each.id];
            }
        }
    }
    else if(!primary && soldiers.length){
        for(let each of Object.values(creeps)){
            closestEnemy[each.id] = each.pos.findClosestByRange(soldiers);
            let foundRange = each.pos.getRangeTo(closestEnemy[each.id]);
            if(closestRange < foundRange || !primary){
                closestRange = foundRange;
                primary = closestEnemy[each.id];
            }
        }
    }
    else if(!primary && hostileStructs.length){
        for(let each of Object.values(creeps)){
            closestEnemy[each.id] = each.pos.findClosestByRange(hostileStructs);
            let foundRange = each.pos.getRangeTo(closestEnemy[each.id]);
            if(closestRange < foundRange || !primary){
                closestRange = foundRange;
                primary = closestEnemy[each.id];
            }
        }
    }
    //Find out if we're good to move closer. Range greater than 2, or greater than 1 if they aren't moving towards us
    let goodMove = closestRange > 1 && (closestRange > 2 || quad.lastRange <= closestRange)
    //Confirm we're still in good position
    if(!(creeps.p1.pos.isNearTo(creeps.p2) && creeps.p1.pos.isNearTo(creeps.p3) && creeps.p1.pos.isNearTo(creeps.p4))){
        goodMove = false;
        formUp(quad);
    }
    quad.lastRange = quad.closestRange;
    //Figure out if we're using ranged or melee tactics
    for(let each of Object.values(quadStats)){
        totalRanged += each.rangedAttack;
        totalHeal += each.heal;
        totalAttack += each.attack;
        totalDemo += each.dismantle;
    }
    //Get potential heal for each hostile in range
    if(peakIncomingDamage > totalHeal) flee = true;
    if(flee){
        //BFS search for survivable damage
        let targetPos;
        let origin = creeps.p1.pos
        const visited = new Set();
        visited.add(`${origin.x},${origin.y}`);
        const queue = [{ x: origin.x, y: origin.y, dist: 0 }];
        const directions = [
            { dx: -1, dy:  0 },
            { dx:  1, dy:  0 },
            { dx:  0, dy: -1 },
            { dx:  0, dy:  1 },
            { dx: -1, dy: -1 },
            { dx:  1, dy: -1 },
            { dx: -1, dy:  1 },
            { dx:  1, dy:  1 },
        ];
        while (queue.length > 0) {
            const { x, y, dist } = queue.shift();
            //Looking for a spot that's not unwalkable for a quad and has lower damage
            if (quad.roomData.moveCM.get(x, y) != 255 && damageMap < totalHeal && ![0,49].includes(x) && ![0,49].includes(y)) {
                targetPos = new RoomPosition(x,y,creeps.p1.room.name)
            }
            for(let { dx, dy } of directions) {
            const newX = x + dx;
            const newY = y + dy;
            const key = `${newX},${newY}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push({ x: newX, y: newY, dist: dist + 1 });
            }
            }
        }

        if(targetPos){
            quad.subState = 'flee'
            quadMove(quad,creeps,hostileCreeps,targetPos);
        }
        else{
            quad.subState = 'cantFlee'
        }
    }

    else if(hostileCreeps.length || hostileStructs.length){
        let squad = Object.values(creeps);
        //console.log(quad,creeps,hostileCreeps,closest.pos)

        //Every 4 ticks, recalculate where we should be
        //if(trueGame.time % 4 == 0){
        let newPositions = optimizePositions(creeps,hostileCreeps,hostileStructs,quadStats);
        let needsShuffle = false;
        //Get current positions in a format that matches new
        let currentPositions = {};
        for(let position in creeps) {
            currentPositions[creeps[position].id] = position;
        }
        for(let assignment of newPositions) {
            let currentPosition = currentPositions[assignment.creepId];
            if (currentPosition !== assignment.position) {
                needsShuffle = true;
                break;
            }
        }
        if(needsShuffle){
            console.log("Shuffling!",JSON.stringify(newPositions))
            quad.formPos = creeps[p1].pos
            shuffle(quad,newPositions)
        }
        else if(goodMove){
            quadMove(quad,creeps,hostileCreeps,primary.pos);
        }
        //}
        //else if(goodMove){
            //quadMove(quad,creeps,hostileCreeps,primary.pos);
        //}
        let roomData = getScoutData(creeps.p1.room.name)
        //Siege vs field combat
        //Siege combat if we're in an enemy fief, prioritizing destroying their spawns
        if(roomData && roomData.roomType == 'fief' && roomData.ownerType == 'enemy'){
            let injured = squad.filter(crp => crp.hits < crp.hitsMax);
            injured.sort((a,b) => a.hits - b.hits)
            for(let each of squad){
                let closest = closestEnemy[each.id];
                if(each.pos.isNearTo(closest)){
                    if(quadStats[each.id].attack>quadStats[each.id].rangedMassAttack){
                        each.attack();
                    }
                    else{
                        if(injured.length)each.heal(randomChoice(injured))
                        else each.heal(randomChoice(squad));
                        each.rangedMassAttack();
                    }
                }
                else{
                    each.rangedAttack(closest);
                    if(injured.length)each.heal(randomChoice(injured))
                    else each.heal(randomChoice(squad));
                }
            }

        }
        //Field combat if we're not
        else{
            let injured = squad.filter(crp => crp.hits < crp.hitsMax);
            injured.sort((a,b) => a.hits - b.hits)
            for(let each of squad){
                let closest = closestEnemy[each.id];
                if(each.pos.isNearTo(closest)){
                    if(quadStats[each.id].attack>quadStats[each.id].rangedMassAttack){
                        each.attack();
                    }
                    else{
                        if(injured.length)each.heal(randomChoice(injured))
                        else each.heal(randomChoice(squad));
                        each.rangedMassAttack();
                    }
                }
                else{
                    each.rangedAttack(closest);
                    if(injured.length)each.heal(randomChoice(injured))
                    else each.heal(randomChoice(squad));
                }
            }
        }


    }
    else if(!hostileCreeps.length && !hostileStructs.length){
        quad.state = 'idle'
    }

}

//Travel mode
function runConvoy(quad,creeps,hostileCreeps,hostileStructs){
    const LOOP_ORDER = ['p4', 'p3', 'p2'];
    const FOLLOWS = {
        'p4':'p3',
        'p3':'p2',
        'p2':'p1'
    }
    let goodCount = 0;
    let targetPos = new RoomPosition(25,25,quad.targetRoom);
    //If P1 made it to the target room, switch to formation
    if(creeps.p1.room.name == quad.targetRoom){
        //console.log("Convoy over, forming up")
        quad.state = 'forming';
        quad.formPos = getFormPos(quad)
        formUp(quad)
        return;
    }
    for(let quadPos of LOOP_ORDER){
        //Get each creep and the one it follows
        let creep = creeps[quadPos]
        let following = creeps[FOLLOWS[quadPos]]
        //Use move() if close enough as it costs less CPU
       // console.log("Moving",quadPos)
        if(creep.pos.getRangeTo(following) <= 1){
            creep.move(following);
        }
        else{
            creep.travelTo(following,{priority:1});
        }
        //If the next creep is further than 1 step away and isn't on a room edge, we break to catch up
        if(creep.pos.getRangeTo(following) > 1 && (![0,49].includes(following.pos.x) && ![0,49].includes(following.pos.y))){
            //console.log("Next creep too far")
            break;
        }
        //If this creep is tired, we break because it won't be able to move
        else if(creep.fatigue){
            break;
        }
        //If we didn't break, increase the count and move to the next creep
        goodCount++;
    }
    //If we have 3 good creeps, that means the full chain is ready, and the lead creep can move as well
    if(goodCount == 3){
        creeps.p1.travelTo(targetPos,{range:25,priority:1})
    }
}

//Decide what action will be taken from an idle state
function setAction(quad,creeps,hostileCreeps,hostileStructs){
    if(!quad.targetRoom || quad.targetRoom ==creeps.p1.room.name){
        let roomData = getScoutData(creeps.p1.room.name);
        if(roomData.type == 'fief' && roomData.ownerType == 'enemy') quad.state = 'siege';
        else if(hostileCreeps.length || hostileStructs.length) quad.state = 'attack';
        else quad.state = 'idle';
    }
    else{
        quad.state = 'convoy';
    }
}
function shuffle(quad,newPositions){
    let origin = Game.getObjectById(quad.p1).pos
    console.log("Origin position:",origin)
    for(let newPos of Object.keys(newPositions)){
        let creep = Game.getObjectById(newPositions[newPos]);
        console.log("Moving creep to",newPos)
        creep.move(origin.x+POSITIONS[newPos].x,origin.y+POSITIONS[newPos].y)
    }
}

//Form up creeps based on quad structure
function formUp(quad,shuffle){
    let creeps = {p1:Game.getObjectById(quad.p1),p2:Game.getObjectById(quad.p2),p3:Game.getObjectById(quad.p3),p4:Game.getObjectById(quad.p4)};
    let stillForming = false;
    if(!quad.formPos)quad.formPos = getFormPos(quad);
    //console.log("FORMPOS",JSON.stringify(quad.formPos))
    for(let quadPos of Object.keys(creeps)){
        let creep = creeps[quadPos];
        //console.log("Creep",creep,'position',quadPos,'forming up at',JSON.stringify(quad.formPos))
        if(!creep){
            stillForming = true;
            continue;
        }
        let targetX = quad.formPos.x+POSITIONS[quadPos].x;
        let targetY = quad.formPos.y+POSITIONS[quadPos].y
        if(!creep.pos.isEqualTo(targetX,targetY)){
            //If the position is default due to no vision, use range 25 or get a better spot if we now have vision
            //console.log("FORMPOS2",targetX,targetY,JSON.stringify(quad.formPos))
            if(quad.formPos.noVis && Game.rooms[quad.formPos.roomName]){
                //console.log("FORMNOVIS",targetX,targetY,JSON.stringify(quad.formPos))
                quad.formPos = getFormPos(quad);
                creep.travelTo(new RoomPosition(targetX,targetY,quad.formPos.roomName),{priority:1});
            }
            else{
                //console.log("FORM",targetX,targetY,JSON.stringify(quad.formPos))
                creep.travelTo(new RoomPosition(targetX,targetY,quad.formPos.roomName),{priority:1,range:quad.formPos.noVis ? 25 : 0});
            }
            stillForming = true;
        }
    }
    //Quad changes to idle state from forming if finished, otherwise is left as it was
    if(!stillForming && quad.state == 'forming') quad.state ='idle'
    
}

function getFormPos(quad){
    //Formation room is the designated form room, or the fief, and finally need a good default option at some point
    let formRoom;
    let formPosition = {};
    let distances;
    //If there's no creep1 to form up around, pick the middle;
    if(!quad.p1){
        formRoom = quad.fief || quad.targetRoom;
        formPosition = {x:25,y:25,roomName:formRoom,noVis:true}
    }
    else{
        let origin = quad.p1;
        if(!(origin instanceof Creep)) origin = Game.getObjectById(quad.p1);
        if(!origin) console.log("NOT A CREEP",origin,quad.p1)
        formRoom = origin.room.name;    
        distances = findSpots();

        formPosition = getFormPosition(distances,origin.pos)
        formPosition.roomName = formRoom;
    }

    function getFormPosition(distCM,origin){
        // Starting point: creep's current position
        const startX = origin.x
        const startY = origin.y
        const minVal = 4;
        // Use a set to track visited positions (using "x,y" as a key)
        const visited = new Set();
        visited.add(`${startX},${startY}`);
        
        // The BFS queue holds objects with x, y, and current distance (or "layer")
        const queue = [{ x: startX, y: startY, dist: 0 }];

        // Define the neighbor directions (4-directional; add diagonals if needed)
        const directions = [
            { dx: -1, dy:  0 },
            { dx:  1, dy:  0 },
            { dx:  0, dy: -1 },
            { dx:  0, dy:  1 },
            { dx: -1, dy: -1 },
            { dx:  1, dy: -1 },
            { dx: -1, dy:  1 },
            { dx:  1, dy:  1 },
        ];

        while (queue.length > 0) {
            const { x, y, dist } = queue.shift();

            // Check if this cell meets the condition
            if (distCM.get(x, y) >= minVal && x>1 && x<48 &&  y>1 && y<48) {
            return { x, y, dist };
            }

            // Add neighboring positions to the queue
            for(let { dx, dy } of directions) {
            const newX = x + dx;
            const newY = y + dy;
            const key = `${newX},${newY}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push({ x: newX, y: newY, dist: dist + 1 });
            }
            }
        }
        
        // Return null if no valid cell is found
        console.log("NO VALID POINT")
        return null;
    }

    function findSpots(){
        let isFief = Memory.kingdom.fiefs[formRoom];
        let checkCM = isFief ? PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[formRoom].costMatrix) : false;
        let obstacles = Game.rooms[formRoom] ? Game.rooms[formRoom].find(FIND_STRUCTURES).filter(str => OBSTACLE_OBJECT_TYPES.includes(str.structureType)) : [];
        let terrain = Game.map.getRoomTerrain(formRoom);
        let distCM = new PathFinder.CostMatrix;
        let openSpots = [];
        //Loop through every x,y coordinate and mark all floor tiles with an initial high distance of 255 unless it's a terrain wall
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                const tile = terrain.get(x, y);
                if(tile != TERRAIN_MASK_WALL){
                    distCM.set(x, y, 255);
                }
                //If the form room is a fief, check the cost matrix so we don't form up on a road
                if(isFief && checkCM){
                    if(checkCM.get(x,y) == 1){
                        distCM.set(x,y,255)
                        distCM.set(x-1,y,255)
                        distCM.set(x,y-1,255)
                        distCM.set(x-1,y-1,255)
                    }
                }
            }
        }
        for(let obs of obstacles){
            distCM.set(obs.pos.x,obs.pos.y,0)
        }
        //Initialize variables
        let bottom;
        let right;
        let bottomright;
        let value;
        for (x = 49; x >= 0; x -= 1) {
            for (y = 49; y >= 0; y -= 1) {
                //Get bottom and right tile distance
                bottom = distCM.get(x, y + 1);
                right = distCM.get(x + 1, y);
                bottomright = distCM.get(x + 1, y + 1);
                value = Math.min(Math.min(bottom, right, bottomright) + 1, distCM.get(x, y));
                //Set either the current value of the tile or 1 larger than the top or left, whichever is smaller
                distCM.set(x, y, value);
            }
        }
        return distCM
    }

    if(distances)Memory.test.testCM = distances.serialize();
    return formPosition;
}

function getMoveCM(room){
    let moveCM = new PathFinder.CostMatrix;
    let terrain = Game.map.getRoomTerrain(room.name)
    for(let y = 0; y < 50; y++) {
        for(let x = 0; x < 50; x++) {
            const tile = terrain.get(x, y);
            if(tile == TERRAIN_MASK_WALL || x==49 || y==49){                   //In progress
                moveCM.set(x, y, 255);
                if(x>0){moveCM.set(x-1, y, 255)}
                if(y>0){moveCM.set(x, y-1, 255)}
                if(x>0 && y>0){moveCM.set(x-1, y-1, 255)}
            }
            else if(tile == TERRAIN_MASK_SWAMP){
                moveCM.set(x, y, 255);
                if(x>0 && terrain.get(x-1, y) != TERRAIN_MASK_WALL){moveCM.set(x-1, y, 5)}
                if(y>0 && terrain.get(x, y-1) != TERRAIN_MASK_WALL){moveCM.set(x, y-1, 5)}
                if(x>0 && y>0 && terrain.get(x-1, y-1) != TERRAIN_MASK_WALL){moveCM.set(x-1, y-1, 5)}
            }
            else if(x == 49){
                moveCM.set(x, y, 255);
                if(y>0 && terrain.get(x-1, y) != TERRAIN_MASK_WALL){moveCM.set(x, y-1, 255)}
                if(y>0 && terrain.get(x-1, y-1) != TERRAIN_MASK_WALL){moveCM.set(x-1, y-1, 255)}
            }
        }
    }
    Memory.test.testCM = moveCM.serialize()
    return moveCM;
    
}

function quadMove(quad,creeps,hostileCreeps,targetPos,range){
    let fatigued = Object.values(creeps).filter(c=>c.fatigue)
    if(fatigued.length)return;
    let search = PathFinder.search(creeps.p1.pos,{pos:targetPos,range:range || 0},
    {
        plainCost:1,
        swampCost:5,
        maxRooms:1,
        roomCallback: function(roomName){
            let room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix;

            if(roomName == creeps.p1.room.name){
                costs = quad.roomData.moveCM.clone();
            }
            else if(room){
                let blocks = room.find(FIND_STRUCTURES).filter(str => OBSTACLE_OBJECT_TYPES.includes(str.structureType))
                for(let each of blocks){
                    costs.set(each.pos.x,each.pos.y,255)
                    if(x>0){costs.set(x-1, y, 255)}
                    if(y>0){costs.set(x, y-1, 255)}
                    if(x>0 && y>0){costs.set(x-1, y-1, 255)}
                }
            }
            for(let each of hostileCreeps){
                costs.set(each.pos.x,each.pos.y,255);
                if(x>0){costs.set(x-1, y, 255)}
                if(y>0){costs.set(x, y-1, 255)}
                if(x>0 && y>0){costs.set(x-1, y-1, 255)}
            }
            return costs;
        }
    }
    );
    let nextDir = creeps.p1.pos.getDirectionTo(search.path[0]);
    for(let creep of Object.values(creeps)){
        creep.move(nextDir)
    }
}

function optimizePositions(creeps, hostileCreeps, hostileStructs, scores) {  
    const positions = ['p1', 'p2', 'p3', 'p4'];
    const creepIds = Object.keys(creeps).map(pos => creeps[pos].id);
    const scoreMatrix = {};
    const positionTargets = {
        p1:{1:{creeps:0,structs:0},2:{creeps:0,structs:0},3:{creeps:0,structs:0}},
        p2:{1:{creeps:0,structs:0},2:{creeps:0,structs:0},3:{creeps:0,structs:0}},
        p3:{1:{creeps:0,structs:0},2:{creeps:0,structs:0},3:{creeps:0,structs:0}},
        p4:{1:{creeps:0,structs:0},2:{creeps:0,structs:0},3:{creeps:0,structs:0}},
    }
    //Get initial ranges to targets for each position
    for(let quadPos of Object.keys(creeps)){
        let creep = creeps[quadPos];
        let targets = positionTargets[quadPos];
        for(let each of hostileCreeps){
            let range = creep.pos.getRangeTo(each);
            if(range <= 3)targets[range].creeps++
        }
        for(let each of hostileStructs){
            let range = creep.pos.getRangeTo(each);
            if(range <= 3)targets[range].structs++
        }
    }

    for(let creepId of creepIds) {
        let damageScores = scores[creepId];
        scoreMatrix[creepId] = {};
        
        for(let position of positions) {
            let totalScore = 0;
            let targets = positionTargets[position];
            

            if (damageScores.attack > 0) {
                totalScore += damageScores.attack * Math.min(1,targets[1].creeps + targets[1].structs);
            }
            
            if (damageScores.rangedAttack > 0) {
                totalScore += damageScores.rangedAttack * Math.min(1,(
                    targets[1].creeps + targets[1].structs +
                    targets[2].creeps + targets[2].structs +
                    targets[3].creeps + targets[3].structs
                ));
            }
            
            if (damageScores.rangedMassAttack > 0) {
                totalScore += damageScores.rangedMassAttack * (
                    (targets[1].creeps + targets[1].structs) * 10 +  //10 damage at range 1
                    (targets[2].creeps + targets[2].structs) * 4 +   //4 damage at range 2
                    (targets[3].creeps + targets[3].structs) * 1     //1 damage at range 3
                );
            }
            
            if (damageScores.heal > 0 || damageScores.rangedHeal > 0) {
                //Allied creeps that need healing? Maybe use later
            }
            
            if (damageScores.dismantle > 0) {
                totalScore += Math.min(1,damageScores.dismantle * targets[1].structs);
            }
            
            // Store the total score for this creep in this position
            scoreMatrix[creepId][position] = totalScore;
        }
    }
    
    const QUAD_PERMUTATIONS = [
        [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
        [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
        [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
        [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0]
      ];
      
      let bestScore = -Infinity;
      let bestArrangement = null;
      
      for (const perm of QUAD_PERMUTATIONS) {
        let totalScore = 0;
        for(let i = 0; i < 4; i++) {
          const creepId = creepIds[perm[i]];
          totalScore += scoreMatrix[creepId][positions[i]];
        }
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestArrangement = perm.map(idx => ({
            creepId: creepIds[idx],
            position: positions[idx]
          }));
        }
    }
    //console.log("BEST",JSON.stringify(bestArrangement))
    return bestArrangement;
}

function quadSay(quad,creeps){
    //Complex states get substates instead
    let state = quad.state  //['attacking'].includes(quad.state) ? quad.subState : quad.state;
    for(let creep of Object.values(creeps)){
        if(!creep) continue;
        if(randomInt(29) == 13){
            heap.say = Game.time;
            let symbolPick;
            if(SAYREF[state]){
                symbolPick = randomChoice(SAYREF[state]);
            }
            else{
                symbolPick = randomChoice(SAYREF['default'])
            }
            //let words = helper.getSay({numLetters:1,symbol:`${}`});
            creep.say(symbolPick)
        }
    }
}
module.exports = Quad;