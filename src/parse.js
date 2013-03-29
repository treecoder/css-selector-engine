/**
	@file parse.js
	@desc Just the parser.
*/

(function( G ) {

	// very basic regular expressions
	// Note: ALL MUST be non-capturing -- that is,
	// every opening parenthesis MUST BE '(?:' instead of '('
	var re_bits = {
		'nl': null,				// newline
		'ws': null,				// whitespace
		'hex': null,			// hexadecimal character
		'esc': null,			// css escape sequence
		'uc': null,				// unicode character
		'id_1char': null,		// first identifier character
		'id_char': null,		// all but first identifier character
		'str_dq': null,			// double quoted string
		'str_sq': null			// single quoted string
	},
	
	// the main regular expressions
	// these should capture relevant parts
	// also note that some match the start (^) -- this is essential for the parser
	re = {
		// css identifier -- no capture
		'identifier':
		/(?:[-]?<%id_1char><%id_char>*)/,
		
		// css string -- no capture
		'string':
		/(?:<%str_dq>|<%str_sq>)/,
		
		// attribute operators (including =) -- no capture
		'attr_op':
		/(?:[\^\$\*\~\|]?\=)/,
		
		// nth pseudo name (function name without '-nth:' part) -- no capture
		'nth_fn':
		/(?:(?:last-)?(?:child|of-type))/,
		
		// nth pseudo argument ('a' part in expression an+b) -- no capture
		'nth_expr__an':
		/(?:(?:\+|\-)?\d*n)/,
		
		// nth pseudo argument ('b' part in expression an+b) -- no capture
		'nth_expr__b':
		/(?:(?:<%ws>*(?:\+|\-)<%ws>*\d+)?)/,
		
		// nth pseudo argument ('x' part which is something not an+b) -- no capture
		'nth_expr__x':
		/(?:(?:(?:\+|\-)?\d+)|even|odd)/,
		
		// type selector (doesn't include *) -- no capture
		'type':
		/^<%identifier>/,
		
		// id selector
		// $1 - id without #
		'id':
		/^#(<%identifier>)/,
		
		// class selector
		// $1 - class without .
		'class':
		/^\.(<%identifier>)/,
		
		// attribute selector
		// $1 - attribute name
		// $2 - attribute operator including =
		// $3 - attribute value (identifier)
		// $4 - attribute value (string)
		'attribute':
		/^\[<%ws>*(<%identifier>)<%ws>*(?:(<%attr_op>)<%ws>*(?:(<%identifier>)|(<%string>))<%ws>*)?\]/,
		
		'simple_pseudo':
		// $1 - pseudo class without :
		/^:(<%identifier>)/,
		
		'nth_pseudo':
		// $1 - nth function (without ':nth-')
		// $2 - an (a is +/- integer)
		// $3 - b (b is +/- integer)
		// $4 - x (+/- integer or 'even' or 'odd')
		/^:nth-(<%nth_fn>)\(<%ws>*(?:(?:(<%nth_expr__an>)(<%nth_expr__b>))|(<%nth_expr__x>))<%ws>*\)/,
		
		'combinator':
		// combinators
		// $1 - combinator
		// /^\s*([>+~]|\s)\s*/,
		/^<%ws>*([>+~]|<%ws>)<%ws>*/,
		
		'comma':
		// comma -- no capture
		/^<%ws>*,<%ws>*/
	},
	
	// remove backslashes '\' in identifiers
	// Note: if after removing '\' from an identifier, if it becomes empty
	// the parser will NOT throw an error -- it will just accept an empty
	// identifier. This is to avoid an extraneous check as empty identifiers are not fatal.
	// For example if your selector expression is '#\\' -- the getter will
	// search for an empty string id -- returning an empty array eventually.
	// similarly [\\] will search for attributes with empty name and will result in
	// an empty array
	clutter = /\\/g,
	
	// constants to flag various parts
	co = {
		// main ---------- //
		
		// comma
		'COMMA'							: 0,
		
		// simple selectors
		'TYPE'							: 1,
		'ID'							: 2,
		'CLASS'							: 3,
		'ATTR'							: 4,
		'PSEUDO'						: 5,
		'NOT_PSEUDO'					: 6,
		
		// combinators
		'DESCENDANT'					: 91,
		'CHILD'							: 92,
		'ADJACENT_SIBLING'				: 93,
		'GENERAL_SIBLING'				: 94,
		
		// pseudo classes ---------- //
		// Note: you can assign values to pseudo classes independent of above values
		
		// special
		'empty'							: 0,
		
		// structural - nth
		'nth-child'						: 10,
		'nth-last-child'				: 11,
		'nth-of-type'					: 12,
		'nth-last-of-type'				: 13,
		
		// structural - others
		'first-child'					: 14,
		'last-child'					: 15,
		'only-child'					: 16,
		'first-of-type'					: 17,
		'last-of-type'					: 18,
		'only-of-type'					: 19,
		
		// ui
		'enabled'						: 30,
		'disabled'						: 31,
		'checked'						: 32,
		
		// end ---------- //
		// this is to avoid freaking out IE at the last comma
		'_end_'							: -1
	},
	
	// save parsed representation
	parsed = null,
	
	// remaining string to be parsed
	left = '';
	
	// Compile regular expressions ---------------------------------------- //
	
	(function(nl, esc, uc) {
		// first populate re_bits regexes with values
		var R = re_bits;
		
		// whitespace
		R['ws'] = /(?: |\t|\n|\r\n|\r|\f)/;
		
		// hexadecimal character
		R['hex'] = /[0-9a-fA-F]/;
		
		// newline
		if ( nl ) R['nl'] = /(?:\n|\r\n|\r|\f)/;
		else delete R['nl'];
		
		// css escape sequence
		if ( esc ) R['esc'] = /(?:(?:\\<%hex>{1,6}<%ws>?)|(?:\\[^\n\r\f0-9a-fA-F]))/;
		else delete R['esc'];
		
		// unicode character
		if ( uc ) R['uc'] = /[\u00A1-\uFFFF]/;
		else delete R['uc'];
		
		// first identifier character - (?:(?:[-]?[_a-zA-Z])|<%uc>|<%esc>)
		R['id_1char'] = new RegExp (
			'(?:' + '[_a-zA-Z]' + (uc ? '|<%uc>' : '') + (esc ? '|<%esc>' : '') + ')'
		);
		
		// all but first identifier character - (?:[_a-zA-Z0-9-]|<%uc>|<%esc>)
		R['id_char'] = new RegExp (
			'(?:' + '(?:[_a-zA-Z0-9-])' + (uc ? '|<%uc>' : '') + (esc ? '|<%esc>' : '') + ')'
		);
		
		// double quoted string (?:\"(?:[^\n\r\f\\"]|(?:\\<%nl>)|<%uc>|<%esc>)*\")
		R['str_dq'] = new RegExp (
			'(?:' + /\"/.source + '(?:' + /[^\n\r\f\\"]/.source +
			(nl ? /|(?:\\<%nl>)/.source : '') + (uc ? '|<%uc>' : '') + (esc ? '|<%esc>' : '') +
			')*' + /\"/.source + ')'
		);
		
		// single quoted string (?:\'(?:[^\n\r\f\\']|(?:\\<%nl>)|<%uc>|<%esc>)*\')
		R['str_sq'] = new RegExp (
			'(?:' + /\'/.source +  '(?:' + /[^\n\r\f\\']/.source +
			(nl ? /|(?:\\<%nl>)/.source : '') + (uc ? '|<%uc>' : '') + (esc ? '|<%esc>' : '') +
			')*' + /\'/.source + ')'
		);
		
		// compile the regular expressions in this order
		var order = [
			'esc', 'id_1char', 'id_char', 'str_dq', 'str_sq',
			'identifier', 'string', 'nth_expr__b',
			'type', 'id', 'class', 'attribute', 'simple_pseudo', 'nth_pseudo',
			'combinator', 'comma'
		];
		
		// replace map -- key to object map
		var map = {}, s, arr;
		for ( s in re_bits ) map[s] = re_bits;
		for ( s in re ) map[s] = re;
		
		var re_replace = /<%([_a-zA-Z0-9]*)>/g;
		// Note: the 'g' flag in re_replace is very important as it makes the
		// RegExp::exec() mathod behave slightly differently -- which is what we need
		
		// do the replacing
		for ( var i = 0, l = order.length; i < l; i++ ) {
			s = order[i];
			if ( !map[s] ) continue;
			
			R = map[s][s];
			while ( arr = re_replace.exec(R.source) ) {
				if ( map[ arr[1] ] ) {
					R = new RegExp( R.source.replace(
						new RegExp(arr[0], 'g'),
						map[ arr[1] ][ arr[1] ].source
					));
					re_replace.lastIndex = 0;
				}
				else continue;
			}
			
			map[s][s] = R;
		}
		
		// NOTE:
		// We are NOT making our regular expressions case-insensitive -- this is
		// because of an Opera bug. If you flag regexes with 'i', Opera
		// 9.52 and earlier won't parse correctly
		
		// bug: A regex that should match only unicode characters matches ascii
		// renge characters also -- IFF that regex has case-insensitive (i) flag set
		
		// bug in action:  (would show up only in Opera 9.52 & earlier)
		// var re = /[\u00A1-\uFFFF]*/i;
		// var arr = 'ascii'.match(re);
		// arr[0] == 'ascii'; // should be false
		
		// fix: You can omit unicode support in all regular expressions and then if
		// your regexes have i flag -- no problem. Or you can make your regexes
		// match both uppercase and lowercase characters by writing them as [a-zA-Z].
		// We de the latter
		
		// BUT we can flag THOSE expressions with 'i' that don't need to
		// match unicode characters...
		
		// make re['nth_pseudo'] case-insensitive
		// if we don't do this, we won't be able to match something like "NtH-ChIlD(n)"
		re['nth_pseudo'] = new RegExp(re['nth_pseudo'].source, 'i');
		
	})(true, true, true);
	// support newlines, escape sequences and unicode characters
	
	// Parse ---------------------------------------- //
	
	// throw an error
	var err = function() { throw new Error('invalid selector expression'); },
	
	// parse a sequence of simple selectors, return at combinator
	// ---------- [cite: W3C selector level 3 spec]
	// A sequence of simple selectors is a chain of simple selectors that are NOT
	// separated by a combinator. It always begins with a type selector or a universal
	// selector. No other type selector or universal selector is allowed in the sequence. 
	// ----------
	simple_parser = function() {
		// save the initial length of the remaining expression
		var l = left.length;
		
		// first match any type selector, as it can only appear at the beginning
		type_parser();
		
		// match other simple selectors
		while ( left != '' ) {
		switch ( left.charAt(0) ) {
			case '#': if ( !id_parser() ) err(); break;
			case '.': if ( !class_parser() ) err(); break;
			case '[': if ( !attr_parser() ) err(); break;
			case ':':
				if ( /^:not/i.test(left) ) {
					if ( !not_pseudo_parser() ) err();
				}
				else {
					if ( !pseudo_parser() ) err();
				}
			break;
			default:
				// if remaining expression's length is same, we couldn't match anything
				if ( left.length == l ) err();
				else return;
		}}
	},
	
	// type parser
	type_parser = function() {
		var m;
		
		if ( left.charAt(0) == '*' ) m = '*';
		else {
			var arr = left.match( re['type'] );
			if ( arr ) m = NODENAME_UPPERCASE ? arr[0].toUpperCase() : arr[0].toLowerCase();
		}
		
		if ( m ) {
			left = left.slice(m.length);
			parsed.push(co['TYPE'], m.replace(clutter, ''));
			return true;
		}
		
		return false;
	},
	
	// id parser
	id_parser = function() {
		var arr = left.match( re['id'] );
		
		if ( arr ) {
			left = left.slice(arr[0].length);
			parsed.push(co['ID'], arr[1].replace(clutter, ''));
			return true;
		}
		
		return false;
	},
	
	// class parser
	class_parser = function() {
		var arr = left.match( re['class'] );
		
		if ( arr ) {
			left = left.slice(arr[0].length);
			parsed.push(co['CLASS'], arr[1].replace(clutter, ''));
			return true;
		}
		
		return false;
	},
	
	// attribute parser
	attr_parser = function() {
		var arr = left.match( re['attribute'] );
		
		if ( arr ) {
			left = left.slice( arr[0].length );
			parsed.push(co['ATTR']);
			
			// push name first
			parsed.push( arr[1].replace(clutter, ''));
			
			// push operator and value if they exist
			if ( arr[2] ) {
				parsed.push( arr[2]);
				
				// Note:
				// attribute value is in
				// arr[3] - non-string (identifier) value or
				// arr[4] - string value
				// the attribute value (whether string or identifier)
				// will be saved in the as a string;
				// for this reason we'll strip the quotes from the string values
				
				// Note:
				// we'll remove '\' characters only when the attribute value
				// is NOT a string -- for strings don't touch backslashes
				
				if ( arr[3] ) parsed.push( arr[3].replace(clutter, ''));
				else if ( arr[4] ) parsed.push( arr[4].slice(1,-1));
				else parsed.push('');
			}
			else parsed.push(void 0, void 0);
			// we must explicitly push undefined if the attribute value is not available
			// because getter expects 3 values for attribute tokens
			
			return true;
		}
		
		return false;
	},
	
	// pseudo parser
	pseudo_parser = function() {
		var arr, l = 0;
		
		if ( /^:nth-/i.test(left) ) {
			if ( (arr = left.match( re['nth_pseudo'] )) === null ) return false;
			
			l = arr[0].length;
			
			parsed.push(co['PSEUDO'], co[ 'nth-' + arr[1].toLowerCase()]);
			
			var a = arr[2], b = arr[3], x = arr[4], ws = /\s/g;
			// Note: IE treats arr[2], arr[3], arr[4] differently than other browsers --
			// if nothing is matched, these will be undefined in other browsers BUT
			// will be empty strings in IE. Take care of this.
			
			// Note: a and x are mutually exclusive -- they can't be
			// non-undefined or undefnied at the same time; if a is undefined,
			// x must be non-undefined, and vice-versa
			
			if ( a ) {
				a = parseInt( a.replace(ws, ''));
				
				// this is for when 'n' is not preceded by a number
				// in expressions like n+1 or -n
				if ( isNaN(a) ) a = parseInt( ( a = arr[2] ).replace(/n/, '1'));
			}
			
			b = ( b && parseInt( b.replace(ws, '')) ) || 0;
			
			if ( x ) {
				if ( /even|odd/i.test(x) ) {
					x = x.toLowerCase();
					a = 2;
					b = ( x == 'odd' ) ? 1 : 0;
				}
				else {
					a = 0;
					b = parseInt( x.replace(ws, ''));
				}
			}
			
			parsed.push(a, b);
		}
		else if ( (arr = left.match( re['simple_pseudo'] )) !== null ) {
			l = arr[0].length;
			var m = co[ arr[1].toLowerCase()];
			
			// verify that the pseudo class actually exists
			if ( m === void 0 ) return false;
			
			parsed.push(co['PSEUDO'], m);
		}
		
		if ( l > 0 ) {
			left = left.slice(l);
			return true;
		}
		
		return false;
	},
	
	// not pseudo parser
	not_pseudo_parser = function() {
		left = left.slice(5); // ':not('.length == 5
		parsed.push(co['NOT_PSEUDO']);
		
		// skip whitespace
		left = left.slice( left.match(/^\s*/)[0].length );
		
		var m;
		switch ( left.charAt(0) ) {
			case '#'	: m = id_parser();		break;
			case '.'	: m = class_parser();	break;
			case '['	: m = attr_parser();	break;
			case ':'	: m = pseudo_parser();	break;
			default		: m = type_parser();	break;
		}
		
		// skip whitespace
		left = left.slice( left.match(/^\s*/)[0].length );
		
		if ( !m || left.charAt(0) != ')' ) return false;
		
		left = left.slice(1); // ')'.length == 1
		return true;
	},
	
	// combinator & comma parser
	extra_parser = function() {
		var arr;
		
		// Note: since whitespace represents a descendant combinator,
		// first check for comma and then for any of the combinators.
		// Otherwise you won't parse an expression like 'p , a' correctly
		// as the whitespace BEFORE , will be matched as a descendant combinator
		
		if ( (arr = left.match( re['comma'] )) !== null ) {
			left = left.slice(arr[0].length);
			parsed.push(co['COMMA']);
		}
		else if ( (arr = left.match( re['combinator'] )) !== null ) {
			left = left.slice(arr[0].length);
			
			switch ( arr[1] ) {
				case '>'	: parsed.push(co['CHILD']);				break;
				case '+'	: parsed.push(co['ADJACENT_SIBLING']);	break;
				case '~'	: parsed.push(co['GENERAL_SIBLING']);	break;
				default		: parsed.push(co['DESCENDANT']);		break;
			}
		}
		else err();
		
		// if you come here, you have successfully parsed a combinator or a comma
		// so now make sure that it doesn't end the input -- because AFTER a
		// comma or combinator, we must have something
		if ( !left.length ) err();
	};
	
	// Main method ---------------------------------------- //
	
	var parse = function(expr) {
		// strip extra whitespace
		left = String(expr).replace(/^\s*|\s*$/g,'');
		
		// don't accept empty selector
		if ( !left.length ) err();
		
		// init a new array in parsed
		parsed = [];
		
		// this loop does the parsing
		while ( true ) { simple_parser(); if ( left.length ) extra_parser(); else break; }
		
		// return the parsed representation
		return parsed;
	};
	
	// Normalize ---------------------------------------- //
	
	// see if NODE::nodeName is uppercase (true) or lowercase (false)
	var NODENAME_UPPERCASE = (function() {
		var e = document.createElement('div');
		return ( /DIV/.test(e.nodeName) );
	})();
	
	// Exports ---------------------------------------- //
	
	G.re = re;
	G.co = co;
	G.parse = parse;

})( Elfin );

