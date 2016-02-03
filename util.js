function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = '0123456789abcdef';
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = '4';  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = '-';
    var uuid = s.join('');
    return uuid.toUpperCase();
}

function play(sound, repeat){
	var audio = new Audio(sound);
	audio.loop = repeat;
	audio.play();
	return audio;
}

function getName(prog) {
	return prog.serieName ? prog.serieName : prog.name;
}

String.prototype.decodeXml = function() {
    return $('<div/>').html(this).text();
};

String.prototype.encodeXml = function() {
    return $('<div/>').text(this).html();
};

String.prototype.toCamelCase = function() {
    return this.replace(/-([a-z])/g, function (g) {
    	return g[1].toUpperCase();
	});
};

String.prototype.firstToLowerCase = function() {
    return this.charAt(0).toLowerCase() + this.slice(1);
};

Date.prototype.formatHM = function() {
   return this.getHours() + ':' + (this.getMinutes() < 10 ? '0': '') + this.getMinutes();
};

function setFavicon(url) {
	$('#favicon').remove();
	$('<link />', { 
		type : 'image/x-icon' , rel : 'shortcut icon',
		href : url , id : 'favicon'})
	.appendTo($('head'));
}

function loadImageAsBlob(path, callback) {
	// TODO: ver se há path
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){
		if (this.readyState == 4 && this.status == 200){
			callback(window.URL.createObjectURL(this.response));
		}
	};
	xhr.open('GET', path);
	xhr.responseType = 'blob';
	xhr.send();
}

function isFavorite(favorites, prog) {
	var pos = -1;
	$.each(favorites, function(idx,favorite) {
		if (prog.name == favorite.name && prog.channel.locator == favorite.channel.locator) {
			pos = idx;
			return false; // sai do ciclo
		}
	});
	return pos;
}