/**
 * jQuery plugin for FileAPI v2+
 * @auhtor	RubaXa	<trash@rubaxa.org>
 */


/*global jQuery, FileAPI*/
(function ($, api){
	var
		  noop = $.noop
		, oldJQ = !$.fn.prop
		, propFn = oldJQ ? 'attr' : 'prop'
		, removePropFn = oldJQ ? 'removeAttr' : 'prop'
	;



	var Plugin = function (el, options){
		this.$el = el = $(el).on('change.fileapi', $.proxy(this, '_onSelect'));
		this.el  = el[0];

		this._options = {}; // previous options
		this.options  = options = $.extend({
			url: 0,
			data: {}, // additional POST-data
			accept: 0, // accept mime types, "*" — unlimited
			postName: 0, // files POST-name
			multiple: 0,
			dataType: 'json',

			maxSize: 0, // max file size, 0 — unlimited

			sortFn: 0,
			autoUpload: true,

			elements: {
				button: {
					browse: 0,
					abort: 0
				},
				empty: {
					mod: 0,
					show: 0,
					hide: 0,
					disabled: 0
				},
				notEmpty: {
					/* also as: empty */
				},
				active: {
					/* also as: empty */
				},
				progress: 0,
				dropZone: {
					el: 0,
					hover: 0
				}
			},

			onDrop: noop,
			onDropHover: noop,

			onSelect: noop,

			onUpload: noop,
			onProgress: noop,
			onComplete: noop,

			onFileUpload: noop,
			onFileProgress: noop,
			onFileComplete: noop
		}, options);


		if( !options.url ){
			var url = this.$el.attr('action') || this.$el.find('form').attr('action');
			if( url ){
				options.url = url;
			} else {
				this._throw('url — is not defined');
			}
		}


		api.each(options, function (value, option){
			this._setOption(option, value);
		}, this);


		this.$el.on('progress', $.proxy(this, '_onProgress'));
		this.$el.on('complete', $.proxy(this, '_onComplete'));

		this.elem('dropZone.el', true).dnd($.proxy(this, '_onDropHover'), $.proxy(this, '_onDrop'));
		this.$progress = this.elem('progress');

		this.clear();
	};


	Plugin.prototype = {
		constructor: Plugin,


		_throw: function (msg){
			throw "jquery.fileapi: " + msg;
		},


		_getFiles: function (evt){
			var data = { files: [], other: [] }, maxSize = this.options.maxSize;
			api.each(data.all = api.getFiles(evt), function (file){
				data[!maxSize || file.size <= maxSize ? 'files' : 'other'].push(file);
			});
			return	data;
		},


		_onSelect: function (evt){
			var data = this._getFiles(evt);

			if( data.all.length && this.emit('select', data) !== false ){
				this.add(data.files);

				if( this.options.autoUpload ){
					this.upload();
				}
			}
		},


		onDrop: function (files, evt){
			if( this.emit('drop', { files: files, event: evt }) !== false ){
				// @todo
			}
		},


		onDropHover: function (state, evt){
			if( this.emit('dropHover', { state: state, event: evt }) !== false ){
				var hover = this.option('elements.dropZone.hover');
				if( hover ){
					$(evt.currentTarget).toggleClass(hover, state);
				}
			}
		},


		_onProgress: function (evt, ui){
			this.$progress.stop().animate({ width: ui.loaded/ui.total*100 + '%' });
		},


		_onComplete: function (){
			var _this = this;

			this.xhr = null;
			this.active = false;

			this.$progress.queue(function (){
				_this._redraw();
				_this.$progress.width(0).dequeue();
			});
		},


		_redraw: function (){
			var active = !!this.active, empty = !this.queue.length && !active;

			if( this.__empty !== empty ){
				this.__empty = empty;

				this.elem('empty.show').toggle( empty );
				this.elem('empty.hide').toggle( !empty );

				this.elem('notEmpty.show').toggle( !empty );
				this.elem('notEmpty.hide').toggle( empty );
			}


			if( this.__active !== active ){
				this.__active = active;

				this.elem('active.show').toggle( active );
				this.elem('active.hide').toggle( !active );
			}
		},


		emit: function (name, arg){
			var opts = this.options, evt = $.Event(name), res;
			name = $.camelCase('on-'+name.replace(/(file)(upload)/, '$1-$2'));
			if( $.isFunction(opts[name]) ){
				res = opts[name].call(this.el, evt, arg);
			}
			return	(res !== false) && this.$el.triggerHandler(evt, arg);
		},


		/**
		 * Add files to queue
		 * @param  {Array}  files
		 */
		add: function (files){
			var sortFn = this.options.sortFn, preview = this.option('elements.preview');

			if( sortFn ){
				files.sort(sortFn);
			}

			if( preview ){
				api.each(files, function (file){
					if( /^image/.test(file.type) ){
						api.Image(file)
							.preview(preview.width, preview.height)
							.get($.proxy(function (err, img){
								if( err ){
									this.emit('previewError', { error: img, file: files[0] });
								}
								else if( this.emit('preview', { image: img, file: files[0] }) !== false ){
									this.elem('preview.el').html( img );
								}
							}, this))
						;
					}
				}, this);
			}

			if( this.xhr ){
				this.xhr.append(files);
			}
			else {
				this.queue = this.queue.concat(files);
			}
		},


		/**
		 * Find element
		 * @param	{String}	sel
		 * @param	{jQuery}	[ctx]
		 * @return	{jQuery}
		 */
		$: function (sel, ctx){
			if( typeof sel === 'string' ){
				sel	= /^#/.test(sel) ? sel : (ctx ? $(ctx) : this.$el).find(sel);
			}
			return	$(sel);
		},


		/**
		 * @param  {String}   name
		 * @param  {Boolean}  [up]
		 * @return {jQuery}
		 */
		elem: function (name, up){
			var sel = this.option('elements.'+name);
			if( sel === void 0 && up ){
				sel = this.option('elements.'+name.substr(0, name.lastIndexOf('.')));
			}
			return	this.$(sel);
		},


		/**
		 * Get/set options
		 * @param {String} name
		 * @param {*} [value]
		 * @return {*}
		 */
		option: function (name, value){
			if( value !== void 0 && $.isPlainObject(value) ){
				api.each(value, function (val, key){
					this.option(name+'.'+key, val);
				}, this);

				return	this;
			}


			var opts = this.options, val = opts[name], i = 0, len, part;

			if( ~name.indexOf('.') ){
				val  = opts;
				name = name.split('.');
				len  = name.length;

				for( ; i < len; i++ ){
					part = name[i];

					if( (value !== void 0) && (len - i === 1) ){
						val[part] = value;
						break;
					}
					else if( val[part] === void 0 ){
						val[part] = {};
					}

					val = val[part];
				}
			}
			else if( value !== void 0 ){
				opts[name] = value;
			}

			if( value !== void 0 ){
				this._setOption(name, value, this._options[name]);
				this._options[name] = value;
			}

			return	value !== void 0 ? value : val;
		},


		_setOption: function (name, nVal, oVal){
			switch( name ){
				case 'accept':
				case 'multiple':
				case 'postName':
						if( name == 'postName' ){ name = 'name'; }
						if( nVal ){
							this.$(':file')[propFn](name, nVal);
						}
					break;
			}
		},


		serialize: function (){
			var obj = {}, val;

			this.$el.find(':input').each(function(name, node){
				if(
					   (name = node.name) && !node.disabled
					&& (node.checked || /select|textarea|input/i.test(node.nodeName) && /checkbox|radio/i.test(node.type))
				){
					val	= $(node).val();
					if( obj[name] !== undef ){
						if( !obj[name].push ){
							obj[name] = [obj[name]];
						}

						obj[name].push(val);
					} else {
						obj[name] = val;
					}
				}
			});

			return	obj;
		},


		upload: function (){
			if( !this.active ){
				this.active = true;

				var
					  $el = this.$el
					, opts = this.options
					, files = {}
					, uploadOpts = {
						  url:   opts.url
						, data:  $.extend({}, this.serialize(), opts.data)
						, files: files
					}
				;

				files[$el.find(':file').attr('name')] = this.queue;
				this.queue = [];


				api.each(['upload', 'progress', 'complete'], function (name){
					uploadOpts[name] = $.proxy(this, $.camelCase('_emit-'+name+'Event'), '');

					uploadOpts['file'+name] = $.proxy(this, $.camelCase('_emit-'+name+'Event'), 'file');
				}, this);


				this.xhr = api.upload(uploadOpts);
				this._redraw();
			}
		},


		_getUploadEvent: function (extra){
			var xhr = this.xhr, evt = {
				  xhr: xhr
				, file: xhr.current
				, files: xhr.files
				, plugin: this
			};
			return	$.extend(evt, extra);
		},


		_emitUploadEvent: function (prefix){
			var evt = this._getUploadEvent();
			this.emit(prefix+'upload', evt);
		},


		_emitProgressEvent: function (prefix, event){
			var evt = this._getUploadEvent(event);
			this.emit(prefix+'progress', evt);
		},


		_emitCompleteEvent: function (prefix, err){
			var evt = this._getUploadEvent({
				  error:	err
				, status:	this.xhr.status
				, result:	this.xhr.result
			});

			if( this.options.dataType == 'json' ){
				evt.result = $.parseJSON(evt.result);
			}

			this.emit(prefix+'complete', evt);
		},


		clear: function (){
			this.queue = [];
			this._redraw();
		},


		widget: function (){
			return	this;
		},


		destroy: function (){
			this.$el
				.off('.fileapi')
				.removeData('fileapi')
			;
		}
	};





	/**
	 * @param	{Object}	options
	 * @param	{String}	[value]
	 */
	$.fn.fileapi = function (options, value){
		var plugin = this.data('fileapi');

		if( plugin ){
			if( $.isString(options) ){
				var fn = plugin[options], res;
				if( $.isFunction(fn) ){
					res = fn.call(plugin, value);
				}
				else if( fn === void 0 ){
					res = this.option(options, value);
				}
				return	res === void 0 ? this : res;
			}
		} else {
			this.data('fileapi', new Plugin(this, options))
		}

		return	this;
	};


	$.fn.fileapi.version = '0.1.0';
})(jQuery, FileAPI);
