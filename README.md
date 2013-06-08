Elfin - a css selector engine - v1.0
==================================================

Elfin is a CSS3 selector engine for HTML documents written in pure JavaScript.

components:
Elfin.parse -- the parser
Elfin.get -- the getter


Building
--------------------------------------------------
Building Elfin is very simple in Linux/Mac. Just run the build script.

On Windows you have to do it manually -- copy the contents of 'src'
directory into a blank file in the order: init.js, parse.js, get.js, last.js.
Save it as elfin.js.


Usage
--------------------------------------------------
To get an array of elements corresponding toa CSS3 selector, do
`Elfin(expr, node)`
or
`Elfin.get(expr, node)`

To get a parsed representation for a CSS3 selector, do
`Elfin.parse(expr)`
This returns a array that contains the output of the parser.

To see the features/bugs Elfin has discovered, do a for-in on
`Elfin.has`


Test
--------------------------------------------------
For experimenting with Elfin, you don't need to build it. Just
run the tester app.

TODO
--------------------------------------------------
use Grunt build system




