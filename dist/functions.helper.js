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
    getWarName: function(){
        const adjectives = [
            "Iron", "Golden", "Mystic", "Silent", "Crimson",
            "Fierce", "Shadow", "Noble", "Savage", "Royal",
            "Frozen", "Twilight", "Valiant", "Sacred",
            "Rogue", "Elite", "Phantom", "Wild", "Brave",
            "Dark",
            "Light", "Radiant", "Dread", "Stormy", "Fiery" ,
            "Gallant", "Stalwart", "Vigilant", "Pious",
            "Venerable", "Stout", "Grizzled", "Hallowed",
            "Bold", "Chivalrous",
            "Blessed", "Virtuous",
            "Honorable", "Steel",
            "Archaic", "Regal", "Exalted",
            "Mystical", "Arcane", "Enchanted", "Ethereal",
            "Mythical", "Celestial", "Infernal",
            "Feudal", "Fabled",
            "Spectral",
            "Ascendant",
            "Haunted", "Grim"
        ];

        const nouns = [
            "Guardians", "Wolves", "Swords", "Legends", "Knights",
            "Eagles", "Riders", "Kings", "Spirits", "Warriors",
            "Hunters", "Axes", "Banners", "Dragons", "Shadows",
            "Watchers", "Ghosts", "Serpents", "Giants", "Mages",
            "Archers", "Paladins", "Ravens", "Lancers",
            "Crusaders", "Champions", "Sentinels", "Rogues",
            "Defenders", "Monks", "Sentinels", "Squires", "Templars",
            "Barons", "Clerics", "Prophets", "Heralds", "Guard",
            "Vassals", "Thanes", "Priests", "Paladins", "Sages",
            "Bishops", "Champions", "Druids", "Smiths",
            "Archers", "Jesters", "Alchemists", "Minstrels", "Peasants",
            "Acolytes", "Crusaders", "Vikings", "Warlocks",
            "Conquerors", "Mystics", "Oracles",
            "Rebels", "Tyrants",
            "Castles", "Realms", "Fortunes",  
            "Healers", "Scouts", "Keepers",
            "Embers", "Ghosts",
        ];

        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adjective} ${noun}`;
    },
    //Returns a phrase for a room sign based on the room
    getSign: function(room){
        const MAX_NEAR_RANGE = 5;
        //No sign if it's one of my rooms or we've already marked it
        //console.log("Getting sign")
        
        if((Memory.kingdom.fiefs[room.name] && room.controller.sign && isMe(room.controller.sign.username) ) || (Memory.kingdom.holdings[room.name] && !Memory.kingdom.holdings[room.name].standby) || !room.controller || (room.controller && room.controller.sign && (Memory.diplomacy.allies.includes(room.controller.sign.username) || [Memory.me.toLowerCase(),"Screeps".toLowerCase()].includes(room.controller.sign.username.toLowerCase())))){
            return false;
        }

        let near = [
            "These walls remember every siege, and still they stand for the Throne.",
            "Here lies the heart of the Sovereign's empire, unbreakable and eternal.",
            "This land thrives under the rule of the Throne.",
            "These rooms flourish under the royal banner, unyielding and proud.",
            "You are under the watchful protection of the Sovereign. Rest easy, obey fully.",
            "These lands pulse with the life granted by the Throne's eternal reign.",
            "Lands claimed in the name of the Sovereign. Invaders will be dispatched without quarter.",
            "Land of the Sovereign. Trespassers face the sword.",
            "Bound to the Throne. Tread lightly, or not at all.",
            "By royal seal, this land is spoken for.",
            "Every breath taken here is a testament to the Throne's supremacy.",
            "Here the Sovereign's voice echoes in every valley and peak.",
            "The light of the Throne casts shadows on all who dare to defy.",
            "Here lies the reach of the Sovereign's arm. Let none dare to contest its claim.",
            "The pulse of the kingdom beats strongest in these lands.",
            "By the Crown, this land is claimed. Dare not oppose.",
            "The Crown's legacy is etched into every grain of this soil.",
            "This soil, kissed by royal decree, curses all who trespass.",
            "A fortress of loyalty, bound by honor to the Crown's eternal rule.",
            "By decree of the Throne, this soil is consecrated and protected.",
            "Under the Sovereign's eye, this land knows only one ruler.",
            "Every sunrise over these lands is a gift from the Sovereign. Every sunset, a reminder.",
            "Let joy be in your hearts and peace in your mind, for the Sovereign protects these lands.",
            "To stand in the Crownlands is to stand in the shadow of something far greater than yourself.",
            "The Sovereign welcomes all visitors. The Knights are less welcoming. Mind the Knights."

        ]
        let far = [
            "This frontier bears the mark of the Crown's silent watch.",
            "Far-flung, yet not forgotten. The Throne's reach is longer than your hope.",
            "Even in foreign lands, the Throne's will is manifest.",
            "The Crown's eye misses nothing, no matter how remote.",
            "The Throne's authority is felt in every corner, no matter how far.",
            "No land is too remote to escape the weight of the Crown.",
            "The Sovereign's eyes survey these distant lands, ever watchful.",
            "Here at the edge, the Sovereign's presence is a whisper on the wind.",
            "These borderlands are quiet now. The Crown prefers it that way.",
            "Marked by the Sovereign's scouts, this territory knows no secrets.",
            "Beware, for the Sovereign's scouts mark your every move.",
            "A whisper carried far enough becomes a command. Heed it.",
            "The Crown's power reaches out, grasping even the most remote lands.",
            "The royal will extends even here. None are beyond reach.",
            "Those dwelling here still yet know the weight of the Throne's will.",
            "Distant though it may be, this land is witness to the Sovereign's command.",
            "These distant shores are touched by whispers of the Throne's might.",
            "In these outer realms, the Sovereign's presence is still felt.",
            "Even the stars above these lands report to the Throne.",
            "Distance is an illusion the Sovereign has not chosen to entertain.",
            "These lands cry out for purpose. The Crown alone can answer.",
            "A land without the Sovereign's mark is a land without a soul."
            
        ]

        let occupied =[
            "The Throne's justice will soon restore order to this land.",
            "The pretender's seal means nothing, and shall soon be broken.",
            "A crown poorly worn is easily lost.",
            "Here lies a land soon to be reclaimed by the Crown.",
            "This land trembles in anticipation of the Throne's righteous fury.",
            "Chaos reigns for now, but the Kingdom's order is on the horizon.",
            "The Throne mourns what was lost here, and sharpens its sword in equal measure.",
            "This land screams beneath a false banner. The Sovereign hears it.",
            "A land in turmoil, soon to be pacified under the Crown's iron fist.",
            "This land will one day sing the hymns of the Throne.",
            "Order shall be restored; the Crown's banner will rise over these walls.",
            "The usurper's time is short; the Crown's forces will restore what is lost.",
            "Here stands a bastion of the foolish, blind to the coming storm.",
            "The Sovereign's banners will rise again over this troubled land.",
            "This land's defiance is but a fleeting spark before the Sovereign's storm.",
            "This land's freedom is but a fleeting illusion; the Sovereign will reclaim it.",
            "Under the weight of the Throne, rebellion will crumble into dust.",
            "You dwell in borrowed time. The Sovereign's tide will reclaim all.",
            "A tapestry incomplete, awaiting the Crown's unifying thread.",
            "You are being watched and judged. The Sovereign forgets nothing.",
            "The Sovereign wishes the current occupant well. Briefly."
        ]
        let occupiedHolding = [
            "These fields, stolen by the weak, will soon be liberated.",
            "Fools toil on the Throne's land, thinking it their own.",
            "The work of the foolish shall be undone, and the Crown will take what is owed.",
            "These resources are bound by fate to serve the Sovereign's greater purpose.",
            "This bounty, wrongly held, will be rightfully seized by the Sovereign's command.",
            "The usurpers plunder in vain, for soon these fields will belong to the Crown.",
            "Resources exploited by thieves will be seized with no mercy.",
            "The pretender hoards, the Sovereign simply collects what is owed.",
            "These fields pay their tithe to the Crown, regardless of who holds the deed.",
            "These fields groan under the weight of their own stolen fate.",
            "The harvest stolen from the Crown does not nourish. It condemns.",
            "Every resource taken by false hands is a debt written in the Sovereign's ledger.",
            "The usurper farms. The Sovereign harvests."
        ]
        //Holding messages are requested by reservers
        if(room.controller.owner){
            return occupied[Math.floor(Math.random() * occupied.length)]
        }
        else if(room.controller.reservation && !isMe(room.controller.reservation.username)){
            return occupiedHolding[Math.floor(Math.random() * occupiedHolding.length)]
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
        for(let dy = -1; dy <= 1; dy++) {
            for(let dx = -1; dx <= 1; dx++) {
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
    getRoomType: function(room) {
        try {
            if (!room) return ['neutral', null, null];
            if (!room.controller) return ['neutral', null, null];

            const allies = (Memory.diplomacy && Memory.diplomacy.allies) || [];

            if (room.controller.owner) {
                const owner = room.controller.owner.username;
                if (allies.includes(owner)) {
                    return ['fief', 'ally', owner];
                } else if (isMe(owner)) {
                    return ['fief', 'me', owner];
                } else {
                    return ['fief', 'enemy', owner];
                }
            }

            if (room.controller.reservation) {
                const reservist = room.controller.reservation.username;
                if (allies.includes(reservist)) {
                    return ['holding', 'ally', reservist];
                } else if (isMe(reservist)) {
                    return ['holding', 'me', reservist];
                } else {
                    return ['holding', 'enemy', reservist];
                }
            }

            return ['neutral', null, null];

        } catch (e) {
            console.log(`Error in getRoomType for room ${room ? room.name : 'undefined'}: ${e.stack}`);
            return ['neutral', null, null];
        }
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
    },
    //Generates a tower damage map for the room
    getTowerMap: function(room,serialized=false){
        if(!(room instanceof Room)){
            chronicle.log(`Room object must be provided to generate a tower map.`,'helper.getTowerMap',1)
            return;
        }
        let tCM = new BigCostMatrix();
        let towers = room.find(FIND_STRUCTURES).filter(str=> str.structureType == STRUCTURE_TOWER);
        //console.log("TOWERS",towers)
        let terrain = Game.map.getRoomTerrain(room.name);
        for(let x=0;x<50;x++){
            for(let y=0;y<50;y++){
                if(terrain.get(x,y) == TERRAIN_MASK_WALL) continue;
                let totalDmg = 0;
                for(let each of towers){
                    let range = Math.max(Math.abs(each.pos.x - x), Math.abs(each.pos.y - y));
                    if(range == 0) continue;
                    let dmg = TOWER_POWER_ATTACK - (TOWER_POWER_ATTACK * (TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE)));
                    totalDmg+=dmg;
                }
                
                tCM.set(x,y,totalDmg);
            }
        }
        if(serialized) return tCM.serialize();
        return tCM;
    }
}

module.exports = helper;    

global.testTowerMap = helper.getTowerMap;
global.getRemoteRoad = helper.routeRemoteRoad;
profiler.registerObject(helper, 'functions.helper');