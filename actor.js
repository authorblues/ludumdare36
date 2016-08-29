var STATE_IDLE = 0;
var STATE_WALK = 1;
var STATE_JUMP = 2;
var STATE_FALL = 3;
var STATE_DUCK = 4;
var STATE_DEAD = 5;

function Actor(sprites, x, y, z)
{
	this.sprites = sprites;
	this.state = STATE_IDLE;
	this.x = x;
	this.y = y;
	this.zindex = z;
	this.alive = true;

	this.flipH = false;
	this.flipV = false;

	this.physics = false;
	this.xspeed = 0;
	this.yspeed = 0;
	this.onground = true;
	this.friction = 0.2;
}

Actor.prototype.environDamage = function()
{
	var tile = getTile(currentLevel, this.y-0.5, this.x);
	return tile.damage ? tile.damage : 0;
}

Actor.prototype.applyPhysics = function(delta)
{
	this.friction = 0.2;
	var tileunder = getTile(currentLevel, this.y + eps, this.x);
	if ('friction' in tileunder) this.friction = tileunder.friction;

	this.x += this.xspeed * delta;

	this.yspeed += Y_ACCEL;
	if (this.yspeed > Y_MAXFALL)
		this.yspeed = Y_MAXFALL;
	this.y += this.yspeed * delta;

	if ((getTile(currentLevel, this.ymin, this.xmin + eps).solid && !getTile(currentLevel, this.ymin+1, this.xmin + eps).solid)
		|| (getTile(currentLevel, this.ymin, this.xmax - eps).solid && !getTile(currentLevel, this.ymin+1, this.xmax - eps).solid))
	{
		this.y -= this.yspeed * delta;
		this.yspeed *= 0.3;
	}

	if (this.onground =
		((getTile(currentLevel, this.ymax, this.xmin + eps).solid && !getTile(currentLevel, this.ymax-1, this.xmin + eps).solid)
		|| (getTile(currentLevel, this.ymax, this.xmax - eps).solid && !getTile(currentLevel, this.ymax-1, this.xmax - eps).solid)))
	{
		this.y = Math.floor(this.ymax);
		this.yspeed = 0;
		this.jumpsremaining = this.maxjumps;
	}

	if (this.xspeed < 0
		&& (getTile(currentLevel, this.ymax - eps, this.xmin).solid
		|| getTile(currentLevel, this.ymin + eps, this.xmin).solid))
	{
		this.x -= this.xspeed * delta;
		this.xspeed = 0;
	}
	if (this.xspeed > 0
		&& (getTile(currentLevel, this.ymax - eps, this.xmax).solid
		|| getTile(currentLevel, this.ymin + eps, this.xmax).solid))
	{
		this.x -= this.xspeed * delta;
		this.xspeed = 0;
	}

	this.state = STATE_IDLE;
	if (!this.alive) this.state = STATE_DEAD;
	else if (!this.onground)
		this.state = this.yspeed < 0 ? STATE_JUMP : STATE_FALL;
	else if (Math.abs(this.xspeed) > 0.2)
		this.state = STATE_WALK;
}

Actor.prototype.draw = function(ctx, frame)
{
	this.sprites[this.state].draw(ctx, this.flipH, this.flipV, frame);
}

function Player(sprites, x, y)
{
	Actor.call(this, sprites, x, y, 0);
	this.physics = true;

	this.maxhealth = 6;
	this.curhealth = 6;
	this.invulnuntil = 0;

	this.maxjumps = 0;
	this.jumpsremaining = this.maxjumps;

	Object.defineProperties(this,
	{
		xmin: { get: function(){ return this.x - 0.5; }},
		xmax: { get: function(){ return this.x + 0.5; }},
		ymin: { get: function(){ return this.y - 1.0; }},
		ymax: { get: function(){ return this.y; }},
	});
}

Player.inherits(Actor);

Player.prototype.draw = function()
{
	var tmp = ctx.globalAlpha;
	ctx.globalAlpha = 1.0;
	if (this.invulnuntil > currentLevel.timer)
		ctx.globalAlpha = 1.0 - (0.75 * (this.invulnuntil - currentLevel.timer) / 2);

	Actor.prototype.draw.apply(this, arguments);
	ctx.globalAlpha = tmp;
}

function Enemy(sprites, x, y)
{
	Actor.call(this, sprites, x, y, 0);
	this.xbase = x;
	this.ybase = y;
	this.deathat = -1;
}

Enemy.inherits(Actor);
Enemy.prototype.update = function(){ throw 'Not Implemented'; }

Enemy.prototype.die = function(timer)
{
	this.alive = false;
	this.state = STATE_DEAD;
	this.deathat = timer + 1.5;
}

function Spider(x, y, char)
{
	Enemy.call(this, Spider.sprites, x, y, 0);
	if (char == 'w') this.flipV = true;

	this.attack = 1;
}

Spider.inherits(Enemy);
Spider.sprites =
{
	0: new Sprite([TILES[15*30+20]], 1),
	1: new Sprite([TILES[15*30+22], TILES[15*30+20], TILES[15*30+21], TILES[15*30+20]], 4),
	5: new Sprite([TILES[15*30+23]], 1),
};

Spider.prototype.update = function(timer)
{
	if (!this.alive) return;

	timer %= 14;
	this.flipH = (timer < 2 || timer > 9);
	var prevx = this.x;

	if (timer < 2) this.x = this.xbase;
	else if (timer < 7) this.x = this.xbase - (3 * ((timer - 2) / 5));
	else if (timer < 9) this.x = this.xbase - 3;
	else this.x = this.xbase - (3 * ((14 - timer) / 5));

	this.state = this.x == prevx ? STATE_IDLE : STATE_WALK;
}

function Bat(x, y, char)
{
	Enemy.call(this, Bat.sprites, x, y, 0);
	this.ybase = y;

	this.awake = false;
	this.attack = 0;
	this.yspeed = 0.02;
	this.xspeed = 0.04;
	this.flaptimer = 0;
}

Bat.inherits(Enemy);
Bat.sprites =
{
	0: new Sprite([TILES[14*30+20]], 1),
	1: new Sprite([TILES[14*30+22], TILES[14*30+21]], 8),
	5: new Sprite([TILES[14*30+23]], 1),
};

Bat.prototype.update = function(timer)
{
	if (!this.alive) { this.y += 0.2; return; }
	if (distWithin(player, this, 4)) this.awake = true;
	this.state = !this.awake ? STATE_IDLE : STATE_WALK;

	if (this.awake)
	{
		this.flaptimer += 0.2;
		this.flaptimer %= Math.PI;

		var xaim = player.x, yaim = player.y - 0.8;
		var xgap = Math.abs(this.x - xaim);
		var ygap = Math.abs(this.y - yaim);

		if (this.x < xaim) this.x += Math.min(this.xspeed, xgap);
		if (this.x > xaim) this.x -= Math.min(this.xspeed, xgap);
		this.flipH = this.x < xaim;

		if (this.ybase < yaim) this.ybase += Math.min(this.yspeed*3, ygap);
		if (this.ybase > yaim) this.ybase -= Math.min(this.yspeed, ygap);
		this.y = this.ybase + 0.3*Math.sin(this.flaptimer);
	}
}

function Slime(x, y, char)
{
	Enemy.call(this, Slime.sprites, x, y, 0);

	this.awake = false;
	this.attack = 0;
	this.lasttimer = 0;
	this.dir = 0;
}

Slime.inherits(Enemy);
Slime.sprites =
{
	0: new Sprite([TILES[8*30+20]], 1),
	1: new Sprite([TILES[8*30+20], TILES[8*30+21], TILES[8*30+19], TILES[8*30+21]], 4),
	2: new Sprite([TILES[8*30+20]], 1),
	3: new Sprite([TILES[8*30+21]], 1),
	5: new Sprite([TILES[8*30+19]], 1),
};

Slime.prototype.update = function(timer)
{
	if (distWithin(player, this, 8)) this.awake = true;
	if (!distWithin(player, this, 16)) this.awake = false;

	if (this.awake && this.alive)
	{
		timer %= 2.5;
		if (timer < this.lasttimer && this.onground)
		{
			this.yspeed = -14;
			this.dir = Math.sign(player.x - this.x);
			this.flipH = this.x < player.x;
		}

		if (!this.onground)
			this.xspeed = 5 * this.dir;
		this.lasttimer = timer;
	}

	this.xspeed *= 1 - this.friction;
	this.applyPhysics(25/1000);
}

var ENEMY_MAP =
{
	'm': Spider,
	'w': Spider,
	'b': Bat,
	's': Slime,
};
