/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        var stops = [];
//        app.receivedEvent('deviceready');

        document.addEventListener('swipedown', function() {
            console.log('Exiting application.');
            if (navigator.app) {
                navigator.app.exitApp();
            } else if (navigator.device) {
                navigator.device.exitApp();
            }
        });

        console.log('Gathering stop information');
        var stopURL = 'https://m.gatech.edu/widget/buses/content/api/stop';
        $.getJSON(stopURL)
         .done(function(results) {
           console.log('Stop information:', results);
           stops = results;

           rossgerbasi.glass.getLaunchParams(
             function(results) {
               console.log('Launch Params:', results);
               navigator.geolocation.getCurrentPosition(
                 function(position) {
                   console.log('Lat/Long:', position.coords.latitude, ',', position.coords.longitude);
                   console.log('Finding nearest bus stop');

                   console.log('Calculating stop distance');
                   $.each(stops, function(index, item) {
                     var diffLat = item.stop_lat - position.coords.latitude,
                         diffLong = item.stop_lon - position.coords.longitude
                     var distance = Math.sqrt(Math.pow(diffLat, 2) + Math.pow(diffLong, 2));
                     item.distance = distance;
                   });

                   function compare(a, b) {
                     if (a.distance > b.distance) {
                       return 1;
                     } else if (a.distance < b.distance) {
                       return -1;
                     }
                     return 0;
                   }
                   stops.sort(compare);
                   var closest = [];
                   $.each(stops, function(index, item) {
                     if (item.distance == stops[0].distance) {
                       closest.push(item);
                     }
                   });
                   console.log('Closest stops:', JSON.stringify(closest));
                   $('#closestStop').text(closest[0].stop_name);
                   var predictURL = 'https://m.gatech.edu/widget/buses/content/api/predict/green?stop=';
                   $.each(closest, function(index, stop) {
                     $.getJSON(predictURL + stop.stop_id)
                       .done(function(prediction) {
                         console.log('Prediction for ' + stop.stop_id + ' is', JSON.stringify(prediction));
                         var timeLeft = prediction.query.results.p
                           .map(function(item) { return item + ' minutes'; })
                           .join(', ');
                         $('#busses').append('<span>' + timeLeft + '</span>')
                       });
                   });
                 },
                 function(error) {
                   console.log('Geolocation error:', error);
                 }
               );
             }, function () {
               console.log("Error getting launch Params");
             }
           );
         });
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

app.initialize();
