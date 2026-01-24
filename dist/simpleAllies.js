const profiler = require('screeps-profiler');
const chronicle = require('chronicle')
const allies = [
    'DroidFreak',
    'Kalgen',
    'Harabi',
    'HailHydra',
    'Mirroar',
    'Player94',
    'MadDokMike'
]
// This isn't in the docs for some reason, so we need to add it
const maxSegmentsOpen = 10;

//
const EFunnelGoalType = {
    GCL: 0,
    RCL7: 1,
    RCL8: 2
};

//
class SimpleAllies {
    constructor() {
        this.myRequests = {};
        this.allySegmentData = undefined;
        this.currentAlly = undefined;
    }
	
    /**
     * To call before any requests are made or responded to. Configures some required values and gets ally requests
     */
    initRun() {
        // Reset the data of myRequests
        this.myRequests = {
            resource: [],
            defense: [],
            attack: [],
            player: [],
            work: [],
            funnel: [],
            room: [],
        };
        this.readAllySegment();
    }
	
    /**
     * Try to get segment data from our current ally. If successful, assign to the instane
     */
    readAllySegment() {
        if (!allies || !allies.length) {
            console.log("Failed to find an ally for simpleAllies, you probably have none :(");
        }
        else{
            this.currentAlly = allies[Game.time % allies.length];
            // Make a request to read the data of the next ally in the list, for next tick
            const nextAllyName = allies[(Game.time + 1) % allies.length];
            RawMemory.setActiveForeignSegment(nextAllyName, SEGMENT_SIMPLE_ALLIES);
            // Maybe the code didn't run last tick, so we didn't set a new read segment
            if (!RawMemory.foreignSegment){
                this.allySegmentData = '{}'
                return;
            }

            if (RawMemory.foreignSegment.username !== this.currentAlly)
                return;
            // Protect from errors as we try to get ally segment data
            try {
                this.allySegmentData = JSON.parse(RawMemory.foreignSegment.data);
            }
            catch (err) {
                console.log('Error in getting requests for simpleAllies', this.currentAlly);
            }
        }

    }
	
    /**
     * To call after requests have been made, to assign requests to the next ally
     */
    endRun() {
        const newSegmentData = {
            requests: this.myRequests
        };
        RawMemory.segments[SEGMENT_SIMPLE_ALLIES] = JSON.stringify(newSegmentData);
        RawMemory.setPublicSegments([SEGMENT_SIMPLE_ALLIES]);
    }

    // Request methods
    /**
     * Request resource
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     * @param {ResourceConstant} args.resourceType
     * @param {number} args.amount - How much they want of the resource. If the responder sends only a portion of what you ask for, that's fine
     * @param {boolean} [args.terminal] - If the bot has no terminal, allies should instead haul the resources to us
     */
    requestResource(args) {
        this.myRequests.resource.push(args);
    }
    
    /**
     * Request help in defending a room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestDefense(args) {
        this.myRequests.defense.push(args);
    }
    
    /**
     * Request an attack on a specific room
     * @param {Object} args - a request object
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {string} args.roomName
     */
    requestAttack(args) {
        this.myRequests.attack.push(args);
    }
    
    /**
     * Influence allies aggresion score towards a player
     * @param {Object} args - a request object
     * @param {number} args.hate - 0-1 where 1 is highest consideration. How much you think your team should hate the player. Should probably affect combat aggression and targetting
     * @param {number} args.lastAttackedBy - The last time this player has attacked you
     */
    requestPlayer(args) {
        this.myRequests.player.push(args);
    }
    
    /**
     * Request help in building/fortifying a room
     * @param {Object} args - a request object
     * @param {string} args.roomName
     * @param {number} args.priority - 0-1 where 1 is highest consideration
     * @param {'build' | 'repair'} args.workType
     */
    requestWork(args) {
        this.myRequests.work.push(args);
    }
    
    /**
     * Request energy to a room for a purpose of making upgrading faster.
     * @param {Object} args - a request object
     * @param {number} args.maxAmount - Amount of energy needed. Should be equal to energy that needs to be put into controller for achieving goal.
     * @param {EFunnelGoalType.GCL | EFunnelGoalType.RCL7 | EFunnelGoalType.RCL8} args.goalType - What energy will be spent on. Room receiving energy should focus solely on achieving the goal.
     * @param {string} [args.roomName] - Room to which energy should be sent. If undefined resources can be sent to any of requesting player's rooms.
     */
    requestFunnel(args) {
        this.myRequests.funnel.push(args);
    }
    
    /**{credits:,sharableEnergy:,energyIncome:,mineralNodes}
     * Share how your bot is doing economically
     * @param {Object} args - a request object
     * @param {number} args.credits - total credits the bot has. Should be 0 if there is no market on the server
     * @param {number} args.sharableEnergy - the maximum amount of energy the bot is willing to share with allies. Should never be more than the amount of energy the bot has in storing structures
     * @param {number} [args.energyIncome] - The average energy income the bot has calculated over the last 100 ticks. Optional, as some bots might not be able to calculate this easily.
     * @param {Object.<MineralConstant, number>} [args.mineralNodes] - The number of mineral nodes the bot has access to, probably used to inform expansion
     */
    requestEcon(args) {
        this.myRequests.econ = args;
    }
    
    /**
     * Share scouting data about hostile owned rooms
     * @param {Object} args - a request object
     * @param {string} args.roomName
     * @param {string} args.playerName - The player who owns this room. If there is no owner, the room probably isn't worth making a request about
     * @param {number} args.lastScout - The last tick your scouted this room to acquire the data you are now sharing
     * @param {number} args.rcl
     * @param {number} args.energy - The amount of stored energy the room has. storage + terminal + factory should be sufficient
     * @param {number} args.towers
     * @param {number} args.avgRamprtHits
     * @param {boolean} args.terminal - does scouted room have terminal built
     */
    requestRoom(args) {
        this.myRequests.room.push(args);
    }
}

module.exports = {
    allies: allies,
    SEGMENT_SIMPLE_ALLIES: SEGMENT_SIMPLE_ALLIES,
    EFunnelGoalType: EFunnelGoalType,
    simpleAllies: new SimpleAllies()
};
profiler.registerClass(SimpleAllies, 'SimpleAllies');