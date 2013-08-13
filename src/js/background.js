
var urls      = {};
var pending   = {};
var lastInfo  = {};
var isEnabled = {};

var lastTime   = 0;
var continuous = 0;   
var times      = 3;   // 连续刷新超过3次，自动停止

var activeTab = -1;
var interval  = 2000;
var headers   = ['Etag','Last-Modified','Content-Length'];

var AF = {

	timeout: null,

	comet: function( tabId ){

		var url, method;

		for( url in urls[tabId] ){
			if( urls[tabId].hasOwnProperty(url) ){
				method = urls[tabId][url]=='main_frame' ? 'GET' : 'HEAD';
				(function(tabId,url,method){

					AF.getHeader( url, method, function( newInfo ){
						if( AF.hasChanged(url,newInfo) ){
							chrome.tabs.sendMessage(tabId, {reload:'yes'});
							var now = +new Date();
							console.log(now - lastTime);
							continuous =  now - lastTime < interval ? continuous+1 : 0;
							lastTime = now;
							if( continuous > 3 ){
								isEnabled[tabId] = false;
								AF.setIcon( tabId );
							}
						}
					} );

				})(tabId, url, method);
			}
		}

		AF.start( tabId );
	},

	start: function( tabId ){

		AF.stop( tabId );

		if( tabId==activeTab && isEnabled[tabId] ){
			AF.timeout = setTimeout(function(){ 
				AF.comet(tabId); 
			}, interval);
		}
		
	},

	stop: function( tabId ){
		clearTimeout( AF.timeout );
		AF.timeout = null;
	},

	hasChanged: function(url,newInfo){
		var oldInfo = lastInfo[url], header;
		lastInfo[url] = newInfo;

		if( !oldInfo ){
			return false;
		}

		for( var i=0,l=headers.length; i<l; i++ ){
			header = headers[i];
			if( !newInfo[header] ){
				continue;
			}
			if( newInfo[header]!=oldInfo[header] ){
				console.log('url %s, header %s, new %s, old %s',url,header,newInfo[header],oldInfo[header]);
				return true;
			}
		}

		return false;
	},

	getHeader: function( url, method, fn ){
		
		if( pending[url] ) return;

		var xhr = new XMLHttpRequest();
		var reqUrl = ~url.indexOf('?') ? (url+'&r='+Math.random()) : ~url.indexOf('#') ? url.replace(/(#.*)$/,'?r='+Math.random()+'$1') : (url+'?r='+Math.random());
		xhr.open(method,reqUrl,true);
		xhr.onreadystatechange = function(){
				
			if( xhr.readyState==xhr.DONE ){
				pending[ url ] = false;

				if( xhr.readyState==xhr.DONE && xhr.status>=200 && xhr.status<304 ){
					var info = {}, val, header;
					for( var i=0,l=headers.length; i<l; i++ ){
						header = headers[i];
						val = xhr.getResponseHeader(header);
						if( header.toLowerCase()=='etag' ){
							val = val && val.replace(/^W\//, '');
						}

						info[header] = val;
					}
					if( method=='GET' ){
						info['Content-Length'] = xhr.responseText.length;
					}
					fn( info );
				}
				else if( xhr.status>=400 ){
					pending[ url ] = true;
				}

			}

		}
		xhr.send();
		pending[ url ] = true;

	},

	setIcon: function( tabId ){

		var icon  = isEnabled[tabId] ? 'src/img/icon_enable.png' : 'src/img/icon_disable.png';

		chrome.browserAction.setIcon({ path:{19:icon}, tabId:tabId });

	},

	addListener: function(){

		AF.addNetWorkListener();
		AF.addClickedListener();
		AF.addActivatedListener();
		AF.addMessageListener();
		AF.addClosedListener();

	},

	addNetWorkListener: function(){

		chrome.webRequest.onBeforeSendHeaders.addListener(

			function(details){

				var tabId = details.tabId;
				var url = details.url;

				if( tabId==-1 ){
					return {cancel:false};
				}

				urls[tabId] = urls[tabId] || {};

				if( details.type === 'xmlhttprequest' ){
					if( /\.js/.test(url) ){
						urls[tabId][url] = details.type;
					}
				}
				else if ( details.type === 'main_frame' ){
					urls[tabId] = {};
					urls[tabId][url] = details.type;
				}
				else {
					urls[tabId][url] = details.type;
				}

				return {cancel:false};
			},

			{urls: ['<all_urls>'], types:['main_frame','stylesheet','script','xmlhttprequest']},

			['blocking']

		);

	},

	addClickedListener: function(){

		chrome.browserAction.onClicked.addListener(

			function(tabs){

				var tabId = tabs.id;
				isEnabled[tabId] = !isEnabled[tabId];

				AF.setIcon( tabId );
				AF.start( tabId );

			}

		);

	},

	addActivatedListener: function(){

		chrome.tabs.onActivated.addListener(

			function(info) {
			
				activeTab = info.tabId;

				AF.setIcon( activeTab );
				AF.start( activeTab );
			
			}

		);

	},

	addMessageListener: function(){

		chrome.runtime.onMessage.addListener(

			function(req, sender, resp){

				var tabId = sender.tab.id;

				if( req.ready=='yes' && tabId ){
					AF.setIcon( tabId );
					AF.start( tabId );
				}

			}

		);

	},

	addClosedListener: function(){

		chrome.tabs.onRemoved.addListener(

			function( tabId ){

				delete urls[tabId];

			}

		);

	},

	run: function(){

		chrome.tabs.query( { active:true },

			function(tabs){

				if( tabs[0] ){
					activeTab = tabs[0].id;
					AF.setIcon( activeTab );
				}

			}

		);

		AF.addListener();

	}

};


AF.run();