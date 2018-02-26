'use strict';

// A "Crust" is defined as a set of rasters that represent a planet's crust
// The Crust namespace provides methods that extend the functionality of rasters.js to Crust objects
// It also provides functions for modeling properties of Crust
function Crust(params) {
	this.uuid = params['uuid'] || Uuid.create();
	this.grid = params['grid'] || stop('missing parameter: "grid"');

	// TODO:
	// * rename sima/sial to subductable/unsubductable
	// * record sima/sial in metric tons, not meters thickness
	// * switch densities to T/m^3

	// The following are the most fundamental fields to the tectonics model:

	this.sial = Float32Raster(this.grid);
	// "sial" is the thickness of the buoyant, unsubductable component of the crust
	// AKA "sial", "felsic", or "continental" crust
	// Why don't we call it "continental" or some other name? Two reasons:
	//  1.) programmers will immediately understand what it does
	//  2.) we may want this model to simulate planets where alternate names don't apply, e.g. Pluto
	// sial is a conserved quantity - it is never created or destroyed without our explicit say-so
	// This is to provide our model with a way to check for errors

	this.sima = Float32Raster(this.grid);
	// "sima" is the thickness of the denser, subductable component of the crust
	// AKA "sima", "mafsic", or "oceanic" crust
	// Why don't we call it "oceanic" or some other name? Two reasons:
	//  1.) programmers will immediately understand what it does
	//  2.) we may want this model to simulate planets where alternate names don't apply, e.g. Pluto

	this.age = Float32Raster(this.grid);
	// the age of the subductable component of the crust
	// we don't track the age of unsubductable crust because it doesn't affect model behavior


}
Crust.get_value = function(crust, i) {
	return new RockColumn({
		sima 			:crust.sima[i],
		sial 			:crust.sial[i],
		age 			:crust.age[i],
	});
}
Crust.set_value = function(crust, i, rock_column) {
	crust.sima[i] 			= rock_column.sima;
	crust.sial[i] 			= rock_column.sial;
	crust.age[i] 			= rock_column.age;
}
Crust.copy = function(source, destination) {
	var copy = Float32Raster.copy;
	copy(source.sima, destination.sima);
	copy(source.sial, destination.sial);
	copy(source.age, destination.age);
}
Crust.fill = function(crust, rock_column) {
	var fill = Float32Raster.fill;
	fill(crust.sima, rock_column.sima);
	fill(crust.sial, rock_column.sial);
	fill(crust.age, rock_column.age);
}
Crust.copy_into_selection = function(crust, copied_crust, selection_raster, result_crust) {
	var copy = Float32RasterGraphics.copy_into_selection;
	copy(source.sima, copied_crust.sima, selection_raster, result_crust.sima);
	copy(source.sial, copied_crust.sial, selection_raster, result_crust.sial);
	copy(source.age, copied_crust.age, selection_raster, result_crust.age);
}
Crust.fill_into_selection = function(crust, rock_column, selection_raster, result_crust) {
  // NOTE: a naive implementation would repeatedly invoke Float32RasterGraphics.fill_into_selection 
  // However, this is much less performant because it reads from selection_raster multiple times. 
  // For performance reasons, we have to roll our own. 
  if (result_crust !== crust) {
  	Crust.copy(crust, result_crust);
  }
 
  var crust_sima = crust.sima; 
  var crust_sial = crust.sial; 
  var crust_age = crust.age; 
 
  var column_sima = rock_column.sima; 
  var column_sial = rock_column.sial; 
  var column_age = rock_column.age; 
 
  var result_sima = result_crust.sima; 
  var result_sial = result_crust.sial; 
  var result_age = result_crust.age; 
 
  var selection_i = 0; 
  for (var i=0, li=selection_raster.length; i<li; ++i) { 
    selection_i = selection_raster[i]; 
    if (selection_i === 1) {
	    result_sima[i] = column_sima;
	    result_sial[i] = column_sial;
	    result_age[i]  = column_age ;
    }
  } 
}

Crust.get_ids = function(crust, id_raster, result_crust) {
	var get_ids = Float32Raster.get_ids;
	get_ids(crust.sima, id_raster, result_crust.sima);
	get_ids(crust.sial, id_raster, result_crust.sial);
	get_ids(crust.age, id_raster, result_crust.age);
}
Crust.mult_field = function(crust, field, result_crust) {
	var mult_field = ScalarField.mult_field;
	mult_field(crust.sima, field, result_crust.sima);
	mult_field(crust.sial, field, result_crust.sial);
	mult_field(crust.age, field, result_crust.age);
}
Crust.add_delta = function(crust, crust_delta, result_crust) {
	var add_field = ScalarField.add_field;
	add_field(crust.sima, crust_delta.sima, result_crust.sima);
	add_field(crust.sial, crust_delta.sial, result_crust.sial);
	add_field(crust.age, crust_delta.age, result_crust.age);
}
Crust.fix_delta = function(crust_delta, crust) {
	var fix = Float32Raster.fix_nonnegative_conserved_quantity_delta;
	fix(crust_delta.sima, crust.sima);
	fix(crust_delta.sial, crust.sial);
}
Crust.assert_conserved_delta = function(crust_delta, threshold) {
	Float32Raster.assert_conserved_quantity_delta(
		TectonicsModeling.get_sial_type(crust_delta), threshold
	);
}
Crust.assert_conserved_transport_delta = function(crust_delta, threshold) {
	var assert = Float32Raster.assert_conserved_quantity_delta;
	assert(crust_delta.sima, threshold);
	assert(crust_delta.sial, threshold);
}
Crust.assert_conserved_reaction_delta = function(crust_delta, threshold, scratch) {
	var sum = scratch || Float32Raster(crust_delta.grid);
	Float32Raster.fill(sum, 0);
	ScalarField.add_field(crust_delta.sima, sum);
	ScalarField.add_field(crust_delta.sial, sum);
	ScalarField.mult_field(sum, sum, sum);
	var is_not_conserved = Uint8Dataset.sum(ScalarField.gt_scalar(sum, threshold * threshold));
	if (is_not_conserved) {
		debugger;
	}
}