
const constants = {        
    //Memory Segment Assignment
    SEGMENT_SCOUT_DATA:0,       //All compressed scout data - Likely needs to be multiple segments
    SEGMENT_ROOM_PLANS:1,       //All finished room plans
    SEGMENT_ROOM_DEFENSE:2,     //Tower maps and similar defensive CM data
    SEGMENT_PLAN_GENERATIONS:5, //New room planner generation history
    SEGMENT_LOGGING_ERR:7,      //Error results from functions and modules - Logs that indicate a critical/fatal error
    SEGMENT_LOGGING_WARN:8,     //Warning results from functions and modules - Logs that indicate unwanted or unexpected results
    SEGMENT_LOGGING_INFO:9,     //Miscellaneous logging results

    //Room Definitions
    ROOM_STANDARD :      'room',
    ROOM_SOURCE_KEEPER : 'source_keeper',
    ROOM_CENTER :        'center',
    ROOM_HIGHWAY : 		 'highway',
    ROOM_CROSSROAD : 	 'crossroad',

    //Fief Constants
    DEFAULT_MINERAL_NEED : 80000,
    STORAGE_SPACE_FOR_MINERAL_HARVEST : 100000,
    RAMPART_REPAIR_MINIMUM_ENERGY : 20000,
    DEFAULT_TERMINAL_ENERGY : 50000,
    MAX_SHIPPING_UTILIZATION : 80,
    RAMPART_LOWRCL_CAP : 3000000,

    //Lab Constants
    REACTION_INGREDIENTS : {},

    //Room Plan Constants
    STRUCTURE_KEYS : {
        's': 'spawn',
        'e': 'extension',
        'r': 'road',
        't': 'tower',
        'st': 'storage',
        'l': 'link',
        'ls': 'lab',
        'lt': 'lab',
        'tm': 'terminal',
        'f': 'factory',
        'ps': 'powerSpawn',
        'n': 'nuker',
        'o': 'observer'
    },

    //Misc
    FLAG_MASK : 0x8000

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