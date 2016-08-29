function Level(url, extend)
{
	var self = this;
	this.data = null;

	var client = new XMLHttpRequest();
	client.open('GET', url);
	client.onreadystatechange = function()
	{
		if (client.readyState == 4 && client.status == 200)
		{
			self.parse(client.responseText);
			if (self.ready) self.ready.call(self);
		}
	}
	client.send();

	this.w = 10000;
	this.h = 10000;

	this.camx = 0;
	this.camy = 0;

	this.assets = extend.assets || [];
	this.background = extend.background;
	this.exits = extend.exits || [];
	this.tileset = extend.tileset || tilesets.cave;

	this.objects = {};
	if (extend.objects) for (var i = 0; i < extend.objects.length; ++i)
	{
		var obj = this.objects[i] = extend.objects[i];
		obj.id = i;
	}

	this._sprites = [];
	this.timer = 0;
}

Level.prototype.isLoaded = function()
{
	if (!this.data) return false;
	for (var i = 0; i < this.assets.length; ++i)
		if (!this.assets[i].asset.ready) return false;
	if (this.background && !this.background.ready) return false;
	return true;
}

var LEVEL_MAP =
{
	' ': { type: 'air', zindex: 9999, empty: true },
	'G': // ground
	{
		type: 'ground',
		solid: true,
		friction: 0.50,
		zindex: 1,
		asset: function(x, y, level)
		{
			var z = level.tileset.tiles[VTILE_TOPM];

			if (y == 0 || level.data[y-1][x].type == 'ground')
				z = level.tileset.tiles[VTILE_BASE];
			else if (x > 0 && x < level.w-1 && level.data[y][x-1].empty && level.data[y][x+1].empty)
				z = level.tileset.tiles[VTILE_LONE];
			else if (x > 0 && level.data[y][x-1].empty)
				z = level.tileset.tiles[VTILE_TOPL];
			else if (x < level.w-1 && level.data[y][x+1].empty)
				z = level.tileset.tiles[VTILE_TOPR];

			return z;
		},
	},
	'I': { asset: 16*30+10, solid: true, friction: 0.05, zindex: 1, },
	',': // decor
	{
		type: 'decor',
		empty: true,
		zindex: -1,
		asset: function(x, y, level)
		{
			var decor = level.tileset.decor;
			return crandom.from(decor);
		},
	},
	'~': null,
	'*': // lava
	{
		type: 'lava',
		zindex: 1,
		asset: function(x, y, level)
		{
			if (y == 0 || level.data[y-1][x].type == 'lava') return 42;
			return 13;
		},
		damage: 9999,
	},
};

Level.prototype.parse = function(text)
{
	var rows = text.replace('\r', '').split('\n');
	this.data = [];

	for (var i = 0; i < rows.length; ++i)
	{
		var textrow = rows[i].trim(), row = [];
		if (!textrow.length) continue;
		for (var j = 0; j < textrow.length; ++j)
		{
			row.push(LEVEL_MAP[textrow[j] in LEVEL_MAP ? textrow[j] : ' ']);
			if (textrow[j] in ENEMY_MAP)
			{
				var cls = ENEMY_MAP[textrow[j]];
				var sprite = Object.create(cls.prototype);
				cls.call(sprite, j+0.5, i+1, textrow[j]);
				this._sprites.push(sprite);
			}
		}
		this.data.push(row);
	}

	this.h = this.data.length;
	this.w = this.data[0].length;

	this.drawdata = [];
	for (var y = 0; y < this.data.length; ++y)
	{
		var row = [];
		for (var x = 0; x < this.data[y].length; ++x)
		{
			var tile = getTile(this, y, x);
			var asset = tile.asset || 0;

			if (asset instanceof Function)
				asset = asset(x, y, this);
			row.push(asset);
		}

		this.drawdata.push(row);
	}
}

function switchLevel(newlevel)
{
	currentLevel = newlevel;
	currentLevel.reloadSprites();
}

Level.prototype.draw = function(ctx, frame, player, sprites)
{
	if (!this.data) return;

	if (this.background && this.background.ready)
	{
		var img = this.background.image;
		var x = Math.floor((currentLevel.camx / 3) % img.width);
		var y = Math.floor((currentLevel.camy / 5) % img.height);

		ctx.save();
		ctx.translate(-x, -y);
		ctx.fillStyle = ctx.createPattern(img, 'repeat');
		ctx.fillRect(0, 0, canvas.width*2, canvas.height*2);
		ctx.restore();
	}

	var w = TILES.w;
	var h = TILES.h;

	this.camx = (player.x * w) | 0;
	this.camy = (player.y * h) | 0;

	// try not to show out of bounds areas
	if (this.camx < canvas.width/2) this.camx = canvas.width/2;
	if (this.camx > this.w * w - canvas.width/2)
		this.camx = this.w * w - canvas.width/2;

	if (this.camy < canvas.height/2) this.camy = canvas.height/2;
	if (this.camy > this.h * h - canvas.height/2)
		this.camy = this.h * h - canvas.height/2;

	for (var i = 0; i < this.assets.length; ++i)
		ctx.drawImage(this.assets[i].asset.image,
			this.assets[i].x - this.camx + canvas.width/2,
			this.assets[i].y - this.camy + canvas.height/2);

	for (var i = 0; i < this.data.length; ++i)
	{
		var ty = i * h - this.camy;
		var ypos = ty + canvas.height/2;
		if (ypos < -h || ypos > canvas.height) continue;

		for (var j = 0; j < this.data[i].length; ++j)
		{
			var tx = j * w - this.camx;
			var xpos = tx + canvas.width/2;
			if (xpos < -w || xpos > canvas.width) continue;

			var tile = this.drawdata[i][j];
			if (tile)
			{
				ctx.translate(xpos, ypos);
				TILES[tile].draw(ctx);
				ctx.resetTransform();
			}
		}
	}

	for (var k in this.objects)
	{
		var obj = this.objects[k];

		var ty = obj.y * h - this.camy;
		var ypos = ty + canvas.height/2;
		if (ypos < -h || ypos > canvas.height) continue;

		var tx = obj.x * w - this.camx;
		var xpos = tx + canvas.width/2;
		if (xpos < -w || xpos > canvas.width) continue;

		ctx.translate(xpos, ypos);
		obj.asset.draw(ctx);
		ctx.resetTransform();
	}

	ctx.translate(
		Math.floor(player.x * w) - this.camx - w/2 + canvas.width/2,
		Math.floor(player.y * h) - this.camy - h   + canvas.height/2
	);
	player.draw(ctx, frame);
	ctx.resetTransform();

	for (var i = 0; i < this.sprites.length; ++i)
	{
		var sprite = this.sprites[i];
		ctx.translate(
			Math.floor(sprite.x * w) - this.camx - w/2 + canvas.width/2,
			Math.floor(sprite.y * h) - this.camy - h   + canvas.height/2
		);
		sprite.draw(ctx, frame);
		ctx.resetTransform();
	}
}

Level.prototype.reloadSprites = function()
{
	this.sprites = this._sprites.map(function(obj)
	{
		var x = Object.create(obj.constructor.prototype);
		for (var k in obj)
			if (obj.hasOwnProperty(k))
				x[k] = obj[k];

		Object.defineProperties(x,
		{
			xmin: { get: function(){ return this.x - 0.5; }},
			xmax: { get: function(){ return this.x + 0.5; }},
			ymin: { get: function(){ return this.y - 1.0; }},
			ymax: { get: function(){ return this.y; }},
		});
		return x;
	});
}

Level.prototype.updateSprites = function(delta)
{
	this.timer += delta;
	for (var i = 0; i < this.sprites.length; ++i)
	{
		this.sprites[i].update(this.timer);
		if (this.sprites[i].environDamage())
			this.sprites[i].die(this.timer);
	}
}

function getTile(lvl, y, x)
{
	y = Math.floor(Math.min(Math.max(0, Math.floor(y)), lvl.h-1));
	x = Math.floor(Math.min(Math.max(0, Math.floor(x)), lvl.w-1));
	return lvl.data[y][x] || LEVEL_MAP[' '];
}
