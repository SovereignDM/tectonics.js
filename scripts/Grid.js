;'use strict';

// The Grid class is the one stop shop for high performance grid cell operations
// You can find grid cells by neighbor, by position, and by the index of a WebGL buffer array
// It is used by both model and view

function Grid(template, options){
	options = options || {};
	var voronoi = options.voronoi;
	var voronoiResolutionFactor = options.voronoiResolutionFactor || 2;
	var voronoiPointNum, neighbor_lookup, face, points, vertex;

	this.template = template;
	
	// Precompute map between buffer array ids and grid cell ids
	// This helps with mapping cells within the model to buffer arrays in three.js
	// Map is created by flattening this.template.faces
	var faces = this.template.faces;
	this.faces = faces;
	var vertices = this.template.vertices;
	this.vertices = vertices;

	this.pos = VectorField.DataFrameOfVectors(this.vertices);

	var buffer_array_to_cell = new Uint16Array(faces.length * 3);
	for (var i=0, i3=0, li = faces.length; i<li; i++, i3+=3) {
		var face = faces[i];
		buffer_array_to_cell[i3+0] = face.a;
		buffer_array_to_cell[i3+1] = face.b;
		buffer_array_to_cell[i3+2] = face.c;
	};
	this.buffer_array_to_cell = buffer_array_to_cell;

	//Precompute neighbors for O(1) lookups
	var neighbor_lookup = this.template.vertices.map(function(vertex) { return new buckets.Set()});
	for(var i=0, il = this.template.faces.length, faces = this.template.faces; i<il; i++){
		face = faces[i];
		neighbor_lookup[face.a].add(face.b);
		neighbor_lookup[face.a].add(face.c);
		neighbor_lookup[face.b].add(face.a);
		neighbor_lookup[face.b].add(face.c);
		neighbor_lookup[face.c].add(face.a);
		neighbor_lookup[face.c].add(face.b);
	}
	neighbor_lookup = neighbor_lookup.map(function(set) { return set.toArray(); });
	this.neighbor_lookup = neighbor_lookup;
	// an "edge" in graph theory is a unordered set of vertices 
	// i.e. this.edges does not contain duplicate neighbor pairs 
	// e.g. it includes [1,2] but not [2,1] 
	var edges = []; 
	var edge_lookup = []; 
	// an "arrow" in graph theory is an ordered set of vertices 
	// it is also known as a directed edge 
	// i.e. this.arrows contains duplicate neighbor pairs 
	// e.g. it includes [1,2] *and* [2,1] 
	var arrows = [];  
	var arrow_lookup = []; 

	var neighbors = []; 
	var neighbor = 0; 
	
	//Precompute a list of neighboring vertex pairs for O(N) traversal 
	for (var i = 0, li=neighbor_lookup.length; i<li; i++) { 
	  neighbors = neighbor_lookup[i]; 
	  for (var j = 0, lj=neighbors.length; j<lj; j++) { 
	    neighbor = neighbors[j]; 
	    arrows.push([i, neighbor]); 
	
	    arrow_lookup[i] = arrow_lookup[i] || []; 
	    arrow_lookup[i].push(arrows.length-1); 
	
	    if (i < neighbor) { 
	      edges.push([i, neighbor]); 
	
	      edge_lookup[i] = edge_lookup[i] || []; 
	      edge_lookup[i].push(edges.length-1); 
	
	      edge_lookup[neighbor] = edge_lookup[neighbor] || []; 
	      edge_lookup[neighbor].push(edges.length-1); 
	    } 
	  } 
	} 

	this.edges = edges; 
	this.edge_lookup = edge_lookup; 
	this.arrows = arrows; 
	this.arrow_lookup = arrow_lookup; 
	
	this.pos_arrow_differential = VectorField.arrow_differential(this.pos, this); 
	this.pos_edge_differential = VectorField.edge_differential(this.pos, this); 

	//Feed locations into a kdtree for O(logN) lookups
	points = [];
	for(var i=0, il = this.template.vertices.length; i<il; i++){
		vertex = vertices[i];
		points.push({x:vertex.x, y:vertex.y, z:vertex.z, i:i});
	}
	this.getDistance = function(a,b) { 
		return Math.pow(a.x - b.x, 2) +  Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2); 
	};
	this._kdtree = new kdTree(points, this.getDistance, ["x","y","z"]);
	
	//Now feed that kdtree into a Voronoi diagram for O(1) lookups
	//If cached voronoi is already provided, use that
	//If this seems like overkill, trust me - it's not
	if (voronoi){
		this._voronoi = voronoi;
	} else {
		voronoiPointNum = Math.pow(voronoiResolutionFactor * Math.sqrt(this.template.vertices.length), 2);
		this._voronoi = new VoronoiSphere(voronoiPointNum, this._kdtree);
	}
}

Grid.prototype.getVoronoi = function() {
	//Now feed that kdtree into a Voronoi diagram for O(1) lookups
	return new VoronoiSphere(this._kdtree, this.template.vertices.length);
}

Grid.prototype.getNearestId = function(vertex) { 
	return this._voronoi.getNearestId(vertex); 
	return this._kdtree.nearest({x:vertex.x, y:vertex.y, z: vertex.z}, 1)[0][0].i;
}

Grid.prototype.getNeighborIds = function(id) {
	return this.neighbor_lookup[id];
}