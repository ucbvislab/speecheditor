/*
    tabSlideOUt v1.3
    
    By William Paoli: http://wpaoli.building58.com

    To use you must have an image ready to go as your tab
    Make sure to pass in at minimum the path to the image and its dimensions:
    
    example:
    
        $('.slide-out-div').tabSlideOut({
                tabHandle: '.handle',                         //class of the element that will be your tab -doesnt have to be an anchor
                pathToTabImage: 'images/contact_tab.gif',     //relative path to the image for the tab
                imageHeight: '133px',                         //height of tab image
                imageWidth: '44px',                           //width of tab image   
        });

    or you can leave out these options
    and set the image properties using css
    
*/


(function($){
    
    var defaults = {
        tabHandle: '.handle',
        speed: 300, 
        action: 'click',
        tabLocation: 'left',
        topPos: '200px',
        leftPos: '20px',
        fixedPosition: false,
        positioning: 'absolute',
        pathToTabImage: null,
        imageHeight: null,
        imageWidth: null,
        onLoadSlideOut: false,
        topReferenceElement: null,
        height: null  
    };
    
    var recomputeProperties = function (obj, settings) {
        var height = obj.outerHeight();
        if (typeof(settings.height) === "function") {
            height = settings.height(obj);
        }
            
        return {
                containerWidth: parseInt(obj.outerWidth(), 10) + 'px',
                containerHeight: parseInt(height, 10) + 20 + 'px',
                tabWidth: parseInt(settings.tabHandle.outerWidth(), 10) + 'px',
                tab
                : parseInt(settings.tabHandle.outerHeight(), 10) + 'px'
        };
    };
    
    var setBoxCSS = function (obj, settings, properties) {
        //set calculated css
        if(settings.tabLocation === 'top' || settings.tabLocation === 'bottom') {
            obj.css({'left' : settings.leftPos});
            settings.tabHandle.css({'right' : 0});
        }
        
        if(settings.tabLocation === 'top') {
            obj.css({'top' : '-' + properties.containerHeight});
            settings.tabHandle.css({'bottom' : '-' + properties.tabHeight});
        }

        if(settings.tabLocation === 'bottom') {
            obj.css({'bottom' : '-' + properties.containerHeight, 'position' : 'fixed'});
            settings.tabHandle.css({'top' : '-' + properties.tabHeight});
            
        }
        
        if(settings.tabLocation === 'left' || settings.tabLocation === 'right') {
            var top = parseInt(settings.topPos, 10);
            var topPos = parseInt(settings.topPos, 10);
            var diff = 0;
            if (settings.topReferenceElement) {
                top = $(settings.topReferenceElement).position().top;
                diff = topPos - top;
            }
                
            console.log("diff", diff, "top", top, "topPos", topPos, "height", 
                properties.containerHeight);
                
            obj.css({
                'height' : properties.containerHeight,
                'top' : top
            });
            
            settings.tabHandle.css({'top' : topPos + "px"});
        }
        
        if(settings.tabLocation === 'left') {
            obj.css({ 'left': '-' + properties.containerWidth});
            settings.tabHandle.css({'right' : '-' + properties.tabWidth});
        }

        if(settings.tabLocation === 'right') {
            obj.css({ 'right': '-' + properties.containerWidth});
            settings.tabHandle.css({'left' : '-' + properties.tabWidth});
            
            $('html').css('overflow-x', 'hidden');
        }
    };
    
    var methods = {
        refresh: function () {
            console.log("this", $(this))
            var data = $(this).data('tabSlideOut');
            if (data) {
                var properties = recomputeProperties($(this), data);
                setBoxCSS(this, data, properties);
                console.log("reset", properties)
            } else {
                
            }
        }
    };
    
    $.fn.tabSlideOut = function(callerSettings) {
        
        if (typeof(callerSettings) === "string") {
            if (methods[callerSettings]) {
                return methods[callerSettings].apply(
                    this, Array.prototype.slice.call(arguments, 1));
            }
            return;
        }
        
        var settings = $.extend(defaults, callerSettings||{});

        var data = $(this).data('tabSlideOut');
        if (!data) {
            $(this).data('tabSlideOut', settings);
        }

        settings.tabHandle = $(settings.tabHandle);
        var obj = this;
        if (settings.fixedPosition === true) {
            settings.positioning = 'fixed';
        } else {
            settings.positioning = 'absolute';
        }
        
        //ie6 doesn't do well with the fixed option
        if (document.all && !window.opera && !window.XMLHttpRequest) {
            settings.positioning = 'absolute';
        }
        

        
        //set initial tabHandle css
        
        if (settings.pathToTabImage != null) {
            settings.tabHandle.css({
            'background' : 'url('+settings.pathToTabImage+') no-repeat',
            'width' : settings.imageWidth,
            'height': settings.imageHeight
            });
        }
        
        settings.tabHandle.css({ 
            'display': 'block',
            'textIndent' : '-99999px',
            'outline' : 'none',
            'position' : 'absolute'
        });
        
        obj.css({
            'line-height' : '1',
            'position' : settings.positioning
        });
        
        var properties = recomputeProperties(obj, settings);
        setBoxCSS(obj, settings, properties);
        
        //functions for animation events
        
        settings.tabHandle.click(function(event){
            event.preventDefault();
        });
        
        var slideIn = function() {
            
            if (obj.hasClass('open')) {
                var properties = recomputeProperties(obj, settings);

                console.log("props", properties)
            
                if (settings.tabLocation === 'top') {
                    obj.animate({top:'-' + properties.containerHeight}, settings.speed).removeClass('open');
                } else if (settings.tabLocation === 'left') {
                    obj.animate({left: '-' + properties.containerWidth}, settings.speed).removeClass('open');
                } else if (settings.tabLocation === 'right') {
                    obj.animate({right: '-' + properties.containerWidth}, settings.speed).removeClass('open');
                } else if (settings.tabLocation === 'bottom') {
                    obj.animate({bottom: '-' + properties.containerHeight}, settings.speed).removeClass('open');
                }    
            }
        };
        
        var slideOut = function() {
            var properties = recomputeProperties(obj, settings);
            setBoxCSS(obj, settings, properties);
            console.log("props out", properties)
            console.log(obj[0].scrollHeight)
            
            if (settings.tabLocation == 'top') {
                obj.animate({top:'-3px'},  settings.speed).addClass('open');
            } else if (settings.tabLocation == 'left') {
                obj.animate({left:'-3px'},  settings.speed).addClass('open');
            } else if (settings.tabLocation == 'right') {
                obj.animate({right:'-3px'},  settings.speed).addClass('open');
            } else if (settings.tabLocation == 'bottom') {
                obj.animate({bottom:'-3px'},  settings.speed).addClass('open');
            }
        };

        var clickScreenToClose = function() {
            obj.click(function(event){
                event.stopPropagation();
            });
            
            $(document).click(function(){
                slideIn();
            });
        };
        
        var clickAction = function(){
            settings.tabHandle.click(function(event){
                if (obj.hasClass('open')) {
                    slideIn();
                } else {
                    slideOut();
                }
            });
            
            clickScreenToClose();
        };
        
        var hoverAction = function(){
            obj.hover(
                function(){
                    slideOut();
                },
                
                function(){
                    slideIn();
                });
                
                settings.tabHandle.click(function(event){
                    if (obj.hasClass('open')) {
                        slideIn();
                    }
                });
                clickScreenToClose();
                
        };
        
        var slideOutOnLoad = function(){
            slideIn();
            setTimeout(slideOut, 500);
        };
        
        //choose which type of action to bind
        if (settings.action === 'click') {
            clickAction();
        }
        
        if (settings.action === 'hover') {
            hoverAction();
        }
        
        if (settings.onLoadSlideOut) {
            slideOutOnLoad();
        };
        
    };
})(jQuery);
