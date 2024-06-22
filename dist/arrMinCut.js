/**
 * This is an adapted version of Dinic's algorithm for computing maximum flow.
 * Sources are whatever we specify, but typically a collection of tiles for our planned base plus an additional buffer zone so attackers can't fire on internal structures.
 * Sinks are exit tiles.
 * 
 * For this process we find all non-sink, non-source floor tiles in a room and convert them to arrays for nodes. These nodes will contain details such as the current capacity.
 * The capacity of each will be set based on a distance transform and a flood fill from the base. Lower capacities will indicate chokepoints and closer tiles.
 * 
 * Once we have all our nodes, we start from the source tiles and perform a bfs search through the room. Each step in the search we record the nodes found as one level higher.
 * With all levels recorded, we then start from the source node and move one level higher, starting with the lowest capacity tile nodes.
 * Our algorithm keeps going from lower level nodes to higher level. This eliminates many unneeded steps.
 * Once we have progressed all the way through the level graph and reached the sink, we decrease the capacity of all nodes by the lowest one we found
 * 
 * We then restart the process, again moving from lower level to higher level through the lowest capacity nodes we can, until no more routes to the sink are available.
*/

//We will store our nodes as arrays inside a nodeMap with the x,y coordinate as a key
//Array structure in order of elements, all integers except for the last, which is an array of direction constants:
//nodeType - Source, Exit, or Floor
//nodeCapacity - Capacity of the node, -1 for infinite
//level - Current level of the node
//connections - Array of x,y node keys that correspond to nodes 1 level higher

//Constants
const NODE_TYPE = [
	'source',
	'exit',
	'floor'
]

//This is our minCut object, which will execute the algorithm.
const minCut = {
	run: function(room,sources){
		let startCPU = Game.cpu.getUsed();
		//This is the primary function called to generate an array of rampart tiles
		//room is a Room game object and sources is an array of RoomPositions that must be protected by the ramparts

		//First we convert our sources from room positions to x,y coordinates
		let sourceNodes = sources.map(source => `${source.x},${source.y}`);

		//Get the distance tranform of each tile, from which we will determine node weights
		let distanceTransform = this.getDistanceTransform(room);
		//Get a map of node arrays for the whole room
		let nodeMap = this.getRoomTileNodes(room,sourceNodes,distanceTransform);

		//Now we execute a breadth first search to fill out our level graph and build node connections
		//We pass it the array of source nodes as the graph origins and the rest of the nodes in nodeMap
		let levelGraph = {}
		//console.log('isNodemap')
		//console.log(nodeMap)
		levelGraph = this.buildLevelGraph(sourceNodes,nodeMap,levelGraph);
		//Now that we have the level graph built out we can begin the algorithm. The steps are as follows
		//For every first level node, find all augmenting paths that lead to the exit. If found, take the smallest node capacity in that path and reduce them all by it
		//This will saturate one or more nodes, making them impassable
		//Continue to loop through every 1st level node until we're unable to find any paths past a saturated node
		//Once that's done, we build a new level graph with whatever connections to the remaining nodes we can make
		//Using the new level graph, find all augmenting paths as before
		//Repeat rebuilding the level graph and finding paths until a level graph is built that cannot find any path to an exit
		//Once that happens, the maximum flow has been found as the sum of all bottlenecks.



		//Flags if we found any paths in the whole loop
		let pathFound = false;
		//Flags if we should repeat the DFS loop
		let repeatDFS = false;
		let count = 0;
		//console.log("Starting the do while looop")
		let visited = new Set();
		do{
			//Start the loop with the repeat flag at false
			repeatDFS = false;

			//For each node in the 1st level of the graph
			levelGraph[1].forEach(nodeKey =>{
				let node = nodeMap.get(nodeKey)
				//Initialize found as false, this flag tracks if we found a path to the exit
				let found = false;
				//console.log('Finding path for',nodeKey)
				//console.log('Type',node[0],'Capacity',node[1],'Level',node[2],'Connections',node[3])
				//If the node has outgoing connections, is not saturated, and hasn't been visited, find paths
				if(node[3].length && node[1] > 0){
					//Returns true if a path to the exit is found for this node
					console.log("Finding paths for",nodeKey,'with length',node[3].length)
					found = this.findAugmentingPaths(nodeKey,nodeMap,visited);
				}
				//If any path was found and our flag is true, set the repeat flag to true and continue filling up nodes
				if(found){
					//console.log("Found path! From",node.x,node.y)
					repeatDFS = true;
					//Also set our pathFound flag to true. Even when repeat is false, this stays true, so we know if a loop failed in the first run
					pathFound = true;
				}
			});
			//If the repeat flag is false, but pathFound is true, we know it found a path at some point but can no longer
			//This means we need to rebuild the level graph for future searches
			if(!repeatDFS && pathFound == true){
				//Buid a new level graph
				console.log("BUILDING NEW LEVEL GRAPH")
				levelGraph = this.buildLevelGraph(sourceNodes,nodeMap,levelGraph);
				//Reset pathFound
				pathFound = false;
				//Set the DFS flag to true, so it continues searching with our new level graph
				repeatDFS = true
			}
			count++
			//If both repeatDFS and pathFound are false, then we're fully blocked. This means we don't set any flags to true and we end the loop
		} while(repeatDFS && count < 100);
		console.log("Found path at all? ",pathFound)
		console.log("Iterations ",count)
		//let temp = `${26},${22}`;
		//let tempNode = nodeMap[temp];
		//console.log("Outgoings for",tempNode.x,tempNode.y);
		//tempNode.getOutgoingNodes().forEach(node=>{
			//console.log(node.x,node.y)
		//})

		//this.findAugmentingPaths(nodeMap[temp]);
		//Once that's done, now we rebuild the level graph and do it all again, repeating until there are no more paths at all

		//First we visualize the flow so we can see what's going on
		let memCM = new PathFinder.CostMatrix;
		let memCM2 = new PathFinder.CostMatrix;
		let memCM3 = new PathFinder.CostMatrix;
		let memCM4 = new PathFinder.CostMatrix;
		Memory.memConnections = []
		nodeMap.forEach((node,key)=>{
			let [tileX,tileY] = key.split(',').map(coord=>+coord);
			if(node[0] == 0 || node[0] == 1)return;
			//console.log("Pushing",tileX,tileY,'Capacity',node[1],'Level',node[2],'Connections',node[3])
			Memory.memConnections.push({
				x: tileX,
				y: tileY,
				targets: node[3].length ? node[3].map(key => {
					const [x, y] = key.split(',').map(coordinate => +coordinate);
					return [x, y];
				}) : []
			});
			memCM2.set(tileX,tileY,node[2])
			memCM3.set(tileX,tileY,node[1])
			if(node[1] == 0) memCM4.set(tileX,tileY,1)
		})		
		Memory.mincutCapacityCM = memCM3.serialize();
		Memory.saturatedTilesCM = memCM4.serialize();
		Memory.mincutLevelCM = memCM2.serialize();
		console.log("DONE")
		console.log("CPU Used:",Game.cpu.getUsed()-startCPU)
	},
	getRoomTileNodes(room,sourceNodes,distanceTransform){
		//Gets all tile nodes for a room
		//First we initialize ALPHA, the constant we use to modify our tile weights
		const ALPHA = 2;
		//Next we create our node map, which will allow us to retrieve tile nodes by their coordinates
		let nodeMap = new Map();
		//Add source nodes to the map for checking against later
		sourceNodes.forEach(coords=>{
			nodeMap.set(coords,[0]);
		})
		let exitNeighbors = new Set(); // Store positions near exits
		//Find room exits and add all neighboring tiles to a set
		room.find(FIND_EXIT).forEach(pos =>{
			//Store nearby positions, including diagonals
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					let nearKey = `${pos.x + dx},${pos.y + dy}`;
					exitNeighbors.add(nearKey);
				}
			}
		});

		//Get all the remaining tiles in the room. These will not have a level set, and their weight will be based on the distance transform and ALPHA
		//Loop through every room position and get the distance transform score
		//Initialize variables
		let distScore;
		let weight;
		let nodeKey;
		//Loop through coordinates above and below edge tiles, as those are unbuildable
		for (x = 1; x < 49; x += 1) {
			for (y = 1; y < 49; y += 1) {
				distScore = distanceTransform.get(x,y);
				nodeKey = `${x},${y}`;
				//If the score is greater than 0 it's not a wall, if the map doesn't have the key it's new
				if(distScore > 0 && !nodeMap.has(nodeKey)){
					//We also have to check if it's neighbors with an exit tile.
					//Since we can't build there, it gets marked as an exit itself
					if(exitNeighbors.has(nodeKey)){
						//Exit tile so it doesn't need any other data, record with 99 capacity and level 99
						nodeMap.set(nodeKey,[1,99,99])
					}
					else{
						//Not an exit tile, record a standard node array
						weight = distScore*ALPHA;
						nodeMap.set(nodeKey,[
							2,      //Indicate floor type tile
							weight, //Node capacity
							-1,     //-1 as level is not yet assigned
							[]		//Empty array to hold connection coordinates
						])
					}
				}
			}
		}

		//Now we return our nodeMap
		return nodeMap
	},
	buildLevelGraph: function(sourceNodes,nodeMap,levelGraph){
		//console.log("Building graph")
		//Directions to check adjacent tiles.
		const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]];
		//Reset whatever existing level graph we have
		levelGraph = {};
		//A set to record all visited tiles by thier x,y coordinates
		let visited = new Set();
		//Initialize a queue to hold pairs of nodes and levels
		let queue = [];
		//Push source nodes to the queue as well as the bottom of the level graph, and mark all as visited
		levelGraph[0] = [...sourceNodes];
		sourceNodes.forEach(sourceNode => {
			queue.push([sourceNode,0]);
        	visited.add(sourceNode);
		});
		while(queue.length > 0){
			//Grab the next node to visit and its level
			let [currentNodeKey, currentLevel] = queue.shift();
			//console.log("Isnodemap")
			//console.log(nodeMap)
			//console.log(nodeMap instanceof Map); // Should log true
			//console.log(typeof nodeMap.get); // Should log 'function'
			let currentNode = nodeMap.get(currentNodeKey);
			//Set the node's level accordingly
			//We do this even if it already has a level, since this function will be called multiple times and will wind up reassigning levels
			//2nd index is level
			currentNode[2] = currentLevel;
			//Mark it as visited so we don't return to it
			visited.add(currentNodeKey);
			//Clear all connections in case this isn't the first time accessing it
			//3rd index is connections array
			currentNode[3] = [];

			//For each of its neighboring tiles
			directions.forEach(([dx, dy]) => {
				let [currentX,currentY] = currentNodeKey.split(',');
				//Assign x and y coordinates for the neighboring tile, as well as a key
				//Unary + operator before current coordinates as they're strings after being split
				let newX = +currentX + dx;
				let newY = +currentY + dy;
				let newNodeKey = `${newX},${newY}`;
				//Initialize node variable
				let newNode;
				//console.log("Checking",nodeKey);
				//console.log('Has:',nodeMap.has(nodeKey))
				//Check if the coordinates match a valid node and that node has capacity
				//1st index is capacity
				if (nodeMap.has(newNodeKey) && nodeMap.get(newNodeKey)[1] > 0) {
					//If so, assign it so we can work with it
					newNode = nodeMap.get(newNodeKey);
					//If we haven't visited it yet
					if(!visited.has(newNodeKey)){

						//Add connection to the new node
						currentNode[3].push(newNodeKey)
						//Check if this is an exit node
						//0th index is node type, 1 is exit node
						if(newNode[0] == 1){
							//Exit nodes don't get saved in the level graph because we end the search when we find them, we don't want to loop through them
						}
						else{
							//If not, set its level 
							newNode[2] = currentLevel+1;
							//Add the new tile index to the queue at the next level
							queue.push([newNodeKey, currentLevel + 1]);
							//Save the new node in the levelGraph
							if (!levelGraph[currentLevel + 1]) {
								levelGraph[currentLevel + 1] = [];
							}
							levelGraph[currentLevel + 1].push(newNodeKey);
						}
						//Add it to the list of visited tiles
						visited.add(newNodeKey);
					}
					else{
						//If we have visited, we still need to see if it's a valid connection
						let alreadyVisitedNode = nodeMap.get(newNodeKey);
						//Check if the node level is 1 higher than ours or an exit node. If so, check if we already have the connection and add it if not
						if(alreadyVisitedNode && (alreadyVisitedNode[2] == currentLevel+1 || alreadyVisitedNode[2] == 99)){
							//console.log("At node",currentNode.x,currentNode.y,"and already visited higher node",newX,newY)
							//console.log("Visited node details",alreadyVisitedNode.x,alreadyVisitedNode.y,alreadyVisitedNode.getLevel())
							if(!currentNode[3].includes(newNodeKey)){
								currentNode[3].push(newNodeKey);
							}
							
						}
						//See if it's 1 lower. If so, do as above
						else if(alreadyVisitedNode && alreadyVisitedNode[2] == currentLevel-1){
							//console.log("At node",currentNode.x,currentNode.y,"and already visited lower node",newX,newY)
							//console.log("Visited node details",alreadyVisitedNode.x,alreadyVisitedNode.y,alreadyVisitedNode.getLevel())
							if(!alreadyVisitedNode[3].includes(currentNodeKey)){
								alreadyVisitedNode[3].push(currentNodeKey);
							}
							
						}
					}	
				};
			})
		}

		//The level graph now has all TileNodes grouped by their level, so we return it
		return levelGraph;
	},
	findAugmentingPaths: function(currentNodeKey,nodeMap,visited, path = []){
		//Save last node in path if there is one
		let lastNodeKey;
		if(path.length){
			lastNodeKey = path[path.length-1];
		}
		//Start off by adding our initial node to the list of visited locations and the path
		visited.add(currentNodeKey);
		path.push(currentNodeKey);
		//Assign current node
		let currentNode = nodeMap.get(currentNodeKey);
		//Check if the current node is an exit node, and if so update the flow - 0th index is type, 1 is exit
		if(currentNode[0] == 1){
			//console.log("Node marked as end",currentNodeKey)
			//Get minimum capacity for the flow update
			let minimum = Infinity;
			path.forEach(nodeKey => {
				let pathNode = nodeMap.get(nodeKey)
				//Get capacities of each node, if below the minimum and not -1 for infinite, update minimum
				if(pathNode[1] < minimum && pathNode[1] != -1){
					minimum = pathNode[1];
				}
			});
			//Update the capacity for each node in the path, decreasing it by the minimum
			path.forEach(nodeKey => {
				let pathNode = nodeMap.get(nodeKey);
				pathNode[1] -= minimum;
			});
			return true; //Indicate that a valid end node has been found
		}
		//If not an end node, check each outgoing node if there are any
		let found = false;
		if (currentNode[3].length) {
			//console.log("Node",currentNodeKey,"has ",currentNode[3].length,"outgoing nodes")
			let toRemove = new Set();
			for (const nextNodeKey of currentNode[3]) {
				//If the next node isn't visited and also has a capacity over 0
				if (!visited.has(nextNodeKey) && nodeMap.get(nextNodeKey)[1] > 0) {
					//console.log('Visiting',nextNodeKey)
					found = this.findAugmentingPaths(nextNodeKey,nodeMap, visited, path) || found;
				}else{
					//If capacity is the issue, prune from connections
					if(nodeMap.get(nextNodeKey)[1] == 0){
						toRemove.add(nextNodeKey)
					}
					//console.log(nextNodeKey,'capacity:',nodeMap.get(nextNodeKey)[1],'visited already:',visited.has(nextNodeKey))
				}
			}
			//Filter out any connections we need to remove
			currentNode[3] = currentNode[3].filter(key => !toRemove.has(key));
		}
		else{
			//If not an end node and no outgoing nodes, it's a dead end. Prune the connection
			currentNode[3] = currentNode[3].filter(key => key != nextNodeKey);
			
		}
		if (!found) {
			//If no further path or end node is found, backtrack by removing the current node from the path
			path.pop();
		}
	
		return found; //Return whether a valid path to an end node was found

	},
	getDistanceTransform: function(room){
		//Create two cost matrixes, one for terrain values and one to hold our distance scores
		let distCM = new PathFinder.CostMatrix;
		//Pull terrain for the room, then loop through every x,y coordinate and mark all floor tiles with an initial high distance of 255
		const terrain = new Room.Terrain(room.name);
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                const tile = terrain.get(x, y);
                if(tile != TERRAIN_MASK_WALL){
					distCM.set(x, y, 255);
				}
            }
        }

		//Initialize variables
		let top;
		let left;
		let bottom;
		let right;

		//First we do a pass from top left to bottom right in the room
		//This sets our distance scores based on how far the top and left edges are from a wall
		for (x = 0; x <= 49; x += 1) {
			for (y = 0; y <= 49; y += 1) {
				//Get the distance value of the top and left tiles
				top = distCM.get(x, y - 1);
				left = distCM.get(x - 1, y);
				
				//Set either the current value of the tile or 1 larger than the top or left, whichever is smaller
				distCM.set(x, y, Math.min(Math.min(top, left) + 1, distCM.get(x, y)));
			}
		}
	
		//Now we do a second pass from the bottom right to the top left
		//This catches any shorter distances to walls on the bottom or right sides and updates the tiles accordingly
		for (x = 49; x >= 0; x -= 1) {
			for (y = 49; y >= 0; y -= 1) {
				//Get bottom and right tile distance
				bottom = distCM.get(x, y + 1);
				right = distCM.get(x + 1, y);
				//Again set the value to the smaller of the current distance or the bottom/right tile plus one
				distCM.set(x, y, Math.min(Math.min(bottom, right) + 1, distCM.get(x, y)));
			}
		}

		//Return our now complete distance transform cost matrix
		return distCM;
	},
	test: function(roomName){
		//Get important structures in the room for base protection
		let room = Game.rooms[roomName]
		let roomStructs = room.find(FIND_MY_STRUCTURES,{filter: (structure) => {return [STRUCTURE_LAB,
			STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_TERMINAL,
			STRUCTURE_STORAGE,STRUCTURE_FACTORY,STRUCTURE_TOWER].includes(structure.structureType)}}).map(struct => struct.pos);
		
		//Create sources array and fill with roomStructs positions
		let sources = [...roomStructs]
		//Keep a set to avoid duplicates
		let addedTiles = new Set();

		//For every room position, get a 2 tile buffer around it. This is the danger area for sieges.  
		roomStructs.forEach(pos => {
			for(let x = -2; x <= 2; x++) {
				for(let y = -2; y <= 2; y++) {
					// Skip the source tile itself
					if(x === 0 && y === 0) continue;
			
					const tileX = pos.x + x;
					const tileY = pos.y + y;
					let nodeKey = `${tileX},${tileY}`;

					// Make sure we don't go out of bounds (0-49 for both x and y)
					if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
						//Make sure it isn't a wall, and that it's new
						if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && !addedTiles.has(nodeKey)){
							addedTiles.add(nodeKey);
							sources.push(new RoomPosition(tileX,tileY,room.name));
						}
					}
				}
			}
		})

		this.run(room,sources);
	}

}

//module.exports = minCut;

//global.testMinCut = minCut.test.bind(minCut);