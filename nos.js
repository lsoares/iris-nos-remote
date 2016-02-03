BOX = {
    host : 'http://a212-113-188-171.cpe.netcabo.pt/',
	id : '',
	events : {},
	currentVol : 50,
	currentCh : {},
	channels : {},

	init : function (cfg) {
		BOX.id = cfg.id;
		BOX.getChannels(); // lista de canais
        BOX.getChannelDetails();
		BOX.getCurrentChannel(cfg.channelsCallback); // saber canal atual
		BOX.getCurrentVolume(cfg.currVolCallback); // saber volume atual
		$.extend(BOX, cfg); // guarda info de config.
	},
	
	refresh : function () {
		BOX.getCurrentChannel();
		BOX.getCurrentVolume(BOX.currVolCallback);
	},

	getChannels : function (callback) {
		if (BOX.channels) {
			if (callback) callback();
		}
		BOX.callSoap('Channel-List', 'GetChannelListDetail', {
			channelListId : 'a2214641'
		}, function (channels) {
		  if(!channels) return;
			channels = channels.filter('entry');
			channels.each(function (idx, ch) {
				var locator = $(ch).find('locator').text();
				BOX.channels[locator] = {
					number : parseInt($(ch).find('number').text()),
					locator : locator,
					selected : false
				};
			});
			if (callback) callback();
		});
	},

	getChannelDetails : function (callback) {
		BOX.callSoap('Channel', 'GetChannelDetails', {
			locators : ''
		}, function (channels) {
		  if(!channels) return;
			channels.each(function (idx, ch) {
				var locator = $(ch).find('locator').text();
				var boxCh = BOX.channels[locator];
				$.extend(boxCh, {
					name : $(ch).find('name').text(),
					rating : parseInt($(ch).find('rating').text()),
					imageSrc : BOX.getChImg($(ch).find('logouri').text())
				});
				// saca outros atributos
				$.each($(ch).find('attribute at'), function(idx, el) {
					var key = $(el).find('key').text();
					var val = $(el).find('value').text();
					if (key == 'serviceType') {
						if(val == '2') (boxCh.serviceType = 'RADIO');
						if(val == '22') (boxCh.serviceType = 'SD');
						if(val == '25') (boxCh.serviceType = 'HD');
					} else if (key == 'rating') {
						if(val == '1') (boxCh.rating = 'NORMAL');
						if(val == '13') (boxCh.rating = 'ADULT');
					} else if (key == 'serviceId') {
						boxCh.serviceId = parseInt(val);
					} else if (key == 'posterURI') {
						boxCh.posterSrc = val;
					} else if (key == 'isLocked') {
						boxCh.favorite = val == '0';
					}
				});
			});
		});
	},
	
	getEPG : function(chCallback, channels, duration) {
		channels = channels || BOX.channels;
		// itera canais
		$.each(channels, function(idx, ch) {
			// busca EPG por programa
			BOX.getPrograms(ch, function(events, currCh) {
				// itera programas
				$.each(events, function(idx, prog) {
					chCallback(prog, prog.current);
				});
			}, duration);
		});
	},

	getCurrentChannel : function (callback) {
		BOX.callSoap('Channel-Selection', 'GetSelectedChannel', null, function (ch) {
			BOX.updateCurrentCh(ch.filter('locator').text());
			if (callback) callback(BOX.channels);
		});
	},

	updateCurrentCh : function (chLocator) {
	    // deixa de haver o selecionado atual
		if (BOX.currentCh && BOX.channels[BOX.currentCh.locator]) {
			BOX.channels[BOX.currentCh.locator].selected = false;
		}
		// muda o selecionado
		if (BOX.channels[chLocator]) {
		    BOX.currentCh = BOX.channels[chLocator];
			BOX.channels[chLocator].selected = true;
			if (BOX.chChangeListener) BOX.chChangeListener(BOX.currentCh);
			BOX.watching = null;
		} else {
		   // deve estar a tocar uma gravação
		   BOX.watching = chLocator;
		}
	},
	
	pause : function() {
	   BOX._ok();
	   setTimeout(BOX._ok, 2000);
	},
	
	zapping : function(arg) {
	    if (BOX.zappingTimeout || arg == 'stop') {
		    clearTimeout(BOX.zappingTimeout);
			BOX.zappingTimeout = null;
			return;
		}
    var originalChannel = BOX.currentCh;
		var zappping_ = function() {
  		    BOX.zappingTimeout = setTimeout(function() {
		       if (!BOX.currentCh.locator|| BOX.currentCh.locator != originalChannel.locator) {
			       BOX.chUp();
				     zappping_();
			    }
		    }, 10000);
		};
		BOX.chUp(zappping_);		
	},

	setCh : function (ch) {
		BOX.callSoap('Channel-Selection', 'SetSelectedChannel', {
			channelListId : 'a2214641',
			locator : ch.locator,
			channelNumber : ch.number
		});
		BOX.updateCurrentCh(ch.locator);
	},

	number : function (n) {
		if (n >= 0 && n <= 9) {
			BOX._sendNumber(n, 1000);
			setTimeout(function() {
			   BOX.getCurrentChannel(callback);
			}, 1000);
		}
	},

	chDown : function (callback) {
		BOX._chDo();
		setTimeout(function() {
		   BOX.getCurrentChannel(callback);
		}, 1000);
	},
	chUp : function (callback) {
		BOX._chUp();
		setTimeout(function() {
		   BOX.getCurrentChannel(callback);
		}, 1000);
	},

	getCurrentVolume : function (callback) {
		BOX.callSoap('Volume', 'GetVolumeState', null, function (vol) {
			BOX.currentVol = parseInt(vol.filter('level').text());
			if(callback) callback(BOX.currentVol);
		});
	},

	setVol : function (val) {
		BOX.callSoap('Volume', 'SetVolumeLevel', { level : val });
		BOX.getCurrentVolume(BOX.currVolCallback);
	},
	volUp : function () {
		BOX._volUp();
		BOX.getCurrentVolume(BOX.currVolCallback);
	},
	volDown : function () {
		BOX._volDo();
		BOX.getCurrentVolume(BOX.currVolCallback);
	},

	getPrograms : function (ch, callback, duration) {
    if (!BOX.channels[ch.locator]) {
			if (callback) callback([], false);
			return; // deve estar a tocar um vídeo
		}
		if ((new Date() - BOX.channels[ch.locator].lastUpdate)/60000 < 10) {
		    // usar cache de eventos
			if (callback) callback(BOX.channels[ch.locator].events, ch.locator == BOX.currentCh.locator);
			return;
		}
		var tsXml = '<timeSlot><TS>' +
			'<duration>' + (duration ? duration : 14400) + '</duration>\n' +
			'<startDate>' + Math.round((new Date()).getTime() / 1000) + '</startDate>\n' +
			'</TS></timeSlot>';
		BOX.callSoap('Editorial-Data', 'GetEventInfo', 
		    { locator : ch.locator, language : '', timeSlot : tsXml.encodeXml() },
			function (events) {
				if (!events) {  // não há eventos
					if (callback) callback([], ch.locator == BOX.currentCh.locator);
					return;
				}
				BOX.channels[ch.locator].events = [];
				BOX.channels[ch.locator].lastUpdate = new Date(); // para facilitar caching neste canal
				// limpar cache de eventos antigos
				$.each(BOX.events, function(idx, prog) {
					if ((new Date() - prog.startDate)/60000 > 480) {
						BOX.events.splice(idx, 1);
					}
				});
				// fazer parsing
				events.each(function (idx, ev) {			
					var progParsed = { 		// parse prog
					    id : parseInt($(ev).find('id').text()),						
						serieName : $(ev).find('seriename').text() === '' ? null : $(ev).find('seriename').text(),
						name : $(ev).find('name text').text(),
						channel : BOX.channels[ch.locator],
						startDate : new Date(parseInt($(ev).find('startdate').text()) * 1000),
						duration : parseInt($(ev).find('duration').text()),
						seasonNumber : parseInt($(ev).find('seasonnumber').text()),
						episodeNumber : parseInt($(ev).find('episodenumber').text()),
						imageSrc : BOX.getEvImg($(ev).find('mediauri').text())
					};
					// saca outros atributos
					$.each($(ev).find('attribute at'), function(idx, el) {
						var key = $(el).find('key').text();
						var val = $(el).find('value').text();						
						if (key == 'genre') {
							val = parseInt(val);
							if (val == 1) (progParsed.genre = 'MOVIE');
							if (val == 2) (progParsed.genre = 'SERIE');
							if (val == 4) (progParsed.genre = 'SPORT');
							if (val == 5) (progParsed.genre = 'DOC');
							if (val == 6) (progParsed.genre = 'FUN');
							if (val == 7) (progParsed.genre = 'NEWS');
						} else if (key == 'genreUri') {
							progParsed.genreImage = BOX.getGenreImg(val);
						} else if (key == 'groupId') {
							progParsed.groupId = parseInt(val);
						}
					});
					var diff = (new Date() - progParsed.startDate)/1000; // seconds
					/*if (diff >= 0 && diff <= progParsed.duration) {
						ch.currentProg = progParsed;
					}*/
					progParsed.current = idx === 0; // TODO
					BOX.events[progParsed.id] = progParsed;
					BOX.channels[ch.locator].events.push(progParsed);
				});
				if (callback)
				  callback(BOX.channels[ch.locator].events, ch.locator == BOX.currentCh.locator);
		});
	},

	getEvent : function(id) {
		return BOX.events[id];
	},
	
    autoComplete : function(str, max, callback) {
	   $.get(BOX.host + 'NDS/Appsrv.ashx', 
	        { 'function':'getKeywordList', keywordArea:'all', boxId:BOX.id, keywordCriteria:'all', 
			  language:'por', keywordMax:100, version:'ZON_NDS_1_5_0', keywordValue:str },
			function(resp) {
			   var hits = resp.split('/%/');
			   if (hits.length > 3) { // tirar lixo
			       hits = hits.slice(2, hits.length-1);
			   }
			   if (hits.length > max) {
			      hits = hits.slice(0, max);
			   }
			   if (callback) callback(hits);
			}
		);
	},

	search : function (str, callback) {
	    BOX._sendCommand('search:ALL|'); // só para aparecer o menu
		setTimeout(function() { BOX._sendCommand('search:ALL|' + str, callback); }, 800); // pesquisa mesmo
	},
	
	watchFromBeggining : function() {
	    BOX._ok();
		setTimeout(BOX._down, 2000);
		setTimeout(BOX._ok, 2000*2);
	},

	_power : function () {
		BOX._sendKey(57344);
	},
	_ok : function () {
		BOX._sendKey(57345);
	},
	_back : function () {
		BOX._sendKey(57346);
	},
	_volUp : function () {
		BOX._sendKey(57347);
	},
	_volDo : function () {
		BOX._sendKey(57348);
	},
	_mute : function () {
		BOX._sendKey(57349);
	},
	_chUp : function () {
		BOX._sendKey(57350);
	},
	_chDo : function () {
		BOX._sendKey(57351);
	},
	_up : function () {
		BOX._sendKey(57600);
	},
	_down : function () {
		BOX._sendKey(57601);
	},
	_left : function () {
		BOX._sendKey(57602);
	},
	_right : function () {
		BOX._sendKey(57603);
	},
	_fav : function () {
		BOX._sendKey(57856);
	},
	_rec : function () {
		BOX._sendKey(58371);
	},
	_menu : function () {
		BOX._sendKey(61192);
	},	
	_sendNumber : function (n) {
		BOX._sendKey(58112 + n);
	},
	_sendKey : function (val) {
		BOX.callSoap('Remote-Control', 'SendKey', { key : val });
	},
	_sendCommand : function (cmd, callback) {
		BOX.callSoap('Command', 'SendCommand', {
			command : cmd
		}, callback);
	},
	
	_getStbState : function() { // para que serve?
	   BOX.callSoap('STB-State', 'GetStbState', null, function(stbState) {
	      console.log(stbState);
	   });
	},

	stopOperations : function() {
	    BOX.zapping('stop');
	    $.ajaxq('soap');
	},
	
	callSoap : function (fn, action, params, callback) {
		var paramsXml = '';
		$.each(params || {}, function (key, val) {
			paramsXml += '   <' + key + '>' + val + '</' + key + '>\n';
		});
		var data = '<?xml version="1.0" encoding="utf-8"?>\n'
		   + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\n'
		   + ' <s:Body>\n'
		   + '  <u:' + action + ' xmlns:u="' + BOX.getSoapUrn(fn) + '">\n'
		   + '   <uuid>uuid:' + createUUID() + '</uuid>\n'
           +     paramsXml
		   + '  </u:' + action + '>\n'
		   + ' </s:Body>\n'
		   + '</s:Envelope>';
		$.ajaxq('soap', {
			url : BOX.getServiceUrl(fn), type : 'POST', data : data,
			headers : { 'SOAPACTION' : BOX.getSoapAction(fn, action),
				        'Content-Type' : 'text/xml; charset="utf-8"' },
			success : function (resp) {
				if (callback) {
					resp = $(resp).find(action + 'Response');
					var tag = action.substring(3).firstToLowerCase(); // perceber qual é a tag (tirar a palavra get)
					resp = resp.find(tag).html() ? $(resp.find(tag).html().decodeXml()) : null;
					callback(resp);
				}
			}
		});
	},
	
	getServiceUrl : function (fn) {
		return BOX.host + BOX.id + '/' + fn.replace('-', '') + 'Service/control/';
	},
	getSoapUrn : function (fn) {
		return 'urn:schemas-nds-com:service:' + fn + ':1';
	},
	getSoapAction : function (fn, action) {
		return '"' + BOX.getSoapUrn(fn) + '#' + action + '"';
	},
	getChImg : function (name) {
		return BOX.host + 'NDS/ch_logosdir/ch_logos/' + name;
	},
	getGenreImg : function (name) {
		return BOX.host + 'NDS/genre_imagesdir/genre_images/' + name;
	},
	getEvImg : function (name) {
		return BOX.host + 'NDS/epgimages/' + name;
	}
};

function findBoxes(onSuccess, onError) {
	var discoveryURL = 'mainhandler.ashx?function=discovery&temp=/stb.xml';
	$.ajax({   
	    url : BOX.host + discoveryURL, 
		timeout: 6000,
	    success : function (resp) {
			var boxes = [];
			var boxesParse = $('pollUrl', resp);
			boxesParse.each(function (idx, val) {
				var urlBox = $(val).text();
				var boxId = urlBox.substring(urlBox.lastIndexOf('/') + 1);
				boxes.push(boxId);
			});
			onSuccess(boxes);
		},
		error : onError
	});
}
