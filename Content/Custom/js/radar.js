function Radar(wrapper) {
    
    this.wrapper = wrapper;

    // Constants
    var FIRST_SNAPSHOTS = 6;
    var ANIMATION_DELAY = 500;

    // Map image animation help variables
    var animationHandler = null;
    var imageIds = [];
    var animatedIndex = 0;

    // Current snapshots
    var snapshots = {};

    // Set callback on select or slider change
    $(".times").change(function() {
        stop();
        play();
    });
    $(".slider-selection").on("input", function() {
        pause();
        setSnapshot(getSliderIndex());
    })

    // Set callback on play/pause/stop
    $(".control-button").click(function() {
         // Either play or pause animation
         if ($(".control-button").hasClass("play"))
             play();
         else
             pause();
    });
    $(".stop").click(stop);
    
    // Show map
    var imageLayer = initMap(); 

    // First download possible snapshots for last 2 days
    downloadSnapshots((function(d){ d.setDate(d.getDate()-2); return d})(new Date), function() {
        prepareControls();
        play();
    });


    

    // Starts the animation from currently selected image
    function play() {

        // Set button class
        $(".control-button").removeClass("play").addClass("pause");

        // Start animating
        animateSnapshots(getSelectIndicies());
    }

    // Pauses the animation
    function pause() {

        // Set button class
        $(".control-button").removeClass("pause").addClass("play");

        // Stop animation
        if (animationHandler != null)
            clearInterval(animationHandler);
    }

    // Stops the animation
    function stop() {
        
        // Set button class
        $(".control-button").removeClass("pause").addClass("play");

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
        
        // Set image
        var id = imageLayer.addImage(snapshots["images"][index]["url"], SMap.Coords.fromWGS84(snapshots["start-lon"], snapshots["start-lat"]), SMap.Coords.fromWGS84(snapshots["end-lon"], snapshots["end-lat"]));
        
        // Remove previous images
        setTimeout(function() {
            for (var i in imageIds)
                imageLayer.removeImage(imageIds[i]);
            imageIds.length = 0

            imageIds.push(id);
        }, 1);

        // Sync time holder
        $(".time-holder").text(formatDateTime(snapshots["images"][index]["datetime"]));
    }

    // Prepares map and controls by snapshots
    function prepareControls() {
        
        // Clear select list
        var select = $(".times");
        select.empty();
        
        // Attach dates to select
        for (var i in snapshots["images"]) {

            var datetime = snapshots["images"][i]["datetime"];

            var opt = $("<option>");
            opt.text(formatDateTime(datetime))
            opt.attr("data-index", i)

            select.prepend(opt);
        }

        // Select first 6
        select.find("option").slice(0, FIRST_SNAPSHOTS).attr('selected', true);
        animatedIndex = 0;

        // Set slider's max value
        $(".slider-selection").attr("max", snapshots["images"].length - 1)
    }

    // Get indicies of selected images in select
    function getSelectIndicies() {
        return $.map($(".times option:selected"), function (x) {
            return parseInt($(x).attr("data-index"));
        }).reverse()
    }

    // Gets index of selected snapshots in slider
    function getSliderIndex() {
        return parseInt($(".slider-selection").val());
    }

    // Download possible snapshots for given date
    function downloadSnapshots(date, callback) {
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        
        httpGetAsync("https://api.meteopress.cz/radar-composite-manager/v2/composites/3/images?since=" + toUnixTime(date), function(json) {
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
        var center = SMap.Coords.fromWGS84(15.472962, 49.817492);
        var map = new SMap(JAK.gel("czMap"), center, 7);
        map.addDefaultLayer(SMap.DEF_BASE).enable();
        map.addDefaultControls();

        // Add image layer
        var imageLayer = new SMap.Layer.Image();    
        map.addLayer(imageLayer, false);                     
        imageLayer.enable();
        $(imageLayer.getContainer()[0].parentElement).addClass("mapy-layers");
        
        return imageLayer;
    }

    // Returns string representation of datetime
    function formatDateTime(datetime) {
        return datetime.getDate().toString().padStart(2, "0") + "." + (datetime.getMonth() + 1).toString().padStart(2, "0") + ". " + datetime.getHours().toString().padStart(2, "0") + ":" + datetime.getMinutes().toString().padStart(2, "0");
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

    // Converts unix time stamp to JS date
    function fromUnixTime(timestamp) {
        return new Date(timestamp * 1000);
    }

    // Converts date to unix timestamp
    function toUnixTime(date) {
        return date.getTime() / 1000;
    }
}