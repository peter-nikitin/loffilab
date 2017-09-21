/**
 * Owl Carousel v2.2.1
 * Copyright 2013-2017 David Deutsch
 * Licensed under  ()
 */
/**
 * Owl carousel
 * @version 2.1.6
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from beeing retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat--) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			if (this.settings.center) {
				this.$stage.children('.center').removeClass('center');
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + ' class="' + this.settings.stageClass + '"/>')
			.wrap('<div class="' + this.settings.stageOuterClass + '"/>');

		// append stage
		this.$element.append(this.$stage.parent());

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.$element.is(':visible')) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.$element.is(':visible')) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] || value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's'
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			reciprocalItemsWidth = this._items[--iterator].width();
			elementWidth = this.$element.width();
			while (iterator--) {
				reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
				if (reciprocalItemsWidth > elementWidth) {
					break;
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.$element.is(':visible')) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();

		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.$element.is(':visible');
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.$element.is(':visible') === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
				url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name == 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'style="width:' + video.width + 'px;height:' + video.height + 'px;"' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = '<div class="owl-video-tn ' + lazyClass + '" ' + srcType + '="' + path + '"></div>';
				} else {
					tnLink = '<div class="owl-video-tn" style="opacity:1;background-image:url(' + path + ')"></div>';
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap('<div class="owl-video-wrapper"' + dimensions + '></div>');

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		if (video.type === 'youtube') {
			html = '<iframe width="' + width + '" height="' + height + '" src="//www.youtube.com/embed/' +
				video.id + '?autoplay=1&rel=0&v=' + video.id + '" frameborder="0" allowfullscreen></iframe>';
		} else if (video.type === 'vimeo') {
			html = '<iframe src="//player.vimeo.com/video/' + video.id +
				'?autoplay=1" width="' + width + '" height="' + height +
				'" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
		} else if (video.type === 'vzaar') {
			html = '<iframe frameborder="0"' + 'height="' + height + '"' + 'width="' + width +
				'" allowfullscreen mozallowfullscreen webkitAllowFullScreen ' +
				'src="//view.vzaar.com/' + video.id + '/player?autoplay=true"></iframe>';
		}

		$('<div class="owl-video-frame">' + html + '</div>').insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.1.0
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout.
		 * @type {Timeout}
		 */
		this._timeout = null;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = false;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position') {
					//console.log('play?', e);
					if (this._core.settings.autoplay) {
						this._setAutoPlayInterval();
					}
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		this._paused = false;

		if (this._core.is('rotating')) {
			return;
		}

		this._core.enter('rotating');

		this._setAutoPlayInterval();
	};

	/**
	 * Gets a new timeout
	 * @private
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 * @return {Timeout}
	 */
	Autoplay.prototype._getNextTimeout = function(timeout, speed) {
		if ( this._timeout ) {
			window.clearTimeout(this._timeout);
		}
		return window.setTimeout($.proxy(function() {
			if (this._paused || this._core.is('busy') || this._core.is('interacting') || document.hidden) {
				return;
			}
			this._core.next(speed || this._core.settings.autoplaySpeed);
		}, this), timeout || this._core.settings.autoplayTimeout);
	};

	/**
	 * Sets autoplay in motion.
	 * @private
	 */
	Autoplay.prototype._setAutoPlayInterval = function() {
		this._timeout = this._getNextTimeout();
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		window.clearTimeout(this._timeout);
		this._core.leave('rotating');
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (!this._core.is('rotating')) {
			return;
		}

		this._paused = true;
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [ 'prev', 'next' ],
		navSpeed: false,
		navElement: 'div',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [ 'owl-prev', 'owl-next' ],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<div>')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'div', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			this._controls[control].remove();
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.1.0
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.1.0
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);
/*!
 * Fotorama 4.6.4 | http://fotorama.io/license/
 */
fotoramaVersion="4.6.4",function(a,b,c,d,e){"use strict";function f(a){var b="bez_"+d.makeArray(arguments).join("_").replace(".","p");if("function"!=typeof d.easing[b]){var c=function(a,b){var c=[null,null],d=[null,null],e=[null,null],f=function(f,g){return e[g]=3*a[g],d[g]=3*(b[g]-a[g])-e[g],c[g]=1-e[g]-d[g],f*(e[g]+f*(d[g]+f*c[g]))},g=function(a){return e[0]+a*(2*d[0]+3*c[0]*a)},h=function(a){for(var b,c=a,d=0;++d<14&&(b=f(c,0)-a,!(Math.abs(b)<.001));)c-=b/g(c);return c};return function(a){return f(h(a),1)}};d.easing[b]=function(b,d,e,f,g){return f*c([a[0],a[1]],[a[2],a[3]])(d/g)+e}}return b}function g(){}function h(a,b,c){return Math.max(isNaN(b)?-1/0:b,Math.min(isNaN(c)?1/0:c,a))}function i(a){return a.match(/ma/)&&a.match(/-?\d+(?!d)/g)[a.match(/3d/)?12:4]}function j(a){return Ic?+i(a.css("transform")):+a.css("left").replace("px","")}function k(a){var b={};return Ic?b.transform="translate3d("+a+"px,0,0)":b.left=a,b}function l(a){return{"transition-duration":a+"ms"}}function m(a,b){return isNaN(a)?b:a}function n(a,b){return m(+String(a).replace(b||"px",""))}function o(a){return/%$/.test(a)?n(a,"%"):e}function p(a,b){return m(o(a)/100*b,n(a))}function q(a){return(!isNaN(n(a))||!isNaN(n(a,"%")))&&a}function r(a,b,c,d){return(a-(d||0))*(b+(c||0))}function s(a,b,c,d){return-Math.round(a/(b+(c||0))-(d||0))}function t(a){var b=a.data();if(!b.tEnd){var c=a[0],d={WebkitTransition:"webkitTransitionEnd",MozTransition:"transitionend",OTransition:"oTransitionEnd otransitionend",msTransition:"MSTransitionEnd",transition:"transitionend"};T(c,d[uc.prefixed("transition")],function(a){b.tProp&&a.propertyName.match(b.tProp)&&b.onEndFn()}),b.tEnd=!0}}function u(a,b,c,d){var e,f=a.data();f&&(f.onEndFn=function(){e||(e=!0,clearTimeout(f.tT),c())},f.tProp=b,clearTimeout(f.tT),f.tT=setTimeout(function(){f.onEndFn()},1.5*d),t(a))}function v(a,b){if(a.length){var c=a.data();Ic?(a.css(l(0)),c.onEndFn=g,clearTimeout(c.tT)):a.stop();var d=w(b,function(){return j(a)});return a.css(k(d)),d}}function w(){for(var a,b=0,c=arguments.length;c>b&&(a=b?arguments[b]():arguments[b],"number"!=typeof a);b++);return a}function x(a,b){return Math.round(a+(b-a)/1.5)}function y(){return y.p=y.p||("https:"===c.protocol?"https://":"http://"),y.p}function z(a){var c=b.createElement("a");return c.href=a,c}function A(a,b){if("string"!=typeof a)return a;a=z(a);var c,d;if(a.host.match(/youtube\.com/)&&a.search){if(c=a.search.split("v=")[1]){var e=c.indexOf("&");-1!==e&&(c=c.substring(0,e)),d="youtube"}}else a.host.match(/youtube\.com|youtu\.be/)?(c=a.pathname.replace(/^\/(embed\/|v\/)?/,"").replace(/\/.*/,""),d="youtube"):a.host.match(/vimeo\.com/)&&(d="vimeo",c=a.pathname.replace(/^\/(video\/)?/,"").replace(/\/.*/,""));return c&&d||!b||(c=a.href,d="custom"),c?{id:c,type:d,s:a.search.replace(/^\?/,""),p:y()}:!1}function B(a,b,c){var e,f,g=a.video;return"youtube"===g.type?(f=y()+"img.youtube.com/vi/"+g.id+"/default.jpg",e=f.replace(/\/default.jpg$/,"/hqdefault.jpg"),a.thumbsReady=!0):"vimeo"===g.type?d.ajax({url:y()+"vimeo.com/api/v2/video/"+g.id+".json",dataType:"jsonp",success:function(d){a.thumbsReady=!0,C(b,{img:d[0].thumbnail_large,thumb:d[0].thumbnail_small},a.i,c)}}):a.thumbsReady=!0,{img:e,thumb:f}}function C(a,b,c,e){for(var f=0,g=a.length;g>f;f++){var h=a[f];if(h.i===c&&h.thumbsReady){var i={videoReady:!0};i[Xc]=i[Zc]=i[Yc]=!1,e.splice(f,1,d.extend({},h,i,b));break}}}function D(a){function b(a,b,e){var f=a.children("img").eq(0),g=a.attr("href"),h=a.attr("src"),i=f.attr("src"),j=b.video,k=e?A(g,j===!0):!1;k?g=!1:k=j,c(a,f,d.extend(b,{video:k,img:b.img||g||h||i,thumb:b.thumb||i||h||g}))}function c(a,b,c){var e=c.thumb&&c.img!==c.thumb,f=n(c.width||a.attr("width")),g=n(c.height||a.attr("height"));d.extend(c,{width:f,height:g,thumbratio:S(c.thumbratio||n(c.thumbwidth||b&&b.attr("width")||e||f)/n(c.thumbheight||b&&b.attr("height")||e||g))})}var e=[];return a.children().each(function(){var a=d(this),f=R(d.extend(a.data(),{id:a.attr("id")}));if(a.is("a, img"))b(a,f,!0);else{if(a.is(":empty"))return;c(a,null,d.extend(f,{html:this,_html:a.html()}))}e.push(f)}),e}function E(a){return 0===a.offsetWidth&&0===a.offsetHeight}function F(a){return!d.contains(b.documentElement,a)}function G(a,b,c,d){return G.i||(G.i=1,G.ii=[!0]),d=d||G.i,"undefined"==typeof G.ii[d]&&(G.ii[d]=!0),a()?b():G.ii[d]&&setTimeout(function(){G.ii[d]&&G(a,b,c,d)},c||100),G.i++}function H(a){c.replace(c.protocol+"//"+c.host+c.pathname.replace(/^\/?/,"/")+c.search+"#"+a)}function I(a,b,c,d){var e=a.data(),f=e.measures;if(f&&(!e.l||e.l.W!==f.width||e.l.H!==f.height||e.l.r!==f.ratio||e.l.w!==b.w||e.l.h!==b.h||e.l.m!==c||e.l.p!==d)){var g=f.width,i=f.height,j=b.w/b.h,k=f.ratio>=j,l="scaledown"===c,m="contain"===c,n="cover"===c,o=$(d);k&&(l||m)||!k&&n?(g=h(b.w,0,l?g:1/0),i=g/f.ratio):(k&&n||!k&&(l||m))&&(i=h(b.h,0,l?i:1/0),g=i*f.ratio),a.css({width:g,height:i,left:p(o.x,b.w-g),top:p(o.y,b.h-i)}),e.l={W:f.width,H:f.height,r:f.ratio,w:b.w,h:b.h,m:c,p:d}}return!0}function J(a,b){var c=a[0];c.styleSheet?c.styleSheet.cssText=b:a.html(b)}function K(a,b,c){return b===c?!1:b>=a?"left":a>=c?"right":"left right"}function L(a,b,c,d){if(!c)return!1;if(!isNaN(a))return a-(d?0:1);for(var e,f=0,g=b.length;g>f;f++){var h=b[f];if(h.id===a){e=f;break}}return e}function M(a,b,c){c=c||{},a.each(function(){var a,e=d(this),f=e.data();f.clickOn||(f.clickOn=!0,d.extend(cb(e,{onStart:function(b){a=b,(c.onStart||g).call(this,b)},onMove:c.onMove||g,onTouchEnd:c.onTouchEnd||g,onEnd:function(c){c.moved||b.call(this,a)}}),{noMove:!0}))})}function N(a,b){return'<div class="'+a+'">'+(b||"")+"</div>"}function O(a){for(var b=a.length;b;){var c=Math.floor(Math.random()*b--),d=a[b];a[b]=a[c],a[c]=d}return a}function P(a){return"[object Array]"==Object.prototype.toString.call(a)&&d.map(a,function(a){return d.extend({},a)})}function Q(a,b,c){a.scrollLeft(b||0).scrollTop(c||0)}function R(a){if(a){var b={};return d.each(a,function(a,c){b[a.toLowerCase()]=c}),b}}function S(a){if(a){var b=+a;return isNaN(b)?(b=a.split("/"),+b[0]/+b[1]||e):b}}function T(a,b,c,d){b&&(a.addEventListener?a.addEventListener(b,c,!!d):a.attachEvent("on"+b,c))}function U(a){return!!a.getAttribute("disabled")}function V(a){return{tabindex:-1*a+"",disabled:a}}function W(a,b){T(a,"keyup",function(c){U(a)||13==c.keyCode&&b.call(a,c)})}function X(a,b){T(a,"focus",a.onfocusin=function(c){b.call(a,c)},!0)}function Y(a,b){a.preventDefault?a.preventDefault():a.returnValue=!1,b&&a.stopPropagation&&a.stopPropagation()}function Z(a){return a?">":"<"}function $(a){return a=(a+"").split(/\s+/),{x:q(a[0])||bd,y:q(a[1])||bd}}function _(a,b){var c=a.data(),e=Math.round(b.pos),f=function(){c.sliding=!1,(b.onEnd||g)()};"undefined"!=typeof b.overPos&&b.overPos!==b.pos&&(e=b.overPos,f=function(){_(a,d.extend({},b,{overPos:b.pos,time:Math.max(Qc,b.time/2)}))});var h=d.extend(k(e),b.width&&{width:b.width});c.sliding=!0,Ic?(a.css(d.extend(l(b.time),h)),b.time>10?u(a,"transform",f,b.time):f()):a.stop().animate(h,b.time,_c,f)}function ab(a,b,c,e,f,h){var i="undefined"!=typeof h;if(i||(f.push(arguments),Array.prototype.push.call(arguments,f.length),!(f.length>1))){a=a||d(a),b=b||d(b);var j=a[0],k=b[0],l="crossfade"===e.method,m=function(){if(!m.done){m.done=!0;var a=(i||f.shift())&&f.shift();a&&ab.apply(this,a),(e.onEnd||g)(!!a)}},n=e.time/(h||1);c.removeClass(Rb+" "+Qb),a.stop().addClass(Rb),b.stop().addClass(Qb),l&&k&&a.fadeTo(0,0),a.fadeTo(l?n:0,1,l&&m),b.fadeTo(n,0,m),j&&l||k||m()}}function bb(a){var b=(a.touches||[])[0]||a;a._x=b.pageX,a._y=b.clientY,a._now=d.now()}function cb(a,c){function e(a){return m=d(a.target),u.checked=p=q=s=!1,k||u.flow||a.touches&&a.touches.length>1||a.which>1||ed&&ed.type!==a.type&&gd||(p=c.select&&m.is(c.select,t))?p:(o="touchstart"===a.type,q=m.is("a, a *",t),n=u.control,r=u.noMove||u.noSwipe||n?16:u.snap?0:4,bb(a),l=ed=a,fd=a.type.replace(/down|start/,"move").replace(/Down/,"Move"),(c.onStart||g).call(t,a,{control:n,$target:m}),k=u.flow=!0,void((!o||u.go)&&Y(a)))}function f(a){if(a.touches&&a.touches.length>1||Nc&&!a.isPrimary||fd!==a.type||!k)return k&&h(),void(c.onTouchEnd||g)();bb(a);var b=Math.abs(a._x-l._x),d=Math.abs(a._y-l._y),e=b-d,f=(u.go||u.x||e>=0)&&!u.noSwipe,i=0>e;o&&!u.checked?(k=f)&&Y(a):(Y(a),(c.onMove||g).call(t,a,{touch:o})),!s&&Math.sqrt(Math.pow(b,2)+Math.pow(d,2))>r&&(s=!0),u.checked=u.checked||f||i}function h(a){(c.onTouchEnd||g)();var b=k;u.control=k=!1,b&&(u.flow=!1),!b||q&&!u.checked||(a&&Y(a),gd=!0,clearTimeout(hd),hd=setTimeout(function(){gd=!1},1e3),(c.onEnd||g).call(t,{moved:s,$target:m,control:n,touch:o,startEvent:l,aborted:!a||"MSPointerCancel"===a.type}))}function i(){u.flow||setTimeout(function(){u.flow=!0},10)}function j(){u.flow&&setTimeout(function(){u.flow=!1},Pc)}var k,l,m,n,o,p,q,r,s,t=a[0],u={};return Nc?(T(t,"MSPointerDown",e),T(b,"MSPointerMove",f),T(b,"MSPointerCancel",h),T(b,"MSPointerUp",h)):(T(t,"touchstart",e),T(t,"touchmove",f),T(t,"touchend",h),T(b,"touchstart",i),T(b,"touchend",j),T(b,"touchcancel",j),Ec.on("scroll",j),a.on("mousedown",e),Fc.on("mousemove",f).on("mouseup",h)),a.on("click","a",function(a){u.checked&&Y(a)}),u}function db(a,b){function c(c,d){A=!0,j=l=c._x,q=c._now,p=[[q,j]],m=n=D.noMove||d?0:v(a,(b.getPos||g)()),(b.onStart||g).call(B,c)}function e(a,b){s=D.min,t=D.max,u=D.snap,w=a.altKey,A=z=!1,y=b.control,y||C.sliding||c(a)}function f(d,e){D.noSwipe||(A||c(d),l=d._x,p.push([d._now,l]),n=m-(j-l),o=K(n,s,t),s>=n?n=x(n,s):n>=t&&(n=x(n,t)),D.noMove||(a.css(k(n)),z||(z=!0,e.touch||Nc||a.addClass(ec)),(b.onMove||g).call(B,d,{pos:n,edge:o})))}function i(e){if(!D.noSwipe||!e.moved){A||c(e.startEvent,!0),e.touch||Nc||a.removeClass(ec),r=d.now();for(var f,i,j,k,o,q,v,x,y,z=r-Pc,C=null,E=Qc,F=b.friction,G=p.length-1;G>=0;G--){if(f=p[G][0],i=Math.abs(f-z),null===C||j>i)C=f,k=p[G][1];else if(C===z||i>j)break;j=i}v=h(n,s,t);var H=k-l,I=H>=0,J=r-C,K=J>Pc,L=!K&&n!==m&&v===n;u&&(v=h(Math[L?I?"floor":"ceil":"round"](n/u)*u,s,t),s=t=v),L&&(u||v===n)&&(y=-(H/J),E*=h(Math.abs(y),b.timeLow,b.timeHigh),o=Math.round(n+y*E/F),u||(v=o),(!I&&o>t||I&&s>o)&&(q=I?s:t,x=o-q,u||(v=q),x=h(v+.03*x,q-50,q+50),E=Math.abs((n-x)/(y/F)))),E*=w?10:1,(b.onEnd||g).call(B,d.extend(e,{moved:e.moved||K&&u,pos:n,newPos:v,overPos:x,time:E}))}}var j,l,m,n,o,p,q,r,s,t,u,w,y,z,A,B=a[0],C=a.data(),D={};return D=d.extend(cb(b.$wrap,d.extend({},b,{onStart:e,onMove:f,onEnd:i})),D)}function eb(a,b){var c,e,f,h=a[0],i={prevent:{}};return T(h,Oc,function(a){var h=a.wheelDeltaY||-1*a.deltaY||0,j=a.wheelDeltaX||-1*a.deltaX||0,k=Math.abs(j)&&!Math.abs(h),l=Z(0>j),m=e===l,n=d.now(),o=Pc>n-f;e=l,f=n,k&&i.ok&&(!i.prevent[l]||c)&&(Y(a,!0),c&&m&&o||(b.shift&&(c=!0,clearTimeout(i.t),i.t=setTimeout(function(){c=!1},Rc)),(b.onEnd||g)(a,b.shift?l:j)))}),i}function fb(){d.each(d.Fotorama.instances,function(a,b){b.index=a})}function gb(a){d.Fotorama.instances.push(a),fb()}function hb(a){d.Fotorama.instances.splice(a.index,1),fb()}var ib="fotorama",jb="fullscreen",kb=ib+"__wrap",lb=kb+"--css2",mb=kb+"--css3",nb=kb+"--video",ob=kb+"--fade",pb=kb+"--slide",qb=kb+"--no-controls",rb=kb+"--no-shadows",sb=kb+"--pan-y",tb=kb+"--rtl",ub=kb+"--only-active",vb=kb+"--no-captions",wb=kb+"--toggle-arrows",xb=ib+"__stage",yb=xb+"__frame",zb=yb+"--video",Ab=xb+"__shaft",Bb=ib+"__grab",Cb=ib+"__pointer",Db=ib+"__arr",Eb=Db+"--disabled",Fb=Db+"--prev",Gb=Db+"--next",Hb=ib+"__nav",Ib=Hb+"-wrap",Jb=Hb+"__shaft",Kb=Hb+"--dots",Lb=Hb+"--thumbs",Mb=Hb+"__frame",Nb=Mb+"--dot",Ob=Mb+"--thumb",Pb=ib+"__fade",Qb=Pb+"-front",Rb=Pb+"-rear",Sb=ib+"__shadow",Tb=Sb+"s",Ub=Tb+"--left",Vb=Tb+"--right",Wb=ib+"__active",Xb=ib+"__select",Yb=ib+"--hidden",Zb=ib+"--fullscreen",$b=ib+"__fullscreen-icon",_b=ib+"__error",ac=ib+"__loading",bc=ib+"__loaded",cc=bc+"--full",dc=bc+"--img",ec=ib+"__grabbing",fc=ib+"__img",gc=fc+"--full",hc=ib+"__dot",ic=ib+"__thumb",jc=ic+"-border",kc=ib+"__html",lc=ib+"__video",mc=lc+"-play",nc=lc+"-close",oc=ib+"__caption",pc=ib+"__caption__wrap",qc=ib+"__spinner",rc='" tabindex="0" role="button',sc=d&&d.fn.jquery.split(".");if(!sc||sc[0]<1||1==sc[0]&&sc[1]<8)throw"Fotorama requires jQuery 1.8 or later and will not run without it.";var tc={},uc=function(a,b,c){function d(a){r.cssText=a}function e(a,b){return typeof a===b}function f(a,b){return!!~(""+a).indexOf(b)}function g(a,b){for(var d in a){var e=a[d];if(!f(e,"-")&&r[e]!==c)return"pfx"==b?e:!0}return!1}function h(a,b,d){for(var f in a){var g=b[a[f]];if(g!==c)return d===!1?a[f]:e(g,"function")?g.bind(d||b):g}return!1}function i(a,b,c){var d=a.charAt(0).toUpperCase()+a.slice(1),f=(a+" "+u.join(d+" ")+d).split(" ");return e(b,"string")||e(b,"undefined")?g(f,b):(f=(a+" "+v.join(d+" ")+d).split(" "),h(f,b,c))}var j,k,l,m="2.6.2",n={},o=b.documentElement,p="modernizr",q=b.createElement(p),r=q.style,s=({}.toString," -webkit- -moz- -o- -ms- ".split(" ")),t="Webkit Moz O ms",u=t.split(" "),v=t.toLowerCase().split(" "),w={},x=[],y=x.slice,z=function(a,c,d,e){var f,g,h,i,j=b.createElement("div"),k=b.body,l=k||b.createElement("body");if(parseInt(d,10))for(;d--;)h=b.createElement("div"),h.id=e?e[d]:p+(d+1),j.appendChild(h);return f=["&#173;",'<style id="s',p,'">',a,"</style>"].join(""),j.id=p,(k?j:l).innerHTML+=f,l.appendChild(j),k||(l.style.background="",l.style.overflow="hidden",i=o.style.overflow,o.style.overflow="hidden",o.appendChild(l)),g=c(j,a),k?j.parentNode.removeChild(j):(l.parentNode.removeChild(l),o.style.overflow=i),!!g},A={}.hasOwnProperty;l=e(A,"undefined")||e(A.call,"undefined")?function(a,b){return b in a&&e(a.constructor.prototype[b],"undefined")}:function(a,b){return A.call(a,b)},Function.prototype.bind||(Function.prototype.bind=function(a){var b=this;if("function"!=typeof b)throw new TypeError;var c=y.call(arguments,1),d=function(){if(this instanceof d){var e=function(){};e.prototype=b.prototype;var f=new e,g=b.apply(f,c.concat(y.call(arguments)));return Object(g)===g?g:f}return b.apply(a,c.concat(y.call(arguments)))};return d}),w.csstransforms3d=function(){var a=!!i("perspective");return a};for(var B in w)l(w,B)&&(k=B.toLowerCase(),n[k]=w[B](),x.push((n[k]?"":"no-")+k));return n.addTest=function(a,b){if("object"==typeof a)for(var d in a)l(a,d)&&n.addTest(d,a[d]);else{if(a=a.toLowerCase(),n[a]!==c)return n;b="function"==typeof b?b():b,"undefined"!=typeof enableClasses&&enableClasses&&(o.className+=" "+(b?"":"no-")+a),n[a]=b}return n},d(""),q=j=null,n._version=m,n._prefixes=s,n._domPrefixes=v,n._cssomPrefixes=u,n.testProp=function(a){return g([a])},n.testAllProps=i,n.testStyles=z,n.prefixed=function(a,b,c){return b?i(a,b,c):i(a,"pfx")},n}(a,b),vc={ok:!1,is:function(){return!1},request:function(){},cancel:function(){},event:"",prefix:""},wc="webkit moz o ms khtml".split(" ");if("undefined"!=typeof b.cancelFullScreen)vc.ok=!0;else for(var xc=0,yc=wc.length;yc>xc;xc++)if(vc.prefix=wc[xc],"undefined"!=typeof b[vc.prefix+"CancelFullScreen"]){vc.ok=!0;break}vc.ok&&(vc.event=vc.prefix+"fullscreenchange",vc.is=function(){switch(this.prefix){case"":return b.fullScreen;case"webkit":return b.webkitIsFullScreen;default:return b[this.prefix+"FullScreen"]}},vc.request=function(a){return""===this.prefix?a.requestFullScreen():a[this.prefix+"RequestFullScreen"]()},vc.cancel=function(){return""===this.prefix?b.cancelFullScreen():b[this.prefix+"CancelFullScreen"]()});var zc,Ac={lines:12,length:5,width:2,radius:7,corners:1,rotate:15,color:"rgba(128, 128, 128, .75)",hwaccel:!0},Bc={top:"auto",left:"auto",className:""};!function(a,b){zc=b()}(this,function(){function a(a,c){var d,e=b.createElement(a||"div");for(d in c)e[d]=c[d];return e}function c(a){for(var b=1,c=arguments.length;c>b;b++)a.appendChild(arguments[b]);return a}function d(a,b,c,d){var e=["opacity",b,~~(100*a),c,d].join("-"),f=.01+c/d*100,g=Math.max(1-(1-a)/b*(100-f),a),h=m.substring(0,m.indexOf("Animation")).toLowerCase(),i=h&&"-"+h+"-"||"";return o[e]||(p.insertRule("@"+i+"keyframes "+e+"{0%{opacity:"+g+"}"+f+"%{opacity:"+a+"}"+(f+.01)+"%{opacity:1}"+(f+b)%100+"%{opacity:"+a+"}100%{opacity:"+g+"}}",p.cssRules.length),o[e]=1),e}function f(a,b){var c,d,f=a.style;for(b=b.charAt(0).toUpperCase()+b.slice(1),d=0;d<n.length;d++)if(c=n[d]+b,f[c]!==e)return c;return f[b]!==e?b:void 0}function g(a,b){for(var c in b)a.style[f(a,c)||c]=b[c];return a}function h(a){for(var b=1;b<arguments.length;b++){var c=arguments[b];for(var d in c)a[d]===e&&(a[d]=c[d])}return a}function i(a){for(var b={x:a.offsetLeft,y:a.offsetTop};a=a.offsetParent;)b.x+=a.offsetLeft,b.y+=a.offsetTop;return b}function j(a,b){return"string"==typeof a?a:a[b%a.length]}function k(a){return"undefined"==typeof this?new k(a):void(this.opts=h(a||{},k.defaults,q))}function l(){function b(b,c){return a("<"+b+' xmlns="urn:schemas-microsoft.com:vml" class="spin-vml">',c)}p.addRule(".spin-vml","behavior:url(#default#VML)"),k.prototype.lines=function(a,d){function e(){return g(b("group",{coordsize:k+" "+k,coordorigin:-i+" "+-i}),{width:k,height:k})}function f(a,f,h){c(m,c(g(e(),{rotation:360/d.lines*a+"deg",left:~~f}),c(g(b("roundrect",{arcsize:d.corners}),{width:i,height:d.width,left:d.radius,top:-d.width>>1,filter:h}),b("fill",{color:j(d.color,a),opacity:d.opacity}),b("stroke",{opacity:0}))))}var h,i=d.length+d.width,k=2*i,l=2*-(d.width+d.length)+"px",m=g(e(),{position:"absolute",top:l,left:l});if(d.shadow)for(h=1;h<=d.lines;h++)f(h,-2,"progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)");for(h=1;h<=d.lines;h++)f(h);return c(a,m)},k.prototype.opacity=function(a,b,c,d){var e=a.firstChild;d=d.shadow&&d.lines||0,e&&b+d<e.childNodes.length&&(e=e.childNodes[b+d],e=e&&e.firstChild,e=e&&e.firstChild,e&&(e.opacity=c))}}var m,n=["webkit","Moz","ms","O"],o={},p=function(){var d=a("style",{type:"text/css"});return c(b.getElementsByTagName("head")[0],d),d.sheet||d.styleSheet}(),q={lines:12,length:7,width:5,radius:10,rotate:0,corners:1,color:"#000",direction:1,speed:1,trail:100,opacity:.25,fps:20,zIndex:2e9,className:"spinner",top:"auto",left:"auto",position:"relative"};k.defaults={},h(k.prototype,{spin:function(b){this.stop();var c,d,e=this,f=e.opts,h=e.el=g(a(0,{className:f.className}),{position:f.position,width:0,zIndex:f.zIndex}),j=f.radius+f.length+f.width;if(b&&(b.insertBefore(h,b.firstChild||null),d=i(b),c=i(h),g(h,{left:("auto"==f.left?d.x-c.x+(b.offsetWidth>>1):parseInt(f.left,10)+j)+"px",top:("auto"==f.top?d.y-c.y+(b.offsetHeight>>1):parseInt(f.top,10)+j)+"px"})),h.setAttribute("role","progressbar"),e.lines(h,e.opts),!m){var k,l=0,n=(f.lines-1)*(1-f.direction)/2,o=f.fps,p=o/f.speed,q=(1-f.opacity)/(p*f.trail/100),r=p/f.lines;!function s(){l++;for(var a=0;a<f.lines;a++)k=Math.max(1-(l+(f.lines-a)*r)%p*q,f.opacity),e.opacity(h,a*f.direction+n,k,f);e.timeout=e.el&&setTimeout(s,~~(1e3/o))}()}return e},stop:function(){var a=this.el;return a&&(clearTimeout(this.timeout),a.parentNode&&a.parentNode.removeChild(a),this.el=e),this},lines:function(b,e){function f(b,c){return g(a(),{position:"absolute",width:e.length+e.width+"px",height:e.width+"px",background:b,boxShadow:c,transformOrigin:"left",transform:"rotate("+~~(360/e.lines*i+e.rotate)+"deg) translate("+e.radius+"px,0)",borderRadius:(e.corners*e.width>>1)+"px"})}for(var h,i=0,k=(e.lines-1)*(1-e.direction)/2;i<e.lines;i++)h=g(a(),{position:"absolute",top:1+~(e.width/2)+"px",transform:e.hwaccel?"translate3d(0,0,0)":"",opacity:e.opacity,animation:m&&d(e.opacity,e.trail,k+i*e.direction,e.lines)+" "+1/e.speed+"s linear infinite"}),e.shadow&&c(h,g(f("#000","0 0 4px #000"),{top:"2px"})),c(b,c(h,f(j(e.color,i),"0 0 1px rgba(0,0,0,.1)")));return b},opacity:function(a,b,c){b<a.childNodes.length&&(a.childNodes[b].style.opacity=c)}});var r=g(a("group"),{behavior:"url(#default#VML)"});return!f(r,"transform")&&r.adj?l():m=f(r,"animation"),k});var Cc,Dc,Ec=d(a),Fc=d(b),Gc="quirks"===c.hash.replace("#",""),Hc=uc.csstransforms3d,Ic=Hc&&!Gc,Jc=Hc||"CSS1Compat"===b.compatMode,Kc=vc.ok,Lc=navigator.userAgent.match(/Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i),Mc=!Ic||Lc,Nc=navigator.msPointerEnabled,Oc="onwheel"in b.createElement("div")?"wheel":b.onmousewheel!==e?"mousewheel":"DOMMouseScroll",Pc=250,Qc=300,Rc=1400,Sc=5e3,Tc=2,Uc=64,Vc=500,Wc=333,Xc="$stageFrame",Yc="$navDotFrame",Zc="$navThumbFrame",$c="auto",_c=f([.1,0,.25,1]),ad=99999,bd="50%",cd={width:null,minwidth:null,maxwidth:"100%",height:null,minheight:null,maxheight:null,ratio:null,margin:Tc,glimpse:0,fit:"contain",position:bd,thumbposition:bd,nav:"dots",navposition:"bottom",navwidth:null,thumbwidth:Uc,thumbheight:Uc,thumbmargin:Tc,thumbborderwidth:Tc,thumbfit:"cover",allowfullscreen:!1,transition:"slide",clicktransition:null,transitionduration:Qc,captions:!0,hash:!1,startindex:0,loop:!1,autoplay:!1,stopautoplayontouch:!0,keyboard:!1,arrows:!0,click:!0,swipe:!0,trackpad:!1,enableifsingleframe:!1,controlsonstart:!0,shuffle:!1,direction:"ltr",shadows:!0,spinner:null},dd={left:!0,right:!0,down:!1,up:!1,space:!1,home:!1,end:!1};G.stop=function(a){G.ii[a]=!1};var ed,fd,gd,hd;jQuery.Fotorama=function(a,e){function f(){d.each(yd,function(a,b){if(!b.i){b.i=me++;var c=A(b.video,!0);if(c){var d={};b.video=c,b.img||b.thumb?b.thumbsReady=!0:d=B(b,yd,ie),C(yd,{img:d.img,thumb:d.thumb},b.i,ie)}}})}function g(a){return Zd[a]||ie.fullScreen}function i(a){var b="keydown."+ib,c=ib+je,d="keydown."+c,f="resize."+c+" orientationchange."+c;a?(Fc.on(d,function(a){var b,c;Cd&&27===a.keyCode?(b=!0,md(Cd,!0,!0)):(ie.fullScreen||e.keyboard&&!ie.index)&&(27===a.keyCode?(b=!0,ie.cancelFullScreen()):a.shiftKey&&32===a.keyCode&&g("space")||37===a.keyCode&&g("left")||38===a.keyCode&&g("up")?c="<":32===a.keyCode&&g("space")||39===a.keyCode&&g("right")||40===a.keyCode&&g("down")?c=">":36===a.keyCode&&g("home")?c="<<":35===a.keyCode&&g("end")&&(c=">>")),(b||c)&&Y(a),c&&ie.show({index:c,slow:a.altKey,user:!0})}),ie.index||Fc.off(b).on(b,"textarea, input, select",function(a){!Dc.hasClass(jb)&&a.stopPropagation()}),Ec.on(f,ie.resize)):(Fc.off(d),Ec.off(f))}function j(b){b!==j.f&&(b?(a.html("").addClass(ib+" "+ke).append(qe).before(oe).before(pe),gb(ie)):(qe.detach(),oe.detach(),pe.detach(),a.html(ne.urtext).removeClass(ke),hb(ie)),i(b),j.f=b)}function m(){yd=ie.data=yd||P(e.data)||D(a),zd=ie.size=yd.length,!xd.ok&&e.shuffle&&O(yd),f(),Je=y(Je),zd&&j(!0)}function o(){var a=2>zd&&!e.enableifsingleframe||Cd;Me.noMove=a||Sd,Me.noSwipe=a||!e.swipe,!Wd&&se.toggleClass(Bb,!e.click&&!Me.noMove&&!Me.noSwipe),Nc&&qe.toggleClass(sb,!Me.noSwipe)}function t(a){a===!0&&(a=""),e.autoplay=Math.max(+a||Sc,1.5*Vd)}function u(){function a(a,c){b[a?"add":"remove"].push(c)}ie.options=e=R(e),Sd="crossfade"===e.transition||"dissolve"===e.transition,Md=e.loop&&(zd>2||Sd&&(!Wd||"slide"!==Wd)),Vd=+e.transitionduration||Qc,Yd="rtl"===e.direction,Zd=d.extend({},e.keyboard&&dd,e.keyboard);var b={add:[],remove:[]};zd>1||e.enableifsingleframe?(Nd=e.nav,Pd="top"===e.navposition,b.remove.push(Xb),we.toggle(!!e.arrows)):(Nd=!1,we.hide()),Rb(),Bd=new zc(d.extend(Ac,e.spinner,Bc,{direction:Yd?-1:1})),Gc(),Hc(),e.autoplay&&t(e.autoplay),Td=n(e.thumbwidth)||Uc,Ud=n(e.thumbheight)||Uc,Ne.ok=Pe.ok=e.trackpad&&!Mc,o(),ed(e,[Le]),Od="thumbs"===Nd,Od?(lc(zd,"navThumb"),Ad=Be,he=Zc,J(oe,d.Fotorama.jst.style({w:Td,h:Ud,b:e.thumbborderwidth,m:e.thumbmargin,s:je,q:!Jc})),ye.addClass(Lb).removeClass(Kb)):"dots"===Nd?(lc(zd,"navDot"),Ad=Ae,he=Yc,ye.addClass(Kb).removeClass(Lb)):(Nd=!1,ye.removeClass(Lb+" "+Kb)),Nd&&(Pd?xe.insertBefore(re):xe.insertAfter(re),wc.nav=!1,wc(Ad,ze,"nav")),Qd=e.allowfullscreen,Qd?(De.prependTo(re),Rd=Kc&&"native"===Qd):(De.detach(),Rd=!1),a(Sd,ob),a(!Sd,pb),a(!e.captions,vb),a(Yd,tb),a("always"!==e.arrows,wb),Xd=e.shadows&&!Mc,a(!Xd,rb),qe.addClass(b.add.join(" ")).removeClass(b.remove.join(" ")),Ke=d.extend({},e)}function x(a){return 0>a?(zd+a%zd)%zd:a>=zd?a%zd:a}function y(a){return h(a,0,zd-1)}function z(a){return Md?x(a):y(a)}function E(a){return a>0||Md?a-1:!1}function U(a){return zd-1>a||Md?a+1:!1}function $(){Me.min=Md?-1/0:-r(zd-1,Le.w,e.margin,Fd),Me.max=Md?1/0:-r(0,Le.w,e.margin,Fd),Me.snap=Le.w+e.margin}function bb(){Oe.min=Math.min(0,Le.nw-ze.width()),Oe.max=0,ze.toggleClass(Bb,!(Oe.noMove=Oe.min===Oe.max))}function cb(a,b,c){if("number"==typeof a){a=new Array(a);var e=!0}return d.each(a,function(a,d){if(e&&(d=a),"number"==typeof d){var f=yd[x(d)];if(f){var g="$"+b+"Frame",h=f[g];c.call(this,a,d,f,h,g,h&&h.data())}}})}function fb(a,b,c,d){(!$d||"*"===$d&&d===Ld)&&(a=q(e.width)||q(a)||Vc,b=q(e.height)||q(b)||Wc,ie.resize({width:a,ratio:e.ratio||c||a/b},0,d!==Ld&&"*"))}function Pb(a,b,c,f,g,h){cb(a,b,function(a,i,j,k,l,m){function n(a){var b=x(i);fd(a,{index:b,src:w,frame:yd[b]})}function o(){t.remove(),d.Fotorama.cache[w]="error",j.html&&"stage"===b||!y||y===w?(!w||j.html||r?"stage"===b&&(k.trigger("f:load").removeClass(ac+" "+_b).addClass(bc),n("load"),fb()):(k.trigger("f:error").removeClass(ac).addClass(_b),n("error")),m.state="error",!(zd>1&&yd[i]===j)||j.html||j.deleted||j.video||r||(j.deleted=!0,ie.splice(i,1))):(j[v]=w=y,Pb([i],b,c,f,g,!0))}function p(){d.Fotorama.measures[w]=u.measures=d.Fotorama.measures[w]||{width:s.width,height:s.height,ratio:s.width/s.height},fb(u.measures.width,u.measures.height,u.measures.ratio,i),t.off("load error").addClass(fc+(r?" "+gc:"")).prependTo(k),I(t,(d.isFunction(c)?c():c)||Le,f||j.fit||e.fit,g||j.position||e.position),d.Fotorama.cache[w]=m.state="loaded",setTimeout(function(){k.trigger("f:load").removeClass(ac+" "+_b).addClass(bc+" "+(r?cc:dc)),"stage"===b?n("load"):(j.thumbratio===$c||!j.thumbratio&&e.thumbratio===$c)&&(j.thumbratio=u.measures.ratio,vd())},0)}function q(){var a=10;G(function(){return!fe||!a--&&!Mc},function(){p()})}if(k){var r=ie.fullScreen&&j.full&&j.full!==j.img&&!m.$full&&"stage"===b;if(!m.$img||h||r){var s=new Image,t=d(s),u=t.data();m[r?"$full":"$img"]=t;var v="stage"===b?r?"full":"img":"thumb",w=j[v],y=r?null:j["stage"===b?"thumb":"img"];if("navThumb"===b&&(k=m.$wrap),!w)return void o();d.Fotorama.cache[w]?!function z(){"error"===d.Fotorama.cache[w]?o():"loaded"===d.Fotorama.cache[w]?setTimeout(q,0):setTimeout(z,100)}():(d.Fotorama.cache[w]="*",t.on("load",q).on("error",o)),m.state="",s.src=w}}})}function Qb(a){Ie.append(Bd.spin().el).appendTo(a)}function Rb(){Ie.detach(),Bd&&Bd.stop()}function Sb(){var a=Dd[Xc];a&&!a.data().state&&(Qb(a),a.on("f:load f:error",function(){a.off("f:load f:error"),Rb()}))}function ec(a){W(a,sd),X(a,function(){setTimeout(function(){Q(ye)},0),Rc({time:Vd,guessIndex:d(this).data().eq,minMax:Oe})})}function lc(a,b){cb(a,b,function(a,c,e,f,g,h){if(!f){f=e[g]=qe[g].clone(),h=f.data(),h.data=e;var i=f[0];"stage"===b?(e.html&&d('<div class="'+kc+'"></div>').append(e._html?d(e.html).removeAttr("id").html(e._html):e.html).appendTo(f),e.caption&&d(N(oc,N(pc,e.caption))).appendTo(f),e.video&&f.addClass(zb).append(Fe.clone()),X(i,function(){setTimeout(function(){Q(re)},0),pd({index:h.eq,user:!0})}),te=te.add(f)):"navDot"===b?(ec(i),Ae=Ae.add(f)):"navThumb"===b&&(ec(i),h.$wrap=f.children(":first"),Be=Be.add(f),e.video&&h.$wrap.append(Fe.clone()))}})}function sc(a,b,c,d){return a&&a.length&&I(a,b,c,d)}function tc(a){cb(a,"stage",function(a,b,c,f,g,h){if(f){var i=x(b),j=c.fit||e.fit,k=c.position||e.position;h.eq=i,Re[Xc][i]=f.css(d.extend({left:Sd?0:r(b,Le.w,e.margin,Fd)},Sd&&l(0))),F(f[0])&&(f.appendTo(se),md(c.$video)),sc(h.$img,Le,j,k),sc(h.$full,Le,j,k)}})}function uc(a,b){if("thumbs"===Nd&&!isNaN(a)){var c=-a,f=-a+Le.nw;Be.each(function(){var a=d(this),g=a.data(),h=g.eq,i=function(){return{h:Ud,w:g.w}},j=i(),k=yd[h]||{},l=k.thumbfit||e.thumbfit,m=k.thumbposition||e.thumbposition;j.w=g.w,g.l+g.w<c||g.l>f||sc(g.$img,j,l,m)||b&&Pb([h],"navThumb",i,l,m)})}}function wc(a,b,c){if(!wc[c]){var f="nav"===c&&Od,g=0;b.append(a.filter(function(){for(var a,b=d(this),c=b.data(),e=0,f=yd.length;f>e;e++)if(c.data===yd[e]){a=!0,c.eq=e;break}return a||b.remove()&&!1}).sort(function(a,b){return d(a).data().eq-d(b).data().eq}).each(function(){if(f){var a=d(this),b=a.data(),c=Math.round(Ud*b.data.thumbratio)||Td;b.l=g,b.w=c,a.css({width:c}),g+=c+e.thumbmargin}})),wc[c]=!0}}function xc(a){return a-Se>Le.w/3}function yc(a){return!(Md||Je+a&&Je-zd+a||Cd)}function Gc(){var a=yc(0),b=yc(1);ue.toggleClass(Eb,a).attr(V(a)),ve.toggleClass(Eb,b).attr(V(b))}function Hc(){Ne.ok&&(Ne.prevent={"<":yc(0),">":yc(1)})}function Lc(a){var b,c,d=a.data();return Od?(b=d.l,c=d.w):(b=a.position().left,c=a.width()),{c:b+c/2,min:-b+10*e.thumbmargin,max:-b+Le.w-c-10*e.thumbmargin}}function Oc(a){var b=Dd[he].data();_(Ce,{time:1.2*a,pos:b.l,width:b.w-2*e.thumbborderwidth})}function Rc(a){var b=yd[a.guessIndex][he];if(b){var c=Oe.min!==Oe.max,d=a.minMax||c&&Lc(Dd[he]),e=c&&(a.keep&&Rc.l?Rc.l:h((a.coo||Le.nw/2)-Lc(b).c,d.min,d.max)),f=c&&h(e,Oe.min,Oe.max),g=1.1*a.time;_(ze,{time:g,pos:f||0,onEnd:function(){uc(f,!0)}}),ld(ye,K(f,Oe.min,Oe.max)),Rc.l=e}}function Tc(){_c(he),Qe[he].push(Dd[he].addClass(Wb))}function _c(a){for(var b=Qe[a];b.length;)b.shift().removeClass(Wb)}function bd(a){var b=Re[a];d.each(Ed,function(a,c){delete b[x(c)]}),d.each(b,function(a,c){delete b[a],c.detach()})}function cd(a){Fd=Gd=Je;var b=Dd[Xc];b&&(_c(Xc),Qe[Xc].push(b.addClass(Wb)),a||ie.show.onEnd(!0),v(se,0,!0),bd(Xc),tc(Ed),$(),bb())}function ed(a,b){a&&d.each(b,function(b,c){c&&d.extend(c,{width:a.width||c.width,height:a.height,minwidth:a.minwidth,maxwidth:a.maxwidth,minheight:a.minheight,maxheight:a.maxheight,ratio:S(a.ratio)})})}function fd(b,c){a.trigger(ib+":"+b,[ie,c])}function gd(){clearTimeout(hd.t),fe=1,e.stopautoplayontouch?ie.stopAutoplay():ce=!0}function hd(){fe&&(e.stopautoplayontouch||(id(),jd()),hd.t=setTimeout(function(){fe=0},Qc+Pc))}function id(){ce=!(!Cd&&!de)}function jd(){if(clearTimeout(jd.t),G.stop(jd.w),!e.autoplay||ce)return void(ie.autoplay&&(ie.autoplay=!1,fd("stopautoplay")));ie.autoplay||(ie.autoplay=!0,fd("startautoplay"));var a=Je,b=Dd[Xc].data();jd.w=G(function(){return b.state||a!==Je},function(){jd.t=setTimeout(function(){if(!ce&&a===Je){var b=Kd,c=yd[b][Xc].data();jd.w=G(function(){return c.state||b!==Kd},function(){ce||b!==Kd||ie.show(Md?Z(!Yd):Kd)})}},e.autoplay)})}function kd(){ie.fullScreen&&(ie.fullScreen=!1,Kc&&vc.cancel(le),Dc.removeClass(jb),Cc.removeClass(jb),a.removeClass(Zb).insertAfter(pe),Le=d.extend({},ee),md(Cd,!0,!0),rd("x",!1),ie.resize(),Pb(Ed,"stage"),Q(Ec,ae,_d),fd("fullscreenexit"))}function ld(a,b){Xd&&(a.removeClass(Ub+" "+Vb),b&&!Cd&&a.addClass(b.replace(/^|\s/g," "+Tb+"--")))}function md(a,b,c){b&&(qe.removeClass(nb),Cd=!1,o()),a&&a!==Cd&&(a.remove(),fd("unloadvideo")),c&&(id(),jd())}function nd(a){qe.toggleClass(qb,a)}function od(a){if(!Me.flow){var b=a?a.pageX:od.x,c=b&&!yc(xc(b))&&e.click;od.p!==c&&re.toggleClass(Cb,c)&&(od.p=c,od.x=b)}}function pd(a){clearTimeout(pd.t),e.clicktransition&&e.clicktransition!==e.transition?setTimeout(function(){var b=e.transition;ie.setOptions({transition:e.clicktransition}),Wd=b,pd.t=setTimeout(function(){ie.show(a)},10)},0):ie.show(a)}function qd(a,b){var c=a.target,f=d(c);f.hasClass(mc)?ie.playVideo():c===Ee?ie.toggleFullScreen():Cd?c===He&&md(Cd,!0,!0):b?nd():e.click&&pd({index:a.shiftKey||Z(xc(a._x)),slow:a.altKey,user:!0})}function rd(a,b){Me[a]=Oe[a]=b}function sd(a){var b=d(this).data().eq;pd({index:b,slow:a.altKey,user:!0,coo:a._x-ye.offset().left})}function td(a){pd({index:we.index(this)?">":"<",slow:a.altKey,user:!0})}function ud(a){X(a,function(){setTimeout(function(){Q(re)},0),nd(!1)})}function vd(){if(m(),u(),!vd.i){vd.i=!0;var a=e.startindex;(a||e.hash&&c.hash)&&(Ld=L(a||c.hash.replace(/^#/,""),yd,0===ie.index||a,a)),Je=Fd=Gd=Hd=Ld=z(Ld)||0}if(zd){if(wd())return;Cd&&md(Cd,!0),Ed=[],bd(Xc),vd.ok=!0,ie.show({index:Je,time:0}),ie.resize()}else ie.destroy()}function wd(){return!wd.f===Yd?(wd.f=Yd,Je=zd-1-Je,ie.reverse(),!0):void 0}function xd(){xd.ok||(xd.ok=!0,fd("ready"))}Cc=d("html"),Dc=d("body");var yd,zd,Ad,Bd,Cd,Dd,Ed,Fd,Gd,Hd,Id,Jd,Kd,Ld,Md,Nd,Od,Pd,Qd,Rd,Sd,Td,Ud,Vd,Wd,Xd,Yd,Zd,$d,_d,ae,be,ce,de,ee,fe,ge,he,ie=this,je=d.now(),ke=ib+je,le=a[0],me=1,ne=a.data(),oe=d("<style></style>"),pe=d(N(Yb)),qe=d(N(kb)),re=d(N(xb)).appendTo(qe),se=(re[0],d(N(Ab)).appendTo(re)),te=d(),ue=d(N(Db+" "+Fb+rc)),ve=d(N(Db+" "+Gb+rc)),we=ue.add(ve).appendTo(re),xe=d(N(Ib)),ye=d(N(Hb)).appendTo(xe),ze=d(N(Jb)).appendTo(ye),Ae=d(),Be=d(),Ce=(se.data(),ze.data(),d(N(jc)).appendTo(ze)),De=d(N($b+rc)),Ee=De[0],Fe=d(N(mc)),Ge=d(N(nc)).appendTo(re),He=Ge[0],Ie=d(N(qc)),Je=!1,Ke={},Le={},Me={},Ne={},Oe={},Pe={},Qe={},Re={},Se=0,Te=[];
qe[Xc]=d(N(yb)),qe[Zc]=d(N(Mb+" "+Ob+rc,N(ic))),qe[Yc]=d(N(Mb+" "+Nb+rc,N(hc))),Qe[Xc]=[],Qe[Zc]=[],Qe[Yc]=[],Re[Xc]={},qe.addClass(Ic?mb:lb).toggleClass(qb,!e.controlsonstart),ne.fotorama=this,ie.startAutoplay=function(a){return ie.autoplay?this:(ce=de=!1,t(a||e.autoplay),jd(),this)},ie.stopAutoplay=function(){return ie.autoplay&&(ce=de=!0,jd()),this},ie.show=function(a){var b;"object"!=typeof a?(b=a,a={}):b=a.index,b=">"===b?Gd+1:"<"===b?Gd-1:"<<"===b?0:">>"===b?zd-1:b,b=isNaN(b)?L(b,yd,!0):b,b="undefined"==typeof b?Je||0:b,ie.activeIndex=Je=z(b),Id=E(Je),Jd=U(Je),Kd=x(Je+(Yd?-1:1)),Ed=[Je,Id,Jd],Gd=Md?b:Je;var c=Math.abs(Hd-Gd),d=w(a.time,function(){return Math.min(Vd*(1+(c-1)/12),2*Vd)}),f=a.overPos;a.slow&&(d*=10);var g=Dd;ie.activeFrame=Dd=yd[Je];var i=g===Dd&&!a.user;md(Cd,Dd.i!==yd[x(Fd)].i),lc(Ed,"stage"),tc(Mc?[Gd]:[Gd,E(Gd),U(Gd)]),rd("go",!0),i||fd("show",{user:a.user,time:d}),ce=!0;var j=ie.show.onEnd=function(b){if(!j.ok){if(j.ok=!0,b||cd(!0),i||fd("showend",{user:a.user}),!b&&Wd&&Wd!==e.transition)return ie.setOptions({transition:Wd}),void(Wd=!1);Sb(),Pb(Ed,"stage"),rd("go",!1),Hc(),od(),id(),jd()}};if(Sd){var k=Dd[Xc],l=Je!==Hd?yd[Hd][Xc]:null;ab(k,l,te,{time:d,method:e.transition,onEnd:j},Te)}else _(se,{pos:-r(Gd,Le.w,e.margin,Fd),overPos:f,time:d,onEnd:j});if(Gc(),Nd){Tc();var m=y(Je+h(Gd-Hd,-1,1));Rc({time:d,coo:m!==Je&&a.coo,guessIndex:"undefined"!=typeof a.coo?m:Je,keep:i}),Od&&Oc(d)}return be="undefined"!=typeof Hd&&Hd!==Je,Hd=Je,e.hash&&be&&!ie.eq&&H(Dd.id||Je+1),this},ie.requestFullScreen=function(){return Qd&&!ie.fullScreen&&(_d=Ec.scrollTop(),ae=Ec.scrollLeft(),Q(Ec),rd("x",!0),ee=d.extend({},Le),a.addClass(Zb).appendTo(Dc.addClass(jb)),Cc.addClass(jb),md(Cd,!0,!0),ie.fullScreen=!0,Rd&&vc.request(le),ie.resize(),Pb(Ed,"stage"),Sb(),fd("fullscreenenter")),this},ie.cancelFullScreen=function(){return Rd&&vc.is()?vc.cancel(b):kd(),this},ie.toggleFullScreen=function(){return ie[(ie.fullScreen?"cancel":"request")+"FullScreen"]()},T(b,vc.event,function(){!yd||vc.is()||Cd||kd()}),ie.resize=function(a){if(!yd)return this;var b=arguments[1]||0,c=arguments[2];ed(ie.fullScreen?{width:"100%",maxwidth:null,minwidth:null,height:"100%",maxheight:null,minheight:null}:R(a),[Le,c||ie.fullScreen||e]);var d=Le.width,f=Le.height,g=Le.ratio,i=Ec.height()-(Nd?ye.height():0);return q(d)&&(qe.addClass(ub).css({width:d,minWidth:Le.minwidth||0,maxWidth:Le.maxwidth||ad}),d=Le.W=Le.w=qe.width(),Le.nw=Nd&&p(e.navwidth,d)||d,e.glimpse&&(Le.w-=Math.round(2*(p(e.glimpse,d)||0))),se.css({width:Le.w,marginLeft:(Le.W-Le.w)/2}),f=p(f,i),f=f||g&&d/g,f&&(d=Math.round(d),f=Le.h=Math.round(h(f,p(Le.minheight,i),p(Le.maxheight,i))),re.stop().animate({width:d,height:f},b,function(){qe.removeClass(ub)}),cd(),Nd&&(ye.stop().animate({width:Le.nw},b),Rc({guessIndex:Je,time:b,keep:!0}),Od&&wc.nav&&Oc(b)),$d=c||!0,xd())),Se=re.offset().left,this},ie.setOptions=function(a){return d.extend(e,a),vd(),this},ie.shuffle=function(){return yd&&O(yd)&&vd(),this},ie.destroy=function(){return ie.cancelFullScreen(),ie.stopAutoplay(),yd=ie.data=null,j(),Ed=[],bd(Xc),vd.ok=!1,this},ie.playVideo=function(){var a=Dd,b=a.video,c=Je;return"object"==typeof b&&a.videoReady&&(Rd&&ie.fullScreen&&ie.cancelFullScreen(),G(function(){return!vc.is()||c!==Je},function(){c===Je&&(a.$video=a.$video||d(d.Fotorama.jst.video(b)),a.$video.appendTo(a[Xc]),qe.addClass(nb),Cd=a.$video,o(),we.blur(),De.blur(),fd("loadvideo"))})),this},ie.stopVideo=function(){return md(Cd,!0,!0),this},re.on("mousemove",od),Me=db(se,{onStart:gd,onMove:function(a,b){ld(re,b.edge)},onTouchEnd:hd,onEnd:function(a){ld(re);var b=(Nc&&!ge||a.touch)&&e.arrows&&"always"!==e.arrows;if(a.moved||b&&a.pos!==a.newPos&&!a.control){var c=s(a.newPos,Le.w,e.margin,Fd);ie.show({index:c,time:Sd?Vd:a.time,overPos:a.overPos,user:!0})}else a.aborted||a.control||qd(a.startEvent,b)},timeLow:1,timeHigh:1,friction:2,select:"."+Xb+", ."+Xb+" *",$wrap:re}),Oe=db(ze,{onStart:gd,onMove:function(a,b){ld(ye,b.edge)},onTouchEnd:hd,onEnd:function(a){function b(){Rc.l=a.newPos,id(),jd(),uc(a.newPos,!0)}if(a.moved)a.pos!==a.newPos?(ce=!0,_(ze,{time:a.time,pos:a.newPos,overPos:a.overPos,onEnd:b}),uc(a.newPos),Xd&&ld(ye,K(a.newPos,Oe.min,Oe.max))):b();else{var c=a.$target.closest("."+Mb,ze)[0];c&&sd.call(c,a.startEvent)}},timeLow:.5,timeHigh:2,friction:5,$wrap:ye}),Ne=eb(re,{shift:!0,onEnd:function(a,b){gd(),hd(),ie.show({index:b,slow:a.altKey})}}),Pe=eb(ye,{onEnd:function(a,b){gd(),hd();var c=v(ze)+.25*b;ze.css(k(h(c,Oe.min,Oe.max))),Xd&&ld(ye,K(c,Oe.min,Oe.max)),Pe.prevent={"<":c>=Oe.max,">":c<=Oe.min},clearTimeout(Pe.t),Pe.t=setTimeout(function(){Rc.l=c,uc(c,!0)},Pc),uc(c)}}),qe.hover(function(){setTimeout(function(){fe||nd(!(ge=!0))},0)},function(){ge&&nd(!(ge=!1))}),M(we,function(a){Y(a),td.call(this,a)},{onStart:function(){gd(),Me.control=!0},onTouchEnd:hd}),we.each(function(){W(this,function(a){td.call(this,a)}),ud(this)}),W(Ee,ie.toggleFullScreen),ud(Ee),d.each("load push pop shift unshift reverse sort splice".split(" "),function(a,b){ie[b]=function(){return yd=yd||[],"load"!==b?Array.prototype[b].apply(yd,arguments):arguments[0]&&"object"==typeof arguments[0]&&arguments[0].length&&(yd=P(arguments[0])),vd(),ie}}),vd()},d.fn.fotorama=function(b){return this.each(function(){var c=this,e=d(this),f=e.data(),g=f.fotorama;g?g.setOptions(b,!0):G(function(){return!E(c)},function(){f.urtext=e.html(),new d.Fotorama(e,d.extend({},cd,a.fotoramaDefaults,b,f))})})},d.Fotorama.instances=[],d.Fotorama.cache={},d.Fotorama.measures={},d=d||{},d.Fotorama=d.Fotorama||{},d.Fotorama.jst=d.Fotorama.jst||{},d.Fotorama.jst.style=function(a){{var b,c="";tc.escape}return c+=".fotorama"+(null==(b=a.s)?"":b)+" .fotorama__nav--thumbs .fotorama__nav__frame{\npadding:"+(null==(b=a.m)?"":b)+"px;\nheight:"+(null==(b=a.h)?"":b)+"px}\n.fotorama"+(null==(b=a.s)?"":b)+" .fotorama__thumb-border{\nheight:"+(null==(b=a.h-a.b*(a.q?0:2))?"":b)+"px;\nborder-width:"+(null==(b=a.b)?"":b)+"px;\nmargin-top:"+(null==(b=a.m)?"":b)+"px}"},d.Fotorama.jst.video=function(a){function b(){c+=d.call(arguments,"")}var c="",d=(tc.escape,Array.prototype.join);return c+='<div class="fotorama__video"><iframe src="',b(("youtube"==a.type?a.p+"youtube.com/embed/"+a.id+"?autoplay=1":"vimeo"==a.type?a.p+"player.vimeo.com/video/"+a.id+"?autoplay=1&badge=0":a.id)+(a.s&&"custom"!=a.type?"&"+a.s:"")),c+='" frameborder="0" allowfullscreen></iframe></div>\n'},d(function(){d("."+ib+':not([data-auto="false"])').fotorama()})}(window,document,location,"undefined"!=typeof jQuery&&jQuery);

var maxHeight = window.innerHeight;

$('.fotorama').fotorama({
  width: '100%',
  maxwidth: '100%',
  ratio: 16/9,
  allowfullscreen: true,
  maxheight: maxHeight
});

$('.owl-carousel').owlCarousel({
    nav:true,
    responsive:{
        0:{
            items:1
        },
        600:{
            items:3
        },
        1000:{
            items:5
        }
    }
});

$('#orderModal').on('shown.bs.modal', function () {
  $('#orderName').focus()
})
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBPd2wgQ2Fyb3VzZWwgdjIuMi4xXHJcbiAqIENvcHlyaWdodCAyMDEzLTIwMTcgRGF2aWQgRGV1dHNjaFxyXG4gKiBMaWNlbnNlZCB1bmRlciAgKClcclxuICovXHJcbi8qKlxyXG4gKiBPd2wgY2Fyb3VzZWxcclxuICogQHZlcnNpb24gMi4xLjZcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKiBAdG9kbyBMYXp5IExvYWQgSWNvblxyXG4gKiBAdG9kbyBwcmV2ZW50IGFuaW1hdGlvbmVuZCBidWJsaW5nXHJcbiAqIEB0b2RvIGl0ZW1zU2NhbGVVcFxyXG4gKiBAdG9kbyBUZXN0IFplcHRvXHJcbiAqIEB0b2RvIHN0YWdlUGFkZGluZyBjYWxjdWxhdGUgd3JvbmcgYWN0aXZlIGNsYXNzZXNcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgYSBjYXJvdXNlbC5cclxuXHQgKiBAY2xhc3MgVGhlIE93bCBDYXJvdXNlbC5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxqUXVlcnl9IGVsZW1lbnQgLSBUaGUgZWxlbWVudCB0byBjcmVhdGUgdGhlIGNhcm91c2VsIGZvci5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gVGhlIG9wdGlvbnNcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBPd2woZWxlbWVudCwgb3B0aW9ucykge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBzZXR0aW5ncyBmb3IgdGhlIGNhcm91c2VsLlxyXG5cdFx0ICogQHB1YmxpY1xyXG5cdFx0ICovXHJcblx0XHR0aGlzLnNldHRpbmdzID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgb3B0aW9ucyBzZXQgYnkgdGhlIGNhbGxlciBpbmNsdWRpbmcgZGVmYXVsdHMuXHJcblx0XHQgKiBAcHVibGljXHJcblx0XHQgKi9cclxuXHRcdHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBPd2wuRGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUGx1Z2luIGVsZW1lbnQuXHJcblx0XHQgKiBAcHVibGljXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuJGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHJveGllZCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZXMgdG8gdGhlIHJ1bm5pbmcgcGx1Z2lucyBvZiB0aGlzIGNhcm91c2VsLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9wbHVnaW5zID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50bHkgc3VwcHJlc3NlZCBldmVudHMgdG8gcHJldmVudCB0aGVtIGZyb20gYmVlaW5nIHJldHJpZ2dlcmVkLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9zdXByZXNzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBYnNvbHV0ZSBjdXJyZW50IHBvc2l0aW9uLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jdXJyZW50ID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFuaW1hdGlvbiBzcGVlZCBpbiBtaWxsaXNlY29uZHMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3NwZWVkID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvb3JkaW5hdGVzIG9mIGFsbCBpdGVtcyBpbiBwaXhlbC5cclxuXHRcdCAqIEB0b2RvIFRoZSBuYW1lIG9mIHRoaXMgbWVtYmVyIGlzIG1pc3NsZWFkaW5nLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb29yZGluYXRlcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBicmVha3BvaW50LlxyXG5cdFx0ICogQHRvZG8gUmVhbCBtZWRpYSBxdWVyaWVzIHdvdWxkIGJlIG5pY2UuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2JyZWFrcG9pbnQgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCB3aWR0aCBvZiB0aGUgcGx1Z2luIGVsZW1lbnQuXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3dpZHRoID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCByZWFsIGl0ZW1zLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pdGVtcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGNsb25lZCBpdGVtcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY2xvbmVzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNZXJnZSB2YWx1ZXMgb2YgYWxsIGl0ZW1zLlxyXG5cdFx0ICogQHRvZG8gTWF5YmUgdGhpcyBjb3VsZCBiZSBwYXJ0IG9mIGEgcGx1Z2luLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9tZXJnZXJzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaWR0aHMgb2YgYWxsIGl0ZW1zLlxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl93aWR0aHMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEludmFsaWRhdGVkIHBhcnRzIHdpdGhpbiB0aGUgdXBkYXRlIHByb2Nlc3MuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2ludmFsaWRhdGVkID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcmRlcmVkIGxpc3Qgb2Ygd29ya2VycyBmb3IgdGhlIHVwZGF0ZSBwcm9jZXNzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9waXBlID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IHN0YXRlIGluZm9ybWF0aW9uIGZvciB0aGUgZHJhZyBvcGVyYXRpb24uXHJcblx0XHQgKiBAdG9kbyAjMjYxXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2RyYWcgPSB7XHJcblx0XHRcdHRpbWU6IG51bGwsXHJcblx0XHRcdHRhcmdldDogbnVsbCxcclxuXHRcdFx0cG9pbnRlcjogbnVsbCxcclxuXHRcdFx0c3RhZ2U6IHtcclxuXHRcdFx0XHRzdGFydDogbnVsbCxcclxuXHRcdFx0XHRjdXJyZW50OiBudWxsXHJcblx0XHRcdH0sXHJcblx0XHRcdGRpcmVjdGlvbjogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgc3RhdGUgaW5mb3JtYXRpb24gYW5kIHRoZWlyIHRhZ3MuXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9zdGF0ZXMgPSB7XHJcblx0XHRcdGN1cnJlbnQ6IHt9LFxyXG5cdFx0XHR0YWdzOiB7XHJcblx0XHRcdFx0J2luaXRpYWxpemluZyc6IFsgJ2J1c3knIF0sXHJcblx0XHRcdFx0J2FuaW1hdGluZyc6IFsgJ2J1c3knIF0sXHJcblx0XHRcdFx0J2RyYWdnaW5nJzogWyAnaW50ZXJhY3RpbmcnIF1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHQkLmVhY2goWyAnb25SZXNpemUnLCAnb25UaHJvdHRsZWRSZXNpemUnIF0sICQucHJveHkoZnVuY3Rpb24oaSwgaGFuZGxlcikge1xyXG5cdFx0XHR0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSA9ICQucHJveHkodGhpc1toYW5kbGVyXSwgdGhpcyk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0JC5lYWNoKE93bC5QbHVnaW5zLCAkLnByb3h5KGZ1bmN0aW9uKGtleSwgcGx1Z2luKSB7XHJcblx0XHRcdHRoaXMuX3BsdWdpbnNba2V5LmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsga2V5LnNsaWNlKDEpXVxyXG5cdFx0XHRcdD0gbmV3IHBsdWdpbih0aGlzKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHQkLmVhY2goT3dsLldvcmtlcnMsICQucHJveHkoZnVuY3Rpb24ocHJpb3JpdHksIHdvcmtlcikge1xyXG5cdFx0XHR0aGlzLl9waXBlLnB1c2goe1xyXG5cdFx0XHRcdCdmaWx0ZXInOiB3b3JrZXIuZmlsdGVyLFxyXG5cdFx0XHRcdCdydW4nOiAkLnByb3h5KHdvcmtlci5ydW4sIHRoaXMpXHJcblx0XHRcdH0pO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdHRoaXMuc2V0dXAoKTtcclxuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zIGZvciB0aGUgY2Fyb3VzZWwuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5EZWZhdWx0cyA9IHtcclxuXHRcdGl0ZW1zOiAzLFxyXG5cdFx0bG9vcDogZmFsc2UsXHJcblx0XHRjZW50ZXI6IGZhbHNlLFxyXG5cdFx0cmV3aW5kOiBmYWxzZSxcclxuXHJcblx0XHRtb3VzZURyYWc6IHRydWUsXHJcblx0XHR0b3VjaERyYWc6IHRydWUsXHJcblx0XHRwdWxsRHJhZzogdHJ1ZSxcclxuXHRcdGZyZWVEcmFnOiBmYWxzZSxcclxuXHJcblx0XHRtYXJnaW46IDAsXHJcblx0XHRzdGFnZVBhZGRpbmc6IDAsXHJcblxyXG5cdFx0bWVyZ2U6IGZhbHNlLFxyXG5cdFx0bWVyZ2VGaXQ6IHRydWUsXHJcblx0XHRhdXRvV2lkdGg6IGZhbHNlLFxyXG5cclxuXHRcdHN0YXJ0UG9zaXRpb246IDAsXHJcblx0XHRydGw6IGZhbHNlLFxyXG5cclxuXHRcdHNtYXJ0U3BlZWQ6IDI1MCxcclxuXHRcdGZsdWlkU3BlZWQ6IGZhbHNlLFxyXG5cdFx0ZHJhZ0VuZFNwZWVkOiBmYWxzZSxcclxuXHJcblx0XHRyZXNwb25zaXZlOiB7fSxcclxuXHRcdHJlc3BvbnNpdmVSZWZyZXNoUmF0ZTogMjAwLFxyXG5cdFx0cmVzcG9uc2l2ZUJhc2VFbGVtZW50OiB3aW5kb3csXHJcblxyXG5cdFx0ZmFsbGJhY2tFYXNpbmc6ICdzd2luZycsXHJcblxyXG5cdFx0aW5mbzogZmFsc2UsXHJcblxyXG5cdFx0bmVzdGVkSXRlbVNlbGVjdG9yOiBmYWxzZSxcclxuXHRcdGl0ZW1FbGVtZW50OiAnZGl2JyxcclxuXHRcdHN0YWdlRWxlbWVudDogJ2RpdicsXHJcblxyXG5cdFx0cmVmcmVzaENsYXNzOiAnb3dsLXJlZnJlc2gnLFxyXG5cdFx0bG9hZGVkQ2xhc3M6ICdvd2wtbG9hZGVkJyxcclxuXHRcdGxvYWRpbmdDbGFzczogJ293bC1sb2FkaW5nJyxcclxuXHRcdHJ0bENsYXNzOiAnb3dsLXJ0bCcsXHJcblx0XHRyZXNwb25zaXZlQ2xhc3M6ICdvd2wtcmVzcG9uc2l2ZScsXHJcblx0XHRkcmFnQ2xhc3M6ICdvd2wtZHJhZycsXHJcblx0XHRpdGVtQ2xhc3M6ICdvd2wtaXRlbScsXHJcblx0XHRzdGFnZUNsYXNzOiAnb3dsLXN0YWdlJyxcclxuXHRcdHN0YWdlT3V0ZXJDbGFzczogJ293bC1zdGFnZS1vdXRlcicsXHJcblx0XHRncmFiQ2xhc3M6ICdvd2wtZ3JhYidcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBFbnVtZXJhdGlvbiBmb3Igd2lkdGguXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEByZWFkb25seVxyXG5cdCAqIEBlbnVtIHtTdHJpbmd9XHJcblx0ICovXHJcblx0T3dsLldpZHRoID0ge1xyXG5cdFx0RGVmYXVsdDogJ2RlZmF1bHQnLFxyXG5cdFx0SW5uZXI6ICdpbm5lcicsXHJcblx0XHRPdXRlcjogJ291dGVyJ1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVudW1lcmF0aW9uIGZvciB0eXBlcy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHJlYWRvbmx5XHJcblx0ICogQGVudW0ge1N0cmluZ31cclxuXHQgKi9cclxuXHRPd2wuVHlwZSA9IHtcclxuXHRcdEV2ZW50OiAnZXZlbnQnLFxyXG5cdFx0U3RhdGU6ICdzdGF0ZSdcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb250YWlucyBhbGwgcmVnaXN0ZXJlZCBwbHVnaW5zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wuUGx1Z2lucyA9IHt9O1xyXG5cclxuXHQvKipcclxuXHQgKiBMaXN0IG9mIHdvcmtlcnMgaW52b2x2ZWQgaW4gdGhlIHVwZGF0ZSBwcm9jZXNzLlxyXG5cdCAqL1xyXG5cdE93bC5Xb3JrZXJzID0gWyB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5fd2lkdGggPSB0aGlzLiRlbGVtZW50LndpZHRoKCk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0Y2FjaGUuY3VycmVudCA9IHRoaXMuX2l0ZW1zICYmIHRoaXMuX2l0ZW1zW3RoaXMucmVsYXRpdmUodGhpcy5fY3VycmVudCldO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmNsb25lZCcpLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XHJcblx0XHRcdHZhciBtYXJnaW4gPSB0aGlzLnNldHRpbmdzLm1hcmdpbiB8fCAnJyxcclxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxyXG5cdFx0XHRcdHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsLFxyXG5cdFx0XHRcdGNzcyA9IHtcclxuXHRcdFx0XHRcdCd3aWR0aCc6ICdhdXRvJyxcclxuXHRcdFx0XHRcdCdtYXJnaW4tbGVmdCc6IHJ0bCA/IG1hcmdpbiA6ICcnLFxyXG5cdFx0XHRcdFx0J21hcmdpbi1yaWdodCc6IHJ0bCA/ICcnIDogbWFyZ2luXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdCFncmlkICYmIHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuY3NzKGNzcyk7XHJcblxyXG5cdFx0XHRjYWNoZS5jc3MgPSBjc3M7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0dmFyIHdpZHRoID0gKHRoaXMud2lkdGgoKSAvIHRoaXMuc2V0dGluZ3MuaXRlbXMpLnRvRml4ZWQoMykgLSB0aGlzLnNldHRpbmdzLm1hcmdpbixcclxuXHRcdFx0XHRtZXJnZSA9IG51bGwsXHJcblx0XHRcdFx0aXRlcmF0b3IgPSB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdFx0Z3JpZCA9ICF0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCxcclxuXHRcdFx0XHR3aWR0aHMgPSBbXTtcclxuXHJcblx0XHRcdGNhY2hlLml0ZW1zID0ge1xyXG5cdFx0XHRcdG1lcmdlOiBmYWxzZSxcclxuXHRcdFx0XHR3aWR0aDogd2lkdGhcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHdoaWxlIChpdGVyYXRvci0tKSB7XHJcblx0XHRcdFx0bWVyZ2UgPSB0aGlzLl9tZXJnZXJzW2l0ZXJhdG9yXTtcclxuXHRcdFx0XHRtZXJnZSA9IHRoaXMuc2V0dGluZ3MubWVyZ2VGaXQgJiYgTWF0aC5taW4obWVyZ2UsIHRoaXMuc2V0dGluZ3MuaXRlbXMpIHx8IG1lcmdlO1xyXG5cclxuXHRcdFx0XHRjYWNoZS5pdGVtcy5tZXJnZSA9IG1lcmdlID4gMSB8fCBjYWNoZS5pdGVtcy5tZXJnZTtcclxuXHJcblx0XHRcdFx0d2lkdGhzW2l0ZXJhdG9yXSA9ICFncmlkID8gdGhpcy5faXRlbXNbaXRlcmF0b3JdLndpZHRoKCkgOiB3aWR0aCAqIG1lcmdlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl93aWR0aHMgPSB3aWR0aHM7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBjbG9uZXMgPSBbXSxcclxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zLFxyXG5cdFx0XHRcdHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncyxcclxuXHRcdFx0XHQvLyBUT0RPOiBTaG91bGQgYmUgY29tcHV0ZWQgZnJvbSBudW1iZXIgb2YgbWluIHdpZHRoIGl0ZW1zIGluIHN0YWdlXHJcblx0XHRcdFx0dmlldyA9IE1hdGgubWF4KHNldHRpbmdzLml0ZW1zICogMiwgNCksXHJcblx0XHRcdFx0c2l6ZSA9IE1hdGguY2VpbChpdGVtcy5sZW5ndGggLyAyKSAqIDIsXHJcblx0XHRcdFx0cmVwZWF0ID0gc2V0dGluZ3MubG9vcCAmJiBpdGVtcy5sZW5ndGggPyBzZXR0aW5ncy5yZXdpbmQgPyB2aWV3IDogTWF0aC5tYXgodmlldywgc2l6ZSkgOiAwLFxyXG5cdFx0XHRcdGFwcGVuZCA9ICcnLFxyXG5cdFx0XHRcdHByZXBlbmQgPSAnJztcclxuXHJcblx0XHRcdHJlcGVhdCAvPSAyO1xyXG5cclxuXHRcdFx0d2hpbGUgKHJlcGVhdC0tKSB7XHJcblx0XHRcdFx0Ly8gU3dpdGNoIHRvIG9ubHkgdXNpbmcgYXBwZW5kZWQgY2xvbmVzXHJcblx0XHRcdFx0Y2xvbmVzLnB1c2godGhpcy5ub3JtYWxpemUoY2xvbmVzLmxlbmd0aCAvIDIsIHRydWUpKTtcclxuXHRcdFx0XHRhcHBlbmQgPSBhcHBlbmQgKyBpdGVtc1tjbG9uZXNbY2xvbmVzLmxlbmd0aCAtIDFdXVswXS5vdXRlckhUTUw7XHJcblx0XHRcdFx0Y2xvbmVzLnB1c2godGhpcy5ub3JtYWxpemUoaXRlbXMubGVuZ3RoIC0gMSAtIChjbG9uZXMubGVuZ3RoIC0gMSkgLyAyLCB0cnVlKSk7XHJcblx0XHRcdFx0cHJlcGVuZCA9IGl0ZW1zW2Nsb25lc1tjbG9uZXMubGVuZ3RoIC0gMV1dWzBdLm91dGVySFRNTCArIHByZXBlbmQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2Nsb25lcyA9IGNsb25lcztcclxuXHJcblx0XHRcdCQoYXBwZW5kKS5hZGRDbGFzcygnY2xvbmVkJykuYXBwZW5kVG8odGhpcy4kc3RhZ2UpO1xyXG5cdFx0XHQkKHByZXBlbmQpLmFkZENsYXNzKCdjbG9uZWQnKS5wcmVwZW5kVG8odGhpcy4kc3RhZ2UpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgcnRsID0gdGhpcy5zZXR0aW5ncy5ydGwgPyAxIDogLTEsXHJcblx0XHRcdFx0c2l6ZSA9IHRoaXMuX2Nsb25lcy5sZW5ndGggKyB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdFx0aXRlcmF0b3IgPSAtMSxcclxuXHRcdFx0XHRwcmV2aW91cyA9IDAsXHJcblx0XHRcdFx0Y3VycmVudCA9IDAsXHJcblx0XHRcdFx0Y29vcmRpbmF0ZXMgPSBbXTtcclxuXHJcblx0XHRcdHdoaWxlICgrK2l0ZXJhdG9yIDwgc2l6ZSkge1xyXG5cdFx0XHRcdHByZXZpb3VzID0gY29vcmRpbmF0ZXNbaXRlcmF0b3IgLSAxXSB8fCAwO1xyXG5cdFx0XHRcdGN1cnJlbnQgPSB0aGlzLl93aWR0aHNbdGhpcy5yZWxhdGl2ZShpdGVyYXRvcildICsgdGhpcy5zZXR0aW5ncy5tYXJnaW47XHJcblx0XHRcdFx0Y29vcmRpbmF0ZXMucHVzaChwcmV2aW91cyArIGN1cnJlbnQgKiBydGwpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9jb29yZGluYXRlcyA9IGNvb3JkaW5hdGVzO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgcGFkZGluZyA9IHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nLFxyXG5cdFx0XHRcdGNvb3JkaW5hdGVzID0gdGhpcy5fY29vcmRpbmF0ZXMsXHJcblx0XHRcdFx0Y3NzID0ge1xyXG5cdFx0XHRcdFx0J3dpZHRoJzogTWF0aC5jZWlsKE1hdGguYWJzKGNvb3JkaW5hdGVzW2Nvb3JkaW5hdGVzLmxlbmd0aCAtIDFdKSkgKyBwYWRkaW5nICogMixcclxuXHRcdFx0XHRcdCdwYWRkaW5nLWxlZnQnOiBwYWRkaW5nIHx8ICcnLFxyXG5cdFx0XHRcdFx0J3BhZGRpbmctcmlnaHQnOiBwYWRkaW5nIHx8ICcnXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdHRoaXMuJHN0YWdlLmNzcyhjc3MpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XHJcblx0XHRcdHZhciBpdGVyYXRvciA9IHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aCxcclxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxyXG5cdFx0XHRcdGl0ZW1zID0gdGhpcy4kc3RhZ2UuY2hpbGRyZW4oKTtcclxuXHJcblx0XHRcdGlmIChncmlkICYmIGNhY2hlLml0ZW1zLm1lcmdlKSB7XHJcblx0XHRcdFx0d2hpbGUgKGl0ZXJhdG9yLS0pIHtcclxuXHRcdFx0XHRcdGNhY2hlLmNzcy53aWR0aCA9IHRoaXMuX3dpZHRoc1t0aGlzLnJlbGF0aXZlKGl0ZXJhdG9yKV07XHJcblx0XHRcdFx0XHRpdGVtcy5lcShpdGVyYXRvcikuY3NzKGNhY2hlLmNzcyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGdyaWQpIHtcclxuXHRcdFx0XHRjYWNoZS5jc3Mud2lkdGggPSBjYWNoZS5pdGVtcy53aWR0aDtcclxuXHRcdFx0XHRpdGVtcy5jc3MoY2FjaGUuY3NzKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnaXRlbXMnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR0aGlzLl9jb29yZGluYXRlcy5sZW5ndGggPCAxICYmIHRoaXMuJHN0YWdlLnJlbW92ZUF0dHIoJ3N0eWxlJyk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0Y2FjaGUuY3VycmVudCA9IGNhY2hlLmN1cnJlbnQgPyB0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmluZGV4KGNhY2hlLmN1cnJlbnQpIDogMDtcclxuXHRcdFx0Y2FjaGUuY3VycmVudCA9IE1hdGgubWF4KHRoaXMubWluaW11bSgpLCBNYXRoLm1pbih0aGlzLm1heGltdW0oKSwgY2FjaGUuY3VycmVudCkpO1xyXG5cdFx0XHR0aGlzLnJlc2V0KGNhY2hlLmN1cnJlbnQpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAncG9zaXRpb24nIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR0aGlzLmFuaW1hdGUodGhpcy5jb29yZGluYXRlcyh0aGlzLl9jdXJyZW50KSk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdwb3NpdGlvbicsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBydGwgPSB0aGlzLnNldHRpbmdzLnJ0bCA/IDEgOiAtMSxcclxuXHRcdFx0XHRwYWRkaW5nID0gdGhpcy5zZXR0aW5ncy5zdGFnZVBhZGRpbmcgKiAyLFxyXG5cdFx0XHRcdGJlZ2luID0gdGhpcy5jb29yZGluYXRlcyh0aGlzLmN1cnJlbnQoKSkgKyBwYWRkaW5nLFxyXG5cdFx0XHRcdGVuZCA9IGJlZ2luICsgdGhpcy53aWR0aCgpICogcnRsLFxyXG5cdFx0XHRcdGlubmVyLCBvdXRlciwgbWF0Y2hlcyA9IFtdLCBpLCBuO1xyXG5cclxuXHRcdFx0Zm9yIChpID0gMCwgbiA9IHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG5cdFx0XHRcdGlubmVyID0gdGhpcy5fY29vcmRpbmF0ZXNbaSAtIDFdIHx8IDA7XHJcblx0XHRcdFx0b3V0ZXIgPSBNYXRoLmFicyh0aGlzLl9jb29yZGluYXRlc1tpXSkgKyBwYWRkaW5nICogcnRsO1xyXG5cclxuXHRcdFx0XHRpZiAoKHRoaXMub3AoaW5uZXIsICc8PScsIGJlZ2luKSAmJiAodGhpcy5vcChpbm5lciwgJz4nLCBlbmQpKSlcclxuXHRcdFx0XHRcdHx8ICh0aGlzLm9wKG91dGVyLCAnPCcsIGJlZ2luKSAmJiB0aGlzLm9wKG91dGVyLCAnPicsIGVuZCkpKSB7XHJcblx0XHRcdFx0XHRtYXRjaGVzLnB1c2goaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmFjdGl2ZScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oJzplcSgnICsgbWF0Y2hlcy5qb2luKCcpLCA6ZXEoJykgKyAnKScpLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLmNlbnRlcikge1xyXG5cdFx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuY2VudGVyJykucmVtb3ZlQ2xhc3MoJ2NlbnRlcicpO1xyXG5cdFx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuZXEodGhpcy5jdXJyZW50KCkpLmFkZENsYXNzKCdjZW50ZXInKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gXTtcclxuXHJcblx0LyoqXHJcblx0ICogSW5pdGlhbGl6ZXMgdGhlIGNhcm91c2VsLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMuZW50ZXIoJ2luaXRpYWxpemluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdpbml0aWFsaXplJyk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC50b2dnbGVDbGFzcyh0aGlzLnNldHRpbmdzLnJ0bENsYXNzLCB0aGlzLnNldHRpbmdzLnJ0bCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoICYmICF0aGlzLmlzKCdwcmUtbG9hZGluZycpKSB7XHJcblx0XHRcdHZhciBpbWdzLCBuZXN0ZWRTZWxlY3Rvciwgd2lkdGg7XHJcblx0XHRcdGltZ3MgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2ltZycpO1xyXG5cdFx0XHRuZXN0ZWRTZWxlY3RvciA9IHRoaXMuc2V0dGluZ3MubmVzdGVkSXRlbVNlbGVjdG9yID8gJy4nICsgdGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IgOiB1bmRlZmluZWQ7XHJcblx0XHRcdHdpZHRoID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbihuZXN0ZWRTZWxlY3Rvcikud2lkdGgoKTtcclxuXHJcblx0XHRcdGlmIChpbWdzLmxlbmd0aCAmJiB3aWR0aCA8PSAwKSB7XHJcblx0XHRcdFx0dGhpcy5wcmVsb2FkQXV0b1dpZHRoSW1hZ2VzKGltZ3MpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGluZ0NsYXNzKTtcclxuXHJcblx0XHQvLyBjcmVhdGUgc3RhZ2VcclxuXHRcdHRoaXMuJHN0YWdlID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLnN0YWdlRWxlbWVudCArICcgY2xhc3M9XCInICsgdGhpcy5zZXR0aW5ncy5zdGFnZUNsYXNzICsgJ1wiLz4nKVxyXG5cdFx0XHQud3JhcCgnPGRpdiBjbGFzcz1cIicgKyB0aGlzLnNldHRpbmdzLnN0YWdlT3V0ZXJDbGFzcyArICdcIi8+Jyk7XHJcblxyXG5cdFx0Ly8gYXBwZW5kIHN0YWdlXHJcblx0XHR0aGlzLiRlbGVtZW50LmFwcGVuZCh0aGlzLiRzdGFnZS5wYXJlbnQoKSk7XHJcblxyXG5cdFx0Ly8gYXBwZW5kIGNvbnRlbnRcclxuXHRcdHRoaXMucmVwbGFjZSh0aGlzLiRlbGVtZW50LmNoaWxkcmVuKCkubm90KHRoaXMuJHN0YWdlLnBhcmVudCgpKSk7XHJcblxyXG5cdFx0Ly8gY2hlY2sgdmlzaWJpbGl0eVxyXG5cdFx0aWYgKHRoaXMuJGVsZW1lbnQuaXMoJzp2aXNpYmxlJykpIHtcclxuXHRcdFx0Ly8gdXBkYXRlIHZpZXdcclxuXHRcdFx0dGhpcy5yZWZyZXNoKCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvLyBpbnZhbGlkYXRlIHdpZHRoXHJcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgnd2lkdGgnKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLiRlbGVtZW50XHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGluZ0NsYXNzKVxyXG5cdFx0XHQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmxvYWRlZENsYXNzKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xyXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50SGFuZGxlcnMoKTtcclxuXHJcblx0XHR0aGlzLmxlYXZlKCdpbml0aWFsaXppbmcnKTtcclxuXHRcdHRoaXMudHJpZ2dlcignaW5pdGlhbGl6ZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXR1cHMgdGhlIGN1cnJlbnQgc2V0dGluZ3MuXHJcblx0ICogQHRvZG8gUmVtb3ZlIHJlc3BvbnNpdmUgY2xhc3Nlcy4gV2h5IHNob3VsZCBhZGFwdGl2ZSBkZXNpZ25zIGJlIGJyb3VnaHQgaW50byBJRTg/XHJcblx0ICogQHRvZG8gU3VwcG9ydCBmb3IgbWVkaWEgcXVlcmllcyBieSB1c2luZyBgbWF0Y2hNZWRpYWAgd291bGQgYmUgbmljZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5zZXR1cCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHZpZXdwb3J0ID0gdGhpcy52aWV3cG9ydCgpLFxyXG5cdFx0XHRvdmVyd3JpdGVzID0gdGhpcy5vcHRpb25zLnJlc3BvbnNpdmUsXHJcblx0XHRcdG1hdGNoID0gLTEsXHJcblx0XHRcdHNldHRpbmdzID0gbnVsbDtcclxuXHJcblx0XHRpZiAoIW92ZXJ3cml0ZXMpIHtcclxuXHRcdFx0c2V0dGluZ3MgPSAkLmV4dGVuZCh7fSwgdGhpcy5vcHRpb25zKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCQuZWFjaChvdmVyd3JpdGVzLCBmdW5jdGlvbihicmVha3BvaW50KSB7XHJcblx0XHRcdFx0aWYgKGJyZWFrcG9pbnQgPD0gdmlld3BvcnQgJiYgYnJlYWtwb2ludCA+IG1hdGNoKSB7XHJcblx0XHRcdFx0XHRtYXRjaCA9IE51bWJlcihicmVha3BvaW50KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0c2V0dGluZ3MgPSAkLmV4dGVuZCh7fSwgdGhpcy5vcHRpb25zLCBvdmVyd3JpdGVzW21hdGNoXSk7XHJcblx0XHRcdGlmICh0eXBlb2Ygc2V0dGluZ3Muc3RhZ2VQYWRkaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0c2V0dGluZ3Muc3RhZ2VQYWRkaW5nID0gc2V0dGluZ3Muc3RhZ2VQYWRkaW5nKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVsZXRlIHNldHRpbmdzLnJlc3BvbnNpdmU7XHJcblxyXG5cdFx0XHQvLyByZXNwb25zaXZlIGNsYXNzXHJcblx0XHRcdGlmIChzZXR0aW5ncy5yZXNwb25zaXZlQ2xhc3MpIHtcclxuXHRcdFx0XHR0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJyxcclxuXHRcdFx0XHRcdHRoaXMuJGVsZW1lbnQuYXR0cignY2xhc3MnKS5yZXBsYWNlKG5ldyBSZWdFeHAoJygnICsgdGhpcy5vcHRpb25zLnJlc3BvbnNpdmVDbGFzcyArICctKVxcXFxTK1xcXFxzJywgJ2cnKSwgJyQxJyArIG1hdGNoKVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIHsgcHJvcGVydHk6IHsgbmFtZTogJ3NldHRpbmdzJywgdmFsdWU6IHNldHRpbmdzIH0gfSk7XHJcblx0XHR0aGlzLl9icmVha3BvaW50ID0gbWF0Y2g7XHJcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblx0XHR0aGlzLmludmFsaWRhdGUoJ3NldHRpbmdzJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ2NoYW5nZWQnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdzZXR0aW5ncycsIHZhbHVlOiB0aGlzLnNldHRpbmdzIH0gfSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlcyBvcHRpb24gbG9naWMgaWYgbmVjZXNzZXJ5LlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9wdGlvbnNMb2dpYyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoKSB7XHJcblx0XHRcdHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nID0gZmFsc2U7XHJcblx0XHRcdHRoaXMuc2V0dGluZ3MubWVyZ2UgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQcmVwYXJlcyBhbiBpdGVtIGJlZm9yZSBhZGQuXHJcblx0ICogQHRvZG8gUmVuYW1lIGV2ZW50IHBhcmFtZXRlciBgY29udGVudGAgdG8gYGl0ZW1gLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcmV0dXJucyB7alF1ZXJ5fEhUTUxFbGVtZW50fSAtIFRoZSBpdGVtIGNvbnRhaW5lci5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnByZXBhcmUgPSBmdW5jdGlvbihpdGVtKSB7XHJcblx0XHR2YXIgZXZlbnQgPSB0aGlzLnRyaWdnZXIoJ3ByZXBhcmUnLCB7IGNvbnRlbnQ6IGl0ZW0gfSk7XHJcblxyXG5cdFx0aWYgKCFldmVudC5kYXRhKSB7XHJcblx0XHRcdGV2ZW50LmRhdGEgPSAkKCc8JyArIHRoaXMuc2V0dGluZ3MuaXRlbUVsZW1lbnQgKyAnLz4nKVxyXG5cdFx0XHRcdC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuaXRlbUNsYXNzKS5hcHBlbmQoaXRlbSlcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ3ByZXBhcmVkJywgeyBjb250ZW50OiBldmVudC5kYXRhIH0pO1xyXG5cclxuXHRcdHJldHVybiBldmVudC5kYXRhO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZXMgdGhlIHZpZXcuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaSA9IDAsXHJcblx0XHRcdG4gPSB0aGlzLl9waXBlLmxlbmd0aCxcclxuXHRcdFx0ZmlsdGVyID0gJC5wcm94eShmdW5jdGlvbihwKSB7IHJldHVybiB0aGlzW3BdIH0sIHRoaXMuX2ludmFsaWRhdGVkKSxcclxuXHRcdFx0Y2FjaGUgPSB7fTtcclxuXHJcblx0XHR3aGlsZSAoaSA8IG4pIHtcclxuXHRcdFx0aWYgKHRoaXMuX2ludmFsaWRhdGVkLmFsbCB8fCAkLmdyZXAodGhpcy5fcGlwZVtpXS5maWx0ZXIsIGZpbHRlcikubGVuZ3RoID4gMCkge1xyXG5cdFx0XHRcdHRoaXMuX3BpcGVbaV0ucnVuKGNhY2hlKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpKys7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5faW52YWxpZGF0ZWQgPSB7fTtcclxuXHJcblx0XHQhdGhpcy5pcygndmFsaWQnKSAmJiB0aGlzLmVudGVyKCd2YWxpZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIHdpZHRoIG9mIHRoZSB2aWV3LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge093bC5XaWR0aH0gW2RpbWVuc2lvbj1Pd2wuV2lkdGguRGVmYXVsdF0gLSBUaGUgZGltZW5zaW9uIHRvIHJldHVybi5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSB3aWR0aCBvZiB0aGUgdmlldyBpbiBwaXhlbC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLndpZHRoID0gZnVuY3Rpb24oZGltZW5zaW9uKSB7XHJcblx0XHRkaW1lbnNpb24gPSBkaW1lbnNpb24gfHwgT3dsLldpZHRoLkRlZmF1bHQ7XHJcblx0XHRzd2l0Y2ggKGRpbWVuc2lvbikge1xyXG5cdFx0XHRjYXNlIE93bC5XaWR0aC5Jbm5lcjpcclxuXHRcdFx0Y2FzZSBPd2wuV2lkdGguT3V0ZXI6XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHJldHVybiB0aGlzLl93aWR0aCAtIHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nICogMiArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlZnJlc2hlcyB0aGUgY2Fyb3VzZWwgcHJpbWFyaWx5IGZvciBhZGFwdGl2ZSBwdXJwb3Nlcy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZWZyZXNoID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLmVudGVyKCdyZWZyZXNoaW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ3JlZnJlc2gnKTtcclxuXHJcblx0XHR0aGlzLnNldHVwKCk7XHJcblxyXG5cdFx0dGhpcy5vcHRpb25zTG9naWMoKTtcclxuXHJcblx0XHR0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5yZWZyZXNoQ2xhc3MpO1xyXG5cclxuXHRcdHRoaXMudXBkYXRlKCk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMucmVmcmVzaENsYXNzKTtcclxuXHJcblx0XHR0aGlzLmxlYXZlKCdyZWZyZXNoaW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ3JlZnJlc2hlZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrcyB3aW5kb3cgYHJlc2l6ZWAgZXZlbnQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25UaHJvdHRsZWRSZXNpemUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXNpemVUaW1lcik7XHJcblx0XHR0aGlzLnJlc2l6ZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5faGFuZGxlcnMub25SZXNpemUsIHRoaXMuc2V0dGluZ3MucmVzcG9uc2l2ZVJlZnJlc2hSYXRlKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2luZG93IGByZXNpemVgIGV2ZW50LlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9uUmVzaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAoIXRoaXMuX2l0ZW1zLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX3dpZHRoID09PSB0aGlzLiRlbGVtZW50LndpZHRoKCkpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy4kZWxlbWVudC5pcygnOnZpc2libGUnKSkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5lbnRlcigncmVzaXppbmcnKTtcclxuXHJcblx0XHRpZiAodGhpcy50cmlnZ2VyKCdyZXNpemUnKS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkge1xyXG5cdFx0XHR0aGlzLmxlYXZlKCdyZXNpemluZycpO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCd3aWR0aCcpO1xyXG5cclxuXHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cclxuXHRcdHRoaXMubGVhdmUoJ3Jlc2l6aW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ3Jlc2l6ZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlcnMgZXZlbnQgaGFuZGxlcnMuXHJcblx0ICogQHRvZG8gQ2hlY2sgYG1zUG9pbnRlckVuYWJsZWRgXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlZ2lzdGVyRXZlbnRIYW5kbGVycyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKCQuc3VwcG9ydC50cmFuc2l0aW9uKSB7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCQuc3VwcG9ydC50cmFuc2l0aW9uLmVuZCArICcub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25UcmFuc2l0aW9uRW5kLCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MucmVzcG9uc2l2ZSAhPT0gZmFsc2UpIHtcclxuXHRcdFx0dGhpcy5vbih3aW5kb3csICdyZXNpemUnLCB0aGlzLl9oYW5kbGVycy5vblRocm90dGxlZFJlc2l6ZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MubW91c2VEcmFnKSB7XHJcblx0XHRcdHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmRyYWdDbGFzcyk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCdtb3VzZWRvd24ub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnU3RhcnQsIHRoaXMpKTtcclxuXHRcdFx0dGhpcy4kc3RhZ2Uub24oJ2RyYWdzdGFydC5vd2wuY29yZSBzZWxlY3RzdGFydC5vd2wuY29yZScsIGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2UgfSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MudG91Y2hEcmFnKXtcclxuXHRcdFx0dGhpcy4kc3RhZ2Uub24oJ3RvdWNoc3RhcnQub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnU3RhcnQsIHRoaXMpKTtcclxuXHRcdFx0dGhpcy4kc3RhZ2Uub24oJ3RvdWNoY2FuY2VsLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ0VuZCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhhbmRsZXMgYHRvdWNoc3RhcnRgIGFuZCBgbW91c2Vkb3duYCBldmVudHMuXHJcblx0ICogQHRvZG8gSG9yaXpvbnRhbCBzd2lwZSB0aHJlc2hvbGQgYXMgb3B0aW9uXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vbkRyYWdTdGFydCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgc3RhZ2UgPSBudWxsO1xyXG5cclxuXHRcdGlmIChldmVudC53aGljaCA9PT0gMykge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCQuc3VwcG9ydC50cmFuc2Zvcm0pIHtcclxuXHRcdFx0c3RhZ2UgPSB0aGlzLiRzdGFnZS5jc3MoJ3RyYW5zZm9ybScpLnJlcGxhY2UoLy4qXFwofFxcKXwgL2csICcnKS5zcGxpdCgnLCcpO1xyXG5cdFx0XHRzdGFnZSA9IHtcclxuXHRcdFx0XHR4OiBzdGFnZVtzdGFnZS5sZW5ndGggPT09IDE2ID8gMTIgOiA0XSxcclxuXHRcdFx0XHR5OiBzdGFnZVtzdGFnZS5sZW5ndGggPT09IDE2ID8gMTMgOiA1XVxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c3RhZ2UgPSB0aGlzLiRzdGFnZS5wb3NpdGlvbigpO1xyXG5cdFx0XHRzdGFnZSA9IHtcclxuXHRcdFx0XHR4OiB0aGlzLnNldHRpbmdzLnJ0bCA/XHJcblx0XHRcdFx0XHRzdGFnZS5sZWZ0ICsgdGhpcy4kc3RhZ2Uud2lkdGgoKSAtIHRoaXMud2lkdGgoKSArIHRoaXMuc2V0dGluZ3MubWFyZ2luIDpcclxuXHRcdFx0XHRcdHN0YWdlLmxlZnQsXHJcblx0XHRcdFx0eTogc3RhZ2UudG9wXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuaXMoJ2FuaW1hdGluZycpKSB7XHJcblx0XHRcdCQuc3VwcG9ydC50cmFuc2Zvcm0gPyB0aGlzLmFuaW1hdGUoc3RhZ2UueCkgOiB0aGlzLiRzdGFnZS5zdG9wKClcclxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCdwb3NpdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQudG9nZ2xlQ2xhc3ModGhpcy5vcHRpb25zLmdyYWJDbGFzcywgZXZlbnQudHlwZSA9PT0gJ21vdXNlZG93bicpO1xyXG5cclxuXHRcdHRoaXMuc3BlZWQoMCk7XHJcblxyXG5cdFx0dGhpcy5fZHJhZy50aW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcblx0XHR0aGlzLl9kcmFnLnRhcmdldCA9ICQoZXZlbnQudGFyZ2V0KTtcclxuXHRcdHRoaXMuX2RyYWcuc3RhZ2Uuc3RhcnQgPSBzdGFnZTtcclxuXHRcdHRoaXMuX2RyYWcuc3RhZ2UuY3VycmVudCA9IHN0YWdlO1xyXG5cdFx0dGhpcy5fZHJhZy5wb2ludGVyID0gdGhpcy5wb2ludGVyKGV2ZW50KTtcclxuXHJcblx0XHQkKGRvY3VtZW50KS5vbignbW91c2V1cC5vd2wuY29yZSB0b3VjaGVuZC5vd2wuY29yZScsICQucHJveHkodGhpcy5vbkRyYWdFbmQsIHRoaXMpKTtcclxuXHJcblx0XHQkKGRvY3VtZW50KS5vbmUoJ21vdXNlbW92ZS5vd2wuY29yZSB0b3VjaG1vdmUub3dsLmNvcmUnLCAkLnByb3h5KGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHRcdHZhciBkZWx0YSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnBvaW50ZXIsIHRoaXMucG9pbnRlcihldmVudCkpO1xyXG5cclxuXHRcdFx0JChkb2N1bWVudCkub24oJ21vdXNlbW92ZS5vd2wuY29yZSB0b3VjaG1vdmUub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnTW92ZSwgdGhpcykpO1xyXG5cclxuXHRcdFx0aWYgKE1hdGguYWJzKGRlbHRhLngpIDwgTWF0aC5hYnMoZGVsdGEueSkgJiYgdGhpcy5pcygndmFsaWQnKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdHRoaXMuZW50ZXIoJ2RyYWdnaW5nJyk7XHJcblx0XHRcdHRoaXMudHJpZ2dlcignZHJhZycpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhhbmRsZXMgdGhlIGB0b3VjaG1vdmVgIGFuZCBgbW91c2Vtb3ZlYCBldmVudHMuXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vbkRyYWdNb3ZlID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciBtaW5pbXVtID0gbnVsbCxcclxuXHRcdFx0bWF4aW11bSA9IG51bGwsXHJcblx0XHRcdHB1bGwgPSBudWxsLFxyXG5cdFx0XHRkZWx0YSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnBvaW50ZXIsIHRoaXMucG9pbnRlcihldmVudCkpLFxyXG5cdFx0XHRzdGFnZSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnN0YWdlLnN0YXJ0LCBkZWx0YSk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLmlzKCdkcmFnZ2luZycpKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmxvb3ApIHtcclxuXHRcdFx0bWluaW11bSA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpO1xyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5jb29yZGluYXRlcyh0aGlzLm1heGltdW0oKSArIDEpIC0gbWluaW11bTtcclxuXHRcdFx0c3RhZ2UueCA9ICgoKHN0YWdlLnggLSBtaW5pbXVtKSAlIG1heGltdW0gKyBtYXhpbXVtKSAlIG1heGltdW0pICsgbWluaW11bTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1pbmltdW0gPSB0aGlzLnNldHRpbmdzLnJ0bCA/IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkpIDogdGhpcy5jb29yZGluYXRlcyh0aGlzLm1pbmltdW0oKSk7XHJcblx0XHRcdG1heGltdW0gPSB0aGlzLnNldHRpbmdzLnJ0bCA/IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpIDogdGhpcy5jb29yZGluYXRlcyh0aGlzLm1heGltdW0oKSk7XHJcblx0XHRcdHB1bGwgPSB0aGlzLnNldHRpbmdzLnB1bGxEcmFnID8gLTEgKiBkZWx0YS54IC8gNSA6IDA7XHJcblx0XHRcdHN0YWdlLnggPSBNYXRoLm1heChNYXRoLm1pbihzdGFnZS54LCBtaW5pbXVtICsgcHVsbCksIG1heGltdW0gKyBwdWxsKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9kcmFnLnN0YWdlLmN1cnJlbnQgPSBzdGFnZTtcclxuXHJcblx0XHR0aGlzLmFuaW1hdGUoc3RhZ2UueCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogSGFuZGxlcyB0aGUgYHRvdWNoZW5kYCBhbmQgYG1vdXNldXBgIGV2ZW50cy5cclxuXHQgKiBAdG9kbyAjMjYxXHJcblx0ICogQHRvZG8gVGhyZXNob2xkIGZvciBjbGljayBldmVudFxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vbkRyYWdFbmQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIGRlbHRhID0gdGhpcy5kaWZmZXJlbmNlKHRoaXMuX2RyYWcucG9pbnRlciwgdGhpcy5wb2ludGVyKGV2ZW50KSksXHJcblx0XHRcdHN0YWdlID0gdGhpcy5fZHJhZy5zdGFnZS5jdXJyZW50LFxyXG5cdFx0XHRkaXJlY3Rpb24gPSBkZWx0YS54ID4gMCBeIHRoaXMuc2V0dGluZ3MucnRsID8gJ2xlZnQnIDogJ3JpZ2h0JztcclxuXHJcblx0XHQkKGRvY3VtZW50KS5vZmYoJy5vd2wuY29yZScpO1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmdyYWJDbGFzcyk7XHJcblxyXG5cdFx0aWYgKGRlbHRhLnggIT09IDAgJiYgdGhpcy5pcygnZHJhZ2dpbmcnKSB8fCAhdGhpcy5pcygndmFsaWQnKSkge1xyXG5cdFx0XHR0aGlzLnNwZWVkKHRoaXMuc2V0dGluZ3MuZHJhZ0VuZFNwZWVkIHx8IHRoaXMuc2V0dGluZ3Muc21hcnRTcGVlZCk7XHJcblx0XHRcdHRoaXMuY3VycmVudCh0aGlzLmNsb3Nlc3Qoc3RhZ2UueCwgZGVsdGEueCAhPT0gMCA/IGRpcmVjdGlvbiA6IHRoaXMuX2RyYWcuZGlyZWN0aW9uKSk7XHJcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgncG9zaXRpb24nKTtcclxuXHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHJcblx0XHRcdHRoaXMuX2RyYWcuZGlyZWN0aW9uID0gZGlyZWN0aW9uO1xyXG5cclxuXHRcdFx0aWYgKE1hdGguYWJzKGRlbHRhLngpID4gMyB8fCBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX2RyYWcudGltZSA+IDMwMCkge1xyXG5cdFx0XHRcdHRoaXMuX2RyYWcudGFyZ2V0Lm9uZSgnY2xpY2sub3dsLmNvcmUnLCBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlOyB9KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy5pcygnZHJhZ2dpbmcnKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5sZWF2ZSgnZHJhZ2dpbmcnKTtcclxuXHRcdHRoaXMudHJpZ2dlcignZHJhZ2dlZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGNsb3Nlc3QgaXRlbSBmb3IgYSBjb29yZGluYXRlLlxyXG5cdCAqIEB0b2RvIFNldHRpbmcgYGZyZWVEcmFnYCBtYWtlcyBgY2xvc2VzdGAgbm90IHJldXNhYmxlLiBTZWUgIzE2NS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvb3JkaW5hdGUgLSBUaGUgY29vcmRpbmF0ZSBpbiBwaXhlbC5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGlyZWN0aW9uIC0gVGhlIGRpcmVjdGlvbiB0byBjaGVjayBmb3IgdGhlIGNsb3Nlc3QgaXRlbS4gRXRoZXIgYGxlZnRgIG9yIGByaWdodGAuXHJcblx0ICogQHJldHVybiB7TnVtYmVyfSAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgY2xvc2VzdCBpdGVtLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuY2xvc2VzdCA9IGZ1bmN0aW9uKGNvb3JkaW5hdGUsIGRpcmVjdGlvbikge1xyXG5cdFx0dmFyIHBvc2l0aW9uID0gLTEsXHJcblx0XHRcdHB1bGwgPSAzMCxcclxuXHRcdFx0d2lkdGggPSB0aGlzLndpZHRoKCksXHJcblx0XHRcdGNvb3JkaW5hdGVzID0gdGhpcy5jb29yZGluYXRlcygpO1xyXG5cclxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5mcmVlRHJhZykge1xyXG5cdFx0XHQvLyBjaGVjayBjbG9zZXN0IGl0ZW1cclxuXHRcdFx0JC5lYWNoKGNvb3JkaW5hdGVzLCAkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCB2YWx1ZSkge1xyXG5cdFx0XHRcdC8vIG9uIGEgbGVmdCBwdWxsLCBjaGVjayBvbiBjdXJyZW50IGluZGV4XHJcblx0XHRcdFx0aWYgKGRpcmVjdGlvbiA9PT0gJ2xlZnQnICYmIGNvb3JkaW5hdGUgPiB2YWx1ZSAtIHB1bGwgJiYgY29vcmRpbmF0ZSA8IHZhbHVlICsgcHVsbCkge1xyXG5cdFx0XHRcdFx0cG9zaXRpb24gPSBpbmRleDtcclxuXHRcdFx0XHQvLyBvbiBhIHJpZ2h0IHB1bGwsIGNoZWNrIG9uIHByZXZpb3VzIGluZGV4XHJcblx0XHRcdFx0Ly8gdG8gZG8gc28sIHN1YnRyYWN0IHdpZHRoIGZyb20gdmFsdWUgYW5kIHNldCBwb3NpdGlvbiA9IGluZGV4ICsgMVxyXG5cdFx0XHRcdH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAncmlnaHQnICYmIGNvb3JkaW5hdGUgPiB2YWx1ZSAtIHdpZHRoIC0gcHVsbCAmJiBjb29yZGluYXRlIDwgdmFsdWUgLSB3aWR0aCArIHB1bGwpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gaW5kZXggKyAxO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5vcChjb29yZGluYXRlLCAnPCcsIHZhbHVlKVxyXG5cdFx0XHRcdFx0JiYgdGhpcy5vcChjb29yZGluYXRlLCAnPicsIGNvb3JkaW5hdGVzW2luZGV4ICsgMV0gfHwgdmFsdWUgLSB3aWR0aCkpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gZGlyZWN0aW9uID09PSAnbGVmdCcgPyBpbmRleCArIDEgOiBpbmRleDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uID09PSAtMTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdC8vIG5vbiBsb29wIGJvdW5kcmllc1xyXG5cdFx0XHRpZiAodGhpcy5vcChjb29yZGluYXRlLCAnPicsIGNvb3JkaW5hdGVzW3RoaXMubWluaW11bSgpXSkpIHtcclxuXHRcdFx0XHRwb3NpdGlvbiA9IGNvb3JkaW5hdGUgPSB0aGlzLm1pbmltdW0oKTtcclxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLm9wKGNvb3JkaW5hdGUsICc8JywgY29vcmRpbmF0ZXNbdGhpcy5tYXhpbXVtKCldKSkge1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gY29vcmRpbmF0ZSA9IHRoaXMubWF4aW11bSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFuaW1hdGVzIHRoZSBzdGFnZS5cclxuXHQgKiBAdG9kbyAjMjcwXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWxzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuYW5pbWF0ZSA9IGZ1bmN0aW9uKGNvb3JkaW5hdGUpIHtcclxuXHRcdHZhciBhbmltYXRlID0gdGhpcy5zcGVlZCgpID4gMDtcclxuXHJcblx0XHR0aGlzLmlzKCdhbmltYXRpbmcnKSAmJiB0aGlzLm9uVHJhbnNpdGlvbkVuZCgpO1xyXG5cclxuXHRcdGlmIChhbmltYXRlKSB7XHJcblx0XHRcdHRoaXMuZW50ZXIoJ2FuaW1hdGluZycpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZScpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtM2QgJiYgJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKHtcclxuXHRcdFx0XHR0cmFuc2Zvcm06ICd0cmFuc2xhdGUzZCgnICsgY29vcmRpbmF0ZSArICdweCwwcHgsMHB4KScsXHJcblx0XHRcdFx0dHJhbnNpdGlvbjogKHRoaXMuc3BlZWQoKSAvIDEwMDApICsgJ3MnXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIGlmIChhbmltYXRlKSB7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmFuaW1hdGUoe1xyXG5cdFx0XHRcdGxlZnQ6IGNvb3JkaW5hdGUgKyAncHgnXHJcblx0XHRcdH0sIHRoaXMuc3BlZWQoKSwgdGhpcy5zZXR0aW5ncy5mYWxsYmFja0Vhc2luZywgJC5wcm94eSh0aGlzLm9uVHJhbnNpdGlvbkVuZCwgdGhpcykpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKHtcclxuXHRcdFx0XHRsZWZ0OiBjb29yZGluYXRlICsgJ3B4J1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2hldGhlciB0aGUgY2Fyb3VzZWwgaXMgaW4gYSBzcGVjaWZpYyBzdGF0ZSBvciBub3QuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0gVGhlIHN0YXRlIHRvIGNoZWNrLlxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufSAtIFRoZSBmbGFnIHdoaWNoIGluZGljYXRlcyBpZiB0aGUgY2Fyb3VzZWwgaXMgYnVzeS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmlzID0gZnVuY3Rpb24oc3RhdGUpIHtcclxuXHRcdHJldHVybiB0aGlzLl9zdGF0ZXMuY3VycmVudFtzdGF0ZV0gJiYgdGhpcy5fc3RhdGVzLmN1cnJlbnRbc3RhdGVdID4gMDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXRzIHRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgY3VycmVudCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSBuZXcgYWJzb2x1dGUgcG9zaXRpb24gb3Igbm90aGluZyB0byBsZWF2ZSBpdCB1bmNoYW5nZWQuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuX2l0ZW1zLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24pO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jdXJyZW50ICE9PSBwb3NpdGlvbikge1xyXG5cdFx0XHR2YXIgZXZlbnQgPSB0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIHsgcHJvcGVydHk6IHsgbmFtZTogJ3Bvc2l0aW9uJywgdmFsdWU6IHBvc2l0aW9uIH0gfSk7XHJcblxyXG5cdFx0XHRpZiAoZXZlbnQuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShldmVudC5kYXRhKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY3VycmVudCA9IHBvc2l0aW9uO1xyXG5cclxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCdwb3NpdGlvbicpO1xyXG5cclxuXHRcdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2VkJywgeyBwcm9wZXJ0eTogeyBuYW1lOiAncG9zaXRpb24nLCB2YWx1ZTogdGhpcy5fY3VycmVudCB9IH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9jdXJyZW50O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEludmFsaWRhdGVzIHRoZSBnaXZlbiBwYXJ0IG9mIHRoZSB1cGRhdGUgcm91dGluZS5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW3BhcnRdIC0gVGhlIHBhcnQgdG8gaW52YWxpZGF0ZS5cclxuXHQgKiBAcmV0dXJucyB7QXJyYXkuPFN0cmluZz59IC0gVGhlIGludmFsaWRhdGVkIHBhcnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uKHBhcnQpIHtcclxuXHRcdGlmICgkLnR5cGUocGFydCkgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHRoaXMuX2ludmFsaWRhdGVkW3BhcnRdID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5pcygndmFsaWQnKSAmJiB0aGlzLmxlYXZlKCd2YWxpZCcpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICQubWFwKHRoaXMuX2ludmFsaWRhdGVkLCBmdW5jdGlvbih2LCBpKSB7IHJldHVybiBpIH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlc2V0cyB0aGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBuZXcgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24pO1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zcGVlZCA9IDA7XHJcblx0XHR0aGlzLl9jdXJyZW50ID0gcG9zaXRpb247XHJcblxyXG5cdFx0dGhpcy5zdXBwcmVzcyhbICd0cmFuc2xhdGUnLCAndHJhbnNsYXRlZCcgXSk7XHJcblxyXG5cdFx0dGhpcy5hbmltYXRlKHRoaXMuY29vcmRpbmF0ZXMocG9zaXRpb24pKTtcclxuXHJcblx0XHR0aGlzLnJlbGVhc2UoWyAndHJhbnNsYXRlJywgJ3RyYW5zbGF0ZWQnIF0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZXMgYW4gYWJzb2x1dGUgb3IgYSByZWxhdGl2ZSBwb3NpdGlvbiBvZiBhbiBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgb3IgcmVsYXRpdmUgcG9zaXRpb24gdG8gbm9ybWFsaXplLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbGF0aXZlPWZhbHNlXSAtIFdoZXRoZXIgdGhlIGdpdmVuIHBvc2l0aW9uIGlzIHJlbGF0aXZlIG9yIG5vdC5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSBub3JtYWxpemVkIHBvc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24ocG9zaXRpb24sIHJlbGF0aXZlKSB7XHJcblx0XHR2YXIgbiA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0bSA9IHJlbGF0aXZlID8gMCA6IHRoaXMuX2Nsb25lcy5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKCF0aGlzLmlzTnVtZXJpYyhwb3NpdGlvbikgfHwgbiA8IDEpIHtcclxuXHRcdFx0cG9zaXRpb24gPSB1bmRlZmluZWQ7XHJcblx0XHR9IGVsc2UgaWYgKHBvc2l0aW9uIDwgMCB8fCBwb3NpdGlvbiA+PSBuICsgbSkge1xyXG5cdFx0XHRwb3NpdGlvbiA9ICgocG9zaXRpb24gLSBtIC8gMikgJSBuICsgbikgJSBuICsgbSAvIDI7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnZlcnRzIGFuIGFic29sdXRlIHBvc2l0aW9uIG9mIGFuIGl0ZW0gaW50byBhIHJlbGF0aXZlIG9uZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIHRvIGNvbnZlcnQuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgY29udmVydGVkIHBvc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVsYXRpdmUgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0cG9zaXRpb24gLT0gdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDI7XHJcblx0XHRyZXR1cm4gdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIG1heGltdW0gcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3JlbGF0aXZlPWZhbHNlXSAtIFdoZXRoZXIgdG8gcmV0dXJuIGFuIGFic29sdXRlIHBvc2l0aW9uIG9yIGEgcmVsYXRpdmUgcG9zaXRpb24uXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm1heGltdW0gPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncyxcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aCxcclxuXHRcdFx0aXRlcmF0b3IsXHJcblx0XHRcdHJlY2lwcm9jYWxJdGVtc1dpZHRoLFxyXG5cdFx0XHRlbGVtZW50V2lkdGg7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmxvb3ApIHtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyICsgdGhpcy5faXRlbXMubGVuZ3RoIC0gMTtcclxuXHRcdH0gZWxzZSBpZiAoc2V0dGluZ3MuYXV0b1dpZHRoIHx8IHNldHRpbmdzLm1lcmdlKSB7XHJcblx0XHRcdGl0ZXJhdG9yID0gdGhpcy5faXRlbXMubGVuZ3RoO1xyXG5cdFx0XHRyZWNpcHJvY2FsSXRlbXNXaWR0aCA9IHRoaXMuX2l0ZW1zWy0taXRlcmF0b3JdLndpZHRoKCk7XHJcblx0XHRcdGVsZW1lbnRXaWR0aCA9IHRoaXMuJGVsZW1lbnQud2lkdGgoKTtcclxuXHRcdFx0d2hpbGUgKGl0ZXJhdG9yLS0pIHtcclxuXHRcdFx0XHRyZWNpcHJvY2FsSXRlbXNXaWR0aCArPSB0aGlzLl9pdGVtc1tpdGVyYXRvcl0ud2lkdGgoKSArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xyXG5cdFx0XHRcdGlmIChyZWNpcHJvY2FsSXRlbXNXaWR0aCA+IGVsZW1lbnRXaWR0aCkge1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdG1heGltdW0gPSBpdGVyYXRvciArIDE7XHJcblx0XHR9IGVsc2UgaWYgKHNldHRpbmdzLmNlbnRlcikge1xyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5faXRlbXMubGVuZ3RoIC0gMTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG1heGltdW0gPSB0aGlzLl9pdGVtcy5sZW5ndGggLSBzZXR0aW5ncy5pdGVtcztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAocmVsYXRpdmUpIHtcclxuXHRcdFx0bWF4aW11bSAtPSB0aGlzLl9jbG9uZXMubGVuZ3RoIC8gMjtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gTWF0aC5tYXgobWF4aW11bSwgMCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgbWluaW11bSBwb3NpdGlvbiBmb3IgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtCb29sZWFufSBbcmVsYXRpdmU9ZmFsc2VdIC0gV2hldGhlciB0byByZXR1cm4gYW4gYWJzb2x1dGUgcG9zaXRpb24gb3IgYSByZWxhdGl2ZSBwb3NpdGlvbi5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubWluaW11bSA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XHJcblx0XHRyZXR1cm4gcmVsYXRpdmUgPyAwIDogdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDI7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyBhbiBpdGVtIGF0IHRoZSBzcGVjaWZpZWQgcmVsYXRpdmUgcG9zaXRpb24uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxyXG5cdCAqIEByZXR1cm4ge2pRdWVyeXxBcnJheS48alF1ZXJ5Pn0gLSBUaGUgaXRlbSBhdCB0aGUgZ2l2ZW4gcG9zaXRpb24gb3IgYWxsIGl0ZW1zIGlmIG5vIHBvc2l0aW9uIHdhcyBnaXZlbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLml0ZW1zID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9pdGVtcy5zbGljZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cdFx0cmV0dXJuIHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIGFuIGl0ZW0gYXQgdGhlIHNwZWNpZmllZCByZWxhdGl2ZSBwb3NpdGlvbi5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXHJcblx0ICogQHJldHVybiB7alF1ZXJ5fEFycmF5LjxqUXVlcnk+fSAtIFRoZSBpdGVtIGF0IHRoZSBnaXZlbiBwb3NpdGlvbiBvciBhbGwgaXRlbXMgaWYgbm8gcG9zaXRpb24gd2FzIGdpdmVuLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubWVyZ2VycyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fbWVyZ2Vycy5zbGljZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cdFx0cmV0dXJuIHRoaXMuX21lcmdlcnNbcG9zaXRpb25dO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIGFic29sdXRlIHBvc2l0aW9ucyBvZiBjbG9uZXMgZm9yIGFuIGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxyXG5cdCAqIEByZXR1cm5zIHtBcnJheS48TnVtYmVyPn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb25zIG9mIGNsb25lcyBmb3IgdGhlIGl0ZW0gb3IgYWxsIGlmIG5vIHBvc2l0aW9uIHdhcyBnaXZlbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmNsb25lcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHR2YXIgb2RkID0gdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDIsXHJcblx0XHRcdGV2ZW4gPSBvZGQgKyB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdG1hcCA9IGZ1bmN0aW9uKGluZGV4KSB7IHJldHVybiBpbmRleCAlIDIgPT09IDAgPyBldmVuICsgaW5kZXggLyAyIDogb2RkIC0gKGluZGV4ICsgMSkgLyAyIH07XHJcblxyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuICQubWFwKHRoaXMuX2Nsb25lcywgZnVuY3Rpb24odiwgaSkgeyByZXR1cm4gbWFwKGkpIH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAkLm1hcCh0aGlzLl9jbG9uZXMsIGZ1bmN0aW9uKHYsIGkpIHsgcmV0dXJuIHYgPT09IHBvc2l0aW9uID8gbWFwKGkpIDogbnVsbCB9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXRzIHRoZSBjdXJyZW50IGFuaW1hdGlvbiBzcGVlZC5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgYW5pbWF0aW9uIHNwZWVkIGluIG1pbGxpc2Vjb25kcyBvciBub3RoaW5nIHRvIGxlYXZlIGl0IHVuY2hhbmdlZC5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSBjdXJyZW50IGFuaW1hdGlvbiBzcGVlZCBpbiBtaWxsaXNlY29uZHMuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5zcGVlZCA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHRpZiAoc3BlZWQgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHR0aGlzLl9zcGVlZCA9IHNwZWVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9zcGVlZDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSBjb29yZGluYXRlIG9mIGFuIGl0ZW0uXHJcblx0ICogQHRvZG8gVGhlIG5hbWUgb2YgdGhpcyBtZXRob2QgaXMgbWlzc2xlYW5kaW5nLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0gd2l0aGluIGBtaW5pbXVtKClgIGFuZCBgbWF4aW11bSgpYC5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfEFycmF5LjxOdW1iZXI+fSAtIFRoZSBjb29yZGluYXRlIG9mIHRoZSBpdGVtIGluIHBpeGVsIG9yIGFsbCBjb29yZGluYXRlcy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmNvb3JkaW5hdGVzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHZhciBtdWx0aXBsaWVyID0gMSxcclxuXHRcdFx0bmV3UG9zaXRpb24gPSBwb3NpdGlvbiAtIDEsXHJcblx0XHRcdGNvb3JkaW5hdGU7XHJcblxyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuICQubWFwKHRoaXMuX2Nvb3JkaW5hdGVzLCAkLnByb3h5KGZ1bmN0aW9uKGNvb3JkaW5hdGUsIGluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29vcmRpbmF0ZXMoaW5kZXgpO1xyXG5cdFx0XHR9LCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuY2VudGVyKSB7XHJcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnJ0bCkge1xyXG5cdFx0XHRcdG11bHRpcGxpZXIgPSAtMTtcclxuXHRcdFx0XHRuZXdQb3NpdGlvbiA9IHBvc2l0aW9uICsgMTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29vcmRpbmF0ZSA9IHRoaXMuX2Nvb3JkaW5hdGVzW3Bvc2l0aW9uXTtcclxuXHRcdFx0Y29vcmRpbmF0ZSArPSAodGhpcy53aWR0aCgpIC0gY29vcmRpbmF0ZSArICh0aGlzLl9jb29yZGluYXRlc1tuZXdQb3NpdGlvbl0gfHwgMCkpIC8gMiAqIG11bHRpcGxpZXI7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb29yZGluYXRlID0gdGhpcy5fY29vcmRpbmF0ZXNbbmV3UG9zaXRpb25dIHx8IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29vcmRpbmF0ZSA9IE1hdGguY2VpbChjb29yZGluYXRlKTtcclxuXHJcblx0XHRyZXR1cm4gY29vcmRpbmF0ZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDYWxjdWxhdGVzIHRoZSBzcGVlZCBmb3IgYSB0cmFuc2xhdGlvbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGZyb20gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIHN0YXJ0IGl0ZW0uXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHRvIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSB0YXJnZXQgaXRlbS5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW2ZhY3Rvcj11bmRlZmluZWRdIC0gVGhlIHRpbWUgZmFjdG9yIGluIG1pbGxpc2Vjb25kcy5cclxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zbGF0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuZHVyYXRpb24gPSBmdW5jdGlvbihmcm9tLCB0bywgZmFjdG9yKSB7XHJcblx0XHRpZiAoZmFjdG9yID09PSAwKSB7XHJcblx0XHRcdHJldHVybiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBNYXRoLm1pbihNYXRoLm1heChNYXRoLmFicyh0byAtIGZyb20pLCAxKSwgNikgKiBNYXRoLmFicygoZmFjdG9yIHx8IHRoaXMuc2V0dGluZ3Muc21hcnRTcGVlZCkpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgc3BlY2lmaWVkIGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBwb3NpdGlvbiBvZiB0aGUgaXRlbS5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS50byA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBzcGVlZCkge1xyXG5cdFx0dmFyIGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQoKSxcclxuXHRcdFx0cmV2ZXJ0ID0gbnVsbCxcclxuXHRcdFx0ZGlzdGFuY2UgPSBwb3NpdGlvbiAtIHRoaXMucmVsYXRpdmUoY3VycmVudCksXHJcblx0XHRcdGRpcmVjdGlvbiA9IChkaXN0YW5jZSA+IDApIC0gKGRpc3RhbmNlIDwgMCksXHJcblx0XHRcdGl0ZW1zID0gdGhpcy5faXRlbXMubGVuZ3RoLFxyXG5cdFx0XHRtaW5pbXVtID0gdGhpcy5taW5pbXVtKCksXHJcblx0XHRcdG1heGltdW0gPSB0aGlzLm1heGltdW0oKTtcclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5yZXdpbmQgJiYgTWF0aC5hYnMoZGlzdGFuY2UpID4gaXRlbXMgLyAyKSB7XHJcblx0XHRcdFx0ZGlzdGFuY2UgKz0gZGlyZWN0aW9uICogLTEgKiBpdGVtcztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cG9zaXRpb24gPSBjdXJyZW50ICsgZGlzdGFuY2U7XHJcblx0XHRcdHJldmVydCA9ICgocG9zaXRpb24gLSBtaW5pbXVtKSAlIGl0ZW1zICsgaXRlbXMpICUgaXRlbXMgKyBtaW5pbXVtO1xyXG5cclxuXHRcdFx0aWYgKHJldmVydCAhPT0gcG9zaXRpb24gJiYgcmV2ZXJ0IC0gZGlzdGFuY2UgPD0gbWF4aW11bSAmJiByZXZlcnQgLSBkaXN0YW5jZSA+IDApIHtcclxuXHRcdFx0XHRjdXJyZW50ID0gcmV2ZXJ0IC0gZGlzdGFuY2U7XHJcblx0XHRcdFx0cG9zaXRpb24gPSByZXZlcnQ7XHJcblx0XHRcdFx0dGhpcy5yZXNldChjdXJyZW50KTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLnJld2luZCkge1xyXG5cdFx0XHRtYXhpbXVtICs9IDE7XHJcblx0XHRcdHBvc2l0aW9uID0gKHBvc2l0aW9uICUgbWF4aW11bSArIG1heGltdW0pICUgbWF4aW11bTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHBvc2l0aW9uID0gTWF0aC5tYXgobWluaW11bSwgTWF0aC5taW4obWF4aW11bSwgcG9zaXRpb24pKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnNwZWVkKHRoaXMuZHVyYXRpb24oY3VycmVudCwgcG9zaXRpb24sIHNwZWVkKSk7XHJcblx0XHR0aGlzLmN1cnJlbnQocG9zaXRpb24pO1xyXG5cclxuXHRcdGlmICh0aGlzLiRlbGVtZW50LmlzKCc6dmlzaWJsZScpKSB7XHJcblx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2xpZGVzIHRvIHRoZSBuZXh0IGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbihzcGVlZCkge1xyXG5cdFx0c3BlZWQgPSBzcGVlZCB8fCBmYWxzZTtcclxuXHRcdHRoaXMudG8odGhpcy5yZWxhdGl2ZSh0aGlzLmN1cnJlbnQoKSkgKyAxLCBzcGVlZCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2xpZGVzIHRvIHRoZSBwcmV2aW91cyBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdHNwZWVkID0gc3BlZWQgfHwgZmFsc2U7XHJcblx0XHR0aGlzLnRvKHRoaXMucmVsYXRpdmUodGhpcy5jdXJyZW50KCkpIC0gMSwgc3BlZWQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhhbmRsZXMgdGhlIGVuZCBvZiBhbiBhbmltYXRpb24uXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9uVHJhbnNpdGlvbkVuZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0Ly8gaWYgY3NzMiBhbmltYXRpb24gdGhlbiBldmVudCBvYmplY3QgaXMgdW5kZWZpbmVkXHJcblx0XHRpZiAoZXZlbnQgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHJcblx0XHRcdC8vIENhdGNoIG9ubHkgb3dsLXN0YWdlIHRyYW5zaXRpb25FbmQgZXZlbnRcclxuXHRcdFx0aWYgKChldmVudC50YXJnZXQgfHwgZXZlbnQuc3JjRWxlbWVudCB8fCBldmVudC5vcmlnaW5hbFRhcmdldCkgIT09IHRoaXMuJHN0YWdlLmdldCgwKSkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubGVhdmUoJ2FuaW1hdGluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCd0cmFuc2xhdGVkJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB2aWV3cG9ydCB3aWR0aC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybiB7TnVtYmVyfSAtIFRoZSB3aWR0aCBpbiBwaXhlbC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnZpZXdwb3J0ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgd2lkdGg7XHJcblx0XHRpZiAodGhpcy5vcHRpb25zLnJlc3BvbnNpdmVCYXNlRWxlbWVudCAhPT0gd2luZG93KSB7XHJcblx0XHRcdHdpZHRoID0gJCh0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZUJhc2VFbGVtZW50KS53aWR0aCgpO1xyXG5cdFx0fSBlbHNlIGlmICh3aW5kb3cuaW5uZXJXaWR0aCkge1xyXG5cdFx0XHR3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG5cdFx0fSBlbHNlIGlmIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoKSB7XHJcblx0XHRcdHdpZHRoID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y29uc29sZS53YXJuKCdDYW4gbm90IGRldGVjdCB2aWV3cG9ydCB3aWR0aC4nKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB3aWR0aDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZXBsYWNlcyB0aGUgY3VycmVudCBjb250ZW50LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeXxTdHJpbmd9IGNvbnRlbnQgLSBUaGUgbmV3IGNvbnRlbnQuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZXBsYWNlID0gZnVuY3Rpb24oY29udGVudCkge1xyXG5cdFx0dGhpcy4kc3RhZ2UuZW1wdHkoKTtcclxuXHRcdHRoaXMuX2l0ZW1zID0gW107XHJcblxyXG5cdFx0aWYgKGNvbnRlbnQpIHtcclxuXHRcdFx0Y29udGVudCA9IChjb250ZW50IGluc3RhbmNlb2YgalF1ZXJ5KSA/IGNvbnRlbnQgOiAkKGNvbnRlbnQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLm5lc3RlZEl0ZW1TZWxlY3Rvcikge1xyXG5cdFx0XHRjb250ZW50ID0gY29udGVudC5maW5kKCcuJyArIHRoaXMuc2V0dGluZ3MubmVzdGVkSXRlbVNlbGVjdG9yKTtcclxuXHRcdH1cclxuXHJcblx0XHRjb250ZW50LmZpbHRlcihmdW5jdGlvbigpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMubm9kZVR5cGUgPT09IDE7XHJcblx0XHR9KS5lYWNoKCQucHJveHkoZnVuY3Rpb24oaW5kZXgsIGl0ZW0pIHtcclxuXHRcdFx0aXRlbSA9IHRoaXMucHJlcGFyZShpdGVtKTtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuYXBwZW5kKGl0ZW0pO1xyXG5cdFx0XHR0aGlzLl9pdGVtcy5wdXNoKGl0ZW0pO1xyXG5cdFx0XHR0aGlzLl9tZXJnZXJzLnB1c2goaXRlbS5maW5kKCdbZGF0YS1tZXJnZV0nKS5hZGRCYWNrKCdbZGF0YS1tZXJnZV0nKS5hdHRyKCdkYXRhLW1lcmdlJykgKiAxIHx8IDEpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdHRoaXMucmVzZXQodGhpcy5pc051bWVyaWModGhpcy5zZXR0aW5ncy5zdGFydFBvc2l0aW9uKSA/IHRoaXMuc2V0dGluZ3Muc3RhcnRQb3NpdGlvbiA6IDApO1xyXG5cclxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnaXRlbXMnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBZGRzIGFuIGl0ZW0uXHJcblx0ICogQHRvZG8gVXNlIGBpdGVtYCBpbnN0ZWFkIG9mIGBjb250ZW50YCBmb3IgdGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxqUXVlcnl8U3RyaW5nfSBjb250ZW50IC0gVGhlIGl0ZW0gY29udGVudCB0byBhZGQuXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gYXQgd2hpY2ggdG8gaW5zZXJ0IHRoZSBpdGVtIG90aGVyd2lzZSB0aGUgaXRlbSB3aWxsIGJlIGFkZGVkIHRvIHRoZSBlbmQuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihjb250ZW50LCBwb3NpdGlvbikge1xyXG5cdFx0dmFyIGN1cnJlbnQgPSB0aGlzLnJlbGF0aXZlKHRoaXMuX2N1cnJlbnQpO1xyXG5cclxuXHRcdHBvc2l0aW9uID0gcG9zaXRpb24gPT09IHVuZGVmaW5lZCA/IHRoaXMuX2l0ZW1zLmxlbmd0aCA6IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uLCB0cnVlKTtcclxuXHRcdGNvbnRlbnQgPSBjb250ZW50IGluc3RhbmNlb2YgalF1ZXJ5ID8gY29udGVudCA6ICQoY29udGVudCk7XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdhZGQnLCB7IGNvbnRlbnQ6IGNvbnRlbnQsIHBvc2l0aW9uOiBwb3NpdGlvbiB9KTtcclxuXHJcblx0XHRjb250ZW50ID0gdGhpcy5wcmVwYXJlKGNvbnRlbnQpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9pdGVtcy5sZW5ndGggPT09IDAgfHwgcG9zaXRpb24gPT09IHRoaXMuX2l0ZW1zLmxlbmd0aCkge1xyXG5cdFx0XHR0aGlzLl9pdGVtcy5sZW5ndGggPT09IDAgJiYgdGhpcy4kc3RhZ2UuYXBwZW5kKGNvbnRlbnQpO1xyXG5cdFx0XHR0aGlzLl9pdGVtcy5sZW5ndGggIT09IDAgJiYgdGhpcy5faXRlbXNbcG9zaXRpb24gLSAxXS5hZnRlcihjb250ZW50KTtcclxuXHRcdFx0dGhpcy5faXRlbXMucHVzaChjb250ZW50KTtcclxuXHRcdFx0dGhpcy5fbWVyZ2Vycy5wdXNoKGNvbnRlbnQuZmluZCgnW2RhdGEtbWVyZ2VdJykuYWRkQmFjaygnW2RhdGEtbWVyZ2VdJykuYXR0cignZGF0YS1tZXJnZScpICogMSB8fCAxKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXS5iZWZvcmUoY29udGVudCk7XHJcblx0XHRcdHRoaXMuX2l0ZW1zLnNwbGljZShwb3NpdGlvbiwgMCwgY29udGVudCk7XHJcblx0XHRcdHRoaXMuX21lcmdlcnMuc3BsaWNlKHBvc2l0aW9uLCAwLCBjb250ZW50LmZpbmQoJ1tkYXRhLW1lcmdlXScpLmFkZEJhY2soJ1tkYXRhLW1lcmdlXScpLmF0dHIoJ2RhdGEtbWVyZ2UnKSAqIDEgfHwgMSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5faXRlbXNbY3VycmVudF0gJiYgdGhpcy5yZXNldCh0aGlzLl9pdGVtc1tjdXJyZW50XS5pbmRleCgpKTtcclxuXHJcblx0XHR0aGlzLmludmFsaWRhdGUoJ2l0ZW1zJyk7XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdhZGRlZCcsIHsgY29udGVudDogY29udGVudCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZXMgYW4gaXRlbSBieSBpdHMgcG9zaXRpb24uXHJcblx0ICogQHRvZG8gVXNlIGBpdGVtYCBpbnN0ZWFkIG9mIGBjb250ZW50YCBmb3IgdGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIHRvIHJlbW92ZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uLCB0cnVlKTtcclxuXHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZW1vdmUnLCB7IGNvbnRlbnQ6IHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXSwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xyXG5cclxuXHRcdHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXS5yZW1vdmUoKTtcclxuXHRcdHRoaXMuX2l0ZW1zLnNwbGljZShwb3NpdGlvbiwgMSk7XHJcblx0XHR0aGlzLl9tZXJnZXJzLnNwbGljZShwb3NpdGlvbiwgMSk7XHJcblxyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdpdGVtcycpO1xyXG5cclxuXHRcdHRoaXMudHJpZ2dlcigncmVtb3ZlZCcsIHsgY29udGVudDogbnVsbCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFByZWxvYWRzIGltYWdlcyB3aXRoIGF1dG8gd2lkdGguXHJcblx0ICogQHRvZG8gUmVwbGFjZSBieSBhIG1vcmUgZ2VuZXJpYyBhcHByb2FjaFxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnByZWxvYWRBdXRvV2lkdGhJbWFnZXMgPSBmdW5jdGlvbihpbWFnZXMpIHtcclxuXHRcdGltYWdlcy5lYWNoKCQucHJveHkoZnVuY3Rpb24oaSwgZWxlbWVudCkge1xyXG5cdFx0XHR0aGlzLmVudGVyKCdwcmUtbG9hZGluZycpO1xyXG5cdFx0XHRlbGVtZW50ID0gJChlbGVtZW50KTtcclxuXHRcdFx0JChuZXcgSW1hZ2UoKSkub25lKCdsb2FkJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0ZWxlbWVudC5hdHRyKCdzcmMnLCBlLnRhcmdldC5zcmMpO1xyXG5cdFx0XHRcdGVsZW1lbnQuY3NzKCdvcGFjaXR5JywgMSk7XHJcblx0XHRcdFx0dGhpcy5sZWF2ZSgncHJlLWxvYWRpbmcnKTtcclxuXHRcdFx0XHQhdGhpcy5pcygncHJlLWxvYWRpbmcnKSAmJiAhdGhpcy5pcygnaW5pdGlhbGl6aW5nJykgJiYgdGhpcy5yZWZyZXNoKCk7XHJcblx0XHRcdH0sIHRoaXMpKS5hdHRyKCdzcmMnLCBlbGVtZW50LmF0dHIoJ3NyYycpIHx8IGVsZW1lbnQuYXR0cignZGF0YS1zcmMnKSB8fCBlbGVtZW50LmF0dHIoJ2RhdGEtc3JjLXJldGluYScpKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgY2Fyb3VzZWwuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQub2ZmKCcub3dsLmNvcmUnKTtcclxuXHRcdHRoaXMuJHN0YWdlLm9mZignLm93bC5jb3JlJyk7XHJcblx0XHQkKGRvY3VtZW50KS5vZmYoJy5vd2wuY29yZScpO1xyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnJlc3BvbnNpdmUgIT09IGZhbHNlKSB7XHJcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXNpemVUaW1lcik7XHJcblx0XHRcdHRoaXMub2ZmKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuX2hhbmRsZXJzLm9uVGhyb3R0bGVkUmVzaXplKTtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKHZhciBpIGluIHRoaXMuX3BsdWdpbnMpIHtcclxuXHRcdFx0dGhpcy5fcGx1Z2luc1tpXS5kZXN0cm95KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oJy5jbG9uZWQnKS5yZW1vdmUoKTtcclxuXHJcblx0XHR0aGlzLiRzdGFnZS51bndyYXAoKTtcclxuXHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkuY29udGVudHMoKS51bndyYXAoKTtcclxuXHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCkudW53cmFwKCk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudFxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLnJlZnJlc2hDbGFzcylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkaW5nQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGVkQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMucnRsQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZHJhZ0NsYXNzKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmdyYWJDbGFzcylcclxuXHRcdFx0LmF0dHIoJ2NsYXNzJywgdGhpcy4kZWxlbWVudC5hdHRyKCdjbGFzcycpLnJlcGxhY2UobmV3IFJlZ0V4cCh0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZUNsYXNzICsgJy1cXFxcUytcXFxccycsICdnJyksICcnKSlcclxuXHRcdFx0LnJlbW92ZURhdGEoJ293bC5jYXJvdXNlbCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE9wZXJhdG9ycyB0byBjYWxjdWxhdGUgcmlnaHQtdG8tbGVmdCBhbmQgbGVmdC10by1yaWdodC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFthXSAtIFRoZSBsZWZ0IHNpZGUgb3BlcmFuZC5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW29dIC0gVGhlIG9wZXJhdG9yLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbYl0gLSBUaGUgcmlnaHQgc2lkZSBvcGVyYW5kLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub3AgPSBmdW5jdGlvbihhLCBvLCBiKSB7XHJcblx0XHR2YXIgcnRsID0gdGhpcy5zZXR0aW5ncy5ydGw7XHJcblx0XHRzd2l0Y2ggKG8pIHtcclxuXHRcdFx0Y2FzZSAnPCc6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPiBiIDogYSA8IGI7XHJcblx0XHRcdGNhc2UgJz4nOlxyXG5cdFx0XHRcdHJldHVybiBydGwgPyBhIDwgYiA6IGEgPiBiO1xyXG5cdFx0XHRjYXNlICc+PSc6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPD0gYiA6IGEgPj0gYjtcclxuXHRcdFx0Y2FzZSAnPD0nOlxyXG5cdFx0XHRcdHJldHVybiBydGwgPyBhID49IGIgOiBhIDw9IGI7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQXR0YWNoZXMgdG8gYW4gaW50ZXJuYWwgZXZlbnQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgLSBUaGUgZXZlbnQgc291cmNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gVGhlIGV2ZW50IGhhbmRsZXIgdG8gYXR0YWNoLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FwdHVyZSAtIFdldGhlciB0aGUgZXZlbnQgc2hvdWxkIGJlIGhhbmRsZWQgYXQgdGhlIGNhcHR1cmluZyBwaGFzZSBvciBub3QuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGVsZW1lbnQsIGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSkge1xyXG5cdFx0aWYgKGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKTtcclxuXHRcdH0gZWxzZSBpZiAoZWxlbWVudC5hdHRhY2hFdmVudCkge1xyXG5cdFx0XHRlbGVtZW50LmF0dGFjaEV2ZW50KCdvbicgKyBldmVudCwgbGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGFjaGVzIGZyb20gYW4gaW50ZXJuYWwgZXZlbnQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgLSBUaGUgZXZlbnQgc291cmNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gVGhlIGF0dGFjaGVkIGV2ZW50IGhhbmRsZXIgdG8gZGV0YWNoLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FwdHVyZSAtIFdldGhlciB0aGUgYXR0YWNoZWQgZXZlbnQgaGFuZGxlciB3YXMgcmVnaXN0ZXJlZCBhcyBhIGNhcHR1cmluZyBsaXN0ZW5lciBvciBub3QuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihlbGVtZW50LCBldmVudCwgbGlzdGVuZXIsIGNhcHR1cmUpIHtcclxuXHRcdGlmIChlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIpIHtcclxuXHRcdFx0ZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSk7XHJcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuZGV0YWNoRXZlbnQpIHtcclxuXHRcdFx0ZWxlbWVudC5kZXRhY2hFdmVudCgnb24nICsgZXZlbnQsIGxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUcmlnZ2VycyBhIHB1YmxpYyBldmVudC5cclxuXHQgKiBAdG9kbyBSZW1vdmUgYHN0YXR1c2AsIGByZWxhdGVkVGFyZ2V0YCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7Kn0gW2RhdGE9bnVsbF0gLSBUaGUgZXZlbnQgZGF0YS5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW25hbWVzcGFjZT1jYXJvdXNlbF0gLSBUaGUgZXZlbnQgbmFtZXNwYWNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdIC0gVGhlIHN0YXRlIHdoaWNoIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGUgZXZlbnQuXHJcblx0ICogQHBhcmFtIHtCb29sZWFufSBbZW50ZXI9ZmFsc2VdIC0gSW5kaWNhdGVzIGlmIHRoZSBjYWxsIGVudGVycyB0aGUgc3BlY2lmaWVkIHN0YXRlIG9yIG5vdC5cclxuXHQgKiBAcmV0dXJucyB7RXZlbnR9IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihuYW1lLCBkYXRhLCBuYW1lc3BhY2UsIHN0YXRlLCBlbnRlcikge1xyXG5cdFx0dmFyIHN0YXR1cyA9IHtcclxuXHRcdFx0aXRlbTogeyBjb3VudDogdGhpcy5faXRlbXMubGVuZ3RoLCBpbmRleDogdGhpcy5jdXJyZW50KCkgfVxyXG5cdFx0fSwgaGFuZGxlciA9ICQuY2FtZWxDYXNlKFxyXG5cdFx0XHQkLmdyZXAoWyAnb24nLCBuYW1lLCBuYW1lc3BhY2UgXSwgZnVuY3Rpb24odikgeyByZXR1cm4gdiB9KVxyXG5cdFx0XHRcdC5qb2luKCctJykudG9Mb3dlckNhc2UoKVxyXG5cdFx0KSwgZXZlbnQgPSAkLkV2ZW50KFxyXG5cdFx0XHRbIG5hbWUsICdvd2wnLCBuYW1lc3BhY2UgfHwgJ2Nhcm91c2VsJyBdLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLFxyXG5cdFx0XHQkLmV4dGVuZCh7IHJlbGF0ZWRUYXJnZXQ6IHRoaXMgfSwgc3RhdHVzLCBkYXRhKVxyXG5cdFx0KTtcclxuXHJcblx0XHRpZiAoIXRoaXMuX3N1cHJlc3NbbmFtZV0pIHtcclxuXHRcdFx0JC5lYWNoKHRoaXMuX3BsdWdpbnMsIGZ1bmN0aW9uKG5hbWUsIHBsdWdpbikge1xyXG5cdFx0XHRcdGlmIChwbHVnaW4ub25UcmlnZ2VyKSB7XHJcblx0XHRcdFx0XHRwbHVnaW4ub25UcmlnZ2VyKGV2ZW50KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dGhpcy5yZWdpc3Rlcih7IHR5cGU6IE93bC5UeXBlLkV2ZW50LCBuYW1lOiBuYW1lIH0pO1xyXG5cdFx0XHR0aGlzLiRlbGVtZW50LnRyaWdnZXIoZXZlbnQpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3MgJiYgdHlwZW9mIHRoaXMuc2V0dGluZ3NbaGFuZGxlcl0gPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHR0aGlzLnNldHRpbmdzW2hhbmRsZXJdLmNhbGwodGhpcywgZXZlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGV2ZW50O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVudGVycyBhIHN0YXRlLlxyXG5cdCAqIEBwYXJhbSBuYW1lIC0gVGhlIHN0YXRlIG5hbWUuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5lbnRlciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuXHRcdCQuZWFjaChbIG5hbWUgXS5jb25jYXQodGhpcy5fc3RhdGVzLnRhZ3NbbmFtZV0gfHwgW10pLCAkLnByb3h5KGZ1bmN0aW9uKGksIG5hbWUpIHtcclxuXHRcdFx0aWYgKHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMuY3VycmVudFtuYW1lXSA9IDA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdKys7XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTGVhdmVzIGEgc3RhdGUuXHJcblx0ICogQHBhcmFtIG5hbWUgLSBUaGUgc3RhdGUgbmFtZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24obmFtZSkge1xyXG5cdFx0JC5lYWNoKFsgbmFtZSBdLmNvbmNhdCh0aGlzLl9zdGF0ZXMudGFnc1tuYW1lXSB8fCBbXSksICQucHJveHkoZnVuY3Rpb24oaSwgbmFtZSkge1xyXG5cdFx0XHR0aGlzLl9zdGF0ZXMuY3VycmVudFtuYW1lXS0tO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVycyBhbiBldmVudCBvciBzdGF0ZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtIFRoZSBldmVudCBvciBzdGF0ZSB0byByZWdpc3Rlci5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24ob2JqZWN0KSB7XHJcblx0XHRpZiAob2JqZWN0LnR5cGUgPT09IE93bC5UeXBlLkV2ZW50KSB7XHJcblx0XHRcdGlmICghJC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXSkge1xyXG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0gPSB7fTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCEkLmV2ZW50LnNwZWNpYWxbb2JqZWN0Lm5hbWVdLm93bCkge1xyXG5cdFx0XHRcdHZhciBfZGVmYXVsdCA9ICQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0uX2RlZmF1bHQ7XHJcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXS5fZGVmYXVsdCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdGlmIChfZGVmYXVsdCAmJiBfZGVmYXVsdC5hcHBseSAmJiAoIWUubmFtZXNwYWNlIHx8IGUubmFtZXNwYWNlLmluZGV4T2YoJ293bCcpID09PSAtMSkpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIF9kZWZhdWx0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm4gZS5uYW1lc3BhY2UgJiYgZS5uYW1lc3BhY2UuaW5kZXhPZignb3dsJykgPiAtMTtcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0ub3dsID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChvYmplY3QudHlwZSA9PT0gT3dsLlR5cGUuU3RhdGUpIHtcclxuXHRcdFx0aWYgKCF0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0pIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0gPSBvYmplY3QudGFncztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0gPSB0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0uY29uY2F0KG9iamVjdC50YWdzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdID0gJC5ncmVwKHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSwgJC5wcm94eShmdW5jdGlvbih0YWcsIGkpIHtcclxuXHRcdFx0XHRyZXR1cm4gJC5pbkFycmF5KHRhZywgdGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdKSA9PT0gaTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN1cHByZXNzZXMgZXZlbnRzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBldmVudHMgLSBUaGUgZXZlbnRzIHRvIHN1cHByZXNzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuc3VwcHJlc3MgPSBmdW5jdGlvbihldmVudHMpIHtcclxuXHRcdCQuZWFjaChldmVudHMsICQucHJveHkoZnVuY3Rpb24oaW5kZXgsIGV2ZW50KSB7XHJcblx0XHRcdHRoaXMuX3N1cHJlc3NbZXZlbnRdID0gdHJ1ZTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWxlYXNlcyBzdXBwcmVzc2VkIGV2ZW50cy5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gZXZlbnRzIC0gVGhlIGV2ZW50cyB0byByZWxlYXNlLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVsZWFzZSA9IGZ1bmN0aW9uKGV2ZW50cykge1xyXG5cdFx0JC5lYWNoKGV2ZW50cywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgZXZlbnQpIHtcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX3N1cHJlc3NbZXZlbnRdO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdW5pZmllZCBwb2ludGVyIGNvb3JkaW5hdGVzIGZyb20gZXZlbnQuXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSAtIFRoZSBgbW91c2Vkb3duYCBvciBgdG91Y2hzdGFydGAgZXZlbnQuXHJcblx0ICogQHJldHVybnMge09iamVjdH0gLSBDb250YWlucyBgeGAgYW5kIGB5YCBjb29yZGluYXRlcyBvZiBjdXJyZW50IHBvaW50ZXIgcG9zaXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wb2ludGVyID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciByZXN1bHQgPSB7IHg6IG51bGwsIHk6IG51bGwgfTtcclxuXHJcblx0XHRldmVudCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQgfHwgd2luZG93LmV2ZW50O1xyXG5cclxuXHRcdGV2ZW50ID0gZXZlbnQudG91Y2hlcyAmJiBldmVudC50b3VjaGVzLmxlbmd0aCA/XHJcblx0XHRcdGV2ZW50LnRvdWNoZXNbMF0gOiBldmVudC5jaGFuZ2VkVG91Y2hlcyAmJiBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGggP1xyXG5cdFx0XHRcdGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdIDogZXZlbnQ7XHJcblxyXG5cdFx0aWYgKGV2ZW50LnBhZ2VYKSB7XHJcblx0XHRcdHJlc3VsdC54ID0gZXZlbnQucGFnZVg7XHJcblx0XHRcdHJlc3VsdC55ID0gZXZlbnQucGFnZVk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXN1bHQueCA9IGV2ZW50LmNsaWVudFg7XHJcblx0XHRcdHJlc3VsdC55ID0gZXZlbnQuY2xpZW50WTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZXMgaWYgdGhlIGlucHV0IGlzIGEgTnVtYmVyIG9yIHNvbWV0aGluZyB0aGF0IGNhbiBiZSBjb2VyY2VkIHRvIGEgTnVtYmVyXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ3xPYmplY3R8QXJyYXl8Qm9vbGVhbnxSZWdFeHB8RnVuY3Rpb258U3ltYm9sfSAtIFRoZSBpbnB1dCB0byBiZSB0ZXN0ZWRcclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBBbiBpbmRpY2F0aW9uIGlmIHRoZSBpbnB1dCBpcyBhIE51bWJlciBvciBjYW4gYmUgY29lcmNlZCB0byBhIE51bWJlclxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaXNOdW1lcmljID0gZnVuY3Rpb24obnVtYmVyKSB7XHJcblx0XHRyZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobnVtYmVyKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgZGlmZmVyZW5jZSBvZiB0d28gdmVjdG9ycy5cclxuXHQgKiBAdG9kbyAjMjYxXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAtIFRoZSBmaXJzdCB2ZWN0b3IuXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IC0gVGhlIHNlY29uZCB2ZWN0b3IuXHJcblx0ICogQHJldHVybnMge09iamVjdH0gLSBUaGUgZGlmZmVyZW5jZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHR4OiBmaXJzdC54IC0gc2Vjb25kLngsXHJcblx0XHRcdHk6IGZpcnN0LnkgLSBzZWNvbmQueVxyXG5cdFx0fTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgalF1ZXJ5IFBsdWdpbiBmb3IgdGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqIEB0b2RvIE5hdmlnYXRpb24gcGx1Z2luIGBuZXh0YCBhbmQgYHByZXZgXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwgPSBmdW5jdGlvbihvcHRpb24pIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgJHRoaXMgPSAkKHRoaXMpLFxyXG5cdFx0XHRcdGRhdGEgPSAkdGhpcy5kYXRhKCdvd2wuY2Fyb3VzZWwnKTtcclxuXHJcblx0XHRcdGlmICghZGF0YSkge1xyXG5cdFx0XHRcdGRhdGEgPSBuZXcgT3dsKHRoaXMsIHR5cGVvZiBvcHRpb24gPT0gJ29iamVjdCcgJiYgb3B0aW9uKTtcclxuXHRcdFx0XHQkdGhpcy5kYXRhKCdvd2wuY2Fyb3VzZWwnLCBkYXRhKTtcclxuXHJcblx0XHRcdFx0JC5lYWNoKFtcclxuXHRcdFx0XHRcdCduZXh0JywgJ3ByZXYnLCAndG8nLCAnZGVzdHJveScsICdyZWZyZXNoJywgJ3JlcGxhY2UnLCAnYWRkJywgJ3JlbW92ZSdcclxuXHRcdFx0XHRdLCBmdW5jdGlvbihpLCBldmVudCkge1xyXG5cdFx0XHRcdFx0ZGF0YS5yZWdpc3Rlcih7IHR5cGU6IE93bC5UeXBlLkV2ZW50LCBuYW1lOiBldmVudCB9KTtcclxuXHRcdFx0XHRcdGRhdGEuJGVsZW1lbnQub24oZXZlbnQgKyAnLm93bC5jYXJvdXNlbC5jb3JlJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnJlbGF0ZWRUYXJnZXQgIT09IHRoaXMpIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnN1cHByZXNzKFsgZXZlbnQgXSk7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtldmVudF0uYXBwbHkodGhpcywgW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnJlbGVhc2UoWyBldmVudCBdKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSwgZGF0YSkpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJyAmJiBvcHRpb24uY2hhckF0KDApICE9PSAnXycpIHtcclxuXHRcdFx0XHRkYXRhW29wdGlvbl0uYXBwbHkoZGF0YSwgYXJncyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBjb25zdHJ1Y3RvciBmb3IgdGhlIGpRdWVyeSBQbHVnaW5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3RvciA9IE93bDtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvUmVmcmVzaCBQbHVnaW5cclxuICogQHZlcnNpb24gMi4xLjBcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIGF1dG8gcmVmcmVzaCBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBBdXRvIFJlZnJlc2ggUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBBdXRvUmVmcmVzaCA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZnJlc2ggaW50ZXJ2YWwuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7bnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pbnRlcnZhbCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaGV0aGVyIHRoZSBlbGVtZW50IGlzIGN1cnJlbnRseSB2aXNpYmxlIG9yIG5vdC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl92aXNpYmxlID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b1JlZnJlc2gpIHtcclxuXHRcdFx0XHRcdHRoaXMud2F0Y2goKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvUmVmcmVzaC5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vbih0aGlzLl9oYW5kbGVycyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvUmVmcmVzaC5EZWZhdWx0cyA9IHtcclxuXHRcdGF1dG9SZWZyZXNoOiB0cnVlLFxyXG5cdFx0YXV0b1JlZnJlc2hJbnRlcnZhbDogNTAwXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogV2F0Y2hlcyB0aGUgZWxlbWVudC5cclxuXHQgKi9cclxuXHRBdXRvUmVmcmVzaC5wcm90b3R5cGUud2F0Y2ggPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLl9pbnRlcnZhbCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSA9IHRoaXMuX2NvcmUuJGVsZW1lbnQuaXMoJzp2aXNpYmxlJyk7XHJcblx0XHR0aGlzLl9pbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgkLnByb3h5KHRoaXMucmVmcmVzaCwgdGhpcyksIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b1JlZnJlc2hJbnRlcnZhbCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVmcmVzaGVzIHRoZSBlbGVtZW50LlxyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLnByb3RvdHlwZS5yZWZyZXNoID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAodGhpcy5fY29yZS4kZWxlbWVudC5pcygnOnZpc2libGUnKSA9PT0gdGhpcy5fdmlzaWJsZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSA9ICF0aGlzLl92aXNpYmxlO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQudG9nZ2xlQ2xhc3MoJ293bC1oaWRkZW4nLCAhdGhpcy5fdmlzaWJsZSk7XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSAmJiAodGhpcy5fY29yZS5pbnZhbGlkYXRlKCd3aWR0aCcpICYmIHRoaXMuX2NvcmUucmVmcmVzaCgpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5faW50ZXJ2YWwpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5BdXRvUmVmcmVzaCA9IEF1dG9SZWZyZXNoO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIExhenkgUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMS4wXHJcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIGxhenkgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgTGF6eSBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIExhenkgPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxyZWFkeSBsb2FkZWQgaXRlbXMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7QXJyYXkuPGpRdWVyeT59XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2xvYWRlZCA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCBjaGFuZ2Uub3dsLmNhcm91c2VsIHJlc2l6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKCFlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCF0aGlzLl9jb3JlLnNldHRpbmdzIHx8ICF0aGlzLl9jb3JlLnNldHRpbmdzLmxhenlMb2FkKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoKGUucHJvcGVydHkgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHx8IGUudHlwZSA9PSAnaW5pdGlhbGl6ZWQnKSB7XHJcblx0XHRcdFx0XHR2YXIgc2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRcdFx0XHRuID0gKHNldHRpbmdzLmNlbnRlciAmJiBNYXRoLmNlaWwoc2V0dGluZ3MuaXRlbXMgLyAyKSB8fCBzZXR0aW5ncy5pdGVtcyksXHJcblx0XHRcdFx0XHRcdGkgPSAoKHNldHRpbmdzLmNlbnRlciAmJiBuICogLTEpIHx8IDApLFxyXG5cdFx0XHRcdFx0XHRwb3NpdGlvbiA9IChlLnByb3BlcnR5ICYmIGUucHJvcGVydHkudmFsdWUgIT09IHVuZGVmaW5lZCA/IGUucHJvcGVydHkudmFsdWUgOiB0aGlzLl9jb3JlLmN1cnJlbnQoKSkgKyBpLFxyXG5cdFx0XHRcdFx0XHRjbG9uZXMgPSB0aGlzLl9jb3JlLmNsb25lcygpLmxlbmd0aCxcclxuXHRcdFx0XHRcdFx0bG9hZCA9ICQucHJveHkoZnVuY3Rpb24oaSwgdikgeyB0aGlzLmxvYWQodikgfSwgdGhpcyk7XHJcblxyXG5cdFx0XHRcdFx0d2hpbGUgKGkrKyA8IG4pIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2FkKGNsb25lcyAvIDIgKyB0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSk7XHJcblx0XHRcdFx0XHRcdGNsb25lcyAmJiAkLmVhY2godGhpcy5fY29yZS5jbG9uZXModGhpcy5fY29yZS5yZWxhdGl2ZShwb3NpdGlvbikpLCBsb2FkKTtcclxuXHRcdFx0XHRcdFx0cG9zaXRpb24rKztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCB0aGUgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgTGF6eS5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdExhenkuRGVmYXVsdHMgPSB7XHJcblx0XHRsYXp5TG9hZDogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBMb2FkcyBhbGwgcmVzb3VyY2VzIG9mIGFuIGl0ZW0gYXQgdGhlIHNwZWNpZmllZCBwb3NpdGlvbi5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdExhenkucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0dmFyICRpdGVtID0gdGhpcy5fY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS5lcShwb3NpdGlvbiksXHJcblx0XHRcdCRlbGVtZW50cyA9ICRpdGVtICYmICRpdGVtLmZpbmQoJy5vd2wtbGF6eScpO1xyXG5cclxuXHRcdGlmICghJGVsZW1lbnRzIHx8ICQuaW5BcnJheSgkaXRlbS5nZXQoMCksIHRoaXMuX2xvYWRlZCkgPiAtMSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGVsZW1lbnRzLmVhY2goJC5wcm94eShmdW5jdGlvbihpbmRleCwgZWxlbWVudCkge1xyXG5cdFx0XHR2YXIgJGVsZW1lbnQgPSAkKGVsZW1lbnQpLCBpbWFnZSxcclxuXHRcdFx0XHR1cmwgPSAod2luZG93LmRldmljZVBpeGVsUmF0aW8gPiAxICYmICRlbGVtZW50LmF0dHIoJ2RhdGEtc3JjLXJldGluYScpKSB8fCAkZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpO1xyXG5cclxuXHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdsb2FkJywgeyBlbGVtZW50OiAkZWxlbWVudCwgdXJsOiB1cmwgfSwgJ2xhenknKTtcclxuXHJcblx0XHRcdGlmICgkZWxlbWVudC5pcygnaW1nJykpIHtcclxuXHRcdFx0XHQkZWxlbWVudC5vbmUoJ2xvYWQub3dsLmxhenknLCAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0JGVsZW1lbnQuY3NzKCdvcGFjaXR5JywgMSk7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XHJcblx0XHRcdFx0fSwgdGhpcykpLmF0dHIoJ3NyYycsIHVybCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aW1hZ2UgPSBuZXcgSW1hZ2UoKTtcclxuXHRcdFx0XHRpbWFnZS5vbmxvYWQgPSAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0JGVsZW1lbnQuY3NzKHtcclxuXHRcdFx0XHRcdFx0J2JhY2tncm91bmQtaW1hZ2UnOiAndXJsKFwiJyArIHVybCArICdcIiknLFxyXG5cdFx0XHRcdFx0XHQnb3BhY2l0eSc6ICcxJ1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XHJcblx0XHRcdFx0fSwgdGhpcyk7XHJcblx0XHRcdFx0aW1hZ2Uuc3JjID0gdXJsO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0dGhpcy5fbG9hZGVkLnB1c2goJGl0ZW0uZ2V0KDApKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRMYXp5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuaGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5MYXp5ID0gTGF6eTtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvSGVpZ2h0IFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjEuMFxyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBhdXRvIGhlaWdodCBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBBdXRvIEhlaWdodCBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIEF1dG9IZWlnaHQgPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T3dsfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCByZWZyZXNoZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCkge1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0ICYmIGUucHJvcGVydHkubmFtZSA9PSAncG9zaXRpb24nKXtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2xvYWRlZC5vd2wubGF6eSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHRcclxuXHRcdFx0XHRcdCYmIGUuZWxlbWVudC5jbG9zZXN0KCcuJyArIHRoaXMuX2NvcmUuc2V0dGluZ3MuaXRlbUNsYXNzKS5pbmRleCgpID09PSB0aGlzLl9jb3JlLmN1cnJlbnQoKSkge1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvSGVpZ2h0LkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9IZWlnaHQuRGVmYXVsdHMgPSB7XHJcblx0XHRhdXRvSGVpZ2h0OiBmYWxzZSxcclxuXHRcdGF1dG9IZWlnaHRDbGFzczogJ293bC1oZWlnaHQnXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlcyB0aGUgdmlldy5cclxuXHQgKi9cclxuXHRBdXRvSGVpZ2h0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBzdGFydCA9IHRoaXMuX2NvcmUuX2N1cnJlbnQsXHJcblx0XHRcdGVuZCA9IHN0YXJ0ICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtcyxcclxuXHRcdFx0dmlzaWJsZSA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCkudG9BcnJheSgpLnNsaWNlKHN0YXJ0LCBlbmQpLFxyXG5cdFx0XHRoZWlnaHRzID0gW10sXHJcblx0XHRcdG1heGhlaWdodCA9IDA7XHJcblxyXG5cdFx0JC5lYWNoKHZpc2libGUsIGZ1bmN0aW9uKGluZGV4LCBpdGVtKSB7XHJcblx0XHRcdGhlaWdodHMucHVzaCgkKGl0ZW0pLmhlaWdodCgpKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdG1heGhlaWdodCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIGhlaWdodHMpO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUuJHN0YWdlLnBhcmVudCgpXHJcblx0XHRcdC5oZWlnaHQobWF4aGVpZ2h0KVxyXG5cdFx0XHQuYWRkQ2xhc3ModGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0Q2xhc3MpO1xyXG5cdH07XHJcblxyXG5cdEF1dG9IZWlnaHQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xyXG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuQXV0b0hlaWdodCA9IEF1dG9IZWlnaHQ7XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogVmlkZW8gUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMS4wXHJcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIHZpZGVvIHBsdWdpbi5cclxuXHQgKiBAY2xhc3MgVGhlIFZpZGVvIFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWxcclxuXHQgKi9cclxuXHR2YXIgVmlkZW8gPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T3dsfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDYWNoZSBhbGwgdmlkZW8gVVJMcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3ZpZGVvcyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBwbGF5aW5nIGl0ZW0uXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7alF1ZXJ5fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9wbGF5aW5nID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEB0b2RvIFRoZSBjbG9uZWQgY29udGVudCByZW1vdmFsZSBpcyB0b28gbGF0ZVxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUucmVnaXN0ZXIoeyB0eXBlOiAnc3RhdGUnLCBuYW1lOiAncGxheWluZycsIHRhZ3M6IFsgJ2ludGVyYWN0aW5nJyBdIH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdyZXNpemUub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MudmlkZW8gJiYgdGhpcy5pc0luRnVsbFNjcmVlbigpKSB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3JlZnJlc2hlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5pcygncmVzaXppbmcnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS4kc3RhZ2UuZmluZCgnLmNsb25lZCAub3dsLXZpZGVvLWZyYW1lJykucmVtb3ZlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3Bvc2l0aW9uJyAmJiB0aGlzLl9wbGF5aW5nKSB7XHJcblx0XHRcdFx0XHR0aGlzLnN0b3AoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncHJlcGFyZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKCFlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyICRlbGVtZW50ID0gJChlLmNvbnRlbnQpLmZpbmQoJy5vd2wtdmlkZW8nKTtcclxuXHJcblx0XHRcdFx0aWYgKCRlbGVtZW50Lmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0JGVsZW1lbnQuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcclxuXHRcdFx0XHRcdHRoaXMuZmV0Y2goJGVsZW1lbnQsICQoZS5jb250ZW50KSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKVxyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgVmlkZW8uRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24oJ2NsaWNrLm93bC52aWRlbycsICcub3dsLXZpZGVvLXBsYXktaWNvbicsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR0aGlzLnBsYXkoZSk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRWaWRlby5EZWZhdWx0cyA9IHtcclxuXHRcdHZpZGVvOiBmYWxzZSxcclxuXHRcdHZpZGVvSGVpZ2h0OiBmYWxzZSxcclxuXHRcdHZpZGVvV2lkdGg6IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgdmlkZW8gSUQgYW5kIHRoZSB0eXBlIChZb3VUdWJlL1ZpbWVvL3Z6YWFyIG9ubHkpLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gdGFyZ2V0IC0gVGhlIHRhcmdldCBjb250YWluaW5nIHRoZSB2aWRlbyBkYXRhLlxyXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSBpdGVtIC0gVGhlIGl0ZW0gY29udGFpbmluZyB0aGUgdmlkZW8uXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24odGFyZ2V0LCBpdGVtKSB7XHJcblx0XHRcdHZhciB0eXBlID0gKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0aWYgKHRhcmdldC5hdHRyKCdkYXRhLXZpbWVvLWlkJykpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuICd2aW1lbyc7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHRhcmdldC5hdHRyKCdkYXRhLXZ6YWFyLWlkJykpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuICd2emFhcidcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAneW91dHViZSc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSkoKSxcclxuXHRcdFx0XHRpZCA9IHRhcmdldC5hdHRyKCdkYXRhLXZpbWVvLWlkJykgfHwgdGFyZ2V0LmF0dHIoJ2RhdGEteW91dHViZS1pZCcpIHx8IHRhcmdldC5hdHRyKCdkYXRhLXZ6YWFyLWlkJyksXHJcblx0XHRcdFx0d2lkdGggPSB0YXJnZXQuYXR0cignZGF0YS13aWR0aCcpIHx8IHRoaXMuX2NvcmUuc2V0dGluZ3MudmlkZW9XaWR0aCxcclxuXHRcdFx0XHRoZWlnaHQgPSB0YXJnZXQuYXR0cignZGF0YS1oZWlnaHQnKSB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLnZpZGVvSGVpZ2h0LFxyXG5cdFx0XHRcdHVybCA9IHRhcmdldC5hdHRyKCdocmVmJyk7XHJcblxyXG5cdFx0aWYgKHVybCkge1xyXG5cclxuXHRcdFx0LypcclxuXHRcdFx0XHRcdFBhcnNlcyB0aGUgaWQncyBvdXQgb2YgdGhlIGZvbGxvd2luZyB1cmxzIChhbmQgcHJvYmFibHkgbW9yZSk6XHJcblx0XHRcdFx0XHRodHRwczovL3d3dy55b3V0dWJlLmNvbS93YXRjaD92PTppZFxyXG5cdFx0XHRcdFx0aHR0cHM6Ly95b3V0dS5iZS86aWRcclxuXHRcdFx0XHRcdGh0dHBzOi8vdmltZW8uY29tLzppZFxyXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vY2hhbm5lbHMvOmNoYW5uZWwvOmlkXHJcblx0XHRcdFx0XHRodHRwczovL3ZpbWVvLmNvbS9ncm91cHMvOmdyb3VwL3ZpZGVvcy86aWRcclxuXHRcdFx0XHRcdGh0dHBzOi8vYXBwLnZ6YWFyLmNvbS92aWRlb3MvOmlkXHJcblxyXG5cdFx0XHRcdFx0VmlzdWFsIGV4YW1wbGU6IGh0dHBzOi8vcmVnZXhwZXIuY29tLyMoaHR0cCUzQSU3Q2h0dHBzJTNBJTdDKSU1QyUyRiU1QyUyRihwbGF5ZXIuJTdDd3d3LiU3Q2FwcC4pJTNGKHZpbWVvJTVDLmNvbSU3Q3lvdXR1KGJlJTVDLmNvbSU3QyU1Qy5iZSU3Q2JlJTVDLmdvb2dsZWFwaXMlNUMuY29tKSU3Q3Z6YWFyJTVDLmNvbSklNUMlMkYodmlkZW8lNUMlMkYlN0N2aWRlb3MlNUMlMkYlN0NlbWJlZCU1QyUyRiU3Q2NoYW5uZWxzJTVDJTJGLiUyQiU1QyUyRiU3Q2dyb3VwcyU1QyUyRi4lMkIlNUMlMkYlN0N3YXRjaCU1QyUzRnYlM0QlN0N2JTVDJTJGKSUzRiglNUJBLVphLXowLTkuXyUyNS0lNUQqKSglNUMlMjYlNUNTJTJCKSUzRlxyXG5cdFx0XHQqL1xyXG5cclxuXHRcdFx0aWQgPSB1cmwubWF0Y2goLyhodHRwOnxodHRwczp8KVxcL1xcLyhwbGF5ZXIufHd3dy58YXBwLik/KHZpbWVvXFwuY29tfHlvdXR1KGJlXFwuY29tfFxcLmJlfGJlXFwuZ29vZ2xlYXBpc1xcLmNvbSl8dnphYXJcXC5jb20pXFwvKHZpZGVvXFwvfHZpZGVvc1xcL3xlbWJlZFxcL3xjaGFubmVsc1xcLy4rXFwvfGdyb3Vwc1xcLy4rXFwvfHdhdGNoXFw/dj18dlxcLyk/KFtBLVphLXowLTkuXyUtXSopKFxcJlxcUyspPy8pO1xyXG5cclxuXHRcdFx0aWYgKGlkWzNdLmluZGV4T2YoJ3lvdXR1JykgPiAtMSkge1xyXG5cdFx0XHRcdHR5cGUgPSAneW91dHViZSc7XHJcblx0XHRcdH0gZWxzZSBpZiAoaWRbM10uaW5kZXhPZigndmltZW8nKSA+IC0xKSB7XHJcblx0XHRcdFx0dHlwZSA9ICd2aW1lbyc7XHJcblx0XHRcdH0gZWxzZSBpZiAoaWRbM10uaW5kZXhPZigndnphYXInKSA+IC0xKSB7XHJcblx0XHRcdFx0dHlwZSA9ICd2emFhcic7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdWaWRlbyBVUkwgbm90IHN1cHBvcnRlZC4nKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZCA9IGlkWzZdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHZpZGVvIFVSTC4nKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl92aWRlb3NbdXJsXSA9IHtcclxuXHRcdFx0dHlwZTogdHlwZSxcclxuXHRcdFx0aWQ6IGlkLFxyXG5cdFx0XHR3aWR0aDogd2lkdGgsXHJcblx0XHRcdGhlaWdodDogaGVpZ2h0XHJcblx0XHR9O1xyXG5cclxuXHRcdGl0ZW0uYXR0cignZGF0YS12aWRlbycsIHVybCk7XHJcblxyXG5cdFx0dGhpcy50aHVtYm5haWwodGFyZ2V0LCB0aGlzLl92aWRlb3NbdXJsXSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB2aWRlbyB0aHVtYm5haWwuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSB0YXJnZXQgLSBUaGUgdGFyZ2V0IGNvbnRhaW5pbmcgdGhlIHZpZGVvIGRhdGEuXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGluZm8gLSBUaGUgdmlkZW8gaW5mbyBvYmplY3QuXHJcblx0ICogQHNlZSBgZmV0Y2hgXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLnRodW1ibmFpbCA9IGZ1bmN0aW9uKHRhcmdldCwgdmlkZW8pIHtcclxuXHRcdHZhciB0bkxpbmssXHJcblx0XHRcdGljb24sXHJcblx0XHRcdHBhdGgsXHJcblx0XHRcdGRpbWVuc2lvbnMgPSB2aWRlby53aWR0aCAmJiB2aWRlby5oZWlnaHQgPyAnc3R5bGU9XCJ3aWR0aDonICsgdmlkZW8ud2lkdGggKyAncHg7aGVpZ2h0OicgKyB2aWRlby5oZWlnaHQgKyAncHg7XCInIDogJycsXHJcblx0XHRcdGN1c3RvbVRuID0gdGFyZ2V0LmZpbmQoJ2ltZycpLFxyXG5cdFx0XHRzcmNUeXBlID0gJ3NyYycsXHJcblx0XHRcdGxhenlDbGFzcyA9ICcnLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXHJcblx0XHRcdGNyZWF0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcclxuXHRcdFx0XHRpY29uID0gJzxkaXYgY2xhc3M9XCJvd2wtdmlkZW8tcGxheS1pY29uXCI+PC9kaXY+JztcclxuXHJcblx0XHRcdFx0aWYgKHNldHRpbmdzLmxhenlMb2FkKSB7XHJcblx0XHRcdFx0XHR0bkxpbmsgPSAnPGRpdiBjbGFzcz1cIm93bC12aWRlby10biAnICsgbGF6eUNsYXNzICsgJ1wiICcgKyBzcmNUeXBlICsgJz1cIicgKyBwYXRoICsgJ1wiPjwvZGl2Pic7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRuTGluayA9ICc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLXRuXCIgc3R5bGU9XCJvcGFjaXR5OjE7YmFja2dyb3VuZC1pbWFnZTp1cmwoJyArIHBhdGggKyAnKVwiPjwvZGl2Pic7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRhcmdldC5hZnRlcih0bkxpbmspO1xyXG5cdFx0XHRcdHRhcmdldC5hZnRlcihpY29uKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHQvLyB3cmFwIHZpZGVvIGNvbnRlbnQgaW50byBvd2wtdmlkZW8td3JhcHBlciBkaXZcclxuXHRcdHRhcmdldC53cmFwKCc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLXdyYXBwZXJcIicgKyBkaW1lbnNpb25zICsgJz48L2Rpdj4nKTtcclxuXHJcblx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5sYXp5TG9hZCkge1xyXG5cdFx0XHRzcmNUeXBlID0gJ2RhdGEtc3JjJztcclxuXHRcdFx0bGF6eUNsYXNzID0gJ293bC1sYXp5JztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBjdXN0b20gdGh1bWJuYWlsXHJcblx0XHRpZiAoY3VzdG9tVG4ubGVuZ3RoKSB7XHJcblx0XHRcdGNyZWF0ZShjdXN0b21Ubi5hdHRyKHNyY1R5cGUpKTtcclxuXHRcdFx0Y3VzdG9tVG4ucmVtb3ZlKCk7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodmlkZW8udHlwZSA9PT0gJ3lvdXR1YmUnKSB7XHJcblx0XHRcdHBhdGggPSBcIi8vaW1nLnlvdXR1YmUuY29tL3ZpL1wiICsgdmlkZW8uaWQgKyBcIi9ocWRlZmF1bHQuanBnXCI7XHJcblx0XHRcdGNyZWF0ZShwYXRoKTtcclxuXHRcdH0gZWxzZSBpZiAodmlkZW8udHlwZSA9PT0gJ3ZpbWVvJykge1xyXG5cdFx0XHQkLmFqYXgoe1xyXG5cdFx0XHRcdHR5cGU6ICdHRVQnLFxyXG5cdFx0XHRcdHVybDogJy8vdmltZW8uY29tL2FwaS92Mi92aWRlby8nICsgdmlkZW8uaWQgKyAnLmpzb24nLFxyXG5cdFx0XHRcdGpzb25wOiAnY2FsbGJhY2snLFxyXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbnAnLFxyXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEpIHtcclxuXHRcdFx0XHRcdHBhdGggPSBkYXRhWzBdLnRodW1ibmFpbF9sYXJnZTtcclxuXHRcdFx0XHRcdGNyZWF0ZShwYXRoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIGlmICh2aWRlby50eXBlID09PSAndnphYXInKSB7XHJcblx0XHRcdCQuYWpheCh7XHJcblx0XHRcdFx0dHlwZTogJ0dFVCcsXHJcblx0XHRcdFx0dXJsOiAnLy92emFhci5jb20vYXBpL3ZpZGVvcy8nICsgdmlkZW8uaWQgKyAnLmpzb24nLFxyXG5cdFx0XHRcdGpzb25wOiAnY2FsbGJhY2snLFxyXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbnAnLFxyXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEpIHtcclxuXHRcdFx0XHRcdHBhdGggPSBkYXRhLmZyYW1lZ3JhYl91cmw7XHJcblx0XHRcdFx0XHRjcmVhdGUocGF0aCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTdG9wcyB0aGUgY3VycmVudCB2aWRlby5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMuX2NvcmUudHJpZ2dlcignc3RvcCcsIG51bGwsICd2aWRlbycpO1xyXG5cdFx0dGhpcy5fcGxheWluZy5maW5kKCcub3dsLXZpZGVvLWZyYW1lJykucmVtb3ZlKCk7XHJcblx0XHR0aGlzLl9wbGF5aW5nLnJlbW92ZUNsYXNzKCdvd2wtdmlkZW8tcGxheWluZycpO1xyXG5cdFx0dGhpcy5fcGxheWluZyA9IG51bGw7XHJcblx0XHR0aGlzLl9jb3JlLmxlYXZlKCdwbGF5aW5nJyk7XHJcblx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3N0b3BwZWQnLCBudWxsLCAndmlkZW8nKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTdGFydHMgdGhlIGN1cnJlbnQgdmlkZW8uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKi9cclxuXHRWaWRlby5wcm90b3R5cGUucGxheSA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgdGFyZ2V0ID0gJChldmVudC50YXJnZXQpLFxyXG5cdFx0XHRpdGVtID0gdGFyZ2V0LmNsb3Nlc3QoJy4nICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtQ2xhc3MpLFxyXG5cdFx0XHR2aWRlbyA9IHRoaXMuX3ZpZGVvc1tpdGVtLmF0dHIoJ2RhdGEtdmlkZW8nKV0sXHJcblx0XHRcdHdpZHRoID0gdmlkZW8ud2lkdGggfHwgJzEwMCUnLFxyXG5cdFx0XHRoZWlnaHQgPSB2aWRlby5oZWlnaHQgfHwgdGhpcy5fY29yZS4kc3RhZ2UuaGVpZ2h0KCksXHJcblx0XHRcdGh0bWw7XHJcblxyXG5cdFx0aWYgKHRoaXMuX3BsYXlpbmcpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvcmUuZW50ZXIoJ3BsYXlpbmcnKTtcclxuXHRcdHRoaXMuX2NvcmUudHJpZ2dlcigncGxheScsIG51bGwsICd2aWRlbycpO1xyXG5cclxuXHRcdGl0ZW0gPSB0aGlzLl9jb3JlLml0ZW1zKHRoaXMuX2NvcmUucmVsYXRpdmUoaXRlbS5pbmRleCgpKSk7XHJcblxyXG5cdFx0dGhpcy5fY29yZS5yZXNldChpdGVtLmluZGV4KCkpO1xyXG5cclxuXHRcdGlmICh2aWRlby50eXBlID09PSAneW91dHViZScpIHtcclxuXHRcdFx0aHRtbCA9ICc8aWZyYW1lIHdpZHRoPVwiJyArIHdpZHRoICsgJ1wiIGhlaWdodD1cIicgKyBoZWlnaHQgKyAnXCIgc3JjPVwiLy93d3cueW91dHViZS5jb20vZW1iZWQvJyArXHJcblx0XHRcdFx0dmlkZW8uaWQgKyAnP2F1dG9wbGF5PTEmcmVsPTAmdj0nICsgdmlkZW8uaWQgKyAnXCIgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPic7XHJcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2aW1lbycpIHtcclxuXHRcdFx0aHRtbCA9ICc8aWZyYW1lIHNyYz1cIi8vcGxheWVyLnZpbWVvLmNvbS92aWRlby8nICsgdmlkZW8uaWQgK1xyXG5cdFx0XHRcdCc/YXV0b3BsYXk9MVwiIHdpZHRoPVwiJyArIHdpZHRoICsgJ1wiIGhlaWdodD1cIicgKyBoZWlnaHQgK1xyXG5cdFx0XHRcdCdcIiBmcmFtZWJvcmRlcj1cIjBcIiB3ZWJraXRhbGxvd2Z1bGxzY3JlZW4gbW96YWxsb3dmdWxsc2NyZWVuIGFsbG93ZnVsbHNjcmVlbj48L2lmcmFtZT4nO1xyXG5cdFx0fSBlbHNlIGlmICh2aWRlby50eXBlID09PSAndnphYXInKSB7XHJcblx0XHRcdGh0bWwgPSAnPGlmcmFtZSBmcmFtZWJvcmRlcj1cIjBcIicgKyAnaGVpZ2h0PVwiJyArIGhlaWdodCArICdcIicgKyAnd2lkdGg9XCInICsgd2lkdGggK1xyXG5cdFx0XHRcdCdcIiBhbGxvd2Z1bGxzY3JlZW4gbW96YWxsb3dmdWxsc2NyZWVuIHdlYmtpdEFsbG93RnVsbFNjcmVlbiAnICtcclxuXHRcdFx0XHQnc3JjPVwiLy92aWV3LnZ6YWFyLmNvbS8nICsgdmlkZW8uaWQgKyAnL3BsYXllcj9hdXRvcGxheT10cnVlXCI+PC9pZnJhbWU+JztcclxuXHRcdH1cclxuXHJcblx0XHQkKCc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLWZyYW1lXCI+JyArIGh0bWwgKyAnPC9kaXY+JykuaW5zZXJ0QWZ0ZXIoaXRlbS5maW5kKCcub3dsLXZpZGVvJykpO1xyXG5cclxuXHRcdHRoaXMuX3BsYXlpbmcgPSBpdGVtLmFkZENsYXNzKCdvd2wtdmlkZW8tcGxheWluZycpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrcyB3aGV0aGVyIGFuIHZpZGVvIGlzIGN1cnJlbnRseSBpbiBmdWxsIHNjcmVlbiBtb2RlIG9yIG5vdC5cclxuXHQgKiBAdG9kbyBCYWQgc3R5bGUgYmVjYXVzZSBsb29rcyBsaWtlIGEgcmVhZG9ubHkgbWV0aG9kIGJ1dCBjaGFuZ2VzIG1lbWJlcnMuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufVxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5pc0luRnVsbFNjcmVlbiA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudCB8fCBkb2N1bWVudC5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fFxyXG5cdFx0XHRcdGRvY3VtZW50LndlYmtpdEZ1bGxzY3JlZW5FbGVtZW50O1xyXG5cclxuXHRcdHJldHVybiBlbGVtZW50ICYmICQoZWxlbWVudCkucGFyZW50KCkuaGFzQ2xhc3MoJ293bC12aWRlby1mcmFtZScpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZignY2xpY2sub3dsLnZpZGVvJyk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLlZpZGVvID0gVmlkZW87XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogQW5pbWF0ZSBQbHVnaW5cclxuICogQHZlcnNpb24gMi4xLjBcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYW5pbWF0ZSBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBOYXZpZ2F0aW9uIFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBzY29wZSAtIFRoZSBPd2wgQ2Fyb3VzZWxcclxuXHQgKi9cclxuXHR2YXIgQW5pbWF0ZSA9IGZ1bmN0aW9uKHNjb3BlKSB7XHJcblx0XHR0aGlzLmNvcmUgPSBzY29wZTtcclxuXHRcdHRoaXMuY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEFuaW1hdGUuRGVmYXVsdHMsIHRoaXMuY29yZS5vcHRpb25zKTtcclxuXHRcdHRoaXMuc3dhcHBpbmcgPSB0cnVlO1xyXG5cdFx0dGhpcy5wcmV2aW91cyA9IHVuZGVmaW5lZDtcclxuXHRcdHRoaXMubmV4dCA9IHVuZGVmaW5lZDtcclxuXHJcblx0XHR0aGlzLmhhbmRsZXJzID0ge1xyXG5cdFx0XHQnY2hhbmdlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT0gJ3Bvc2l0aW9uJykge1xyXG5cdFx0XHRcdFx0dGhpcy5wcmV2aW91cyA9IHRoaXMuY29yZS5jdXJyZW50KCk7XHJcblx0XHRcdFx0XHR0aGlzLm5leHQgPSBlLnByb3BlcnR5LnZhbHVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdkcmFnLm93bC5jYXJvdXNlbCBkcmFnZ2VkLm93bC5jYXJvdXNlbCB0cmFuc2xhdGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5zd2FwcGluZyA9IGUudHlwZSA9PSAndHJhbnNsYXRlZCc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RyYW5zbGF0ZS5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5zd2FwcGluZyAmJiAodGhpcy5jb3JlLm9wdGlvbnMuYW5pbWF0ZU91dCB8fCB0aGlzLmNvcmUub3B0aW9ucy5hbmltYXRlSW4pKSB7XHJcblx0XHRcdFx0XHR0aGlzLnN3YXAoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuY29yZS4kZWxlbWVudC5vbih0aGlzLmhhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEFuaW1hdGUuRGVmYXVsdHMgPSB7XHJcblx0XHRhbmltYXRlT3V0OiBmYWxzZSxcclxuXHRcdGFuaW1hdGVJbjogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUb2dnbGVzIHRoZSBhbmltYXRpb24gY2xhc3NlcyB3aGVuZXZlciBhbiB0cmFuc2xhdGlvbnMgc3RhcnRzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbnx1bmRlZmluZWR9XHJcblx0ICovXHJcblx0QW5pbWF0ZS5wcm90b3R5cGUuc3dhcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdGlmICh0aGlzLmNvcmUuc2V0dGluZ3MuaXRlbXMgIT09IDEpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghJC5zdXBwb3J0LmFuaW1hdGlvbiB8fCAhJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29yZS5zcGVlZCgwKTtcclxuXHJcblx0XHR2YXIgbGVmdCxcclxuXHRcdFx0Y2xlYXIgPSAkLnByb3h5KHRoaXMuY2xlYXIsIHRoaXMpLFxyXG5cdFx0XHRwcmV2aW91cyA9IHRoaXMuY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS5lcSh0aGlzLnByZXZpb3VzKSxcclxuXHRcdFx0bmV4dCA9IHRoaXMuY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS5lcSh0aGlzLm5leHQpLFxyXG5cdFx0XHRpbmNvbWluZyA9IHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlSW4sXHJcblx0XHRcdG91dGdvaW5nID0gdGhpcy5jb3JlLnNldHRpbmdzLmFuaW1hdGVPdXQ7XHJcblxyXG5cdFx0aWYgKHRoaXMuY29yZS5jdXJyZW50KCkgPT09IHRoaXMucHJldmlvdXMpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChvdXRnb2luZykge1xyXG5cdFx0XHRsZWZ0ID0gdGhpcy5jb3JlLmNvb3JkaW5hdGVzKHRoaXMucHJldmlvdXMpIC0gdGhpcy5jb3JlLmNvb3JkaW5hdGVzKHRoaXMubmV4dCk7XHJcblx0XHRcdHByZXZpb3VzLm9uZSgkLnN1cHBvcnQuYW5pbWF0aW9uLmVuZCwgY2xlYXIpXHJcblx0XHRcdFx0LmNzcyggeyAnbGVmdCc6IGxlZnQgKyAncHgnIH0gKVxyXG5cdFx0XHRcdC5hZGRDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLW91dCcpXHJcblx0XHRcdFx0LmFkZENsYXNzKG91dGdvaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoaW5jb21pbmcpIHtcclxuXHRcdFx0bmV4dC5vbmUoJC5zdXBwb3J0LmFuaW1hdGlvbi5lbmQsIGNsZWFyKVxyXG5cdFx0XHRcdC5hZGRDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLWluJylcclxuXHRcdFx0XHQuYWRkQ2xhc3MoaW5jb21pbmcpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdEFuaW1hdGUucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0JChlLnRhcmdldCkuY3NzKCB7ICdsZWZ0JzogJycgfSApXHJcblx0XHRcdC5yZW1vdmVDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLW91dCBvd2wtYW5pbWF0ZWQtaW4nKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5jb3JlLnNldHRpbmdzLmFuaW1hdGVJbilcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlT3V0KTtcclxuXHRcdHRoaXMuY29yZS5vblRyYW5zaXRpb25FbmQoKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBbmltYXRlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuaGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLmhhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkFuaW1hdGUgPSBBbmltYXRlO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIEF1dG9wbGF5IFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjEuMFxyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYXV0b3BsYXkgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgQXV0b3BsYXkgUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IHNjb3BlIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBBdXRvcGxheSA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRoZSBhdXRvcGxheSB0aW1lb3V0LlxyXG5cdFx0ICogQHR5cGUge1RpbWVvdXR9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3RpbWVvdXQgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5kaWNhdGVzIHdoZW5ldmVyIHRoZSBhdXRvcGxheSBpcyBwYXVzZWQuXHJcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGF1c2VkID0gZmFsc2U7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3NldHRpbmdzJykge1xyXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXkpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wbGF5KCk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnN0b3AoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3Bvc2l0aW9uJykge1xyXG5cdFx0XHRcdFx0Ly9jb25zb2xlLmxvZygncGxheT8nLCBlKTtcclxuXHRcdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5KSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuX3NldEF1dG9QbGF5SW50ZXJ2YWwoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXkpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdwbGF5Lm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oZSwgdCwgcykge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wbGF5KHQsIHMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdzdG9wLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5zdG9wKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J21vdXNlb3Zlci5vd2wuYXV0b3BsYXknOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J21vdXNlbGVhdmUub3dsLmF1dG9wbGF5JzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UgJiYgdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wbGF5KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RvdWNoc3RhcnQub3dsLmNvcmUnOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RvdWNoZW5kLm93bC5jb3JlJzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvcGxheS5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LkRlZmF1bHRzID0ge1xyXG5cdFx0YXV0b3BsYXk6IGZhbHNlLFxyXG5cdFx0YXV0b3BsYXlUaW1lb3V0OiA1MDAwLFxyXG5cdFx0YXV0b3BsYXlIb3ZlclBhdXNlOiBmYWxzZSxcclxuXHRcdGF1dG9wbGF5U3BlZWQ6IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU3RhcnRzIHRoZSBhdXRvcGxheS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFt0aW1lb3V0XSAtIFRoZSBpbnRlcnZhbCBiZWZvcmUgdGhlIG5leHQgYW5pbWF0aW9uIHN0YXJ0cy5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSBhbmltYXRpb24gc3BlZWQgZm9yIHRoZSBhbmltYXRpb25zLlxyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24odGltZW91dCwgc3BlZWQpIHtcclxuXHRcdHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb3JlLmVudGVyKCdyb3RhdGluZycpO1xyXG5cclxuXHRcdHRoaXMuX3NldEF1dG9QbGF5SW50ZXJ2YWwoKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIGEgbmV3IHRpbWVvdXRcclxuXHQgKiBAcHJpdmF0ZVxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbdGltZW91dF0gLSBUaGUgaW50ZXJ2YWwgYmVmb3JlIHRoZSBuZXh0IGFuaW1hdGlvbiBzdGFydHMuXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgYW5pbWF0aW9uIHNwZWVkIGZvciB0aGUgYW5pbWF0aW9ucy5cclxuXHQgKiBAcmV0dXJuIHtUaW1lb3V0fVxyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5fZ2V0TmV4dFRpbWVvdXQgPSBmdW5jdGlvbih0aW1lb3V0LCBzcGVlZCkge1xyXG5cdFx0aWYgKCB0aGlzLl90aW1lb3V0ICkge1xyXG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHdpbmRvdy5zZXRUaW1lb3V0KCQucHJveHkoZnVuY3Rpb24oKSB7XHJcblx0XHRcdGlmICh0aGlzLl9wYXVzZWQgfHwgdGhpcy5fY29yZS5pcygnYnVzeScpIHx8IHRoaXMuX2NvcmUuaXMoJ2ludGVyYWN0aW5nJykgfHwgZG9jdW1lbnQuaGlkZGVuKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX2NvcmUubmV4dChzcGVlZCB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5U3BlZWQpO1xyXG5cdFx0fSwgdGhpcyksIHRpbWVvdXQgfHwgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheVRpbWVvdXQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldHMgYXV0b3BsYXkgaW4gbW90aW9uLlxyXG5cdCAqIEBwcml2YXRlXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLl9zZXRBdXRvUGxheUludGVydmFsID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLl90aW1lb3V0ID0gdGhpcy5fZ2V0TmV4dFRpbWVvdXQoKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTdG9wcyB0aGUgYXV0b3BsYXkuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAoIXRoaXMuX2NvcmUuaXMoJ3JvdGF0aW5nJykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fdGltZW91dCk7XHJcblx0XHR0aGlzLl9jb3JlLmxlYXZlKCdyb3RhdGluZycpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN0b3BzIHRoZSBhdXRvcGxheS5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAoIXRoaXMuX2NvcmUuaXMoJ3JvdGF0aW5nJykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3BhdXNlZCA9IHRydWU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKi9cclxuXHRBdXRvcGxheS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIHByb3BlcnR5O1xyXG5cclxuXHRcdHRoaXMuc3RvcCgpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5hdXRvcGxheSA9IEF1dG9wbGF5O1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIE5hdmlnYXRpb24gUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMS4wXHJcbiAqIEBhdXRob3IgQXJ0dXMgS29sYW5vd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgbmF2aWdhdGlvbiBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBOYXZpZ2F0aW9uIFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWwuXHJcblx0ICovXHJcblx0dmFyIE5hdmlnYXRpb24gPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T3dsfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgcGx1Z2luIGlzIGluaXRpYWxpemVkIG9yIG5vdC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pbml0aWFsaXplZCA9IGZhbHNlO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGhlIGN1cnJlbnQgcGFnaW5nIGluZGV4ZXMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7QXJyYXl9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3BhZ2VzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgRE9NIGVsZW1lbnRzIG9mIHRoZSB1c2VyIGludGVyZmFjZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvbnRyb2xzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNYXJrdXAgZm9yIGFuIGluZGljYXRvci5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtBcnJheS48U3RyaW5nPn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fdGVtcGxhdGVzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUaGUgY2Fyb3VzZWwgZWxlbWVudC5cclxuXHRcdCAqIEB0eXBlIHtqUXVlcnl9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuJGVsZW1lbnQgPSB0aGlzLl9jb3JlLiRlbGVtZW50O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3ZlcnJpZGRlbiBtZXRob2RzIG9mIHRoZSBjYXJvdXNlbC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX292ZXJyaWRlcyA9IHtcclxuXHRcdFx0bmV4dDogdGhpcy5fY29yZS5uZXh0LFxyXG5cdFx0XHRwcmV2OiB0aGlzLl9jb3JlLnByZXYsXHJcblx0XHRcdHRvOiB0aGlzLl9jb3JlLnRvXHJcblx0XHR9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdwcmVwYXJlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RzRGF0YSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fdGVtcGxhdGVzLnB1c2goJzxkaXYgY2xhc3M9XCInICsgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RDbGFzcyArICdcIj4nICtcclxuXHRcdFx0XHRcdFx0JChlLmNvbnRlbnQpLmZpbmQoJ1tkYXRhLWRvdF0nKS5hZGRCYWNrKCdbZGF0YS1kb3RdJykuYXR0cignZGF0YS1kb3QnKSArICc8L2Rpdj4nKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnYWRkZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuZG90c0RhdGEpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3RlbXBsYXRlcy5zcGxpY2UoZS5wb3NpdGlvbiwgMCwgdGhpcy5fdGVtcGxhdGVzLnBvcCgpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncmVtb3ZlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmRvdHNEYXRhKSB7XHJcblx0XHRcdFx0XHR0aGlzLl90ZW1wbGF0ZXMuc3BsaWNlKGUucG9zaXRpb24sIDEpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT0gJ3Bvc2l0aW9uJykge1xyXG5cdFx0XHRcdFx0dGhpcy5kcmF3KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiAhdGhpcy5faW5pdGlhbGl6ZWQpIHtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignaW5pdGlhbGl6ZScsIG51bGwsICduYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0XHR0aGlzLmluaXRpYWxpemUoKTtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0XHR0aGlzLmRyYXcoKTtcclxuXHRcdFx0XHRcdHRoaXMuX2luaXRpYWxpemVkID0gdHJ1ZTtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignaW5pdGlhbGl6ZWQnLCBudWxsLCAnbmF2aWdhdGlvbicpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdyZWZyZXNoZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2luaXRpYWxpemVkKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3JlZnJlc2gnLCBudWxsLCAnbmF2aWdhdGlvbicpO1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHRcdHRoaXMuZHJhdygpO1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdyZWZyZXNoZWQnLCBudWxsLCAnbmF2aWdhdGlvbicpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xyXG5cdFx0dGhpcy5fY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIE5hdmlnYXRpb24uRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHRvZG8gUmVuYW1lIGBzbGlkZUJ5YCB0byBgbmF2QnlgXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5EZWZhdWx0cyA9IHtcclxuXHRcdG5hdjogZmFsc2UsXHJcblx0XHRuYXZUZXh0OiBbICdwcmV2JywgJ25leHQnIF0sXHJcblx0XHRuYXZTcGVlZDogZmFsc2UsXHJcblx0XHRuYXZFbGVtZW50OiAnZGl2JyxcclxuXHRcdG5hdkNvbnRhaW5lcjogZmFsc2UsXHJcblx0XHRuYXZDb250YWluZXJDbGFzczogJ293bC1uYXYnLFxyXG5cdFx0bmF2Q2xhc3M6IFsgJ293bC1wcmV2JywgJ293bC1uZXh0JyBdLFxyXG5cdFx0c2xpZGVCeTogMSxcclxuXHRcdGRvdENsYXNzOiAnb3dsLWRvdCcsXHJcblx0XHRkb3RzQ2xhc3M6ICdvd2wtZG90cycsXHJcblx0XHRkb3RzOiB0cnVlLFxyXG5cdFx0ZG90c0VhY2g6IGZhbHNlLFxyXG5cdFx0ZG90c0RhdGE6IGZhbHNlLFxyXG5cdFx0ZG90c1NwZWVkOiBmYWxzZSxcclxuXHRcdGRvdHNDb250YWluZXI6IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogSW5pdGlhbGl6ZXMgdGhlIGxheW91dCBvZiB0aGUgcGx1Z2luIGFuZCBleHRlbmRzIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIG92ZXJyaWRlLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XHJcblxyXG5cdFx0Ly8gY3JlYXRlIERPTSBzdHJ1Y3R1cmUgZm9yIHJlbGF0aXZlIG5hdmlnYXRpb25cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZSA9IChzZXR0aW5ncy5uYXZDb250YWluZXIgPyAkKHNldHRpbmdzLm5hdkNvbnRhaW5lcilcclxuXHRcdFx0OiAkKCc8ZGl2PicpLmFkZENsYXNzKHNldHRpbmdzLm5hdkNvbnRhaW5lckNsYXNzKS5hcHBlbmRUbyh0aGlzLiRlbGVtZW50KSkuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XHJcblxyXG5cdFx0dGhpcy5fY29udHJvbHMuJHByZXZpb3VzID0gJCgnPCcgKyBzZXR0aW5ncy5uYXZFbGVtZW50ICsgJz4nKVxyXG5cdFx0XHQuYWRkQ2xhc3Moc2V0dGluZ3MubmF2Q2xhc3NbMF0pXHJcblx0XHRcdC5odG1sKHNldHRpbmdzLm5hdlRleHRbMF0pXHJcblx0XHRcdC5wcmVwZW5kVG8odGhpcy5fY29udHJvbHMuJHJlbGF0aXZlKVxyXG5cdFx0XHQub24oJ2NsaWNrJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0dGhpcy5wcmV2KHNldHRpbmdzLm5hdlNwZWVkKTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0dGhpcy5fY29udHJvbHMuJG5leHQgPSAkKCc8JyArIHNldHRpbmdzLm5hdkVsZW1lbnQgKyAnPicpXHJcblx0XHRcdC5hZGRDbGFzcyhzZXR0aW5ncy5uYXZDbGFzc1sxXSlcclxuXHRcdFx0Lmh0bWwoc2V0dGluZ3MubmF2VGV4dFsxXSlcclxuXHRcdFx0LmFwcGVuZFRvKHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZSlcclxuXHRcdFx0Lm9uKCdjbGljaycsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdHRoaXMubmV4dChzZXR0aW5ncy5uYXZTcGVlZCk7XHJcblx0XHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHQvLyBjcmVhdGUgRE9NIHN0cnVjdHVyZSBmb3IgYWJzb2x1dGUgbmF2aWdhdGlvblxyXG5cdFx0aWYgKCFzZXR0aW5ncy5kb3RzRGF0YSkge1xyXG5cdFx0XHR0aGlzLl90ZW1wbGF0ZXMgPSBbICQoJzxkaXY+JylcclxuXHRcdFx0XHQuYWRkQ2xhc3Moc2V0dGluZ3MuZG90Q2xhc3MpXHJcblx0XHRcdFx0LmFwcGVuZCgkKCc8c3Bhbj4nKSlcclxuXHRcdFx0XHQucHJvcCgnb3V0ZXJIVE1MJykgXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUgPSAoc2V0dGluZ3MuZG90c0NvbnRhaW5lciA/ICQoc2V0dGluZ3MuZG90c0NvbnRhaW5lcilcclxuXHRcdFx0OiAkKCc8ZGl2PicpLmFkZENsYXNzKHNldHRpbmdzLmRvdHNDbGFzcykuYXBwZW5kVG8odGhpcy4kZWxlbWVudCkpLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5vbignY2xpY2snLCAnZGl2JywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdHZhciBpbmRleCA9ICQoZS50YXJnZXQpLnBhcmVudCgpLmlzKHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZSlcclxuXHRcdFx0XHQ/ICQoZS50YXJnZXQpLmluZGV4KCkgOiAkKGUudGFyZ2V0KS5wYXJlbnQoKS5pbmRleCgpO1xyXG5cclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0dGhpcy50byhpbmRleCwgc2V0dGluZ3MuZG90c1NwZWVkKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHQvLyBvdmVycmlkZSBwdWJsaWMgbWV0aG9kcyBvZiB0aGUgY2Fyb3VzZWxcclxuXHRcdGZvciAob3ZlcnJpZGUgaW4gdGhpcy5fb3ZlcnJpZGVzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gJC5wcm94eSh0aGlzW292ZXJyaWRlXSwgdGhpcyk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0TmF2aWdhdGlvbi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGhhbmRsZXIsIGNvbnRyb2wsIHByb3BlcnR5LCBvdmVycmlkZTtcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChjb250cm9sIGluIHRoaXMuX2NvbnRyb2xzKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRyb2xzW2NvbnRyb2xdLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChvdmVycmlkZSBpbiB0aGlzLm92ZXJpZGVzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gdGhpcy5fb3ZlcnJpZGVzW292ZXJyaWRlXTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlcyB0aGUgaW50ZXJuYWwgc3RhdGUuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGksIGosIGssXHJcblx0XHRcdGxvd2VyID0gdGhpcy5fY29yZS5jbG9uZXMoKS5sZW5ndGggLyAyLFxyXG5cdFx0XHR1cHBlciA9IGxvd2VyICsgdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aCxcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2NvcmUubWF4aW11bSh0cnVlKSxcclxuXHRcdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRzaXplID0gc2V0dGluZ3MuY2VudGVyIHx8IHNldHRpbmdzLmF1dG9XaWR0aCB8fCBzZXR0aW5ncy5kb3RzRGF0YVxyXG5cdFx0XHRcdD8gMSA6IHNldHRpbmdzLmRvdHNFYWNoIHx8IHNldHRpbmdzLml0ZW1zO1xyXG5cclxuXHRcdGlmIChzZXR0aW5ncy5zbGlkZUJ5ICE9PSAncGFnZScpIHtcclxuXHRcdFx0c2V0dGluZ3Muc2xpZGVCeSA9IE1hdGgubWluKHNldHRpbmdzLnNsaWRlQnksIHNldHRpbmdzLml0ZW1zKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoc2V0dGluZ3MuZG90cyB8fCBzZXR0aW5ncy5zbGlkZUJ5ID09ICdwYWdlJykge1xyXG5cdFx0XHR0aGlzLl9wYWdlcyA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChpID0gbG93ZXIsIGogPSAwLCBrID0gMDsgaSA8IHVwcGVyOyBpKyspIHtcclxuXHRcdFx0XHRpZiAoaiA+PSBzaXplIHx8IGogPT09IDApIHtcclxuXHRcdFx0XHRcdHRoaXMuX3BhZ2VzLnB1c2goe1xyXG5cdFx0XHRcdFx0XHRzdGFydDogTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSxcclxuXHRcdFx0XHRcdFx0ZW5kOiBpIC0gbG93ZXIgKyBzaXplIC0gMVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRpZiAoTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSA9PT0gbWF4aW11bSkge1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGogPSAwLCArK2s7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGogKz0gdGhpcy5fY29yZS5tZXJnZXJzKHRoaXMuX2NvcmUucmVsYXRpdmUoaSkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRHJhd3MgdGhlIHVzZXIgaW50ZXJmYWNlLlxyXG5cdCAqIEB0b2RvIFRoZSBvcHRpb24gYGRvdHNEYXRhYCB3b250IHdvcmsuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBkaWZmZXJlbmNlLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXHJcblx0XHRcdGRpc2FibGVkID0gdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aCA8PSBzZXR0aW5ncy5pdGVtcyxcclxuXHRcdFx0aW5kZXggPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKSxcclxuXHRcdFx0bG9vcCA9IHNldHRpbmdzLmxvb3AgfHwgc2V0dGluZ3MucmV3aW5kO1xyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZS50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhc2V0dGluZ3MubmF2IHx8IGRpc2FibGVkKTtcclxuXHJcblx0XHRpZiAoc2V0dGluZ3MubmF2KSB7XHJcblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRwcmV2aW91cy50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhbG9vcCAmJiBpbmRleCA8PSB0aGlzLl9jb3JlLm1pbmltdW0odHJ1ZSkpO1xyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kbmV4dC50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhbG9vcCAmJiBpbmRleCA+PSB0aGlzLl9jb3JlLm1heGltdW0odHJ1ZSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhc2V0dGluZ3MuZG90cyB8fCBkaXNhYmxlZCk7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmRvdHMpIHtcclxuXHRcdFx0ZGlmZmVyZW5jZSA9IHRoaXMuX3BhZ2VzLmxlbmd0aCAtIHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5jaGlsZHJlbigpLmxlbmd0aDtcclxuXHJcblx0XHRcdGlmIChzZXR0aW5ncy5kb3RzRGF0YSAmJiBkaWZmZXJlbmNlICE9PSAwKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmh0bWwodGhpcy5fdGVtcGxhdGVzLmpvaW4oJycpKTtcclxuXHRcdFx0fSBlbHNlIGlmIChkaWZmZXJlbmNlID4gMCkge1xyXG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5hcHBlbmQobmV3IEFycmF5KGRpZmZlcmVuY2UgKyAxKS5qb2luKHRoaXMuX3RlbXBsYXRlc1swXSkpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGRpZmZlcmVuY2UgPCAwKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkuc2xpY2UoZGlmZmVyZW5jZSkucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5maW5kKCcuYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuY2hpbGRyZW4oKS5lcSgkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKSkuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEV4dGVuZHMgZXZlbnQgZGF0YS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgb2JqZWN0IHdoaWNoIGdldHMgdGhyb3duLlxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLm9uVHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzO1xyXG5cclxuXHRcdGV2ZW50LnBhZ2UgPSB7XHJcblx0XHRcdGluZGV4OiAkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKSxcclxuXHRcdFx0Y291bnQ6IHRoaXMuX3BhZ2VzLmxlbmd0aCxcclxuXHRcdFx0c2l6ZTogc2V0dGluZ3MgJiYgKHNldHRpbmdzLmNlbnRlciB8fCBzZXR0aW5ncy5hdXRvV2lkdGggfHwgc2V0dGluZ3MuZG90c0RhdGFcclxuXHRcdFx0XHQ/IDEgOiBzZXR0aW5ncy5kb3RzRWFjaCB8fCBzZXR0aW5ncy5pdGVtcylcclxuXHRcdH07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgY3VycmVudCBwYWdlIHBvc2l0aW9uIG9mIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgY3VycmVudCA9IHRoaXMuX2NvcmUucmVsYXRpdmUodGhpcy5fY29yZS5jdXJyZW50KCkpO1xyXG5cdFx0cmV0dXJuICQuZ3JlcCh0aGlzLl9wYWdlcywgJC5wcm94eShmdW5jdGlvbihwYWdlLCBpbmRleCkge1xyXG5cdFx0XHRyZXR1cm4gcGFnZS5zdGFydCA8PSBjdXJyZW50ICYmIHBhZ2UuZW5kID49IGN1cnJlbnQ7XHJcblx0XHR9LCB0aGlzKSkucG9wKCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgY3VycmVudCBzdWNjZXNvci9wcmVkZWNlc3NvciBwb3NpdGlvbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHN1Y2Nlc3Nvcikge1xyXG5cdFx0dmFyIHBvc2l0aW9uLCBsZW5ndGgsXHJcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncztcclxuXHJcblx0XHRpZiAoc2V0dGluZ3Muc2xpZGVCeSA9PSAncGFnZScpIHtcclxuXHRcdFx0cG9zaXRpb24gPSAkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKTtcclxuXHRcdFx0bGVuZ3RoID0gdGhpcy5fcGFnZXMubGVuZ3RoO1xyXG5cdFx0XHRzdWNjZXNzb3IgPyArK3Bvc2l0aW9uIDogLS1wb3NpdGlvbjtcclxuXHRcdFx0cG9zaXRpb24gPSB0aGlzLl9wYWdlc1soKHBvc2l0aW9uICUgbGVuZ3RoKSArIGxlbmd0aCkgJSBsZW5ndGhdLnN0YXJ0O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cG9zaXRpb24gPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKTtcclxuXHRcdFx0bGVuZ3RoID0gdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aDtcclxuXHRcdFx0c3VjY2Vzc29yID8gcG9zaXRpb24gKz0gc2V0dGluZ3Muc2xpZGVCeSA6IHBvc2l0aW9uIC09IHNldHRpbmdzLnNsaWRlQnk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgbmV4dCBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWQ9ZmFsc2VdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLmdldFBvc2l0aW9uKHRydWUpLCBzcGVlZCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2xpZGVzIHRvIHRoZSBwcmV2aW91cyBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWQ9ZmFsc2VdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLmdldFBvc2l0aW9uKGZhbHNlKSwgc3BlZWQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgc3BlY2lmaWVkIGl0ZW0gb3IgcGFnZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3N0YW5kYXJkPWZhbHNlXSAtIFdoZXRoZXIgdG8gdXNlIHRoZSBzdGFuZGFyZCBiZWhhdmlvdXIgb3Igbm90LlxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLnRvID0gZnVuY3Rpb24ocG9zaXRpb24sIHNwZWVkLCBzdGFuZGFyZCkge1xyXG5cdFx0dmFyIGxlbmd0aDtcclxuXHJcblx0XHRpZiAoIXN0YW5kYXJkICYmIHRoaXMuX3BhZ2VzLmxlbmd0aCkge1xyXG5cdFx0XHRsZW5ndGggPSB0aGlzLl9wYWdlcy5sZW5ndGg7XHJcblx0XHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLl9wYWdlc1soKHBvc2l0aW9uICUgbGVuZ3RoKSArIGxlbmd0aCkgJSBsZW5ndGhdLnN0YXJ0LCBzcGVlZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkLnByb3h5KHRoaXMuX292ZXJyaWRlcy50bywgdGhpcy5fY29yZSkocG9zaXRpb24sIHNwZWVkKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuTmF2aWdhdGlvbiA9IE5hdmlnYXRpb247XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogSGFzaCBQbHVnaW5cclxuICogQHZlcnNpb24gMi4xLjBcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBoYXNoIHBsdWdpbi5cclxuXHQgKiBAY2xhc3MgVGhlIEhhc2ggUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBIYXNoID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSGFzaCBpbmRleCBmb3IgdGhlIGl0ZW1zLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFzaGVzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUaGUgY2Fyb3VzZWwgZWxlbWVudC5cclxuXHRcdCAqIEB0eXBlIHtqUXVlcnl9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuJGVsZW1lbnQgPSB0aGlzLl9jb3JlLiRlbGVtZW50O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5zdGFydFBvc2l0aW9uID09PSAnVVJMSGFzaCcpIHtcclxuXHRcdFx0XHRcdCQod2luZG93KS50cmlnZ2VyKCdoYXNoY2hhbmdlLm93bC5uYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3ByZXBhcmVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dmFyIGhhc2ggPSAkKGUuY29udGVudCkuZmluZCgnW2RhdGEtaGFzaF0nKS5hZGRCYWNrKCdbZGF0YS1oYXNoXScpLmF0dHIoJ2RhdGEtaGFzaCcpO1xyXG5cclxuXHRcdFx0XHRcdGlmICghaGFzaCkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5faGFzaGVzW2hhc2hdID0gZS5jb250ZW50O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicpIHtcclxuXHRcdFx0XHRcdHZhciBjdXJyZW50ID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKSksXHJcblx0XHRcdFx0XHRcdGhhc2ggPSAkLm1hcCh0aGlzLl9oYXNoZXMsIGZ1bmN0aW9uKGl0ZW0sIGhhc2gpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gaXRlbSA9PT0gY3VycmVudCA/IGhhc2ggOiBudWxsO1xyXG5cdFx0XHRcdFx0XHR9KS5qb2luKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFoYXNoIHx8IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpID09PSBoYXNoKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaGFzaCA9IGhhc2g7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKVxyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgSGFzaC5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciB0aGUgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGxpc3RlbmVyIGZvciBoYXNoIG5hdmlnYXRpb25cclxuXHRcdCQod2luZG93KS5vbignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR2YXIgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnN1YnN0cmluZygxKSxcclxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCksXHJcblx0XHRcdFx0cG9zaXRpb24gPSB0aGlzLl9oYXNoZXNbaGFzaF0gJiYgaXRlbXMuaW5kZXgodGhpcy5faGFzaGVzW2hhc2hdKTtcclxuXHJcblx0XHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkIHx8IHBvc2l0aW9uID09PSB0aGlzLl9jb3JlLmN1cnJlbnQoKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY29yZS50byh0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSwgZmFsc2UsIHRydWUpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0SGFzaC5EZWZhdWx0cyA9IHtcclxuXHRcdFVSTGhhc2hMaXN0ZW5lcjogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRIYXNoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0JCh3aW5kb3cpLm9mZignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5IYXNoID0gSGFzaDtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBTdXBwb3J0IFBsdWdpblxyXG4gKlxyXG4gKiBAdmVyc2lvbiAyLjEuMFxyXG4gKiBAYXV0aG9yIFZpdmlkIFBsYW5ldCBTb2Z0d2FyZSBHbWJIXHJcbiAqIEBhdXRob3IgQXJ0dXMgS29sYW5vd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHR2YXIgc3R5bGUgPSAkKCc8c3VwcG9ydD4nKS5nZXQoMCkuc3R5bGUsXHJcblx0XHRwcmVmaXhlcyA9ICdXZWJraXQgTW96IE8gbXMnLnNwbGl0KCcgJyksXHJcblx0XHRldmVudHMgPSB7XHJcblx0XHRcdHRyYW5zaXRpb246IHtcclxuXHRcdFx0XHRlbmQ6IHtcclxuXHRcdFx0XHRcdFdlYmtpdFRyYW5zaXRpb246ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyxcclxuXHRcdFx0XHRcdE1velRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcclxuXHRcdFx0XHRcdE9UcmFuc2l0aW9uOiAnb1RyYW5zaXRpb25FbmQnLFxyXG5cdFx0XHRcdFx0dHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHRhbmltYXRpb246IHtcclxuXHRcdFx0XHRlbmQ6IHtcclxuXHRcdFx0XHRcdFdlYmtpdEFuaW1hdGlvbjogJ3dlYmtpdEFuaW1hdGlvbkVuZCcsXHJcblx0XHRcdFx0XHRNb3pBbmltYXRpb246ICdhbmltYXRpb25lbmQnLFxyXG5cdFx0XHRcdFx0T0FuaW1hdGlvbjogJ29BbmltYXRpb25FbmQnLFxyXG5cdFx0XHRcdFx0YW5pbWF0aW9uOiAnYW5pbWF0aW9uZW5kJ1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHRcdHRlc3RzID0ge1xyXG5cdFx0XHRjc3N0cmFuc2Zvcm1zOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCd0cmFuc2Zvcm0nKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Y3NzdHJhbnNmb3JtczNkOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdwZXJzcGVjdGl2ZScpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRjc3N0cmFuc2l0aW9uczogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgndHJhbnNpdGlvbicpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRjc3NhbmltYXRpb25zOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdhbmltYXRpb24nKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0ZnVuY3Rpb24gdGVzdChwcm9wZXJ0eSwgcHJlZml4ZWQpIHtcclxuXHRcdHZhciByZXN1bHQgPSBmYWxzZSxcclxuXHRcdFx0dXBwZXIgPSBwcm9wZXJ0eS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHByb3BlcnR5LnNsaWNlKDEpO1xyXG5cclxuXHRcdCQuZWFjaCgocHJvcGVydHkgKyAnICcgKyBwcmVmaXhlcy5qb2luKHVwcGVyICsgJyAnKSArIHVwcGVyKS5zcGxpdCgnICcpLCBmdW5jdGlvbihpLCBwcm9wZXJ0eSkge1xyXG5cdFx0XHRpZiAoc3R5bGVbcHJvcGVydHldICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRyZXN1bHQgPSBwcmVmaXhlZCA/IHByb3BlcnR5IDogdHJ1ZTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiByZXN1bHQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwcmVmaXhlZChwcm9wZXJ0eSkge1xyXG5cdFx0cmV0dXJuIHRlc3QocHJvcGVydHksIHRydWUpO1xyXG5cdH1cclxuXHJcblx0aWYgKHRlc3RzLmNzc3RyYW5zaXRpb25zKCkpIHtcclxuXHRcdC8qIGpzaGludCAtVzA1MyAqL1xyXG5cdFx0JC5zdXBwb3J0LnRyYW5zaXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCd0cmFuc2l0aW9uJykpXHJcblx0XHQkLnN1cHBvcnQudHJhbnNpdGlvbi5lbmQgPSBldmVudHMudHJhbnNpdGlvbi5lbmRbICQuc3VwcG9ydC50cmFuc2l0aW9uIF07XHJcblx0fVxyXG5cclxuXHRpZiAodGVzdHMuY3NzYW5pbWF0aW9ucygpKSB7XHJcblx0XHQvKiBqc2hpbnQgLVcwNTMgKi9cclxuXHRcdCQuc3VwcG9ydC5hbmltYXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCdhbmltYXRpb24nKSlcclxuXHRcdCQuc3VwcG9ydC5hbmltYXRpb24uZW5kID0gZXZlbnRzLmFuaW1hdGlvbi5lbmRbICQuc3VwcG9ydC5hbmltYXRpb24gXTtcclxuXHR9XHJcblxyXG5cdGlmICh0ZXN0cy5jc3N0cmFuc2Zvcm1zKCkpIHtcclxuXHRcdC8qIGpzaGludCAtVzA1MyAqL1xyXG5cdFx0JC5zdXBwb3J0LnRyYW5zZm9ybSA9IG5ldyBTdHJpbmcocHJlZml4ZWQoJ3RyYW5zZm9ybScpKTtcclxuXHRcdCQuc3VwcG9ydC50cmFuc2Zvcm0zZCA9IHRlc3RzLmNzc3RyYW5zZm9ybXMzZCgpO1xyXG5cdH1cclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuLyohXHJcbiAqIEZvdG9yYW1hIDQuNi40IHwgaHR0cDovL2ZvdG9yYW1hLmlvL2xpY2Vuc2UvXHJcbiAqL1xyXG5mb3RvcmFtYVZlcnNpb249XCI0LjYuNFwiLGZ1bmN0aW9uKGEsYixjLGQsZSl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gZihhKXt2YXIgYj1cImJlel9cIitkLm1ha2VBcnJheShhcmd1bWVudHMpLmpvaW4oXCJfXCIpLnJlcGxhY2UoXCIuXCIsXCJwXCIpO2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGQuZWFzaW5nW2JdKXt2YXIgYz1mdW5jdGlvbihhLGIpe3ZhciBjPVtudWxsLG51bGxdLGQ9W251bGwsbnVsbF0sZT1bbnVsbCxudWxsXSxmPWZ1bmN0aW9uKGYsZyl7cmV0dXJuIGVbZ109MyphW2ddLGRbZ109MyooYltnXS1hW2ddKS1lW2ddLGNbZ109MS1lW2ddLWRbZ10sZiooZVtnXStmKihkW2ddK2YqY1tnXSkpfSxnPWZ1bmN0aW9uKGEpe3JldHVybiBlWzBdK2EqKDIqZFswXSszKmNbMF0qYSl9LGg9ZnVuY3Rpb24oYSl7Zm9yKHZhciBiLGM9YSxkPTA7KytkPDE0JiYoYj1mKGMsMCktYSwhKE1hdGguYWJzKGIpPC4wMDEpKTspYy09Yi9nKGMpO3JldHVybiBjfTtyZXR1cm4gZnVuY3Rpb24oYSl7cmV0dXJuIGYoaChhKSwxKX19O2QuZWFzaW5nW2JdPWZ1bmN0aW9uKGIsZCxlLGYsZyl7cmV0dXJuIGYqYyhbYVswXSxhWzFdXSxbYVsyXSxhWzNdXSkoZC9nKStlfX1yZXR1cm4gYn1mdW5jdGlvbiBnKCl7fWZ1bmN0aW9uIGgoYSxiLGMpe3JldHVybiBNYXRoLm1heChpc05hTihiKT8tMS8wOmIsTWF0aC5taW4oaXNOYU4oYyk/MS8wOmMsYSkpfWZ1bmN0aW9uIGkoYSl7cmV0dXJuIGEubWF0Y2goL21hLykmJmEubWF0Y2goLy0/XFxkKyg/IWQpL2cpW2EubWF0Y2goLzNkLyk/MTI6NF19ZnVuY3Rpb24gaihhKXtyZXR1cm4gSWM/K2koYS5jc3MoXCJ0cmFuc2Zvcm1cIikpOithLmNzcyhcImxlZnRcIikucmVwbGFjZShcInB4XCIsXCJcIil9ZnVuY3Rpb24gayhhKXt2YXIgYj17fTtyZXR1cm4gSWM/Yi50cmFuc2Zvcm09XCJ0cmFuc2xhdGUzZChcIithK1wicHgsMCwwKVwiOmIubGVmdD1hLGJ9ZnVuY3Rpb24gbChhKXtyZXR1cm57XCJ0cmFuc2l0aW9uLWR1cmF0aW9uXCI6YStcIm1zXCJ9fWZ1bmN0aW9uIG0oYSxiKXtyZXR1cm4gaXNOYU4oYSk/YjphfWZ1bmN0aW9uIG4oYSxiKXtyZXR1cm4gbSgrU3RyaW5nKGEpLnJlcGxhY2UoYnx8XCJweFwiLFwiXCIpKX1mdW5jdGlvbiBvKGEpe3JldHVybi8lJC8udGVzdChhKT9uKGEsXCIlXCIpOmV9ZnVuY3Rpb24gcChhLGIpe3JldHVybiBtKG8oYSkvMTAwKmIsbihhKSl9ZnVuY3Rpb24gcShhKXtyZXR1cm4oIWlzTmFOKG4oYSkpfHwhaXNOYU4obihhLFwiJVwiKSkpJiZhfWZ1bmN0aW9uIHIoYSxiLGMsZCl7cmV0dXJuKGEtKGR8fDApKSooYisoY3x8MCkpfWZ1bmN0aW9uIHMoYSxiLGMsZCl7cmV0dXJuLU1hdGgucm91bmQoYS8oYisoY3x8MCkpLShkfHwwKSl9ZnVuY3Rpb24gdChhKXt2YXIgYj1hLmRhdGEoKTtpZighYi50RW5kKXt2YXIgYz1hWzBdLGQ9e1dlYmtpdFRyYW5zaXRpb246XCJ3ZWJraXRUcmFuc2l0aW9uRW5kXCIsTW96VHJhbnNpdGlvbjpcInRyYW5zaXRpb25lbmRcIixPVHJhbnNpdGlvbjpcIm9UcmFuc2l0aW9uRW5kIG90cmFuc2l0aW9uZW5kXCIsbXNUcmFuc2l0aW9uOlwiTVNUcmFuc2l0aW9uRW5kXCIsdHJhbnNpdGlvbjpcInRyYW5zaXRpb25lbmRcIn07VChjLGRbdWMucHJlZml4ZWQoXCJ0cmFuc2l0aW9uXCIpXSxmdW5jdGlvbihhKXtiLnRQcm9wJiZhLnByb3BlcnR5TmFtZS5tYXRjaChiLnRQcm9wKSYmYi5vbkVuZEZuKCl9KSxiLnRFbmQ9ITB9fWZ1bmN0aW9uIHUoYSxiLGMsZCl7dmFyIGUsZj1hLmRhdGEoKTtmJiYoZi5vbkVuZEZuPWZ1bmN0aW9uKCl7ZXx8KGU9ITAsY2xlYXJUaW1lb3V0KGYudFQpLGMoKSl9LGYudFByb3A9YixjbGVhclRpbWVvdXQoZi50VCksZi50VD1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7Zi5vbkVuZEZuKCl9LDEuNSpkKSx0KGEpKX1mdW5jdGlvbiB2KGEsYil7aWYoYS5sZW5ndGgpe3ZhciBjPWEuZGF0YSgpO0ljPyhhLmNzcyhsKDApKSxjLm9uRW5kRm49ZyxjbGVhclRpbWVvdXQoYy50VCkpOmEuc3RvcCgpO3ZhciBkPXcoYixmdW5jdGlvbigpe3JldHVybiBqKGEpfSk7cmV0dXJuIGEuY3NzKGsoZCkpLGR9fWZ1bmN0aW9uIHcoKXtmb3IodmFyIGEsYj0wLGM9YXJndW1lbnRzLmxlbmd0aDtjPmImJihhPWI/YXJndW1lbnRzW2JdKCk6YXJndW1lbnRzW2JdLFwibnVtYmVyXCIhPXR5cGVvZiBhKTtiKyspO3JldHVybiBhfWZ1bmN0aW9uIHgoYSxiKXtyZXR1cm4gTWF0aC5yb3VuZChhKyhiLWEpLzEuNSl9ZnVuY3Rpb24geSgpe3JldHVybiB5LnA9eS5wfHwoXCJodHRwczpcIj09PWMucHJvdG9jb2w/XCJodHRwczovL1wiOlwiaHR0cDovL1wiKSx5LnB9ZnVuY3Rpb24geihhKXt2YXIgYz1iLmNyZWF0ZUVsZW1lbnQoXCJhXCIpO3JldHVybiBjLmhyZWY9YSxjfWZ1bmN0aW9uIEEoYSxiKXtpZihcInN0cmluZ1wiIT10eXBlb2YgYSlyZXR1cm4gYTthPXooYSk7dmFyIGMsZDtpZihhLmhvc3QubWF0Y2goL3lvdXR1YmVcXC5jb20vKSYmYS5zZWFyY2gpe2lmKGM9YS5zZWFyY2guc3BsaXQoXCJ2PVwiKVsxXSl7dmFyIGU9Yy5pbmRleE9mKFwiJlwiKTstMSE9PWUmJihjPWMuc3Vic3RyaW5nKDAsZSkpLGQ9XCJ5b3V0dWJlXCJ9fWVsc2UgYS5ob3N0Lm1hdGNoKC95b3V0dWJlXFwuY29tfHlvdXR1XFwuYmUvKT8oYz1hLnBhdGhuYW1lLnJlcGxhY2UoL15cXC8oZW1iZWRcXC98dlxcLyk/LyxcIlwiKS5yZXBsYWNlKC9cXC8uKi8sXCJcIiksZD1cInlvdXR1YmVcIik6YS5ob3N0Lm1hdGNoKC92aW1lb1xcLmNvbS8pJiYoZD1cInZpbWVvXCIsYz1hLnBhdGhuYW1lLnJlcGxhY2UoL15cXC8odmlkZW9cXC8pPy8sXCJcIikucmVwbGFjZSgvXFwvLiovLFwiXCIpKTtyZXR1cm4gYyYmZHx8IWJ8fChjPWEuaHJlZixkPVwiY3VzdG9tXCIpLGM/e2lkOmMsdHlwZTpkLHM6YS5zZWFyY2gucmVwbGFjZSgvXlxcPy8sXCJcIikscDp5KCl9OiExfWZ1bmN0aW9uIEIoYSxiLGMpe3ZhciBlLGYsZz1hLnZpZGVvO3JldHVyblwieW91dHViZVwiPT09Zy50eXBlPyhmPXkoKStcImltZy55b3V0dWJlLmNvbS92aS9cIitnLmlkK1wiL2RlZmF1bHQuanBnXCIsZT1mLnJlcGxhY2UoL1xcL2RlZmF1bHQuanBnJC8sXCIvaHFkZWZhdWx0LmpwZ1wiKSxhLnRodW1ic1JlYWR5PSEwKTpcInZpbWVvXCI9PT1nLnR5cGU/ZC5hamF4KHt1cmw6eSgpK1widmltZW8uY29tL2FwaS92Mi92aWRlby9cIitnLmlkK1wiLmpzb25cIixkYXRhVHlwZTpcImpzb25wXCIsc3VjY2VzczpmdW5jdGlvbihkKXthLnRodW1ic1JlYWR5PSEwLEMoYix7aW1nOmRbMF0udGh1bWJuYWlsX2xhcmdlLHRodW1iOmRbMF0udGh1bWJuYWlsX3NtYWxsfSxhLmksYyl9fSk6YS50aHVtYnNSZWFkeT0hMCx7aW1nOmUsdGh1bWI6Zn19ZnVuY3Rpb24gQyhhLGIsYyxlKXtmb3IodmFyIGY9MCxnPWEubGVuZ3RoO2c+ZjtmKyspe3ZhciBoPWFbZl07aWYoaC5pPT09YyYmaC50aHVtYnNSZWFkeSl7dmFyIGk9e3ZpZGVvUmVhZHk6ITB9O2lbWGNdPWlbWmNdPWlbWWNdPSExLGUuc3BsaWNlKGYsMSxkLmV4dGVuZCh7fSxoLGksYikpO2JyZWFrfX19ZnVuY3Rpb24gRChhKXtmdW5jdGlvbiBiKGEsYixlKXt2YXIgZj1hLmNoaWxkcmVuKFwiaW1nXCIpLmVxKDApLGc9YS5hdHRyKFwiaHJlZlwiKSxoPWEuYXR0cihcInNyY1wiKSxpPWYuYXR0cihcInNyY1wiKSxqPWIudmlkZW8saz1lP0EoZyxqPT09ITApOiExO2s/Zz0hMTprPWosYyhhLGYsZC5leHRlbmQoYix7dmlkZW86ayxpbWc6Yi5pbWd8fGd8fGh8fGksdGh1bWI6Yi50aHVtYnx8aXx8aHx8Z30pKX1mdW5jdGlvbiBjKGEsYixjKXt2YXIgZT1jLnRodW1iJiZjLmltZyE9PWMudGh1bWIsZj1uKGMud2lkdGh8fGEuYXR0cihcIndpZHRoXCIpKSxnPW4oYy5oZWlnaHR8fGEuYXR0cihcImhlaWdodFwiKSk7ZC5leHRlbmQoYyx7d2lkdGg6ZixoZWlnaHQ6Zyx0aHVtYnJhdGlvOlMoYy50aHVtYnJhdGlvfHxuKGMudGh1bWJ3aWR0aHx8YiYmYi5hdHRyKFwid2lkdGhcIil8fGV8fGYpL24oYy50aHVtYmhlaWdodHx8YiYmYi5hdHRyKFwiaGVpZ2h0XCIpfHxlfHxnKSl9KX12YXIgZT1bXTtyZXR1cm4gYS5jaGlsZHJlbigpLmVhY2goZnVuY3Rpb24oKXt2YXIgYT1kKHRoaXMpLGY9UihkLmV4dGVuZChhLmRhdGEoKSx7aWQ6YS5hdHRyKFwiaWRcIil9KSk7aWYoYS5pcyhcImEsIGltZ1wiKSliKGEsZiwhMCk7ZWxzZXtpZihhLmlzKFwiOmVtcHR5XCIpKXJldHVybjtjKGEsbnVsbCxkLmV4dGVuZChmLHtodG1sOnRoaXMsX2h0bWw6YS5odG1sKCl9KSl9ZS5wdXNoKGYpfSksZX1mdW5jdGlvbiBFKGEpe3JldHVybiAwPT09YS5vZmZzZXRXaWR0aCYmMD09PWEub2Zmc2V0SGVpZ2h0fWZ1bmN0aW9uIEYoYSl7cmV0dXJuIWQuY29udGFpbnMoYi5kb2N1bWVudEVsZW1lbnQsYSl9ZnVuY3Rpb24gRyhhLGIsYyxkKXtyZXR1cm4gRy5pfHwoRy5pPTEsRy5paT1bITBdKSxkPWR8fEcuaSxcInVuZGVmaW5lZFwiPT10eXBlb2YgRy5paVtkXSYmKEcuaWlbZF09ITApLGEoKT9iKCk6Ry5paVtkXSYmc2V0VGltZW91dChmdW5jdGlvbigpe0cuaWlbZF0mJkcoYSxiLGMsZCl9LGN8fDEwMCksRy5pKyt9ZnVuY3Rpb24gSChhKXtjLnJlcGxhY2UoYy5wcm90b2NvbCtcIi8vXCIrYy5ob3N0K2MucGF0aG5hbWUucmVwbGFjZSgvXlxcLz8vLFwiL1wiKStjLnNlYXJjaCtcIiNcIithKX1mdW5jdGlvbiBJKGEsYixjLGQpe3ZhciBlPWEuZGF0YSgpLGY9ZS5tZWFzdXJlcztpZihmJiYoIWUubHx8ZS5sLlchPT1mLndpZHRofHxlLmwuSCE9PWYuaGVpZ2h0fHxlLmwuciE9PWYucmF0aW98fGUubC53IT09Yi53fHxlLmwuaCE9PWIuaHx8ZS5sLm0hPT1jfHxlLmwucCE9PWQpKXt2YXIgZz1mLndpZHRoLGk9Zi5oZWlnaHQsaj1iLncvYi5oLGs9Zi5yYXRpbz49aixsPVwic2NhbGVkb3duXCI9PT1jLG09XCJjb250YWluXCI9PT1jLG49XCJjb3ZlclwiPT09YyxvPSQoZCk7ayYmKGx8fG0pfHwhayYmbj8oZz1oKGIudywwLGw/ZzoxLzApLGk9Zy9mLnJhdGlvKTooayYmbnx8IWsmJihsfHxtKSkmJihpPWgoYi5oLDAsbD9pOjEvMCksZz1pKmYucmF0aW8pLGEuY3NzKHt3aWR0aDpnLGhlaWdodDppLGxlZnQ6cChvLngsYi53LWcpLHRvcDpwKG8ueSxiLmgtaSl9KSxlLmw9e1c6Zi53aWR0aCxIOmYuaGVpZ2h0LHI6Zi5yYXRpbyx3OmIudyxoOmIuaCxtOmMscDpkfX1yZXR1cm4hMH1mdW5jdGlvbiBKKGEsYil7dmFyIGM9YVswXTtjLnN0eWxlU2hlZXQ/Yy5zdHlsZVNoZWV0LmNzc1RleHQ9YjphLmh0bWwoYil9ZnVuY3Rpb24gSyhhLGIsYyl7cmV0dXJuIGI9PT1jPyExOmI+PWE/XCJsZWZ0XCI6YT49Yz9cInJpZ2h0XCI6XCJsZWZ0IHJpZ2h0XCJ9ZnVuY3Rpb24gTChhLGIsYyxkKXtpZighYylyZXR1cm4hMTtpZighaXNOYU4oYSkpcmV0dXJuIGEtKGQ/MDoxKTtmb3IodmFyIGUsZj0wLGc9Yi5sZW5ndGg7Zz5mO2YrKyl7dmFyIGg9YltmXTtpZihoLmlkPT09YSl7ZT1mO2JyZWFrfX1yZXR1cm4gZX1mdW5jdGlvbiBNKGEsYixjKXtjPWN8fHt9LGEuZWFjaChmdW5jdGlvbigpe3ZhciBhLGU9ZCh0aGlzKSxmPWUuZGF0YSgpO2YuY2xpY2tPbnx8KGYuY2xpY2tPbj0hMCxkLmV4dGVuZChjYihlLHtvblN0YXJ0OmZ1bmN0aW9uKGIpe2E9YiwoYy5vblN0YXJ0fHxnKS5jYWxsKHRoaXMsYil9LG9uTW92ZTpjLm9uTW92ZXx8ZyxvblRvdWNoRW5kOmMub25Ub3VjaEVuZHx8ZyxvbkVuZDpmdW5jdGlvbihjKXtjLm1vdmVkfHxiLmNhbGwodGhpcyxhKX19KSx7bm9Nb3ZlOiEwfSkpfSl9ZnVuY3Rpb24gTihhLGIpe3JldHVybic8ZGl2IGNsYXNzPVwiJythKydcIj4nKyhifHxcIlwiKStcIjwvZGl2PlwifWZ1bmN0aW9uIE8oYSl7Zm9yKHZhciBiPWEubGVuZ3RoO2I7KXt2YXIgYz1NYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqYi0tKSxkPWFbYl07YVtiXT1hW2NdLGFbY109ZH1yZXR1cm4gYX1mdW5jdGlvbiBQKGEpe3JldHVyblwiW29iamVjdCBBcnJheV1cIj09T2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpJiZkLm1hcChhLGZ1bmN0aW9uKGEpe3JldHVybiBkLmV4dGVuZCh7fSxhKX0pfWZ1bmN0aW9uIFEoYSxiLGMpe2Euc2Nyb2xsTGVmdChifHwwKS5zY3JvbGxUb3AoY3x8MCl9ZnVuY3Rpb24gUihhKXtpZihhKXt2YXIgYj17fTtyZXR1cm4gZC5lYWNoKGEsZnVuY3Rpb24oYSxjKXtiW2EudG9Mb3dlckNhc2UoKV09Y30pLGJ9fWZ1bmN0aW9uIFMoYSl7aWYoYSl7dmFyIGI9K2E7cmV0dXJuIGlzTmFOKGIpPyhiPWEuc3BsaXQoXCIvXCIpLCtiWzBdLytiWzFdfHxlKTpifX1mdW5jdGlvbiBUKGEsYixjLGQpe2ImJihhLmFkZEV2ZW50TGlzdGVuZXI/YS5hZGRFdmVudExpc3RlbmVyKGIsYywhIWQpOmEuYXR0YWNoRXZlbnQoXCJvblwiK2IsYykpfWZ1bmN0aW9uIFUoYSl7cmV0dXJuISFhLmdldEF0dHJpYnV0ZShcImRpc2FibGVkXCIpfWZ1bmN0aW9uIFYoYSl7cmV0dXJue3RhYmluZGV4Oi0xKmErXCJcIixkaXNhYmxlZDphfX1mdW5jdGlvbiBXKGEsYil7VChhLFwia2V5dXBcIixmdW5jdGlvbihjKXtVKGEpfHwxMz09Yy5rZXlDb2RlJiZiLmNhbGwoYSxjKX0pfWZ1bmN0aW9uIFgoYSxiKXtUKGEsXCJmb2N1c1wiLGEub25mb2N1c2luPWZ1bmN0aW9uKGMpe2IuY2FsbChhLGMpfSwhMCl9ZnVuY3Rpb24gWShhLGIpe2EucHJldmVudERlZmF1bHQ/YS5wcmV2ZW50RGVmYXVsdCgpOmEucmV0dXJuVmFsdWU9ITEsYiYmYS5zdG9wUHJvcGFnYXRpb24mJmEuc3RvcFByb3BhZ2F0aW9uKCl9ZnVuY3Rpb24gWihhKXtyZXR1cm4gYT9cIj5cIjpcIjxcIn1mdW5jdGlvbiAkKGEpe3JldHVybiBhPShhK1wiXCIpLnNwbGl0KC9cXHMrLykse3g6cShhWzBdKXx8YmQseTpxKGFbMV0pfHxiZH19ZnVuY3Rpb24gXyhhLGIpe3ZhciBjPWEuZGF0YSgpLGU9TWF0aC5yb3VuZChiLnBvcyksZj1mdW5jdGlvbigpe2Muc2xpZGluZz0hMSwoYi5vbkVuZHx8ZykoKX07XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGIub3ZlclBvcyYmYi5vdmVyUG9zIT09Yi5wb3MmJihlPWIub3ZlclBvcyxmPWZ1bmN0aW9uKCl7XyhhLGQuZXh0ZW5kKHt9LGIse292ZXJQb3M6Yi5wb3MsdGltZTpNYXRoLm1heChRYyxiLnRpbWUvMil9KSl9KTt2YXIgaD1kLmV4dGVuZChrKGUpLGIud2lkdGgmJnt3aWR0aDpiLndpZHRofSk7Yy5zbGlkaW5nPSEwLEljPyhhLmNzcyhkLmV4dGVuZChsKGIudGltZSksaCkpLGIudGltZT4xMD91KGEsXCJ0cmFuc2Zvcm1cIixmLGIudGltZSk6ZigpKTphLnN0b3AoKS5hbmltYXRlKGgsYi50aW1lLF9jLGYpfWZ1bmN0aW9uIGFiKGEsYixjLGUsZixoKXt2YXIgaT1cInVuZGVmaW5lZFwiIT10eXBlb2YgaDtpZihpfHwoZi5wdXNoKGFyZ3VtZW50cyksQXJyYXkucHJvdG90eXBlLnB1c2guY2FsbChhcmd1bWVudHMsZi5sZW5ndGgpLCEoZi5sZW5ndGg+MSkpKXthPWF8fGQoYSksYj1ifHxkKGIpO3ZhciBqPWFbMF0saz1iWzBdLGw9XCJjcm9zc2ZhZGVcIj09PWUubWV0aG9kLG09ZnVuY3Rpb24oKXtpZighbS5kb25lKXttLmRvbmU9ITA7dmFyIGE9KGl8fGYuc2hpZnQoKSkmJmYuc2hpZnQoKTthJiZhYi5hcHBseSh0aGlzLGEpLChlLm9uRW5kfHxnKSghIWEpfX0sbj1lLnRpbWUvKGh8fDEpO2MucmVtb3ZlQ2xhc3MoUmIrXCIgXCIrUWIpLGEuc3RvcCgpLmFkZENsYXNzKFJiKSxiLnN0b3AoKS5hZGRDbGFzcyhRYiksbCYmayYmYS5mYWRlVG8oMCwwKSxhLmZhZGVUbyhsP246MCwxLGwmJm0pLGIuZmFkZVRvKG4sMCxtKSxqJiZsfHxrfHxtKCl9fWZ1bmN0aW9uIGJiKGEpe3ZhciBiPShhLnRvdWNoZXN8fFtdKVswXXx8YTthLl94PWIucGFnZVgsYS5feT1iLmNsaWVudFksYS5fbm93PWQubm93KCl9ZnVuY3Rpb24gY2IoYSxjKXtmdW5jdGlvbiBlKGEpe3JldHVybiBtPWQoYS50YXJnZXQpLHUuY2hlY2tlZD1wPXE9cz0hMSxrfHx1LmZsb3d8fGEudG91Y2hlcyYmYS50b3VjaGVzLmxlbmd0aD4xfHxhLndoaWNoPjF8fGVkJiZlZC50eXBlIT09YS50eXBlJiZnZHx8KHA9Yy5zZWxlY3QmJm0uaXMoYy5zZWxlY3QsdCkpP3A6KG89XCJ0b3VjaHN0YXJ0XCI9PT1hLnR5cGUscT1tLmlzKFwiYSwgYSAqXCIsdCksbj11LmNvbnRyb2wscj11Lm5vTW92ZXx8dS5ub1N3aXBlfHxuPzE2OnUuc25hcD8wOjQsYmIoYSksbD1lZD1hLGZkPWEudHlwZS5yZXBsYWNlKC9kb3dufHN0YXJ0LyxcIm1vdmVcIikucmVwbGFjZSgvRG93bi8sXCJNb3ZlXCIpLChjLm9uU3RhcnR8fGcpLmNhbGwodCxhLHtjb250cm9sOm4sJHRhcmdldDptfSksaz11LmZsb3c9ITAsdm9pZCgoIW98fHUuZ28pJiZZKGEpKSl9ZnVuY3Rpb24gZihhKXtpZihhLnRvdWNoZXMmJmEudG91Y2hlcy5sZW5ndGg+MXx8TmMmJiFhLmlzUHJpbWFyeXx8ZmQhPT1hLnR5cGV8fCFrKXJldHVybiBrJiZoKCksdm9pZChjLm9uVG91Y2hFbmR8fGcpKCk7YmIoYSk7dmFyIGI9TWF0aC5hYnMoYS5feC1sLl94KSxkPU1hdGguYWJzKGEuX3ktbC5feSksZT1iLWQsZj0odS5nb3x8dS54fHxlPj0wKSYmIXUubm9Td2lwZSxpPTA+ZTtvJiYhdS5jaGVja2VkPyhrPWYpJiZZKGEpOihZKGEpLChjLm9uTW92ZXx8ZykuY2FsbCh0LGEse3RvdWNoOm99KSksIXMmJk1hdGguc3FydChNYXRoLnBvdyhiLDIpK01hdGgucG93KGQsMikpPnImJihzPSEwKSx1LmNoZWNrZWQ9dS5jaGVja2VkfHxmfHxpfWZ1bmN0aW9uIGgoYSl7KGMub25Ub3VjaEVuZHx8ZykoKTt2YXIgYj1rO3UuY29udHJvbD1rPSExLGImJih1LmZsb3c9ITEpLCFifHxxJiYhdS5jaGVja2VkfHwoYSYmWShhKSxnZD0hMCxjbGVhclRpbWVvdXQoaGQpLGhkPXNldFRpbWVvdXQoZnVuY3Rpb24oKXtnZD0hMX0sMWUzKSwoYy5vbkVuZHx8ZykuY2FsbCh0LHttb3ZlZDpzLCR0YXJnZXQ6bSxjb250cm9sOm4sdG91Y2g6byxzdGFydEV2ZW50OmwsYWJvcnRlZDohYXx8XCJNU1BvaW50ZXJDYW5jZWxcIj09PWEudHlwZX0pKX1mdW5jdGlvbiBpKCl7dS5mbG93fHxzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dS5mbG93PSEwfSwxMCl9ZnVuY3Rpb24gaigpe3UuZmxvdyYmc2V0VGltZW91dChmdW5jdGlvbigpe3UuZmxvdz0hMX0sUGMpfXZhciBrLGwsbSxuLG8scCxxLHIscyx0PWFbMF0sdT17fTtyZXR1cm4gTmM/KFQodCxcIk1TUG9pbnRlckRvd25cIixlKSxUKGIsXCJNU1BvaW50ZXJNb3ZlXCIsZiksVChiLFwiTVNQb2ludGVyQ2FuY2VsXCIsaCksVChiLFwiTVNQb2ludGVyVXBcIixoKSk6KFQodCxcInRvdWNoc3RhcnRcIixlKSxUKHQsXCJ0b3VjaG1vdmVcIixmKSxUKHQsXCJ0b3VjaGVuZFwiLGgpLFQoYixcInRvdWNoc3RhcnRcIixpKSxUKGIsXCJ0b3VjaGVuZFwiLGopLFQoYixcInRvdWNoY2FuY2VsXCIsaiksRWMub24oXCJzY3JvbGxcIixqKSxhLm9uKFwibW91c2Vkb3duXCIsZSksRmMub24oXCJtb3VzZW1vdmVcIixmKS5vbihcIm1vdXNldXBcIixoKSksYS5vbihcImNsaWNrXCIsXCJhXCIsZnVuY3Rpb24oYSl7dS5jaGVja2VkJiZZKGEpfSksdX1mdW5jdGlvbiBkYihhLGIpe2Z1bmN0aW9uIGMoYyxkKXtBPSEwLGo9bD1jLl94LHE9Yy5fbm93LHA9W1txLGpdXSxtPW49RC5ub01vdmV8fGQ/MDp2KGEsKGIuZ2V0UG9zfHxnKSgpKSwoYi5vblN0YXJ0fHxnKS5jYWxsKEIsYyl9ZnVuY3Rpb24gZShhLGIpe3M9RC5taW4sdD1ELm1heCx1PUQuc25hcCx3PWEuYWx0S2V5LEE9ej0hMSx5PWIuY29udHJvbCx5fHxDLnNsaWRpbmd8fGMoYSl9ZnVuY3Rpb24gZihkLGUpe0Qubm9Td2lwZXx8KEF8fGMoZCksbD1kLl94LHAucHVzaChbZC5fbm93LGxdKSxuPW0tKGotbCksbz1LKG4scyx0KSxzPj1uP249eChuLHMpOm4+PXQmJihuPXgobix0KSksRC5ub01vdmV8fChhLmNzcyhrKG4pKSx6fHwoej0hMCxlLnRvdWNofHxOY3x8YS5hZGRDbGFzcyhlYykpLChiLm9uTW92ZXx8ZykuY2FsbChCLGQse3BvczpuLGVkZ2U6b30pKSl9ZnVuY3Rpb24gaShlKXtpZighRC5ub1N3aXBlfHwhZS5tb3ZlZCl7QXx8YyhlLnN0YXJ0RXZlbnQsITApLGUudG91Y2h8fE5jfHxhLnJlbW92ZUNsYXNzKGVjKSxyPWQubm93KCk7Zm9yKHZhciBmLGksaixrLG8scSx2LHgseSx6PXItUGMsQz1udWxsLEU9UWMsRj1iLmZyaWN0aW9uLEc9cC5sZW5ndGgtMTtHPj0wO0ctLSl7aWYoZj1wW0ddWzBdLGk9TWF0aC5hYnMoZi16KSxudWxsPT09Q3x8aj5pKUM9ZixrPXBbR11bMV07ZWxzZSBpZihDPT09enx8aT5qKWJyZWFrO2o9aX12PWgobixzLHQpO3ZhciBIPWstbCxJPUg+PTAsSj1yLUMsSz1KPlBjLEw9IUsmJm4hPT1tJiZ2PT09bjt1JiYodj1oKE1hdGhbTD9JP1wiZmxvb3JcIjpcImNlaWxcIjpcInJvdW5kXCJdKG4vdSkqdSxzLHQpLHM9dD12KSxMJiYodXx8dj09PW4pJiYoeT0tKEgvSiksRSo9aChNYXRoLmFicyh5KSxiLnRpbWVMb3csYi50aW1lSGlnaCksbz1NYXRoLnJvdW5kKG4reSpFL0YpLHV8fCh2PW8pLCghSSYmbz50fHxJJiZzPm8pJiYocT1JP3M6dCx4PW8tcSx1fHwodj1xKSx4PWgodisuMDMqeCxxLTUwLHErNTApLEU9TWF0aC5hYnMoKG4teCkvKHkvRikpKSksRSo9dz8xMDoxLChiLm9uRW5kfHxnKS5jYWxsKEIsZC5leHRlbmQoZSx7bW92ZWQ6ZS5tb3ZlZHx8SyYmdSxwb3M6bixuZXdQb3M6dixvdmVyUG9zOngsdGltZTpFfSkpfX12YXIgaixsLG0sbixvLHAscSxyLHMsdCx1LHcseSx6LEEsQj1hWzBdLEM9YS5kYXRhKCksRD17fTtyZXR1cm4gRD1kLmV4dGVuZChjYihiLiR3cmFwLGQuZXh0ZW5kKHt9LGIse29uU3RhcnQ6ZSxvbk1vdmU6ZixvbkVuZDppfSkpLEQpfWZ1bmN0aW9uIGViKGEsYil7dmFyIGMsZSxmLGg9YVswXSxpPXtwcmV2ZW50Ont9fTtyZXR1cm4gVChoLE9jLGZ1bmN0aW9uKGEpe3ZhciBoPWEud2hlZWxEZWx0YVl8fC0xKmEuZGVsdGFZfHwwLGo9YS53aGVlbERlbHRhWHx8LTEqYS5kZWx0YVh8fDAsaz1NYXRoLmFicyhqKSYmIU1hdGguYWJzKGgpLGw9WigwPmopLG09ZT09PWwsbj1kLm5vdygpLG89UGM+bi1mO2U9bCxmPW4sayYmaS5vayYmKCFpLnByZXZlbnRbbF18fGMpJiYoWShhLCEwKSxjJiZtJiZvfHwoYi5zaGlmdCYmKGM9ITAsY2xlYXJUaW1lb3V0KGkudCksaS50PXNldFRpbWVvdXQoZnVuY3Rpb24oKXtjPSExfSxSYykpLChiLm9uRW5kfHxnKShhLGIuc2hpZnQ/bDpqKSkpfSksaX1mdW5jdGlvbiBmYigpe2QuZWFjaChkLkZvdG9yYW1hLmluc3RhbmNlcyxmdW5jdGlvbihhLGIpe2IuaW5kZXg9YX0pfWZ1bmN0aW9uIGdiKGEpe2QuRm90b3JhbWEuaW5zdGFuY2VzLnB1c2goYSksZmIoKX1mdW5jdGlvbiBoYihhKXtkLkZvdG9yYW1hLmluc3RhbmNlcy5zcGxpY2UoYS5pbmRleCwxKSxmYigpfXZhciBpYj1cImZvdG9yYW1hXCIsamI9XCJmdWxsc2NyZWVuXCIsa2I9aWIrXCJfX3dyYXBcIixsYj1rYitcIi0tY3NzMlwiLG1iPWtiK1wiLS1jc3MzXCIsbmI9a2IrXCItLXZpZGVvXCIsb2I9a2IrXCItLWZhZGVcIixwYj1rYitcIi0tc2xpZGVcIixxYj1rYitcIi0tbm8tY29udHJvbHNcIixyYj1rYitcIi0tbm8tc2hhZG93c1wiLHNiPWtiK1wiLS1wYW4teVwiLHRiPWtiK1wiLS1ydGxcIix1Yj1rYitcIi0tb25seS1hY3RpdmVcIix2Yj1rYitcIi0tbm8tY2FwdGlvbnNcIix3Yj1rYitcIi0tdG9nZ2xlLWFycm93c1wiLHhiPWliK1wiX19zdGFnZVwiLHliPXhiK1wiX19mcmFtZVwiLHpiPXliK1wiLS12aWRlb1wiLEFiPXhiK1wiX19zaGFmdFwiLEJiPWliK1wiX19ncmFiXCIsQ2I9aWIrXCJfX3BvaW50ZXJcIixEYj1pYitcIl9fYXJyXCIsRWI9RGIrXCItLWRpc2FibGVkXCIsRmI9RGIrXCItLXByZXZcIixHYj1EYitcIi0tbmV4dFwiLEhiPWliK1wiX19uYXZcIixJYj1IYitcIi13cmFwXCIsSmI9SGIrXCJfX3NoYWZ0XCIsS2I9SGIrXCItLWRvdHNcIixMYj1IYitcIi0tdGh1bWJzXCIsTWI9SGIrXCJfX2ZyYW1lXCIsTmI9TWIrXCItLWRvdFwiLE9iPU1iK1wiLS10aHVtYlwiLFBiPWliK1wiX19mYWRlXCIsUWI9UGIrXCItZnJvbnRcIixSYj1QYitcIi1yZWFyXCIsU2I9aWIrXCJfX3NoYWRvd1wiLFRiPVNiK1wic1wiLFViPVRiK1wiLS1sZWZ0XCIsVmI9VGIrXCItLXJpZ2h0XCIsV2I9aWIrXCJfX2FjdGl2ZVwiLFhiPWliK1wiX19zZWxlY3RcIixZYj1pYitcIi0taGlkZGVuXCIsWmI9aWIrXCItLWZ1bGxzY3JlZW5cIiwkYj1pYitcIl9fZnVsbHNjcmVlbi1pY29uXCIsX2I9aWIrXCJfX2Vycm9yXCIsYWM9aWIrXCJfX2xvYWRpbmdcIixiYz1pYitcIl9fbG9hZGVkXCIsY2M9YmMrXCItLWZ1bGxcIixkYz1iYytcIi0taW1nXCIsZWM9aWIrXCJfX2dyYWJiaW5nXCIsZmM9aWIrXCJfX2ltZ1wiLGdjPWZjK1wiLS1mdWxsXCIsaGM9aWIrXCJfX2RvdFwiLGljPWliK1wiX190aHVtYlwiLGpjPWljK1wiLWJvcmRlclwiLGtjPWliK1wiX19odG1sXCIsbGM9aWIrXCJfX3ZpZGVvXCIsbWM9bGMrXCItcGxheVwiLG5jPWxjK1wiLWNsb3NlXCIsb2M9aWIrXCJfX2NhcHRpb25cIixwYz1pYitcIl9fY2FwdGlvbl9fd3JhcFwiLHFjPWliK1wiX19zcGlubmVyXCIscmM9J1wiIHRhYmluZGV4PVwiMFwiIHJvbGU9XCJidXR0b24nLHNjPWQmJmQuZm4uanF1ZXJ5LnNwbGl0KFwiLlwiKTtpZighc2N8fHNjWzBdPDF8fDE9PXNjWzBdJiZzY1sxXTw4KXRocm93XCJGb3RvcmFtYSByZXF1aXJlcyBqUXVlcnkgMS44IG9yIGxhdGVyIGFuZCB3aWxsIG5vdCBydW4gd2l0aG91dCBpdC5cIjt2YXIgdGM9e30sdWM9ZnVuY3Rpb24oYSxiLGMpe2Z1bmN0aW9uIGQoYSl7ci5jc3NUZXh0PWF9ZnVuY3Rpb24gZShhLGIpe3JldHVybiB0eXBlb2YgYT09PWJ9ZnVuY3Rpb24gZihhLGIpe3JldHVybiEhfihcIlwiK2EpLmluZGV4T2YoYil9ZnVuY3Rpb24gZyhhLGIpe2Zvcih2YXIgZCBpbiBhKXt2YXIgZT1hW2RdO2lmKCFmKGUsXCItXCIpJiZyW2VdIT09YylyZXR1cm5cInBmeFwiPT1iP2U6ITB9cmV0dXJuITF9ZnVuY3Rpb24gaChhLGIsZCl7Zm9yKHZhciBmIGluIGEpe3ZhciBnPWJbYVtmXV07aWYoZyE9PWMpcmV0dXJuIGQ9PT0hMT9hW2ZdOmUoZyxcImZ1bmN0aW9uXCIpP2cuYmluZChkfHxiKTpnfXJldHVybiExfWZ1bmN0aW9uIGkoYSxiLGMpe3ZhciBkPWEuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkrYS5zbGljZSgxKSxmPShhK1wiIFwiK3Uuam9pbihkK1wiIFwiKStkKS5zcGxpdChcIiBcIik7cmV0dXJuIGUoYixcInN0cmluZ1wiKXx8ZShiLFwidW5kZWZpbmVkXCIpP2coZixiKTooZj0oYStcIiBcIit2LmpvaW4oZCtcIiBcIikrZCkuc3BsaXQoXCIgXCIpLGgoZixiLGMpKX12YXIgaixrLGwsbT1cIjIuNi4yXCIsbj17fSxvPWIuZG9jdW1lbnRFbGVtZW50LHA9XCJtb2Rlcm5penJcIixxPWIuY3JlYXRlRWxlbWVudChwKSxyPXEuc3R5bGUscz0oe30udG9TdHJpbmcsXCIgLXdlYmtpdC0gLW1vei0gLW8tIC1tcy0gXCIuc3BsaXQoXCIgXCIpKSx0PVwiV2Via2l0IE1veiBPIG1zXCIsdT10LnNwbGl0KFwiIFwiKSx2PXQudG9Mb3dlckNhc2UoKS5zcGxpdChcIiBcIiksdz17fSx4PVtdLHk9eC5zbGljZSx6PWZ1bmN0aW9uKGEsYyxkLGUpe3ZhciBmLGcsaCxpLGo9Yi5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLGs9Yi5ib2R5LGw9a3x8Yi5jcmVhdGVFbGVtZW50KFwiYm9keVwiKTtpZihwYXJzZUludChkLDEwKSlmb3IoO2QtLTspaD1iLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksaC5pZD1lP2VbZF06cCsoZCsxKSxqLmFwcGVuZENoaWxkKGgpO3JldHVybiBmPVtcIiYjMTczO1wiLCc8c3R5bGUgaWQ9XCJzJyxwLCdcIj4nLGEsXCI8L3N0eWxlPlwiXS5qb2luKFwiXCIpLGouaWQ9cCwoaz9qOmwpLmlubmVySFRNTCs9ZixsLmFwcGVuZENoaWxkKGopLGt8fChsLnN0eWxlLmJhY2tncm91bmQ9XCJcIixsLnN0eWxlLm92ZXJmbG93PVwiaGlkZGVuXCIsaT1vLnN0eWxlLm92ZXJmbG93LG8uc3R5bGUub3ZlcmZsb3c9XCJoaWRkZW5cIixvLmFwcGVuZENoaWxkKGwpKSxnPWMoaixhKSxrP2oucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChqKToobC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGwpLG8uc3R5bGUub3ZlcmZsb3c9aSksISFnfSxBPXt9Lmhhc093blByb3BlcnR5O2w9ZShBLFwidW5kZWZpbmVkXCIpfHxlKEEuY2FsbCxcInVuZGVmaW5lZFwiKT9mdW5jdGlvbihhLGIpe3JldHVybiBiIGluIGEmJmUoYS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVbYl0sXCJ1bmRlZmluZWRcIil9OmZ1bmN0aW9uKGEsYil7cmV0dXJuIEEuY2FsbChhLGIpfSxGdW5jdGlvbi5wcm90b3R5cGUuYmluZHx8KEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kPWZ1bmN0aW9uKGEpe3ZhciBiPXRoaXM7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgYil0aHJvdyBuZXcgVHlwZUVycm9yO3ZhciBjPXkuY2FsbChhcmd1bWVudHMsMSksZD1mdW5jdGlvbigpe2lmKHRoaXMgaW5zdGFuY2VvZiBkKXt2YXIgZT1mdW5jdGlvbigpe307ZS5wcm90b3R5cGU9Yi5wcm90b3R5cGU7dmFyIGY9bmV3IGUsZz1iLmFwcGx5KGYsYy5jb25jYXQoeS5jYWxsKGFyZ3VtZW50cykpKTtyZXR1cm4gT2JqZWN0KGcpPT09Zz9nOmZ9cmV0dXJuIGIuYXBwbHkoYSxjLmNvbmNhdCh5LmNhbGwoYXJndW1lbnRzKSkpfTtyZXR1cm4gZH0pLHcuY3NzdHJhbnNmb3JtczNkPWZ1bmN0aW9uKCl7dmFyIGE9ISFpKFwicGVyc3BlY3RpdmVcIik7cmV0dXJuIGF9O2Zvcih2YXIgQiBpbiB3KWwodyxCKSYmKGs9Qi50b0xvd2VyQ2FzZSgpLG5ba109d1tCXSgpLHgucHVzaCgobltrXT9cIlwiOlwibm8tXCIpK2spKTtyZXR1cm4gbi5hZGRUZXN0PWZ1bmN0aW9uKGEsYil7aWYoXCJvYmplY3RcIj09dHlwZW9mIGEpZm9yKHZhciBkIGluIGEpbChhLGQpJiZuLmFkZFRlc3QoZCxhW2RdKTtlbHNle2lmKGE9YS50b0xvd2VyQ2FzZSgpLG5bYV0hPT1jKXJldHVybiBuO2I9XCJmdW5jdGlvblwiPT10eXBlb2YgYj9iKCk6YixcInVuZGVmaW5lZFwiIT10eXBlb2YgZW5hYmxlQ2xhc3NlcyYmZW5hYmxlQ2xhc3NlcyYmKG8uY2xhc3NOYW1lKz1cIiBcIisoYj9cIlwiOlwibm8tXCIpK2EpLG5bYV09Yn1yZXR1cm4gbn0sZChcIlwiKSxxPWo9bnVsbCxuLl92ZXJzaW9uPW0sbi5fcHJlZml4ZXM9cyxuLl9kb21QcmVmaXhlcz12LG4uX2Nzc29tUHJlZml4ZXM9dSxuLnRlc3RQcm9wPWZ1bmN0aW9uKGEpe3JldHVybiBnKFthXSl9LG4udGVzdEFsbFByb3BzPWksbi50ZXN0U3R5bGVzPXosbi5wcmVmaXhlZD1mdW5jdGlvbihhLGIsYyl7cmV0dXJuIGI/aShhLGIsYyk6aShhLFwicGZ4XCIpfSxufShhLGIpLHZjPXtvazohMSxpczpmdW5jdGlvbigpe3JldHVybiExfSxyZXF1ZXN0OmZ1bmN0aW9uKCl7fSxjYW5jZWw6ZnVuY3Rpb24oKXt9LGV2ZW50OlwiXCIscHJlZml4OlwiXCJ9LHdjPVwid2Via2l0IG1veiBvIG1zIGtodG1sXCIuc3BsaXQoXCIgXCIpO2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBiLmNhbmNlbEZ1bGxTY3JlZW4pdmMub2s9ITA7ZWxzZSBmb3IodmFyIHhjPTAseWM9d2MubGVuZ3RoO3ljPnhjO3hjKyspaWYodmMucHJlZml4PXdjW3hjXSxcInVuZGVmaW5lZFwiIT10eXBlb2YgYlt2Yy5wcmVmaXgrXCJDYW5jZWxGdWxsU2NyZWVuXCJdKXt2Yy5vaz0hMDticmVha312Yy5vayYmKHZjLmV2ZW50PXZjLnByZWZpeCtcImZ1bGxzY3JlZW5jaGFuZ2VcIix2Yy5pcz1mdW5jdGlvbigpe3N3aXRjaCh0aGlzLnByZWZpeCl7Y2FzZVwiXCI6cmV0dXJuIGIuZnVsbFNjcmVlbjtjYXNlXCJ3ZWJraXRcIjpyZXR1cm4gYi53ZWJraXRJc0Z1bGxTY3JlZW47ZGVmYXVsdDpyZXR1cm4gYlt0aGlzLnByZWZpeCtcIkZ1bGxTY3JlZW5cIl19fSx2Yy5yZXF1ZXN0PWZ1bmN0aW9uKGEpe3JldHVyblwiXCI9PT10aGlzLnByZWZpeD9hLnJlcXVlc3RGdWxsU2NyZWVuKCk6YVt0aGlzLnByZWZpeCtcIlJlcXVlc3RGdWxsU2NyZWVuXCJdKCl9LHZjLmNhbmNlbD1mdW5jdGlvbigpe3JldHVyblwiXCI9PT10aGlzLnByZWZpeD9iLmNhbmNlbEZ1bGxTY3JlZW4oKTpiW3RoaXMucHJlZml4K1wiQ2FuY2VsRnVsbFNjcmVlblwiXSgpfSk7dmFyIHpjLEFjPXtsaW5lczoxMixsZW5ndGg6NSx3aWR0aDoyLHJhZGl1czo3LGNvcm5lcnM6MSxyb3RhdGU6MTUsY29sb3I6XCJyZ2JhKDEyOCwgMTI4LCAxMjgsIC43NSlcIixod2FjY2VsOiEwfSxCYz17dG9wOlwiYXV0b1wiLGxlZnQ6XCJhdXRvXCIsY2xhc3NOYW1lOlwiXCJ9OyFmdW5jdGlvbihhLGIpe3pjPWIoKX0odGhpcyxmdW5jdGlvbigpe2Z1bmN0aW9uIGEoYSxjKXt2YXIgZCxlPWIuY3JlYXRlRWxlbWVudChhfHxcImRpdlwiKTtmb3IoZCBpbiBjKWVbZF09Y1tkXTtyZXR1cm4gZX1mdW5jdGlvbiBjKGEpe2Zvcih2YXIgYj0xLGM9YXJndW1lbnRzLmxlbmd0aDtjPmI7YisrKWEuYXBwZW5kQ2hpbGQoYXJndW1lbnRzW2JdKTtyZXR1cm4gYX1mdW5jdGlvbiBkKGEsYixjLGQpe3ZhciBlPVtcIm9wYWNpdHlcIixiLH5+KDEwMCphKSxjLGRdLmpvaW4oXCItXCIpLGY9LjAxK2MvZCoxMDAsZz1NYXRoLm1heCgxLSgxLWEpL2IqKDEwMC1mKSxhKSxoPW0uc3Vic3RyaW5nKDAsbS5pbmRleE9mKFwiQW5pbWF0aW9uXCIpKS50b0xvd2VyQ2FzZSgpLGk9aCYmXCItXCIraCtcIi1cInx8XCJcIjtyZXR1cm4gb1tlXXx8KHAuaW5zZXJ0UnVsZShcIkBcIitpK1wia2V5ZnJhbWVzIFwiK2UrXCJ7MCV7b3BhY2l0eTpcIitnK1wifVwiK2YrXCIle29wYWNpdHk6XCIrYStcIn1cIisoZisuMDEpK1wiJXtvcGFjaXR5OjF9XCIrKGYrYiklMTAwK1wiJXtvcGFjaXR5OlwiK2ErXCJ9MTAwJXtvcGFjaXR5OlwiK2crXCJ9fVwiLHAuY3NzUnVsZXMubGVuZ3RoKSxvW2VdPTEpLGV9ZnVuY3Rpb24gZihhLGIpe3ZhciBjLGQsZj1hLnN0eWxlO2ZvcihiPWIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkrYi5zbGljZSgxKSxkPTA7ZDxuLmxlbmd0aDtkKyspaWYoYz1uW2RdK2IsZltjXSE9PWUpcmV0dXJuIGM7cmV0dXJuIGZbYl0hPT1lP2I6dm9pZCAwfWZ1bmN0aW9uIGcoYSxiKXtmb3IodmFyIGMgaW4gYilhLnN0eWxlW2YoYSxjKXx8Y109YltjXTtyZXR1cm4gYX1mdW5jdGlvbiBoKGEpe2Zvcih2YXIgYj0xO2I8YXJndW1lbnRzLmxlbmd0aDtiKyspe3ZhciBjPWFyZ3VtZW50c1tiXTtmb3IodmFyIGQgaW4gYylhW2RdPT09ZSYmKGFbZF09Y1tkXSl9cmV0dXJuIGF9ZnVuY3Rpb24gaShhKXtmb3IodmFyIGI9e3g6YS5vZmZzZXRMZWZ0LHk6YS5vZmZzZXRUb3B9O2E9YS5vZmZzZXRQYXJlbnQ7KWIueCs9YS5vZmZzZXRMZWZ0LGIueSs9YS5vZmZzZXRUb3A7cmV0dXJuIGJ9ZnVuY3Rpb24gaihhLGIpe3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiBhP2E6YVtiJWEubGVuZ3RoXX1mdW5jdGlvbiBrKGEpe3JldHVyblwidW5kZWZpbmVkXCI9PXR5cGVvZiB0aGlzP25ldyBrKGEpOnZvaWQodGhpcy5vcHRzPWgoYXx8e30say5kZWZhdWx0cyxxKSl9ZnVuY3Rpb24gbCgpe2Z1bmN0aW9uIGIoYixjKXtyZXR1cm4gYShcIjxcIitiKycgeG1sbnM9XCJ1cm46c2NoZW1hcy1taWNyb3NvZnQuY29tOnZtbFwiIGNsYXNzPVwic3Bpbi12bWxcIj4nLGMpfXAuYWRkUnVsZShcIi5zcGluLXZtbFwiLFwiYmVoYXZpb3I6dXJsKCNkZWZhdWx0I1ZNTClcIiksay5wcm90b3R5cGUubGluZXM9ZnVuY3Rpb24oYSxkKXtmdW5jdGlvbiBlKCl7cmV0dXJuIGcoYihcImdyb3VwXCIse2Nvb3Jkc2l6ZTprK1wiIFwiK2ssY29vcmRvcmlnaW46LWkrXCIgXCIrLWl9KSx7d2lkdGg6ayxoZWlnaHQ6a30pfWZ1bmN0aW9uIGYoYSxmLGgpe2MobSxjKGcoZSgpLHtyb3RhdGlvbjozNjAvZC5saW5lcyphK1wiZGVnXCIsbGVmdDp+fmZ9KSxjKGcoYihcInJvdW5kcmVjdFwiLHthcmNzaXplOmQuY29ybmVyc30pLHt3aWR0aDppLGhlaWdodDpkLndpZHRoLGxlZnQ6ZC5yYWRpdXMsdG9wOi1kLndpZHRoPj4xLGZpbHRlcjpofSksYihcImZpbGxcIix7Y29sb3I6aihkLmNvbG9yLGEpLG9wYWNpdHk6ZC5vcGFjaXR5fSksYihcInN0cm9rZVwiLHtvcGFjaXR5OjB9KSkpKX12YXIgaCxpPWQubGVuZ3RoK2Qud2lkdGgsaz0yKmksbD0yKi0oZC53aWR0aCtkLmxlbmd0aCkrXCJweFwiLG09ZyhlKCkse3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix0b3A6bCxsZWZ0Omx9KTtpZihkLnNoYWRvdylmb3IoaD0xO2g8PWQubGluZXM7aCsrKWYoaCwtMixcInByb2dpZDpEWEltYWdlVHJhbnNmb3JtLk1pY3Jvc29mdC5CbHVyKHBpeGVscmFkaXVzPTIsbWFrZXNoYWRvdz0xLHNoYWRvd29wYWNpdHk9LjMpXCIpO2ZvcihoPTE7aDw9ZC5saW5lcztoKyspZihoKTtyZXR1cm4gYyhhLG0pfSxrLnByb3RvdHlwZS5vcGFjaXR5PWZ1bmN0aW9uKGEsYixjLGQpe3ZhciBlPWEuZmlyc3RDaGlsZDtkPWQuc2hhZG93JiZkLmxpbmVzfHwwLGUmJmIrZDxlLmNoaWxkTm9kZXMubGVuZ3RoJiYoZT1lLmNoaWxkTm9kZXNbYitkXSxlPWUmJmUuZmlyc3RDaGlsZCxlPWUmJmUuZmlyc3RDaGlsZCxlJiYoZS5vcGFjaXR5PWMpKX19dmFyIG0sbj1bXCJ3ZWJraXRcIixcIk1velwiLFwibXNcIixcIk9cIl0sbz17fSxwPWZ1bmN0aW9uKCl7dmFyIGQ9YShcInN0eWxlXCIse3R5cGU6XCJ0ZXh0L2Nzc1wifSk7cmV0dXJuIGMoYi5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF0sZCksZC5zaGVldHx8ZC5zdHlsZVNoZWV0fSgpLHE9e2xpbmVzOjEyLGxlbmd0aDo3LHdpZHRoOjUscmFkaXVzOjEwLHJvdGF0ZTowLGNvcm5lcnM6MSxjb2xvcjpcIiMwMDBcIixkaXJlY3Rpb246MSxzcGVlZDoxLHRyYWlsOjEwMCxvcGFjaXR5Oi4yNSxmcHM6MjAsekluZGV4OjJlOSxjbGFzc05hbWU6XCJzcGlubmVyXCIsdG9wOlwiYXV0b1wiLGxlZnQ6XCJhdXRvXCIscG9zaXRpb246XCJyZWxhdGl2ZVwifTtrLmRlZmF1bHRzPXt9LGgoay5wcm90b3R5cGUse3NwaW46ZnVuY3Rpb24oYil7dGhpcy5zdG9wKCk7dmFyIGMsZCxlPXRoaXMsZj1lLm9wdHMsaD1lLmVsPWcoYSgwLHtjbGFzc05hbWU6Zi5jbGFzc05hbWV9KSx7cG9zaXRpb246Zi5wb3NpdGlvbix3aWR0aDowLHpJbmRleDpmLnpJbmRleH0pLGo9Zi5yYWRpdXMrZi5sZW5ndGgrZi53aWR0aDtpZihiJiYoYi5pbnNlcnRCZWZvcmUoaCxiLmZpcnN0Q2hpbGR8fG51bGwpLGQ9aShiKSxjPWkoaCksZyhoLHtsZWZ0OihcImF1dG9cIj09Zi5sZWZ0P2QueC1jLngrKGIub2Zmc2V0V2lkdGg+PjEpOnBhcnNlSW50KGYubGVmdCwxMCkraikrXCJweFwiLHRvcDooXCJhdXRvXCI9PWYudG9wP2QueS1jLnkrKGIub2Zmc2V0SGVpZ2h0Pj4xKTpwYXJzZUludChmLnRvcCwxMCkraikrXCJweFwifSkpLGguc2V0QXR0cmlidXRlKFwicm9sZVwiLFwicHJvZ3Jlc3NiYXJcIiksZS5saW5lcyhoLGUub3B0cyksIW0pe3ZhciBrLGw9MCxuPShmLmxpbmVzLTEpKigxLWYuZGlyZWN0aW9uKS8yLG89Zi5mcHMscD1vL2Yuc3BlZWQscT0oMS1mLm9wYWNpdHkpLyhwKmYudHJhaWwvMTAwKSxyPXAvZi5saW5lczshZnVuY3Rpb24gcygpe2wrKztmb3IodmFyIGE9MDthPGYubGluZXM7YSsrKWs9TWF0aC5tYXgoMS0obCsoZi5saW5lcy1hKSpyKSVwKnEsZi5vcGFjaXR5KSxlLm9wYWNpdHkoaCxhKmYuZGlyZWN0aW9uK24sayxmKTtlLnRpbWVvdXQ9ZS5lbCYmc2V0VGltZW91dChzLH5+KDFlMy9vKSl9KCl9cmV0dXJuIGV9LHN0b3A6ZnVuY3Rpb24oKXt2YXIgYT10aGlzLmVsO3JldHVybiBhJiYoY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCksYS5wYXJlbnROb2RlJiZhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSksdGhpcy5lbD1lKSx0aGlzfSxsaW5lczpmdW5jdGlvbihiLGUpe2Z1bmN0aW9uIGYoYixjKXtyZXR1cm4gZyhhKCkse3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix3aWR0aDplLmxlbmd0aCtlLndpZHRoK1wicHhcIixoZWlnaHQ6ZS53aWR0aCtcInB4XCIsYmFja2dyb3VuZDpiLGJveFNoYWRvdzpjLHRyYW5zZm9ybU9yaWdpbjpcImxlZnRcIix0cmFuc2Zvcm06XCJyb3RhdGUoXCIrfn4oMzYwL2UubGluZXMqaStlLnJvdGF0ZSkrXCJkZWcpIHRyYW5zbGF0ZShcIitlLnJhZGl1cytcInB4LDApXCIsYm9yZGVyUmFkaXVzOihlLmNvcm5lcnMqZS53aWR0aD4+MSkrXCJweFwifSl9Zm9yKHZhciBoLGk9MCxrPShlLmxpbmVzLTEpKigxLWUuZGlyZWN0aW9uKS8yO2k8ZS5saW5lcztpKyspaD1nKGEoKSx7cG9zaXRpb246XCJhYnNvbHV0ZVwiLHRvcDoxK34oZS53aWR0aC8yKStcInB4XCIsdHJhbnNmb3JtOmUuaHdhY2NlbD9cInRyYW5zbGF0ZTNkKDAsMCwwKVwiOlwiXCIsb3BhY2l0eTplLm9wYWNpdHksYW5pbWF0aW9uOm0mJmQoZS5vcGFjaXR5LGUudHJhaWwsaytpKmUuZGlyZWN0aW9uLGUubGluZXMpK1wiIFwiKzEvZS5zcGVlZCtcInMgbGluZWFyIGluZmluaXRlXCJ9KSxlLnNoYWRvdyYmYyhoLGcoZihcIiMwMDBcIixcIjAgMCA0cHggIzAwMFwiKSx7dG9wOlwiMnB4XCJ9KSksYyhiLGMoaCxmKGooZS5jb2xvcixpKSxcIjAgMCAxcHggcmdiYSgwLDAsMCwuMSlcIikpKTtyZXR1cm4gYn0sb3BhY2l0eTpmdW5jdGlvbihhLGIsYyl7YjxhLmNoaWxkTm9kZXMubGVuZ3RoJiYoYS5jaGlsZE5vZGVzW2JdLnN0eWxlLm9wYWNpdHk9Yyl9fSk7dmFyIHI9ZyhhKFwiZ3JvdXBcIikse2JlaGF2aW9yOlwidXJsKCNkZWZhdWx0I1ZNTClcIn0pO3JldHVybiFmKHIsXCJ0cmFuc2Zvcm1cIikmJnIuYWRqP2woKTptPWYocixcImFuaW1hdGlvblwiKSxrfSk7dmFyIENjLERjLEVjPWQoYSksRmM9ZChiKSxHYz1cInF1aXJrc1wiPT09Yy5oYXNoLnJlcGxhY2UoXCIjXCIsXCJcIiksSGM9dWMuY3NzdHJhbnNmb3JtczNkLEljPUhjJiYhR2MsSmM9SGN8fFwiQ1NTMUNvbXBhdFwiPT09Yi5jb21wYXRNb2RlLEtjPXZjLm9rLExjPW5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goL0FuZHJvaWR8d2ViT1N8aVBob25lfGlQYWR8aVBvZHxCbGFja0JlcnJ5fFdpbmRvd3MgUGhvbmUvaSksTWM9IUljfHxMYyxOYz1uYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZCxPYz1cIm9ud2hlZWxcImluIGIuY3JlYXRlRWxlbWVudChcImRpdlwiKT9cIndoZWVsXCI6Yi5vbm1vdXNld2hlZWwhPT1lP1wibW91c2V3aGVlbFwiOlwiRE9NTW91c2VTY3JvbGxcIixQYz0yNTAsUWM9MzAwLFJjPTE0MDAsU2M9NWUzLFRjPTIsVWM9NjQsVmM9NTAwLFdjPTMzMyxYYz1cIiRzdGFnZUZyYW1lXCIsWWM9XCIkbmF2RG90RnJhbWVcIixaYz1cIiRuYXZUaHVtYkZyYW1lXCIsJGM9XCJhdXRvXCIsX2M9ZihbLjEsMCwuMjUsMV0pLGFkPTk5OTk5LGJkPVwiNTAlXCIsY2Q9e3dpZHRoOm51bGwsbWlud2lkdGg6bnVsbCxtYXh3aWR0aDpcIjEwMCVcIixoZWlnaHQ6bnVsbCxtaW5oZWlnaHQ6bnVsbCxtYXhoZWlnaHQ6bnVsbCxyYXRpbzpudWxsLG1hcmdpbjpUYyxnbGltcHNlOjAsZml0OlwiY29udGFpblwiLHBvc2l0aW9uOmJkLHRodW1icG9zaXRpb246YmQsbmF2OlwiZG90c1wiLG5hdnBvc2l0aW9uOlwiYm90dG9tXCIsbmF2d2lkdGg6bnVsbCx0aHVtYndpZHRoOlVjLHRodW1iaGVpZ2h0OlVjLHRodW1ibWFyZ2luOlRjLHRodW1iYm9yZGVyd2lkdGg6VGMsdGh1bWJmaXQ6XCJjb3ZlclwiLGFsbG93ZnVsbHNjcmVlbjohMSx0cmFuc2l0aW9uOlwic2xpZGVcIixjbGlja3RyYW5zaXRpb246bnVsbCx0cmFuc2l0aW9uZHVyYXRpb246UWMsY2FwdGlvbnM6ITAsaGFzaDohMSxzdGFydGluZGV4OjAsbG9vcDohMSxhdXRvcGxheTohMSxzdG9wYXV0b3BsYXlvbnRvdWNoOiEwLGtleWJvYXJkOiExLGFycm93czohMCxjbGljazohMCxzd2lwZTohMCx0cmFja3BhZDohMSxlbmFibGVpZnNpbmdsZWZyYW1lOiExLGNvbnRyb2xzb25zdGFydDohMCxzaHVmZmxlOiExLGRpcmVjdGlvbjpcImx0clwiLHNoYWRvd3M6ITAsc3Bpbm5lcjpudWxsfSxkZD17bGVmdDohMCxyaWdodDohMCxkb3duOiExLHVwOiExLHNwYWNlOiExLGhvbWU6ITEsZW5kOiExfTtHLnN0b3A9ZnVuY3Rpb24oYSl7Ry5paVthXT0hMX07dmFyIGVkLGZkLGdkLGhkO2pRdWVyeS5Gb3RvcmFtYT1mdW5jdGlvbihhLGUpe2Z1bmN0aW9uIGYoKXtkLmVhY2goeWQsZnVuY3Rpb24oYSxiKXtpZighYi5pKXtiLmk9bWUrKzt2YXIgYz1BKGIudmlkZW8sITApO2lmKGMpe3ZhciBkPXt9O2IudmlkZW89YyxiLmltZ3x8Yi50aHVtYj9iLnRodW1ic1JlYWR5PSEwOmQ9QihiLHlkLGllKSxDKHlkLHtpbWc6ZC5pbWcsdGh1bWI6ZC50aHVtYn0sYi5pLGllKX19fSl9ZnVuY3Rpb24gZyhhKXtyZXR1cm4gWmRbYV18fGllLmZ1bGxTY3JlZW59ZnVuY3Rpb24gaShhKXt2YXIgYj1cImtleWRvd24uXCIraWIsYz1pYitqZSxkPVwia2V5ZG93bi5cIitjLGY9XCJyZXNpemUuXCIrYytcIiBvcmllbnRhdGlvbmNoYW5nZS5cIitjO2E/KEZjLm9uKGQsZnVuY3Rpb24oYSl7dmFyIGIsYztDZCYmMjc9PT1hLmtleUNvZGU/KGI9ITAsbWQoQ2QsITAsITApKTooaWUuZnVsbFNjcmVlbnx8ZS5rZXlib2FyZCYmIWllLmluZGV4KSYmKDI3PT09YS5rZXlDb2RlPyhiPSEwLGllLmNhbmNlbEZ1bGxTY3JlZW4oKSk6YS5zaGlmdEtleSYmMzI9PT1hLmtleUNvZGUmJmcoXCJzcGFjZVwiKXx8Mzc9PT1hLmtleUNvZGUmJmcoXCJsZWZ0XCIpfHwzOD09PWEua2V5Q29kZSYmZyhcInVwXCIpP2M9XCI8XCI6MzI9PT1hLmtleUNvZGUmJmcoXCJzcGFjZVwiKXx8Mzk9PT1hLmtleUNvZGUmJmcoXCJyaWdodFwiKXx8NDA9PT1hLmtleUNvZGUmJmcoXCJkb3duXCIpP2M9XCI+XCI6MzY9PT1hLmtleUNvZGUmJmcoXCJob21lXCIpP2M9XCI8PFwiOjM1PT09YS5rZXlDb2RlJiZnKFwiZW5kXCIpJiYoYz1cIj4+XCIpKSwoYnx8YykmJlkoYSksYyYmaWUuc2hvdyh7aW5kZXg6YyxzbG93OmEuYWx0S2V5LHVzZXI6ITB9KX0pLGllLmluZGV4fHxGYy5vZmYoYikub24oYixcInRleHRhcmVhLCBpbnB1dCwgc2VsZWN0XCIsZnVuY3Rpb24oYSl7IURjLmhhc0NsYXNzKGpiKSYmYS5zdG9wUHJvcGFnYXRpb24oKX0pLEVjLm9uKGYsaWUucmVzaXplKSk6KEZjLm9mZihkKSxFYy5vZmYoZikpfWZ1bmN0aW9uIGooYil7YiE9PWouZiYmKGI/KGEuaHRtbChcIlwiKS5hZGRDbGFzcyhpYitcIiBcIitrZSkuYXBwZW5kKHFlKS5iZWZvcmUob2UpLmJlZm9yZShwZSksZ2IoaWUpKToocWUuZGV0YWNoKCksb2UuZGV0YWNoKCkscGUuZGV0YWNoKCksYS5odG1sKG5lLnVydGV4dCkucmVtb3ZlQ2xhc3Moa2UpLGhiKGllKSksaShiKSxqLmY9Yil9ZnVuY3Rpb24gbSgpe3lkPWllLmRhdGE9eWR8fFAoZS5kYXRhKXx8RChhKSx6ZD1pZS5zaXplPXlkLmxlbmd0aCwheGQub2smJmUuc2h1ZmZsZSYmTyh5ZCksZigpLEplPXkoSmUpLHpkJiZqKCEwKX1mdW5jdGlvbiBvKCl7dmFyIGE9Mj56ZCYmIWUuZW5hYmxlaWZzaW5nbGVmcmFtZXx8Q2Q7TWUubm9Nb3ZlPWF8fFNkLE1lLm5vU3dpcGU9YXx8IWUuc3dpcGUsIVdkJiZzZS50b2dnbGVDbGFzcyhCYiwhZS5jbGljayYmIU1lLm5vTW92ZSYmIU1lLm5vU3dpcGUpLE5jJiZxZS50b2dnbGVDbGFzcyhzYiwhTWUubm9Td2lwZSl9ZnVuY3Rpb24gdChhKXthPT09ITAmJihhPVwiXCIpLGUuYXV0b3BsYXk9TWF0aC5tYXgoK2F8fFNjLDEuNSpWZCl9ZnVuY3Rpb24gdSgpe2Z1bmN0aW9uIGEoYSxjKXtiW2E/XCJhZGRcIjpcInJlbW92ZVwiXS5wdXNoKGMpfWllLm9wdGlvbnM9ZT1SKGUpLFNkPVwiY3Jvc3NmYWRlXCI9PT1lLnRyYW5zaXRpb258fFwiZGlzc29sdmVcIj09PWUudHJhbnNpdGlvbixNZD1lLmxvb3AmJih6ZD4yfHxTZCYmKCFXZHx8XCJzbGlkZVwiIT09V2QpKSxWZD0rZS50cmFuc2l0aW9uZHVyYXRpb258fFFjLFlkPVwicnRsXCI9PT1lLmRpcmVjdGlvbixaZD1kLmV4dGVuZCh7fSxlLmtleWJvYXJkJiZkZCxlLmtleWJvYXJkKTt2YXIgYj17YWRkOltdLHJlbW92ZTpbXX07emQ+MXx8ZS5lbmFibGVpZnNpbmdsZWZyYW1lPyhOZD1lLm5hdixQZD1cInRvcFwiPT09ZS5uYXZwb3NpdGlvbixiLnJlbW92ZS5wdXNoKFhiKSx3ZS50b2dnbGUoISFlLmFycm93cykpOihOZD0hMSx3ZS5oaWRlKCkpLFJiKCksQmQ9bmV3IHpjKGQuZXh0ZW5kKEFjLGUuc3Bpbm5lcixCYyx7ZGlyZWN0aW9uOllkPy0xOjF9KSksR2MoKSxIYygpLGUuYXV0b3BsYXkmJnQoZS5hdXRvcGxheSksVGQ9bihlLnRodW1id2lkdGgpfHxVYyxVZD1uKGUudGh1bWJoZWlnaHQpfHxVYyxOZS5vaz1QZS5vaz1lLnRyYWNrcGFkJiYhTWMsbygpLGVkKGUsW0xlXSksT2Q9XCJ0aHVtYnNcIj09PU5kLE9kPyhsYyh6ZCxcIm5hdlRodW1iXCIpLEFkPUJlLGhlPVpjLEoob2UsZC5Gb3RvcmFtYS5qc3Quc3R5bGUoe3c6VGQsaDpVZCxiOmUudGh1bWJib3JkZXJ3aWR0aCxtOmUudGh1bWJtYXJnaW4sczpqZSxxOiFKY30pKSx5ZS5hZGRDbGFzcyhMYikucmVtb3ZlQ2xhc3MoS2IpKTpcImRvdHNcIj09PU5kPyhsYyh6ZCxcIm5hdkRvdFwiKSxBZD1BZSxoZT1ZYyx5ZS5hZGRDbGFzcyhLYikucmVtb3ZlQ2xhc3MoTGIpKTooTmQ9ITEseWUucmVtb3ZlQ2xhc3MoTGIrXCIgXCIrS2IpKSxOZCYmKFBkP3hlLmluc2VydEJlZm9yZShyZSk6eGUuaW5zZXJ0QWZ0ZXIocmUpLHdjLm5hdj0hMSx3YyhBZCx6ZSxcIm5hdlwiKSksUWQ9ZS5hbGxvd2Z1bGxzY3JlZW4sUWQ/KERlLnByZXBlbmRUbyhyZSksUmQ9S2MmJlwibmF0aXZlXCI9PT1RZCk6KERlLmRldGFjaCgpLFJkPSExKSxhKFNkLG9iKSxhKCFTZCxwYiksYSghZS5jYXB0aW9ucyx2YiksYShZZCx0YiksYShcImFsd2F5c1wiIT09ZS5hcnJvd3Msd2IpLFhkPWUuc2hhZG93cyYmIU1jLGEoIVhkLHJiKSxxZS5hZGRDbGFzcyhiLmFkZC5qb2luKFwiIFwiKSkucmVtb3ZlQ2xhc3MoYi5yZW1vdmUuam9pbihcIiBcIikpLEtlPWQuZXh0ZW5kKHt9LGUpfWZ1bmN0aW9uIHgoYSl7cmV0dXJuIDA+YT8oemQrYSV6ZCklemQ6YT49emQ/YSV6ZDphfWZ1bmN0aW9uIHkoYSl7cmV0dXJuIGgoYSwwLHpkLTEpfWZ1bmN0aW9uIHooYSl7cmV0dXJuIE1kP3goYSk6eShhKX1mdW5jdGlvbiBFKGEpe3JldHVybiBhPjB8fE1kP2EtMTohMX1mdW5jdGlvbiBVKGEpe3JldHVybiB6ZC0xPmF8fE1kP2ErMTohMX1mdW5jdGlvbiAkKCl7TWUubWluPU1kPy0xLzA6LXIoemQtMSxMZS53LGUubWFyZ2luLEZkKSxNZS5tYXg9TWQ/MS8wOi1yKDAsTGUudyxlLm1hcmdpbixGZCksTWUuc25hcD1MZS53K2UubWFyZ2lufWZ1bmN0aW9uIGJiKCl7T2UubWluPU1hdGgubWluKDAsTGUubnctemUud2lkdGgoKSksT2UubWF4PTAsemUudG9nZ2xlQ2xhc3MoQmIsIShPZS5ub01vdmU9T2UubWluPT09T2UubWF4KSl9ZnVuY3Rpb24gY2IoYSxiLGMpe2lmKFwibnVtYmVyXCI9PXR5cGVvZiBhKXthPW5ldyBBcnJheShhKTt2YXIgZT0hMH1yZXR1cm4gZC5lYWNoKGEsZnVuY3Rpb24oYSxkKXtpZihlJiYoZD1hKSxcIm51bWJlclwiPT10eXBlb2YgZCl7dmFyIGY9eWRbeChkKV07aWYoZil7dmFyIGc9XCIkXCIrYitcIkZyYW1lXCIsaD1mW2ddO2MuY2FsbCh0aGlzLGEsZCxmLGgsZyxoJiZoLmRhdGEoKSl9fX0pfWZ1bmN0aW9uIGZiKGEsYixjLGQpeyghJGR8fFwiKlwiPT09JGQmJmQ9PT1MZCkmJihhPXEoZS53aWR0aCl8fHEoYSl8fFZjLGI9cShlLmhlaWdodCl8fHEoYil8fFdjLGllLnJlc2l6ZSh7d2lkdGg6YSxyYXRpbzplLnJhdGlvfHxjfHxhL2J9LDAsZCE9PUxkJiZcIipcIikpfWZ1bmN0aW9uIFBiKGEsYixjLGYsZyxoKXtjYihhLGIsZnVuY3Rpb24oYSxpLGosayxsLG0pe2Z1bmN0aW9uIG4oYSl7dmFyIGI9eChpKTtmZChhLHtpbmRleDpiLHNyYzp3LGZyYW1lOnlkW2JdfSl9ZnVuY3Rpb24gbygpe3QucmVtb3ZlKCksZC5Gb3RvcmFtYS5jYWNoZVt3XT1cImVycm9yXCIsai5odG1sJiZcInN0YWdlXCI9PT1ifHwheXx8eT09PXc/KCF3fHxqLmh0bWx8fHI/XCJzdGFnZVwiPT09YiYmKGsudHJpZ2dlcihcImY6bG9hZFwiKS5yZW1vdmVDbGFzcyhhYytcIiBcIitfYikuYWRkQ2xhc3MoYmMpLG4oXCJsb2FkXCIpLGZiKCkpOihrLnRyaWdnZXIoXCJmOmVycm9yXCIpLnJlbW92ZUNsYXNzKGFjKS5hZGRDbGFzcyhfYiksbihcImVycm9yXCIpKSxtLnN0YXRlPVwiZXJyb3JcIiwhKHpkPjEmJnlkW2ldPT09ail8fGouaHRtbHx8ai5kZWxldGVkfHxqLnZpZGVvfHxyfHwoai5kZWxldGVkPSEwLGllLnNwbGljZShpLDEpKSk6KGpbdl09dz15LFBiKFtpXSxiLGMsZixnLCEwKSl9ZnVuY3Rpb24gcCgpe2QuRm90b3JhbWEubWVhc3VyZXNbd109dS5tZWFzdXJlcz1kLkZvdG9yYW1hLm1lYXN1cmVzW3ddfHx7d2lkdGg6cy53aWR0aCxoZWlnaHQ6cy5oZWlnaHQscmF0aW86cy53aWR0aC9zLmhlaWdodH0sZmIodS5tZWFzdXJlcy53aWR0aCx1Lm1lYXN1cmVzLmhlaWdodCx1Lm1lYXN1cmVzLnJhdGlvLGkpLHQub2ZmKFwibG9hZCBlcnJvclwiKS5hZGRDbGFzcyhmYysocj9cIiBcIitnYzpcIlwiKSkucHJlcGVuZFRvKGspLEkodCwoZC5pc0Z1bmN0aW9uKGMpP2MoKTpjKXx8TGUsZnx8ai5maXR8fGUuZml0LGd8fGoucG9zaXRpb258fGUucG9zaXRpb24pLGQuRm90b3JhbWEuY2FjaGVbd109bS5zdGF0ZT1cImxvYWRlZFwiLHNldFRpbWVvdXQoZnVuY3Rpb24oKXtrLnRyaWdnZXIoXCJmOmxvYWRcIikucmVtb3ZlQ2xhc3MoYWMrXCIgXCIrX2IpLmFkZENsYXNzKGJjK1wiIFwiKyhyP2NjOmRjKSksXCJzdGFnZVwiPT09Yj9uKFwibG9hZFwiKTooai50aHVtYnJhdGlvPT09JGN8fCFqLnRodW1icmF0aW8mJmUudGh1bWJyYXRpbz09PSRjKSYmKGoudGh1bWJyYXRpbz11Lm1lYXN1cmVzLnJhdGlvLHZkKCkpfSwwKX1mdW5jdGlvbiBxKCl7dmFyIGE9MTA7RyhmdW5jdGlvbigpe3JldHVybiFmZXx8IWEtLSYmIU1jfSxmdW5jdGlvbigpe3AoKX0pfWlmKGspe3ZhciByPWllLmZ1bGxTY3JlZW4mJmouZnVsbCYmai5mdWxsIT09ai5pbWcmJiFtLiRmdWxsJiZcInN0YWdlXCI9PT1iO2lmKCFtLiRpbWd8fGh8fHIpe3ZhciBzPW5ldyBJbWFnZSx0PWQocyksdT10LmRhdGEoKTttW3I/XCIkZnVsbFwiOlwiJGltZ1wiXT10O3ZhciB2PVwic3RhZ2VcIj09PWI/cj9cImZ1bGxcIjpcImltZ1wiOlwidGh1bWJcIix3PWpbdl0seT1yP251bGw6altcInN0YWdlXCI9PT1iP1widGh1bWJcIjpcImltZ1wiXTtpZihcIm5hdlRodW1iXCI9PT1iJiYoaz1tLiR3cmFwKSwhdylyZXR1cm4gdm9pZCBvKCk7ZC5Gb3RvcmFtYS5jYWNoZVt3XT8hZnVuY3Rpb24geigpe1wiZXJyb3JcIj09PWQuRm90b3JhbWEuY2FjaGVbd10/bygpOlwibG9hZGVkXCI9PT1kLkZvdG9yYW1hLmNhY2hlW3ddP3NldFRpbWVvdXQocSwwKTpzZXRUaW1lb3V0KHosMTAwKX0oKTooZC5Gb3RvcmFtYS5jYWNoZVt3XT1cIipcIix0Lm9uKFwibG9hZFwiLHEpLm9uKFwiZXJyb3JcIixvKSksbS5zdGF0ZT1cIlwiLHMuc3JjPXd9fX0pfWZ1bmN0aW9uIFFiKGEpe0llLmFwcGVuZChCZC5zcGluKCkuZWwpLmFwcGVuZFRvKGEpfWZ1bmN0aW9uIFJiKCl7SWUuZGV0YWNoKCksQmQmJkJkLnN0b3AoKX1mdW5jdGlvbiBTYigpe3ZhciBhPURkW1hjXTthJiYhYS5kYXRhKCkuc3RhdGUmJihRYihhKSxhLm9uKFwiZjpsb2FkIGY6ZXJyb3JcIixmdW5jdGlvbigpe2Eub2ZmKFwiZjpsb2FkIGY6ZXJyb3JcIiksUmIoKX0pKX1mdW5jdGlvbiBlYyhhKXtXKGEsc2QpLFgoYSxmdW5jdGlvbigpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXtRKHllKX0sMCksUmMoe3RpbWU6VmQsZ3Vlc3NJbmRleDpkKHRoaXMpLmRhdGEoKS5lcSxtaW5NYXg6T2V9KX0pfWZ1bmN0aW9uIGxjKGEsYil7Y2IoYSxiLGZ1bmN0aW9uKGEsYyxlLGYsZyxoKXtpZighZil7Zj1lW2ddPXFlW2ddLmNsb25lKCksaD1mLmRhdGEoKSxoLmRhdGE9ZTt2YXIgaT1mWzBdO1wic3RhZ2VcIj09PWI/KGUuaHRtbCYmZCgnPGRpdiBjbGFzcz1cIicra2MrJ1wiPjwvZGl2PicpLmFwcGVuZChlLl9odG1sP2QoZS5odG1sKS5yZW1vdmVBdHRyKFwiaWRcIikuaHRtbChlLl9odG1sKTplLmh0bWwpLmFwcGVuZFRvKGYpLGUuY2FwdGlvbiYmZChOKG9jLE4ocGMsZS5jYXB0aW9uKSkpLmFwcGVuZFRvKGYpLGUudmlkZW8mJmYuYWRkQ2xhc3MoemIpLmFwcGVuZChGZS5jbG9uZSgpKSxYKGksZnVuY3Rpb24oKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7UShyZSl9LDApLHBkKHtpbmRleDpoLmVxLHVzZXI6ITB9KX0pLHRlPXRlLmFkZChmKSk6XCJuYXZEb3RcIj09PWI/KGVjKGkpLEFlPUFlLmFkZChmKSk6XCJuYXZUaHVtYlwiPT09YiYmKGVjKGkpLGguJHdyYXA9Zi5jaGlsZHJlbihcIjpmaXJzdFwiKSxCZT1CZS5hZGQoZiksZS52aWRlbyYmaC4kd3JhcC5hcHBlbmQoRmUuY2xvbmUoKSkpfX0pfWZ1bmN0aW9uIHNjKGEsYixjLGQpe3JldHVybiBhJiZhLmxlbmd0aCYmSShhLGIsYyxkKX1mdW5jdGlvbiB0YyhhKXtjYihhLFwic3RhZ2VcIixmdW5jdGlvbihhLGIsYyxmLGcsaCl7aWYoZil7dmFyIGk9eChiKSxqPWMuZml0fHxlLmZpdCxrPWMucG9zaXRpb258fGUucG9zaXRpb247aC5lcT1pLFJlW1hjXVtpXT1mLmNzcyhkLmV4dGVuZCh7bGVmdDpTZD8wOnIoYixMZS53LGUubWFyZ2luLEZkKX0sU2QmJmwoMCkpKSxGKGZbMF0pJiYoZi5hcHBlbmRUbyhzZSksbWQoYy4kdmlkZW8pKSxzYyhoLiRpbWcsTGUsaixrKSxzYyhoLiRmdWxsLExlLGosayl9fSl9ZnVuY3Rpb24gdWMoYSxiKXtpZihcInRodW1ic1wiPT09TmQmJiFpc05hTihhKSl7dmFyIGM9LWEsZj0tYStMZS5udztCZS5lYWNoKGZ1bmN0aW9uKCl7dmFyIGE9ZCh0aGlzKSxnPWEuZGF0YSgpLGg9Zy5lcSxpPWZ1bmN0aW9uKCl7cmV0dXJue2g6VWQsdzpnLnd9fSxqPWkoKSxrPXlkW2hdfHx7fSxsPWsudGh1bWJmaXR8fGUudGh1bWJmaXQsbT1rLnRodW1icG9zaXRpb258fGUudGh1bWJwb3NpdGlvbjtqLnc9Zy53LGcubCtnLnc8Y3x8Zy5sPmZ8fHNjKGcuJGltZyxqLGwsbSl8fGImJlBiKFtoXSxcIm5hdlRodW1iXCIsaSxsLG0pfSl9fWZ1bmN0aW9uIHdjKGEsYixjKXtpZighd2NbY10pe3ZhciBmPVwibmF2XCI9PT1jJiZPZCxnPTA7Yi5hcHBlbmQoYS5maWx0ZXIoZnVuY3Rpb24oKXtmb3IodmFyIGEsYj1kKHRoaXMpLGM9Yi5kYXRhKCksZT0wLGY9eWQubGVuZ3RoO2Y+ZTtlKyspaWYoYy5kYXRhPT09eWRbZV0pe2E9ITAsYy5lcT1lO2JyZWFrfXJldHVybiBhfHxiLnJlbW92ZSgpJiYhMX0pLnNvcnQoZnVuY3Rpb24oYSxiKXtyZXR1cm4gZChhKS5kYXRhKCkuZXEtZChiKS5kYXRhKCkuZXF9KS5lYWNoKGZ1bmN0aW9uKCl7aWYoZil7dmFyIGE9ZCh0aGlzKSxiPWEuZGF0YSgpLGM9TWF0aC5yb3VuZChVZCpiLmRhdGEudGh1bWJyYXRpbyl8fFRkO2IubD1nLGIudz1jLGEuY3NzKHt3aWR0aDpjfSksZys9YytlLnRodW1ibWFyZ2lufX0pKSx3Y1tjXT0hMH19ZnVuY3Rpb24geGMoYSl7cmV0dXJuIGEtU2U+TGUudy8zfWZ1bmN0aW9uIHljKGEpe3JldHVybiEoTWR8fEplK2EmJkplLXpkK2F8fENkKX1mdW5jdGlvbiBHYygpe3ZhciBhPXljKDApLGI9eWMoMSk7dWUudG9nZ2xlQ2xhc3MoRWIsYSkuYXR0cihWKGEpKSx2ZS50b2dnbGVDbGFzcyhFYixiKS5hdHRyKFYoYikpfWZ1bmN0aW9uIEhjKCl7TmUub2smJihOZS5wcmV2ZW50PXtcIjxcIjp5YygwKSxcIj5cIjp5YygxKX0pfWZ1bmN0aW9uIExjKGEpe3ZhciBiLGMsZD1hLmRhdGEoKTtyZXR1cm4gT2Q/KGI9ZC5sLGM9ZC53KTooYj1hLnBvc2l0aW9uKCkubGVmdCxjPWEud2lkdGgoKSkse2M6YitjLzIsbWluOi1iKzEwKmUudGh1bWJtYXJnaW4sbWF4Oi1iK0xlLnctYy0xMCplLnRodW1ibWFyZ2lufX1mdW5jdGlvbiBPYyhhKXt2YXIgYj1EZFtoZV0uZGF0YSgpO18oQ2Use3RpbWU6MS4yKmEscG9zOmIubCx3aWR0aDpiLnctMiplLnRodW1iYm9yZGVyd2lkdGh9KX1mdW5jdGlvbiBSYyhhKXt2YXIgYj15ZFthLmd1ZXNzSW5kZXhdW2hlXTtpZihiKXt2YXIgYz1PZS5taW4hPT1PZS5tYXgsZD1hLm1pbk1heHx8YyYmTGMoRGRbaGVdKSxlPWMmJihhLmtlZXAmJlJjLmw/UmMubDpoKChhLmNvb3x8TGUubncvMiktTGMoYikuYyxkLm1pbixkLm1heCkpLGY9YyYmaChlLE9lLm1pbixPZS5tYXgpLGc9MS4xKmEudGltZTtfKHplLHt0aW1lOmcscG9zOmZ8fDAsb25FbmQ6ZnVuY3Rpb24oKXt1YyhmLCEwKX19KSxsZCh5ZSxLKGYsT2UubWluLE9lLm1heCkpLFJjLmw9ZX19ZnVuY3Rpb24gVGMoKXtfYyhoZSksUWVbaGVdLnB1c2goRGRbaGVdLmFkZENsYXNzKFdiKSl9ZnVuY3Rpb24gX2MoYSl7Zm9yKHZhciBiPVFlW2FdO2IubGVuZ3RoOyliLnNoaWZ0KCkucmVtb3ZlQ2xhc3MoV2IpfWZ1bmN0aW9uIGJkKGEpe3ZhciBiPVJlW2FdO2QuZWFjaChFZCxmdW5jdGlvbihhLGMpe2RlbGV0ZSBiW3goYyldfSksZC5lYWNoKGIsZnVuY3Rpb24oYSxjKXtkZWxldGUgYlthXSxjLmRldGFjaCgpfSl9ZnVuY3Rpb24gY2QoYSl7RmQ9R2Q9SmU7dmFyIGI9RGRbWGNdO2ImJihfYyhYYyksUWVbWGNdLnB1c2goYi5hZGRDbGFzcyhXYikpLGF8fGllLnNob3cub25FbmQoITApLHYoc2UsMCwhMCksYmQoWGMpLHRjKEVkKSwkKCksYmIoKSl9ZnVuY3Rpb24gZWQoYSxiKXthJiZkLmVhY2goYixmdW5jdGlvbihiLGMpe2MmJmQuZXh0ZW5kKGMse3dpZHRoOmEud2lkdGh8fGMud2lkdGgsaGVpZ2h0OmEuaGVpZ2h0LG1pbndpZHRoOmEubWlud2lkdGgsbWF4d2lkdGg6YS5tYXh3aWR0aCxtaW5oZWlnaHQ6YS5taW5oZWlnaHQsbWF4aGVpZ2h0OmEubWF4aGVpZ2h0LHJhdGlvOlMoYS5yYXRpbyl9KX0pfWZ1bmN0aW9uIGZkKGIsYyl7YS50cmlnZ2VyKGliK1wiOlwiK2IsW2llLGNdKX1mdW5jdGlvbiBnZCgpe2NsZWFyVGltZW91dChoZC50KSxmZT0xLGUuc3RvcGF1dG9wbGF5b250b3VjaD9pZS5zdG9wQXV0b3BsYXkoKTpjZT0hMH1mdW5jdGlvbiBoZCgpe2ZlJiYoZS5zdG9wYXV0b3BsYXlvbnRvdWNofHwoaWQoKSxqZCgpKSxoZC50PXNldFRpbWVvdXQoZnVuY3Rpb24oKXtmZT0wfSxRYytQYykpfWZ1bmN0aW9uIGlkKCl7Y2U9ISghQ2QmJiFkZSl9ZnVuY3Rpb24gamQoKXtpZihjbGVhclRpbWVvdXQoamQudCksRy5zdG9wKGpkLncpLCFlLmF1dG9wbGF5fHxjZSlyZXR1cm4gdm9pZChpZS5hdXRvcGxheSYmKGllLmF1dG9wbGF5PSExLGZkKFwic3RvcGF1dG9wbGF5XCIpKSk7aWUuYXV0b3BsYXl8fChpZS5hdXRvcGxheT0hMCxmZChcInN0YXJ0YXV0b3BsYXlcIikpO3ZhciBhPUplLGI9RGRbWGNdLmRhdGEoKTtqZC53PUcoZnVuY3Rpb24oKXtyZXR1cm4gYi5zdGF0ZXx8YSE9PUplfSxmdW5jdGlvbigpe2pkLnQ9c2V0VGltZW91dChmdW5jdGlvbigpe2lmKCFjZSYmYT09PUplKXt2YXIgYj1LZCxjPXlkW2JdW1hjXS5kYXRhKCk7amQudz1HKGZ1bmN0aW9uKCl7cmV0dXJuIGMuc3RhdGV8fGIhPT1LZH0sZnVuY3Rpb24oKXtjZXx8YiE9PUtkfHxpZS5zaG93KE1kP1ooIVlkKTpLZCl9KX19LGUuYXV0b3BsYXkpfSl9ZnVuY3Rpb24ga2QoKXtpZS5mdWxsU2NyZWVuJiYoaWUuZnVsbFNjcmVlbj0hMSxLYyYmdmMuY2FuY2VsKGxlKSxEYy5yZW1vdmVDbGFzcyhqYiksQ2MucmVtb3ZlQ2xhc3MoamIpLGEucmVtb3ZlQ2xhc3MoWmIpLmluc2VydEFmdGVyKHBlKSxMZT1kLmV4dGVuZCh7fSxlZSksbWQoQ2QsITAsITApLHJkKFwieFwiLCExKSxpZS5yZXNpemUoKSxQYihFZCxcInN0YWdlXCIpLFEoRWMsYWUsX2QpLGZkKFwiZnVsbHNjcmVlbmV4aXRcIikpfWZ1bmN0aW9uIGxkKGEsYil7WGQmJihhLnJlbW92ZUNsYXNzKFViK1wiIFwiK1ZiKSxiJiYhQ2QmJmEuYWRkQ2xhc3MoYi5yZXBsYWNlKC9efFxccy9nLFwiIFwiK1RiK1wiLS1cIikpKX1mdW5jdGlvbiBtZChhLGIsYyl7YiYmKHFlLnJlbW92ZUNsYXNzKG5iKSxDZD0hMSxvKCkpLGEmJmEhPT1DZCYmKGEucmVtb3ZlKCksZmQoXCJ1bmxvYWR2aWRlb1wiKSksYyYmKGlkKCksamQoKSl9ZnVuY3Rpb24gbmQoYSl7cWUudG9nZ2xlQ2xhc3MocWIsYSl9ZnVuY3Rpb24gb2QoYSl7aWYoIU1lLmZsb3cpe3ZhciBiPWE/YS5wYWdlWDpvZC54LGM9YiYmIXljKHhjKGIpKSYmZS5jbGljaztvZC5wIT09YyYmcmUudG9nZ2xlQ2xhc3MoQ2IsYykmJihvZC5wPWMsb2QueD1iKX19ZnVuY3Rpb24gcGQoYSl7Y2xlYXJUaW1lb3V0KHBkLnQpLGUuY2xpY2t0cmFuc2l0aW9uJiZlLmNsaWNrdHJhbnNpdGlvbiE9PWUudHJhbnNpdGlvbj9zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dmFyIGI9ZS50cmFuc2l0aW9uO2llLnNldE9wdGlvbnMoe3RyYW5zaXRpb246ZS5jbGlja3RyYW5zaXRpb259KSxXZD1iLHBkLnQ9c2V0VGltZW91dChmdW5jdGlvbigpe2llLnNob3coYSl9LDEwKX0sMCk6aWUuc2hvdyhhKX1mdW5jdGlvbiBxZChhLGIpe3ZhciBjPWEudGFyZ2V0LGY9ZChjKTtmLmhhc0NsYXNzKG1jKT9pZS5wbGF5VmlkZW8oKTpjPT09RWU/aWUudG9nZ2xlRnVsbFNjcmVlbigpOkNkP2M9PT1IZSYmbWQoQ2QsITAsITApOmI/bmQoKTplLmNsaWNrJiZwZCh7aW5kZXg6YS5zaGlmdEtleXx8Wih4YyhhLl94KSksc2xvdzphLmFsdEtleSx1c2VyOiEwfSl9ZnVuY3Rpb24gcmQoYSxiKXtNZVthXT1PZVthXT1ifWZ1bmN0aW9uIHNkKGEpe3ZhciBiPWQodGhpcykuZGF0YSgpLmVxO3BkKHtpbmRleDpiLHNsb3c6YS5hbHRLZXksdXNlcjohMCxjb286YS5feC15ZS5vZmZzZXQoKS5sZWZ0fSl9ZnVuY3Rpb24gdGQoYSl7cGQoe2luZGV4OndlLmluZGV4KHRoaXMpP1wiPlwiOlwiPFwiLHNsb3c6YS5hbHRLZXksdXNlcjohMH0pfWZ1bmN0aW9uIHVkKGEpe1goYSxmdW5jdGlvbigpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXtRKHJlKX0sMCksbmQoITEpfSl9ZnVuY3Rpb24gdmQoKXtpZihtKCksdSgpLCF2ZC5pKXt2ZC5pPSEwO3ZhciBhPWUuc3RhcnRpbmRleDsoYXx8ZS5oYXNoJiZjLmhhc2gpJiYoTGQ9TChhfHxjLmhhc2gucmVwbGFjZSgvXiMvLFwiXCIpLHlkLDA9PT1pZS5pbmRleHx8YSxhKSksSmU9RmQ9R2Q9SGQ9TGQ9eihMZCl8fDB9aWYoemQpe2lmKHdkKCkpcmV0dXJuO0NkJiZtZChDZCwhMCksRWQ9W10sYmQoWGMpLHZkLm9rPSEwLGllLnNob3coe2luZGV4OkplLHRpbWU6MH0pLGllLnJlc2l6ZSgpfWVsc2UgaWUuZGVzdHJveSgpfWZ1bmN0aW9uIHdkKCl7cmV0dXJuIXdkLmY9PT1ZZD8od2QuZj1ZZCxKZT16ZC0xLUplLGllLnJldmVyc2UoKSwhMCk6dm9pZCAwfWZ1bmN0aW9uIHhkKCl7eGQub2t8fCh4ZC5vaz0hMCxmZChcInJlYWR5XCIpKX1DYz1kKFwiaHRtbFwiKSxEYz1kKFwiYm9keVwiKTt2YXIgeWQsemQsQWQsQmQsQ2QsRGQsRWQsRmQsR2QsSGQsSWQsSmQsS2QsTGQsTWQsTmQsT2QsUGQsUWQsUmQsU2QsVGQsVWQsVmQsV2QsWGQsWWQsWmQsJGQsX2QsYWUsYmUsY2UsZGUsZWUsZmUsZ2UsaGUsaWU9dGhpcyxqZT1kLm5vdygpLGtlPWliK2plLGxlPWFbMF0sbWU9MSxuZT1hLmRhdGEoKSxvZT1kKFwiPHN0eWxlPjwvc3R5bGU+XCIpLHBlPWQoTihZYikpLHFlPWQoTihrYikpLHJlPWQoTih4YikpLmFwcGVuZFRvKHFlKSxzZT0ocmVbMF0sZChOKEFiKSkuYXBwZW5kVG8ocmUpKSx0ZT1kKCksdWU9ZChOKERiK1wiIFwiK0ZiK3JjKSksdmU9ZChOKERiK1wiIFwiK0diK3JjKSksd2U9dWUuYWRkKHZlKS5hcHBlbmRUbyhyZSkseGU9ZChOKEliKSkseWU9ZChOKEhiKSkuYXBwZW5kVG8oeGUpLHplPWQoTihKYikpLmFwcGVuZFRvKHllKSxBZT1kKCksQmU9ZCgpLENlPShzZS5kYXRhKCksemUuZGF0YSgpLGQoTihqYykpLmFwcGVuZFRvKHplKSksRGU9ZChOKCRiK3JjKSksRWU9RGVbMF0sRmU9ZChOKG1jKSksR2U9ZChOKG5jKSkuYXBwZW5kVG8ocmUpLEhlPUdlWzBdLEllPWQoTihxYykpLEplPSExLEtlPXt9LExlPXt9LE1lPXt9LE5lPXt9LE9lPXt9LFBlPXt9LFFlPXt9LFJlPXt9LFNlPTAsVGU9W107XHJcbnFlW1hjXT1kKE4oeWIpKSxxZVtaY109ZChOKE1iK1wiIFwiK09iK3JjLE4oaWMpKSkscWVbWWNdPWQoTihNYitcIiBcIitOYityYyxOKGhjKSkpLFFlW1hjXT1bXSxRZVtaY109W10sUWVbWWNdPVtdLFJlW1hjXT17fSxxZS5hZGRDbGFzcyhJYz9tYjpsYikudG9nZ2xlQ2xhc3MocWIsIWUuY29udHJvbHNvbnN0YXJ0KSxuZS5mb3RvcmFtYT10aGlzLGllLnN0YXJ0QXV0b3BsYXk9ZnVuY3Rpb24oYSl7cmV0dXJuIGllLmF1dG9wbGF5P3RoaXM6KGNlPWRlPSExLHQoYXx8ZS5hdXRvcGxheSksamQoKSx0aGlzKX0saWUuc3RvcEF1dG9wbGF5PWZ1bmN0aW9uKCl7cmV0dXJuIGllLmF1dG9wbGF5JiYoY2U9ZGU9ITAsamQoKSksdGhpc30saWUuc2hvdz1mdW5jdGlvbihhKXt2YXIgYjtcIm9iamVjdFwiIT10eXBlb2YgYT8oYj1hLGE9e30pOmI9YS5pbmRleCxiPVwiPlwiPT09Yj9HZCsxOlwiPFwiPT09Yj9HZC0xOlwiPDxcIj09PWI/MDpcIj4+XCI9PT1iP3pkLTE6YixiPWlzTmFOKGIpP0woYix5ZCwhMCk6YixiPVwidW5kZWZpbmVkXCI9PXR5cGVvZiBiP0plfHwwOmIsaWUuYWN0aXZlSW5kZXg9SmU9eihiKSxJZD1FKEplKSxKZD1VKEplKSxLZD14KEplKyhZZD8tMToxKSksRWQ9W0plLElkLEpkXSxHZD1NZD9iOkplO3ZhciBjPU1hdGguYWJzKEhkLUdkKSxkPXcoYS50aW1lLGZ1bmN0aW9uKCl7cmV0dXJuIE1hdGgubWluKFZkKigxKyhjLTEpLzEyKSwyKlZkKX0pLGY9YS5vdmVyUG9zO2Euc2xvdyYmKGQqPTEwKTt2YXIgZz1EZDtpZS5hY3RpdmVGcmFtZT1EZD15ZFtKZV07dmFyIGk9Zz09PURkJiYhYS51c2VyO21kKENkLERkLmkhPT15ZFt4KEZkKV0uaSksbGMoRWQsXCJzdGFnZVwiKSx0YyhNYz9bR2RdOltHZCxFKEdkKSxVKEdkKV0pLHJkKFwiZ29cIiwhMCksaXx8ZmQoXCJzaG93XCIse3VzZXI6YS51c2VyLHRpbWU6ZH0pLGNlPSEwO3ZhciBqPWllLnNob3cub25FbmQ9ZnVuY3Rpb24oYil7aWYoIWoub2spe2lmKGoub2s9ITAsYnx8Y2QoITApLGl8fGZkKFwic2hvd2VuZFwiLHt1c2VyOmEudXNlcn0pLCFiJiZXZCYmV2QhPT1lLnRyYW5zaXRpb24pcmV0dXJuIGllLnNldE9wdGlvbnMoe3RyYW5zaXRpb246V2R9KSx2b2lkKFdkPSExKTtTYigpLFBiKEVkLFwic3RhZ2VcIikscmQoXCJnb1wiLCExKSxIYygpLG9kKCksaWQoKSxqZCgpfX07aWYoU2Qpe3ZhciBrPURkW1hjXSxsPUplIT09SGQ/eWRbSGRdW1hjXTpudWxsO2FiKGssbCx0ZSx7dGltZTpkLG1ldGhvZDplLnRyYW5zaXRpb24sb25FbmQ6an0sVGUpfWVsc2UgXyhzZSx7cG9zOi1yKEdkLExlLncsZS5tYXJnaW4sRmQpLG92ZXJQb3M6Zix0aW1lOmQsb25FbmQ6an0pO2lmKEdjKCksTmQpe1RjKCk7dmFyIG09eShKZStoKEdkLUhkLC0xLDEpKTtSYyh7dGltZTpkLGNvbzptIT09SmUmJmEuY29vLGd1ZXNzSW5kZXg6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGEuY29vP206SmUsa2VlcDppfSksT2QmJk9jKGQpfXJldHVybiBiZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgSGQmJkhkIT09SmUsSGQ9SmUsZS5oYXNoJiZiZSYmIWllLmVxJiZIKERkLmlkfHxKZSsxKSx0aGlzfSxpZS5yZXF1ZXN0RnVsbFNjcmVlbj1mdW5jdGlvbigpe3JldHVybiBRZCYmIWllLmZ1bGxTY3JlZW4mJihfZD1FYy5zY3JvbGxUb3AoKSxhZT1FYy5zY3JvbGxMZWZ0KCksUShFYykscmQoXCJ4XCIsITApLGVlPWQuZXh0ZW5kKHt9LExlKSxhLmFkZENsYXNzKFpiKS5hcHBlbmRUbyhEYy5hZGRDbGFzcyhqYikpLENjLmFkZENsYXNzKGpiKSxtZChDZCwhMCwhMCksaWUuZnVsbFNjcmVlbj0hMCxSZCYmdmMucmVxdWVzdChsZSksaWUucmVzaXplKCksUGIoRWQsXCJzdGFnZVwiKSxTYigpLGZkKFwiZnVsbHNjcmVlbmVudGVyXCIpKSx0aGlzfSxpZS5jYW5jZWxGdWxsU2NyZWVuPWZ1bmN0aW9uKCl7cmV0dXJuIFJkJiZ2Yy5pcygpP3ZjLmNhbmNlbChiKTprZCgpLHRoaXN9LGllLnRvZ2dsZUZ1bGxTY3JlZW49ZnVuY3Rpb24oKXtyZXR1cm4gaWVbKGllLmZ1bGxTY3JlZW4/XCJjYW5jZWxcIjpcInJlcXVlc3RcIikrXCJGdWxsU2NyZWVuXCJdKCl9LFQoYix2Yy5ldmVudCxmdW5jdGlvbigpeyF5ZHx8dmMuaXMoKXx8Q2R8fGtkKCl9KSxpZS5yZXNpemU9ZnVuY3Rpb24oYSl7aWYoIXlkKXJldHVybiB0aGlzO3ZhciBiPWFyZ3VtZW50c1sxXXx8MCxjPWFyZ3VtZW50c1syXTtlZChpZS5mdWxsU2NyZWVuP3t3aWR0aDpcIjEwMCVcIixtYXh3aWR0aDpudWxsLG1pbndpZHRoOm51bGwsaGVpZ2h0OlwiMTAwJVwiLG1heGhlaWdodDpudWxsLG1pbmhlaWdodDpudWxsfTpSKGEpLFtMZSxjfHxpZS5mdWxsU2NyZWVufHxlXSk7dmFyIGQ9TGUud2lkdGgsZj1MZS5oZWlnaHQsZz1MZS5yYXRpbyxpPUVjLmhlaWdodCgpLShOZD95ZS5oZWlnaHQoKTowKTtyZXR1cm4gcShkKSYmKHFlLmFkZENsYXNzKHViKS5jc3Moe3dpZHRoOmQsbWluV2lkdGg6TGUubWlud2lkdGh8fDAsbWF4V2lkdGg6TGUubWF4d2lkdGh8fGFkfSksZD1MZS5XPUxlLnc9cWUud2lkdGgoKSxMZS5udz1OZCYmcChlLm5hdndpZHRoLGQpfHxkLGUuZ2xpbXBzZSYmKExlLnctPU1hdGgucm91bmQoMioocChlLmdsaW1wc2UsZCl8fDApKSksc2UuY3NzKHt3aWR0aDpMZS53LG1hcmdpbkxlZnQ6KExlLlctTGUudykvMn0pLGY9cChmLGkpLGY9Znx8ZyYmZC9nLGYmJihkPU1hdGgucm91bmQoZCksZj1MZS5oPU1hdGgucm91bmQoaChmLHAoTGUubWluaGVpZ2h0LGkpLHAoTGUubWF4aGVpZ2h0LGkpKSkscmUuc3RvcCgpLmFuaW1hdGUoe3dpZHRoOmQsaGVpZ2h0OmZ9LGIsZnVuY3Rpb24oKXtxZS5yZW1vdmVDbGFzcyh1Yil9KSxjZCgpLE5kJiYoeWUuc3RvcCgpLmFuaW1hdGUoe3dpZHRoOkxlLm53fSxiKSxSYyh7Z3Vlc3NJbmRleDpKZSx0aW1lOmIsa2VlcDohMH0pLE9kJiZ3Yy5uYXYmJk9jKGIpKSwkZD1jfHwhMCx4ZCgpKSksU2U9cmUub2Zmc2V0KCkubGVmdCx0aGlzfSxpZS5zZXRPcHRpb25zPWZ1bmN0aW9uKGEpe3JldHVybiBkLmV4dGVuZChlLGEpLHZkKCksdGhpc30saWUuc2h1ZmZsZT1mdW5jdGlvbigpe3JldHVybiB5ZCYmTyh5ZCkmJnZkKCksdGhpc30saWUuZGVzdHJveT1mdW5jdGlvbigpe3JldHVybiBpZS5jYW5jZWxGdWxsU2NyZWVuKCksaWUuc3RvcEF1dG9wbGF5KCkseWQ9aWUuZGF0YT1udWxsLGooKSxFZD1bXSxiZChYYyksdmQub2s9ITEsdGhpc30saWUucGxheVZpZGVvPWZ1bmN0aW9uKCl7dmFyIGE9RGQsYj1hLnZpZGVvLGM9SmU7cmV0dXJuXCJvYmplY3RcIj09dHlwZW9mIGImJmEudmlkZW9SZWFkeSYmKFJkJiZpZS5mdWxsU2NyZWVuJiZpZS5jYW5jZWxGdWxsU2NyZWVuKCksRyhmdW5jdGlvbigpe3JldHVybiF2Yy5pcygpfHxjIT09SmV9LGZ1bmN0aW9uKCl7Yz09PUplJiYoYS4kdmlkZW89YS4kdmlkZW98fGQoZC5Gb3RvcmFtYS5qc3QudmlkZW8oYikpLGEuJHZpZGVvLmFwcGVuZFRvKGFbWGNdKSxxZS5hZGRDbGFzcyhuYiksQ2Q9YS4kdmlkZW8sbygpLHdlLmJsdXIoKSxEZS5ibHVyKCksZmQoXCJsb2FkdmlkZW9cIikpfSkpLHRoaXN9LGllLnN0b3BWaWRlbz1mdW5jdGlvbigpe3JldHVybiBtZChDZCwhMCwhMCksdGhpc30scmUub24oXCJtb3VzZW1vdmVcIixvZCksTWU9ZGIoc2Use29uU3RhcnQ6Z2Qsb25Nb3ZlOmZ1bmN0aW9uKGEsYil7bGQocmUsYi5lZGdlKX0sb25Ub3VjaEVuZDpoZCxvbkVuZDpmdW5jdGlvbihhKXtsZChyZSk7dmFyIGI9KE5jJiYhZ2V8fGEudG91Y2gpJiZlLmFycm93cyYmXCJhbHdheXNcIiE9PWUuYXJyb3dzO2lmKGEubW92ZWR8fGImJmEucG9zIT09YS5uZXdQb3MmJiFhLmNvbnRyb2wpe3ZhciBjPXMoYS5uZXdQb3MsTGUudyxlLm1hcmdpbixGZCk7aWUuc2hvdyh7aW5kZXg6Yyx0aW1lOlNkP1ZkOmEudGltZSxvdmVyUG9zOmEub3ZlclBvcyx1c2VyOiEwfSl9ZWxzZSBhLmFib3J0ZWR8fGEuY29udHJvbHx8cWQoYS5zdGFydEV2ZW50LGIpfSx0aW1lTG93OjEsdGltZUhpZ2g6MSxmcmljdGlvbjoyLHNlbGVjdDpcIi5cIitYYitcIiwgLlwiK1hiK1wiICpcIiwkd3JhcDpyZX0pLE9lPWRiKHplLHtvblN0YXJ0OmdkLG9uTW92ZTpmdW5jdGlvbihhLGIpe2xkKHllLGIuZWRnZSl9LG9uVG91Y2hFbmQ6aGQsb25FbmQ6ZnVuY3Rpb24oYSl7ZnVuY3Rpb24gYigpe1JjLmw9YS5uZXdQb3MsaWQoKSxqZCgpLHVjKGEubmV3UG9zLCEwKX1pZihhLm1vdmVkKWEucG9zIT09YS5uZXdQb3M/KGNlPSEwLF8oemUse3RpbWU6YS50aW1lLHBvczphLm5ld1BvcyxvdmVyUG9zOmEub3ZlclBvcyxvbkVuZDpifSksdWMoYS5uZXdQb3MpLFhkJiZsZCh5ZSxLKGEubmV3UG9zLE9lLm1pbixPZS5tYXgpKSk6YigpO2Vsc2V7dmFyIGM9YS4kdGFyZ2V0LmNsb3Nlc3QoXCIuXCIrTWIsemUpWzBdO2MmJnNkLmNhbGwoYyxhLnN0YXJ0RXZlbnQpfX0sdGltZUxvdzouNSx0aW1lSGlnaDoyLGZyaWN0aW9uOjUsJHdyYXA6eWV9KSxOZT1lYihyZSx7c2hpZnQ6ITAsb25FbmQ6ZnVuY3Rpb24oYSxiKXtnZCgpLGhkKCksaWUuc2hvdyh7aW5kZXg6YixzbG93OmEuYWx0S2V5fSl9fSksUGU9ZWIoeWUse29uRW5kOmZ1bmN0aW9uKGEsYil7Z2QoKSxoZCgpO3ZhciBjPXYoemUpKy4yNSpiO3plLmNzcyhrKGgoYyxPZS5taW4sT2UubWF4KSkpLFhkJiZsZCh5ZSxLKGMsT2UubWluLE9lLm1heCkpLFBlLnByZXZlbnQ9e1wiPFwiOmM+PU9lLm1heCxcIj5cIjpjPD1PZS5taW59LGNsZWFyVGltZW91dChQZS50KSxQZS50PXNldFRpbWVvdXQoZnVuY3Rpb24oKXtSYy5sPWMsdWMoYywhMCl9LFBjKSx1YyhjKX19KSxxZS5ob3ZlcihmdW5jdGlvbigpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXtmZXx8bmQoIShnZT0hMCkpfSwwKX0sZnVuY3Rpb24oKXtnZSYmbmQoIShnZT0hMSkpfSksTSh3ZSxmdW5jdGlvbihhKXtZKGEpLHRkLmNhbGwodGhpcyxhKX0se29uU3RhcnQ6ZnVuY3Rpb24oKXtnZCgpLE1lLmNvbnRyb2w9ITB9LG9uVG91Y2hFbmQ6aGR9KSx3ZS5lYWNoKGZ1bmN0aW9uKCl7Vyh0aGlzLGZ1bmN0aW9uKGEpe3RkLmNhbGwodGhpcyxhKX0pLHVkKHRoaXMpfSksVyhFZSxpZS50b2dnbGVGdWxsU2NyZWVuKSx1ZChFZSksZC5lYWNoKFwibG9hZCBwdXNoIHBvcCBzaGlmdCB1bnNoaWZ0IHJldmVyc2Ugc29ydCBzcGxpY2VcIi5zcGxpdChcIiBcIiksZnVuY3Rpb24oYSxiKXtpZVtiXT1mdW5jdGlvbigpe3JldHVybiB5ZD15ZHx8W10sXCJsb2FkXCIhPT1iP0FycmF5LnByb3RvdHlwZVtiXS5hcHBseSh5ZCxhcmd1bWVudHMpOmFyZ3VtZW50c1swXSYmXCJvYmplY3RcIj09dHlwZW9mIGFyZ3VtZW50c1swXSYmYXJndW1lbnRzWzBdLmxlbmd0aCYmKHlkPVAoYXJndW1lbnRzWzBdKSksdmQoKSxpZX19KSx2ZCgpfSxkLmZuLmZvdG9yYW1hPWZ1bmN0aW9uKGIpe3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgYz10aGlzLGU9ZCh0aGlzKSxmPWUuZGF0YSgpLGc9Zi5mb3RvcmFtYTtnP2cuc2V0T3B0aW9ucyhiLCEwKTpHKGZ1bmN0aW9uKCl7cmV0dXJuIUUoYyl9LGZ1bmN0aW9uKCl7Zi51cnRleHQ9ZS5odG1sKCksbmV3IGQuRm90b3JhbWEoZSxkLmV4dGVuZCh7fSxjZCxhLmZvdG9yYW1hRGVmYXVsdHMsYixmKSl9KX0pfSxkLkZvdG9yYW1hLmluc3RhbmNlcz1bXSxkLkZvdG9yYW1hLmNhY2hlPXt9LGQuRm90b3JhbWEubWVhc3VyZXM9e30sZD1kfHx7fSxkLkZvdG9yYW1hPWQuRm90b3JhbWF8fHt9LGQuRm90b3JhbWEuanN0PWQuRm90b3JhbWEuanN0fHx7fSxkLkZvdG9yYW1hLmpzdC5zdHlsZT1mdW5jdGlvbihhKXt7dmFyIGIsYz1cIlwiO3RjLmVzY2FwZX1yZXR1cm4gYys9XCIuZm90b3JhbWFcIisobnVsbD09KGI9YS5zKT9cIlwiOmIpK1wiIC5mb3RvcmFtYV9fbmF2LS10aHVtYnMgLmZvdG9yYW1hX19uYXZfX2ZyYW1le1xcbnBhZGRpbmc6XCIrKG51bGw9PShiPWEubSk/XCJcIjpiKStcInB4O1xcbmhlaWdodDpcIisobnVsbD09KGI9YS5oKT9cIlwiOmIpK1wicHh9XFxuLmZvdG9yYW1hXCIrKG51bGw9PShiPWEucyk/XCJcIjpiKStcIiAuZm90b3JhbWFfX3RodW1iLWJvcmRlcntcXG5oZWlnaHQ6XCIrKG51bGw9PShiPWEuaC1hLmIqKGEucT8wOjIpKT9cIlwiOmIpK1wicHg7XFxuYm9yZGVyLXdpZHRoOlwiKyhudWxsPT0oYj1hLmIpP1wiXCI6YikrXCJweDtcXG5tYXJnaW4tdG9wOlwiKyhudWxsPT0oYj1hLm0pP1wiXCI6YikrXCJweH1cIn0sZC5Gb3RvcmFtYS5qc3QudmlkZW89ZnVuY3Rpb24oYSl7ZnVuY3Rpb24gYigpe2MrPWQuY2FsbChhcmd1bWVudHMsXCJcIil9dmFyIGM9XCJcIixkPSh0Yy5lc2NhcGUsQXJyYXkucHJvdG90eXBlLmpvaW4pO3JldHVybiBjKz0nPGRpdiBjbGFzcz1cImZvdG9yYW1hX192aWRlb1wiPjxpZnJhbWUgc3JjPVwiJyxiKChcInlvdXR1YmVcIj09YS50eXBlP2EucCtcInlvdXR1YmUuY29tL2VtYmVkL1wiK2EuaWQrXCI/YXV0b3BsYXk9MVwiOlwidmltZW9cIj09YS50eXBlP2EucCtcInBsYXllci52aW1lby5jb20vdmlkZW8vXCIrYS5pZCtcIj9hdXRvcGxheT0xJmJhZGdlPTBcIjphLmlkKSsoYS5zJiZcImN1c3RvbVwiIT1hLnR5cGU/XCImXCIrYS5zOlwiXCIpKSxjKz0nXCIgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3dmdWxsc2NyZWVuPjwvaWZyYW1lPjwvZGl2Plxcbid9LGQoZnVuY3Rpb24oKXtkKFwiLlwiK2liKyc6bm90KFtkYXRhLWF1dG89XCJmYWxzZVwiXSknKS5mb3RvcmFtYSgpfSl9KHdpbmRvdyxkb2N1bWVudCxsb2NhdGlvbixcInVuZGVmaW5lZFwiIT10eXBlb2YgalF1ZXJ5JiZqUXVlcnkpO1xyXG5cclxudmFyIG1heEhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuXHJcbiQoJy5mb3RvcmFtYScpLmZvdG9yYW1hKHtcclxuICB3aWR0aDogJzEwMCUnLFxyXG4gIG1heHdpZHRoOiAnMTAwJScsXHJcbiAgcmF0aW86IDE2LzksXHJcbiAgYWxsb3dmdWxsc2NyZWVuOiB0cnVlLFxyXG4gIG1heGhlaWdodDogbWF4SGVpZ2h0XHJcbn0pO1xyXG5cclxuJCgnLm93bC1jYXJvdXNlbCcpLm93bENhcm91c2VsKHtcclxuICAgIG5hdjp0cnVlLFxyXG4gICAgcmVzcG9uc2l2ZTp7XHJcbiAgICAgICAgMDp7XHJcbiAgICAgICAgICAgIGl0ZW1zOjFcclxuICAgICAgICB9LFxyXG4gICAgICAgIDYwMDp7XHJcbiAgICAgICAgICAgIGl0ZW1zOjNcclxuICAgICAgICB9LFxyXG4gICAgICAgIDEwMDA6e1xyXG4gICAgICAgICAgICBpdGVtczo1XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbiQoJyNvcmRlck1vZGFsJykub24oJ3Nob3duLmJzLm1vZGFsJywgZnVuY3Rpb24gKCkge1xyXG4gICQoJyNvcmRlck5hbWUnKS5mb2N1cygpXHJcbn0pIl0sImZpbGUiOiJtYWluLmpzIn0=
