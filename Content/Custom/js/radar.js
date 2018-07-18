function Radar(wrapper, initDateTime, getUrlFunc) {

    // TODO
    // Style

    // Constants
    var FIRST_SNAPSHOTS = 6;
    var ANIMATION_DELAY = 500;

    // Map image animation help variables
    var animationHandler = null;
    var imageIds = [];
    var animatedIndex = 0;
    var imgCache = {};

    // Current snapshots
    var snapshots = {};

    // Set callback on select or slider change
    wrapper.find(".times").change(function() {
        stop();
        play();
    });
    wrapper.find(".slider-selection").on("input", function() {
        pause();
        setSnapshot(getSliderIndex());
    })

    // Set callback on play/pause/stop
    wrapper.find(".control-button").click(function() {
         // Either play or pause animation
         if ($(this).hasClass("play"))
             play();
         else
             pause();
    });
    wrapper.find(".stop").click(stop);

    // Set callback on date and time change
    wrapper.find(".side input").add(wrapper.find(".side .hours")).change(function() {
        var date = getSelectedDateTime();

        // Download snapshots and play
        downloadSnapshots(date, function() {
            prepareControls();
            play();
        });
    })
    
    // Show map
    var imageLayer = initMap(); 

    // Init controls
    initControls(initDateTime);

    // First download snapshot and play the animation
    downloadSnapshots(initDateTime, function() {
        prepareControls();
        play();
    });


    

    // Starts the animation from currently selected image
    function play() {

        // Set button class
        wrapper.find(".control-button").removeClass("play").addClass("pause");

        // Start animating
        animateSnapshots(getSelectIndicies());
    }

    // Pauses the animation
    function pause() {

        // Set button class
        wrapper.find(".control-button").removeClass("pause").addClass("play");

        // Stop animation
        if (animationHandler != null)
            clearInterval(animationHandler);
    }

    // Stops the animation
    function stop() {
        
        // Set button class
        wrapper.find(".control-button").removeClass("pause").addClass("play");

        // Stop animation
        if (animationHandler != null)
            clearInterval(animationHandler);
        
        // Reset current snapshot index on the first index of selected snapshots
        animatedIndex = 0;
        
        // Set the first snapshot
        setSnapshot(getSelectIndicies()[0]);
    }

    // Starts animate given indicies
    function animateSnapshots(indicies) {

        // Stop current animation
        if (animationHandler != null)
            clearInterval(animationHandler);

        // Set images to layer and start animation
        if (indicies.length == 1)
            setSnapshot(indicies[0]);
        else {
            animationHandler = setInterval(function _temp() {

                // Change image
                setSnapshot(indicies[animatedIndex]);

                animatedIndex = ++animatedIndex % indicies.length;

                return _temp;
            }(), ANIMATION_DELAY);
        }
    }

    // Set current image on the map and syncs time holder
    function setSnapshot(index) {
        
        function _setSnapshot(url) {
            var id = imageLayer.addImage(url, SMap.Coords.fromWGS84(snapshots["start-lon"], snapshots["start-lat"]), SMap.Coords.fromWGS84(snapshots["end-lon"], snapshots["end-lat"]));
            
            // Remove previous images
            setTimeout(function() {
                for (var i in imageIds)
                    imageLayer.removeImage(imageIds[i]);
                imageIds.length = 0

                imageIds.push(id);
            }, 1);

            // Sync time holder
            wrapper.find(".time-holder").text(formatDateTime(snapshots["images"][index]["datetime"]));
        }

        // Either get image from cache or convert image to base64
        var url = snapshots["images"][index]["url"];
        if (imgCache[url])
            _setSnapshot(imgCache[url]);
        else {
            _setSnapshot(url);

            // Convert and save to cache
            imgToDataUrl(url, function(img) {
                imgCache[url] = img;
            })
        }
    }

    // Prepares map and controls by snapshots
    function prepareControls() {
        
        // Clear select list
        var select = wrapper.find(".times");
        select.empty();
        
        // Attach dates to select
        for (var i in snapshots["images"]) {

            var datetime = snapshots["images"][i]["datetime"];

            var opt = $("<option>");
            opt.text(formatDateTime(datetime))
            opt.attr("data-index", i)

            select.prepend(opt);
        }

        // Select proper hour
        wrapper.find(".side .hours").val(snapshots["images"][0]["datetime"].getHours());

        // Select first 6
        select.find("option").slice(0, FIRST_SNAPSHOTS).attr('selected', true);
        animatedIndex = 0;

        // Set slider's max value
        wrapper.find(".slider-selection").attr("max", snapshots["images"].length - 1).val(snapshots["images"].length - 1);
    }

    // Get indicies of selected images in select
    function getSelectIndicies() {
        return $.map(wrapper.find(".times option:selected"), function (x) {
            return parseInt($(x).attr("data-index"));
        }).reverse()
    }

    // Gets index of selected snapshots in slider
    function getSliderIndex() {
        return parseInt(wrapper.find(".slider-selection").val());
    }

    // Gets date and time which were selected
    function getSelectedDateTime() {
        var date = wrapper.find(".side input")[0].valueAsDate;
        date.setHours(wrapper.find(".side .hours").val())
        
        return date;
    }

    // Download possible snapshots for given date
    function downloadSnapshots(date, callback) {
        
        httpGetAsync(getUrlFunc(date), function(json) {
            json = JSON.parse(json);

            // Process json
            snapshots["start-lon"] = json["image_coordinates"]["min_lon"];
            snapshots["start-lat"] = json["image_coordinates"]["max_lat"];
            snapshots["end-lon"] = json["image_coordinates"]["max_lon"];
            snapshots["end-lat"] = json["image_coordinates"]["min_lat"];

            snapshots["images"] = [];
            for (var i in json["images"]) {
                var item = json["images"][i];
                var datetime = fromUnixTime(item["timestamp"]);
                var url = item["url"];

                var snapshot = {
                    "datetime": datetime,
                    "url" : url
                };
                
                snapshots["images"].push(snapshot);
            }

            callback();
        });
    }

    // Inits map and returns handler to image layer
    function initMap() {

        // Set map width
        var mapDiv = wrapper.find(".czMap");
        mapDiv.width(mapDiv.parent().width() - mapDiv.next().width())
        mapDiv.height(window.innerHeight - wrapper.find(".under").outerHeight())

        // Center of CZ
        var center = SMap.Coords.fromWGS84(15.472962, 49.817492);

        // Load map
        var map = new SMap(JAK.gel(mapDiv[0]), center, 8);

        // Set zoom by some points
        var points = [
            SMap.Coords.fromWGS84(13.2883104, 50.6347454),
            SMap.Coords.fromWGS84(18.322215, 49.1988972),
        ];
        var result = map.computeCenterZoom(points, false);
        map.setZoom(result[1]);

        // Add controls
        map.addDefaultLayer(SMap.DEF_BASE).enable();
        map.addDefaultControls();

        // Add image layer
        var imageLayer = new SMap.Layer.Image();    
        map.addLayer(imageLayer, false);                     
        imageLayer.enable();
        $(imageLayer.getContainer()[0].parentElement).addClass("mapy-layers");

        // Add HTML layer
        var htmlLayer = new SMap.Layer.HUD();
        map.addLayer(htmlLayer, false);
        htmlLayer.enable();
        htmlLayer.addItem($("<h2 class=\"time-holder\"></h>")[0], { top: "-2px", right: "100px"}, true);

        return imageLayer;
    }

    // Initializes controls
    function initControls(date) {

         // Set date to today
         var datePicker = wrapper.find(".side input");
         var dateValue = datePicker.val();
         if (datePicker.length > 0 && (!dateValue || dateValue.length == 0))
             datePicker.val(formatInputDate(date));

        // Set options to hours select
        var hourPicker = wrapper.find(".side .hours");
        for (i = 0; i < 24; ++i)
            hourPicker.append($("<option>").val(i).text(i.toString().padStart(2, "0") + ":00"))

        // Set times height
        wrapper.find(".times").height(window.innerHeight - wrapper.find(".under").outerHeight() - (datePicker.length > 0 ? datePicker.outerHeight() : 0) - (hourPicker.length > 0 ? hourPicker.outerHeight() : 0));
    }

    // Returns string representation of datetime
    function formatDateTime(datetime) {
        return datetime.getDate().toString().padStart(2, "0") + "." + (datetime.getMonth() + 1).toString().padStart(2, "0") + ". " + datetime.getHours().toString().padStart(2, "0") + ":" + datetime.getMinutes().toString().padStart(2, "0");
    }

    // Formats date to format suitable for input of type date
    function formatInputDate(date) {
        return date.getFullYear().toString().padStart(2, "0") + "-" + (date.getMonth() + 1).toString().padStart(2, "0") + "-" + date.getDate().toString().padStart(2, "0")
    }

    // Downloads file from given url and then calls callback with the result
    function httpGetAsync(url, callback)
    {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() { 
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
                callback(xmlHttp.responseText);
        }
        xmlHttp.open("GET", url, true);
        xmlHttp.send(null);
    }

}

// Converts image to its data url
function imgToDataUrl(src, callback) {
    var img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        var canvas = document.createElement('CANVAS');
        var ctx = canvas.getContext('2d');
        canvas.height = this.naturalHeight;
        canvas.width = this.naturalWidth;
        ctx.drawImage(this, 0, 0);
        var dataURL = canvas.toDataURL();
        callback(dataURL);
    };
    img.src = src;
    
    if (img.complete || img.complete === undefined) {
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        img.src = src;
    }
}


// Converts unix time stamp to JS date
function fromUnixTime(timestamp) {
    return new Date(timestamp * 1000);
}

// Converts date to unix timestamp
function toUnixTime(date) {
    return date.getTime() / 1000;
}