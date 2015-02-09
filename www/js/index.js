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
(function() {
    'use strict';

    function getObjectAtPath(object, path) {
        var paths,
            current,
            value,
            i;
        if (object == null || object == undefined) {
            return null;
        }
        if (path == null || path == undefined || path == '') {
            return object;
        }

        paths = path.split('.');
        current = object;
        for (i = 0; i < paths.length; ++i) {
            path = paths[i];
            value = current[path];

            if (value == null || value == undefined) {
                return null;
            }
        }
        return value;
    }

    var stopURL = 'https://m.gatech.edu/widget/buses/content/api/stop',
        predictURL = 'https://m.gatech.edu/widget/buses/content/api/predict/',
        app = {
            currentPage: 0,
            currentPredictions: {},
            stops: [],
            arrangedStops: [],
            position: {},
            closest: [],

            // Application Constructor
            initialize: function() {
                console.log('Initializing application');
                this.bindEvents();
            },
            // Bind Event Listeners
            //
            // Bind any events that are required on startup. Common events are:
            // 'load', 'deviceready', 'offline', and 'online'.
            bindEvents: function() {
                document.addEventListener('deviceready', this.onDeviceReady, false);
            },

            exitApplication: function() {
                console.log('Exiting application.');
                if (navigator.app) {
                    navigator.app.exitApp();
                } else if (navigator.device) {
                    navigator.device.exitApp();
                }
            },

            gatherBusStops: function() {
                console.log('Gathering stop information');
                var deferred = $.Deferred();
                $.getJSON(stopURL)
                    .done(function(results) {
                        console.log('Bus stops are', JSON.stringify(results));
                        deferred.resolve(results);
                    });
                return deferred;
            },

            gatherLaunchParameters: function() {
                console.log('Gathering launch parameters');
                var deferred = $.Deferred();
                rossgerbasi
                    .glass
                    .getLaunchParams(
                    function(results) {
                        console.log('Launch parameters are', JSON.stringify(results));
                        deferred.resolve(results);
                    });
                return deferred;
            },

            gatherCurrentPosition: function() {
                console.log('Gathering current position');
                var deferred = $.Deferred();
                navigator
                    .geolocation
                    .getCurrentPosition(
                    function(position) {
                        console.log('Current position is', JSON.stringify(position));
                        deferred.resolve(position);
                    });
                return deferred;
            },

            calculateDistanceToStops: function() {
                var stopIndex = 0,
                    lastDistance = -1;

                console.log('Calculating stop distance');
                $.each(app.stops, function(index, item) {
                    var diffLat = item.stop_lat - app.position.coords.latitude,
                        diffLong = item.stop_lon - app.position.coords.longitude;
                    item.distance = Math.sqrt(Math.pow(diffLat, 2) + Math.pow(diffLong, 2));
                });

                function compare(a, b) {
                    if (a.distance > b.distance) {
                        return 1;
                    } else if (a.distance < b.distance) {
                        return -1;
                    }
                    return 0;
                }

                app.stops.sort(compare);
                app.closest.length = 0;
                lastDistance = app.stops[0].distance;

                $.each(app.stops, function(index, item) {
                    if (item.distance == app.stops[0].distance) {
                        app.closest.push(item);
                    }
                    if (lastDistance !== item.distance) {
                        stopIndex++;
                    }
                    if (!app.arrangedStops[stopIndex]) {
                        app.arrangedStops[stopIndex] = [];
                    }
                    app.arrangedStops[stopIndex].push(item);
                });

                console.log('Closest stop is', JSON.stringify(app.closest));
            },

            gatherStopPredictions: function(stops) {
                var predictions = {},
                    prediction;

                var deferred = $.Deferred(),
                    resolvedCount = 0;

                /*
                 {route_id":"blue","stop_id":"fitthall_a","stop_name":"Fitten Hall","stop_lat":"33.778274",
                 "stop_lon":"-84.404191","trip_id":"Counterclo","reference_stop_id":"1"}
                 */
                $.each(stops, function(index, item) {
                    prediction = {
                        stop_name: item.stop_name,
                        stop_id: item.stop_id,
                        times: [],
                        promise: null
                    };

                    prediction.promise = $.getJSON(predictURL + item.route_id + '?stop=' + item.stop_id);
                    prediction.promise.then(function(results) {
                        console.log('Prediction result for', item.route_id + '/' + item.stop_id + ':', JSON.stringify(results));
                        prediction.times = getObjectAtPath(results, "query.results.p") || [];
                        if (++resolvedCount == stops.length) {
                            deferred.resolve(predictions);
                        }
                    }).fail(function() {
                        deferred.reject();
                    });

                    predictions[item.route_id] = prediction;
                });

                return deferred;
            },

            updateInterface: function() {
                var stop = app.arrangedStops[app.currentPage][0];
                console.log('Stop is', JSON.stringify(stop));
                $('#loading').hide();
                $('#messages').show();
                if (app.currentPage == 0) {
                    $('#closest').show();
                    $('#notClosest').hide();
                    $('#closestStop').html(stop.stop_name);
                } else {
                    $('#closest').hide();
                    $('#notClosest').show();
                    $('#notClosestStop').html(stop.stop_name);
                }

                $('.stopInfo').hide();
                $.each(app.currentPredictions, function(index, item) {
                    var stopClass = '.' + index,
                        stopMessage = index + 'Minutes';
                    $(stopClass).show();
                    $(stopMessage).html(item.times.join(', '));
                });
            },

            refresh: function() {
                var stopPromise,
                    positionPromise;

                $('#loading').show();
                $('#messages').hide();

                stopPromise = app.gatherBusStops()
                    .then(function(stops) {
                        app.stops = stops;
                    });

                positionPromise = app.gatherCurrentPosition()
                    .then(function(position) {
                        app.position = position;
                    });

                $
                    .when(stopPromise, positionPromise)
                    .then(function() {
                        app.calculateDistanceToStops();
                        app.updatePage();
                    });

            },

            updatePage: function() {
                $('#loading').show();
                $('#messages').hide();
                app
                    .gatherStopPredictions(app.arrangedStops[app.currentPage])
                    .then(function(predictions) {
                        app.currentPredictions = predictions;
                        console.log('Predictions are', JSON.stringify(predictions));
                        app.updateInterface();
                    })
                    .fail(function() {
                        console.log('Unable to gather stop predictions');
                    });
            },

            previousPage: function() {
                if (app.currentPage == 0) {
                    return;
                }
                app.currentPage--;
                app.updatePage();
            },

            nextPage: function() {
                if (app.currentPage == app.arrangedStops.length - 1) {
                    return;
                }
                app.currentPage++;
                app.updatePage();
            },

            // deviceready Event Handler
            //
            // The scope of 'this' is the event. In order to call the 'receivedEvent'
            // function, we must explicitly call 'app.receivedEvent(...);'
            onDeviceReady: function() {
                console.log('Setting up event listeners');
                document.addEventListener('swipedown', app.exitApplication);
                document.addEventListener('swiperight', app.previousPage);
                document.addEventListener('swipeleft', app.nextPage);
                document.addEventListener('tap', app.refresh);

                app.refresh();
            }
        };

    app.initialize()
}());
