function Radar(wrapper) {
    
    this.wrapper = wrapper;

    // Constants
    var FIRST_SNAPSHOTS = 6;
    var ANIMATION_DELAY = 500;

    // Map image animation help variables
    var animationHandler = null;
    var imageIds = [];
    var animatedImageIndex = 0;

    // Current snapshots
    var snapshots = {};

    // Set callback on select or slider change
    $(".times").change(function() {
        stop();
        play(getSelectUrls());
    });
    $(".slider-selection").on("input", function() {
        pause();
        refreshMap(getSliderUrls());
    })

    // Set callback on play/pause/stop
    $(".control-button").click(toggleAnimation);
    $(".stop").click(stop);
    
    // Show map
    imageLayer = initMap(); 

    // First download possible snapshots for last 2 days
    downloadSnapshots((function(d){ d.setDate(d.getDate()-2); return d})(new Date), function() {
        prepareDay()
    });

    

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

    // Starts the animation from currently selected image
    function play(urls) {

        // Set button class
        $(".control-button").removeClass("play").addClass("pause");

        refreshMap(urls, true);
    }

    // Pauses the animation
    function pause() {

        // Set button class
        $(".control-button").removeClass("pause").addClass("play");

        if (animationHandler != null)
            clearInterval(animationHandler);
    }

    // Stops the animation
    function stop() {
        pause();

        animatedImageIndex = 0;
        
        setImage(getSelectUrls());
    }

    // Set current image on the map
    function setImage(urls) {
        
        // Set image
        var id = imageLayer.addImage(urls[animatedImageIndex]["url"], SMap.Coords.fromWGS84(snapshots["start-lon"], snapshots["start-lat"]), SMap.Coords.fromWGS84(snapshots["end-lon"], snapshots["end-lat"]));
        setTimeout(function() {
            for (var i in imageIds)
                imageLayer.removeImage(imageIds[i]);
            imageIds.length = 0
            imageIds.push(id);
        }, 1);

        // Sync time holder
        $(".time-holder").text(urls[animatedImageIndex]["datetime"]);
    }

    // Set images to map by selection
    function refreshMap(urls, unpause) {

        // Stop current animation
        if (animationHandler != null)
            clearInterval(animationHandler);

        // Either start from the beginning or not
        if (!unpause)
            animatedImageIndex = 0;

        // Set images to layer and start animation
        if (urls.length == 1)
            setImage(urls);
        else {
            animationHandler = setInterval(function _temp() {

                // Change image
                setImage(urls);

                animatedImageIndex = ++animatedImageIndex % urls.length;

                return _temp;
            }(), ANIMATION_DELAY);
        }
    }

    // Prepares selecting of hours
    function prepareDay() {
        
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

        // Set slider
        $(".slider-selection").attr("max", snapshots["images"].length - 1)

        // Refresh map
        play(getSelectUrls());
    }

    // Either play or pause animation
    function toggleAnimation() {

        // Get action
        var shouldPlay = $(".control-button").hasClass("play");

        // Either play or pause animation
        if (shouldPlay)
            play(getSelectUrls());
        else
            pause();
    }

    // Get urls of selected images in select
    function getSelectUrls() {
        return $.map($(".times option:selected"), function (x) {
            return {
                url: snapshots["images"][parseInt($(x).attr("data-index"))]["url"],
                datetime: $(x).text()
            }
        }).reverse()
    }

    // Get urls of selected images in slider
    function getSliderUrls() {

        var snapshot = snapshots["images"][parseInt($(".slider-selection").val())];
        var datetime = snapshot["datetime"];
        var text = formatDateTime(datetime);

        return [{
            url: snapshot["url"],
            datetime: text
        }];
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