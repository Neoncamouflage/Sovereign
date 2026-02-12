
const constants = {
    //Default movement priorities based on role/job
    PRIORITY_REF:{
        'hauler':8,
        'fortifier':7
    },
    //Starting allies are other members of CAT for official shards
    STARTING_ALLIES:['shard0','shard1','shard2','shard3'].includes(Game.shard.name) ? ['HailHydra', 'Kerillian', 'Tyrant7', 'NeverCast', 'MAK777', 'DroidFreak',
        'Goldeneyes', 'Loop_Cat', 'GT500', 'Bezoka', 'Player94',
        'griffinpup', 'infdev', 'Zalander', 'Byte4Byte', 'Mirroar', 'mocnyFull'] : [],     
    LANGUAGE:{
        //Directions
        1:'𒍝',
        2:'𒍻',
        3:'𒀸',
        4:'𒀹',
        5:'𒁹',
        6:'𒃻',
        7:'𒌋',
        8:'𒀺',
        attack:'𒀽',
        newTarget:'𒀿',
        flee:'𒊹',
        combo:'𒁁' ,
        pickup:'𒉒',
        dropoff:'𒉔',
        refill:'𒉓',
        refill2:'𒌋',
        idle:'𒂟',
        shove:'𒋝',
        pull:'𒁣'

    },
    //How many ticks between spawn checks
    GLOBAL_SPAWN_INTERVAL:3,
    //Memory Segment Assignment
    ALL_SEGMENTS:{
        SEGMENT_SCOUT_DATA:0,       //All compressed scout data - Likely needs to be multiple segments
        SEGMENT_ROOM_PLANS:1,       //All finished room plans
        SEGMENT_ROOM_DEFENSE:2,     //Tower maps and similar defensive CM data
        SEGMENT_ROOM_COSTMATRIX:3,         //Room cost matrixes for pathing
        SEGMENT_PLAN_GENERATIONS:5, //New room planner generation history
        SEGMENT_MARKET_INFO:6,      //Market data for outside
        SEGMENT_LOGGING_ERR:7,      //Error results from functions and modules - Logs that indicate a critical/fatal error
        SEGMENT_LOGGING_WARN:8,     //Warning results from functions and modules - Logs that indicate unwanted or unexpected results
        SEGMENT_LOGGING_INFO:9,     //Miscellaneous logging results
        SEGMENT_SIMPLE_ALLIES:90,   //Simple allies segment
    },
    //Room Definitions
    ROOM_STANDARD :      'room',
    ROOM_SOURCE_KEEPER : 'source_keeper',
    ROOM_CENTER :        'center',
    ROOM_HIGHWAY : 		 'highway',
    ROOM_CROSSROAD : 	 'crossroad',

    //Fief Constants
    DEFAULT_MINERAL_NEED : 30000,
    STORAGE_SPACE_FOR_MINERAL_HARVEST : 100000,
    RAMPART_REPAIR_MINIMUM_ENERGY : 20000,
    DEFAULT_TERMINAL_ENERGY : 50000,
    MAX_SHIPPING_UTILIZATION : 80,
    RAMPART_LOWRCL_CAP : 3000000,

    //Lab Constants
    REACTION_INGREDIENTS : {},
    MINERALS:[...Object.keys(MINERAL_MIN_AMOUNT),'G'],
    //Minimum amounts to maintain for each boost tier
    TIER1_MIN_AMOUNT: 5000,
    TIER2_MIN_AMOUNT: 3000,
    TIER3_MIN_AMOUNT: 2000,
    
    //Surplus amount to maintain before moving to next tier
    TIER1_SURPLUS: 2000,
    TIER2_SURPLUS: 1000,
    
    //Priority for different types of lab operations
    PRIORITY_BOOST: 7,
    PRIORITY_REACTION: 6,
    PRIORITY_CLEANUP: 8,

    //Direction offset arrays
    DIRECTIONS_4:  [[1, 0], [0, 1], [-1, 0], [0, -1]],
    DIRECTIONS_8: [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]],

}


//Fill reaction ingredients for lab
for(let firstIngredient in REACTIONS){
    for(let secondIngredient in REACTIONS[firstIngredient]){
        if(!constants.REACTION_INGREDIENTS[REACTIONS[firstIngredient][secondIngredient]]){
            constants.REACTION_INGREDIENTS[REACTIONS[firstIngredient][secondIngredient]] = [firstIngredient,secondIngredient]
        }
    }
}

//Add all constants to global
Object.assign(global, constants);
//Add segments individually to global
for(let segName of Object.keys(constants.ALL_SEGMENTS)){
    global[segName] = constants.ALL_SEGMENTS[segName];
}