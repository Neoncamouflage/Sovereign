const profiler = require('screeps-profiler');

const helper = {
    //Generates a creep.say()
    getSay: function({ role=undefined, status=undefined, numLetters = 2, symbol=''} = {}){
        let letters = ['𒉌','𒅗','𒍟','𒋲','𒋞','𒋘','𒉼','𒉽','𒉛','𒉃','𒈰','𒈞','𒈓','𒈔','𒈖','𒇸','𒆕','𒅐','𒅒','𒅅',
                        '𒂡','𒁹','𒀸','𒀹','𒀺','𒀀','𒀃','𒋀','𒋦','𒋨','𒋧'];
        let returnLetters = [];
        if(!role && !status){
            for(i=0;i<numLetters;i++){
                let ind = Math.floor(Math.random() * letters.length);
                returnLetters.push(letters[ind]);
            }
        }
        //Add symbol to random spot if one is provided
        if(symbol!='') returnLetters.splice(Math.floor(Math.random() * (returnLetters.length+1)),0,symbol)
        return returnLetters
    },
    //Generates a name
    getName: function({isSpawn=false}={}){
        //let letters = ['𐌰','𐌱','𐌲','𐌳','𐌴','𐌵','𐌶','𐌷','𐌸','𐌹','𐌺','𐌻','𐌼','𐌽','𐌾','𐌿','𐍀','𐍁','𐍂','𐍃','𐍄','𐍅','𐍆','𐍇','𐍈','𐍉','𐍊'];//𐌽𐍅𐌰
        let firstNameLetters = ['𒊵','𒆠','𒊹','𒀭','𒌐','𒉭','𒊮','𒊶','𒊴','𒊯','𒈾','𒇼','𒇻','𒇪','𒇩','𒇨','𒇧','𒇦','𒇥','𒇠','𒇟']
        let lastNameLetters = ['𒂷','𒂸','𒂹','𒂺','𒂻','𒂼','𒂽','𒂿','𒃀','𒃁','𒃂','𒃃','𒃄','𒃅','𒃆','𒃇','𒃈','𒃉','𒃊','𒃋','𒃌','𒃒','𒃓','𒃔','𒃕','𒃖','𒃪','𒃫','𒃬']
        let spawnLetters = ['𒄅','𒄆','𒌷','𒌸','𒌹','𒌺','𒌻','𒌼','𒌽','𒌾','𒌿','𒍀','𒍁','𒍂','𒍃','𒍄','𒍅','𒍆','𒍇','𒍈','𒍉','𒍊','𒍋','𒍌','𒍍','𒍎',]
        
        //If we're naming a spawn then we prefix with a spawn letter
        if(isSpawn){
            let sp = spawnLetters[Math.floor(Math.random() * spawnLetters.length)];
            let first = firstNameLetters[Math.floor(Math.random() * firstNameLetters.length)];
            let last = lastNameLetters[Math.floor(Math.random() * lastNameLetters.length)];
            return sp+last
        }
        let first = firstNameLetters[Math.floor(Math.random() * firstNameLetters.length)];
        let last = lastNameLetters[Math.floor(Math.random() * lastNameLetters.length)]
        return first+last;
    },
    //Returns a phrase for a room sign based on the room
    getSign: function(room){
        const MAX_NEAR_RANGE = 4;
        //No sign if it's one of my rooms or we've already marked it
        if(Memory.kingdom.fiefs[room.name] || (Memory.kingdom.holdings[room.name] && !Memory.kingdom.holdings[room.name].standby) || !room.controller || (room.controller && room.controller.sign && room.controller.sign.username == Memory.me)){
            return false;
        }

        let near = [
            "Here lies the heart of the Sovereign's empire, unbreakable and eternal.",
            "This land thrives under the rule of the Throne.",
            "You are under the watchful protection of the Sovereign. Rest easy, obey fully.",
            "Lands claimed in the name of the Sovereign. Invaders will be dispatched without quarter.",
            "Land of the Sovereign. Trespassers face the sword.",
            "Bound to the Throne. Tread lightly, or not at all.",
            "By royal seal, this land is spoken for.",
            "Here lies the reach of the Sovereign's arm. Let none dare to contest its claim.",
            "By the Crown, this land is claimed. Dare not oppose.",
            "This soil, kissed by royal decree, curses all who trespass.",
            "Under the Sovereign's eye, this land knows only one ruler."

        ]
        let far = [
            "This frontier bears the mark of the Crown's silent watch.",
            "Even at the edge of the world, the Throne's will is manifest.",
            "The Crown's eye misses nothing, no matter how remote.",
            "The Sovereign's eyes survey these distant lands, ever watchful.",
            "Marked by the Sovereign's scouts, this territory knows no secrets.",
            "Beware, for the Sovereign's scouts mark your every move.",
            "The royal will extends even here. None are beyond reach.",
            "These distant shores are touched by whispers of the Throne's might.",
            "In these outer realms, the Sovereign's presence is felt.",
        ]
        let occupied =[
            "The Throne's justice will soon restore order to this land.",
            "Here lies a land soon to be reclaimed by the Crown.",
            "Chaos reigns for now, but the Kingdom's order is on the horizon.",
            "This land will one day sing the hymns of the Throne.",
            "Here stands a bastion of the foolish, blind to the coming storm.",
            "You dwell in borrowed time. The Sovereign's tide will reclaim all.",
            "A tapestry incomplete, awaiting the Crown's unifying thread.",
        ]
        let occupiedHolding = [
            "These fields, stolen by the weak, will soon be liberated.",
            "Fools toil on the Throne's land, thinking it their own.",
            "Resources exploited by thieves will be seized with no mercy."
        ]

        if(room.controller.owner){
            return occupied[Math.floor(Math.random() * occupied.length)]
        }
        
        //Get closest fief distance
        let closest = Infinity;
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            let dist = Game.map.getRoomLinearDistance(room.name, fief);
            if(dist < closest){
                closest = dist;
            }
        });
        if(closest > MAX_NEAR_RANGE){
            return far[Math.floor(Math.random() * far.length)]
        }
        return near[Math.floor(Math.random() * near.length)];
    },
    //Gets the open spots next to a target room position
    getOpenSpots: function(targetPosition,checkConstructed = false){
        const terrain = Game.map.getRoomTerrain(targetPosition.roomName);

        let openSpots = [];
        let walkables = [STRUCTURE_ROAD,STRUCTURE_CONTAINER];
        let lookAt
        // Check the terrain in a 3x3 area centered on the target position
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = targetPosition.x + dx;
                const y = targetPosition.y + dy;
                if(checkConstructed){
                    lookAt = Game.rooms[targetPosition.roomName].lookAt(x,y).filter(obj => (obj.structure && !walkables.includes(obj.structure.structureType)));
                }
                // Check if the terrain at this position is not a wall
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL && (!checkConstructed || !lookAt.length)) {
                    openSpots.push({ x: x, y: y, roomName: targetPosition.roomName });
                }
            }
        }

        // Return an array of open positions
        return openSpots;
    },
    //Returns true/false if a creep is considered a scout
    isScout: function(creep){
        let badParts = [WORK,CARRY,ATTACK,RANGED_ATTACK,HEAL]
        for(part of badParts){
            if(creep.getActiveBodyparts(part) > 0){
                return false;
            }
        }
        return true;
    },
    isSoldier: function(creep){
        let badParts = [ATTACK,RANGED_ATTACK,HEAL]
        for(part of badParts){
            if(creep.getActiveBodyparts(part) > 0){
                return true;
            }
        }
        return false;
    },
    getRoomType: function(room){
        //Returns room type and owner type
        if(!room.controller){
            let st = room.find(FIND_STRUCTURES,{filter:{structureType:STRUCTURE_KEEPER_LAIR}});
            if(st) return['sourcekeeper','neutral']
            
            return ['hallway',null,null];
        }
        if(room.controller.owner){
            if(Memory.diplomacy.allies.includes(room.controller.owner.username)){
                return ['fief','ally',room.controller.owner.username]
            }
            else if(room.controller.owner.username == Memory.me){
                return ['fief','ally',room.controller.owner.username]
            }
            else{
                return ['fief','enemy',room.controller.owner.username]
            }
        }
        if(room.controller.reservation && room.controller.reservation.username != Memory.me){
            if(Memory.diplomacy.allies.includes(room.controller.reservation.username)){
                return ['holding','ally',room.controller.reservation.username]
            }else if(room.controller.reservation.username == Memory.me){
                return ['fief','ally',room.controller.reservation.username]
            }else{
                return ['holding','enemy',room.controller.reservation.username]
            }
        }
        return ['neutral',null,null];
    },
    simpleFloodFill: function(basePlanCM, origins, action) {
        // Initialize a queue with the starting tiles
        let queue = [...origins];
        // Set to keep track of visited tiles
        let visited = new Set();
      
        while (queue.length > 0) {
          let {x, y} = queue.shift(); // Dequeue the next tile
          let key = `${x},${y}`;
      
          // Skip this tile if it has already been visited
          if (visited.has(key)) continue;
      
          visited.add(key); // Mark this tile as visited
      
          // Perform your action based on the cost matrix value of the current tile
          // The 'action' function can be any custom logic you want to apply
          action(x, y, basePlanCM.get(x, y));
      
          // Find and enqueue all adjacent tiles that should be visited
          // You may want to adjust the conditions based on your game's logic
          // For example, you might only want to continue filling if the cost is below a certain threshold
          [[1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            let newX = x + dx, newY = y + dy;
            
            // Ensure the new tile is within bounds and not already visited
            if (newX >= 0 && newX < 50 && newY >= 0 && newY < 50 && !visited.has(`${newX},${newY}`)) {
              queue.push({x: newX, y: newY});
            }
          });
        }
    }
}

module.exports = helper;    

global.getRemoteRoad = helper.routeRemoteRoad;
profiler.registerObject(helper, 'functions.helper');

function randomElements(array, numElements) {
    const indexes = new Set();
    while (indexes.size < numElements) {
        const randomIndex = Math.floor(Math.random() * array.length);
        indexes.add(randomIndex);
    }

    return Array.from(indexes).map(index => array[index]);
}