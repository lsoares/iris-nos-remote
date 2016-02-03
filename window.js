$(document).ready(function() {

	$('button').button();
	
	function initAll(boxes) {
	    if (!(boxes && boxes.length)) {
		   erro();
		   return;
		}
		$.each(boxes, function (idx, boxId) {
			$('<input/>', {	id : 'box' + boxId, name : 'boxSelect', type : 'radio'})
			.data('boxId', boxId).addClass('boxInit box' + boxId)
			.click(function (ev) {   // quando se clica numa box					
				var boxId = $(ev.currentTarget).data('boxId');
				initBoxGui(boxId);   // iniciar esta box
                chrome.storage.sync.set({ lastBox : boxId }); // guardar box escolhida
			}).appendTo('#boxSelect');
			$('<label/>', {'for' : 'box' + boxId, title : 'Box ' + boxId,
				           text : String.fromCharCode(65 + idx)
			}).appendTo('#boxSelect');
		});
		$('#boxSelect').prop('title', 'Seletor de box').buttonset();
		chrome.storage.sync.get({ lastBox: boxes[0] }, function(opt) {  // recuperar a última box escolhida
			$('.box' + opt.lastBox).click();
		});
		$('#boxSelect').toggle(boxes.length); // se só há uma box não é preciso seletor
	}
	
	retries = 0;
	function erro() {
		retries++;
		if (retries < 3) {  // tentar de novo
			setTimeout(function() { findBoxes(initAll, erro); }, 500);			
		} else { // desistir
			$('#loader').hide();		
			$('#erro').show().click(function() {
				 window.location.reload();
			});
		}
	}
	
	$('#gui').hide();
	findBoxes(initAll, erro);  // pesquisa de boxes

	// GUI da box
	var initBoxGui = function (boxId) {
		BOX.init({
			id : boxId,
			currVolCallback : function (vol) {
				$('#volumeSlider').slider({
					value : vol, min : 0, max : 100,
					orientation : 'vertical',
					stop : function (event, ui) {
						BOX.setVol(ui.value);
					}
				});
			},
			chChangeListener : updateChDetail,
			channelsCallback : function (chs) {
				$('#channels').empty();
				$.each(chs, function (idx, ch) {
				    var wrapper = $('<div/>')     // desenha canais
						.addClass('chWrapper')
						.addClass('number' + ch.number)
						.toggleClass('selected', ch.selected)
						.data('ch', ch)
						.appendTo($('#channels'))
					    .click(function (ev) {
							clearInterval(statusInterval);
							BOX.setCh($(ev.currentTarget).data('ch'));
							statusInterval = setInterval(BOX.refresh, 8*1000);
						});
					var imgCh = $('<img/>')
						.prop('title', ch.name + '\n' + ch.number)
						.addClass('chLogo')
						.appendTo(wrapper);
					loadImage(ch, imgCh);
				});
				updateChDetail();
				$('#gui').show();
				$('#loader').hide();
				// auto atualizar screenshots dos favoritos
				statusInterval = setInterval(BOX.refresh, 8*1000);
				(function me() {
					favoritesRefresh();
					setTimeout(me, 30*1000);
				})();
			}
		});
		var fav = $('#controlPanel').find('.fav');
		fav.click(toggleFavorite).toggleClass('grayscale', true);
	};
	
	function favoritesRefresh() {
		$('.favoritePic').remove();
		chrome.storage.sync.get({ 'favorites':[] }, function(opt) {
			var favChannels = [];
			$.each(opt.favorites, function(idx,favorite) {
				favChannels.push(favorite.channel);
			});
				
			BOX.getEPG(function(prog) {
				if (prog.current && isFavorite(opt.favorites, prog) > -1) {
					var chElement = $('.number' + prog.channel.number);
					var imgProg = $('<img/>').prop('title', getName(prog.name)).appendTo(chElement).addClass('favoritePic');
					loadImage(prog, imgProg);
				}
			}, favChannels);
		});
	}
	
	$('#controlPanel , #chUpDown').on('mousewheel', function(e) {
		 if (e.originalEvent.wheelDelta > 0) {			
			BOX.chDown();
		 } else {
		 	BOX.chUp();
		 }
		 return false;
	 });

	function updateChDetail() {
		var ch = BOX.currentCh;
		$('#channels').find('.chWrapper').removeClass('selected');
		$('#channels').find('.number' + ch.number).addClass('selected');
		var detail = $('#controlPanel');
		loadImage(ch, detail.find('.channelImage'));
		BOX.getPrograms(ch, function(programs) { drawEpg(programs, ch); });
	}
	
	$('.channelImage').click(function() {
		$('#epg').show();
	});
	$('#epg').click(function() {
		$('#epg').hide();
	});
	
	function drawEpg(programs, ch) {
		$('#epg').empty();
		var detail = $('#controlPanel');
		if (!programs || !programs.length) {
			detail.find('.programImage').prop('src', '');
			detail.find('.programName').text(ch.serviceType == 'RADIO' ? ch.name : '');
			detail.find('.programNameSub').text('');
			detail.find('.progress').width(0);
			detail.find('.channelImage').prop('title', '');
			document.title = ch.name || 'Sem  acesso à listagem de canais';
			return;
		}
		$('#seek').toggle(ch.serviceType != 'RADIO');
		$.each(programs, function(idx, prog) {
			if (prog.current) {
				detail.find('.fav').data('program', prog);
				chrome.storage.sync.get({ 'favorites':[] }, function(opt) {
					detail.find('.fav').toggleClass('grayscale', isFavorite(opt.favorites, prog) == -1);
				});
			 	loadImage(prog, detail.find('.programImage')); // saca imagem
				var secondsPassed = Math.floor((new Date() - prog.startDate)/1000);
				var progress = secondsPassed/prog.duration;
			    detail.find('.progress').width(progress*detail.width());
				detail.find('.programName').text(getName(prog));
				detail.find('.programNameSub').text(
					prog && prog.serieName && prog.serieName.toLowerCase() != prog.name.toLowerCase()
					? prog.name : '')
				                              .prop('title', 'T' + prog.seasonNumber + 'E' + prog.episodeNumber);
				detail.find('.channelImage').prop('title', 'Ver guia de TV..');
				document.title = getName(prog) + ' - ' + ch.name;
			} else {
				var progEl = $('<div/>').addClass('prog').appendTo($('#epg'));
				progEl.prop('title', (prog.seasonNumber ? 'T' + prog.seasonNumber : '') +
									 (prog.episodeNumber ? ' E' + prog.episodeNumber : ''));
				var commands = $('<div/>').addClass('commands').appendTo(progEl);
				$('<span/>').addClass('fav action')
							  .toggleClass('grayscale', true)
							  .data('prog', prog)
							  .click(toggleFavorite);
							 // .appendTo(commands);
			   var left = $('<div/>').addClass('left').appendTo(progEl);
			   var right = $('<div/>').addClass('right').appendTo(progEl);
			   var img = $('<img/>').appendTo(left).prop('src', prog.image).height(32);
			   $('<div/>', { text:getName(prog) }).addClass('progName').appendTo(right);
			   $('<div/>', { text:prog.startDate.formatHM() })
							 .addClass('time').appendTo(right);	   
			   if(!prog.image) {
			     loadImageAsBlob(prog.imageSrc, function(blobSrc) {
  					prog.image = blobSrc;
  					img.prop('src', blobSrc);
  				});
			   }
			}
	   });
	}
	
	function loadImage(obj, img, callback) {
		if (obj.image) {
			img.prop('src', obj.image);
			if (callback) callback(obj.image);
		} else loadImageAsBlob(obj.imageSrc, function(blobSrc) {
			obj.image = blobSrc;
			img.prop('src', blobSrc);
			if (callback) callback(blobSrc);
		});
	}
	
	function toggleFavorite(clickEv) {
		var progClicked = $(clickEv.currentTarget).data('program');
		var icon = $(clickEv.currentTarget);
		chrome.storage.sync.get({ 'favorites':[] }, function(opt) {
			var idx = isFavorite(opt.favorites, progClicked);
			if (idx == -1) {
				opt.favorites.push({ name : getName(progClicked), 
								     channel: { locator : progClicked.channel.locator , name : progClicked.channel.name} });
			} else {
				opt.favorites.splice(idx, 1); // remove favorito
			}
			icon.toggleClass('grayscale', idx > -1);
			chrome.storage.sync.set({'favorites' : opt.favorites});
		});
	}

	// teclas de atalho
	var mappings = {
	   13 : '_ok',     // enter
	   19 : 'pause',   // pause sys
	   27 : 'stopOperations' ,  // esc
	   33 : 'chUp',    // pg up
	   34 : 'chDown',  // pg down
	   35 : '_back',    // end
	   38 : '_up',     // ↑
	   40 : '_down',   // ↓
	   173 : '_mute',  // mute
	   174 : 'volDown',// vol-
	   175 : 'volUp',  // vol+
	   176 : '_right', // forward
	   177 : '_left',  // rewind
	   179 : 'pause'     // pause		   
	};
	var mapppingsSpecial = {
	   8 : '_left',   // backspace
	   36 : '_menu',   // home
	   32 : 'chUp',    // space
	   37 : '_left',   // ←	   
	   39 : '_right',  // →	   
	   46 : '_mute'   // delete
	};
    var mapppingsSpecialShift = {
	   32 : 'chDown'    // space
	};
	
	$(document).keyup(function (ev) {	
	    var typing = $('#searchBox').is(':focus');
		if (mappings[ev.keyCode]) {
			BOX[mappings[ev.keyCode]]();
			ev.preventDefault();
		}
		if (!typing) {
			if (!ev.shiftKey && mapppingsSpecial[ev.keyCode]) {
				BOX[mapppingsSpecial[ev.keyCode]]();
				ev.preventDefault();
			}
			if (ev.shiftKey && mapppingsSpecialShift[ev.keyCode]) {
				BOX[mapppingsSpecialShift[ev.keyCode]]();
				ev.preventDefault();
			}
			if (ev.keyCode >= 48 && ev.keyCode <= 57) {
				BOX._sendNumber(ev.keyCode-48);
				ev.preventDefault();
			}
			if (ev.keyCode >= 96 && ev.keyCode <= 105) {
				BOX._sendNumber(ev.keyCode-96);
				ev.preventDefault();
			}
		}
	});
	
	$('#searchBox').autocomplete({
	    minLength: 2,
		source: function (request, response) {
		   BOX.autoComplete(request.term, 6, function(responses) {
		        response(responses);
		   });
        },
		select: function (event, ui) {
           BOX.search(ui.item.label);
        }
	});
	
	$(document).on('click', 'button, .action', function (ev) {
		if (BOX[$(ev.currentTarget).data('fn')]) {
			BOX[$(ev.currentTarget).data('fn')]();
		}
	});
});
