const helper = require('functions.helper');

// --States--
//Forming - Form up creeps after spawning, convoying, or being broken
//Idle    - Waiting for direction
//Convoy  - Train formed to travel. p4>p3>p2>p1
//Rotate  - Swap creep positions
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
    forming:['𒋘','𒈓'],
    idle:['𒅒','𒈔'],
    convoy:['𒋞','𒈞','𒉛'],
    attack:['𒉌',,'𒁹','𒀸','𒀹','𒀺',],
    ranged:['𒋦','𒍟','𒋲'],
    melee:['𒉽'],
    demo:['𒁹'],
    flee: ['𒇸',,'𒅗'],
    cantFlee:['𒋧'],
    siege:['𒂡','𒅅']
}
function Quad(details={}){
    this.name = helper.getWarName();
    this.p1 = details.p1;
    this.p2 = details.p2;
    this.p3 = details.p3;
    this.p4 = details.p4;
    this.state = 'forming';
    this.fief = details.fief || Object.keys(Memory.kingdom.fiefs)[0];
    this.formPos = details.formPos || getFormPos(this);
    heap.quads.push(this);
}
Quad.prototype.toString = function() {
    return `[quad ${this.name}]`;
};

//Assign creep to the quad. Used by kingdomManager when sorting creeps
Quad.prototype.addCreep = function(creep) {
    if(!Game.getObjectById(this.p1))this.p1 = creep.id;
    else if(!Game.getObjectById(this.p2))this.p2 = creep.id;
    else if(!Game.getObjectById(this.p3))this.p3 = creep.id;
    else if(!Game.getObjectById(this.p4))this.p4 = creep.id;
    else{
        return false;
    }
    return true;
};

Quad.prototype.run = function() {
    let creeps = {p1:Game.getObjectById(this.p1),p2:Game.getObjectById(this.p2),p3:Game.getObjectById(this.p3),p4:Game.getObjectById(this.p4)};
    if(!creeps.p1 || creeps.p1.spawning)return;
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
    let facingRef = {
        TOP: [TOP_LEFT,TOP,TOP_RIGHT],
        BOTTOM: [BOTTOM_LEFT,BOTTOM,BOTTOM_RIGHT],
        LEFT:[LEFT,BOTTOM_LEFT,TOP_LEFT],
        RIGHT:[RIGHT,BOTTOM_RIGHT,TOP_RIGHT]
    }
    let rotateRef = {

    }
    //If no tower map or moveCM for this room, get it
    if(!quad.roomData || !quad.roomData.towerMap || !quad.roomData.moveCM || !quad.roomData.roomName != creeps.p1.room.name){
        quad.roomData = {
            towerMap:      getTowerMap(creeps.p1.room),
            roomName: creeps.p1.room.name,
            moveCM:   getMoveCM(creeps.p1.room)
        }
    }
    let hostileStats = getCombatStats(hostileCreeps);
    let quadStats = getCombatStats(Object.values(creeps));
    let damageMap = getDamageMap(hostileCreeps,hostileStats, quad.roomData.towerMap);
    let peakIncomingDamage = Object.values(creeps).reduce((sum,creep) => sum+(damageMap.get(creep.pos.x,creep.pos.y)));
    let totalRanged = 0;
    let totalHeal = 0;
    let totalAttack = 0;
    let totalDemo = 0;
    let tactic;
    let flee = false;
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
            for (let { dx, dy } of directions) {
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
    //Rotate to face enemy creeps if we have melee
    else if(hostileCreeps.length && totalAttack > 0){
        quad.subState = 'melee'
        let closest = creeps.p1.pos.findClosestByRange(hostileCreeps);
        //Choose movement or/rotation
        let enemyDirection = creeps.p1.pos.getDirectionTo(closest)
        let newFace;
        //Facing the wrong direction, rotate
        if(!facingRef[quad.facing].includes(enemyDirection)){
            //Find the first direction that will deal with the enemy direction and rotate to it.
            for(let face of Object.keys(facingRef)){
                let directions = facingRef[face];
                if(directions.includes(enemyDirection)){
                    newFace = face;
                    break;
                }
            }
            quadRotate(quad,creeps,newFace);
        }
        else{
            quadMove(quad,creeps,hostileCreeps,closest.pos);
        }
    }
    //Otherwise if we have hostile structures and we're a demo quad, rotate that way
    else if(hostileStructs.length && totalDemo > 0){
        quad.subState = 'demo'
        let closest = creeps.p1.pos.findClosestByRange(hostileStructs);
        //Choose movement or/rotation
        let enemyDirection = creeps.p1.pos.getDirectionTo(closest)
        let newFace;
        //Facing the wrong direction, rotate
        if(!facingRef[quad.facing].includes(enemyDirection)){
            //Find the first direction that will deal with the enemy direction and rotate to it.
            for(let face of Object.keys(facingRef)){
                let directions = facingRef[face];
                if(directions.includes(enemyDirection)){
                    newFace = face;
                    break;
                }
            }
            quadRotate(quad,creeps,newFace);
        }
        else{
            quadMove(quad,creeps,hostileCreeps,closest.pos);
        }
    }
    else if(hostileCreeps.length){
        quad.subState = 'ranged'
        let squad = Object.values(creeps);
        let closest = creeps.p1.pos.findClosestByRange(hostileCreeps);
        console.log(quad,creeps,hostileCreeps,closest.pos)
        quadMove(quad,creeps,hostileCreeps,closest.pos);

        let injured = squad.filter(crp => crp.hits < crp.hitsMax);
        for(let each of squad){
            if(injured.length) each.heal(randomChoice(injured));
            else(each.heal(randomChoice(squad)));
            let closest = each.pos.findClosestByRange(hostileCreeps);
            if(each.pos.isNearTo(closest))each.rangedMassAttack();
            else each.rangedAttack(closest);
        }
    }


}

//Travel mode
function runConvoy(quad,creeps,hostileCreeps,hostileStructs){
    const FOLLOWS = {
        'p4':'p3',
        'p3':'p2',
        'p2':'p1',
        'p1':'p1'
    }
    let targetPos = new RoomPosition(25,25,quad.targetRoom);
    //If P1 made it, form up
    if(creeps.p1.room.name == quad.targetRoom){
        console.log("Convoy over, forming up")
        quad.state = 'forming';
        quad.formPos = getFormPos(quad)
        formUp(quad)
    }
    let tired = false;
    for(let quadPos of Object.keys(creeps)){
        let creep = creeps[quadPos];
        if(creep.fatigue){
            tired = true;
            break;
        }
    }
    if(!tired){
        for(let quadPos of Object.keys(FOLLOWS)){
            let goodCount = 0;
            let creep = creeps[quadPos]
            let following = creeps[FOLLOWS[quadPos]]
            //A creep is good to move if it's in range 1 of the one it's following, or the one it's following is on a room edge
            if(creep.pos.getRangeTo(following) <= 1 || ([0,49].includes(following.pos.x) || [0,49].includes(following.pos.y)) || ([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y)) ){//
                if(quadPos == 'p1')creep.travelTo(targetPos,{range:25})
                else{
                    if(creep.pos.getRangeTo(following) == 1) creep.move(following)
                    else creep.travelTo(following)
                }
            }
            //Else we break, only the back of the chain will be good to move
            else{
                break;
            }
            //If all creeps are good, we move them all standard. Otherwise, each travels to the one ahead if not in range 1
            if(false && goodCount == 4){
                creeps.p1.travelTo(new RoomPosition(quad.targetPos.x,quad.targetPos.y,quad.targetRoom));
                creeps.p2.goodMove ? creeps.p2.move(creeps.p1) : creeps.p2.travelTo(creeps.p1);
                creeps.p3.goodMove ? creeps.p3.move(creeps.p2) : creeps.p3.travelTo(creeps.p2);
                creeps.p4.goodMove ? creeps.p4.move(creeps.p3) : creeps.p4.travelTo(creeps.p3);
            }

        }
        
        
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

//Form up creeps based on quad structure
function formUp(quad){
    let creeps = {p1:Game.getObjectById(quad.p1),p2:Game.getObjectById(quad.p2),p3:Game.getObjectById(quad.p3),p4:Game.getObjectById(quad.p4)};
    let stillForming = false;
    for(let quadPos of Object.keys(creeps)){
        let creep = creeps[quadPos];
        console.log("Creep",creep,'position',quadPos,'forming up at',JSON.stringify(quad.formPos))
        if(!creep){
            stillForming = true;
            continue;
        }
        let targetX = quad.formPos.x+POSITIONS[quadPos].x;
        let targetY = quad.formPos.y+POSITIONS[quadPos].y
        if(!creep.pos.isEqualTo(targetX,targetY)){
            //If the position is default due to no vision, use range 25 or get a better spot if we now have vision
            if(quad.formPos.noVis && Game.rooms[quad.formPos.roomName]){
                console.log("FORMNOVIS",targetX,targetY,JSON.stringify(quad.formPos))
                quad.formPos = getFormPos(quad);
                creep.travelTo(new RoomPosition(targetX,targetY,quad.formPos.roomName));
            }
            else{
                console.log("FORM",targetX,targetY,JSON.stringify(quad.formPos))
                creep.travelTo(new RoomPosition(targetX,targetY,quad.formPos.roomName),{range:quad.formPos.noVis ? 25 : 0});
            }
            stillForming = true;
        }
    }
    //Quad changes to idle state from forming if finished, otherwise is left as it was
    if(!stillForming && quad.state == 'forming') quad.state ='idle'
    
}

function getFormPos(details){
    //Formation room is the designated form room, or the fief, and finally need a good default option at some point
    let formRoom = details.targetRoom || details.fief;
    let formPosition;
    let distances;
    //If there's no creep1 to form up around, pick the middle;
    if(!details.p1){
        formPosition = {x:25,y:25,roomName:formRoom,noVis:true}
    }
    else{
        let origin = details.p1;
        if(!(origin instanceof Creep)) origin = Game.getObjectById(details.p1);
        if(!origin) console.log("NOT A CREEP",origin,details.p1)
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
            if (distCM.get(x, y) >= minVal && ![0,1,48,49].includes(x) && ![0,1,48,49].includes(y)) {
            return { x, y, dist };
            }

            // Add neighboring positions to the queue
            for (let { dx, dy } of directions) {
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
                    if(checkCM.get(x,y) == 1) distCM.set(x,y,255)
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
            if(tile == TERRAIN_MASK_WALL){
                moveCM.set(x, y, 255);
                if(x>0){moveCM.set(x-1, y, 255)}
                if(y>0){moveCM.set(x, y-1, 255)}
                if(x>0 && y>0){moveCM.set(x-1, y-1, 255)}
            }
        }
    }
    Memory.test.testCM = moveCM.serialize()
    return moveCM;
    
}

//Prototype method for testing
Quad.prototype.rotate = function(newFace){
    let creeps = {p1:Game.getObjectById(this.p1),p2:Game.getObjectById(this.p2),p3:Game.getObjectById(this.p3),p4:Game.getObjectById(this.p4)};
    quadRotate(this,creeps,newFace)
}

function quadRotate(quad,creeps,newFace){
    let fatigued = Object.values(creeps).filter(c=>c.fatigue)
    if(fatigued.length)return;
    const directions = [TOP,RIGHT,BOTTOM,LEFT];
    const spot = ['p1','p2','p3','p4'];
    //Get indexes of our current and next positions
    let current = directions.indexOf(quad.facing);
    let next = directions.indexOf(newFace);
    //Calculate how many rotations to get to the new position
    let rotations = (next - current + directions.length) % directions.length;
    //creeps is an object like this: {p1:[object Creep],p2:[object Creep],p3:[object Creep],p4:[object Creep]}
    for(let quadPos of Object.keys(creeps)){
        let newSpotIndex = (spot.indexOf(quadPos)+rotations) % directions.length
        quad[spot[newSpotIndex]] = creeps[quadPos].id;
    }
    quad.facing = newFace;
    formUp(quad)
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

function quadSay(quad,creeps){
    //Complex states get substates instead
    let state = ['attacking'].includes(quad.state) ? quad.subState : quad.state;
    for(let creep of Object.values(creeps)){
        if(!creep) continue;
        if(randomInt(29) == 13){
            heap.say = Game.time;
            let symbolPick = randomChoice(SAYREF[state])
            //let words = helper.getSay({numLetters:1,symbol:`${}`});
            creep.say(randomChoice(symbolPick))
        }
    }
}
module.exports = Quad;