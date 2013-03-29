/**
	@file base.js
*/

(function( G ) {
	
	// container for elements
	var elems = {},
	
	// active mod and corresponding button
	activeMod = null,
	activeModBtn = null,
	
	// subject document
	subjectDoc = null,
	
	// load the application
	init = function() {
		
		var arr = [
			// container divs
			'heading', 'control-block',
			
			// mod buttons
			'btn-mod-info', 'btn-mod-parse', 'btn-mod-get',
			
			// mod divs
			'mod-info', 'mod-parse', 'mod-get',
			
			// mod-parse
			"parse-input-text", "btn-parse-input-go", "parse-output",
			
			// mod-get
			"get-input-text", "btn-get-input-go", "get-output"
		];
		
		// populate container with elements
		for ( var i = 0, l = arr.length; i < l; i++ )
			elems[ arr[i]] = document.getElementById( arr[i]);
		
		// add event handlers
		addHandlers();
		
		// set the subject document's iframe name
		setSubject('iframe-subject');
		
		// populate mod-info
		info();
		
		// lastly activate the info mod initially
		activate(elems['btn-mod-info'], elems['mod-info']);
	},
	
	// unload the application
	finish = function() {
		// remove all the handlers
		removeHandlers();
	},
	
	// add event handlers
	addHandlers = function() {
		
		// #1
		// control block buttons
		elems['control-block'].onclick = function(e) {
			if ( !e ) e = window.event;
			var target = e.target || e.srcElement;
			
			if ( target.nodeName.toLowerCase() == 'a' && /^btn/.test(target.id) ) {
				activate( target, elems[target.id.slice('btn-'.length)] );
			}
			
			if ( e.preventDefault ) e.preventDefault();
			else if ( e.returnValue ) e.returnValue  = false;
			return false;
		};
		
		// #2
		// mod-parse & mod-get handlers
		elems['parse-input-text'].onkeydown =
		elems['get-input-text'].onkeydown =
		function(e) {
			if ( !e ) e = window.event;
			var target = e.target || e.srcElement;
			
			if ( e.keyCode != 13 && e.keyCode != 27 ) return true;
			
			var fn = null, str = '';
			switch ( str = target.id.split('-').shift() ) {
				case 'parse': fn = GO_parse; break;
				case 'get': fn = GO_get; break;
			}
			
			if ( fn ) {
				if ( e.keyCode == 13 ) fn();
				else if ( e.keyCode == 27 ) elems[str + '-output'].innerHTML = "";
				
				// we need to prevent default actions
				// some versions of IE will clear the input text on pressing
				// [esc] if we don't do this
				if ( e.preventDefault ) e.preventDefault();
				else if ( e.returnValue ) e.returnValue  = false;
				return false;
			}
		};
		
		elems['btn-parse-input-go'].onclick = GO_parse;
		elems['btn-get-input-go'].onclick = GO_get;
		
	},
	
	// remove event handlers
	removeHandlers = function() {
		// #0
		// window load & unload handler
		if ( document.addEventListener ) {
			window.removeEventListener("load", init, false);
			window.removeEventListener("unload", finish, false);
		}
		else if ( document.attachEvent ) {
			window.detachEvent('onload', init);
			window.detachEvent('onunload', finish);
		}
		
		// #1
		// control block buttons
		elems['control-block'].onclick = null;
		
		// #2
		// mod-parse & mod-get handlers
		elems['parse-input-text'].onkeydown = null;
		elems['btn-parse-input-go'].onclick = null;
		
		elems['get-input-text'].onkeydown = null;
		elems['btn-get-input-go'].onclick = null;
		
	},
	
	// activate mod
	activate = function (btn, mod) {
		if ( activeMod ) {
			activeMod.style.display = 'none';
			activeModBtn.className = 'normal';
		}
		
		activeModBtn = btn;
		activeModBtn.className = 'active';
		
		activeMod = mod;
		activeMod.style.display = 'block';
	},
	
	// set subjectDoc
	setSubject = function(str) {
		try {
			if ( window.frames[str] !== void 0 )
				subjectDoc = window.frames[str].document;
			else throw new Error('');
		}
		catch ( ex ) { alert('subject document not found'); }
	},
	
	// show info
	info = function() {
		var info = elems['mod-info'],
			has = Elfin.has,
			table = document.createElement('table'), r, c, t;
		
		table.id = 'info-table';
		for ( var p in has ) {
			t = p.split('-').shift();
			r = table.insertRow(table.rows.length);
			
			c = r.insertCell(r.cells.length);
			c.innerHTML = String(p);
			c.className = 'it-info-cell';
			
			c = r.insertCell(r.cells.length);
			c.innerHTML = String(has[p]);
			
			if ( t == 'api' ) c.className = has[p] ? 'it-api-true' : 'it-api-false';
			if ( t == 'bug' ) c.className = has[p] ? 'it-bug-true' : 'it-bug-false';
			
		}
		
		info.appendChild(table);
	},
	
	// parse
	GO_parse = function() {
		var expr = elems['parse-input-text'].value;
		
		try { var arr = Elfin.parse(expr); SHOW_parse(arr); }
		catch (ex) { SHOW_parse(null, ex); }
	},
	
	// show parse results
	SHOW_parse = function(arr, ex) {
		var e = elems['parse-output'];
		
		if ( !arr ) return error(ex, e);
		
		var str = '';
		for ( var i = 0, l = arr.length; i < l; i++ )
			str += "<code class='parsed-output-code'>" + String(arr[i]) + "</code>";
		
		e.innerHTML = str;
	},
	
	// get
	GO_get = function() {
		if ( !subjectDoc ) alert('subject document not found');
		var expr = elems['get-input-text'].value;
		
		try { var arr = Elfin(expr, subjectDoc); SHOW_get(arr); }
		catch (ex) { SHOW_get(null, ex); }
	},
	
	// show get results
	SHOW_get = function(arr, ex) {
		var output = elems['get-output'];
		if ( !arr ) return error(ex, output);
		
		var	total = arr.length,
			table = document.createElement('table'), r, c, e;
		
		output.innerHTML = "";
		table.id = 'output-table';
		r = table.insertRow(table.rows.length);
		c = r.insertCell(r.cells.length);
		c.innerHTML = "-- total " + total;
		c.className = 'ot-total-cell';
		
		for ( var i = 0; i < total; i++ ) {
			e = arr[i];
			r = table.insertRow(table.rows.length);
			
			c = r.insertCell(r.cells.length);
			c.innerHTML = e.nodeName;
			
			if ( e.id ) {
				c = r.insertCell(r.cells.length);
				c.innerHTML = '#' + e.id;
				c.className = 'ot-id-cell';
			}
			
			if ( e.className ) {
				c = r.insertCell(r.cells.length);
				c.innerHTML = '.' + e.className;
				c.className = 'ot-class-cell';
			}
		}
		
		output.appendChild(table);
	},
	
	// show error
	error = function(ex, elem) {
		var str = '';
		for ( var p in ex ) str += p + ' : ' + ex[p] + '<br><br>';
		elem.innerHTML = "<h4>Error</h4>" + "<code style='color:red;'>" + str + "</code>";
		
		return false;
	},
	
	// to avoid having to remember putting ';' at the end of a declaration
	end = 0;
	
	// ---------- Initialize
	
	// window load & unload handler
	if ( document.addEventListener ) {
		window.addEventListener("load", init, false);
		window.addEventListener("unload", finish, false);
	}
	else if ( document.attachEvent ) {
		window.attachEvent('onload', init);
		window.attachEvent('onunload', finish);
	}
	
	// ---------- Exports
	

})( this );
