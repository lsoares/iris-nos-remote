// ao lançar a app
chrome.app.runtime.onLaunched.addListener(openTab);
chrome.app.runtime.onRestarted.addListener(openTab);
function openTab() {
    window.open('window.html', '_rcWindow');
}

// recuperar a última box escolhida
chrome.storage.sync.get('lastBox', function(opt) {
	if (opt.lastBox) {
		// há uma box selecionada... não é preciso procurar
		BOX.init({ id : opt.lastBox, });
	} else {
		findBoxes(function(boxes) {
			if (!(boxes && boxes.length)) return;
			// usemos a primeira box para começar
			BOX.init({ id : boxes[0] });
		});
	}
});

// tratar dos alarmes
chrome.alarms.create('scheduler',  { delayInMinutes : 1 , periodInMinutes : 5 });
chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name == 'scheduler') {
		chrome.storage.sync.get({favorites:[]}, function(opt) {
			scheduleAlarms(opt.favorites);
		});
	} else {
		var prog = BOX.getEvent(parseInt(alarm.name));
		handleStartProgram(prog);
	}
});


function scheduleAlarms(favorites) {
	var favChannels = [];
	$.each(favorites, function(idx,favorite) {
		favChannels.push(favorite.channel);
	});
	BOX.getEPG(function(prog) {
		$.each(favorites, function(idx,favorite) {
			if (getName(prog) == favorite.name && prog.channel.locator == favorite.channel.locator) {
				loading = false;
				if (!prog.image) {
					loadImageAsBlob(prog.imageSrc, function(blobSrc) {
						prog.image = blobSrc;
						chrome.alarms.create(prog.id + '', { when : prog.startDate.getTime() });
					});
				} else {
					chrome.alarms.create(prog.id + '', { when : prog.startDate.getTime() });
				}
			}
		});
	}, favChannels);
}

// mostrar notificação
function handleStartProgram(prog) {
	play('notify.mp3'); 
	var secondsLeft = (prog.startDate.getTime() - new Date())/1000;
	var desc = '';
	if (prog.seasonNumber || prog.episodeNumber) {
		desc += prog.name + ' (T' + prog.seasonNumber + ' E' + prog.episodeNumber + ')';
	}
	var notifOpts = { 
	    type: 'basic', title: getName(prog), message: desc ? desc : 'NOS IRIS Control Panel', 
		iconUrl: prog.image ? prog.image : 'tv.png', eventTime : 8000,
		buttons : [ { title : 'Ver ' + prog.channel.name , iconUrl : 'tv.png' } ]
	};
	if (secondsLeft < 0) {  // já começou a dar!
		notifOpts.type = 'progress';
		notifOpts.progress = Math.round((-secondsLeft/prog.duration) * 100);
		return;	 // fix	
	}
	var dateObj = new Date();
	chrome.notifications.create(prog.id + '', notifOpts, function(x) {});
	console.log(prog, notifOpts, notId);
}

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
	var prog = BOX.getEvent(parseInt(notificationId));
	BOX.setCh(prog.channel);
});