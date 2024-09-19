//Room Definitions
global.ROOM_STANDARD = 		'room'
global.ROOM_SOURCE_KEEPER =	'source_keeper'
global.ROOM_CENTER =		'center'
global.ROOM_HIGHWAY = 		'highway'
global.ROOM_CROSSROAD = 	'crossroad'

//Fief Constants
global.DEFAULT_MINERAL_NEED = 80000;
global.STORAGE_SPACE_FOR_MINERAL_HARVEST = 100000;
global.RAMPART_REPAIR_MINIMUM_ENERGY = 20000;


//Lab Constants
global.REACTION_INGREDIENTS = {}
for(let firstIngredient in REACTIONS){
    for(let secondIngredient in REACTIONS[firstIngredient]){
        if(!REACTION_INGREDIENTS[REACTIONS[firstIngredient][secondIngredient]]){
            REACTION_INGREDIENTS[REACTIONS[firstIngredient][secondIngredient]] = [firstIngredient,secondIngredient]
        }
    }
}
