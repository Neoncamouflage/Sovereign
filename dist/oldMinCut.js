/**
 * This is an adapted version of Dinic's algorithm for computing maximum flow.
 * Sources are whatever we specify, but typically a collection of tiles for our planned base plus an additional buffer zone so attackers can't fire on internal structures.
 * Sinks are exit tiles.
 * 
 * For this process we find all non-sink, non-source floor tiles in a room and convert them to TileNode objects. These nodes will contain details such as the current flow and capacity.
 * The capacity of each will be set based on a distance transform and a flood fill from the base. Lower capacities will indicate chokepoints and closer tiles.
 * 
 * Once we have all our nodes, we start from the source tiles and perform a bfs search through the room. Each step in the search we record the nodes found as one level higher.
 * With all levels recorded, we then start from the source node and move one level higher, starting with the lowest capacity tile nodes.
 * Our algorithm keeps going from lower level nodes to higher level, only moving sideways or backwards in level if no other option is available. This eliminates many unneeded steps.
 * Once we have progressed all the way through the level graph and reached the sink, we set the flow of all nodes travelled to the lowest capacity node we used.
 * 
 * We then restart the process, again moving from lower level to higher level through the lowest capacity nodes we can, until no more routes to the sink are available.
*/

//This creates the TileNode prototype, which we'll use to convert floor tiles to nodes that hold more information such as flow capacity and connections
function TileNode(tileX,tileY,weight){
	//Coordinates of the tile
	this.x = tileX;
	this.y = tileY;

	//Internal edge capacity
	this.capacity = weight;

	//Current flow
	this.flow = 0;

	//Level of the node set by the level graph
	this.level;

	//Indicates whether this node is blocked
	this.blocked = false;

	//Indicates whether this is an exit node
	this.end = false;

	//Nodes connected and leading to this tile
	this.incomingNodes = [];
	//Nodes connected and coming from this tile
	this.outgoingNodes = [];
}

//Now that we have our prototype, we need to add some methods to use during the mincut.
Object.assign(TileNode.prototype,{
	//This method adds a one way connection between two nodes
	addConnection: function(fromNode,toNode){
		//fromNode is where the connection is coming from, so add toNode to outgoing nodes
		if(!fromNode.outgoingNodes.includes(toNode)) fromNode.outgoingNodes.push(toNode);
		//toNode is where the connection is leading, so add fromNode to incoming nodes
		if(!toNode.incomingNodes.includes(fromNode)) toNode.incomingNodes.push(fromNode);
	},
	//This method removes a connection between two nodes
	removeConnection: function(fromNode,toNode){
		// Remove toNode from fromNode's outgoingNodes
        const outgoingIndex = fromNode.outgoingNodes.indexOf(toNode);
        if (outgoingIndex > -1) {
            fromNode.outgoingNodes.splice(outgoingIndex, 1);
        }

        // Remove fromNode from toNode's incomingNodes
        const incomingIndex = toNode.incomingNodes.indexOf(fromNode);
        if (incomingIndex > -1) {
            toNode.incomingNodes.splice(incomingIndex, 1);
        }
	},
	//Clears all connections for the node
	clearConnections: function(){
		//Nodes connected and leading to this tile
		this.incomingNodes = [];
		//Nodes connected and coming from this tile
		this.outgoingNodes = [];
	},
	//Setter for the node level in the level graph
	setLevel: function(level){
		this.level = level;
	},
	//Getter for the node level
	getLevel: function(){
		return this.level;
	},
	//Setter for the node flow
	setFlow: function(flow){
		this.flow += flow;
	},
	//Getter for the node flow
	getFlow: function(){
		return this.flow;
	},
	setBlocked: function(flag){
		this.blocked = flag;
	},
	//Calculate and return the remaining capacity based on the current flow
	getAvailableCapacity: function(){
		return this.capacity - this.flow;
	},
	getOutgoingNodes: function(){
		if(this.outgoingNodes.length){
			return this.outgoingNodes;
		}else{
			return undefined;
		}
		
	},
	getIncomingNodes: function(){
		if(this.incomingNodes.length){
			return this.incomingNodes;
		}else{
			return undefined;
		}
	}
});

//This is our minCut object, which will execute the algorithm.
const minCut = {
	run: function(room,sources){
		let startCPU = Game.cpu.getUsed();
		//This is the primary function called to generate an array of rampart tiles
		//room is a Room game object and sources is an array of RoomPositions that must be protected by the ramparts

		//Get the distance tranform of each tile, from which we will determine node weights
		let distanceTransform = this.getDistanceTransform(room);
		//Get an array of all source nodes and a map of tile nodes for the whole room
		let [sourceNodes,nodeMap] = this.getRoomTileNodes(room,sources,distanceTransform);
		console.log(nodeMap)
		//Now we execute a breadth first search to fill out our level graph and build node connections
		//We pass it the array of source nodes as the graph origins and the rest of the nodes in nodeMap
		//This will return the graph in the form of an object
		let levelGraph = {}
		levelGraph = this.buildLevelGraph(sourceNodes,nodeMap,levelGraph);
		console.log(Object.keys(levelGraph).length)

		//Now that we have the level graph built out we can begin the algorithm. The steps are as follows
		//For every first level node, find all augmenting paths that lead to the exit. If found, take the smallest node capacity in that path and add it to the flow of every node
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
		do{
			//Start the loop with the repeat flag at false
			repeatDFS = false;

			//For each node in the 1st level of the graph
			levelGraph[1].forEach(node =>{
				//Initialize found as false, this flag tracks if we found a path to the exit
				let found = false;
				//console.log('Finding path for',node.x,node.y)
				//console.log(node.x,node.y)
				//If the node has outgoing connections, find paths
				if(!node.blocked && node.getOutgoingNodes()){
					//Returns true if a path to the exit is found for this node
					found = this.findAugmentingPaths(node);
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
			//count++
			//If both repeatDFS and pathFound are false, then we're fully blocked. This means we don't set any flags to true and we end the loop
		} while(repeatDFS);
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
		Object.values(levelGraph).forEach(array=>{
			array.forEach(tile=>{
				memCM2.set(tile.x,tile.y,tile.getLevel())
			})
		})
		nodeMap.forEach((tile,key)=>{
			Memory.memConnections.push({x:tile.x,y:tile.y,targets:tile.getOutgoingNodes() ? tile.getOutgoingNodes().map(node => [node.x, node.y]) : []})
			memCM.set(tile.x,tile.y,tile.getFlow())
			memCM3.set(tile.x,tile.y,tile.getAvailableCapacity())
			
			if(tile.getAvailableCapacity() == 0) memCM4.set(tile.x,tile.y,tile.capacity)
		})
		Memory.mincutFlowCM = memCM.serialize();
		Memory.mincutLevelCM = memCM2.serialize();
		Memory.mincutCapacityCM = memCM3.serialize();
		Memory.saturatedTilesCM = memCM4.serialize();
		console.log("DONE")
		console.log("CPU Used:",Game.cpu.getUsed()-startCPU)
	},
	getRoomTileNodes(room,sources,distanceTransform){
		//Gets all TileNodes for a room
		//First we initialize ALPHA, the constant we use to modify our tile weights
		const ALPHA = 10;
		//Next we create our node map, which will allow us to retrieve tile nodes by their coordinates
		let nodeMap = new Map();
		//First we get the source nodes and set them to level 0 with an infinite weight
		//We store these in a separate array as well as the node map because we use them to start our level graph
		let sourceNodes = [];
		sources.forEach(pos =>{
			let newTile = new TileNode(pos.x,pos.y,Infinity);
			newTile.setLevel(0)
			sourceNodes.push(newTile);

			//Create the key based on x,y coordinates and add it to the map
			let nodeKey = `${pos.x},${pos.y}`;
			nodeMap.set(nodeKey,newTile);
		});
		let exitNeighbors = new Set(); // Store positions near exits
		//Then we get the exit nodes and set them to level 99 with an infinite weight
		room.find(FIND_EXIT).forEach(pos =>{
			let newTile = new TileNode(pos.x,pos.y,Infinity);
			newTile.setLevel(99)
			newTile.end = true;
			let nodeKey = `${pos.x},${pos.y}`;
			nodeMap.set(nodeKey,newTile);
			//Store nearby positions, including diagonals
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					let nearKey = `${pos.x + dx},${pos.y + dy}`;
					exitNeighbors.add(nearKey);
				}
			}
		});

		//Finally we get all the remaining tiles in the room. These will not have a level set, and their weight will be based on the distance transform and ALPHA
		//Loop through every room position and get the distance transform score
		//Initialize variables
		let distScore;
		let newTile;
		let weight;
		let nodeKey;
		//Loop through coordinates above and below edge tiles, as those are already assigned exit nodes
		for (x = 1; x < 49; x += 1) {
			for (y = 1; y < 49; y += 1) {
				distScore = distanceTransform.get(x,y);
				//If the score is greater than 0 it's a valid floor tile, so we create a new TileNode for it
				if(distScore > 0){
					//For these we need to make sure that we aren't assigning a source tile that we've already made
					nodeKey = `${x},${y}`;
					if(!nodeMap.has(nodeKey)){
						//If it's a new tile, create the node and add it
						//We also have to check if it's neighbors with an exit tile.
						//Since we can't build there, we have to give it infinite capacity
						if(exitNeighbors.has(nodeKey)){
							weight = Infinity
							newTile = new TileNode(x,y,weight);
							//Testing to see if having the neighbors as end tiles works better
							newTile.end = true;
							newTile.setLevel(99)
						}
						else{
							weight = distScore*ALPHA;
							newTile = new TileNode(x,y,weight);
						}
						
						nodeMap.set(nodeKey,newTile);
					}
				}
			}
		}

		//Now we return sourceNodes and our nodeMap
		return [sourceNodes,nodeMap]
	},
	buildLevelGraph: function(sourceNodes,nodeMap,levelGraph){
		//console.log("Building graph")
		//Directions to check adjacent tiles. We check manhatten distance since ramparts don't protect diagonal, meaning we only want cardinal directions
		const directions = [[1, 0],[1,1],[-1,-1],[-1,1],[1,-1], [-1, 0], [0, 1], [0, -1]];
		//Reset whatever existing level graph we have
		levelGraph = {};
		//A set to record all visited tiles by stringifying their x,y coordinates
		let visited = new Set();
		//Initialize a queue to hold pairs of nodes along with their level
		let queue = [];
		//Push source nodes to the queue as well as the bottom of the level graph, and mark all as visited
		levelGraph[0] = [...sourceNodes];
		sourceNodes.forEach(sourceNode => {
			queue.push([sourceNode,0]);
			let sourceKey = `${sourceNode.x},${sourceNode.y}`;
        	visited.add(sourceKey);
		});
		
		while(queue.length > 0){
			//Grab the next node to visit and its level
			let [currentNode, currentLevel] = queue.shift();
			//Set the node's level accordingly
			//We do this even if it already has a level, since this function will be called multiple times and will wind up reassigning levels
			currentNode.setLevel(currentLevel);
			//Mark it as visited so we don't return to it
			visited.add(`${currentNode.x},${currentNode.y}`);
			//Clear all connections in case this isn't the first time accessing it
			currentNode.clearConnections();

			//For each of its neighboring tiles
			directions.forEach(([dx, dy]) => {
				//Assign x and y coordinates for the neighboring tile, as well as a key
				let newX = currentNode.x + dx;
				let newY = currentNode.y + dy;
				let nodeKey = `${newX},${newY}`;
				//Initialize node variable
				let newNode;
				//console.log("Checking",nodeKey);
				//console.log('Has:',nodeMap.has(nodeKey))
				//Check if the coordinates match a valid node and that node has capacity
				if (nodeMap.has(nodeKey) && nodeMap.get(nodeKey).getAvailableCapacity() > 0) {
					//console.log('Capacity:',nodeMap.get(nodeKey).getAvailableCapacity())
					//If so, assign it so we can work with it
					newNode = nodeMap.get(nodeKey);
					//If we haven't visited it yet
					if(!visited.has(nodeKey)){
						//console.log(nodeKey,'not visited')
						//First visit means we need to clear its connections in case this isn't the first time
						newNode.clearConnections();
						//Check if this is an exit node with the end property
						if(newNode.end){
							//Exit nodes don't get saved in the level graph because we end the search when we find them, we don't want to loop through them
							//Add a connection from the node we're working with
							currentNode.addConnection(currentNode, newNode);
						}
						else{
							//If not, set its level 
							newNode.setLevel(currentLevel+1)
							//Add the new tile to the queue at the next level
							queue.push([newNode, currentLevel + 1]);
							//console.log('Setting level of',nodeKey,'Check:',newNode.getLevel())
							//Save the new node in the levelGraph
							//console.log('Level graph missing level:',!levelGraph[currentLevel+1])
							if (!levelGraph[currentLevel + 1]) {
								levelGraph[currentLevel + 1] = [];
							}

							levelGraph[currentLevel + 1].push(newNode);
							//Add connection to the new node
							currentNode.addConnection(currentNode, newNode);
							//nodeMap.set(nodeKey,newNode);
						}
						//Add it to the list of visited tiles
						visited.add(nodeKey);
					}
					else{
						//If we have visited, we still need to see if it's a valid connection
						let alreadyVisitedNode = nodeMap.get(nodeKey);
						//Check if the node level is 1 higher than ours or an exit node. If so, check if we already have the connection and add it if not
						if(alreadyVisitedNode && (alreadyVisitedNode.getLevel() == currentLevel+1 || alreadyVisitedNode.getLevel() == 99)){
							//console.log("At node",currentNode.x,currentNode.y,"and already visited higher node",newX,newY)
							//console.log("Visited node details",alreadyVisitedNode.x,alreadyVisitedNode.y,alreadyVisitedNode.getLevel())
							if(!currentNode.getOutgoingNodes() || !currentNode.getOutgoingNodes().includes(alreadyVisitedNode)){
								currentNode.addConnection(currentNode, alreadyVisitedNode);
							}
							
						}
						//See if it's 1 lower. If so, do as above
						else if(alreadyVisitedNode && alreadyVisitedNode.getLevel() == currentLevel-1){
							//console.log("At node",currentNode.x,currentNode.y,"and already visited lower node",newX,newY)
							//console.log("Visited node details",alreadyVisitedNode.x,alreadyVisitedNode.y,alreadyVisitedNode.getLevel())
							if(!currentNode.getIncomingNodes() || !currentNode.getIncomingNodes().includes(alreadyVisitedNode)){
								alreadyVisitedNode.addConnection(alreadyVisitedNode,currentNode);
							}
							
						}
					}	
				};
			})
		}

		//The level graph now has all TileNodes grouped by their level, so we return it
		return levelGraph;
	},
	findAugmentingPaths: function(startNode,visited = new Set(), path = []){
		//Start off by adding our initial node to the list of visited locations and the path
		visited.add(startNode);
		path.push(startNode);
		//Check if the current node is an end node, and if so update the flow
		if(startNode.end){
			console.log("Node marked as end",startNode.x,startNode.y)
			//Get minimum capacity for the flow update
			let minimum = Infinity;
			path.forEach(node => {
				if(node.getAvailableCapacity() < minimum){
					minimum = node.getAvailableCapacity();
				}
			});
			//Update the flow for each node in the valid path
			path.forEach(node => {
				node.setFlow(minimum);
				//If the node is full, set blocked
				if(node.getAvailableCapacity() == 0){
					node.setBlocked(true);
				}
			});
			return true; //Indicate that a valid end node has been found
		}
		//If not an end node, explore each outgoing node if there are any
		let found = false;
		if (startNode.getOutgoingNodes()) {
			console.log("Node",startNode.x,startNode.y,"has ",startNode.getOutgoingNodes().length,"outgoing nodes")
			for (const nextNode of startNode.getOutgoingNodes()) {
				if (!visited.has(nextNode) && !nextNode.blocked) {
					console.log('Visiting',nextNode.x,nextNode.y)
					found = this.findAugmentingPaths(nextNode, visited, path) || found;
				}else{
					console.log(nextNode.x,nextNode.y,'blocked:',nextNode.blocked,'visited already:',visited.has(nextNode))
				}
			}
		}
		else{
			//If not an end node and no outgoing nodes, it's a dead end. Prune the connection for all incoming nodes
			console.log("Node",startNode.x,startNode.y,"has no outgoing nodes")
			if(startNode.getIncomingNodes()){
				startNode.getIncomingNodes().forEach(parentNode=>{
					console.log('Pruning',startNode.x,startNode.y,'from',parentNode.x,parentNode.y)
					parentNode.removeConnection(parentNode,startNode);
				});
			}
			
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
	test: function(roomName,sources=[]){
		//Get important structures in the room for base protection
		let room = Game.rooms[roomName]
		if(!sources.length){
			let roomStructs = room.find(FIND_MY_STRUCTURES,{filter: (structure) => {return [STRUCTURE_LAB,
				STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_TERMINAL,
				STRUCTURE_STORAGE,STRUCTURE_FACTORY,STRUCTURE_TOWER].includes(structure.structureType)}}).map(struct => struct.pos);
			
			//Create sources array and fill with roomStructs positions
			sources = [...roomStructs]
		}
		let surroundingTiles = []
		//Keep a set to avoid duplicates
		let addedTiles = new Set();

		//For every room position, get a 2 tile buffer around it. This is the danger area for sieges.  
		sources.forEach(pos => {
			for(let x = -2; x <= 2; x++) {
				for(let y = -2; y <= 2; y++) {
			
					const tileX = pos.x + x;
					const tileY = pos.y + y;
					let nodeKey = `${tileX},${tileY}`;

					// Make sure we don't go out of bounds (0-49 for both x and y)
					if(tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 50) {
						//Make sure it isn't a wall, and that it's new
						if(room.lookForAt(LOOK_TERRAIN,tileX,tileY) != 'wall' && !addedTiles.has(nodeKey)){
							addedTiles.add(nodeKey);
							surroundingTiles.push(new RoomPosition(tileX,tileY,room.name));
						}
					}
				}
			}
		})
		sources = [...sources,...surroundingTiles]
		this.run(room,sources);
	}

}

module.exports = minCut;

global.testMinCut = minCut.test.bind(minCut);