var globalNodeIndex = 0;
const NodeExpandWidth = 300;
const NodeExpandHeight = 150;
const ClipNodeTextLength = 1024;

var Node = function()
{
	var self = this;
	this.titleColorValues = ['#eee','#6EA5E0','#9EDE74','#FFE374','#F7A666','#C47862','#97E1E9'];
	// primary values
	this.index = ko.observable(globalNodeIndex++);
	this.title = ko.observable("Node" + this.index());
	this.tags = ko.observable("")
	this.body = ko.observable("Empty Text");
	//this.x = ko.observable(128);
	//this.y = ko.observable(128);
	this.active = ko.observable(true);
	this.tempWidth;
	this.tempHeight;
	this.tempOpacity;
	this.style;
	this.colorID = ko.observable(0);
	this.checked = false;
	this.selected = false;

	// clipped values for display
	this.clippedTags = ko.computed(function() 
	{
		var tags = this.tags().split(" ");
		var output = "";
		if (this.tags().length > 0)
		{
			for (var i = 0; i < tags.length; i ++)
				output += '<span>' + tags[i] + '</span>';
		}
        return output;
    }, this);

	this.clippedBody = ko.computed(function() 
	{
		var result = app.getHighlightedText(this.body());
		while (result.indexOf("\n") >= 0)
			result = result.replace("\n", "<br />");
		while (result.indexOf("\r") >= 0)
			result = result.replace("\r", "<br />");
		result = result.substr(0, ClipNodeTextLength);
        return result;
    }, this);

	// internal cache
	this.linkedTo = ko.observableArray();
	this.linkedFrom = ko.observableArray();

	// reference to element containing us
	this.element = null;

	this.canDoubleClick = true;

	this.create = function()
	{
		Utils.pushToTop($(self.element));
		self.style = window.getComputedStyle($(self.element).get(0));

		var parent = $(self.element).parent();
		self.x(-parent.offset().left + $(window).width() / 2 - 100);
		self.y(-parent.offset().top + $(window).height() / 2 - 100);


		var updateArrowsInterval = setInterval(app.updateArrowsThrottled, 16);

		$(self.element)
			.css({opacity: 0, scale: 0.8, y: "-=80px", rotate: "45deg"})
			.transition(
				{
					opacity: 1,
					scale: 1,
					y: "+=80px",
					rotate: "0deg"
				},
				250,
				"easeInQuad",
				function() {
					clearInterval(updateArrowsInterval);
					app.updateArrowsThrottled();
				}
			);
		self.drag();

		$(self.element).on("dblclick", function()
		{
			if (self.canDoubleClick)
				app.editNode(self);
		});

		$(self.element).on("click", function(e)
		{
			if(e.ctrlKey)
			{
				if(self.selected)
					app.removeNodeSelection(self);
				else
					app.addNodeSelected(self);
			}
		});
	}

	this.setSelected = function(select)
	{
		self.selected = select;
		
		if(self.selected) 
			$(self.element).css({border: "1px solid #49eff1"});
		else 
			$(self.element).css({border: "none"});
		
	}

	this.toggleSelected = function()
	{
		self.setSelected(!self.selected);
	}

	this.x = function(inX)
	{
		if (inX != undefined)
			$(self.element).css({x:Math.floor(inX)});
		return Math.floor((new WebKitCSSMatrix(self.style.webkitTransform)).m41);
	}

	this.y = function(inY)
	{
		if (inY != undefined)
			$(self.element).css({y:Math.floor(inY)});
		return Math.floor((new WebKitCSSMatrix(self.style.webkitTransform)).m42);
	}

	this.resetDoubleClick = function()
	{
		self.canDoubleClick = true;
	}

	this.tryRemove = function()
	{
		if (self.active())
			app.deleting(this);

		setTimeout(self.resetDoubleClick, 500);
		self.canDoubleClick = false;
	}

	this.cycleColorDown = function()
	{
		self.doCycleColorDown();

		setTimeout(self.resetDoubleClick, 500);
		self.canDoubleClick = false;

		if (app.shifted)
			app.matchConnectedColorID(self);

		if(self.selected)
			app.setSelectedColors(self);
	}

	this.cycleColorUp = function()
	{	
		self.doCycleColorUp();

		setTimeout(self.resetDoubleClick, 500);
		self.canDoubleClick = false;

		if (app.shifted)
			app.matchConnectedColorID(self);

		if(self.selected)
			app.setSelectedColors(self);
	}

	this.doCycleColorDown = function()
	{
		self.colorID(self.colorID() - 1);
		if (self.colorID() < 0)
			self.colorID(6);
	}

	this.doCycleColorUp = function()
	{
		self.colorID(self.colorID() + 1);
		if (self.colorID() > 6)
			self.colorID(0);
	}
	
	this.remove = function()
	{
		$(self.element).transition({opacity: 0, scale: 0.8, y: "-=80px", rotate: "-45deg"}, 250, "easeInQuad", function()
		{
			app.removeNode(self);
			app.updateArrowsThrottled();
		});
		app.deleting(null);
	}

	this.drag = function()
	{
		var dragging = false;
		var groupDragging = false;

		var offset = [0, 0];
		var moved = false;

		$(document.body).on("mousemove", function(e) 
		{
			if (dragging)
			{
				var parent = $(self.element).parent();
				var newX = (e.pageX / self.getScale() - offset[0]);
				var newY = (e.pageY / self.getScale() - offset[1]);
				var movedX = newX - self.x();
				var movedY = newY - self.y();

				moved = true;
				self.x(newX);
				self.y(newY);

				if (groupDragging)
				{
					var nodes = [];
					if(self.selected)
					{
						nodes = app.getSelectedNodes();
						nodes.splice(nodes.indexOf(self), 1);
					}	
					else
					{
						nodes = app.getNodesConnectedTo(self);
					}
					
					if (nodes.length > 0)
					{
						for (var i in nodes)
						{
							nodes[i].x(nodes[i].x() + movedX);
							nodes[i].y(nodes[i].y() + movedY);
						}
					}
				}


				//app.refresh();
				app.updateArrowsThrottled();
			}
		});

		$(self.element).on("mousedown", function (e) 
		{
			if (!dragging && self.active())
			{
				var parent = $(self.element).parent();

				dragging = true;

				if (app.shifted || self.selected)
				{
					groupDragging = true;
				}

				offset[0] = (e.pageX / self.getScale() - self.x());
				offset[1] = (e.pageY / self.getScale() - self.y());
			}
		});

		$(self.element).on("mousedown", function(e)
		{
			e.stopPropagation();
		});

		$(self.element).on("mouseup", function (e)
		{
			//alert("" + e.target.nodeName);
			if (!moved)
				app.mouseUpOnNodeNotMoved();

			moved = false;
		});

		$(document.body).on("mouseup", function (e) 
		{
			dragging = false;
			groupDragging = false;
			moved = false;

			app.updateArrowsThrottled();
		});
	}

	this.moveTo = function(newX, newY)
	{
		$(self.element).clearQueue();
		$(self.element).transition(
			{
				x: newX,
				y: newY
			},
			app.updateArrowsThrottled,
			500
		);
	}

	this.isConnectedTo = function(otherNode, checkBack)
	{
		if (checkBack && otherNode.isConnectedTo(self, false))
			return true;

		var linkedNodes = self.linkedTo();
		for (var i in linkedNodes)
		{
			if (linkedNodes[i] == otherNode)
				return true;
			if (linkedNodes[i].isConnectedTo(otherNode, false))
				return true;
			if (otherNode.isConnectedTo(linkedNodes[i], false))
				return true;
		}

		return false;
	}
	this.is_overlapping = function (x1,x2,y1,y2){
    	return Math.max(x1,y1) <= Math.min(x2,y2)
	}
	this.getLinksInNode = function(){
		// find all the links
		var links = self.body().match(/\[\[(.*?)\]\]/g);
		var functionCallingNodeConnect = self.body().match(/\<\<(.*?)\>\>/g);
		var nodesToReturn = []
		var ranges = []
		var exists = {};
		
		if(functionCallingNodeConnect != undefined){
			for (var i = functionCallingNodeConnect.length - 1; i >= 0; i --)
			{
				if(functionCallingNodeConnect[i].includes("goToNodeIf")){
				functionCallingNodeConnect[i] = functionCallingNodeConnect[i].substr(2, functionCallingNodeConnect[i].length - 4).split(" ")//.toLowerCase(); 
				var node1 = functionCallingNodeConnect[i][functionCallingNodeConnect[i].length -2]
				var node2 = functionCallingNodeConnect[i][functionCallingNodeConnect[i].length -1]
				if(node1 !== undefined && node2 !== undefined){
					nodesToReturn.push(node1)
					nodesToReturn.push(node2)
				}
				}
				else if(functionCallingNodeConnect[i].includes("getNodeThatMatchesRange")){
					functionCallingNodeConnect[i].substr(2, functionCallingNodeConnect[i].length - 4).split(",")[1].split("|").forEach(element => {
						element.trim()
						if(element.trim().split(" ")[1].trim().match(/^(?=\d{1,13}(-\d{1,13}){1,1}$)[\d-]{1,6}$/g) && element.trim().split(" ")[1].trim().split("-")[0] >= 0 && element.trim().split(" ")[1].trim().split("-")[0] <= 100){
							if(ranges.length == 0){
							nodesToReturn.push(element.trim().split(" ")[0].trim())
								ranges.push(element.trim().split(" ")[1].trim())
							}else{
								var range = element.trim().split(" ")[1].trim()
								var shouldadd = false
								ranges.forEach(r => {
									if(!this.is_overlapping(r.split("-")[0], r.split("-")[1], range.split("-")[0],range.split("-")[1])){
										nodesToReturn.push(element.trim().split(" ")[0].trim())
									}

								})


							}
						}
						
					
					});

				}
			}
		}
		if (links != undefined)
		{
			
			for (var i = links.length - 1; i >= 0; i --)
			{
				links[i] = links[i].substr(2, links[i].length - 4)//.toLowerCase(); 
				
				if (links[i].indexOf("|") >= 0)
				{
					links[i] = links[i].split("|")[1];
				}

				if (exists[links[i]] != undefined)
				{
					links.splice(i, 1);
				}
				exists[links[i]] = true;
				nodesToReturn.push(links[i])
			}
		
		}
		if(nodesToReturn.length > 0){
			return nodesToReturn
		}
		else{return undefined}
	}

	this.updateLinks = function()
	{
		self.resetDoubleClick();
		// clear existing links
		self.linkedTo.removeAll();
		// find all the links
		var links = self.getLinksInNode();

		if (links != undefined)
		{
			// update links
			for (var index in app.nodes())
			{
				var other = app.nodes()[index];
				for (var i = 0; i < links.length; i ++)
				{
					// if (other != self && other.title().toLowerCase() == links[i])
					if (other != self && other.title() == links[i])
					{
						self.linkedTo.push(other);
					}
				}
			}	
		}
	}

	this.getScale = function() {
		if (app && typeof app.cachedScale === 'number') {
			return app.cachedScale;
		} else {
			return 1;
		}
	}
}

ko.bindingHandlers.nodeBind = 
{
	init: function(element, valueAccessor, allBindings, viewModel, bindingContext) 
	{
		bindingContext.$rawData.element = element;
		bindingContext.$rawData.create();
	},

	update: function(element, valueAccessor, allBindings, viewModel, bindingContext) 
	{
		$(element).on("mousedown", function() { Utils.pushToTop($(element)); });
	}
};
