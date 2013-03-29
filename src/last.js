/**
	@file last.js
	@desc Just the end.
*/

// use QSA if available & not buggy
Elfin.nativeGet = (Elfin.has['api-QSA'] && !Elfin.has['bug-QSA']) ?
	function(expr, node) {
		node = node || document;
		expr = expr + '';
		
		// Note:
		// we'll try the native  method first and fall back to our implementation;
		// this is to allow additional things not supported by the native method
		// IE8 QSA DOESN'T support :nth-* selectors -- so this also fixes that
		
		try { return Elfin.toArray.call( node.querySelectorAll(expr), 0); }
		catch ( ex ) { return Elfin.get(expr, node); }
	
	} : null;

// Copy Elfin object into "get" methods and get method into Elfin
(function() {
	var fn;
	
	// copy Elfin object into Elfin.get
	fn = Elfin.get;
	for ( var p in Elfin ) fn[p] = Elfin[p];
	
	// copy Elfin object into Elfin.nativeGet
	if ( Elfin.nativeGet ) {
		fn = Elfin.nativeGet;
		for ( var p in Elfin ) fn[p] = Elfin[p];
	}
	
	// finally make Elfin point to Elfin.get -- The Elfin Engine
	Elfin = Elfin.get;
})();

// provide a enable/disable switch for QSA
Elfin.useNative = Elfin.nativeGet ?
	function(b) { if (b) Elfin = Elfin.nativeGet; else Elfin = Elfin.get; } :
	function() {};

// finally enable QSA -- iff available of course :)
Elfin.useNative(true);

