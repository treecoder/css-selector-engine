/**
	@file init.js
	@desc Just the start.
*/

(function( G ) {

	// Initialize ------------------------------ //
	
	var Elfin = {
		version : '1.0',
		
		// collect feature tests' info & bugs in here
		has : {}
	};
	
	// QSA - the native selector engine ------------------------------ //
	
	// api: QSA is available
	// bug: Safari 3.2 can't handle mixedcase/uppercase class names
	(function() {
		if ( !(Elfin.has['api-QSA'] = document.querySelectorAll !== void 0) ) {
			return;
		}
		
		var e = document.createElement('div');
		e.innerHTML = "<p class='QsA'>TEST</p>";
		
		Elfin.has['bug-QSA'] = (e.querySelectorAll(".QsA").length == 0);
		
		e = null;
	})();
	
	// Export ------------------------------ //
	
	G.Elfin = Elfin;

})( this );

