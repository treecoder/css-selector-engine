/**
	@file get.js
	@info Just the getter.
*/

(function( G ) {

	// document & root
	var D = document, R = document.documentElement,
	
	// imports
	has = G.has, co = G.co, parse = G.parse,
	
	// result of parser, parsed index
	parsed = null, pi = 0,
	
	// context (default is document),  finder results
	context = D, found,
	
	// variables for nth-pseudo arguments
	a, b,
	
	// caching indices
	// Note: callIndex will be incremented for every new call to the getter
	// but gUID can be incremented anytime a new id is required
	callIndex = 0, gUID = 0,
	
	// mathod containers -- find, filter, p_filter
	// Note: ALL of these methods take whatever is in 'found' as input and
	// return the result (always a TRUE array) back in 'found'
	find = {}, filter = {}, p_filter = {};
	
	// Find methods ------------------------------ //
	
	find[ co['TYPE']] = function() {
		found = toArray.call( context.getElementsByTagName( parsed[pi++]), 0);
	};
	
	find[ co['ID']] = function() {
		var e = D.getElementById( parsed[pi++]);
		
		if ( e ) found = (context === D) ? [e] : (contains(context, e) ? [e] : []);
		else found = [];
	};
	
	find[ co['CLASS']] = function() {
		// Note: here we'don't need to convert the resulting HTMLCollection object
		// into a true array as we did for find[co['TYPE']].
		// This is because we're calling a filter method
		// subsequently that returns a true array into 'found' anyway.
		
		found = context.getElementsByTagName('*');
		filter[ co['CLASS'] ]();
	};
	
	find[ co['ATTR']] = function() {
		found = context.getElementsByTagName('*');
		filter[ co['ATTR'] ]();
	};
	
	find[ co['PSEUDO']] = function() {
		found = context.getElementsByTagName('*');
		filter[ co['PSEUDO'] ]();
	};
	
	find[ co['NOT_PSEUDO']] = function() {
		found = context.getElementsByTagName('*');
		filter[ co['NOT_PSEUDO'] ]();
	};
	
	// Filter methods ------------------------------ //
	
	filter[ co['TYPE']] = function() {
		var t = parsed[pi++];
		
		if ( t == '*' ) {
			if ( found instanceof Array ) return;
			found = toArray.call(found, 0);
			return;
		}
		
		var arr = [], e;
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( (e = found[i]).nodeName == t )
				arr.push(e);
		}
		
		found = arr;
	};
	
	filter[ co['ID']] = function() {
		var id = parsed[pi++];
		
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( found[i].id == id ) {
				found = [ found[i] ];
				return;
			}
		}
		
		found = [];
	};
	
	filter[ co['CLASS']] = function() {
		var re = new RegExp( '(^|\\s)' + escapeRegex( parsed[pi++]) + '(\\s|$)'),
			arr = [], e, c;
		
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( (c = (e = found[i]).className) && re.test(c) )
				arr.push(e);
		}
		
		found = arr;
	};
	
	filter[ co['ATTR']] = function() {
		// get name, operator, value
		var n = parsed[pi++], o = parsed[pi++], v = parsed[pi++];
		
		var arr = [], e, i, l = found.length;
		
		if ( o && v.length ) {
			var m, av, ln = v.length;
			
			for ( i = 0; i < l; i++ ) {
				e = found[i];
				if ( !(av = attr(n, e)) ) continue;
				
				switch ( o ) {
					case '='	: m = (v == av); break;
					case '^='	: m = (av.slice(0, ln) == v); break;
					case '$='	: m = (av.slice(-ln) == v); break;
					case '*='	: m = (av.indexOf(v) != -1); break;
					case '~='	: m = ((' '+av+' ').indexOf(' '+v+' ') != -1); break;
					case '|='	: m = (av.slice(0, ln+1) == v + '-'); break;
				}
				
				if ( m ) arr.push(e);
			}
		}
		else if ( o && v.length == 0 ) {
			if ( o !== '=' ) { found = []; return; }
			
			for ( i = 0; i < l; i++ ) {
				e = found[i];
				
				// Note attr() returns empty string for standard attributes
				// that are unspecified, but returns 'null' for non-standard attributes
				// that are unspecified. So for example if you haven't specified any id
				// on <body> then,
				// attr('id', document.body) returns '', and
				// attr('myid', document.body) returns null
				
				// Note: the attribute value MUST BE AN EMPTY STRING -- 'null'
				// values don't count -- so we use === instead of ==
				if ( attr(n, e) === '' ) arr.push(e);
			}
		}
		else { for ( i = 0; i < l; i++ ) {
			e = found[i];
			if ( hasAttr(n, e) ) arr.push(e);
		}}
		
		found = arr;
	};
	
	filter[ co['PSEUDO']] = function() {
		var p = parsed[pi++];
		
		switch ( p ) {
			case co['nth-child']:
			case co['nth-last-child']:
			case co['nth-of-type']:
			case co['nth-last-of-type']:
				a = parsed[pi++], b = parsed[pi++];
				
				if ( b == 0 ) {
					if ( a == 0 ) { found = []; return; }
					if ( a == 1 ) {
						if ( found instanceof Array ) return;
						found = toArray.call(found, 0);
						return;
					}
				}
			break;
		}
		
		p_filter[p]();
	};
	
	filter[ co['NOT_PSEUDO']] = function() {
		var old = found;
		filter[ parsed[pi++] ]();
		var arr = found;
		
		// do an array diff: old - arr
		// Note that the following method of diff relies on the fact that
		// items in 'arr' have same descending order as items in 'old' --
		// meaning item x comes before y both in 'old' and 'arr' array
		var i = 0, j = 0, k = 0, e, x, temp = [];
		while ( x = arr[i++] ) while ( (e = old[j++]) !== x ) temp[k++] = e;
		while ( e = old[j++] ) temp[k++] = e;
				
		found = temp;
	};
	
	filter[ co['DESCENDANT']] = function() {
		// Note: note very carefully that the following method of collecting
		// descendants (specially caching) relies on the fact that elements
		// in 'found' are in "document order"
		
		var i, elems = found, l = elems.length, arr = [],
			old_cxt = context, old_pi = pi, e, ii, ll,
			x = ++gUID;
			
		for ( i = 0; i < l; i++ ) {
			// reset pi, and set new context
			pi = old_pi;
			context = elems[i];
			
			if ( context.uid == x ) continue;
			
			// find in found -- this is to optimize things
			find[ parsed[pi++] ]();
			
			for ( ii = 0, ll = found.length; ii < ll; ii++ ) {
				if ( (e = found[ii]).uid == x ) break;
				
				e.uid = x;
				arr.push(e);
			}
		}
		
		// reset context
		context = old_cxt;
		
		found = arr;
	};
	
	filter[ co['CHILD']] = function() {
		var i, l = found.length, arr = [], e;
		
		for ( i = 0; i < l; i++ ) {
			if ( !(e = found[i].firstChild) ) continue;
			do { if ( e.nodeType == 1 ) arr.push(e); } while ( e = e.nextSibling );
			
			// no duplicates possible
			// Also: '.children' doesn't do any good to speed
			// neither does the new traversal API
		}
		
		found = arr;
	};
	
	filter[ co['ADJACENT_SIBLING']] = function() {
		var i, l = found.length, arr = [], e;
		
		for ( i = 0; i < l; i++ ) {
			e = found[i];
			
			// get the adjacent sibling
			while ( (e = e.nextSibling) && e.nodeType != 1 );
			
			// no duplicates possible
			if(e) arr.push(e);
		}
		
		found = arr;
	};
	
	filter[ co['GENERAL_SIBLING']] = function() {
		var i, l = found.length, arr = [], e,
			x = ++gUID;
		
		for ( i = 0; i < l; i++ ) {
			e = found[i];
			
			while ( e = e.nextSibling ) {
				if ( e.nodeType != 1 ) continue;
				if ( e.uid == x ) break;
				
				e.uid = x;
				arr.push(e);
			}
		}
		
		found = arr;
	};
	
	// Pseudo filter methods ------------------------------ //
	
	p_filter[ co['empty']] = function() {
		var arr = [], e;
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( !((e = found[i]).firstChild) ) arr.push(e);
		}
		
		found = arr;
	};
	
	/*
		algorithm for :nth-* pseudo
		[1] find 1-based index of 'elem' among its siblings -- call it x
		[2] Now, if for a positive integer value of n, the expression
			an + b equals x (a*n + b == x is true), then we found a
			match otherwise not
		[3] We approach this from backwards.
				an + b = x
			=>	n = (x-b) / a ( for n >= 0 AND n is integer )
		
		---------- [cite selector level 3]
		Only the positive values of 'an+b', (for n ≥ 0), may represent an
		element in the document tree. If 'an+b' equals 0, the pseudo class
		represents NO element in the document tree.
		----------
	*/
	
	p_filter[ co['nth-child']] = function() {
		var i, l = found.length, elem, e, x, p, arr = [], n;
		
		for ( i = 0; i < l; i++ ) {
			elem = found[i];
			p = elem.parentNode;
			
			if ( !elem.childIndex || p.childrenIndexed != callIndex ) {
				x = 1;
				p.childrenIndexed = callIndex;
				
				for ( e = p.firstChild; e; e = e.nextSibling )
					if ( e.nodeType == 1 ) e.childIndex = x++;
			}
			
			x = elem.childIndex;
			if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
				arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['nth-last-child']] = function() {
		var i, l = found.length, elem, e, x, p, arr = [], n;
		
		for ( i = 0; i < l; i++ ) {
			elem = found[i];
			p = elem.parentNode;
			
			if ( !elem.lastChildIndex || p.lastChildrenIndexed != callIndex ) {
				x = 1;
				p.lastChildrenIndexed = callIndex;
				
				for ( e = p.lastChild; e; e = e.previousSibling )
					if ( e.nodeType == 1 ) e.lastChildIndex = x++;
			}
			
			x = elem.lastChildIndex;
			if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
				arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['nth-of-type']] = function() {
		var i, l = found.length, elem, e, t, x, p, arr = [], n, c;
		
		for ( i = 0; i < l; i++ ) {
			elem = found[i];
			p = elem.parentNode;
			t = elem.nodeName;
			c = 'childrenIndexed_' + t;
			
			if ( !elem.childIndex_t || p[c] != callIndex ) {
				x = 1;
				p[c] = callIndex;
				
				for ( e = p.firstChild; e; e = e.nextSibling )
					if ( e.nodeName == t ) e.childIndex_t = x++;
			}
			
			x = elem.childIndex_t;
			if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
				arr.push(elem);
		}
		
		found = arr;
		
		
		
	};
	
	p_filter[ co['nth-last-of-type']] = function() {
		var i, l = found.length, elem, e, t, x, p, arr = [], n, c;
		
		for ( i = 0; i < l; i++ ) {
			elem = found[i];
			p = elem.parentNode;
			t = elem.nodeName;
			c = 'lastChildrenIndexed_' + t;
			
			if ( !elem.lastChildIndex_t || p[c] != callIndex ) {
				x = 1;
				p[c] = callIndex;
				
				for ( e = p.lastChild; e; e = e.previousSibling )
					if ( e.nodeName == t ) e.lastChildIndex_t = x++;
			}
			
			x = elem.lastChildIndex_t;
			if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
				arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['first-child']] = function() {
		var i, l = found.length, elem, e, arr = [];
		
		for ( i = 0; i < l; i++ ) {
			e = elem = found[i];
			while ( (e = e.previousSibling) && e.nodeType != 1 );
			if ( !e ) arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['last-child']] = function() {
		var i, l = found.length, elem, e, arr = [];
		
		for ( i = 0; i < l; i++ ) {
			e = elem = found[i];
			while ( (e = e.nextSibling) && e.nodeType != 1 );
			if ( !e ) arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['only-child']] = function() {
		var i, l = found.length, elem, e, arr = [];
		
		outer: for ( i = 0; i < l; i++ ) {
			elem = found[i];
			
			e = elem;
			while ( (e = e.previousSibling) && e.nodeType != 1 );
			if ( e ) continue outer;
			
			e = elem;
			while ( (e = e.nextSibling) && e.nodeType != 1 );
			if ( e ) continue outer;
			
			arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['first-of-type']] = function() {
		var i, l = found.length, elem, e, t, arr = [];
		
		for ( i = 0; i < l; i++ ) {
			e = elem = found[i];
			t = elem.tagName;
			while ( (e = e.previousSibling) && e.tagName != t );
			if ( !e ) arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['last-of-type']] = function() {
		var i, l = found.length, elem, e, t, arr = [];
		
		for ( i = 0; i < l; i++ ) {
			e = elem = found[i];
			t = elem.tagName;
			while ( (e = e.nextSibling) && e.tagName != t );
			if ( !e ) arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['only-of-type']] = function() {
		var i, l = found.length, elem, e, t, arr = [];
		
		outer: for ( i = 0; i < l; i++ ) {
			elem = found[i];
			t = elem.nodeName;
			
			e = elem;
			while ( (e = e.previousSibling) && e.nodeName != t );
			if ( e ) continue outer;
			
			e = elem;
			while ( (e = e.nextSibling) && e.nodeName != t );
			if ( e ) continue outer;
			
			arr.push(elem);
		}
		
		found = arr;
	};
	
	p_filter[ co['enabled']] = function() {
		var arr = [], e;
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( (e = found[i]).disabled == false && e.type != 'hidden' )
				arr.push(e);
		}
		
		found = arr;
	};
	
	p_filter[ co['disabled']] = function() {
		var arr = [], e;
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( (e = found[i]).disabled == true )
				arr.push(e);
		}
		
		found = arr;
	};
	
	p_filter[ co['checked']] = function() {
		var arr = [], e;
		for ( var i = 0, l = found.length; i < l; i++ ) {
			if ( (e = found[i]).checked == true )
				arr.push(e);
		}
		
		found = arr;
	};
	
	// Main methods ------------------------------ //
	
	var get = function(expr, node) {
		context = node || document;
		
		// call the parser here
		parsed = parse(expr);
		
		callIndex++;
		pi = 0;
		
		var l = parsed.length, arr = [], c = 0;
		// arr is result collector, c is a comma counter
		
		// this loop does the getting
		while ( true ) {
			find[ parsed[pi++] ]();
			
			// you'll get out of this loop only when you encounter a ',' or reach the end
			while ( parsed[pi] ) filter[ parsed[pi++] ]();
			
			arr[c] = found;
			if ( pi == l ) break; else { pi++; c++; }
		}
		
		// reset found
		found = null;
		
		// we don't need to sort the results if there was no comma
		if ( c == 0 ) return arr[0];
		
		var i, ii, ll, temp, e,
			result = [], x = ++gUID;
		
		// filter unique elements from all arrays in arr array
		for ( i = 0, l = arr.length; i < l; i++ )
			for ( temp = arr[i], ii = 0, ll = temp.length; ii < ll; ii++ )
				if ( (e = temp[ii]).uid != x )
					{ result.push(e); e.uid = x; }
		
		// now sort elements in "Document Order"
		if ( sortElems ) result.sort(sortElems);
		
		return result;
	};
	
	// Optimizations ------------------------------ //
	
	// #1
	// see if the new Element Traversal API is supported,  -- if yes,
	// change some pseudo filters
	if ( has['api-element-traversal'] = (R.firstElementChild !== void 0) ) {
		// Note: for sake of efficiency, we're writing the entire methods again
	
		p_filter[ co['nth-child']] = function() {
			var i, l = found.length, elem, e, x, p, arr = [], n;
			
			for ( i = 0; i < l; i++ ) {
				elem = found[i];
				p = elem.parentNode;
				
				if ( !elem.childIndex || p.childrenIndexed != callIndex ) {
					x = 1;
					p.childrenIndexed = callIndex;
					
					for ( e = p.firstElementChild; e; e = e.nextElementSibling )
						e.childIndex = x++;
				}
				
				x = elem.childIndex;
				if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
					arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['nth-last-child']] = function() {
			var i, l = found.length, elem, e, x, p, arr = [], n;
			
			for ( i = 0; i < l; i++ ) {
				elem = found[i];
				p = elem.parentNode;
				
				if ( !elem.lastChildIndex || p.lastChildrenIndexed != callIndex ) {
					x = 1;
					p.lastChildrenIndexed = callIndex;
					
					for ( e = p.lastElementChild; e; e = e.previousElementSibling )
						e.lastChildIndex = x++;
				}
				
				x = elem.lastChildIndex;
				if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
					arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['nth-of-type']] = function() {
			var i, l = found.length, elem, e, t, x, p, arr = [], n, c;
			
			for ( i = 0; i < l; i++ ) {
				elem = found[i];
				p = elem.parentNode;
				t = elem.nodeName;
				c = 'childrenIndexed_' + t;
				
				if ( !elem.childIndex_t || p[c] != callIndex ) {
					x = 1;
					p[c] = callIndex;
					
					for ( e = p.firstElementChild; e; e = e.nextElementSibling )
						if ( e.nodeName == t ) e.childIndex_t = x++;
				}
				
				x = elem.childIndex_t;
				if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
					arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['nth-last-of-type']] = function() {
			var i, l = found.length, elem, e, t, x, p, arr = [], n, c;
			
			for ( i = 0; i < l; i++ ) {
				elem = found[i];
				p = elem.parentNode;
				t = elem.nodeName;
				c = 'lastChildrenIndexed_' + t;
				
				if ( !elem.lastChildIndex_t || p[c] != callIndex ) {
					x = 1;
					p[c] = callIndex;
					
					for ( e = p.lastElementChild; e; e = e.previousElementSibling )
						if ( e.nodeName == t ) e.lastChildIndex_t = x++;
				}
				
				x = elem.lastChildIndex_t;
				if ( a == 0 ? x == b : (n = x-b), (n/a >= 0 && n % a == 0) )
					arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['first-child']] = function() {
			var i, l = found.length, e, arr = [];
			
			for ( i = 0; i < l; i++ ) {
				e = found[i];
				if ( e === e.parentNode.firstElementChild ) arr.push(e);
			}
			
			found = arr;
		};
		
		p_filter[ co['last-child']] = function() {
			var i, l = found.length, e, arr = [];
			
			for ( i = 0; i < l; i++ ) {
				e = found[i];
				if ( e === e.parentNode.lastElementChild ) arr.push(e);
			}
			
			found = arr;
		};
		
		p_filter[ co['only-child']] = function() {
			var i, l = found.length, e, arr = [];
			
			for ( i = 0; i < l; i++ ) {
				e = found[i];
				if ( e.parentNode.childElementCount == 1 ) arr.push(e);
			}
			
			found = arr;
		};
		
		p_filter[ co['first-of-type']] = function() {
			var i, l = found.length, e, elem, t, arr = [];
			
			for ( i = 0; i < l; i++ ) {
				e = elem = found[i];
				t = elem.tagName;
				
				while ( (e = e.previousElementSibling) && e.tagName != t );
				if ( !e ) arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['last-of-type']] = function() {
			var i, l = found.length, e, elem, t, arr = [];
			
			for ( i = 0; i < l; i++ ) {
				e = elem = found[i];
				t = elem.tagName;
				
				while ( (e = e.nextElementSibling) && e.tagName != t );
				if ( !e ) arr.push(elem);
			}
			
			found = arr;
		};
		
		p_filter[ co['only-of-type']] = function() {
			var i, l = found.length, elem, e, t, arr = [];
			
			outer: for ( i = 0; i < l; i++ ) {
				elem = found[i];
				t = elem.nodeName;
				
				e = elem;
				while ( (e = e.previousElementSibling) && e.nodeName != t );
				if ( e ) continue outer;
				
				e = elem;
				while ( (e = e.nextElementSibling) && e.nodeName != t );
				if ( e ) continue outer;
				
				arr.push(elem);
			}
			
			found = arr;
		};
		
	}
	
	// Utilities ------------------------------ //
	
	// #1
	// onlyElems() - filter elements nodes
	// Note: if you call this method, you don't have to call toArray subsequently
	// as this method will return a true array
	var onlyElems = function(arr) {
		var elems = [], e;
		
		for ( var i = j = 0, l = arr.length; i < l; i++ )
			if ( (e = arr[i]).nodeType == 1 ) elems[j++] = e;
		
		return elems;
	};
	
	// #2
	// getAttribute() & hasAttribute()
	// normalize inconsistent behavior across browsers
	var attr = function(a, e) {
		switch ( a ) {
			case 'class':	return ('className' in e) ? e.className : e.getAttribute('class');
			case 'for':		return ('htmlFor' in e) ? e.htmlFor : e.getAttribute('for');
			case 'href':	return e.getAttribute('href', 2);
			case 'style':	return e.style.cssText;
			default:		return (a in e) ? e[a] : e.getAttribute(a);
		}
	},
	hasAttr = R.hasAttribute ?
		function(a, e) { return e.hasAttribute(a); } :
		function(a, e) { return (a = e.getAttributeNode(a)) && a.specified; };
	
	// #3
	// contains(a, b) -- return (if a contains b -> true, else -> false)
	var contains = R.contains ?
		function(a, b) { return a !== b && a.contains(b); } : R.compareDocumentPosition ?
		function(a, b) { return !!( a.compareDocumentPosition(b) & 16 ); } :
		function(a, b) { while ( b = b.parentNode ) if ( b === a ) return true; return false; };
	
	// #4
	// sortElems() - sort elements in document order
	// ---------- [cite W3C DOM level 2]
	// There is an ordering, document order, defined on all the nodes in the document
	// corresponding to the order in which the first character of the XML representation
	// of each node occurs in the XML representation of the document after expansion of
	// general entities. Thus, the document element node will be the first node.
	// Element nodes occur before their children. Thus, document order orders element nodes
	// in order of the occurrence of their start-tag in the XML (after expansion of entities).
	// The attribute nodes of an element occur after the element and before its children.
	// The relative order of attribute nodes is implementation-dependent.
	// ----------
	var sortElems = (R.compareDocumentPosition) ?
		function(a, b) {
			if (!a.compareDocumentPosition || !b.compareDocumentPosition) return 0;
			return a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		} : ('sourceIndex' in R) ?
		function(a, b) {
			if (!a.sourceIndex || !b.sourceIndex) return 0;
			return a.sourceIndex - b.sourceIndex;
		} : (D.createRange) ?
		function(a, b) {
			if (!a.ownerDocument || !b.ownerDocument) return 0;
			var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
			aRange.setStart(a, 0);
			aRange.setEnd(a, 0);
			bRange.setStart(b, 0);
			bRange.setEnd(b, 0);
			return aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		} : null;
	
	// #5
	// escapeRegex() - escape regular expression meta-characters
	var escapeRegex = function(str) {
		return str.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&");
	};
	
	// #6
	// toArray() - convert array-like objects to true arrays
	// Note: *ALWAYS* call toArray as toArray.call -- this is to optimize things
	var toArray = Array.prototype.slice;
	
	// Feature tests ------------------------------ //
	
	// #1 - getElementsByTagName()
	// bug: getElementsByTagName('*') returns comment nodes (IE)
	(function() {
		var e = D.createElement('div');
		e.appendChild(D.createComment(''));
		
		has["bug-GEBTN"] = (e.getElementsByTagName('*').length > 0);
		
		e = null;
	})();
	
	// #2 - getElementsByClassName()
	// api: getElementsByClassName() is available
	// bug: getElementsByClassName() can't find a second class (Opera 9.6)
	// bug: getElementsByClassName() caches class attributes, doesn't pick changes (Safari 3.2)
	(function() {
		if ( !(has['api-GEBCN'] = D.getElementsByClassName !== void 0) ) return;
		
		var e = D.createElement('div');
		
		e.innerHTML = "<p class='x y'>TEST</p>";
		var b1 = (e.getElementsByClassName('y').length == 0);
		
		e.firstChild.className = 'z';
		var b2 = (e.getElementsByClassName('z').length == 0);
		
		has['bug-GEBCN'] = b1 || b2;
		
		e = null;
	})();
	
	// #3  - getElementById()
	// bug: getElementById() returns element by name (IE)
	(function() {
		var e = D.createElement('div'), elem;
		R.insertBefore(e, R.firstChild);
		
		var id = 'test-' + (new Date()).getTime();
		e.innerHTML = "<p name='" + id + "'>TEST-name</p><p id='" + id + "'>TEST-id</p>";
		
		if ( elem = D.getElementById(id) ) has['bug-GEBID'] = (elem === e.firstChild);
		else has['bug-GEBID'] = false;
		
		R.removeChild(e);
		e = null;
	})();
	
	// #4 - Array.prototype.slice()
	// bug: Array.prototype.slice() can't convert NodeList, HTMLCollection or
	// other array-like objects to real array (IE)
	(function() {
		try {
			var e = D.createElement('div');
			R.appendChild(e);
			e.innerHTML = "<p>TEST</p><p>TEST</p>";
			
			Array.prototype.slice.call(e.childNodes, 0)[0].nodeType;
			has['bug-array-slice'] = false;
		}
		catch (ex) { has['bug-array-slice'] = true; }
		
		R.removeChild(e);
		e = null;
	})();
	
	// Bug Fixes ------------------------------ //
	
	if ( has["bug-GEBTN"] ) {
		// Note: For this bug we'll have to change some find methods;
		// we're rewriting entire methods again -- this is solely for better performance
		
		// Also note that this bug shows up only when we're getting '*' elements
		// not when we query elements with a particular tag
		
		// Note: If we call onlyElems() to filter out comment nodes, we don't need to
		// call toArray() subsequently, as onlyElems() will return a true array
		
		find[ co['TYPE']] = function() {
			var p = parsed[pi++];
			
			found = (p == '*') ?
				onlyElems( context.getElementsByTagName('*')) :
				toArray.call( context.getElementsByTagName(p), 0);
		};

		find[ co['CLASS']] = function() {
			found = onlyElems( context.getElementsByTagName('*'));
			filter[ co['CLASS'] ]();
		};

		find[ co['ATTR']] = function() {
			found = onlyElems( context.getElementsByTagName('*'));
			filter[ co['ATTR'] ]();
		};

		find[ co['PSEUDO']] = function() {
			found = onlyElems( context.getElementsByTagName('*'));
			filter[ co['PSEUDO'] ]();
		};

		find[ co['NOT_PSEUDO']] = function() {
			found = onlyElems( context.getElementsByTagName('*'));
			filter[ co['NOT_PSEUDO'] ]();
		};
	}
	
	if ( has["api-GEBCN"] && !has['bug-GEBCN'] ) {
		
		find[ co['CLASS']] = function() {
			found = toArray.call( context.getElementsByClassName( parsed[pi++]), 0);
		};
	}
	
	if ( has['bug-array-slice'] ) {
		// Note: *ALWAYS* call toArray as toArray.call
		
		var toArray = function() {
			var arr = [];
			for ( var i = 0, l = this.length; i < l; i++ )
				arr.push( this[i] );
			
			return arr;
		};
	}
	
	// Exports ------------------------------ //
	
	G.toArray = toArray;
	G.get = get;
	
	// other optional exports
	G.find = find;
	G.filter = filter;
	G.p_filter = p_filter;
	G.attr = attr;
	G.contains = contains;
	G.sortElems = sortElems;

})( Elfin );

