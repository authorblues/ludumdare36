var X_ACCEL = 2.5;
var X_MAXSPEED = 6;

var Y_ACCEL = 0.7;
var Y_MAXFALL = 18;
var Y_JUMP = 15;

var Y_BOUNCE = 16;
var Y_BOUNCE_LOW = 10;

var CHAR = 0;
var player;
var currentLevel;
var lastentrance;

var eps = 0.1;
function updatePlayer(delta)
{
	var p = player;

	p.curhealth -= p.environDamage();
	if (p.curhealth <= 0)
	{
		p.xspeed = 0;
		p.yspeed = 0;
		useExit(lastentrance);
		p.curhealth = p.maxhealth;
	}

	p.applyPhysics(delta);

	if (BUTTON_RIGHT in pressedButtons)
	{
		p.xspeed += p.friction * X_ACCEL;
		if (p.xspeed > X_MAXSPEED)
			p.xspeed = X_MAXSPEED;
		p.flipH = false;
	}
	else if (BUTTON_LEFT in pressedButtons)
	{
		p.xspeed -= p.friction * X_ACCEL;
		if (p.xspeed < -X_MAXSPEED)
			p.xspeed = -X_MAXSPEED;
		p.flipH = true;
	}
	else p.xspeed *= 1 - p.friction;

	if (BUTTON_JUMP in pressedButtons && (p.onground || (p.yspeed >= -8 && p.jumpsremaining > 0)))
	{
		p.yspeed = Y_JUMP * -(BUTTON_DOWN in pressedButtons ? 0.6 : 1.0);
		p.xspeed *= 1.2;
		p.jumpsremaining--;
	}

	if (BUTTON_DOWN in pressedButtons && p.onground && Math.abs(p.xspeed) < 0.3)
		p.state = STATE_DUCK;

	for (var k in currentLevel.objects)
	{
		var obj = currentLevel.objects[k];
		if (Math.floor(player.x) == obj.x && Math.floor(player.y-0.1) == obj.y)
		{
			if (obj.onpickup) obj.onpickup();
			delete currentLevel.objects[k];
		}
	}
}

function updateSprites(delta)
{
	currentLevel.updateSprites(delta);
}

function gameUpdate(delta)
{
	updatePlayer(delta);
	updateSprites(delta);

	for (var i = currentLevel.sprites.length - 1; i >= 0; --i)
	{
		var sprite = currentLevel.sprites[i];
		if (!sprite.alive)
		{
			if (currentLevel.timer > sprite.deathat)
				currentLevel.sprites.splice(i, 1);
			continue;
		}

		if (Math.abs(player.x - sprite.x) < 1.0
			&& Math.abs(player.y - sprite.y) < 1.0)
		{
			if (player.y < sprite.y && player.yspeed > eps)
			{
				sprite.die(currentLevel.timer);
				player.yspeed = BUTTON_JUMP in pressedButtons ? -Y_BOUNCE : -Y_BOUNCE_LOW;
			}
			else if (currentLevel.timer > player.invulnuntil)
			{
				player.jumpsremaining = 0;
				player.curhealth -= sprite.attack;
				if (sprite.attack) player.invulnuntil = currentLevel.timer + 2;
				if (player.onground) player.yspeed = -5;
				player.xspeed = Math.sign(sprite.x - player.x) * -10;
			}
		}
	}

	for (var i = 0; i < currentLevel.exits.length; ++i)
	{
		var exit = currentLevel.exits[i];
		if (player.x > exit.x && player.x < exit.x + exit.w && player.y > exit.y && player.y < exit.y + exit.h)
		{
			useExit(exit);
			break;
		}
	}
}

function gameRender(frame)
{
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	currentLevel.draw(ctx, frame, player, []);
	drawHUD(frame)
}

var heartTiles = [TILES[375], TILES[374], TILES[373]];
function drawHUD(frame)
{
	var y = 20, x = 20;
	TILES[169+CHAR].drawAsset(ctx, x, y);
	x += 45;

	for (var i = 0; i < player.maxhealth; i += 2, x += 45)
	{
		var h = Math.min(2, Math.max(player.curhealth - i, 0));
		heartTiles[h].drawAsset(ctx, x, y);
	}
}

var prev, frame;
function gameLoop()
{
	var now = Date.now();
	var delta = 25; //now - prev;

	updateControls();
	gameUpdate(delta / 1000);
	gameRender(++frame);

	prev = now;
	requestAnimationFrame(gameLoop);
}

function loadLoop()
{
	var gameloaded = true;
	for (var k in GAMEDATA.levels)
		if (GAMEDATA.levels[k].level && !GAMEDATA.levels[k].level.isLoaded())
			gameloaded = false;

	if (gameloaded)
	{
		prev = Date.now();
		frame = 0;

		lastentrance =
		player = new Player(
			{
				0: new Sprite([TILES[CHAR*30+28]], 1),
				1: new Sprite([TILES[CHAR*30+28], TILES[CHAR*30+29]], 8),
				2: new Sprite([TILES[CHAR*30+26]], 1),
				3: new Sprite([TILES[CHAR*30+23]], 1),
				4: new Sprite([TILES[CHAR*30+22]], 1),
			}
		);

		useExit(SPAWN);
		gameLoop();
	}
	else requestAnimationFrame(loadLoop);
	return;
}

var backgrounds =
{
	rocks: new ImageSource('images/rocks.png'),
	stars: new ImageSource('images/stars.png'),
};

var VTILE_BASE = 0;
var VTILE_TOPM = 1;
var VTILE_TOPL = 2;
var VTILE_TOPR = 3;
var VTILE_LONE = 4;

var tilesets =
{
	cave:
	{
		tiles: [  32,   3,   2,   4,   1, ],
		decor: [ 1*30+18, 3*30+17, 3*30+18, 20*30+4, 20*30+5, 15*30+5, 15*30+6, 15*30+7, 15*30+8, 15*30+9, 15*30+10, ],
	},
	icecave:
	{
		tiles: [ 512, 483, 482, 484, 481, ],
		decor: [ 1*30+17, 1*30+18, 20*30+0, 20*30+1, 20*30+2, ],
	},
	snowcave:
	{
		tiles: [  92,  63,  62,  64,  61, ],
		decor: [ 1*30+17, 1*30+18, 20*30+0, 20*30+1, 20*30+2 ],
	},
	outdoors:
	{
		tiles: [ 152, 123, 122, 124, 121, ],
		decor: [ 0*30+16, 0*30+17, 0*30+18, 1*30+16, 1*30+18, 21*30+13, 29*30+8, 29*30+9, ],
	},
}

var SPAWN = { target: 0, dx: 6.5, dy: 7 };
var GAMEDATA =
{
	levels:
	{
		0:
		{
			level: new Level('leveldata/0.level',
			{
				background: backgrounds.stars,
				assets:
				[
					{ asset: new ImageSource('images/assets/crashedship.png'), x: 60, y: 60 },
					// need a cavern background 714wide x 672tall
				],
				exits:
				[
					{ x: 101, y: 15, w: 5, h: 1, target: 1, dx: 4.5, dy: 0 },
				],
				tileset: tilesets.outdoors,
			}),
		},

		1:
		{
			level: new Level('leveldata/1.level',
			{
				background: backgrounds.rocks,
				assets:
				[
				],
				exits:
				[
					{ x: 0, y: 17, w: 1, h: 3, target: 2, dx: 113.5, dy: 10 },
					{ x: 39, y: 1, w: 1, h: 4, target: 3, dx: 0, dy: 0 },
				],
				tileset: tilesets.snowcave,
			}),
		},

		2:
		{
			level: new Level('leveldata/2.level',
			{
				background: backgrounds.rocks,
				assets:
				[
				],
				exits:
				[
					{ x: 114, y: 8, w: 1, h: 3, target: 1, dx: 1.5, dy: 19 },
					{ x: 0, y: 8, w: 1, h: 3, target: 3, dx: 18.5, dy: 5 },
				],
				tileset: tilesets.cave,
			}),
		},

		3:
		{
			level: new Level('leveldata/3.level',
			{
				background: backgrounds.rocks,
				assets:
				[
				],
				exits:
				[
					{ x: 19, y: 2, w: 1, h: 4, target: 2, dx: 1.5, dy: 10 },
					{ x: 0, y: 69, w: 1, h: 3, target: 4, dx: 18.5, dy: 13 },
				],
				tileset: tilesets.cave,
			}),
		},

		4:
		{
			level: new Level('leveldata/4.level',
			{
				background: backgrounds.rocks,
				assets:
				[
				],
				exits:
				[
					{ x: 19, y: 11, w: 1, h: 3, target: 3, dx: 1.5, dy: 71 },
				],
				tileset: tilesets.cave,
				objects:
				[
					{ asset: TILES[23*30+15], x: 9, y: 10,
						onpickup: function(){ player.maxjumps = 2; }, }, // umbrella lmao
				],
			}),
		},
	},
};

function useExit(exit)
{
	player.x = exit.dx;
	player.y = exit.dy;
	switchLevel(GAMEDATA.levels[exit.target].level);
	lastentrance = exit;
}

loadLoop();
