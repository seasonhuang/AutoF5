
window.onload = function(){

	chrome.runtime.sendMessage({ready:'yes'});

	chrome.runtime.onMessage.addListener(
		function(req, sender, resp){
			console.log('reload %s',req.reload);
			location.reload();
		}
	);
	
};