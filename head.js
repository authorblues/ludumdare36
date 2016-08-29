var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = 800;
canvas.height = 600;
document.getElementById('container').appendChild(canvas);

var BUTTON_UP = 0,
	BUTTON_DOWN = 1,
	BUTTON_LEFT = 2,
	BUTTON_RIGHT = 3,
	BUTTON_JUMP = 4,
	BUTTON_KILL = 5;

var currentControl = 0;
var BUTTON_OPTIONS =
[
	{
		'desc': 'WASD for movement, SPACE to jump, ESC to kill self',
		'key_65': BUTTON_LEFT,
		'key_87': BUTTON_UP,
		'key_83': BUTTON_DOWN,
		'key_68': BUTTON_RIGHT,
		'key_32': BUTTON_JUMP,
		'key_27': BUTTON_KILL,
	},
	{
		'desc': 'Arrow keys for movement, SPACE to jump, ESC to kill self',
		'key_37': BUTTON_LEFT,
		'key_38': BUTTON_UP,
		'key_40': BUTTON_DOWN,
		'key_39': BUTTON_RIGHT,
		'key_32': BUTTON_JUMP,
		'key_27': BUTTON_KILL,
	},
	{
		'desc': 'Gamepad #1',
		'joy_0_14': BUTTON_LEFT,
		'joy_0_12': BUTTON_UP,
		'joy_0_13': BUTTON_DOWN,
		'joy_0_15': BUTTON_RIGHT,
		'joy_0_0': BUTTON_JUMP,
		'joy_0_3': BUTTON_KILL,
	},
	{
		'desc': 'ZQSD for movement, SPACE to jump, ESC to kill self',
		'key_81': BUTTON_LEFT,
		'key_90': BUTTON_UP,
		'key_83': BUTTON_DOWN,
		'key_68': BUTTON_RIGHT,
		'key_32': BUTTON_JUMP,
		'key_27': BUTTON_KILL,
	},
];

var controlinfo = document.getElementById('controlinfo');
var changecontrols = document.getElementById('changecontrols');

var BUTTON_MAPPING = BUTTON_OPTIONS[currentControl];
if (controlinfo) controlinfo.innerText = BUTTON_MAPPING.desc;

if (changecontrols) changecontrols.addEventListener("click", function()
{
	currentControl += 1;
	currentControl %= BUTTON_OPTIONS.length;
	BUTTON_MAPPING = BUTTON_OPTIONS[currentControl];
	if (controlinfo) controlinfo.innerText = BUTTON_MAPPING.desc;
	return false;
});

var pressedButtons = {};
var rawKeys = {};

addEventListener("keydown", function(e)
{
	var k = 'key_' + e.keyCode;
	if (k in BUTTON_MAPPING)
		pressedButtons[BUTTON_MAPPING[k]] = true;
	rawKeys[k] = true;
});

addEventListener("keyup", function(e)
{
	var k = 'key_' + e.keyCode;
	if (k in BUTTON_MAPPING)
		delete pressedButtons[BUTTON_MAPPING[k]];
	delete rawKeys[k];
});

function updateControls()
{
	var gamepads = navigator.getGamepads();
	for (var k in gamepads)
	{
		var gamepad = gamepads[k];
		if (!(gamepad instanceof Gamepad)) continue;

		for (var i = 0; i < gamepad.buttons.length; ++i)
		{
			var key = 'joy_' + k + '_' + i;
			if (gamepad.buttons[i].pressed)
				rawKeys[key] = true;
			else delete rawKeys[key];

			if (!(key in BUTTON_MAPPING)) continue;
			var btn = BUTTON_MAPPING[key];

			if (gamepad.buttons[i].pressed)
				pressedButtons[btn] = true;
			else delete pressedButtons[btn];
		}
	}
}

function ImageSource(src)
{
	var self = this;
	this.image = new Image();
	this.ready = false;
	this.image.onload = function()
	{
		self.ready = true;
	};
	this.image.src = src;
}

function ImageAsset(source, x, y, w, h)
{
	this.source = source;
	this.sx = x;
	this.sy = y;
	this.sw = w;
	this.sh = h;
}

ImageAsset.prototype.draw = function(ctx)
{
	ctx.drawImage(this.source.image,
		this.sx, this.sy, this.sw, this.sh,
		0, 0, this.sw, this.sh);
}

ImageAsset.prototype.drawAsset = function(ctx, x, y)
{
	ctx.translate(x, y);
	ctx.drawImage(this.source.image,
		this.sx, this.sy, this.sw, this.sh,
		0, 0, this.sw, this.sh);
	ctx.resetTransform();
}

function Sprite(frames, delay)
{
	this.frames = frames instanceof Array ? frames : [frames];
	this.framedelay = delay;
}

Sprite.prototype.draw = function(ctx, fh, fv, frame)
{
	frame = frame || 0;
	var asset = this.frames[Math.floor(frame / this.framedelay) % this.frames.length];
	if (fh || fv)
	{
		var cx = asset.sw / 2;
		var cy = asset.sh / 2;
		ctx.translate(+cx, +cy);
		ctx.scale(
			fh ? -1 : 1,
			fv ? -1 : 1
		);
		ctx.translate(-cx, -cy);
	}
	asset.draw(ctx);
}

var TILES = cutSpriteSheet(new ImageSource('images/spritesheet.png'), 4, 42, 42, 30, 30);
function cutSpriteSheet(source, padding, tilew, tileh, w, h)
{
	var tiles = [];
	for (var y = 0; y < h; ++y)
	{
		for (var x = 0; x < w; ++x)
		{
			var sx = padding + (tilew + padding) * x;
			var sy = padding + (tileh + padding) * y;
			tiles.push(new ImageAsset(source, sx, sy, tilew, tileh));
		}
	}

	tiles.w = tilew;
	tiles.h = tileh;
	return tiles;
}

function distWithin(a, b, d)
{
	var x = a.x - b.x;
	var y = a.y - b.y;
	return x*x + y*y < d*d;
}

// borrowed from github.com/isaacs/inherits
Function.prototype.inherits = function(base)
{
	// generate the prototype using Object.create
	// to avoid the gross side-effects of new X()
	this.prototype = Object.create(base.prototype,
	{
		constructor:
		{
			value: this,
			enumerable: false,
			writable: true,
			configurable: true
		}
	});

	this._parentclass = base;
	return this;
};

function Random(seed)
{ this.seed = Math.floor(seed || (Math.random() * 0xFFFFFFFF)) % 0xFFFFFFFF; }

Random.prototype.next = function(z)
{ return this.seed = ((214013 * this.seed + 2531011) & 0x7fffffff) >> 16; }

Random.prototype.nextFloat = function()
{ return this.next() / 0x7fff; }

Random.prototype.flipCoin = function(x)
{ return this.nextFloat() < x; }

Random.prototype.nextInt = function(z)
{ return (this.nextFloat() * z)|0; }

Random.prototype.nextIntRange = function(a, b)
{ return a + this.nextInt(b - a); }

Random.prototype.from = function(arr)
{ return arr[this.nextInt(arr.length)]; }

var crandom = new Random(16807);

requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame ||
	function(callback) { return window.setTimeout(callback, 1000 / 60); };
