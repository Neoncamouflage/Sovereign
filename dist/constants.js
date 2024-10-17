
const constants = {
    //Memory Segment Assignment
    SEGMENT_SCOUT_DATA:0,     //All compressed scout data - Likely needs to be multiple segments
    SEGMENT_ROOM_PLANS:1,     //All finished room plans
    SEGMENT_LOGGING_ERR:7,    //Error results from functions and modules
    SEGMENT_LOGGING_STATUS:8, //General status results from functions and modules
    SEGMENT_LOGGING_OTHER:9,   //Miscellaneous logging results

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

    //Lab Constants
    REACTION_INGREDIENTS : {}
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